import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import { getNaverConfigState } from "@/lib/naver-search-ad";
import {
  naverPerformanceDocs,
  performanceSyncCronPolicy,
  performanceSyncSafeguards,
  performanceSyncTableName
} from "@/lib/naver-performance-sync";
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

export async function GET(request: Request) {
  const access = await verifyUserAccess(request, { requireAdmin: true });

  if (!access.ok) {
    return jsonNoStore(access, { status: access.status });
  }

  const naver = getNaverConfigState();
  const database = await checkPerformanceSyncTable();
  const scheduler = getSchedulerReadiness();
  const ready = naver.ready && database.present && scheduler.ready;

  return jsonNoStore({
    ok: ready,
    ready,
    authAccess: access.state,
    externalRequest: false,
    naver: {
      ready: naver.ready,
      missingCount: naver.missing.length,
      customerIdPresent: naver.customerIdPresent
    },
    database,
    scheduler,
    docs: naverPerformanceDocs,
    safeguards: performanceSyncSafeguards,
    nextStep: getNextStep({ naverReady: naver.ready, databasePresent: database.present, schedulerReady: scheduler.ready })
  });
}

function getSchedulerReadiness() {
  const cronSecretPresent = Boolean(process.env.CRON_SECRET?.trim());

  return {
    ready: cronSecretPresent,
    automaticCronConfigured: true,
    cronSecretPresent,
    endpoint: performanceSyncCronPolicy.endpoint,
    scheduleUtc: performanceSyncCronPolicy.scheduleUtc,
    scheduleKst: performanceSyncCronPolicy.scheduleKst,
    maxRunsPerInvocation: performanceSyncCronPolicy.maxRunsPerInvocation,
    targetStatuses: performanceSyncCronPolicy.targetStatuses,
    excludedStatuses: performanceSyncCronPolicy.excludedStatuses,
    excludesMasterReference: performanceSyncCronPolicy.excludesMasterReference,
    automaticRetry: performanceSyncCronPolicy.automaticRetry,
    externalRequestOnSchedule: true,
    nextStep: cronSecretPresent
      ? "예약 실행은 하루 1회 planned/failed 계획 최대 3건을 read-only GET /api/stats로 처리합니다."
      : "CRON_SECRET 등록 후 Vercel Cron이 보호된 성과 sync route를 호출할 수 있습니다."
  };
}

function getNextStep(input: { naverReady: boolean; databasePresent: boolean; schedulerReady: boolean }) {
  if (!input.databasePresent) {
    return "Supabase migration 20260517111500_create_naver_performance_sync_runs.sql 적용 후 계획 저장을 사용할 수 있습니다.";
  }

  if (!input.naverReady) {
    return "Naver Search Ad API 환경 변수를 등록해야 read-only 성과 sync를 실행할 수 있습니다.";
  }

  if (!input.schedulerReady) {
    return "CRON_SECRET 등록 후 예약 실행까지 ready 상태가 됩니다. 수동 read-only sync는 계속 사용할 수 있습니다.";
  }

  return "성과 동기화 계획 저장, 관리자 수동 sync, Vercel Cron 예약 실행이 가능합니다.";
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
