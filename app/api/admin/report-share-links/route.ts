import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import {
  isMissingReportShareTableError,
  isReportShareExpired,
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

type PlanningRunSummaryRow = {
  id: string;
  brand_name: string;
  site_url: string;
  product_type: "powerlink" | "shoppingSearch";
  created_by: string | null;
  created_at: string;
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
  const now = new Date().toISOString();
  const { data, error, count } = await supabase
    .from(reportShareLinksTable)
    .select("id, planning_run_id, created_by_email, status, expires_at, last_accessed_at, access_count, created_at, updated_at", {
      count: "exact"
    })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (isMissingReportShareTableError(error)) {
    return jsonNoStore(
      {
        ok: false,
        installed: false,
        error: "Report share links table is not installed yet.",
        migration: "supabase/migrations/20260517161000_create_report_share_links.sql"
      },
      { status: 503 }
    );
  }

  if (error) {
    return jsonNoStore({ ok: false, error: sanitizeShareError(error.message) }, { status: 502 });
  }

  const links = (data ?? []) as ReportShareLinkRow[];
  const planningRunsById = await loadPlanningRunSummaries(
    supabase,
    [...new Set(links.map((link) => link.planning_run_id))]
  );

  if (!planningRunsById.ok) {
    return jsonNoStore({ ok: false, error: planningRunsById.error }, { status: planningRunsById.status });
  }

  const summary = await loadShareSummary(supabase, now, count ?? links.length);

  if (!summary.ok) {
    return jsonNoStore({ ok: false, error: summary.error }, { status: summary.status });
  }

  return jsonNoStore({
    ok: true,
    installed: true,
    externalRequest: false,
    tokenExcluded: true,
    tokenHashExcluded: true,
    limit,
    total: count ?? links.length,
    summary: summary.value,
    links: links.map((link) => toAdminShareLink(link, planningRunsById.runs.get(link.planning_run_id)))
  });
}

async function loadPlanningRunSummaries(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  planningRunIds: string[]
): Promise<
  | {
      ok: true;
      runs: Map<string, PlanningRunSummaryRow>;
    }
  | {
      ok: false;
      status: number;
      error: string;
    }
> {
  if (planningRunIds.length === 0) {
    return {
      ok: true,
      runs: new Map()
    };
  }

  const { data, error } = await supabase
    .from("planning_runs")
    .select("id, brand_name, site_url, product_type, created_by, created_at")
    .in("id", planningRunIds);

  if (error) {
    return {
      ok: false,
      status: 502,
      error: sanitizeShareError(error.message)
    };
  }

  return {
    ok: true,
    runs: new Map(((data ?? []) as PlanningRunSummaryRow[]).map((run) => [run.id, run]))
  };
}

async function loadShareSummary(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  now: string,
  total: number
): Promise<
  | {
      ok: true;
      value: {
        total: number;
        active: number;
        activeUsable: number;
        activeExpired: number;
        revoked: number;
        accessed: number;
      };
    }
  | {
      ok: false;
      status: number;
      error: string;
    }
> {
  const [activeResult, expiredResult, revokedResult, accessedResult] = await Promise.all([
    supabase.from(reportShareLinksTable).select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase
      .from(reportShareLinksTable)
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .lte("expires_at", now),
    supabase.from(reportShareLinksTable).select("id", { count: "exact", head: true }).eq("status", "revoked"),
    supabase.from(reportShareLinksTable).select("id", { count: "exact", head: true }).gt("access_count", 0)
  ]);
  const error = activeResult.error ?? expiredResult.error ?? revokedResult.error ?? accessedResult.error;

  if (error) {
    return {
      ok: false,
      status: 502,
      error: sanitizeShareError(error.message)
    };
  }

  const active = activeResult.count ?? 0;
  const activeExpired = expiredResult.count ?? 0;

  return {
    ok: true,
    value: {
      total,
      active,
      activeUsable: Math.max(active - activeExpired, 0),
      activeExpired,
      revoked: revokedResult.count ?? 0,
      accessed: accessedResult.count ?? 0
    }
  };
}

function toAdminShareLink(link: ReportShareLinkRow, planningRun: PlanningRunSummaryRow | undefined) {
  return {
    id: link.id,
    planningRunId: link.planning_run_id,
    createdByEmail: link.created_by_email,
    status: link.status,
    expiresAt: link.expires_at,
    lastAccessedAt: link.last_accessed_at,
    accessCount: link.access_count,
    createdAt: link.created_at,
    updatedAt: link.updated_at,
    isExpired: isReportShareExpired(link.expires_at),
    tokenAvailable: false,
    planningRun: planningRun
      ? {
          id: planningRun.id,
          brandName: planningRun.brand_name,
          siteUrl: planningRun.site_url,
          productType: planningRun.product_type,
          createdBy: planningRun.created_by,
          createdAt: planningRun.created_at
        }
      : null
  };
}

function clampLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return 12;
  }

  return Math.min(Math.max(parsed, 1), 30);
}
