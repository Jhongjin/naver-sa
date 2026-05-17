export type PerformanceRecommendationSeverity = "low" | "medium" | "high";

export type PerformanceRecommendationAction =
  | "increaseBidCandidate"
  | "decreaseBidCandidate"
  | "holdAndInspect"
  | "creativeReview"
  | "keepLearning";

export type PerformanceRecommendation = {
  id: string;
  entityId: string;
  severity: PerformanceRecommendationSeverity;
  action: PerformanceRecommendationAction;
  title: string;
  trigger: string;
  recommendation: string;
  metricSummary: {
    impressions: number;
    clicks: number;
    cost: number;
    ctr: number | null;
    cpc: number | null;
    avgRank: number | null;
    conversions: number;
    revenue: number;
  };
  automationLevel: "Level 1 Review" | "Level 2 Staged";
  safeDraftOnly: true;
};

type StatsRecord = Record<string, unknown>;

export function generatePerformanceRecommendations(stats: unknown): PerformanceRecommendation[] {
  return extractStatsRows(stats)
    .map((row, index) => toRecommendation(row, index))
    .filter((item): item is PerformanceRecommendation => Boolean(item))
    .slice(0, 12);
}

export function summarizePerformanceRecommendations(recommendations: PerformanceRecommendation[]) {
  return recommendations.reduce(
    (summary, recommendation) => {
      summary.total += 1;
      summary.bySeverity[recommendation.severity] += 1;
      summary.byAction[recommendation.action] = (summary.byAction[recommendation.action] ?? 0) + 1;

      return summary;
    },
    {
      total: 0,
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0
      },
      byAction: {} as Record<PerformanceRecommendationAction, number>
    }
  );
}

function toRecommendation(row: StatsRecord, index: number): PerformanceRecommendation | null {
  const metrics = readMetrics(row);
  const entityId = readEntityId(row, index);
  const hasConversions = metrics.conversions > 0;
  const hasRevenue = metrics.revenue > 0;
  const costPerConversion = hasConversions ? metrics.cost / metrics.conversions : null;
  const revenueRatio = metrics.cost > 0 && hasRevenue ? metrics.revenue / metrics.cost : null;

  if (metrics.impressions === 0 && metrics.clicks === 0) {
    return makeRecommendation({
      index,
      entityId,
      metrics,
      severity: "medium",
      action: "holdAndInspect",
      title: "노출 없음 점검",
      trigger: "조회 기간 동안 노출과 클릭이 모두 없습니다.",
      recommendation: "비즈채널 연결, 캠페인/광고그룹 상태, 입찰가와 키워드 심사 상태를 먼저 확인합니다.",
      automationLevel: "Level 1 Review"
    });
  }

  if (metrics.clicks >= 20 && !hasConversions && metrics.cost >= 30_000) {
    return makeRecommendation({
      index,
      entityId,
      metrics,
      severity: "high",
      action: "decreaseBidCandidate",
      title: "비용 발생 후 전환 없음",
      trigger: `클릭 ${formatNumber(metrics.clicks)}회, 비용 ${formatWon(metrics.cost)}, 전환 0건입니다.`,
      recommendation: "입찰 10~15% 하향 후보로 두고 검색어 리포트에서 제외어를 우선 보강합니다.",
      automationLevel: "Level 2 Staged"
    });
  }

  if (metrics.impressions >= 1_000 && metrics.ctr !== null && metrics.ctr < 0.5) {
    return makeRecommendation({
      index,
      entityId,
      metrics,
      severity: "medium",
      action: "creativeReview",
      title: "노출 대비 클릭률 낮음",
      trigger: `노출 ${formatNumber(metrics.impressions)}회, CTR ${formatPercent(metrics.ctr)}입니다.`,
      recommendation: "소재 문구와 키워드 의도를 재검토하고, 낮은 의도 검색어는 제외 후보로 분리합니다.",
      automationLevel: "Level 1 Review"
    });
  }

  if (hasConversions && revenueRatio !== null && revenueRatio >= 2) {
    return makeRecommendation({
      index,
      entityId,
      metrics,
      severity: "low",
      action: "increaseBidCandidate",
      title: "매출 효율 양호",
      trigger: `비용 대비 매출 비율 ${revenueRatio.toFixed(1)}배, 전환 ${formatNumber(metrics.conversions)}건입니다.`,
      recommendation: "예산 상한을 유지한 채 입찰 5~10% 상향 후보로 검토합니다.",
      automationLevel: "Level 2 Staged"
    });
  }

  if (hasConversions && costPerConversion !== null && costPerConversion <= 15_000) {
    return makeRecommendation({
      index,
      entityId,
      metrics,
      severity: "low",
      action: "increaseBidCandidate",
      title: "전환 단가 안정",
      trigger: `전환당 비용 ${formatWon(Math.round(costPerConversion))}, 전환 ${formatNumber(metrics.conversions)}건입니다.`,
      recommendation: "동일 키워드 묶음의 예산 소진 속도를 확인한 뒤 입찰 상향 후보로 관리합니다.",
      automationLevel: "Level 2 Staged"
    });
  }

  if (metrics.avgRank !== null && metrics.avgRank > 4 && metrics.ctr !== null && metrics.ctr >= 1.2) {
    return makeRecommendation({
      index,
      entityId,
      metrics,
      severity: "low",
      action: "increaseBidCandidate",
      title: "순위 개선 후보",
      trigger: `평균 순위 ${metrics.avgRank.toFixed(1)}, CTR ${formatPercent(metrics.ctr)}입니다.`,
      recommendation: "클릭률은 유지되고 있으므로 예산 한도 안에서 소폭 입찰 상향을 검토합니다.",
      automationLevel: "Level 2 Staged"
    });
  }

  if (metrics.clicks >= 5 || metrics.impressions >= 100) {
    return makeRecommendation({
      index,
      entityId,
      metrics,
      severity: "low",
      action: "keepLearning",
      title: "학습 유지",
      trigger: `클릭 ${formatNumber(metrics.clicks)}회, 비용 ${formatWon(metrics.cost)}입니다.`,
      recommendation: "표본이 더 쌓일 때까지 관찰군으로 유지하고 다음 preview에서 변화량을 비교합니다.",
      automationLevel: "Level 1 Review"
    });
  }

  return null;
}

function makeRecommendation(input: {
  index: number;
  entityId: string;
  metrics: ReturnType<typeof readMetrics>;
  severity: PerformanceRecommendationSeverity;
  action: PerformanceRecommendationAction;
  title: string;
  trigger: string;
  recommendation: string;
  automationLevel: PerformanceRecommendation["automationLevel"];
}): PerformanceRecommendation {
  return {
    id: `performance-${input.action}-${input.index}`,
    entityId: input.entityId,
    severity: input.severity,
    action: input.action,
    title: input.title,
    trigger: input.trigger,
    recommendation: input.recommendation,
    metricSummary: input.metrics,
    automationLevel: input.automationLevel,
    safeDraftOnly: true
  };
}

function extractStatsRows(value: unknown): StatsRecord[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  if (!isRecord(value)) {
    return [];
  }

  const directData = value.data;

  if (Array.isArray(directData)) {
    return directData.filter(isRecord);
  }

  const summaryResponse = value.summaryStatResponse;

  if (isRecord(summaryResponse) && Array.isArray(summaryResponse.data)) {
    return summaryResponse.data.filter(isRecord);
  }

  const dailyResponse = value.dailyStatResponse;

  if (isRecord(dailyResponse) && Array.isArray(dailyResponse.data)) {
    return dailyResponse.data.filter(isRecord);
  }

  return [];
}

function readMetrics(row: StatsRecord) {
  const conversions = readNumber(row.ccnt) + readNumber(row.purchaseCcnt);

  return {
    impressions: Math.trunc(readNumber(row.impCnt)),
    clicks: Math.trunc(readNumber(row.clkCnt)),
    cost: Math.round(readNumber(row.salesAmt)),
    ctr: readOptionalNumber(row.ctr),
    cpc: readOptionalNumber(row.cpc),
    avgRank: readOptionalNumber(row.avgRnk),
    conversions,
    revenue: Math.round(readNumber(row.convAmt) + readNumber(row.purchaseConvAmt))
  };
}

function readEntityId(row: StatsRecord, index: number): string {
  return typeof row.id === "string" && row.id.trim() ? row.id.trim() : `entity-${index + 1}`;
}

function readNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function readOptionalNumber(value: unknown): number | null {
  const parsed = readNumber(value);

  return parsed === 0 && value !== 0 && value !== "0" ? null : parsed;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatWon(value: number): string {
  return `${formatNumber(value)}원`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function isRecord(value: unknown): value is StatsRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
