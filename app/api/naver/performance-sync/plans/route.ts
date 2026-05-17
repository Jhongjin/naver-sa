import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import {
  createPerformanceSyncPlan,
  performanceSyncSafeguards,
  performanceSyncTableName
} from "@/lib/naver-performance-sync";
import { getSupabaseAdminClient, getSupabaseAdminState } from "@/lib/supabase-admin";

type PerformanceSyncPlanRow = {
  id: string;
  actor_email: string | null;
  product_type: "powerlink" | "shoppingSearch" | null;
  brand_name: string | null;
  site_url: string | null;
  scope: "powerlinkDailyStats" | "shoppingKeywordDailyStats" | "masterReference";
  requested_from: string;
  requested_to: string;
  status: "planned" | "blocked" | "ready" | "failed" | "completed";
  external_request: boolean;
  read_only_endpoint: string;
  entity_ids: string[] | null;
  fields: string[] | null;
  warnings: string[] | null;
  result_summary: Record<string, unknown> | null;
  created_at: string;
};

export function PUT() {
  return methodNotAllowed(["GET", "POST"]);
}

export async function GET(request: Request) {
  const access = await verifyUserAccess(request, { requireAdmin: true });

  if (!access.ok) {
    return jsonNoStore(access, { status: access.status });
  }

  const supabase = getReadySupabase();

  if (!supabase.ok) {
    return jsonNoStore(supabase, { status: supabase.status });
  }

  const { data, error } = await supabase.client
    .from(performanceSyncTableName)
    .select(
      "id, actor_email, product_type, brand_name, site_url, scope, requested_from, requested_to, status, external_request, read_only_endpoint, entity_ids, fields, warnings, result_summary, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    const status = isMissingTableError(error) ? 503 : 502;

    return jsonNoStore(
      {
        ok: false,
        externalRequest: false,
        error: isMissingTableError(error)
          ? "Naver performance sync table is not installed yet."
          : sanitizeError(error.message),
        migration: isMissingTableError(error)
          ? "supabase/migrations/20260517111500_create_naver_performance_sync_runs.sql"
          : null
      },
      { status }
    );
  }

  return jsonNoStore({
    ok: true,
    externalRequest: false,
    plans: ((data ?? []) as PerformanceSyncPlanRow[]).map(toPublicPlan)
  });
}

export async function POST(request: Request) {
  const access = await verifyUserAccess(request, { requireAdmin: true });

  if (!access.ok) {
    return jsonNoStore(access, { status: access.status });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const plan = createPerformanceSyncPlan(body);
  const supabase = getReadySupabase();

  if (!supabase.ok) {
    return jsonNoStore(supabase, { status: supabase.status });
  }

  const { data, error } = await supabase.client
    .from(performanceSyncTableName)
    .insert({
      user_id: access.user.id,
      actor_email: access.user.email ?? null,
      product_type: plan.productType,
      brand_name: plan.brandName,
      site_url: plan.siteUrl,
      scope: plan.scope,
      requested_from: plan.dateFrom,
      requested_to: plan.dateTo,
      status: plan.status,
      external_request: false,
      read_only_endpoint: plan.readOnlyEndpoint,
      entity_ids: plan.entityIds,
      fields: plan.fields,
      safeguards: performanceSyncSafeguards,
      warnings: plan.warnings,
      result_summary: {
        message:
          plan.status === "planned"
            ? "Dry-run performance sync plan saved. No Naver external request was made."
            : "Dry-run performance sync plan saved as blocked. Resolve warnings before read-only sync."
      }
    })
    .select("id, status, warnings, created_at")
    .single();

  if (error || !data) {
    const status = isMissingTableError(error) ? 503 : 502;

    return jsonNoStore(
      {
        ok: false,
        externalRequest: false,
        error: isMissingTableError(error)
          ? "Naver performance sync table is not installed yet."
          : sanitizeError(error?.message),
        migration: "supabase/migrations/20260517111500_create_naver_performance_sync_runs.sql"
      },
      { status }
    );
  }

  return jsonNoStore({
    ok: true,
    externalRequest: false,
    plan: {
      id: data.id as string,
      status: data.status as string,
      warnings: (data.warnings as string[] | null) ?? [],
      createdAt: data.created_at as string
    }
  });
}

function getReadySupabase():
  | {
      ok: true;
      client: NonNullable<ReturnType<typeof getSupabaseAdminClient>>;
    }
  | {
      ok: false;
      status: number;
      error: string;
      code: string;
    } {
  const state = getSupabaseAdminState();

  if (!state.ready) {
    return {
      ok: false,
      status: 503,
      error: "Supabase admin environment is not configured.",
      code: "SUPABASE_ADMIN_NOT_CONFIGURED"
    };
  }

  const client = getSupabaseAdminClient();

  if (!client) {
    return {
      ok: false,
      status: 503,
      error: "Supabase admin client is unavailable.",
      code: "SUPABASE_ADMIN_UNAVAILABLE"
    };
  }

  return {
    ok: true,
    client
  };
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }

  return error.code === "42P01" || error.code === "PGRST205" || /naver_performance_sync_runs/i.test(error.message ?? "");
}

function toPublicPlan(row: PerformanceSyncPlanRow) {
  return {
    id: row.id,
    actorEmail: row.actor_email,
    productType: row.product_type,
    brandName: row.brand_name,
    siteUrl: row.site_url,
    scope: row.scope,
    requestedFrom: row.requested_from,
    requestedTo: row.requested_to,
    status: row.status,
    externalRequest: row.external_request,
    readOnlyEndpoint: row.read_only_endpoint,
    entityIds: row.entity_ids ?? [],
    fields: row.fields ?? [],
    warnings: row.warnings ?? [],
    resultSummary: normalizeResultSummary(row.result_summary),
    createdAt: row.created_at
  };
}

function normalizeResultSummary(value: Record<string, unknown> | null) {
  return {
    entityCount: readNumber(value?.entityCount),
    fieldCount: readNumber(value?.fieldCount),
    rowCount: readNumber(value?.rowCount),
    recommendationCount: readNumber(value?.recommendationCount),
    storedRawStats: value?.storedRawStats === true,
    message: typeof value?.message === "string" ? value.message : null
  };
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sanitizeError(message: string | undefined): string {
  return message
    ? message
        .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
        .replace(/apikey[=:]\s*[^,\s}]+/gi, "apikey=[REDACTED]")
        .slice(0, 220)
    : "Performance sync plan request failed.";
}
