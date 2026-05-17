import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import { getNaverConfigState } from "@/lib/naver-search-ad";
import {
  naverPerformanceDocs,
  performanceSyncSafeguards,
  performanceSyncTableName
} from "@/lib/naver-performance-sync";
import { getSupabaseAdminClient, getSupabaseAdminState } from "@/lib/supabase-admin";

export function POST() {
  return methodNotAllowed(["GET"]);
}

export async function GET(request: Request) {
  const access = await verifyUserAccess(request, { requireAdmin: true });

  if (!access.ok) {
    return jsonNoStore(access, { status: access.status });
  }

  const naver = getNaverConfigState();
  const database = await checkPerformanceSyncTable();

  return jsonNoStore({
    ok: naver.ready && database.present,
    ready: naver.ready && database.present,
    authAccess: access.state,
    externalRequest: false,
    naver: {
      ready: naver.ready,
      missingCount: naver.missing.length,
      customerIdPresent: naver.customerIdPresent
    },
    database,
    docs: naverPerformanceDocs,
    safeguards: performanceSyncSafeguards,
    nextStep: database.present
      ? "성과 동기화 계획 저장이 가능합니다. 실제 Naver stats 호출은 별도 승인 큐에서 read-only로만 연결합니다."
      : "Supabase migration 20260517111500_create_naver_performance_sync_runs.sql 적용 후 계획 저장을 사용할 수 있습니다."
  });
}

async function checkPerformanceSyncTable() {
  const state = getSupabaseAdminState();

  if (!state.ready) {
    return {
      table: performanceSyncTableName,
      present: false,
      rowCount: null,
      error: "Supabase admin environment is not configured.",
      errorCode: "SUPABASE_ADMIN_NOT_CONFIGURED"
    };
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      table: performanceSyncTableName,
      present: false,
      rowCount: null,
      error: "Supabase admin client is unavailable.",
      errorCode: "SUPABASE_ADMIN_UNAVAILABLE"
    };
  }

  const { count, error } = await supabase.from(performanceSyncTableName).select("id", {
    count: "exact",
    head: true
  });

  return {
    table: performanceSyncTableName,
    present: !error,
    rowCount: error ? null : count,
    error: error ? sanitizeError(error.message) : null,
    errorCode: error?.code ?? null
  };
}

function sanitizeError(message: string | undefined): string {
  return message
    ? message
        .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
        .replace(/apikey[=:]\s*[^,\s}]+/gi, "apikey=[REDACTED]")
        .slice(0, 220)
    : "Performance sync readiness check failed.";
}
