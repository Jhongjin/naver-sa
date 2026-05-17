import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import { performanceSyncTableName } from "@/lib/naver-performance-sync";
import {
  isMissingPerformanceSyncTableError,
  runPerformanceSyncPlan,
  sanitizePerformanceSyncError,
  type PerformanceSyncPlanRunRow
} from "@/lib/performance-sync-runner";
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

  const plan = data as PerformanceSyncPlanRunRow | null;

  if (!plan) {
    return jsonNoStore({ ok: false, externalRequest: false, error: "Performance sync plan was not found." }, { status: 404 });
  }

  const result = await runPerformanceSyncPlan({
    supabase: supabase.client,
    plan,
    actor: access.user.email ?? access.user.id,
    source: "manual",
    allowedStatuses: ["planned", "ready", "failed"]
  });

  return jsonNoStore(result.body, { status: result.statusCode });
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
}
