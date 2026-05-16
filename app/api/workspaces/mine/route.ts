import { NextResponse } from "next/server";
import { verifyUserAccess } from "@/lib/auth-access";
import { getSupabaseAdminClient, getSupabaseAdminState } from "@/lib/supabase-admin";

type WorkspaceMemberRow = {
  workspace_id: string;
  email: string | null;
  role: "owner" | "admin" | "member" | "viewer";
  created_at: string;
};

type WorkspaceMembershipSource = "membership" | "history";

type WorkspaceRow = {
  id: string;
  name: string;
  mode: "agency" | "advertiser";
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
};

type PlanningRunWorkspaceRow = {
  workspace_id: string | null;
  created_at: string;
};

export async function GET(request: Request) {
  const access = await verifyUserAccess(request);

  if (!access.ok) {
    return NextResponse.json(access, { status: access.status });
  }

  const state = getSupabaseAdminState();

  if (!state.ready) {
    return NextResponse.json({ ok: false, error: "Supabase admin environment is not configured." }, { status: 503 });
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase admin client is unavailable." }, { status: 503 });
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from("workspace_members")
    .select("workspace_id, email, role, created_at")
    .eq("user_id", access.state.userId)
    .order("created_at", { ascending: false });

  const [legacyRunsByUserResult, legacyRunsByEmailResult] = await Promise.all([
    supabase
      .from("planning_runs")
      .select("workspace_id, created_at")
      .eq("created_by_user_id", access.state.userId),
    access.state.email
      ? supabase.from("planning_runs").select("workspace_id, created_at").eq("created_by", access.state.email)
      : { data: [], error: null }
  ]);

  const lookupError = membershipsError ?? legacyRunsByUserResult.error ?? legacyRunsByEmailResult.error;

  if (lookupError) {
    return NextResponse.json({ ok: false, error: sanitizeError(lookupError.message) }, { status: 502 });
  }

  const memberRows = (memberships ?? []) as WorkspaceMemberRow[];
  const legacyRows = [
    ...((legacyRunsByUserResult.data ?? []) as PlanningRunWorkspaceRow[]),
    ...((legacyRunsByEmailResult.data ?? []) as PlanningRunWorkspaceRow[])
  ];
  const legacyLatestRunByWorkspace = summarizePlanningRuns(legacyRows);
  const workspaceIds = [
    ...new Set([
      ...memberRows.map((membership) => membership.workspace_id).filter(Boolean),
      ...legacyRows.map((run) => run.workspace_id).filter((workspaceId): workspaceId is string => Boolean(workspaceId))
    ])
  ];

  if (workspaceIds.length === 0) {
    return NextResponse.json({
      ok: true,
      workspaces: [],
      total: 0
    });
  }

  const [workspacesResult, planningRunsResult] = await Promise.all([
    supabase
      .from("workspaces")
      .select("id, name, mode, owner_user_id, created_at, updated_at")
      .in("id", workspaceIds),
    supabase.from("planning_runs").select("workspace_id, created_at").in("workspace_id", workspaceIds)
  ]);

  if (workspacesResult.error || planningRunsResult.error) {
    return NextResponse.json(
      { ok: false, error: sanitizeError(workspacesResult.error?.message ?? planningRunsResult.error?.message) },
      { status: 502 }
    );
  }

  const workspacesById = new Map(
    ((workspacesResult.data ?? []) as WorkspaceRow[]).map((workspace) => [workspace.id, workspace])
  );
  const runSummaryByWorkspace = summarizePlanningRuns((planningRunsResult.data ?? []) as PlanningRunWorkspaceRow[]);
  const membershipByWorkspace = new Map(memberRows.map((membership) => [membership.workspace_id, membership]));

  const response = workspaceIds
    .map((workspaceId) => {
      const workspace = workspacesById.get(workspaceId);

      if (!workspace) {
        return null;
      }

      const membership = membershipByWorkspace.get(workspaceId);
      const legacySummary = legacyLatestRunByWorkspace.get(workspaceId);
      const runSummary = runSummaryByWorkspace.get(workspace.id) ?? {
        planningRunCount: 0,
        latestRunAt: null
      };
      const membershipSource: WorkspaceMembershipSource = membership ? "membership" : "history";

      return {
        id: workspace.id,
        name: workspace.name,
        mode: workspace.mode,
        ownerUserId: workspace.owner_user_id,
        role: membership?.role ?? "owner",
        memberEmail: membership?.email ?? access.state.email,
        memberCreatedAt: membership?.created_at ?? legacySummary?.latestRunAt ?? workspace.created_at,
        membershipSource,
        createdAt: workspace.created_at,
        updatedAt: workspace.updated_at,
        planningRunCount: runSummary.planningRunCount,
        latestRunAt: runSummary.latestRunAt
      };
    })
    .filter((workspace): workspace is NonNullable<typeof workspace> => Boolean(workspace))
    .sort((a, b) => {
      const aDate = new Date(a.latestRunAt ?? a.updatedAt ?? a.createdAt).getTime();
      const bDate = new Date(b.latestRunAt ?? b.updatedAt ?? b.createdAt).getTime();

      return bDate - aDate;
    });

  return NextResponse.json({
    ok: true,
    workspaces: response,
    total: response.length
  });
}

function summarizePlanningRuns(rows: PlanningRunWorkspaceRow[]) {
  const summary = new Map<string, { planningRunCount: number; latestRunAt: string | null }>();

  for (const run of rows) {
    if (!run.workspace_id) {
      continue;
    }

    const current = summary.get(run.workspace_id) ?? {
      planningRunCount: 0,
      latestRunAt: null
    };
    const isLatest = !current.latestRunAt || new Date(run.created_at).getTime() > new Date(current.latestRunAt).getTime();

    summary.set(run.workspace_id, {
      planningRunCount: current.planningRunCount + 1,
      latestRunAt: isLatest ? run.created_at : current.latestRunAt
    });
  }

  return summary;
}

function sanitizeError(message: string | undefined): string {
  return message?.slice(0, 220) ?? "Workspace lookup failed.";
}
