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

export function createPlannerExcelReport(plan: PlannerPlan, decisions: ApprovalDecisionMap): string {
  const approvalSummary = summarizeApprovals(plan.stagedChanges, decisions);
  const productLabel = plan.input.productType === "shoppingSearch" ? "Shopping Search Ads" : "Powerlink / Site Search Ads";
  const approvedRows = plan.stagedChanges.map((change) => [
    decisions[change.id] ?? "pending",
    change.type,
    change.target,
    change.action,
    change.risk,
    change.details
  ]);
  const keywordRows = plan.keywords.map((keyword) => [
    keyword.term,
    keyword.group,
    keyword.intent,
    keyword.statusLabel,
    keyword.bid,
    keyword.expectedClicks,
    keyword.reason
  ]);
  const adGroupRows = plan.adGroups.map((group) => [
    group.name,
    group.description,
    group.keywordCount,
    group.dailyBudget,
    group.avgBid,
    group.expectedClicks,
    group.sampleAds.map((copy) => copy.headline).join(" / "),
    group.sampleAds.map((copy) => copy.description).join(" / ")
  ]);
  const productGroupRows = plan.productGroups.map((group) => [
    group.name,
    group.sourceGroup,
    group.queryCount,
    group.productHints.join(", "),
    group.feedActions.join(" / ")
  ]);

  return [
    "\ufeff<!doctype html>",
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">',
    "<head>",
    '<meta charset="utf-8" />',
    "<style>",
    "body{font-family:Arial,'Malgun Gothic',sans-serif;color:#111827;}",
    "h1{font-size:22px;margin:0 0 16px;} h2{font-size:16px;margin:24px 0 8px;}",
    "table{border-collapse:collapse;margin-bottom:14px;} th,td{border:1px solid #d9e1e8;padding:7px 9px;vertical-align:top;}",
    "th{background:#eef2f7;font-weight:700;} .num{text-align:right;} .muted{color:#64748b;}",
    "</style>",
    "</head>",
    "<body>",
    `<h1>${escapeHtml(plan.input.brandName)} Naver SA Setup Report</h1>`,
    createHtmlTable("Summary", ["Metric", "Value"], [
      ["Product", productLabel],
      ["Site", plan.input.siteUrl],
      ["Vertical", plan.input.vertical],
      ["Monthly test budget", formatWon(plan.forecast.monthlyBudget)],
      ["Daily budget guide", formatWon(plan.forecast.dailyBudget)],
      ["Included keywords", plan.forecast.includedKeywords],
      ["Review keywords", plan.forecast.reviewKeywords],
      ["Excluded keywords", plan.forecast.excludedKeywords],
      ["Ad groups", plan.forecast.adGroupCount],
      ["Expected clicks", formatNumber(plan.forecast.expectedClicks)],
      ["Average CPC", formatWon(plan.forecast.avgCpc)]
    ]),
    createHtmlTable("Approval Queue Summary", ["Decision", "Count"], [
      ["Approved", approvalSummary.approved],
      ["Held", approvalSummary.held],
      ["Pending", approvalSummary.pending]
    ]),
    createHtmlTable("Approval Queue", ["Decision", "Type", "Target", "Action", "Risk", "Details"], approvedRows),
    createHtmlTable(
      "Keywords",
      ["Keyword", "Group", "Intent", "Status", "Estimated CPC", "Estimated Clicks", "Reason"],
      keywordRows
    ),
    createHtmlTable(
      "Ad Groups",
      ["Name", "Description", "Keyword Count", "Daily Budget", "Average Bid", "Expected Clicks", "Titles", "Descriptions"],
      adGroupRows
    ),
    createHtmlTable("Negative Keywords", ["Keyword"], plan.negativeKeywords.map((keyword) => [keyword])),
    createHtmlTable(
      "Industry Template",
      ["Type", "Value"],
      [
        ["Template", plan.industryTemplate.name],
        ...plan.industryTemplate.landingChecks.map((item) => ["Landing check", item]),
        ...plan.industryTemplate.copyRules.map((item) => ["Copy rule", item])
      ]
    ),
    productGroupRows.length > 0
      ? createHtmlTable(
          "Shopping Product Groups",
          ["Name", "Source Group", "Query Count", "Product Hints", "Feed Actions"],
          productGroupRows
        )
      : "",
    createHtmlTable("Assumptions", ["Assumption"], plan.assumptions.map((assumption) => [assumption])),
    "</body>",
    "</html>"
  ].join("\n");
}

function escapeCsvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function createHtmlTable(title: string, headers: string[], rows: Array<Array<string | number>>): string {
  const bodyRows = rows.length > 0 ? rows : [headers.map(() => "")];

  return [
    `<h2>${escapeHtml(title)}</h2>`,
    "<table>",
    `<thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>`,
    "<tbody>",
    ...bodyRows.map(
      (row) =>
        `<tr>${row
          .map((value) => {
            const cellClass = typeof value === "number" ? ' class="num"' : "";
            return `<td${cellClass}>${escapeHtml(String(value))}</td>`;
          })
          .join("")}</tr>`
    ),
    "</tbody>",
    "</table>"
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatWon(value: number): string {
  return `${formatNumber(value)}원`;
}
