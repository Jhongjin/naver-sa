import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import { getNaverConfigState, requestNaverSearchAd } from "@/lib/naver-search-ad";
import {
  createPerformanceStatsPreviewRequest,
  naverPerformanceDocs,
  performanceSyncSafeguards,
  performanceSyncTableName
} from "@/lib/naver-performance-sync";
import {
  generatePerformanceRecommendationDrafts,
  generatePerformanceRecommendations,
  summarizePerformanceRecommendationDrafts,
  summarizePerformanceRecommendations,
  type PerformanceRecommendation,
  type PerformanceRecommendationDraft
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

export async function POST(request: Request) {
  const access = await verifyUserAccess(request, { requireAdmin: true });

  if (!access.ok) {
    return jsonNoStore(access, { status: access.status });
  }

  const preview = createPerformanceStatsPreviewRequest((await request.json().catch(() => ({}))) as Record<string, unknown>);

  if (preview.warnings.length > 0) {
    return jsonNoStore(
      {
        ok: false,
        externalRequest: false,
        readOnly: true,
        warnings: preview.warnings,
        docs: {
          source: naverPerformanceDocs.swaggerFiles[0].url,
          endpoint: "GET /api/stats{?ids,fields,timeRange,datePreset,timeIncrement,breakdown}"
        },
        safeguards: performanceSyncSafeguards
      },
      { status: 400 }
    );
  }

  const naverState = getNaverConfigState();

  if (!naverState.ready) {
    return jsonNoStore(
      {
        ok: false,
        externalRequest: false,
        readOnly: true,
        error: "Naver Search Ad API environment variables are incomplete.",
        missingCount: naverState.missing.length
      },
      { status: 503 }
    );
  }

  const result = await requestNaverSearchAd<unknown>("GET", "/api/stats", {
    query: {
      ids: JSON.stringify(preview.entityIds),
      fields: JSON.stringify(preview.fields),
      timeRange: JSON.stringify({
        since: preview.dateFrom,
        until: preview.dateTo
      }),
      timeIncrement: preview.timeIncrement
    }
  });

  if (!result.ok) {
    return jsonNoStore(
      {
        ok: false,
        externalRequest: true,
        readOnly: true,
        status: result.status,
        error: result.error,
        transactionId: result.transactionId,
        safeguards: performanceSyncSafeguards
      },
      { status: result.status === 0 ? 503 : 502 }
    );
  }

  const recommendations = generatePerformanceRecommendations(result.data);
  const recommendationSummary = summarizePerformanceRecommendations(recommendations);
  const recommendationDrafts = generatePerformanceRecommendationDrafts(recommendations);
  const recommendationDraftSummary = summarizePerformanceRecommendationDrafts(recommendationDrafts);
  const history = await savePerformancePreviewHistory({
    userId: access.user.id,
    actorEmail: access.user.email ?? null,
    preview,
    stats: result.data,
    recommendations,
    recommendationDrafts
  });

  return jsonNoStore({
    ok: true,
    externalRequest: true,
    readOnly: true,
    request: {
      entityCount: preview.entityIds.length,
      fields: preview.fields,
      dateFrom: preview.dateFrom,
      dateTo: preview.dateTo,
      timeIncrement: preview.timeIncrement
    },
    stats: result.data,
    recommendations,
    recommendationSummary,
    recommendationDrafts,
    recommendationDraftSummary,
    history,
    safeguards: performanceSyncSafeguards
  });
}

async function savePerformancePreviewHistory(input: {
  userId: string;
  actorEmail: string | null;
  preview: ReturnType<typeof createPerformanceStatsPreviewRequest>;
  stats: unknown;
  recommendations: PerformanceRecommendation[];
  recommendationDrafts: PerformanceRecommendationDraft[];
}): Promise<
  | {
      saved: true;
      id: string;
      rowCount: number;
    }
  | {
      saved: false;
      warning: string;
    }
> {
  const state = getSupabaseAdminState();

  if (!state.ready) {
    return {
      saved: false,
      warning: "Supabase admin environment is not configured, so performance preview history was not saved."
    };
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      saved: false,
      warning: "Supabase admin client is unavailable, so performance preview history was not saved."
    };
  }

  const rowCount = countStatsRows(input.stats);
  const { data, error } = await supabase
    .from(performanceSyncTableName)
    .insert({
      user_id: input.userId,
      actor_email: input.actorEmail,
      scope: "powerlinkDailyStats",
      requested_from: input.preview.dateFrom,
      requested_to: input.preview.dateTo,
      status: "completed",
      external_request: true,
      read_only_endpoint: "GET /api/stats{?ids,fields,timeRange,datePreset,timeIncrement,breakdown}",
      entity_ids: input.preview.entityIds,
      fields: input.preview.fields,
      safeguards: performanceSyncSafeguards,
      warnings: [],
      result_summary: {
        entityCount: input.preview.entityIds.length,
        fieldCount: input.preview.fields.length,
        rowCount,
        recommendationCount: input.recommendations.length,
        recommendationSummary: summarizePerformanceRecommendations(input.recommendations),
        recommendationDraftCount: input.recommendationDrafts.length,
        recommendationDraftSummary: summarizePerformanceRecommendationDrafts(input.recommendationDrafts),
        timeIncrement: input.preview.timeIncrement,
        storedRawStats: false
      }
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      saved: false,
      warning: isMissingTableError(error)
        ? "Naver performance sync table is not installed yet, so preview history was not saved."
        : `Performance preview history was not saved: ${sanitizeError(error?.message)}`
    };
  }

  return {
    saved: true,
    id: data.id as string,
    rowCount
  };
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
    : "Unknown persistence error.";
}
