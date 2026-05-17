import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import {
  hashReportShareToken,
  isMissingReportShareTableError,
  isReportShareExpired,
  isValidReportShareToken,
  reportShareLinksTable,
  sanitizeShareError
} from "@/lib/report-share";
import { getSupabaseAdminClient, getSupabaseAdminState } from "@/lib/supabase-admin";

export function POST() {
  return methodNotAllowed(["GET"]);
}

export function PUT() {
  return methodNotAllowed(["GET"]);
}

export function PATCH() {
  return methodNotAllowed(["GET"]);
}

export function DELETE() {
  return methodNotAllowed(["GET"]);
}

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

type ReportShareLinkRow = {
  id: string;
  planning_run_id: string;
  status: "active" | "revoked";
  expires_at: string;
  access_count: number;
  created_at: string;
};

type PlanningRunRow = {
  id: string;
  workspace_id: string | null;
  brand_name: string;
  site_url: string;
  vertical: string;
  monthly_budget: number;
  max_bid: number;
  mode: "agency" | "advertiser";
  product_type: "powerlink" | "shoppingSearch";
  seed_keywords: string[];
  created_at: string;
};

type WorkspaceRow = {
  name: string;
  mode: "agency" | "advertiser";
};

type PlanningKeywordRow = {
  term: string;
  intent: string;
  ad_group_name: string;
  bid: number;
  expected_clicks: number;
  expected_cost: number;
  status: string;
  reason: string;
};

type PlanningAdGroupRow = {
  name: string;
  description: string;
  daily_budget: number;
  keyword_count: number;
  expected_clicks: number;
  avg_bid: number;
};

type StagedChangeRow = {
  entity_type: string;
  target: string;
  action: string;
  risk: string;
  details: string;
  decision: string;
  decision_note: string | null;
  created_at: string;
};

type ExecutionDraftRow = {
  id: string;
  approved_change_count: number;
  status: "blocked" | "ready" | "executed" | "failed";
  validation: {
    canExecuteTest?: boolean;
    blockerCount?: number;
    warningCount?: number;
    blockers?: Array<{ code: string; payloadId?: string; message: string }>;
    warnings?: Array<{ code: string; payloadId?: string; message: string }>;
  } | null;
  generated_at: string;
  created_at: string;
};

export async function GET(_request: Request, context: RouteContext) {
  const state = getSupabaseAdminState();

  if (!state.ready) {
    return jsonNoStore({ ok: false, error: "Supabase admin environment is not configured." }, { status: 503 });
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return jsonNoStore({ ok: false, error: "Supabase admin client is unavailable." }, { status: 503 });
  }

  const { token } = await context.params;

  if (!isValidReportShareToken(token)) {
    return jsonNoStore({ ok: false, error: "Shared report was not found." }, { status: 404 });
  }

  const { data: shareData, error: shareError } = await supabase
    .from(reportShareLinksTable)
    .select("id, planning_run_id, status, expires_at, access_count, created_at")
    .eq("token_hash", hashReportShareToken(token))
    .maybeSingle();

  if (isMissingReportShareTableError(shareError)) {
    return jsonNoStore(
      {
        ok: false,
        installed: false,
        error: "Report share links table is not installed yet."
      },
      { status: 503 }
    );
  }

  if (shareError) {
    return jsonNoStore({ ok: false, error: sanitizeShareError(shareError.message) }, { status: 502 });
  }

  const share = shareData as ReportShareLinkRow | null;

  if (!share || share.status !== "active") {
    return jsonNoStore({ ok: false, error: "Shared report was not found." }, { status: 404 });
  }

  if (isReportShareExpired(share.expires_at)) {
    await supabase
      .from(reportShareLinksTable)
      .update({
        status: "revoked",
        updated_at: new Date().toISOString()
      })
      .eq("id", share.id);

    return jsonNoStore({ ok: false, error: "Shared report link has expired." }, { status: 410 });
  }

  const { data: runData, error: runError } = await supabase
    .from("planning_runs")
    .select(
      "id, workspace_id, brand_name, site_url, vertical, monthly_budget, max_bid, mode, product_type, seed_keywords, created_at"
    )
    .eq("id", share.planning_run_id)
    .single();

  if (runError || !runData) {
    return jsonNoStore({ ok: false, error: "Shared report was not found." }, { status: 404 });
  }

  const run = runData as PlanningRunRow;
  let workspace: WorkspaceRow | null = null;

  if (run.workspace_id) {
    const { data: workspaceData } = await supabase
      .from("workspaces")
      .select("name, mode")
      .eq("id", run.workspace_id)
      .maybeSingle();

    workspace = (workspaceData ?? null) as WorkspaceRow | null;
  }

  const [keywordsResult, adGroupsResult, changesResult, draftResult] = await Promise.all([
    supabase
      .from("planning_keywords")
      .select("term, intent, ad_group_name, bid, expected_clicks, expected_cost, status, reason")
      .eq("planning_run_id", run.id)
      .order("expected_clicks", { ascending: false })
      .limit(12),
    supabase
      .from("planning_ad_groups")
      .select("name, description, daily_budget, keyword_count, expected_clicks, avg_bid")
      .eq("planning_run_id", run.id)
      .order("expected_clicks", { ascending: false })
      .limit(8),
    supabase
      .from("staged_changes")
      .select("entity_type, target, action, risk, details, decision, decision_note, created_at")
      .eq("planning_run_id", run.id)
      .order("created_at", { ascending: true })
      .limit(30),
    supabase
      .from("execution_drafts")
      .select("id, approved_change_count, status, validation, generated_at, created_at")
      .eq("planning_run_id", run.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const lookupError = keywordsResult.error ?? adGroupsResult.error ?? changesResult.error ?? draftResult.error;

  if (lookupError) {
    return jsonNoStore({ ok: false, error: sanitizeShareError(lookupError.message) }, { status: 502 });
  }

  const draft = (draftResult.data ?? null) as ExecutionDraftRow | null;
  const payloadCount = draft ? await getExecutionPayloadCount(supabase, draft.id) : 0;
  const now = new Date().toISOString();

  await supabase
    .from(reportShareLinksTable)
    .update({
      access_count: share.access_count + 1,
      last_accessed_at: now,
      updated_at: now
    })
    .eq("id", share.id);

  const changes = (changesResult.data ?? []) as StagedChangeRow[];

  return jsonNoStore({
    ok: true,
    publicReport: true,
    rawPayloadExcluded: true,
    auditExcluded: true,
    link: {
      expiresAt: share.expires_at,
      createdAt: share.created_at,
      accessCount: share.access_count + 1
    },
    run: {
      brandName: run.brand_name,
      siteUrl: run.site_url,
      vertical: run.vertical,
      monthlyBudget: run.monthly_budget,
      maxBid: run.max_bid,
      mode: run.mode,
      productType: run.product_type,
      seedKeywords: run.seed_keywords,
      createdAt: run.created_at,
      workspaceName: workspace?.name ?? null,
      workspaceMode: workspace?.mode ?? null
    },
    approvalSummary: summarizeChanges(changes),
    keywords: ((keywordsResult.data ?? []) as PlanningKeywordRow[]).map((keyword) => ({
      term: keyword.term,
      intent: keyword.intent,
      adGroupName: keyword.ad_group_name,
      bid: keyword.bid,
      expectedClicks: keyword.expected_clicks,
      expectedCost: keyword.expected_cost,
      status: keyword.status,
      reason: keyword.reason
    })),
    adGroups: ((adGroupsResult.data ?? []) as PlanningAdGroupRow[]).map((group) => ({
      name: group.name,
      description: group.description,
      dailyBudget: group.daily_budget,
      keywordCount: group.keyword_count,
      expectedClicks: group.expected_clicks,
      avgBid: group.avg_bid
    })),
    stagedChanges: changes.map((change) => ({
      entityType: change.entity_type,
      target: change.target,
      action: change.action,
      risk: change.risk,
      details: change.details,
      decision: change.decision,
      decisionNote: change.decision_note,
      createdAt: change.created_at
    })),
    executionDraft: draft
      ? {
          status: draft.status,
          approvedChangeCount: draft.approved_change_count,
          payloadCount,
          validation: draft.validation,
          generatedAt: draft.generated_at,
          createdAt: draft.created_at
        }
      : null,
    safety: {
      liveBlocked: true,
      deleteBlocked: true,
      rawPayloadExcluded: true,
      idempotencyKeysExcluded: true,
      auditExcluded: true
    }
  });
}

async function getExecutionPayloadCount(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  executionDraftId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("execution_payloads")
    .select("id", {
      count: "exact",
      head: true
    })
    .eq("execution_draft_id", executionDraftId);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

function summarizeChanges(changes: StagedChangeRow[]) {
  return changes.reduce(
    (summary, change) => {
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

      return summary;
    },
    { approved: 0, held: 0, pending: 0, blocked: 0 }
  );
}
