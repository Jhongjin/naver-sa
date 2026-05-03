import { NextResponse } from "next/server";
import { createNaverExecutionDraft } from "@/lib/execution-draft";
import { getNaverConfigState } from "@/lib/naver-search-ad";
import { generatePlannerPlan, mardDefaultInput, type PlannerInput, type PlannerMode } from "@/lib/planner";
import { summarizeApprovals, type ApprovalDecision, type ApprovalDecisionMap } from "@/lib/reporting";

export async function POST(request: Request) {
  const body = await readJson(request);
  const input = coercePlannerInput(isRecord(body.input) ? body.input : {});
  const decisions = coerceDecisions(body.decisions);
  const plan = generatePlannerPlan(input);
  const draft = createNaverExecutionDraft(plan, decisions);
  const naverState = getNaverConfigState();
  const approvalSummary = summarizeApprovals(plan.stagedChanges, decisions);

  return NextResponse.json({
    ok: true,
    dryRun: true,
    externalRequest: false,
    automationLevel: "Level 2 Staged Changes",
    naver: {
      ready: naverState.ready,
      missing: naverState.missing,
      baseUrl: naverState.baseUrl,
      customerIdPresent: naverState.customerIdPresent
    },
    approvalSummary,
    draft,
    nextAction: draft.validation.canExecuteTest
      ? "Protected test execution may be requested with a separate admin secret and confirmation phrase."
      : "Resolve validation blockers before requesting protected test execution."
  });
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
