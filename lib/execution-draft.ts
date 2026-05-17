import type { PlannerPlan } from "@/lib/planner";
import type { ApprovalDecisionMap } from "@/lib/reporting";

export type NaverExecutionPayload = {
  id: string;
  idempotencyKey: string;
  method: "POST" | "PUT";
  uri: string;
  entityType: string;
  target: string;
  params?: Record<string, string>;
  body: unknown;
  safety: {
    liveBlocked: true;
    deleteBlocked: true;
    requiresHumanApproval: true;
  };
};

export type NaverExecutionContext = {
  campaignId?: string;
  pcChannelId?: string;
  mobileChannelId?: string;
  shoppingChannelId?: string;
  productGroupId?: string;
  productGroupBusinessChannelId?: string;
  adgroupIdsByName?: Record<string, string>;
};

export type NaverExecutionBlocker = {
  code: string;
  payloadId?: string;
  message: string;
};

export type NaverExecutionWarning = {
  code: string;
  payloadId?: string;
  message: string;
};

export type NaverExecutionValidation = {
  canExecuteTest: boolean;
  blockerCount: number;
  warningCount: number;
  blockers: NaverExecutionBlocker[];
  warnings: NaverExecutionWarning[];
  requiredConfirmation: "TEST_EXECUTION_ONLY";
};

export type NaverExecutionDraft = {
  draftId: string;
  draftKey: string;
  generatedAt: string;
  brandName: string;
  approvedChangeCount: number;
  payloads: NaverExecutionPayload[];
  validation: NaverExecutionValidation;
  blocked: {
    liveExecution: true;
    deleteExecution: true;
    reason: string;
  };
};

export function createNaverExecutionDraft(
  plan: PlannerPlan,
  decisions: ApprovalDecisionMap,
  context: NaverExecutionContext = {}
): NaverExecutionDraft {
  const isShoppingSearch = plan.input.productType === "shoppingSearch";
  const productLabel = isShoppingSearch ? "쇼핑검색" : "파워링크";
  const approvedIds = new Set(
    plan.stagedChanges.filter((change) => decisions[change.id] === "approved").map((change) => change.id)
  );
  const payloads: NaverExecutionPayload[] = [];
  const shouldCreateCampaign = approvedIds.has("campaign-create-draft");

  if (shouldCreateCampaign) {
    payloads.push(withIdempotency(plan, {
      id: "campaign-create",
      method: "POST",
      uri: "/ncc/campaigns",
      entityType: "Campaign",
      target: `${plan.input.brandName} ${productLabel} 테스트`,
      body: {
        name: `${plan.input.brandName} ${productLabel} 테스트`,
        campaignTp: isShoppingSearch ? "SHOPPING" : "WEB_SITE",
        userLock: true,
        useDailyBudget: true,
        dailyBudget: plan.forecast.dailyBudget
      },
      safety: defaultSafety()
    }));
  }

  for (const group of plan.adGroups) {
    const adgroupPayloadId = createAdgroupPayloadId(group.name);

    if (!approvedIds.has(adgroupPayloadId)) {
      continue;
    }

    payloads.push(withIdempotency(plan, {
      id: adgroupPayloadId,
      method: "POST",
      uri: "/ncc/adgroups",
      entityType: isShoppingSearch ? "Shopping Ad Group" : "Ad Group",
      target: group.name,
      body: isShoppingSearch
        ? {
            name: group.name,
            nccCampaignId:
              context.campaignId ?? (shouldCreateCampaign ? runtimeRef("campaign-create", "nccCampaignId") : "PENDING_CAMPAIGN_ID"),
            adgroupType: "SHOPPING",
            userLock: true,
            useDailyBudget: true,
            dailyBudget: group.dailyBudget,
            bidAmt: group.avgBid,
            nccBusinessChannelId: context.shoppingChannelId ?? "PENDING_SHOPPING_CHANNEL_ID",
            nccProductGroupId: context.productGroupId ?? "PENDING_PRODUCT_GROUP_ID"
          }
        : {
            name: group.name,
            nccCampaignId:
              context.campaignId ?? (shouldCreateCampaign ? runtimeRef("campaign-create", "nccCampaignId") : "PENDING_CAMPAIGN_ID"),
            userLock: true,
            useDailyBudget: true,
            dailyBudget: group.dailyBudget,
            bidAmt: group.avgBid,
            pcChannelId: context.pcChannelId ?? "PENDING_PC_CHANNEL_ID",
            mobileChannelId: context.mobileChannelId ?? context.pcChannelId ?? "PENDING_MOBILE_CHANNEL_ID"
          },
      safety: defaultSafety()
    }));
  }

  if (!isShoppingSearch && approvedIds.has("keyword-bulk-create")) {
    for (const group of plan.adGroups) {
      const keywordBody = plan.keywords
        .filter((keyword) => keyword.status === "include" && keyword.group === group.name)
        .map((keyword) => ({
          keyword: keyword.term,
          bidAmt: keyword.bid,
          useGroupBidAmt: false,
          userLock: true
        }));

      if (keywordBody.length === 0) {
        continue;
      }

      payloads.push(withIdempotency(plan, {
        id: `keywords-${slugify(group.name)}`,
        method: "POST",
        uri: "/ncc/keywords",
        entityType: "Keyword",
        target: `${group.name} ${keywordBody.length} keywords`,
        params: {
          nccAdgroupId: resolveAdgroupReference(group.name, approvedIds, context)
        },
        body: keywordBody,
        safety: defaultSafety()
      }));
    }
  }

  if (!isShoppingSearch && approvedIds.has("copy-draft-create")) {
    for (const group of plan.adGroups) {
      payloads.push(withIdempotency(plan, {
        id: `ad-copy-${slugify(group.name)}`,
        method: "POST",
        uri: "/ncc/ads",
        entityType: "Ad Copy",
        target: `${group.name} 광고 소재`,
        body: group.sampleAds.map((ad) => ({
          nccAdgroupId: resolveAdgroupReference(group.name, approvedIds, context),
          type: "TEXT_45",
          headline: ad.headline,
          description: ad.description,
          finalUrl: plan.input.siteUrl,
          userLock: true
        })),
        safety: defaultSafety()
      }));
    }
  }

  const validation = validateNaverExecutionPayloads(payloads, {
    productType: plan.input.productType,
    context
  });

  const generatedAt = new Date().toISOString();

  return {
    draftId: createDraftId(plan.input.brandName, payloads, generatedAt),
    draftKey: createDraftKey(plan, payloads),
    generatedAt,
    brandName: plan.input.brandName,
    approvedChangeCount: approvedIds.size,
    payloads,
    validation,
    blocked: {
      liveExecution: true,
      deleteExecution: true,
      reason: "MVP only prepares approved payloads. It does not execute live Naver API mutations."
    }
  };
}

function withIdempotency(
  plan: PlannerPlan,
  payload: Omit<NaverExecutionPayload, "idempotencyKey">
): NaverExecutionPayload {
  return {
    ...payload,
    idempotencyKey: createPayloadIdempotencyKey(plan, payload)
  };
}

export function validateNaverExecutionPayloads(
  payloads: NaverExecutionPayload[],
  options: {
    productType?: PlannerPlan["input"]["productType"];
    context?: NaverExecutionContext;
  } = {}
): NaverExecutionValidation {
  const blockers: NaverExecutionBlocker[] = [];
  const warnings: NaverExecutionWarning[] = [];

  if (payloads.length === 0) {
    blockers.push({
      code: "NO_APPROVED_PAYLOADS",
      message: "No approved staged changes were selected."
    });
  }

  for (const payload of payloads) {
    if (payload.method !== "POST" && payload.method !== "PUT") {
      blockers.push({
        code: "UNSAFE_METHOD",
        payloadId: payload.id,
        message: "Only POST and PUT are allowed in MVP test execution."
      });
    }

    if (!payload.safety.liveBlocked || !payload.safety.deleteBlocked || !payload.safety.requiresHumanApproval) {
      blockers.push({
        code: "SAFETY_FLAGS_MISSING",
        payloadId: payload.id,
        message: "Required safety flags are missing from the payload."
      });
    }

    if (containsPendingPlaceholder(payload.body) || containsPendingPlaceholder(payload.params)) {
      blockers.push({
        code: "PENDING_NAVER_ID",
        payloadId: payload.id,
        message: "Naver channel, ad group, or entity IDs must be resolved before execution."
      });
    }

    if (containsUserLockFalse(payload.body)) {
      blockers.push({
        code: "LIVE_UNLOCKED",
        payloadId: payload.id,
        message: "Payload must keep userLock enabled so created entities stay paused/off."
      });
    }

    if (containsHighDailyBudget(payload.body)) {
      warnings.push({
        code: "HIGH_TEST_DAILY_BUDGET",
        payloadId: payload.id,
        message: "Daily budget is above the MVP test-budget review threshold."
      });
    }
  }

  if (options.productType === "shoppingSearch" && payloads.some((payload) => payload.entityType === "Shopping Ad Group")) {
    const shoppingChannelId = options.context?.shoppingChannelId;
    const productGroupId = options.context?.productGroupId;
    const productGroupBusinessChannelId = options.context?.productGroupBusinessChannelId;

    if (shoppingChannelId && productGroupId && productGroupBusinessChannelId && shoppingChannelId !== productGroupBusinessChannelId) {
      blockers.push({
        code: "SHOPPING_PRODUCT_GROUP_CHANNEL_MISMATCH",
        message: "Selected shopping channel does not match the product group's business channel."
      });
    }

    if (shoppingChannelId && productGroupId && !productGroupBusinessChannelId) {
      warnings.push({
        code: "SHOPPING_PRODUCT_GROUP_LINK_UNVERIFIED",
        message: "Apply the product group from the latest account scan to verify its shopping channel linkage."
      });
    }
  }

  return {
    canExecuteTest: blockers.length === 0,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    blockers,
    warnings,
    requiredConfirmation: "TEST_EXECUTION_ONLY"
  };
}

function defaultSafety() {
  return {
    liveBlocked: true,
    deleteBlocked: true,
    requiresHumanApproval: true
  } as const;
}

function resolveAdgroupReference(
  groupName: string,
  approvedIds: Set<string>,
  context: NaverExecutionContext
): string {
  const existingAdgroupId = context.adgroupIdsByName?.[groupName];

  if (existingAdgroupId) {
    return existingAdgroupId;
  }

  const adgroupPayloadId = createAdgroupPayloadId(groupName);

  return approvedIds.has(adgroupPayloadId) ? runtimeRef(adgroupPayloadId, "nccAdgroupId") : "PENDING_ADGROUP_ID";
}

function createAdgroupPayloadId(groupName: string): string {
  return `adgroup-${slugify(groupName)}`;
}

export function runtimeRef(payloadId: string, field: string): string {
  return `{{${payloadId}.${field}}}`;
}

function createDraftId(brandName: string, payloads: NaverExecutionPayload[], generatedAt: string): string {
  const fingerprint = [brandName, generatedAt, ...payloads.map((payload) => `${payload.id}:${payload.method}:${payload.uri}`)].join("|");
  return `draft_${generatedAt.replace(/[-:.TZ]/g, "").slice(0, 14)}_${stableHash(fingerprint).toString(36)}`;
}

function createDraftKey(plan: PlannerPlan, payloads: NaverExecutionPayload[]): string {
  const fingerprint = [
    plan.input.productType,
    plan.input.brandName,
    plan.input.siteUrl,
    plan.input.vertical,
    plan.input.monthlyBudget,
    plan.input.maxBid,
    ...plan.input.seedKeywords,
    ...payloads.map((payload) => `${payload.id}:${payload.idempotencyKey}`)
  ].join("|");

  return `draftkey_${stableHash(fingerprint).toString(36)}`;
}

function createPayloadIdempotencyKey(
  plan: PlannerPlan,
  payload: Omit<NaverExecutionPayload, "idempotencyKey">
): string {
  const fingerprint = JSON.stringify({
    productType: plan.input.productType,
    brandName: plan.input.brandName,
    siteUrl: plan.input.siteUrl,
    payloadId: payload.id,
    method: payload.method,
    uri: payload.uri,
    target: payload.target,
    params: payload.params,
    body: payload.body
  });

  return `naver_sa_${stableHash(fingerprint).toString(36)}`;
}

function containsPendingPlaceholder(value: unknown): boolean {
  return findInPayload(value, (item) => typeof item === "string" && item.includes("PENDING_"));
}

function containsUserLockFalse(value: unknown): boolean {
  return findInPayload(value, (item, key) => key === "userLock" && item === false);
}

function containsHighDailyBudget(value: unknown): boolean {
  return findInPayload(value, (item, key) => key === "dailyBudget" && typeof item === "number" && item > 100000);
}

function findInPayload(value: unknown, predicate: (item: unknown, key?: string) => boolean): boolean {
  if (predicate(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item) => findInPayload(item, predicate));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, item]) => predicate(item, key) || findInPayload(item, predicate));
  }

  return false;
}

function stableHash(value: string): number {
  return Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 11);
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "");
}
