import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import { coerceShoppingLinkageStatusFilter, coerceShoppingLinkageSummary } from "@/lib/shopping-linkage";
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
  forecast: {
    expectedClicks?: number;
    avgCpc?: number;
    adGroupCount?: number;
  } | null;
  shopping_linkage?: Record<string, unknown> | null;
  created_by: string | null;
  created_by_user_id: string | null;
  created_at: string;
};

type WorkspaceRow = {
  id: string;
  name: string;
};

type ExecutionDraftRow = {
  id: string;
  planning_run_id: string;
  draft_id: string;
  draft_key: string;
  approved_change_count: number;
  status: "blocked" | "ready" | "executed" | "failed";
  validation: {
    blockerCount?: number;
    warningCount?: number;
  } | null;
  created_at: string;
};

type StagedChangeRow = {
  planning_run_id: string;
  decision: string;
  risk: string;
};

export async function GET(request: Request) {
  const access = await verifyUserAccess(request);

  if (!access.ok) {
    return jsonNoStore(access, { status: access.status });
  }

  const state = getSupabaseAdminState();

  if (!state.ready) {
    return jsonNoStore(
      {
        ok: false,
        error: "Supabase admin environment is not configured."
      },
      { status: 503 }
    );
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return jsonNoStore({ ok: false, error: "Supabase admin client is unavailable." }, { status: 503 });
  }

  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get("limit"));
  const offset = clampOffset(url.searchParams.get("offset"));
  const productType = coerceProductType(url.searchParams.get("productType"));
  const dayWindow = coerceDayWindow(url.searchParams.get("days"));
  const createdSince = dayWindow ? new Date(Date.now() - dayWindow * 24 * 60 * 60 * 1000).toISOString() : null;
  const searchQuery = coerceSearchQuery(url.searchParams.get("q"));
  const linkageFilter = coerceShoppingLinkageStatusFilter(url.searchParams.get("linkage"));
  const readableWorkspaceIds =
    access.state.role === "admin" ? [] : await getReadableWorkspaceIds(supabase, access.state.userId);
  const shoppingLinkageSupport = await hasShoppingLinkageSupport(supabase);
  const planningRunSelect = [
    "id",
    "workspace_id",
    "brand_name",
    "site_url",
    "vertical",
    "monthly_budget",
    "max_bid",
    "mode",
    "product_type",
    "forecast",
    ...(shoppingLinkageSupport ? ["shopping_linkage"] : []),
    "created_by",
    "created_by_user_id",
    "created_at"
  ].join(", ");
  let runsQuery = supabase
    .from("planning_runs")
    .select(planningRunSelect, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (productType) {
    runsQuery = runsQuery.eq("product_type", productType);
  }

  if (createdSince) {
    runsQuery = runsQuery.gte("created_at", createdSince);
  }

  if (searchQuery) {
    const pattern = `%${searchQuery}%`;
    runsQuery = runsQuery.or(
      [
        `brand_name.ilike.${pattern}`,
        `site_url.ilike.${pattern}`,
        `vertical.ilike.${pattern}`,
        `created_by.ilike.${pattern}`
      ].join(",")
    );
  }

  if (access.state.role !== "admin") {
    const creators = [access.state.email, access.state.userId].filter((value): value is string => Boolean(value));
    const ownershipFilters = [
      `created_by_user_id.eq.${access.state.userId}`,
      ...creators.map((creator) => `created_by.eq.${creator}`)
    ];

    if (readableWorkspaceIds.length > 0) {
      ownershipFilters.push(`workspace_id.in.(${readableWorkspaceIds.join(",")})`);
    }

    runsQuery = runsQuery.or(ownershipFilters.join(","));
  }

  const { data: runs, error: runsError, count } = await runsQuery;

  if (runsError) {
    return jsonNoStore({ ok: false, error: sanitizeError(runsError.message) }, { status: 502 });
  }

  const planningRuns = ((runs ?? []) as unknown) as PlanningRunRow[];
  const runIds = planningRuns.map((run) => run.id);
  const workspaceIds = [
    ...new Set(planningRuns.map((run) => run.workspace_id).filter((workspaceId): workspaceId is string => Boolean(workspaceId)))
  ];

  if (runIds.length === 0) {
    return jsonNoStore({
      ok: true,
      runs: [],
      total: count ?? 0,
      offset,
      limit,
      nextOffset: null,
      scope: access.state.role === "admin" ? "all" : "mine",
      filters: {
        productType: productType ?? "all",
        days: dayWindow,
        q: searchQuery,
        linkage: linkageFilter ?? "all"
      }
    });
  }

  const [draftsResult, changesResult, workspacesResult] = await Promise.all([
    supabase
      .from("execution_drafts")
      .select("id, planning_run_id, draft_id, draft_key, approved_change_count, status, validation, created_at")
      .in("planning_run_id", runIds)
      .order("created_at", { ascending: false }),
    supabase.from("staged_changes").select("planning_run_id, decision, risk").in("planning_run_id", runIds),
    workspaceIds.length > 0
      ? supabase.from("workspaces").select("id, name").in("id", workspaceIds)
      : { data: [], error: null }
  ]);

  if (draftsResult.error || changesResult.error || workspacesResult.error) {
    return jsonNoStore(
      {
        ok: false,
        error: sanitizeError(draftsResult.error?.message ?? changesResult.error?.message ?? workspacesResult.error?.message)
      },
      { status: 502 }
    );
  }

  const latestDraftByRun = new Map<string, ExecutionDraftRow>();
  const workspaceById = new Map(((workspacesResult.data ?? []) as WorkspaceRow[]).map((workspace) => [workspace.id, workspace]));

  for (const draft of (draftsResult.data ?? []) as ExecutionDraftRow[]) {
    if (!latestDraftByRun.has(draft.planning_run_id)) {
      latestDraftByRun.set(draft.planning_run_id, draft);
    }
  }

  const approvalSummaryByRun = new Map<string, { approved: number; held: number; pending: number; blocked: number }>();

  for (const change of (changesResult.data ?? []) as StagedChangeRow[]) {
    const summary = approvalSummaryByRun.get(change.planning_run_id) ?? {
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

    approvalSummaryByRun.set(change.planning_run_id, summary);
  }

  const history = planningRuns.map((run) => {
    const draft = latestDraftByRun.get(run.id);
    const workspace = run.workspace_id ? workspaceById.get(run.workspace_id) : null;

    return {
      id: run.id,
      brandName: run.brand_name,
      siteUrl: run.site_url,
      vertical: run.vertical,
      mode: run.mode,
      productType: run.product_type,
      monthlyBudget: run.monthly_budget,
      maxBid: run.max_bid,
      expectedClicks: run.forecast?.expectedClicks ?? null,
      avgCpc: run.forecast?.avgCpc ?? null,
      adGroupCount: run.forecast?.adGroupCount ?? null,
      shoppingLinkage: coerceShoppingLinkageSummary(run.shopping_linkage ?? null, run.product_type),
      createdBy: run.created_by,
      createdByUserId: run.created_by_user_id,
      workspaceId: run.workspace_id,
      workspaceName: workspace?.name ?? null,
      createdAt: run.created_at,
      approvalSummary: approvalSummaryByRun.get(run.id) ?? {
        approved: 0,
        held: 0,
        pending: 0,
        blocked: 0
      },
      executionDraft: draft
        ? {
            id: draft.id,
            draftId: draft.draft_id,
            draftKey: draft.draft_key,
            status: draft.status,
            approvedChangeCount: draft.approved_change_count,
            blockerCount: draft.validation?.blockerCount ?? 0,
            warningCount: draft.validation?.warningCount ?? 0,
            createdAt: draft.created_at
          }
        : null
    };
  });
  const filteredHistory = linkageFilter
    ? history.filter((run) => run.shoppingLinkage.status === linkageFilter)
    : history;

  const nextOffset =
    count !== null && count !== undefined
      ? offset + history.length < count
        ? offset + history.length
        : null
      : history.length === limit
        ? offset + history.length
        : null;

  return jsonNoStore({
    ok: true,
    runs: filteredHistory,
    total: linkageFilter ? offset + filteredHistory.length : count ?? offset + history.length,
    offset,
    limit,
    nextOffset,
    scope: access.state.role === "admin" ? "all" : "mine",
    filters: {
      productType: productType ?? "all",
      days: dayWindow,
      q: searchQuery,
      linkage: linkageFilter ?? "all"
    }
  });
}

function clampLimit(value: string | null): number {
  const parsed = Number(value ?? 8);

  if (!Number.isFinite(parsed)) {
    return 8;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 25);
}

function clampOffset(value: string | null): number {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(Math.max(Math.trunc(parsed), 0), 1000);
}

function coerceProductType(value: string | null): "powerlink" | "shoppingSearch" | null {
  return value === "powerlink" || value === "shoppingSearch" ? value : null;
}

function coerceDayWindow(value: string | null): 7 | 30 | null {
  const parsed = Number(value);

  if (parsed !== 7 && parsed !== 30) {
    return null;
  }

  return parsed;
}

function coerceSearchQuery(value: string | null): string | null {
  const sanitized = value
    ?.replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  return sanitized || null;
}

async function getReadableWorkspaceIds(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId);

  if (error) {
    return [];
  }

  return [...new Set((data ?? []).map((membership) => membership.workspace_id).filter(Boolean))];
}

async function hasShoppingLinkageSupport(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>
): Promise<boolean> {
  const { error } = await supabase.from("planning_runs").select("id,shopping_linkage", {
    head: true
  });

  return !error;
}

function sanitizeError(message: string | undefined): string {
  return message?.slice(0, 220) ?? "History lookup failed.";
}
