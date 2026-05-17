import type { NaverExecutionContext } from "@/lib/execution-draft";
import type { PlannerProductType } from "@/lib/planner";

export type ShoppingLinkageStatus = "not_applicable" | "verified" | "mismatch" | "unverified";

export type ShoppingLinkageSummary = {
  captured: boolean;
  applicable: boolean;
  status: ShoppingLinkageStatus;
  shoppingChannelId: string | null;
  productGroupId: string | null;
  productGroupBusinessChannelId: string | null;
  missingFields: string[];
  reason: string;
  capturedAt: string | null;
};

export function createShoppingLinkageSummary(input: {
  productType: PlannerProductType;
  context: NaverExecutionContext;
  capturedAt?: string;
}): ShoppingLinkageSummary {
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const shoppingChannelId = normalizeId(input.context.shoppingChannelId);
  const productGroupId = normalizeId(input.context.productGroupId);
  const productGroupBusinessChannelId = normalizeId(input.context.productGroupBusinessChannelId);

  if (input.productType !== "shoppingSearch") {
    return {
      captured: true,
      applicable: false,
      status: "not_applicable",
      shoppingChannelId: null,
      productGroupId: null,
      productGroupBusinessChannelId: null,
      missingFields: [],
      reason: "Powerlink draft does not require Shopping Search product-group linkage.",
      capturedAt
    };
  }

  const requiredFields: Array<[string, string | null]> = [
    ["shoppingChannelId", shoppingChannelId],
    ["productGroupId", productGroupId],
    ["productGroupBusinessChannelId", productGroupBusinessChannelId]
  ];
  const missingFields = requiredFields.filter(([, value]) => !value).map(([field]) => field);

  if (missingFields.length > 0) {
    return {
      captured: true,
      applicable: true,
      status: "unverified",
      shoppingChannelId,
      productGroupId,
      productGroupBusinessChannelId,
      missingFields,
      reason: "Shopping Search linkage is incomplete or was typed without scan-verified product-group channel data.",
      capturedAt
    };
  }

  if (shoppingChannelId !== productGroupBusinessChannelId) {
    return {
      captured: true,
      applicable: true,
      status: "mismatch",
      shoppingChannelId,
      productGroupId,
      productGroupBusinessChannelId,
      missingFields: [],
      reason: "Selected shopping channel does not match the product group's linked business channel.",
      capturedAt
    };
  }

  return {
    captured: true,
    applicable: true,
    status: "verified",
    shoppingChannelId,
    productGroupId,
    productGroupBusinessChannelId,
    missingFields: [],
    reason: "Selected product group is linked to the selected shopping business channel.",
    capturedAt
  };
}

export function coerceShoppingLinkageSummary(
  value: unknown,
  productType: PlannerProductType
): ShoppingLinkageSummary {
  if (!isRecord(value) || typeof value.status !== "string") {
    return {
      captured: false,
      applicable: productType === "shoppingSearch",
      status: productType === "shoppingSearch" ? "unverified" : "not_applicable",
      shoppingChannelId: null,
      productGroupId: null,
      productGroupBusinessChannelId: null,
      missingFields: [],
      reason:
        productType === "shoppingSearch"
          ? "No Shopping Search linkage snapshot was captured for this saved run."
          : "Powerlink draft does not require Shopping Search product-group linkage.",
      capturedAt: null
    };
  }

  const status = coerceStatus(value.status);

  return {
    captured: value.captured === true,
    applicable: value.applicable === true,
    status,
    shoppingChannelId: normalizeId(value.shoppingChannelId),
    productGroupId: normalizeId(value.productGroupId),
    productGroupBusinessChannelId: normalizeId(value.productGroupBusinessChannelId),
    missingFields: Array.isArray(value.missingFields)
      ? value.missingFields.filter((field): field is string => typeof field === "string").slice(0, 6)
      : [],
    reason: typeof value.reason === "string" ? value.reason.slice(0, 240) : shoppingLinkageStatusLabel(status),
    capturedAt: normalizeId(value.capturedAt)
  };
}

export function shoppingLinkageStatusLabel(status: ShoppingLinkageStatus): string {
  const labels: Record<ShoppingLinkageStatus, string> = {
    not_applicable: "연결 불필요",
    verified: "연결 확인",
    mismatch: "연결 불일치",
    unverified: "연결 미확인"
  };

  return labels[status];
}

export function shoppingLinkageStatusClass(status: ShoppingLinkageStatus): "include" | "review" | "neutral" {
  if (status === "verified") {
    return "include";
  }

  if (status === "mismatch" || status === "unverified") {
    return "review";
  }

  return "neutral";
}

function coerceStatus(value: string): ShoppingLinkageStatus {
  return value === "verified" || value === "mismatch" || value === "not_applicable" ? value : "unverified";
}

function normalizeId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 140) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
