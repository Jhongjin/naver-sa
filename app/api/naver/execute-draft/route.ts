import { NextResponse } from "next/server";
import {
  createNaverExecutionDraft,
  type NaverExecutionContext,
  type NaverExecutionPayload
} from "@/lib/execution-draft";
import { requestNaverSearchAd } from "@/lib/naver-search-ad";
import {
  generatePlannerPlan,
  mardDefaultInput,
  type PlannerInput,
  type PlannerMode,
  type PlannerProductType
} from "@/lib/planner";
import type { ApprovalDecision, ApprovalDecisionMap } from "@/lib/reporting";

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
};

export async function POST(request: Request) {
  const authResult = verifyAdminSecret(request);

  if (!authResult.ok) {
    return NextResponse.json(authResult, { status: authResult.status });
  }

  const body = await readJson(request);
  const input = coercePlannerInput(isRecord(body.input) ? body.input : {});
  const decisions = coerceDecisions(body.decisions);
  const executionContext = coerceExecutionContext(body.executionContext);
  const shouldExecute = body.execute === true;
  const confirmation = typeof body.confirmation === "string" ? body.confirmation : "";
  const plan = generatePlannerPlan(input);
  const draft = createNaverExecutionDraft(plan, decisions, executionContext);

  if (!shouldExecute) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      draft
    });
  }

  if (confirmation !== "TEST_EXECUTION_ONLY") {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing confirmation phrase TEST_EXECUTION_ONLY."
      },
      { status: 409 }
    );
  }

  if (draft.payloads.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "No approved payloads to execute."
      },
      { status: 400 }
    );
  }

  if (!draft.validation.canExecuteTest) {
    return NextResponse.json(
      {
        ok: false,
        error: "Execution draft has unresolved validation blockers.",
        validation: draft.validation
      },
      { status: 409 }
    );
  }

  const results: ExecutionResponse["results"] = [];
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
      break;
    }

    const result = await requestNaverSearchAd<unknown>(payload.method, payload.uri, {
      query: resolvedPayload.params,
      body: resolvedPayload.body
    });

    results.push({
      id: payload.id,
      idempotencyKey: payload.idempotencyKey,
      ok: result.ok,
      status: result.status,
      target: payload.target,
      naverEntityId: result.ok ? extractPrimaryEntityId(result.data) : undefined,
      error: result.ok ? undefined : result.error
    });

    if (!result.ok) {
      break;
    }

    runtimeValues[payload.id] = extractRuntimeValues(result.data);
  }

  const response: ExecutionResponse = {
    ok: results.every((result) => result.ok),
    dryRun: false,
    payloadCount: draft.payloads.length,
    executedCount: results.filter((result) => result.ok).length,
    results
  };

  return NextResponse.json(response, { status: response.ok ? 200 : 502 });
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

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = (await request.json()) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function coercePlannerInput(body: Record<string, unknown>): PlannerInput {
  return {
    brandName: stringValue(body.brandName, mardDefaultInput.brandName),
    siteUrl: stringValue(body.siteUrl, mardDefaultInput.siteUrl),
    vertical: stringValue(body.vertical, mardDefaultInput.vertical),
    monthlyBudget: numberValue(body.monthlyBudget, mardDefaultInput.monthlyBudget),
    maxBid: numberValue(body.maxBid, mardDefaultInput.maxBid),
    mode: plannerModeValue(body.mode, mardDefaultInput.mode),
    productType: plannerProductTypeValue(body.productType, mardDefaultInput.productType),
    seedKeywords: stringArrayValue(body.seedKeywords, mardDefaultInput.seedKeywords)
  };
}

function coerceDecisions(value: unknown): ApprovalDecisionMap {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, ApprovalDecision] => {
      const decision = entry[1];
      return decision === "pending" || decision === "approved" || decision === "held";
    })
  );
}

function coerceExecutionContext(value: unknown): NaverExecutionContext {
  if (!isRecord(value)) {
    return {};
  }

  return {
    campaignId: stringValueOrUndefined(value.campaignId),
    pcChannelId: stringValueOrUndefined(value.pcChannelId),
    mobileChannelId: stringValueOrUndefined(value.mobileChannelId),
    shoppingChannelId: stringValueOrUndefined(value.shoppingChannelId),
    productGroupId: stringValueOrUndefined(value.productGroupId),
    adgroupIdsByName: recordStringValue(value.adgroupIdsByName)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function stringValueOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown, fallback: number): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function plannerModeValue(value: unknown, fallback: PlannerMode): PlannerMode {
  return value === "agency" || value === "advertiser" ? value : fallback;
}

function plannerProductTypeValue(value: unknown, fallback: PlannerProductType): PlannerProductType {
  return value === "shoppingSearch" || value === "powerlink" ? value : fallback;
}

function stringArrayValue(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value.filter((item): item is string => typeof item === "string");
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

function recordStringValue(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter((entry): entry is [string, string] => {
    return typeof entry[1] === "string" && entry[1].trim().length > 0;
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
