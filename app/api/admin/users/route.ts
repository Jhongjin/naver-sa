import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getConfiguredAdminEmails, getUserRole, verifyUserAccess, type AppUserRole } from "@/lib/auth-access";
import { getSupabaseAdminClient, getSupabaseAdminState } from "@/lib/supabase-admin";

type WorkspaceMemberActivityRow = {
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
};

type PlanningRunActivityRow = {
  id: string;
  workspace_id: string | null;
  created_by_user_id: string | null;
  created_by: string | null;
  created_at: string;
};

export async function GET(request: Request) {
  const access = await verifyUserAccess(request, { requireAdmin: true });

  if (!access.ok) {
    return NextResponse.json(access, { status: access.status });
  }

  const admin = getAdminClientOrResponse();

  if (admin instanceof NextResponse) {
    return admin;
  }

  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 100
  });

  if (error) {
    return NextResponse.json({ ok: false, error: sanitizeAdminError(error.message) }, { status: 502 });
  }

  const activity = await getUserActivitySummary(admin, data.users);

  if (!activity.ok) {
    return NextResponse.json({ ok: false, error: activity.error }, { status: 502 });
  }

  const users = data.users.map((user) => ({
    id: user.id,
    email: user.email ?? null,
    role: getUserRole(user),
    roleSource: getRoleSource(user),
    emailConfirmed: Boolean(user.email_confirmed_at),
    isCurrentUser: user.id === access.user.id,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    displayName: stringMetadata(user.user_metadata?.display_name),
    companyName: stringMetadata(user.user_metadata?.company_name),
    workspaceCount: activity.byUser.get(user.id)?.workspaceCount ?? 0,
    ownedWorkspaceCount: activity.byUser.get(user.id)?.ownedWorkspaceCount ?? 0,
    planningRunCount: activity.byUser.get(user.id)?.planningRunCount ?? 0,
    latestPlanningRunAt: activity.byUser.get(user.id)?.latestPlanningRunAt ?? null
  }));

  return NextResponse.json({
    ok: true,
    users,
    total: users.length
  });
}

export async function PATCH(request: Request) {
  const access = await verifyUserAccess(request, { requireAdmin: true });

  if (!access.ok) {
    return NextResponse.json(access, { status: access.status });
  }

  const admin = getAdminClientOrResponse();

  if (admin instanceof NextResponse) {
    return admin;
  }

  const body = await readJson(request);
  const userId = typeof body.userId === "string" ? body.userId : "";
  const role = body.role === "admin" || body.role === "member" ? (body.role as AppUserRole) : null;

  if (!userId || !role) {
    return NextResponse.json({ ok: false, error: "userId and role are required." }, { status: 400 });
  }

  const { data: existing, error: getError } = await admin.auth.admin.getUserById(userId);

  if (getError || !existing.user) {
    return NextResponse.json({ ok: false, error: "User was not found." }, { status: 404 });
  }

  if (existing.user.id === access.user.id && role === "member") {
    return NextResponse.json({ ok: false, error: "You cannot demote your own administrator account." }, { status: 400 });
  }

  if (role === "member" && getRoleSource(existing.user) === "adminEmails") {
    return NextResponse.json(
      {
        ok: false,
        error: "This user is still listed in ADMIN_EMAILS. Remove that environment allowlist entry before demotion."
      },
      { status: 400 }
    );
  }

  if (role === "member" && getUserRole(existing.user) === "admin") {
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 100
    });

    if (usersError) {
      return NextResponse.json({ ok: false, error: sanitizeAdminError(usersError.message) }, { status: 502 });
    }

    const remainingAdminCount = usersData.users.filter((user) => {
      return user.id !== existing.user.id && getUserRole(user) === "admin";
    }).length;

    if (remainingAdminCount === 0) {
      return NextResponse.json(
        { ok: false, error: "At least one administrator account must remain active." },
        { status: 400 }
      );
    }
  }

  const nextMetadata = {
    ...existing.user.app_metadata,
    role
  };
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: nextMetadata
  });

  if (error) {
    return NextResponse.json({ ok: false, error: sanitizeAdminError(error.message) }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    userId,
    role
  });
}

function getAdminClientOrResponse() {
  const state = getSupabaseAdminState();

  if (!state.ready) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase admin environment is not configured."
      },
      { status: 503 }
    );
  }

  const admin = getSupabaseAdminClient();

  if (!admin) {
    return NextResponse.json({ ok: false, error: "Supabase admin client is unavailable." }, { status: 503 });
  }

  return admin;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = (await request.json()) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function getUserActivitySummary(
  admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  users: User[]
): Promise<
  | {
      ok: true;
      byUser: Map<
        string,
        {
          workspaceCount: number;
          ownedWorkspaceCount: number;
          planningRunCount: number;
          latestPlanningRunAt: string | null;
        }
      >;
    }
  | { ok: false; error: string }
> {
  const userIds = users.map((user) => user.id);
  const emails = users.map((user) => user.email?.toLowerCase()).filter((email): email is string => Boolean(email));

  const [membershipsResult, runsByUserResult, legacyRunsResult] = await Promise.all([
    userIds.length > 0
      ? admin.from("workspace_members").select("workspace_id, user_id, role").in("user_id", userIds)
      : { data: [], error: null },
    userIds.length > 0
      ? admin
          .from("planning_runs")
          .select("id, workspace_id, created_by_user_id, created_by, created_at")
          .in("created_by_user_id", userIds)
      : { data: [], error: null },
    emails.length > 0
      ? admin.from("planning_runs").select("id, workspace_id, created_by_user_id, created_by, created_at").in("created_by", emails)
      : { data: [], error: null }
  ]);

  const lookupError = membershipsResult.error ?? runsByUserResult.error ?? legacyRunsResult.error;

  if (lookupError) {
    return {
      ok: false,
      error: sanitizeAdminError(lookupError.message)
    };
  }

  const byUser = new Map<
    string,
    {
      workspaceCount: number;
      ownedWorkspaceCount: number;
      planningRunCount: number;
      latestPlanningRunAt: string | null;
    }
  >();
  const seenWorkspacesByUser = new Map<string, Set<string>>();
  const seenRunsByUser = new Map<string, Set<string>>();
  const userIdsByEmail = new Map<string, string[]>();

  for (const user of users) {
    byUser.set(user.id, {
      workspaceCount: 0,
      ownedWorkspaceCount: 0,
      planningRunCount: 0,
      latestPlanningRunAt: null
    });

    const email = user.email?.toLowerCase();

    if (email) {
      userIdsByEmail.set(email, [...(userIdsByEmail.get(email) ?? []), user.id]);
    }
  }

  for (const membership of (membershipsResult.data ?? []) as WorkspaceMemberActivityRow[]) {
    const summary = byUser.get(membership.user_id);

    if (!summary) {
      continue;
    }

    const seenWorkspaces = seenWorkspacesByUser.get(membership.user_id) ?? new Set<string>();

    if (!seenWorkspaces.has(membership.workspace_id)) {
      seenWorkspaces.add(membership.workspace_id);
      summary.workspaceCount += 1;
    }

    if (membership.role === "owner") {
      summary.ownedWorkspaceCount += 1;
    }

    seenWorkspacesByUser.set(membership.user_id, seenWorkspaces);
  }

  for (const run of (runsByUserResult.data ?? []) as PlanningRunActivityRow[]) {
    if (run.created_by_user_id) {
      addRunActivity(byUser, seenWorkspacesByUser, seenRunsByUser, run.created_by_user_id, run);
    }
  }

  for (const run of (legacyRunsResult.data ?? []) as PlanningRunActivityRow[]) {
    const matchedUserIds = run.created_by ? userIdsByEmail.get(run.created_by.toLowerCase()) ?? [] : [];

    for (const userId of matchedUserIds) {
      addRunActivity(byUser, seenWorkspacesByUser, seenRunsByUser, userId, run);
    }
  }

  return {
    ok: true,
    byUser
  };
}

function addRunActivity(
  byUser: Map<string, { workspaceCount: number; ownedWorkspaceCount: number; planningRunCount: number; latestPlanningRunAt: string | null }>,
  seenWorkspacesByUser: Map<string, Set<string>>,
  seenRunsByUser: Map<string, Set<string>>,
  userId: string,
  run: PlanningRunActivityRow
) {
  const summary = byUser.get(userId);

  if (!summary) {
    return;
  }

  const seenRuns = seenRunsByUser.get(userId) ?? new Set<string>();

  if (seenRuns.has(run.id)) {
    return;
  }

  seenRuns.add(run.id);
  summary.planningRunCount += 1;

  if (run.workspace_id) {
    const seenWorkspaces = seenWorkspacesByUser.get(userId) ?? new Set<string>();

    if (!seenWorkspaces.has(run.workspace_id)) {
      seenWorkspaces.add(run.workspace_id);
      summary.workspaceCount += 1;
    }

    seenWorkspacesByUser.set(userId, seenWorkspaces);
  }

  if (!summary.latestPlanningRunAt || new Date(run.created_at).getTime() > new Date(summary.latestPlanningRunAt).getTime()) {
    summary.latestPlanningRunAt = run.created_at;
  }

  seenRunsByUser.set(userId, seenRuns);
}

function stringMetadata(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getRoleSource(user: User): "appMetadata" | "adminEmails" | "default" {
  if (user.app_metadata?.role === "admin") {
    return "appMetadata";
  }

  const email = user.email?.toLowerCase();

  if (email && getConfiguredAdminEmails().has(email)) {
    return "adminEmails";
  }

  return "default";
}

function sanitizeAdminError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
    .replace(/apikey[=:]\s*[^,\s}]+/gi, "apikey=[REDACTED]")
    .slice(0, 220);
}
