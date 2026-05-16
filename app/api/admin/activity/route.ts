import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import { getSupabaseAdminClient, getSupabaseAdminState } from "@/lib/supabase-admin";

export function POST() {
  return methodNotAllowed(["GET"]);
}

type PlanningRunActivityRow = {
  id: string;
  workspace_id: string | null;
  brand_name: string;
  site_url: string;
  vertical: string;
  mode: "agency" | "advertiser";
  product_type: "powerlink" | "shoppingSearch";
  created_by: string | null;
  created_by_user_id: string | null;
  created_at: string;
};

type ExecutionDraftActivityRow = {
  id: string;
  planning_run_id: string;
  status: "blocked" | "ready" | "executed" | "failed";
  approved_change_count: number;
  validation: {
    blockerCount?: number;
    warningCount?: number;
  } | null;
  created_at: string;
};

type StagedChangeActivityRow = {
  planning_run_id: string;
  decision: string;
  risk: string;
};

type WorkspaceActivityRow = {
  id: string;
  name: string;
  mode: "agency" | "advertiser";
};

export async function GET(request: Request) {
  const access = await verifyUserAccess(request, { requireAdmin: true });

  if (!access.ok) {
    return jsonNoStore(access, { status: access.status });
  }

  const state = getSupabaseAdminState();

  if (!state.ready) {
    return jsonNoStore({ ok: false, error: "Supabase admin environment is not configured." }, { status: 503 });
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return jsonNoStore({ ok: false, error: "Supabase admin client is unavailable." }, { status: 503 });
  }

  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get("limit"));
  const { data: runs, error: runsError } = await supabase
    .from("planning_runs")
    .select(
      "id, workspace_id, brand_name, site_url, vertical, mode, product_type, created_by, created_by_user_id, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (runsError) {
    return jsonNoStore({ ok: false, error: sanitizeError(runsError.message) }, { status: 502 });
  }

  const planningRuns = (runs ?? []) as PlanningRunActivityRow[];
  const runIds = planningRuns.map((run) => run.id);
  const workspaceIds = [
    ...new Set(planningRuns.map((run) => run.workspace_id).filter((workspaceId): workspaceId is string => Boolean(workspaceId)))
  ];

  if (runIds.length === 0) {
    return jsonNoStore({
      ok: true,
      activities: [],
      summary: {
        total: 0,
        approved: 0,
        held: 0,
        blocked: 0,
        readyDrafts: 0
      }
    });
  }

  const [draftsResult, changesResult, workspacesResult] = await Promise.all([
    supabase
      .from("execution_drafts")
      .select("id, planning_run_id, status, approved_change_count, validation, created_at")
      .in("planning_run_id", runIds)
      .order("created_at", { ascending: false }),
    supabase.from("staged_changes").select("planning_run_id, decision, risk").in("planning_run_id", runIds),
    workspaceIds.length > 0
      ? supabase.from("workspaces").select("id, name, mode").in("id", workspaceIds)
      : { data: [], error: null }
  ]);

  const lookupError = draftsResult.error ?? changesResult.error ?? workspacesResult.error;

  if (lookupError) {
    return jsonNoStore({ ok: false, error: sanitizeError(lookupError.message) }, { status: 502 });
  }

  const latestDraftByRun = new Map<string, ExecutionDraftActivityRow>();
  const workspacesById = new Map(
    ((workspacesResult.data ?? []) as WorkspaceActivityRow[]).map((workspace) => [workspace.id, workspace])
  );

  for (const draft of (draftsResult.data ?? []) as ExecutionDraftActivityRow[]) {
    if (!latestDraftByRun.has(draft.planning_run_id)) {
      latestDraftByRun.set(draft.planning_run_id, draft);
    }
  }

  const approvalSummaryByRun = summarizeStagedChanges((changesResult.data ?? []) as StagedChangeActivityRow[]);
  const activities = planningRuns.map((run) => {
    const draft = latestDraftByRun.get(run.id);
    const workspace = run.workspace_id ? workspacesById.get(run.workspace_id) : null;
    const approvalSummary = approvalSummaryByRun.get(run.id) ?? {
      approved: 0,
      held: 0,
      pending: 0,
      blocked: 0
    };

    return {
      id: run.id,
      workspaceId: run.workspace_id,
      workspaceName: workspace?.name ?? null,
      brandName: run.brand_name,
      siteUrl: run.site_url,
      vertical: run.vertical,
      mode: run.mode,
      productType: run.product_type,
      createdBy: run.created_by,
      createdByUserId: run.created_by_user_id,
      createdAt: run.created_at,
      approvalSummary,
      executionDraft: draft
        ? {
            id: draft.id,
            status: draft.status,
            approvedChangeCount: draft.approved_change_count,
            blockerCount: draft.validation?.blockerCount ?? 0,
            warningCount: draft.validation?.warningCount ?? 0,
            createdAt: draft.created_at
          }
        : null
    };
  });

  return jsonNoStore({
    ok: true,
    activities,
    summary: summarizeActivities(activities)
  });
}

function summarizeStagedChanges(changes: StagedChangeActivityRow[]) {
  const summaryByRun = new Map<string, { approved: number; held: number; pending: number; blocked: number }>();

  for (const change of changes) {
    const summary = summaryByRun.get(change.planning_run_id) ?? {
      approved: 0,
      held: 0,
      pending: 0,
      blocked: 0
    };

    if (change.decision === "approved") {
      summary.approved += 1;
    } else if (change.decision === "held") {
      summary.held += 1;
    } else {
      summary.pending += 1;
    }

    if (change.risk === "blocked") {
      summary.blocked += 1;
    }

    summaryByRun.set(change.planning_run_id, summary);
  }

  return summaryByRun;
}

function summarizeActivities(
  activities: Array<{
    approvalSummary: { approved: number; held: number; pending: number; blocked: number };
    executionDraft: { status: "blocked" | "ready" | "executed" | "failed" } | null;
  }>
) {
  return activities.reduce(
    (summary, activity) => ({
      total: summary.total + 1,
      approved: summary.approved + activity.approvalSummary.approved,
      held: summary.held + activity.approvalSummary.held,
      blocked: summary.blocked + activity.approvalSummary.blocked,
      readyDrafts: summary.readyDrafts + (activity.executionDraft?.status === "ready" ? 1 : 0)
    }),
    {
      total: 0,
      approved: 0,
      held: 0,
      blocked: 0,
      readyDrafts: 0
    }
  );
}

function clampLimit(value: string | null): number {
  const parsed = Number(value ?? 8);

  if (!Number.isFinite(parsed)) {
    return 8;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 20);
}

function sanitizeError(message: string | undefined): string {
  return message?.slice(0, 220) ?? "Admin activity lookup failed.";
}
