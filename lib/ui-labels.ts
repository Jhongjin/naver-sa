export type ExecutionDraftStatus = "blocked" | "ready" | "executed" | "failed";
export type PlannerModeLabelInput = "agency" | "advertiser";
export type ProductTypeLabelInput = "powerlink" | "shoppingSearch";

export function productTypeLabel(productType: ProductTypeLabelInput) {
  return productType === "shoppingSearch" ? "쇼핑검색" : "파워링크";
}

export function plannerModeLabel(mode: PlannerModeLabelInput) {
  return mode === "agency" ? "대행사" : "광고주";
}

export function draftStatusClass(status: ExecutionDraftStatus | undefined) {
  if (status === "ready" || status === "executed") {
    return "include";
  }

  if (status === "blocked" || status === "failed") {
    return "review";
  }

  return "neutral";
}

export function draftStatusLabel(status: ExecutionDraftStatus) {
  const labels = {
    blocked: "차단",
    ready: "준비",
    executed: "실행",
    failed: "실패"
  };

  return labels[status];
}
