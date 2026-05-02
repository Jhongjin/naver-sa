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

export type NaverExecutionDraft = {
  generatedAt: string;
  brandName: string;
  approvedChangeCount: number;
  payloads: NaverExecutionPayload[];
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

  return {
    generatedAt: new Date().toISOString(),
    brandName: plan.input.brandName,
    approvedChangeCount: approvedIds.size,
    payloads,
    blocked: {
      liveExecution: true,
      deleteExecution: true,
      reason: "MVP only prepares approved payloads. It does not execute live Naver API mutations."
    }
  };
}

function defaultSafety() {
  return {
    liveBlocked: true,
    deleteBlocked: true,
    requiresHumanApproval: true
  } as const;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "");
}
