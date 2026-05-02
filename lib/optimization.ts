import type { PlannerPlan } from "@/lib/planner";

export type OptimizationSeverity = "low" | "medium" | "high";

export type OptimizationRecommendation = {
  id: string;
  entity: string;
  scope: string;
  severity: OptimizationSeverity;
  trigger: string;
  recommendation: string;
  stagedAction: string;
  expectedImpact: string;
  automationLevel: string;
};

export function generateOptimizationRecommendations(plan: PlannerPlan): OptimizationRecommendation[] {
  const keywordRecommendations = plan.keywords
    .filter((keyword) => keyword.status === "include")
    .slice(0, 6)
    .map((keyword, index): OptimizationRecommendation => {
      if (keyword.expectedCost > 70000 && keyword.cvr < 2) {
        return {
          id: `keyword-bid-down-${index}`,
          entity: keyword.term,
          scope: "Keyword",
          severity: "medium",
          trigger: `예상 비용 ${formatWon(keyword.expectedCost)}, 전환율 ${keyword.cvr}%`,
          recommendation: "초기 입찰가를 12% 낮춰 테스트 예산 소진을 늦춥니다.",
          stagedAction: "bid decrease draft",
          expectedImpact: "낭비 클릭 방어",
          automationLevel: "Level 2 Staged"
        };
      }

      if (keyword.confidence >= 88 && keyword.cvr >= 2.4) {
        return {
          id: `keyword-bid-up-${index}`,
          entity: keyword.term,
          scope: "Keyword",
          severity: "low",
          trigger: `신뢰도 ${keyword.confidence}, 전환율 ${keyword.cvr}%`,
          recommendation: "초기 학습 후 10% 입찰 상향 후보로 관리합니다.",
          stagedAction: "bid increase draft",
          expectedImpact: "고의도 키워드 노출 확대",
          automationLevel: "Level 2 Staged"
        };
      }

      return {
        id: `keyword-watch-${index}`,
        entity: keyword.term,
        scope: "Keyword",
        severity: "low",
        trigger: `예상 클릭 ${formatNumber(keyword.expectedClicks)}회`,
        recommendation: "초기 7일은 관찰군으로 유지하고 검색어 보고서 기반으로 제외어를 보강합니다.",
        stagedAction: "watchlist",
        expectedImpact: "학습 데이터 확보",
        automationLevel: "Level 1 Draft"
      };
    });

  const groupRecommendations = plan.adGroups
    .filter((group) => group.monthlyBudget > plan.forecast.monthlyBudget * 0.15)
    .slice(0, 3)
    .map((group, index): OptimizationRecommendation => ({
      id: `group-budget-${index}`,
      entity: group.name,
      scope: "Ad Group",
      severity: group.avgBid > plan.input.maxBid * 0.75 ? "high" : "medium",
      trigger: `일 예산 ${formatWon(group.dailyBudget)}, 평균 입찰 ${formatWon(group.avgBid)}`,
      recommendation: "성과 확인 전까지 일 예산 상한을 유지하고 전환 발생 그룹에만 재배분합니다.",
      stagedAction: "budget guardrail draft",
      expectedImpact: "예산 과소진 방지",
      automationLevel: "Level 2 Staged"
    }));

  const negativeRecommendation: OptimizationRecommendation = {
    id: "negative-keyword-bulk",
    entity: "제외 키워드 묶음",
    scope: "Negative Keyword",
    severity: "high",
    trigger: `${plan.negativeKeywords.length}개 부적합 유입 후보`,
    recommendation: "무료, 중고, 도매 등 구매 의도와 맞지 않는 검색어를 제외 후보로 유지합니다.",
    stagedAction: "negative keyword draft",
    expectedImpact: "저품질 클릭 차단",
    automationLevel: "Level 2 Staged"
  };

  return [...groupRecommendations, ...keywordRecommendations, negativeRecommendation].slice(0, 10);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatWon(value: number): string {
  return `${formatNumber(value)}원`;
}
