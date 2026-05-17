import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import { performanceSyncCronPolicy, performanceSyncSafeguards, performanceSyncTableName } from "@/lib/naver-performance-sync";
import {
  isMissingPerformanceSyncTableError,
  runPerformanceSyncPlan,
  sanitizePerformanceSyncError,
  type PerformanceSyncPlanRunRow
} from "@/lib/performance-sync-runner";
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
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return jsonNoStore(
      {
        ok: false,
        externalRequest: false,
        error: "Unauthorized cron request.",
        code: "CRON_UNAUTHORIZED"
      },
      { status: 401 }
    );
  }

  const supabase = getReadySupabase();

  if (!supabase.ok) {
    return jsonNoStore(supabase, { status: supabase.status });
  }

  const pendingBefore = await countPendingCronPlans(supabase.client);
  const { data, error } = await supabase.client
    .from(performanceSyncTableName)
    .select("id, scope, requested_from, requested_to, status, entity_ids, fields, warnings")
    .in("status", [...performanceSyncCronPolicy.targetStatuses])
    .neq("scope", "masterReference")
    .order("created_at", { ascending: true })
    .limit(performanceSyncCronPolicy.maxRunsPerInvocation);

  if (error) {
    const status = isMissingPerformanceSyncTableError(error) ? 503 : 502;

    return jsonNoStore(
      {
        ok: false,
        externalRequest: false,
        error: isMissingPerformanceSyncTableError(error)
          ? "Naver performance sync table is not installed yet."
          : sanitizePerformanceSyncError(error.message),
        migration: isMissingPerformanceSyncTableError(error)
          ? "supabase/migrations/20260517111500_create_naver_performance_sync_runs.sql"
          : null
      },
      { status }
    );
  }

  const plans = ((data ?? []) as PerformanceSyncPlanRunRow[]).slice(0, performanceSyncCronPolicy.maxRunsPerInvocation);
  const results: Array<{
    id: string;
    scope: string;
    requestedFrom: string;
    requestedTo: string;
    previousStatus: string;
    outcome: string;
    statusCode: number;
    ok: boolean;
    externalRequest: boolean;
  }> = [];

  for (const plan of plans) {
    const result = await runPerformanceSyncPlan({
      supabase: supabase.client,
      plan,
      actor: "system:cron",
      source: "cron",
      allowedStatuses: [...performanceSyncCronPolicy.targetStatuses],
      configMissingMarksFailed: true
    });

    results.push({
      id: plan.id,
      scope: plan.scope,
      requestedFrom: plan.requested_from,
      requestedTo: plan.requested_to,
      previousStatus: plan.status,
      outcome: result.outcome,
      statusCode: result.statusCode,
      ok: result.body.ok === true,
      externalRequest: result.body.externalRequest === true
    });
  }

  const remainingAfter = await countPendingCronPlans(supabase.client);
  const heartbeatRecorded = await recordCronHeartbeat(supabase.client, {
    processed: results.length,
    pendingBefore,
    remainingAfter,
    completed: results.filter((result) => result.outcome === "completed").length,
    failed: results.filter((result) => result.outcome === "failed").length,
    blocked: results.filter((result) => result.outcome === "blocked").length
  });

  return jsonNoStore({
    ok: true,
    externalRequest: results.some((result) => result.externalRequest),
    readOnly: true,
    processed: results.length,
    pendingBefore,
    remainingAfter,
    heartbeatRecorded,
    maxRunsPerInvocation: performanceSyncCronPolicy.maxRunsPerInvocation,
    policy: {
      scheduleUtc: performanceSyncCronPolicy.scheduleUtc,
      scheduleKst: performanceSyncCronPolicy.scheduleKst,
      targetStatuses: performanceSyncCronPolicy.targetStatuses,
      excludedStatuses: performanceSyncCronPolicy.excludedStatuses,
      excludesMasterReference: performanceSyncCronPolicy.excludesMasterReference,
      automaticRetry: false
    },
    results,
    safeguards: performanceSyncSafeguards
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

async function countPendingCronPlans(client: NonNullable<ReturnType<typeof getSupabaseAdminClient>>): Promise<number | null> {
  const { count, error } = await client
    .from(performanceSyncTableName)
    .select("id", { count: "exact", head: true })
    .in("status", [...performanceSyncCronPolicy.targetStatuses])
    .neq("scope", "masterReference");

  return error ? null : count;
}

async function recordCronHeartbeat(
  client: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  summary: {
    processed: number;
    pendingBefore: number | null;
    remainingAfter: number | null;
    completed: number;
    failed: number;
    blocked: number;
  }
): Promise<boolean> {
  try {
    const { error } = await client.from("audit_events").insert({
      event_type: "ops.performance_sync.cron_checked",
      actor: "system:cron",
      entity_type: "naver_performance_sync_run",
      entity_id: null,
      after_value: {
        ...summary,
        scheduleUtc: performanceSyncCronPolicy.scheduleUtc,
        scheduleKst: performanceSyncCronPolicy.scheduleKst,
        maxRunsPerInvocation: performanceSyncCronPolicy.maxRunsPerInvocation,
        readOnly: true,
        storedRawStats: false
      },
      reason:
        summary.processed > 0
          ? `Scheduled performance sync checked ${summary.processed} plan(s).`
          : "Scheduled performance sync checked with no eligible plans."
    });

    return !error;
  } catch {
    return false;
  }
}
