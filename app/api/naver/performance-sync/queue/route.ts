import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import { getNaverConfigState, requestNaverSearchAd } from "@/lib/naver-search-ad";
import { performanceSyncSafeguards, performanceSyncTableName } from "@/lib/naver-performance-sync";
import {
  generatePerformanceRecommendationDrafts,
  generatePerformanceRecommendations,
  summarizePerformanceRecommendationDrafts,
  summarizePerformanceRecommendations
} from "@/lib/performance-recommendations";
import { getSupabaseAdminClient, getSupabaseAdminState } from "@/lib/supabase-admin";

export function GET() {
  return methodNotAllowed(["POST"]);
}

export function PUT() {
  return methodNotAllowed(["POST"]);
}

export function PATCH() {
  return methodNotAllowed(["POST"]);
}

export function DELETE() {
  return methodNotAllowed(["POST"]);
}

type PerformanceSyncPlanRow = {
  id: string;
  scope: "powerlinkDailyStats" | "shoppingKeywordDailyStats" | "masterReference";
  requested_from: string;
  requested_to: string;
  status: "planned" | "blocked" | "ready" | "failed" | "completed";
  entity_ids: string[] | null;
  fields: string[] | null;
  warnings: string[] | null;
};

export async function POST(request: Request) {
  const access = await verifyUserAccess(request, { requireAdmin: true });

  if (!access.ok) {
    return jsonNoStore(access, { status: access.status });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const planId = typeof body.planId === "string" ? body.planId : "";

  if (!isUuid(planId)) {
    return jsonNoStore({ ok: false, externalRequest: false, error: "Invalid performance sync plan id." }, { status: 400 });
  }

  const supabase = getReadySupabase();

  if (!supabase.ok) {
    return jsonNoStore(supabase, { status: supabase.status });
  }

  const { data, error } = await supabase.client
    .from(performanceSyncTableName)
    .select("id, scope, requested_from, requested_to, status, entity_ids, fields, warnings")
    .eq("id", planId)
    .maybeSingle();

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

  const plan = data as PerformanceSyncPlanRow | null;

  if (!plan) {
    return jsonNoStore({ ok: false, externalRequest: false, error: "Performance sync plan was not found." }, { status: 404 });
  }

  const validation = validateManualQueuePlan(plan);

  if (validation.length > 0) {
    await supabase.client
      .from(performanceSyncTableName)
      .update({
        status: "blocked",
        warnings: [...new Set([...(plan.warnings ?? []), ...validation])],
        updated_at: new Date().toISOString()
      })
      .eq("id", plan.id);
    await recordOpsAlert(supabase.client, {
      actor: access.user.email ?? access.user.id,
      eventType: "ops.performance_sync.blocked",
      entityId: plan.id,
      afterValue: {
        scope: plan.scope,
        status: "blocked",
        warnings: validation
      },
      reason: validation[0] ?? "Manual performance sync plan blocked."
    });

    return jsonNoStore(
      {
        ok: false,
        externalRequest: false,
        readOnly: true,
        warnings: validation,
        safeguards: performanceSyncSafeguards
      },
      { status: 400 }
    );
  }

  const naverState = getNaverConfigState();

  if (!naverState.ready) {
    await recordOpsAlert(supabase.client, {
      actor: access.user.email ?? access.user.id,
      eventType: "ops.performance_sync.config_missing",
      entityId: plan.id,
      afterValue: {
        scope: plan.scope,
        status: "config_missing",
        missingCount: naverState.missing.length
      },
      reason: "Naver Search Ad API environment variables are incomplete."
    });

    return jsonNoStore(
      {
        ok: false,
        externalRequest: false,
        readOnly: true,
        error: "Naver Search Ad API environment variables are incomplete.",
        missingCount: naverState.missing.length,
        safeguards: performanceSyncSafeguards
      },
      { status: 503 }
    );
  }

  await supabase.client
    .from(performanceSyncTableName)
    .update({
      status: "ready",
      result_summary: {
        message: "Manual read-only sync started. No mutation or report job creation is allowed.",
        queuedAt: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    })
    .eq("id", plan.id);

  const entityIds = plan.entity_ids ?? [];
  const fields = plan.fields ?? [];
  const result = await requestNaverSearchAd<unknown>("GET", "/api/stats", {
    query: {
      ids: JSON.stringify(entityIds),
      fields: JSON.stringify(fields),
      timeRange: JSON.stringify({
        since: plan.requested_from,
        until: plan.requested_to
      }),
      timeIncrement: "allDays"
    }
  });

  if (!result.ok) {
    const sanitizedError = sanitizeError(result.error);

    await supabase.client
      .from(performanceSyncTableName)
      .update({
        status: "failed",
        external_request: true,
        result_summary: {
          entityCount: entityIds.length,
          fieldCount: fields.length,
          rowCount: 0,
          storedRawStats: false,
          message: "Manual read-only sync failed.",
          status: result.status,
          error: sanitizedError
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", plan.id);
    await recordOpsAlert(supabase.client, {
      actor: access.user.email ?? access.user.id,
      eventType: "ops.performance_sync.failed",
      entityId: plan.id,
      afterValue: {
        scope: plan.scope,
        status: result.status,
        entityCount: entityIds.length,
        fieldCount: fields.length,
        error: sanitizedError
      },
      reason: "Manual read-only performance sync failed."
    });

    return jsonNoStore(
      {
        ok: false,
        externalRequest: true,
        readOnly: true,
        status: result.status,
        error: result.error,
        safeguards: performanceSyncSafeguards
      },
      { status: result.status === 0 ? 503 : 502 }
    );
  }

  const rowCount = countStatsRows(result.data);
  const recommendations = generatePerformanceRecommendations(result.data);
  const recommendationSummary = summarizePerformanceRecommendations(recommendations);
  const recommendationDrafts = generatePerformanceRecommendationDrafts(recommendations);
  const recommendationDraftSummary = summarizePerformanceRecommendationDrafts(recommendationDrafts);
  const completedAt = new Date().toISOString();

  await supabase.client
    .from(performanceSyncTableName)
    .update({
      status: "completed",
      external_request: true,
      warnings: [],
      result_summary: {
        entityCount: entityIds.length,
        fieldCount: fields.length,
        rowCount,
        recommendationCount: recommendations.length,
        recommendationSummary,
        recommendationDraftCount: recommendationDrafts.length,
        recommendationDraftSummary,
        timeIncrement: "allDays",
        storedRawStats: false,
        message: "Manual read-only sync completed. Raw stats were not stored.",
        completedAt
      },
      updated_at: completedAt
    })
    .eq("id", plan.id);

  return jsonNoStore({
    ok: true,
    externalRequest: true,
    readOnly: true,
    plan: {
      id: plan.id,
      status: "completed",
      entityCount: entityIds.length,
      fieldCount: fields.length,
      rowCount,
      recommendationCount: recommendations.length,
      recommendationDraftCount: recommendationDrafts.length,
      storedRawStats: false,
      completedAt
    },
    safeguards: performanceSyncSafeguards
  });
}

function validateManualQueuePlan(plan: PerformanceSyncPlanRow): string[] {
  const warnings: string[] = [];

  if (plan.status === "blocked") {
    warnings.push("차단된 계획은 연결 ID와 기간을 보정한 뒤 다시 저장해야 합니다.");
  }

  if (plan.status === "completed") {
    warnings.push("이미 완료된 계획은 중복 실행하지 않습니다. preview 재조회로 별도 확인해 주세요.");
  }

  if (plan.scope === "masterReference") {
    warnings.push("Master report job 생성/삭제가 필요한 scope는 수동 sync 큐에서도 차단합니다.");
  }

  if ((plan.entity_ids ?? []).length === 0) {
    warnings.push("수동 sync에는 최소 1개의 campaign/ad group/keyword/ad ID가 필요합니다.");
  }

  if ((plan.fields ?? []).length === 0) {
    warnings.push("수동 sync에는 최소 1개의 stats field가 필요합니다.");
  }

  return warnings;
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

async function recordOpsAlert(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  input: {
    actor: string;
    eventType: string;
    entityId: string;
    afterValue: Record<string, unknown>;
    reason: string;
  }
) {
  await supabase.from("audit_events").insert({
    event_type: input.eventType,
    actor: input.actor,
    entity_type: "naver_performance_sync_run",
    entity_id: input.entityId,
    after_value: input.afterValue,
    reason: input.reason
  });
}

function countStatsRows(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (value && typeof value === "object" && "data" in value && Array.isArray(value.data)) {
    return value.data.length;
  }

  if (value && typeof value === "object" && "summaryStatResponse" in value && isRecord(value.summaryStatResponse)) {
    const data = value.summaryStatResponse.data;

    return Array.isArray(data) ? data.length : 0;
  }

  if (value && typeof value === "object" && "dailyStatResponse" in value && isRecord(value.dailyStatResponse)) {
    const data = value.dailyStatResponse.data;

    return Array.isArray(data) ? data.length : 0;
  }

  return value ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }

  return error.code === "42P01" || error.code === "PGRST205" || /naver_performance_sync_runs/i.test(error.message ?? "");
}

function sanitizeError(message: string | undefined): string {
  return message
    ? message
        .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
        .replace(/apikey[=:]\s*[^,\s}]+/gi, "apikey=[REDACTED]")
        .slice(0, 220)
    : "Performance sync queue request failed.";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
