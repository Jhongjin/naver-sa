export const mardSeedKeywords = [
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
];

export const setupSteps = [
  {
    title: "사이트 분석",
    description: "Mard의 상품명, 카테고리, 가격대, 쇼핑몰 신뢰 정보를 추출했습니다.",
    state: "done"
  },
  {
    title: "키워드 후보 생성",
    description: "상품군 기반으로 구매의도 키워드와 브랜드 키워드를 분리했습니다.",
    state: "done"
  },
  {
    title: "광고그룹 구조화",
    description: "상의, 아우터, 니트, 원피스, 액세서리, 브랜드 그룹으로 초안을 구성합니다.",
    state: "current"
  },
  {
    title: "Naver API 테스트 배포",
    description: "승인 후 테스트 캠페인 생성만 허용하며 라이브 활성화는 차단합니다.",
    state: "pending"
  }
];

export const forecastCards = [
  {
    label: "월 테스트 예산",
    value: "1,000,000원",
    caption: "실집행 전 샘플 시뮬레이션"
  },
  {
    label: "예상 클릭",
    value: "820~1,180",
    caption: "CPC 가정 기반 범위"
  },
  {
    label: "추천 광고그룹",
    value: "6개",
    caption: "상품군과 의도 기준"
  },
  {
    label: "승인 대기 작업",
    value: "42건",
    caption: "생성/수정 모두 승인 필요"
  }
];

export const keywordCandidates = [
  {
    term: "여성의류 쇼핑몰",
    intent: "구매 탐색",
    group: "브랜드/일반",
    bid: 780,
    status: "포함",
    statusTone: "include",
    reason: "쇼핑몰 성격을 가장 넓게 포착하는 일반 키워드"
  },
  {
    term: "여자 블라우스",
    intent: "구매",
    group: "상의",
    bid: 720,
    status: "포함",
    statusTone: "include",
    reason: "현재 노출 상품인 마랑블라우스와 직접 연결"
  },
  {
    term: "여성 레더 자켓",
    intent: "구매",
    group: "아우터",
    bid: 960,
    status: "포함",
    statusTone: "include",
    reason: "고가 상품군으로 객단가 기여 가능성이 높음"
  },
  {
    term: "여자 울 코트",
    intent: "계절 구매",
    group: "아우터",
    bid: 880,
    status: "검토",
    statusTone: "review",
    reason: "품절 상품이 포함되어 재고 확인 후 집행 필요"
  },
  {
    term: "여성 니트웨어",
    intent: "구매",
    group: "니트",
    bid: 690,
    status: "포함",
    statusTone: "include",
    reason: "후드 니트웨어, 브이넥 니트 상품군과 연결"
  },
  {
    term: "여성 원피스",
    intent: "구매",
    group: "원피스",
    bid: 760,
    status: "포함",
    statusTone: "include",
    reason: "Stitch Point Onepiece 상품군 기반"
  },
  {
    term: "저렴한 여성의류",
    intent: "가격 민감",
    group: "일반 제외 후보",
    bid: 430,
    status: "제외",
    statusTone: "exclude",
    reason: "브랜드 가격대와 메시지가 맞지 않아 저품질 유입 가능성"
  },
  {
    term: "여성 머플러",
    intent: "액세서리 구매",
    group: "액세서리",
    bid: 520,
    status: "포함",
    statusTone: "include",
    reason: "Hairy Long Muffler 상품과 직접 연결"
  }
];

export const adGroups = [
  {
    name: "상의",
    description: "블라우스, 셔츠, 티셔츠",
    keywordCount: 8
  },
  {
    name: "아우터",
    description: "레더 자켓, 울 코트, 점퍼",
    keywordCount: 11
  },
  {
    name: "니트",
    description: "니트웨어, 가디건, 베스트",
    keywordCount: 7
  },
  {
    name: "원피스/스커트",
    description: "원피스, 나일론 스커트",
    keywordCount: 6
  },
  {
    name: "액세서리",
    description: "머플러, 가방, 힙색",
    keywordCount: 5
  },
  {
    name: "브랜드",
    description: "Mard, 마드, 브랜드명 검색",
    keywordCount: 5
  }
];

