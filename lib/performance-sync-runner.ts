import type { SupabaseClient } from "@supabase/supabase-js";
import { getNaverConfigState, requestNaverSearchAd } from "@/lib/naver-search-ad";
import {
  performanceSyncSafeguards,
  performanceSyncTableName,
  type PerformanceSyncScope
} from "@/lib/naver-performance-sync";
import {
  generatePerformanceRecommendationDrafts,
  generatePerformanceRecommendations,
  summarizePerformanceRecommendationDrafts,
  summarizePerformanceRecommendations
} from "@/lib/performance-recommendations";

export type PerformanceSyncRunSource = "manual" | "cron";

export type PerformanceSyncPlanRunRow = {
  id: string;
  scope: PerformanceSyncScope;
  requested_from: string;
  requested_to: string;
  status: PerformanceSyncRunStatus;
  entity_ids: string[] | null;
  fields: string[] | null;
  warnings: string[] | null;
};

export type PerformanceSyncRunStatus = "planned" | "blocked" | "ready" | "failed" | "completed";

export type PerformanceSyncRunResult = {
  statusCode: number;
  outcome: "completed" | "blocked" | "failed" | "config_missing";
  body: Record<string, unknown>;
};

export async function runPerformanceSyncPlan(input: {
  supabase: SupabaseClient;
  plan: PerformanceSyncPlanRunRow;
  actor: string;
  source: PerformanceSyncRunSource;
  allowedStatuses: PerformanceSyncRunStatus[];
  configMissingMarksFailed?: boolean;
}): Promise<PerformanceSyncRunResult> {
  const validation = validatePerformanceSyncPlan(input.plan, input.allowedStatuses, input.source);

  if (validation.length > 0) {
    await input.supabase
      .from(performanceSyncTableName)
      .update({
        status: "blocked",
        warnings: [...new Set([...(input.plan.warnings ?? []), ...validation])],
        updated_at: new Date().toISOString()
      })
      .eq("id", input.plan.id);
    await recordOpsAlert(input.supabase, {
      actor: input.actor,
      eventType: "ops.performance_sync.blocked",
      entityId: input.plan.id,
      afterValue: {
        scope: input.plan.scope,
        source: input.source,
        status: "blocked",
        warnings: validation
      },
      reason: validation[0] ?? `${sourceLabel(input.source)} performance sync plan blocked.`
    });

    return {
      statusCode: 400,
      outcome: "blocked",
      body: {
        ok: false,
        externalRequest: false,
        readOnly: true,
        warnings: validation,
        safeguards: performanceSyncSafeguards
      }
    };
  }

  const naverState = getNaverConfigState();

  if (!naverState.ready) {
    const afterValue = {
      scope: input.plan.scope,
      source: input.source,
      status: input.configMissingMarksFailed ? "failed" : "config_missing",
      missingCount: naverState.missing.length
    };

    if (input.configMissingMarksFailed) {
      await input.supabase
        .from(performanceSyncTableName)
        .update({
          status: "failed",
          external_request: false,
          result_summary: {
            message: `${sourceLabel(input.source)} read-only sync failed before external request: Naver API configuration is incomplete.`,
            storedRawStats: false,
            source: input.source,
            status: 0,
            error: "Naver Search Ad API environment variables are incomplete.",
            missingCount: naverState.missing.length
          },
          updated_at: new Date().toISOString()
        })
        .eq("id", input.plan.id);
    }

    await recordOpsAlert(input.supabase, {
      actor: input.actor,
      eventType: input.configMissingMarksFailed ? "ops.performance_sync.failed" : "ops.performance_sync.config_missing",
      entityId: input.plan.id,
      afterValue,
      reason: "Naver Search Ad API environment variables are incomplete."
    });

    return {
      statusCode: 503,
      outcome: input.configMissingMarksFailed ? "failed" : "config_missing",
      body: {
        ok: false,
        externalRequest: false,
        readOnly: true,
        error: "Naver Search Ad API environment variables are incomplete.",
        missingCount: naverState.missing.length,
        safeguards: performanceSyncSafeguards
      }
    };
  }

  await input.supabase
    .from(performanceSyncTableName)
    .update({
      status: "ready",
      result_summary: {
        message: `${sourceLabel(input.source)} read-only sync started. No mutation or report job creation is allowed.`,
        queuedAt: new Date().toISOString(),
        source: input.source
      },
      updated_at: new Date().toISOString()
    })
    .eq("id", input.plan.id);

  const entityIds = input.plan.entity_ids ?? [];
  const fields = input.plan.fields ?? [];
  const result = await requestNaverSearchAd<unknown>("GET", "/api/stats", {
    query: {
      ids: JSON.stringify(entityIds),
      fields: JSON.stringify(fields),
      timeRange: JSON.stringify({
        since: input.plan.requested_from,
        until: input.plan.requested_to
      }),
      timeIncrement: "allDays"
    }
  });

  if (!result.ok) {
    const sanitizedError = sanitizeError(result.error);

    await input.supabase
      .from(performanceSyncTableName)
      .update({
        status: "failed",
        external_request: true,
        result_summary: {
          entityCount: entityIds.length,
          fieldCount: fields.length,
          rowCount: 0,
          storedRawStats: false,
          message: `${sourceLabel(input.source)} read-only sync failed.`,
          source: input.source,
          status: result.status,
          error: sanitizedError
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", input.plan.id);
    await recordOpsAlert(input.supabase, {
      actor: input.actor,
      eventType: "ops.performance_sync.failed",
      entityId: input.plan.id,
      afterValue: {
        scope: input.plan.scope,
        source: input.source,
        status: result.status,
        entityCount: entityIds.length,
        fieldCount: fields.length,
        error: sanitizedError
      },
      reason: `${sourceLabel(input.source)} read-only performance sync failed.`
    });

    return {
      statusCode: result.status === 0 ? 503 : 502,
      outcome: "failed",
      body: {
        ok: false,
        externalRequest: true,
        readOnly: true,
        status: result.status,
        error: result.error,
        safeguards: performanceSyncSafeguards
      }
    };
  }

  const rowCount = countStatsRows(result.data);
  const recommendations = generatePerformanceRecommendations(result.data);
  const recommendationSummary = summarizePerformanceRecommendations(recommendations);
  const recommendationDrafts = generatePerformanceRecommendationDrafts(recommendations);
  const recommendationDraftSummary = summarizePerformanceRecommendationDrafts(recommendationDrafts);
  const completedAt = new Date().toISOString();

  await input.supabase
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
        message: `${sourceLabel(input.source)} read-only sync completed. Raw stats were not stored.`,
        source: input.source,
        completedAt
      },
      updated_at: completedAt
    })
    .eq("id", input.plan.id);

  return {
    statusCode: 200,
    outcome: "completed",
    body: {
      ok: true,
      externalRequest: true,
      readOnly: true,
      plan: {
        id: input.plan.id,
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
    }
  };
}

export function countStatsRows(value: unknown): number {
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

export function isMissingPerformanceSyncTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }

  return error.code === "42P01" || error.code === "PGRST205" || /naver_performance_sync_runs/i.test(error.message ?? "");
}

export function sanitizePerformanceSyncError(message: string | undefined, fallback = "Performance sync request failed."): string {
  return message
    ? message
        .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
        .replace(/apikey[=:]\s*[^,\s}]+/gi, "apikey=[REDACTED]")
        .slice(0, 220)
    : fallback;
}

function validatePerformanceSyncPlan(
  plan: PerformanceSyncPlanRunRow,
  allowedStatuses: PerformanceSyncRunStatus[],
  source: PerformanceSyncRunSource
): string[] {
  const warnings: string[] = [];

  if (plan.status === "blocked") {
    warnings.push("차단된 계획은 연결 ID와 기간을 보정한 뒤 다시 저장해야 합니다.");
  }

  if (plan.status === "completed") {
    warnings.push("이미 완료된 계획은 중복 실행하지 않습니다. preview 재조회로 별도 확인해 주세요.");
  }

  if (!allowedStatuses.includes(plan.status) && plan.status !== "blocked" && plan.status !== "completed") {
    warnings.push(
      source === "cron"
        ? "예약 sync는 planned 또는 failed 상태의 계획만 처리합니다."
        : "수동 sync는 planned, ready, failed 상태의 계획만 처리합니다."
    );
  }

  if (plan.scope === "masterReference") {
    warnings.push("Master report job 생성/삭제가 필요한 scope는 sync 큐에서 차단합니다.");
  }

  if ((plan.entity_ids ?? []).length === 0) {
    warnings.push("sync에는 최소 1개의 campaign/ad group/keyword/ad ID가 필요합니다.");
  }

  if ((plan.fields ?? []).length === 0) {
    warnings.push("sync에는 최소 1개의 stats field가 필요합니다.");
  }

  return [...new Set(warnings)];
}

async function recordOpsAlert(
  supabase: SupabaseClient,
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

function sanitizeError(message: string | undefined): string {
  return sanitizePerformanceSyncError(message, "Performance sync queue request failed.");
}

function sourceLabel(source: PerformanceSyncRunSource): string {
  return source === "cron" ? "Scheduled cron" : "Manual";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
