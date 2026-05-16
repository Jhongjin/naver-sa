import { NextResponse } from "next/server";
import { createNaverExecutionDraft, type NaverExecutionContext } from "@/lib/execution-draft";
import { getNaverConfigState } from "@/lib/naver-search-ad";
import { verifyUserAccess } from "@/lib/auth-access";
import {
  generatePlannerPlan,
  mardDefaultInput,
  type PlannerInput,
  type PlannerMode,
  type PlannerProductType
} from "@/lib/planner";
import { summarizeApprovals, type ApprovalDecision, type ApprovalDecisionMap } from "@/lib/reporting";

export async function POST(request: Request) {
  const access = await verifyUserAccess(request);

  if (!access.ok) {
    return NextResponse.json(access, { status: access.status });
  }

  const body = await readJson(request);
  const input = coercePlannerInput(isRecord(body.input) ? body.input : {});
  const decisions = coerceDecisions(body.decisions);
  const executionContext = coerceExecutionContext(body.executionContext);
  const plan = generatePlannerPlan(input);
  const draft = createNaverExecutionDraft(plan, decisions, executionContext);
  const naverState = getNaverConfigState();
  const approvalSummary = summarizeApprovals(plan.stagedChanges, decisions);

  return NextResponse.json({
    ok: true,
    dryRun: true,
    externalRequest: false,
    automationLevel: "Level 2 Staged Changes",
    authAccess: access.state,
    naver: {
      ready: naverState.ready,
      missingCount: naverState.missing.length,
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

function recordStringValue(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter((entry): entry is [string, string] => {
    return typeof entry[1] === "string" && entry[1].trim().length > 0;
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
