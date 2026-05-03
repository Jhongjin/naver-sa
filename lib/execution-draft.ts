import type { PlannerPlan } from "@/lib/planner";
import type { ApprovalDecisionMap } from "@/lib/reporting";

export type NaverExecutionPayload = {
  id: string;
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

export function createNaverExecutionDraft(plan: PlannerPlan, decisions: ApprovalDecisionMap): NaverExecutionDraft {
  const approvedIds = new Set(
    plan.stagedChanges.filter((change) => decisions[change.id] === "approved").map((change) => change.id)
  );
  const payloads: NaverExecutionPayload[] = [];

  if (approvedIds.has("campaign-create-draft")) {
    payloads.push({
      id: "campaign-create",
      method: "POST",
      uri: "/ncc/campaigns",
      entityType: "Campaign",
      target: `${plan.input.brandName} 파워링크 테스트`,
      body: {
        name: `${plan.input.brandName} 파워링크 테스트`,
        campaignTp: "WEB_SITE",
        userLock: true,
        useDailyBudget: true,
        dailyBudget: plan.forecast.dailyBudget
      },
      safety: defaultSafety()
    });
  }

  for (const group of plan.adGroups) {
    if (!approvedIds.has(`adgroup-${slugify(group.name)}`)) {
      continue;
    }

    payloads.push({
      id: `adgroup-${slugify(group.name)}`,
      method: "POST",
      uri: "/ncc/adgroups",
      entityType: "Ad Group",
      target: group.name,
      body: {
        name: group.name,
        userLock: true,
        useDailyBudget: true,
        dailyBudget: group.dailyBudget,
        bidAmt: group.avgBid,
        pcChannelId: "PENDING_CHANNEL_ID",
        mobileChannelId: "PENDING_CHANNEL_ID"
      },
      safety: defaultSafety()
    });
  }

  if (approvedIds.has("keyword-bulk-create")) {
    const keywordBody = plan.keywords
      .filter((keyword) => keyword.status === "include")
      .map((keyword) => ({
        keyword: keyword.term,
        bidAmt: keyword.bid,
        useGroupBidAmt: false,
        userLock: true
      }));

    payloads.push({
      id: "keyword-bulk-create",
      method: "POST",
      uri: "/ncc/keywords",
      entityType: "Keyword",
      target: `${keywordBody.length} keywords`,
      params: {
        nccAdgroupId: "PENDING_ADGROUP_ID"
      },
      body: keywordBody,
      safety: defaultSafety()
    });
  }

  if (approvedIds.has("copy-draft-create")) {
    payloads.push({
      id: "ad-copy-create",
      method: "POST",
      uri: "/ncc/ads",
      entityType: "Ad Copy",
      target: "광고 소재",
      body: plan.adGroups.flatMap((group) =>
        group.sampleAds.map((ad) => ({
          nccAdgroupId: "PENDING_ADGROUP_ID",
          type: "TEXT_45",
          headline: ad.headline,
          description: ad.description,
          finalUrl: plan.input.siteUrl,
          userLock: true
        }))
      ),
      safety: defaultSafety()
    });
  }

  const validation = validateNaverExecutionPayloads(payloads);
  const generatedAt = new Date().toISOString();

  return {
    draftId: createDraftId(plan.input.brandName, payloads, generatedAt),
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

export function validateNaverExecutionPayloads(payloads: NaverExecutionPayload[]): NaverExecutionValidation {
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

function createDraftId(brandName: string, payloads: NaverExecutionPayload[], generatedAt: string): string {
  const fingerprint = [brandName, generatedAt, ...payloads.map((payload) => `${payload.id}:${payload.method}:${payload.uri}`)].join("|");
  return `draft_${generatedAt.replace(/[-:.TZ]/g, "").slice(0, 14)}_${stableHash(fingerprint).toString(36)}`;
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
