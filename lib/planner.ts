export type PlannerMode = "agency" | "advertiser";

export type PlannerProductType = "powerlink" | "shoppingSearch";

export type KeywordStatus = "include" | "review" | "exclude";

export type ChangeRisk = "low" | "medium" | "blocked";

export type PlannerInput = {
  brandName: string;
  siteUrl: string;
  vertical: string;
  monthlyBudget: number;
  maxBid: number;
  seedKeywords: string[];
  mode: PlannerMode;
  productType: PlannerProductType;
};

export type KeywordPlan = {
  term: string;
  intent: string;
  group: string;
  matchType: string;
  bid: number;
  expectedImpressions: number;
  expectedClicks: number;
  expectedCost: number;
  cvr: number;
  confidence: number;
  status: KeywordStatus;
  statusLabel: string;
  reason: string;
};

export type AdCopyDraft = {
  headline: string;
  description: string;
  angle?: string;
};

export type AdGroupPlan = {
  name: string;
  description: string;
  monthlyBudget: number;
  dailyBudget: number;
  keywordCount: number;
  expectedClicks: number;
  avgBid: number;
  sampleAds: AdCopyDraft[];
};

export type ForecastSummary = {
  monthlyBudget: number;
  dailyBudget: number;
  includedKeywords: number;
  reviewKeywords: number;
  excludedKeywords: number;
  adGroupCount: number;
  expectedImpressions: number;
  expectedClicks: number;
  expectedCost: number;
  avgCpc: number;
  expectedConversions: number;
  setupHoursSaved: number;
  approvalItems: number;
};

export type StagedChange = {
  id: string;
  type: string;
  target: string;
  action: string;
  risk: ChangeRisk;
  approval: string;
  details: string;
};

export type BenchmarkFeature = {
  name: string;
  status: "implemented" | "partial" | "planned";
  description: string;
};

export type OperationRule = {
  name: string;
  trigger: string;
  recommendation: string;
  automationLevel: string;
};

export type ProductGroupRecommendation = {
  name: string;
  sourceGroup: string;
  queryCount: number;
  productHints: string[];
  feedActions: string[];
};

export type IndustryTemplate = {
  name: string;
  landingChecks: string[];
  copyRules: string[];
  negativeThemes: string[];
};

export type PlannerPlan = {
  input: PlannerInput;
  keywords: KeywordPlan[];
  adGroups: AdGroupPlan[];
  negativeKeywords: string[];
  stagedChanges: StagedChange[];
  benchmarkFeatures: BenchmarkFeature[];
  operationRules: OperationRule[];
  productGroups: ProductGroupRecommendation[];
  industryTemplate: IndustryTemplate;
  forecast: ForecastSummary;
  assumptions: string[];
};

type GroupRule = {
  name: string;
  description: string;
  includes: string[];
  bid: number;
  weight: number;
};

const groupRules: GroupRule[] = [
  {
    name: "브랜드",
    description: "브랜드명, 도메인, 직접 탐색 키워드",
    includes: ["mard", "마드"],
    bid: 620,
    weight: 0.12
  },
  {
    name: "상의",
    description: "블라우스, 셔츠, 티셔츠 중심 구매 키워드",
    includes: ["블라우스", "셔츠", "티셔츠", "상의", "탑"],
    bid: 740,
    weight: 0.18
  },
  {
    name: "아우터",
    description: "자켓, 코트, 점퍼 등 객단가가 높은 상품군",
    includes: ["자켓", "재킷", "코트", "점퍼", "아우터", "레더"],
    bid: 960,
    weight: 0.22
  },
  {
    name: "니트/가디건",
    description: "니트웨어, 가디건, 베스트 상품군",
    includes: ["니트", "가디건", "베스트"],
    bid: 700,
    weight: 0.16
  },
  {
    name: "원피스/스커트",
    description: "원피스, 스커트, 하객룩 중심 상품군",
    includes: ["원피스", "스커트", "하객룩"],
    bid: 780,
    weight: 0.16
  },
  {
    name: "액세서리",
    description: "머플러, 가방 등 보조 상품군",
    includes: ["머플러", "가방", "힙색", "액세서리"],
    bid: 560,
    weight: 0.08
  },
  {
    name: "일반 탐색",
    description: "쇼핑몰, 추천, 데일리룩 등 넓은 탐색 키워드",
    includes: ["쇼핑몰", "추천", "여성의류", "데일리룩", "출근룩"],
    bid: 680,
    weight: 0.08
  }
];

const blockedTerms = ["무료", "중고", "알바", "도매", "짝퉁", "후기만", "반품", "수선"];
const reviewTerms = ["저렴", "싼", "가격", "코트", "명품", "추천"];

export const mardDefaultInput: PlannerInput = {
  brandName: "Mard",
  siteUrl: "https://mard.at/",
  vertical: "여성 의류 쇼핑몰",
  monthlyBudget: 1000000,
  maxBid: 1200,
  mode: "agency",
  productType: "powerlink",
  seedKeywords: [
    "여성의류 쇼핑몰",
    "여자 블라우스",
    "여성 레더 자켓",
    "여자 울 코트",
    "여성 니트웨어",
    "여성 원피스",
    "여성 가디건",
    "여성 머플러",
    "여성 가방",
    "여성 스커트"
  ]
};

export function generatePlannerPlan(input: PlannerInput): PlannerPlan {
  const safeInput = normalizeInput(input);
  const expandedTerms = expandKeywords(safeInput);
  const keywords = expandedTerms.map((term) => buildKeywordPlan(term, safeInput));
  const includedKeywords = keywords.filter((keyword) => keyword.status === "include");
  const reviewKeywords = keywords.filter((keyword) => keyword.status === "review");
  const excludedKeywords = keywords.filter((keyword) => keyword.status === "exclude");
  const adGroups = buildAdGroups(includedKeywords, safeInput);
  const stagedChanges = buildStagedChanges(adGroups, includedKeywords, reviewKeywords, safeInput);
  const forecast = buildForecast(safeInput, includedKeywords, reviewKeywords, excludedKeywords, adGroups, stagedChanges);

  return {
    input: safeInput,
    keywords,
    adGroups,
    negativeKeywords: buildNegativeKeywords(safeInput),
    stagedChanges,
    benchmarkFeatures: buildBenchmarkFeatures(safeInput.productType),
    operationRules: buildOperationRules(safeInput.productType),
    productGroups: buildProductGroupRecommendations(safeInput, includedKeywords),
    industryTemplate: buildIndustryTemplate(safeInput.vertical),
    forecast,
    assumptions: buildAssumptions(safeInput.productType)
  };
}

export function createPlannerCsv(plan: PlannerPlan): string {
  const header = [
    "keyword",
    "status",
    "intent",
    "ad_group",
    "match_type",
    "bid",
    "expected_impressions",
    "expected_clicks",
    "expected_cost",
    "reason"
  ];

  const rows = plan.keywords.map((keyword) => [
    keyword.term,
    keyword.statusLabel,
    keyword.intent,
    keyword.group,
    keyword.matchType,
    String(keyword.bid),
    String(keyword.expectedImpressions),
    String(keyword.expectedClicks),
    String(keyword.expectedCost),
    keyword.reason
  ]);

  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function normalizeInput(input: PlannerInput): PlannerInput {
  return {
    brandName: input.brandName.trim() || mardDefaultInput.brandName,
    siteUrl: input.siteUrl.trim() || mardDefaultInput.siteUrl,
    vertical: input.vertical.trim() || mardDefaultInput.vertical,
    monthlyBudget: clampNumber(input.monthlyBudget, 100000, 10000000),
    maxBid: clampNumber(input.maxBid, 300, 5000),
    mode: input.mode,
    productType: productTypeValue(input.productType),
    seedKeywords: normalizeTerms(input.seedKeywords).slice(0, 40)
  };
}

function expandKeywords(input: PlannerInput): string[] {
  const brandTerms = [input.brandName, input.brandName.toLowerCase(), "마드"].filter(Boolean);
  const expansionTerms = [
    ...input.seedKeywords,
    ...brandTerms,
    "여성 쇼핑몰 추천",
    "여성 데일리룩 쇼핑몰",
    "여성 출근룩",
    "여자 하객룩 원피스",
    "여자 가을 자켓",
    "여성 겨울 코트",
    "여자 브이넥 니트",
    "여성 니트 가디건",
    "여자 셔츠 블라우스",
    "여성 숄더백",
    "여성 머플러 코디",
    "여성의류 세일",
    "저렴한 여성의류",
    "여성의류 도매",
    "중고 여성의류"
  ];

  return normalizeTerms(expansionTerms).slice(0, 28);
}

function normalizeTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const term of terms) {
    const trimmed = term.trim().replace(/\s+/g, " ");
    const key = trimmed.toLowerCase();

    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}

function buildKeywordPlan(term: string, input: PlannerInput): KeywordPlan {
  const group = inferGroup(term);
  const intent = inferIntent(term, input.brandName);
  const status = inferStatus(term);
  const groupRule = groupRules.find((rule) => rule.name === group) ?? groupRules[groupRules.length - 1];
  const bid = status === "exclude" ? 0 : clampNumber(Math.round(groupRule.bid * intentBidMultiplier(intent)), 300, input.maxBid);
  const hash = stableHash(term);
  const ctr = status === "exclude" ? 0 : 0.016 + (hash % 18) / 1000;
  const impressions = status === "exclude" ? 0 : Math.round((900 + (hash % 4200)) * intentVolumeMultiplier(intent));
  const clicks = Math.round(impressions * ctr);
  const expectedCost = Math.min(input.monthlyBudget, Math.round(clicks * bid * 0.82));
  const cvr = status === "exclude" ? 0 : Math.round((1.1 + (hash % 21) / 10) * 10) / 10;

  return {
    term,
    intent,
    group,
    matchType: inferMatchType(term, status),
    bid,
    expectedImpressions: impressions,
    expectedClicks: clicks,
    expectedCost,
    cvr,
    confidence: status === "include" ? 82 + (hash % 12) : status === "review" ? 61 + (hash % 14) : 90,
    status,
    statusLabel: status === "include" ? "포함" : status === "review" ? "검토" : "제외",
    reason: buildKeywordReason(term, group, intent, status)
  };
}

function inferGroup(term: string): string {
  const lowered = term.toLowerCase();
  const matched = groupRules.find((rule) => rule.includes.some((token) => lowered.includes(token.toLowerCase())));
  return matched?.name ?? "일반 탐색";
}

function inferIntent(term: string, brandName: string): string {
  const lowered = term.toLowerCase();
  const brand = brandName.toLowerCase();

  if (lowered.includes(brand) || lowered.includes("마드")) {
    return "브랜드 직접 탐색";
  }

  if (blockedTerms.some((token) => lowered.includes(token))) {
    return "저품질 또는 부적합";
  }

  if (lowered.includes("추천") || lowered.includes("코디")) {
    return "비교 탐색";
  }

  if (lowered.includes("세일") || lowered.includes("저렴") || lowered.includes("가격")) {
    return "가격 민감";
  }

  return "구매 의도";
}

function inferStatus(term: string): KeywordStatus {
  const lowered = term.toLowerCase();

  if (blockedTerms.some((token) => lowered.includes(token))) {
    return "exclude";
  }

  if (reviewTerms.some((token) => lowered.includes(token))) {
    return "review";
  }

  return "include";
}

function inferMatchType(term: string, status: KeywordStatus): string {
  if (status === "exclude") {
    return "제외 후보";
  }

  if (term.length <= 8 || term.toLowerCase().includes("mard") || term.includes("마드")) {
    return "정확";
  }

  if (term.includes("추천") || term.includes("쇼핑몰")) {
    return "구문";
  }

  return "확장";
}

function buildKeywordReason(term: string, group: string, intent: string, status: KeywordStatus): string {
  if (status === "exclude") {
    return "광고비 소진 가능성이 높거나 상품 구매 의도와 맞지 않아 제외 후보로 분류했습니다.";
  }

  if (status === "review") {
    return "성과 가능성은 있으나 가격/재고/메시지 적합성 확인 후 승인하는 키워드입니다.";
  }

  return `${group} 상품군과 ${intent} 신호가 맞아 초기 세팅 포함 후보로 분류했습니다.`;
}

function buildAdGroups(keywords: KeywordPlan[], input: PlannerInput): AdGroupPlan[] {
  const grouped = new Map<string, KeywordPlan[]>();

  for (const keyword of keywords) {
    const bucket = grouped.get(keyword.group) ?? [];
    bucket.push(keyword);
    grouped.set(keyword.group, bucket);
  }

  const totalWeight = Array.from(grouped.keys()).reduce((sum, name) => {
    const rule = groupRules.find((item) => item.name === name);
    return sum + (rule?.weight ?? 0.08);
  }, 0);

  return Array.from(grouped.entries()).map(([name, items]) => {
    const rule = groupRules.find((item) => item.name === name);
    const weight = (rule?.weight ?? 0.08) / totalWeight;
    const monthlyBudget = Math.round(input.monthlyBudget * weight);
    const expectedClicks = items.reduce((sum, keyword) => sum + keyword.expectedClicks, 0);
    const avgBid = Math.round(items.reduce((sum, keyword) => sum + keyword.bid, 0) / items.length);

    return {
      name,
      description: rule?.description ?? "자동 분류된 검색 의도 그룹",
      monthlyBudget,
      dailyBudget: Math.round(monthlyBudget / 30),
      keywordCount: items.length,
      expectedClicks,
      avgBid,
      sampleAds: buildAdCopies(input.brandName, name)
    };
  });
}

function buildAdCopies(brandName: string, group: string): AdCopyDraft[] {
  return [
    {
      headline: `${brandName} ${group} 신상품`,
      description: "감도 있는 데일리 스타일을 공식몰에서 확인하세요.",
      angle: "신상품"
    },
    {
      headline: `${group} 추천 셀렉션`,
      description: "구매 의도 키워드에 맞춘 랜딩과 소재를 테스트합니다.",
      angle: "카테고리"
    },
    {
      headline: `${brandName} 공식몰 혜택`,
      description: "신규 상품과 시즌 코디를 안전한 공식몰에서 비교하세요.",
      angle: "신뢰"
    },
    {
      headline: `${group} 데일리룩`,
      description: "출근룩부터 주말 코디까지 상품군별 랜딩을 테스트합니다.",
      angle: "상황"
    }
  ];
}

function buildProductGroupRecommendations(
  input: PlannerInput,
  includedKeywords: KeywordPlan[]
): ProductGroupRecommendation[] {
  if (input.productType !== "shoppingSearch") {
    return [];
  }

  return groupRules
    .map((rule) => {
      const groupKeywords = includedKeywords.filter((keyword) => keyword.group === rule.name);

      return {
        name: `${rule.name} 상품그룹`,
        sourceGroup: rule.name,
        queryCount: groupKeywords.length,
        productHints: groupKeywords.slice(0, 4).map((keyword) => keyword.term),
        feedActions: [
          `${rule.name} 대표 상품명을 검색어와 맞춥니다.`,
          "품절/저재고 상품은 테스트 예산에서 제외 후보로 둡니다.",
          "카테고리, 태그, 대표 이미지를 상품그룹 기준으로 점검합니다."
        ]
      };
    })
    .filter((group) => group.queryCount > 0);
}

function buildIndustryTemplate(vertical: string): IndustryTemplate {
  const lowered = vertical.toLowerCase();

  if (lowered.includes("병원") || lowered.includes("의료")) {
    return {
      name: "병원/의료",
      landingChecks: ["진료 과목과 지역 표시", "의료광고 심의 문구 확인", "상담/예약 전환 경로 분리"],
      copyRules: ["과장 표현 제외", "가격 강조 최소화", "전문의/장비 표현은 근거 확인"],
      negativeThemes: ["무료", "부작용", "후기만", "보험사"]
    };
  }

  if (lowered.includes("교육") || lowered.includes("학원")) {
    return {
      name: "교육/학원",
      landingChecks: ["수강 대상과 커리큘럼 연결", "상담 신청 CTA 고정", "지역/온라인 여부 명시"],
      copyRules: ["성과 보장 표현 제외", "강사/커리큘럼 차별점 우선", "무료체험은 조건 명시"],
      negativeThemes: ["무료자료", "알바", "답안", "후기만"]
    };
  }

  if (lowered.includes("법률") || lowered.includes("변호")) {
    return {
      name: "법률",
      landingChecks: ["상담 분야별 랜딩 분리", "신뢰 정보와 문의 경로 표시", "지역 키워드 대응"],
      copyRules: ["승소 보장 표현 제외", "전문 분야 중심", "긴급 상담 문구는 사실 확인"],
      negativeThemes: ["무료", "양식", "판례", "셀프"]
    };
  }

  return {
    name: "쇼핑몰",
    landingChecks: ["상품군별 랜딩 연결", "배송/교환 안내 노출", "모바일 구매 CTA 확인"],
    copyRules: ["시즌/상황 키워드 반영", "공식몰 신뢰 문구 사용", "가격 과장 표현 제외"],
    negativeThemes: ["중고", "도매", "수선", "짝퉁"]
  };
}

function buildStagedChanges(
  adGroups: AdGroupPlan[],
  includedKeywords: KeywordPlan[],
  reviewKeywords: KeywordPlan[],
  input: PlannerInput
): StagedChange[] {
  const isShoppingSearch = input.productType === "shoppingSearch";
  const productLabel = getProductLabel(input.productType);
  const changes: StagedChange[] = [
    {
      id: "campaign-create-draft",
      type: "Campaign",
      target: `${input.brandName} ${productLabel} 테스트`,
      action: "캠페인 생성 초안",
      risk: "medium",
      approval: "승인 필요",
      details: `${productLabel} 테스트 계정에서만 생성 가능하며 라이브 활성화는 차단합니다.`
    },
    {
      id: "guardrail-budget",
      type: "Guardrail",
      target: "예산/입찰 제한",
      action: "최대값 검증",
      risk: "low",
      approval: "자동 검증",
      details: `월 ${formatWon(input.monthlyBudget)}, 키워드 최대 ${formatWon(input.maxBid)} 한도로 제한합니다.`
    }
  ];

  if (isShoppingSearch) {
    changes.push({
      id: "shopping-channel-check",
      type: "Shopping Feed",
      target: "쇼핑몰 채널/상품그룹",
      action: "계정 스캔 및 연결 확인",
      risk: "blocked",
      approval: "계정 스캔 필요",
      details: "쇼핑검색은 네이버쇼핑에 등록된 몰 비즈채널과 상품그룹을 API로 조회해 연결해야 합니다."
    });
  }

  for (const group of adGroups) {
    changes.push({
      id: `adgroup-${slugify(group.name)}`,
      type: isShoppingSearch ? "Shopping Ad Group" : "Ad Group",
      target: group.name,
      action: "광고그룹 생성 초안",
      risk: "medium",
      approval: "승인 필요",
      details: isShoppingSearch
        ? `${group.keywordCount}개 검색어/상품명 후보, 일 ${formatWon(group.dailyBudget)} 테스트 예산.`
        : `${group.keywordCount}개 키워드, 일 ${formatWon(group.dailyBudget)} 테스트 예산.`
    });
  }

  if (isShoppingSearch) {
    changes.push({
      id: "shopping-query-map",
      type: "Product Query",
      target: `${includedKeywords.length}개 상품 검색어`,
      action: "상품명/검색어 매핑 초안",
      risk: "low",
      approval: "승인 필요",
      details: `${reviewKeywords.length}개 검토 검색어는 상품명/카테고리 적합성 확인 후 반영합니다.`
    });
  } else {
    changes.push({
      id: "keyword-bulk-create",
      type: "Keyword",
      target: `${includedKeywords.length}개 포함 키워드`,
      action: "키워드 일괄 등록 초안",
      risk: "medium",
      approval: "승인 필요",
      details: `${reviewKeywords.length}개 검토 키워드는 승인 전 보류합니다.`
    });

    changes.push({
      id: "copy-draft-create",
      type: "Ad Copy",
      target: "광고 소재",
      action: "소재 초안 생성",
      risk: "low",
      approval: "승인 필요",
      details: "광고그룹별 2개 소재를 생성하되, 랜딩 URL과 문구 검수 후 전송합니다."
    });
  }

  return changes;
}

function buildForecast(
  input: PlannerInput,
  includedKeywords: KeywordPlan[],
  reviewKeywords: KeywordPlan[],
  excludedKeywords: KeywordPlan[],
  adGroups: AdGroupPlan[],
  stagedChanges: StagedChange[]
): ForecastSummary {
  const expectedImpressions = includedKeywords.reduce((sum, keyword) => sum + keyword.expectedImpressions, 0);
  const rawClicks = includedKeywords.reduce((sum, keyword) => sum + keyword.expectedClicks, 0);
  const rawCost = includedKeywords.reduce((sum, keyword) => sum + keyword.expectedCost, 0);
  const expectedCost = Math.min(input.monthlyBudget, rawCost);
  const expectedClicks = rawCost > input.monthlyBudget ? Math.round(rawClicks * (input.monthlyBudget / rawCost)) : rawClicks;
  const avgCpc = expectedClicks > 0 ? Math.round(expectedCost / expectedClicks) : 0;

  return {
    monthlyBudget: input.monthlyBudget,
    dailyBudget: Math.round(input.monthlyBudget / 30),
    includedKeywords: includedKeywords.length,
    reviewKeywords: reviewKeywords.length,
    excludedKeywords: excludedKeywords.length,
    adGroupCount: adGroups.length,
    expectedImpressions,
    expectedClicks,
    expectedCost,
    avgCpc,
    expectedConversions: Math.round(expectedClicks * 0.018),
    setupHoursSaved: 34,
    approvalItems: stagedChanges.filter((change) => change.approval === "승인 필요").length
  };
}

function buildNegativeKeywords(input: PlannerInput): string[] {
  const template = buildIndustryTemplate(input.vertical);

  return Array.from(new Set([
    "무료",
    "중고",
    "도매",
    "알바",
    "수선",
    "반품",
    `${input.brandName} 후기만`,
    "짝퉁",
    ...template.negativeThemes
  ]));
}

function buildBenchmarkFeatures(productType: PlannerProductType): BenchmarkFeature[] {
  const shoppingFeature: BenchmarkFeature =
    productType === "shoppingSearch"
      ? {
          name: "쇼핑검색 상품그룹 연동",
          status: "implemented",
          description: "네이버 계정의 쇼핑몰 비즈채널과 상품그룹을 조회해 쇼핑검색 세팅 전제조건을 검수합니다."
        }
      : {
          name: "쇼핑검색 상품그룹 연동",
          status: "partial",
          description: "쇼핑검색 모드 선택 시 몰 채널/상품그룹 스캔과 별도 세팅 큐를 제공합니다."
        };

  return [
    {
      name: "AI 키워드 확장/분류",
      status: "implemented",
      description: "seed keyword를 상품군, 의도, 제외 후보로 분류하고 광고그룹까지 자동 연결합니다."
    },
    {
      name: "원스톱 세팅 플로우",
      status: "implemented",
      description: "사이트/업종 입력에서 캠페인, 광고그룹, 키워드, 소재 초안까지 한 번에 생성합니다."
    },
    {
      name: "예산/입찰 가드레일",
      status: "implemented",
      description: "최대 입찰가와 월 예산을 넘어서는 초안을 자동 보정합니다."
    },
    {
      name: "승인 기반 변경 큐",
      status: "implemented",
      description: "Naver API 전송 전 모든 생성/수정 항목을 승인 대기 작업으로 분리합니다."
    },
    {
      name: "운영 자동화 추천",
      status: "implemented",
      description: "dry-run 최적화 엔진으로 bid 조정, pause 후보, 예산 가드레일 추천을 생성합니다."
    },
    {
      name: "리포트/공유",
      status: "implemented",
      description: "키워드 CSV와 승인 큐 CSV, 운영 리포트 Markdown export를 지원합니다."
    },
    {
      name: "Naver API 연결 준비",
      status: "implemented",
      description: "공식 서명 방식 기반의 read-only 준비 상태와 캠페인 조회 헬퍼를 제공합니다."
    },
    shoppingFeature
  ];
}

function buildOperationRules(productType: PlannerProductType): OperationRule[] {
  const commonRules = [
    {
      name: "저성과 키워드 pause 후보",
      trigger: "클릭 30회 이상, 전환 0건",
      recommendation: "삭제 대신 pause/off 승인 큐에 추가",
      automationLevel: "Level 2 Staged"
    },
    {
      name: "입찰가 상향 후보",
      trigger: "전환 발생, 평균 CPC가 최대 입찰가의 70% 이하",
      recommendation: "10~15% 상향안을 승인 큐에 추가",
      automationLevel: "Level 2 Staged"
    },
    {
      name: "예산 소진 알림",
      trigger: "일 예산 80% 이상 소진, 오전 시간대",
      recommendation: "예산 증액 또는 고효율 그룹 우선 배분 제안",
      automationLevel: "Level 1 Draft"
    },
    {
      name: "검색어 제외 후보",
      trigger: "부적합 검색어가 클릭을 유발",
      recommendation: "제외 키워드 승인 큐에 추가",
      automationLevel: "Level 2 Staged"
    }
  ];

  if (productType !== "shoppingSearch") {
    return commonRules;
  }

  return [
    {
      name: "상품 검색어 개선 후보",
      trigger: "쇼핑검색 유입 검색어는 있으나 상품명/카테고리 매칭이 약함",
      recommendation: "상품명, 태그, 카테고리 문구 개선안을 승인 큐에 추가",
      automationLevel: "Level 1 Draft"
    },
    {
      name: "상품그룹 제외 후보",
      trigger: "클릭은 발생하지만 전환가치가 낮은 상품군",
      recommendation: "상품그룹 제외 또는 예산 축소 후보로 표시",
      automationLevel: "Level 2 Staged"
    },
    ...commonRules
  ];
}

function buildAssumptions(productType: PlannerProductType): string[] {
  const assumptions = [
    "Naver 실시간 검색량 API가 연결되기 전까지는 업종별 기준값과 키워드 의도 점수로 예측합니다.",
    "모든 생성/수정은 승인 대기 상태로만 준비하며 라이브 활성화는 MVP에서 차단합니다.",
    "입찰가는 입력된 최대 입찰가를 절대 넘지 않도록 보정합니다.",
    "삭제는 생성하지 않고 제외 또는 pause/off 권고로만 표시합니다."
  ];

  if (productType === "shoppingSearch") {
    assumptions.push(
      "쇼핑검색의 몰 비즈채널과 상품그룹은 네이버 정책상 API 생성이 아니라 계정 스캔/선택 대상으로 취급합니다.",
      "쇼핑검색 모드의 검색어 목록은 상품명, 카테고리, 태그 개선 및 상품그룹 구조화 후보로 사용합니다."
    );
  }

  return assumptions;
}

function getProductLabel(productType: PlannerProductType): string {
  return productType === "shoppingSearch" ? "쇼핑검색" : "파워링크";
}

function productTypeValue(value: unknown): PlannerProductType {
  return value === "shoppingSearch" ? "shoppingSearch" : "powerlink";
}

function intentBidMultiplier(intent: string): number {
  if (intent === "브랜드 직접 탐색") {
    return 0.86;
  }

  if (intent === "비교 탐색") {
    return 0.92;
  }

  if (intent === "가격 민감") {
    return 0.74;
  }

  return 1;
}

function intentVolumeMultiplier(intent: string): number {
  if (intent === "브랜드 직접 탐색") {
    return 0.55;
  }

  if (intent === "비교 탐색") {
    return 1.25;
  }

  if (intent === "가격 민감") {
    return 0.72;
  }

  return 1;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.round(value), min), max);
}

function stableHash(value: string): number {
  return Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "");
}

function escapeCsvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function formatWon(value: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}
