import { verifyUserAccess, type AuthAccessState } from "@/lib/auth-access";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import {
  coerceReportShareExpiryDays,
  createReportShareToken,
  getReportShareExpiryDate,
  hashReportShareToken,
  isMissingReportShareTableError,
  isReportShareExpired,
  reportShareLinksTable,
  sanitizeShareError
} from "@/lib/report-share";
import { getSupabaseAdminClient, getSupabaseAdminState } from "@/lib/supabase-admin";

export function PUT() {
  return methodNotAllowed(["GET", "POST", "PATCH"]);
}

export function DELETE() {
  return methodNotAllowed(["GET", "POST", "PATCH"]);
}

type RouteContext = {
  params: Promise<{
    planningRunId: string;
  }>;
};

type PlanningRunAccessRow = {
  id: string;
  workspace_id: string | null;
  brand_name: string;
  created_by: string | null;
  created_by_user_id: string | null;
};

type ReportShareLinkRow = {
  id: string;
  planning_run_id: string;
  created_by_email: string | null;
  status: "active" | "revoked";
  expires_at: string;
  last_accessed_at: string | null;
  access_count: number;
  created_at: string;
  updated_at: string;
};

type SupabaseAdminClient = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;

export async function GET(request: Request, context: RouteContext) {
  const setup = await prepareShareLinkRequest(request, context);

  if (!setup.ok) {
    return setup.response;
  }

  const { data, error } = await setup.supabase
    .from(reportShareLinksTable)
    .select(
      "id, planning_run_id, created_by_email, status, expires_at, last_accessed_at, access_count, created_at, updated_at"
    )
    .eq("planning_run_id", setup.planningRun.id)
    .order("created_at", { ascending: false });

  if (isMissingReportShareTableError(error)) {
    return jsonNoStore(getMigrationRequiredResponse(), { status: 503 });
  }

  if (error) {
    return jsonNoStore({ ok: false, error: sanitizeShareError(error.message) }, { status: 502 });
  }

  return jsonNoStore({
    ok: true,
    installed: true,
    planningRunId: setup.planningRun.id,
    links: ((data ?? []) as ReportShareLinkRow[]).map(toSafeShareLink)
  });
}

export async function POST(request: Request, context: RouteContext) {
  const setup = await prepareShareLinkRequest(request, context);

  if (!setup.ok) {
    return setup.response;
  }

  const body = await readJsonBody(request);
  const expiresInDays = coerceReportShareExpiryDays(body.expiresInDays);
  const expiresAt = getReportShareExpiryDate(expiresInDays).toISOString();
  const token = createReportShareToken();
  const tokenHash = hashReportShareToken(token);

  const { data, error } = await setup.supabase
    .from(reportShareLinksTable)
    .insert({
      planning_run_id: setup.planningRun.id,
      created_by_user_id: setup.access.userId,
      created_by_email: setup.access.email,
      token_hash: tokenHash,
      expires_at: expiresAt
    })
    .select(
      "id, planning_run_id, created_by_email, status, expires_at, last_accessed_at, access_count, created_at, updated_at"
    )
    .single();

  if (isMissingReportShareTableError(error)) {
    return jsonNoStore(getMigrationRequiredResponse(), { status: 503 });
  }

  if (error || !data) {
    return jsonNoStore({ ok: false, error: sanitizeShareError(error?.message) }, { status: 502 });
  }

  return jsonNoStore(
    {
      ok: true,
      installed: true,
      planningRunId: setup.planningRun.id,
      shareUrl: new URL(`/share/reports/${token}`, request.url).toString(),
      expiresInDays,
      link: toSafeShareLink(data as ReportShareLinkRow)
    },
    { status: 201 }
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const setup = await prepareShareLinkRequest(request, context);

  if (!setup.ok) {
    return setup.response;
  }

  const body = await readJsonBody(request);
  const shareId = typeof body.shareId === "string" ? body.shareId : "";

  if (!isUuid(shareId)) {
    return jsonNoStore({ ok: false, error: "Invalid share link id." }, { status: 400 });
  }

  const { data, error } = await setup.supabase
    .from(reportShareLinksTable)
    .update({
      status: "revoked",
      updated_at: new Date().toISOString()
    })
    .eq("id", shareId)
    .eq("planning_run_id", setup.planningRun.id)
    .select(
      "id, planning_run_id, created_by_email, status, expires_at, last_accessed_at, access_count, created_at, updated_at"
    )
    .maybeSingle();

  if (isMissingReportShareTableError(error)) {
    return jsonNoStore(getMigrationRequiredResponse(), { status: 503 });
  }

  if (error) {
    return jsonNoStore({ ok: false, error: sanitizeShareError(error.message) }, { status: 502 });
  }

  if (!data) {
    return jsonNoStore({ ok: false, error: "Share link was not found." }, { status: 404 });
  }

  return jsonNoStore({
    ok: true,
    installed: true,
    planningRunId: setup.planningRun.id,
    link: toSafeShareLink(data as ReportShareLinkRow)
  });
}

async function prepareShareLinkRequest(request: Request, context: RouteContext) {
  const access = await verifyUserAccess(request);

  if (!access.ok) {
    return {
      ok: false as const,
      response: jsonNoStore(access, { status: access.status })
    };
  }

  const state = getSupabaseAdminState();

  if (!state.ready) {
    return {
      ok: false as const,
      response: jsonNoStore({ ok: false, error: "Supabase admin environment is not configured." }, { status: 503 })
    };
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      ok: false as const,
      response: jsonNoStore({ ok: false, error: "Supabase admin client is unavailable." }, { status: 503 })
    };
  }

  const { planningRunId } = await context.params;

  if (!isUuid(planningRunId)) {
    return {
      ok: false as const,
      response: jsonNoStore({ ok: false, error: "Invalid planning run id." }, { status: 400 })
    };
  }

  const planningRun = await readPlanningRunForAccess(supabase, planningRunId, access.state);

  if (!planningRun) {
    return {
      ok: false as const,
      response: jsonNoStore({ ok: false, error: "Planning run was not found." }, { status: 404 })
    };
  }

  return {
    ok: true as const,
    access: access.state,
    planningRun,
    supabase
  };
}

async function readPlanningRunForAccess(
  supabase: SupabaseAdminClient,
  planningRunId: string,
  access: AuthAccessState
): Promise<PlanningRunAccessRow | null> {
  const { data, error } = await supabase
    .from("planning_runs")
    .select("id, workspace_id, brand_name, created_by, created_by_user_id")
    .eq("id", planningRunId)
    .single();

  if (error || !data) {
    return null;
  }

  const planningRun = data as PlanningRunAccessRow;
  const createdByEmailMatches =
    Boolean(planningRun.created_by && access.email) &&
    planningRun.created_by?.toLowerCase() === access.email?.toLowerCase();
  const ownsRun = planningRun.created_by_user_id === access.userId || createdByEmailMatches;
  const canReadWorkspace =
    !ownsRun && planningRun.workspace_id
      ? await hasWorkspaceMembership(supabase, planningRun.workspace_id, access.userId)
      : false;

  if (access.role !== "admin" && !ownsRun && !canReadWorkspace) {
    return null;
  }

  return planningRun;
}

async function hasWorkspaceMembership(
  supabase: SupabaseAdminClient,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(data);
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toSafeShareLink(link: ReportShareLinkRow) {
  return {
    id: link.id,
    status: link.status,
    createdByEmail: link.created_by_email,
    expiresAt: link.expires_at,
    lastAccessedAt: link.last_accessed_at,
    accessCount: link.access_count,
    createdAt: link.created_at,
    updatedAt: link.updated_at,
    isExpired: isReportShareExpired(link.expires_at)
  };
}

function getMigrationRequiredResponse() {
  return {
    ok: false,
    installed: false,
    error: "Report share links table is not installed yet.",
    migration: "supabase/migrations/20260517161000_create_report_share_links.sql"
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
