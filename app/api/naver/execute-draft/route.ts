import { NextResponse } from "next/server";
import { createNaverExecutionDraft } from "@/lib/execution-draft";
import { requestNaverSearchAd } from "@/lib/naver-search-ad";
import { generatePlannerPlan, mardDefaultInput, type PlannerInput, type PlannerMode } from "@/lib/planner";
import type { ApprovalDecision, ApprovalDecisionMap } from "@/lib/reporting";

type ExecutionResponse = {
  ok: boolean;
  dryRun: boolean;
  payloadCount: number;
  executedCount: number;
  results: Array<{
    id: string;
    ok: boolean;
    status: number;
    target: string;
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
  const shouldExecute = body.execute === true;
  const confirmation = typeof body.confirmation === "string" ? body.confirmation : "";
  const plan = generatePlannerPlan(input);
  const draft = createNaverExecutionDraft(plan, decisions);

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

  const results: ExecutionResponse["results"] = [];

  for (const payload of draft.payloads) {
    const result = await requestNaverSearchAd<unknown>(payload.method, payload.uri, {
      query: payload.params,
      body: payload.body
    });

    results.push({
      id: payload.id,
      ok: result.ok,
      status: result.status,
      target: payload.target,
      error: result.ok ? undefined : result.error
    });

    if (!result.ok) {
      break;
    }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  if (typeof value === "number") {
    return value;
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

function stringArrayValue(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value.filter((item): item is string => typeof item === "string");
}
