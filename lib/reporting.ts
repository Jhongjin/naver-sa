import type { PlannerPlan, StagedChange } from "@/lib/planner";

export type ApprovalDecision = "pending" | "approved" | "held";

export type ApprovalDecisionMap = Record<string, ApprovalDecision>;

export type ApprovalSummary = {
  pending: number;
  approved: number;
  held: number;
};

export function summarizeApprovals(changes: StagedChange[], decisions: ApprovalDecisionMap): ApprovalSummary {
  return changes.reduce(
    (summary, change) => {
      const decision = decisions[change.id] ?? "pending";
      summary[decision] += 1;
      return summary;
    },
    { pending: 0, approved: 0, held: 0 }
  );
}

export function createApprovalCsv(plan: PlannerPlan, decisions: ApprovalDecisionMap): string {
  const header = ["id", "type", "target", "action", "risk", "approval", "decision", "details"];
  const rows = plan.stagedChanges.map((change) => [
    change.id,
    change.type,
    change.target,
    change.action,
    change.risk,
    change.approval,
    decisions[change.id] ?? "pending",
    change.details
  ]);

  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

export function createPlannerReport(plan: PlannerPlan, decisions: ApprovalDecisionMap): string {
  const approvalSummary = summarizeApprovals(plan.stagedChanges, decisions);

  return [
    `# ${plan.input.brandName} Naver SA Setup Report`,
    "",
    "## Summary",
    "",
    `- Product: ${plan.input.productType === "shoppingSearch" ? "Shopping Search Ads" : "Powerlink / Site Search Ads"}`,
    `- Site: ${plan.input.siteUrl}`,
    `- Vertical: ${plan.input.vertical}`,
    `- Monthly test budget: ${formatWon(plan.forecast.monthlyBudget)}`,
    `- Daily budget guide: ${formatWon(plan.forecast.dailyBudget)}`,
    `- Included keywords: ${plan.forecast.includedKeywords}`,
    `- Review keywords: ${plan.forecast.reviewKeywords}`,
    `- Excluded keywords: ${plan.forecast.excludedKeywords}`,
    `- Ad groups: ${plan.forecast.adGroupCount}`,
    `- Expected clicks: ${formatNumber(plan.forecast.expectedClicks)}`,
    `- Average CPC: ${formatWon(plan.forecast.avgCpc)}`,
    "",
    "## Approval Queue",
    "",
    `- Approved: ${approvalSummary.approved}`,
    `- Held: ${approvalSummary.held}`,
    `- Pending: ${approvalSummary.pending}`,
    "",
    ...plan.stagedChanges.flatMap((change) => [
      `### ${change.target}`,
      "",
      `- Type: ${change.type}`,
      `- Action: ${change.action}`,
      `- Risk: ${change.risk}`,
      `- Decision: ${decisions[change.id] ?? "pending"}`,
      `- Details: ${change.details}`,
      ""
    ]),
    "## Negative Keywords",
    "",
    ...plan.negativeKeywords.map((keyword) => `- ${keyword}`),
    "",
    "## Industry Template",
    "",
    `- Template: ${plan.industryTemplate.name}`,
    ...plan.industryTemplate.landingChecks.map((item) => `- Landing check: ${item}`),
    ...plan.industryTemplate.copyRules.map((item) => `- Copy rule: ${item}`),
    ...(plan.productGroups.length > 0
      ? [
          "",
          "## Shopping Product Groups",
          "",
          ...plan.productGroups.flatMap((group) => [
            `### ${group.name}`,
            "",
            `- Source group: ${group.sourceGroup}`,
            `- Query count: ${group.queryCount}`,
            `- Product hints: ${group.productHints.join(", ")}`,
            ...group.feedActions.map((action) => `- Feed action: ${action}`),
            ""
          ])
        ]
      : []),
    "",
    "## Assumptions",
    "",
    ...plan.assumptions.map((assumption) => `- ${assumption}`)
  ].join("\n");
}

function escapeCsvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatWon(value: number): string {
  return `${formatNumber(value)}원`;
}
