import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
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
  forecast: Record<string, unknown>;
  assumptions: string[];
  created_by: string | null;
  created_by_user_id: string | null;
  created_at: string;
};

type WorkspaceRow = {
  id: string;
  name: string;
  mode: "agency" | "advertiser";
  owner_user_id: string | null;
};

type PlanningKeywordRow = {
  id: string;
  term: string;
  intent: string;
  ad_group_name: string;
  match_type: string;
  bid: number;
  expected_impressions: number;
  expected_clicks: number;
  expected_cost: number;
  cvr: number;
  confidence: number;
  status: string;
  reason: string;
};

type PlanningAdGroupRow = {
  id: string;
  name: string;
  description: string;
  monthly_budget: number;
  daily_budget: number;
  keyword_count: number;
  expected_clicks: number;
  avg_bid: number;
  sample_ads: unknown;
};

type StagedChangeRow = {
  id: string;
  external_key: string;
  entity_type: string;
  target: string;
  action: string;
  risk: string;
  approval_required: boolean;
  details: string;
  decision: string;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
  decision_source: string | null;
  executed_at: string | null;
  created_at: string;
};

type ExecutionDraftRow = {
  id: string;
  draft_key: string;
  draft_id: string;
  brand_name: string;
  approved_change_count: number;
  status: "blocked" | "ready" | "executed" | "failed";
  validation: {
    canExecuteTest?: boolean;
    blockerCount?: number;
    warningCount?: number;
    blockers?: Array<{ code: string; payloadId?: string; message: string }>;
    warnings?: Array<{ code: string; payloadId?: string; message: string }>;
  } | null;
  blocked: unknown;
  generated_at: string;
  created_at: string;
};

type ExecutionPayloadRow = {
  id: string;
  execution_draft_id: string;
  payload_key: string;
  idempotency_key: string;
  method: "POST" | "PUT";
  uri: string;
  entity_type: string;
  target: string;
  params: unknown;
  body: unknown;
  safety: unknown;
  created_at: string;
};

type ExecutionResultRow = {
  id: string;
  execution_draft_id: string | null;
  idempotency_key: string;
  payload_key: string;
  ok: boolean;
  status: number;
  target: string;
  naver_entity_id: string | null;
  error: string | null;
  response: unknown;
  created_at: string;
};

type RouteContext = {
  params: Promise<{
    planningRunId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const access = await verifyUserAccess(request);

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

  const { planningRunId } = await context.params;

  if (!isUuid(planningRunId)) {
    return jsonNoStore({ ok: false, error: "Invalid planning run id." }, { status: 400 });
  }

  const { data: run, error: runError } = await supabase
    .from("planning_runs")
    .select(
      "id, workspace_id, brand_name, site_url, vertical, monthly_budget, max_bid, mode, product_type, seed_keywords, forecast, assumptions, created_by, created_by_user_id, created_at"
    )
    .eq("id", planningRunId)
    .single();

  if (runError || !run) {
    return jsonNoStore({ ok: false, error: "Planning run was not found." }, { status: 404 });
  }

  const planningRun = run as PlanningRunRow;
  const creators = new Set([access.state.email, access.state.userId].filter(Boolean));
  const ownsRun =
    planningRun.created_by_user_id === access.state.userId ||
    Boolean(planningRun.created_by && creators.has(planningRun.created_by));
  const canReadWorkspace =
    !ownsRun && planningRun.workspace_id
      ? await hasWorkspaceMembership(supabase, planningRun.workspace_id, access.state.userId)
      : false;

  if (access.state.role !== "admin" && !ownsRun && !canReadWorkspace) {
    return jsonNoStore({ ok: false, error: "Planning run was not found." }, { status: 404 });
  }

  let workspace: WorkspaceRow | null = null;

  if (planningRun.workspace_id) {
    const { data: workspaceData, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name, mode, owner_user_id")
      .eq("id", planningRun.workspace_id)
      .maybeSingle();

    if (workspaceError) {
      return jsonNoStore({ ok: false, error: sanitizeError(workspaceError.message) }, { status: 502 });
    }

    workspace = (workspaceData ?? null) as WorkspaceRow | null;
  }

  const [keywordsResult, adGroupsResult, changesResult, draftsResult, auditResult] = await Promise.all([
    supabase
      .from("planning_keywords")
      .select(
        "id, term, intent, ad_group_name, match_type, bid, expected_impressions, expected_clicks, expected_cost, cvr, confidence, status, reason"
      )
      .eq("planning_run_id", planningRun.id)
      .order("expected_clicks", { ascending: false }),
    supabase
      .from("planning_ad_groups")
      .select(
        "id, name, description, monthly_budget, daily_budget, keyword_count, expected_clicks, avg_bid, sample_ads"
      )
      .eq("planning_run_id", planningRun.id)
      .order("expected_clicks", { ascending: false }),
    supabase
      .from("staged_changes")
      .select(
        "id, external_key, entity_type, target, action, risk, approval_required, details, decision, decided_at, decided_by, decision_note, decision_source, executed_at, created_at"
      )
      .eq("planning_run_id", planningRun.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("execution_drafts")
      .select("id, draft_key, draft_id, brand_name, approved_change_count, status, validation, blocked, generated_at, created_at")
      .eq("planning_run_id", planningRun.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("audit_events")
      .select("id, event_type, actor, entity_type, entity_id, before_value, after_value, reason, created_at")
      .eq("planning_run_id", planningRun.id)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  const lookupError =
    keywordsResult.error ?? adGroupsResult.error ?? changesResult.error ?? draftsResult.error ?? auditResult.error;

  if (lookupError) {
    return jsonNoStore({ ok: false, error: sanitizeError(lookupError.message) }, { status: 502 });
  }

  const drafts = (draftsResult.data ?? []) as ExecutionDraftRow[];
  const draftIds = drafts.map((draft) => draft.id);
  const [payloadsResult, resultsResult] =
    draftIds.length > 0
      ? await Promise.all([
          supabase
            .from("execution_payloads")
            .select(
              "id, execution_draft_id, payload_key, idempotency_key, method, uri, entity_type, target, params, body, safety, created_at"
            )
            .in("execution_draft_id", draftIds)
            .order("created_at", { ascending: true }),
          supabase
            .from("execution_results")
            .select(
              "id, execution_draft_id, idempotency_key, payload_key, ok, status, target, naver_entity_id, error, response, created_at"
            )
            .in("execution_draft_id", draftIds)
            .order("created_at", { ascending: false })
        ])
      : [
          { data: [], error: null },
          { data: [], error: null }
        ];

  if (payloadsResult.error || resultsResult.error) {
    return jsonNoStore(
      { ok: false, error: sanitizeError(payloadsResult.error?.message ?? resultsResult.error?.message) },
      { status: 502 }
    );
  }

  const payloads = (payloadsResult.data ?? []) as ExecutionPayloadRow[];
  const results = (resultsResult.data ?? []) as ExecutionResultRow[];
  const resultsByDraftPayloadKey = new Map<string, ExecutionResultRow[]>();

  for (const result of results) {
    if (!result.execution_draft_id) {
      continue;
    }

    const resultKey = createDraftPayloadResultKey(result.execution_draft_id, result.payload_key);
    const current = resultsByDraftPayloadKey.get(resultKey) ?? [];
    current.push(result);
    resultsByDraftPayloadKey.set(resultKey, current);
  }

  const changes = (changesResult.data ?? []) as StagedChangeRow[];

  return jsonNoStore({
    ok: true,
    scope: access.state.role === "admin" ? "all" : "mine",
    run: {
      id: planningRun.id,
      brandName: planningRun.brand_name,
      siteUrl: planningRun.site_url,
      vertical: planningRun.vertical,
      monthlyBudget: planningRun.monthly_budget,
      maxBid: planningRun.max_bid,
      mode: planningRun.mode,
      productType: planningRun.product_type,
      seedKeywords: planningRun.seed_keywords,
      forecast: planningRun.forecast,
      assumptions: planningRun.assumptions,
      createdBy: planningRun.created_by,
      createdByUserId: planningRun.created_by_user_id,
      workspaceId: planningRun.workspace_id,
      workspaceName: workspace?.name ?? null,
      workspaceMode: workspace?.mode ?? null,
      workspaceOwnerUserId: workspace?.owner_user_id ?? null,
      createdAt: planningRun.created_at,
      approvalSummary: summarizeChanges(changes)
    },
    keywords: ((keywordsResult.data ?? []) as PlanningKeywordRow[]).map((keyword) => ({
      id: keyword.id,
      term: keyword.term,
      intent: keyword.intent,
      adGroupName: keyword.ad_group_name,
      matchType: keyword.match_type,
      bid: keyword.bid,
      expectedImpressions: keyword.expected_impressions,
      expectedClicks: keyword.expected_clicks,
      expectedCost: keyword.expected_cost,
      cvr: keyword.cvr,
      confidence: keyword.confidence,
      status: keyword.status,
      reason: keyword.reason
    })),
    adGroups: ((adGroupsResult.data ?? []) as PlanningAdGroupRow[]).map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      monthlyBudget: group.monthly_budget,
      dailyBudget: group.daily_budget,
      keywordCount: group.keyword_count,
      expectedClicks: group.expected_clicks,
      avgBid: group.avg_bid,
      sampleAds: group.sample_ads
    })),
    stagedChanges: changes.map((change) => ({
      id: change.id,
      externalKey: change.external_key,
      entityType: change.entity_type,
      target: change.target,
      action: change.action,
      risk: change.risk,
      approvalRequired: change.approval_required,
      details: change.details,
      decision: change.decision,
      decidedAt: change.decided_at,
      decidedBy: change.decided_by,
      decisionNote: change.decision_note,
      decisionSource: change.decision_source,
      executedAt: change.executed_at,
      createdAt: change.created_at
    })),
    executionDrafts: drafts.map((draft) => ({
      id: draft.id,
      draftKey: draft.draft_key,
      draftId: draft.draft_id,
      brandName: draft.brand_name,
      approvedChangeCount: draft.approved_change_count,
      status: draft.status,
      validation: draft.validation,
      blocked: draft.blocked,
      generatedAt: draft.generated_at,
      createdAt: draft.created_at,
      payloads: payloads
        .filter((payload) => payload.execution_draft_id === draft.id)
        .map((payload) => ({
          id: payload.id,
          payloadKey: payload.payload_key,
          idempotencyKey: payload.idempotency_key,
          method: payload.method,
          uri: payload.uri,
          entityType: payload.entity_type,
          target: payload.target,
          params: payload.params,
          body: payload.body,
          safety: payload.safety,
          createdAt: payload.created_at,
          results: resultsByDraftPayloadKey.get(createDraftPayloadResultKey(draft.id, payload.payload_key))?.map((result) => ({
            id: result.id,
            executionDraftId: result.execution_draft_id,
            ok: result.ok,
            status: result.status,
            target: result.target,
            naverEntityId: result.naver_entity_id,
            error: result.error,
            response: result.response,
            createdAt: result.created_at
          })) ?? []
        }))
    })),
    auditEvents: auditResult.data ?? []
  });
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function hasWorkspaceMembership(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
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

function createDraftPayloadResultKey(executionDraftId: string, payloadKey: string): string {
  return `${executionDraftId}:${payloadKey}`;
}

function sanitizeError(message: string | undefined): string {
  return message?.slice(0, 220) ?? "History detail lookup failed.";
}
