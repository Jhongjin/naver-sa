import {
  createNaverExecutionDraft,
  type NaverExecutionPayload
} from "@/lib/execution-draft";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import { requestNaverSearchAd } from "@/lib/naver-search-ad";
import { getSupabaseAdminClient, getSupabaseAdminState } from "@/lib/supabase-admin";
import { generatePlannerPlan } from "@/lib/planner";
import {
  coerceDecisions,
  coerceExecutionContext,
  coercePlannerInput,
  isRecord,
  readJsonRecord
} from "@/lib/planner-request";

type ExecutionResponse = {
  ok: boolean;
  dryRun: boolean;
  payloadCount: number;
  executedCount: number;
  results: Array<{
    id: string;
    idempotencyKey: string;
    ok: boolean;
    status: number;
    target: string;
    naverEntityId?: string;
    error?: string;
  }>;
  history?: {
    saved: boolean;
    executionDraftId?: string;
    stagedChangeCount?: number;
    warning?: string;
  };
};

type PersistableExecutionResult = ExecutionResponse["results"][number] & {
  response?: unknown;
};

export function GET() {
  return methodNotAllowed(["POST"]);
}

export async function POST(request: Request) {
  const authResult = verifyAdminSecret(request);

  if (!authResult.ok) {
    return jsonNoStore(authResult, { status: authResult.status });
  }

  const body = await readJsonRecord(request);
  const input = coercePlannerInput(body.input);
  const decisions = coerceDecisions(body.decisions);
  const executionContext = coerceExecutionContext(body.executionContext);
  const shouldExecute = body.execute === true;
  const confirmation = typeof body.confirmation === "string" ? body.confirmation : "";
  const plan = generatePlannerPlan(input);
  const draft = createNaverExecutionDraft(plan, decisions, executionContext);

  if (!shouldExecute) {
    return jsonNoStore({
      ok: true,
      dryRun: true,
      draft
    });
  }

  if (confirmation !== "TEST_EXECUTION_ONLY") {
    return jsonNoStore(
      {
        ok: false,
        error: "Missing confirmation phrase TEST_EXECUTION_ONLY."
      },
      { status: 409 }
    );
  }

  if (draft.payloads.length === 0) {
    return jsonNoStore(
      {
        ok: false,
        error: "No approved payloads to execute."
      },
      { status: 400 }
    );
  }

  if (!draft.validation.canExecuteTest) {
    return jsonNoStore(
      {
        ok: false,
        error: "Execution draft has unresolved validation blockers.",
        validation: draft.validation
      },
      { status: 409 }
    );
  }

  const results: ExecutionResponse["results"] = [];
  const persistableResults: PersistableExecutionResult[] = [];
  const runtimeValues: RuntimeValueMap = {};

  for (const payload of draft.payloads) {
    const resolvedPayload = resolveExecutionPayload(payload, runtimeValues);

    if (resolvedPayload.unresolved.length > 0) {
      results.push({
        id: payload.id,
        idempotencyKey: payload.idempotencyKey,
        ok: false,
        status: 409,
        target: payload.target,
        error: `Unresolved runtime references: ${resolvedPayload.unresolved.join(", ")}`
      });
      persistableResults.push({
        id: payload.id,
        idempotencyKey: payload.idempotencyKey,
        ok: false,
        status: 409,
        target: payload.target,
        error: `Unresolved runtime references: ${resolvedPayload.unresolved.join(", ")}`
      });
      break;
    }

    const result = await requestNaverSearchAd<unknown>(payload.method, payload.uri, {
      query: resolvedPayload.params,
      body: resolvedPayload.body
    });

    const executionResult = {
      id: payload.id,
      idempotencyKey: payload.idempotencyKey,
      ok: result.ok,
      status: result.status,
      target: payload.target,
      naverEntityId: result.ok ? extractPrimaryEntityId(result.data) : undefined,
      error: result.ok ? undefined : result.error
    };

    results.push(executionResult);
    persistableResults.push({
      ...executionResult,
      response: result.ok ? result.data : undefined
    });

    if (!result.ok) {
      break;
    }

    runtimeValues[payload.id] = extractRuntimeValues(result.data);
  }

  const executionSucceeded = results.every((result) => result.ok);
  const history = await persistExecutionResults({
    draftKey: draft.draftKey,
    succeeded: executionSucceeded,
    results: persistableResults
  });
  const response: ExecutionResponse = {
    ok: executionSucceeded,
    dryRun: false,
    payloadCount: draft.payloads.length,
    executedCount: results.filter((result) => result.ok).length,
    results,
    history
  };

  return jsonNoStore(response, { status: response.ok ? 200 : 502 });
}

async function persistExecutionResults(input: {
  draftKey: string;
  succeeded: boolean;
  results: PersistableExecutionResult[];
}): Promise<NonNullable<ExecutionResponse["history"]>> {
  const state = getSupabaseAdminState();

  if (!state.ready) {
    return {
      saved: false,
      warning: "Supabase admin environment is not configured."
    };
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      saved: false,
      warning: "Supabase admin client is unavailable."
    };
  }

  const { data: draft, error: draftError } = await supabase
    .from("execution_drafts")
    .select("id, planning_run_id")
    .eq("draft_key", input.draftKey)
    .single();

  if (draftError || !draft) {
    return {
      saved: false,
      warning: "Execution draft history was not found. Save history before requesting protected execution."
    };
  }

  if (input.results.length > 0) {
    const { error: resultError } = await supabase.from("execution_results").insert(
      input.results.map((result) => ({
        execution_draft_id: draft.id,
        idempotency_key: result.idempotencyKey,
        payload_key: result.id,
        ok: result.ok,
        status: result.status,
        target: result.target,
        naver_entity_id: result.naverEntityId ?? null,
        error: result.error ?? null,
        response: result.response ?? {}
      }))
    );

    if (resultError) {
      return {
        saved: false,
        executionDraftId: draft.id as string,
        warning: sanitizePersistenceError(resultError.message)
      };
    }
  }

  const executedAt = new Date().toISOString();
  const { data: stagedChanges, error: stagedChangeError } = await supabase
    .from("staged_changes")
    .update({
      decision: input.succeeded ? "executed" : "failed",
      executed_at: executedAt
    })
    .eq("planning_run_id", draft.planning_run_id)
    .eq("decision", "approved")
    .select("id");
  const stagedChangeCount = stagedChanges?.length ?? 0;

  await supabase
    .from("execution_drafts")
    .update({
      status: input.succeeded ? "executed" : "failed"
    })
    .eq("id", draft.id);

  await supabase.from("audit_events").insert({
    planning_run_id: draft.planning_run_id,
    event_type: input.succeeded ? "execution_draft.executed" : "execution_draft.failed",
    entity_type: "execution_draft",
    entity_id: draft.id,
    after_value: {
      resultCount: input.results.length,
      stagedChangeCount,
      ok: input.succeeded
    },
    reason: "Protected test execution result was recorded."
  });

  return {
    saved: true,
    executionDraftId: draft.id as string,
    stagedChangeCount,
    warning: stagedChangeError ? sanitizePersistenceError(stagedChangeError.message) : undefined
  };
}

function verifyAdminSecret(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const configuredSecret = process.env.CRON_SECRET;

  if (!configuredSecret) {
    return {
      ok: false,
      status: 503,
      error: "Execution route is disabled because CRON_SECRET is not configured."
    };
  }

  const providedSecret = request.headers.get("x-admin-secret");

  if (providedSecret !== configuredSecret) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized."
    };
  }

  return {
    ok: true
  };
}

type RuntimeValueMap = Record<string, Record<string, string>>;

function resolveExecutionPayload(payload: NaverExecutionPayload, runtimeValues: RuntimeValueMap) {
  const bodyResult = resolveRuntimeRefs(payload.body, runtimeValues);
  const paramsResult = resolveRuntimeRefs(payload.params, runtimeValues);

  return {
    body: bodyResult.value,
    params: isRecord(paramsResult.value) ? (paramsResult.value as Record<string, string>) : undefined,
    unresolved: [...bodyResult.unresolved, ...paramsResult.unresolved]
  };
}

function resolveRuntimeRefs(value: unknown, runtimeValues: RuntimeValueMap): { value: unknown; unresolved: string[] } {
  if (typeof value === "string") {
    const match = value.match(/^\{\{([^{}]+)\.([^{}]+)\}\}$/);

    if (!match) {
      return {
        value,
        unresolved: []
      };
    }

    const [, payloadId, field] = match;
    const resolved = runtimeValues[payloadId]?.[field];

    return resolved
      ? {
          value: resolved,
          unresolved: []
        }
      : {
          value,
          unresolved: [`${payloadId}.${field}`]
        };
  }

  if (Array.isArray(value)) {
    const results = value.map((item) => resolveRuntimeRefs(item, runtimeValues));
    return {
      value: results.map((result) => result.value),
      unresolved: results.flatMap((result) => result.unresolved)
    };
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).map(([key, item]) => {
      const result = resolveRuntimeRefs(item, runtimeValues);
      return [key, result.value, result.unresolved] as const;
    });

    return {
      value: Object.fromEntries(entries.map(([key, item]) => [key, item])),
      unresolved: entries.flatMap(([, , unresolved]) => unresolved)
    };
  }

  return {
    value,
    unresolved: []
  };
}

function extractRuntimeValues(data: unknown): Record<string, string> {
  const source = Array.isArray(data) ? data[0] : data;

  if (!isRecord(source)) {
    return {};
  }

  const values: Record<string, string> = {};

  for (const field of ["nccCampaignId", "nccAdgroupId", "nccKeywordId", "nccAdId"]) {
    const value = source[field];

    if (typeof value === "string") {
      values[field] = value;
    }
  }

  return values;
}

function extractPrimaryEntityId(data: unknown): string | undefined {
  const values = extractRuntimeValues(data);
  return values.nccCampaignId ?? values.nccAdgroupId ?? values.nccKeywordId ?? values.nccAdId;
}

function sanitizePersistenceError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
    .replace(/apikey[=:]\s*[^,\s}]+/gi, "apikey=[REDACTED]")
    .slice(0, 220);
}
