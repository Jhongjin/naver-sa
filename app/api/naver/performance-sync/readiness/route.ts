import { verifyUserAccess } from "@/lib/auth-access";
import { redactSensitiveErrorText } from "@/lib/error-redaction";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import { getNaverConfigState } from "@/lib/naver-search-ad";
import {
  naverPerformanceDocs,
  performanceSyncCronPolicy,
  performanceSyncSafeguards,
  performanceSyncTableName
} from "@/lib/naver-performance-sync";
import { getSupabaseAdminClient, getSupabaseAdminState } from "@/lib/supabase-admin";

type PerformanceSyncStatus = "planned" | "blocked" | "ready" | "failed" | "completed";
type SupabaseAdminClient = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;

type OldestCronEligibleRow = {
  id: string;
  scope: string;
  status: "planned" | "failed";
  requested_from: string;
  requested_to: string;
  created_at: string;
};

type AuditEventRow = {
  event_type: string;
  entity_id: string | null;
  after_value: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
};

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
  const databaseCheck = await checkPerformanceSyncTable();
  const { client: databaseClient, ...database } = databaseCheck;
  const ops = databaseClient ? await loadPerformanceSyncOpsSummary(databaseClient) : null;
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
    ops,
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
      errorCode: "SUPABASE_ADMIN_NOT_CONFIGURED",
      client: null
    };
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      table: performanceSyncTableName,
      present: false,
      rowCount: null,
      error: "Supabase admin client is unavailable.",
      errorCode: "SUPABASE_ADMIN_UNAVAILABLE",
      client: null
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
    errorCode: error?.code ?? null,
    client: error ? null : supabase
  };
}

async function loadPerformanceSyncOpsSummary(client: SupabaseAdminClient) {
  const staleReadyBefore = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const statuses: PerformanceSyncStatus[] = ["planned", "blocked", "ready", "failed", "completed"];
  const [statusCounts, oldestCronEligible, staleReady, latestCronHeartbeat, latestAlert] = await Promise.all([
    countByStatus(client, statuses),
    loadOldestCronEligiblePlan(client),
    countStaleReadyPlans(client, staleReadyBefore),
    loadLatestOpsEvent(client, ["ops.performance_sync.cron_checked"]),
    loadLatestOpsEvent(client, [
      "ops.performance_sync.failed",
      "ops.performance_sync.blocked",
      "ops.performance_sync.config_missing"
    ])
  ]);

  return {
    externalRequest: false,
    backlog: {
      statusCounts,
      cronEligible: statusCounts.planned + statusCounts.failed,
      staleReady,
      staleReadyThresholdMinutes: 60,
      oldestCronEligible
    },
    latestCronHeartbeat,
    latestAlert
  };
}

async function countByStatus(client: SupabaseAdminClient, statuses: PerformanceSyncStatus[]) {
  const results = await Promise.all(
    statuses.map(async (status) => {
      const { count } = await client
        .from(performanceSyncTableName)
        .select("id", { count: "exact", head: true })
        .eq("status", status);

      return [status, count ?? 0] as const;
    })
  );

  return Object.fromEntries(results) as Record<PerformanceSyncStatus, number>;
}

async function countStaleReadyPlans(client: SupabaseAdminClient, staleReadyBefore: string): Promise<number> {
  const { count, error } = await client
    .from(performanceSyncTableName)
    .select("id", { count: "exact", head: true })
    .eq("status", "ready")
    .lt("updated_at", staleReadyBefore);

  return error ? 0 : count ?? 0;
}

async function loadOldestCronEligiblePlan(client: SupabaseAdminClient) {
  const { data, error } = await client
    .from(performanceSyncTableName)
    .select("id, scope, status, requested_from, requested_to, created_at")
    .in("status", [...performanceSyncCronPolicy.targetStatuses])
    .neq("scope", "masterReference")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as OldestCronEligibleRow;

  return {
    id: row.id,
    scope: row.scope,
    status: row.status,
    requestedFrom: row.requested_from,
    requestedTo: row.requested_to,
    createdAt: row.created_at
  };
}

async function loadLatestOpsEvent(client: SupabaseAdminClient, eventTypes: string[]) {
  const { data, error } = await client
    .from("audit_events")
    .select("event_type, entity_id, after_value, reason, created_at")
    .in("event_type", eventTypes)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toSafeOpsEvent(data as AuditEventRow);
}

function toSafeOpsEvent(event: AuditEventRow) {
  const value = event.after_value ?? {};

  return {
    eventType: event.event_type,
    entityId: event.entity_id,
    createdAt: event.created_at,
    reason: event.reason,
    processed: readNumberOrNull(value.processed),
    remainingAfter: readNumberOrNull(value.remainingAfter),
    status: readScalar(value.status),
    source: readScalar(value.source),
    error: readString(value.error, 160)
  };
}

function readNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readScalar(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim().slice(0, 80);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function readString(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.trim() ? redactSensitiveErrorText(value, "", maxLength) : null;
}

function sanitizeError(message: string | undefined): string {
  return redactSensitiveErrorText(message, "Performance sync readiness check failed.");
}
