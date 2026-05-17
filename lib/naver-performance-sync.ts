export const performanceSyncTableName = "naver_performance_sync_runs";

export const naverPerformanceDocs = {
  landing: "https://naver.github.io/searchad-apidoc/",
  swaggerFiles: [
    {
      label: "NCC Report",
      url: "https://naver.github.io/searchad-apidoc/assets/json/ncc-report.json"
    },
    {
      label: "Master Report",
      url: "https://naver.github.io/searchad-apidoc/assets/json/master-report.json"
    }
  ],
  readOnlyEndpoints: [
    "GET /api/stats{?id,fields,timeRange,datePreset,timeIncrement,breakdown}",
    "GET /api/stats{?ids,fields,timeRange,datePreset,timeIncrement,breakdown}",
    "GET /api/stats{?id,statType}",
    "GET /api/stat-reports",
    "GET /api/stat-reports/{reportJobId}",
    "GET /master-reports",
    "GET /master-reports/{id}"
  ],
  blockedJobEndpoints: [
    "POST /api/stat-reports",
    "DELETE /api/stat-reports",
    "DELETE /api/stat-reports/{reportJobId}",
    "POST /master-reports",
    "DELETE /master-reports",
    "DELETE /master-reports/{id}"
  ]
} as const;

export const performanceSyncSafeguards = {
  externalRequest: false,
  readOnlyStatsOnly: true,
  externalReportJobCreation: false,
  externalReportDeletion: false,
  liveMutation: false,
  productionDelete: false
} as const;

export type PerformanceSyncScope = "powerlinkDailyStats" | "shoppingKeywordDailyStats" | "masterReference";

export const performanceSyncCronPolicy = {
  endpoint: "/api/naver/performance-sync/cron",
  scheduleUtc: "10 0 * * *",
  scheduleKst: "매일 오전 9:10 KST",
  maxRunsPerInvocation: 3,
  targetStatuses: ["planned", "failed"] as const,
  excludedStatuses: ["blocked", "completed", "ready"] as const,
  excludesMasterReference: true,
  automaticRetry: false
} as const;

export type PerformanceSyncPlanInput = {
  productType: "powerlink" | "shoppingSearch" | null;
  brandName: string | null;
  siteUrl: string | null;
  scope: PerformanceSyncScope;
  dateFrom: string;
  dateTo: string;
  entityIds: string[];
  fields: string[];
};

export type PerformanceSyncPlan = PerformanceSyncPlanInput & {
  status: "planned" | "blocked";
  readOnlyEndpoint: string;
  warnings: string[];
};

export type PerformanceStatsPreviewRequest = {
  entityIds: string[];
  fields: string[];
  dateFrom: string;
  dateTo: string;
  timeIncrement: "allDays";
  warnings: string[];
};

const allowedStatFields = new Set([
  "impCnt",
  "clkCnt",
  "salesAmt",
  "ctr",
  "cpc",
  "avgRnk",
  "ccnt",
  "recentAvgRnk",
  "recentAvgCpc",
  "pcNxAvgRnk",
  "mblNxAvgRnk",
  "crto",
  "convAmt",
  "ror",
  "cpConv",
  "viewCnt",
  "purchaseCcnt",
  "purchaseConvAmt",
  "purchaseRor"
]);

const defaultFieldsByScope: Record<PerformanceSyncScope, string[]> = {
  powerlinkDailyStats: ["impCnt", "clkCnt", "salesAmt", "ctr", "cpc", "avgRnk"],
  shoppingKeywordDailyStats: ["impCnt", "clkCnt", "salesAmt", "ctr", "cpc", "purchaseCcnt", "purchaseConvAmt"],
  masterReference: []
};

export function createPerformanceSyncPlan(input: {
  productType?: unknown;
  brandName?: unknown;
  siteUrl?: unknown;
  scope?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  entityIds?: unknown;
  fields?: unknown;
}): PerformanceSyncPlan {
  const scope = coerceScope(input.scope);
  const requestedDateFrom = coerceDate(input.dateFrom);
  const requestedDateTo = coerceDate(input.dateTo);
  const [dateFrom, dateTo, dateOrderWarning] = normalizeDateRange(requestedDateFrom, requestedDateTo);
  const entityIds = coerceEntityIds(input.entityIds);
  const fields = coerceFields(input.fields, scope);
  const warnings: string[] = [];

  if (dateOrderWarning) {
    warnings.push(dateOrderWarning);
  }

  if (countDays(dateFrom, dateTo) > 31) {
    warnings.push("MVP 성과 동기화 계획은 한 번에 최대 31일 범위로 제한합니다.");
  }

  if (scope !== "masterReference" && entityIds.length === 0) {
    warnings.push("Naver stats 조회에는 campaign/ad group/keyword/ad ID가 필요합니다.");
  }

  if (scope === "masterReference") {
    warnings.push("Master report job 생성은 이번 큐에서 차단되어 있으며, 계획 기록만 저장합니다.");
  }

  return {
    productType: coerceProductType(input.productType),
    brandName: coerceText(input.brandName, 140),
    siteUrl: coerceText(input.siteUrl, 240),
    scope,
    dateFrom,
    dateTo,
    entityIds,
    fields,
    readOnlyEndpoint:
      scope === "masterReference"
        ? "GET /master-reports"
        : "GET /api/stats{?ids,fields,timeRange,datePreset,timeIncrement,breakdown}",
    status: warnings.length > 0 ? "blocked" : "planned",
    warnings
  };
}

export function createPerformanceStatsPreviewRequest(input: {
  entityIds?: unknown;
  fields?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
}): PerformanceStatsPreviewRequest {
  const requestedDateFrom = coerceDate(input.dateFrom);
  const requestedDateTo = coerceDate(input.dateTo);
  const [dateFrom, dateTo, dateOrderWarning] = normalizeDateRange(requestedDateFrom, requestedDateTo);
  const entityIds = coerceEntityIds(input.entityIds).slice(0, 10);
  const fields = coerceFields(input.fields, "powerlinkDailyStats").slice(0, 8);
  const warnings: string[] = [];

  if (dateOrderWarning) {
    warnings.push(dateOrderWarning);
  }

  if (entityIds.length === 0) {
    warnings.push("Naver stats preview에는 최소 1개의 campaign/ad group/keyword/ad ID가 필요합니다.");
  }

  if (countDays(dateFrom, dateTo) > 31) {
    warnings.push("Naver stats preview는 한 번에 최대 31일 범위로 제한합니다.");
  }

  return {
    entityIds,
    fields,
    dateFrom,
    dateTo,
    timeIncrement: "allDays",
    warnings
  };
}

function coerceScope(value: unknown): PerformanceSyncScope {
  return value === "shoppingKeywordDailyStats" || value === "masterReference" ? value : "powerlinkDailyStats";
}

function coerceProductType(value: unknown): "powerlink" | "shoppingSearch" | null {
  return value === "powerlink" || value === "shoppingSearch" ? value : null;
}

function coerceText(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}

function coerceEntityIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
        .map((item) => item.slice(0, 120))
    )
  ].slice(0, 50);
}

function coerceFields(value: unknown, scope: PerformanceSyncScope): string[] {
  if (!Array.isArray(value)) {
    return defaultFieldsByScope[scope];
  }

  const fields = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => allowedStatFields.has(item));

  return fields.length > 0 ? [...new Set(fields)].slice(0, 12) : defaultFieldsByScope[scope];
}

function coerceDate(value: unknown): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValidIsoDate(value)) {
    return value;
  }

  const date = new Date();
  date.setDate(date.getDate() - 1);

  return date.toISOString().slice(0, 10);
}

function isValidIsoDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function countDays(dateFrom: string, dateTo: string): number {
  const from = Date.parse(`${dateFrom}T00:00:00.000Z`);
  const to = Date.parse(`${dateTo}T00:00:00.000Z`);

  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor((to - from) / 86_400_000) + 1;
}

function normalizeDateRange(dateFrom: string, dateTo: string): [string, string, string | null] {
  const from = Date.parse(`${dateFrom}T00:00:00.000Z`);
  const to = Date.parse(`${dateTo}T00:00:00.000Z`);

  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return [dateFrom, dateFrom, "날짜 형식을 확인해 주세요. 기본 날짜로 계획을 차단했습니다."];
  }

  if (to < from) {
    return [dateTo, dateFrom, "요청 날짜가 역순이라 저장 전 범위를 정렬했습니다."];
  }

  return [dateFrom, dateTo, null];
}
