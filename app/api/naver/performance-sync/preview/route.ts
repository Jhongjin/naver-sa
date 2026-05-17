import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import { getNaverConfigState, requestNaverSearchAd } from "@/lib/naver-search-ad";
import {
  createPerformanceStatsPreviewRequest,
  naverPerformanceDocs,
  performanceSyncSafeguards
} from "@/lib/naver-performance-sync";

export function GET() {
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
    safeguards: performanceSyncSafeguards
  });
}
