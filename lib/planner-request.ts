import type { NaverExecutionContext } from "@/lib/execution-draft";
import { mardDefaultInput, type PlannerInput, type PlannerMode, type PlannerProductType } from "@/lib/planner";
import type { ApprovalDecision, ApprovalDecisionMap, ApprovalDecisionNoteMap } from "@/lib/reporting";

export async function readJsonRecord(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = (await request.json()) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function coercePlannerInput(value: unknown): PlannerInput {
  const body = isRecord(value) ? value : {};

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

export function coerceDecisions(value: unknown): ApprovalDecisionMap {
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

export function coerceDecisionNotes(value: unknown): ApprovalDecisionNoteMap {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, note]) => [key, typeof note === "string" ? normalizeNote(note) : ""] as const)
      .filter((entry): entry is [string, string] => entry[1].length > 0)
  );
}

export function coerceExecutionContext(value: unknown): NaverExecutionContext {
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function stringValueOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeNote(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 240);
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
