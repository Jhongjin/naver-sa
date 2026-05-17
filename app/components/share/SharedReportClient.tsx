"use client";

import Link from "next/link";
import { Clock3, ExternalLink, FileText, KeyRound, ListChecks, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatKoreanDateTime, formatKoreanNumber, formatWon } from "@/lib/formatters";
import { draftStatusClass, draftStatusLabel, plannerModeLabel, productTypeLabel } from "@/lib/ui-labels";

type SharedReportResponse =
  | {
      ok: true;
      publicReport: true;
      rawPayloadExcluded: true;
      auditExcluded: true;
      link: {
        expiresAt: string;
        createdAt: string;
        accessCount: number;
      };
      run: {
        brandName: string;
        siteUrl: string;
        vertical: string;
        monthlyBudget: number;
        maxBid: number;
        mode: "agency" | "advertiser";
        productType: "powerlink" | "shoppingSearch";
        seedKeywords: string[];
        createdAt: string;
        workspaceName: string | null;
        workspaceMode: "agency" | "advertiser" | null;
      };
      approvalSummary: {
        approved: number;
        held: number;
        pending: number;
        blocked: number;
      };
      keywords: Array<{
        term: string;
        intent: string;
        adGroupName: string;
        bid: number;
        expectedClicks: number;
        expectedCost: number;
        status: string;
        reason: string;
      }>;
      adGroups: Array<{
        name: string;
        description: string;
        dailyBudget: number;
        keywordCount: number;
        expectedClicks: number;
        avgBid: number;
      }>;
      productGroups: Array<{
        name: string;
        sourceGroup: string;
        queryCount: number;
        productHints: string[];
        feedActions: string[];
      }>;
      stagedChanges: Array<{
        entityType: string;
        target: string;
        action: string;
        risk: string;
        details: string;
        decision: string;
        decisionNote: string | null;
        createdAt: string;
      }>;
      executionDraft: {
        status: "blocked" | "ready" | "executed" | "failed";
        approvedChangeCount: number;
        payloadCount: number;
        validation: {
          canExecuteTest?: boolean;
          blockerCount?: number;
          warningCount?: number;
          blockers?: Array<{ code: string; payloadId?: string; message: string }>;
          warnings?: Array<{ code: string; payloadId?: string; message: string }>;
        } | null;
        generatedAt: string;
        createdAt: string;
      } | null;
      safety: {
        liveBlocked: boolean;
        deleteBlocked: boolean;
        rawPayloadExcluded: boolean;
        idempotencyKeysExcluded: boolean;
        auditExcluded: boolean;
      };
    }
  | {
      ok?: false;
      error?: string;
      installed?: boolean;
    };

export function SharedReportClient({ token }: { token: string }) {
  const [data, setData] = useState<Extract<SharedReportResponse, { ok: true }> | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "idle">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSharedReport() {
      setStatus("loading");
      setMessage("");

      const response = await fetch(`/api/share/reports/${encodeURIComponent(token)}`);
      const body = (await response.json()) as SharedReportResponse;

      if (!response.ok || body.ok !== true) {
        throw new Error(getSharedReportError(body, "공유 리포트를 불러오지 못했습니다."));
      }

      if (active) {
        setData(body);
        setStatus("idle");
      }
    }

    loadSharedReport().catch((error) => {
      if (active) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "공유 리포트를 불러오지 못했습니다.");
      }
    });

    return () => {
      active = false;
    };
  }, [token]);

  const summaryItems = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      ["승인", `${data.approvalSummary.approved}건`],
      ["보류", `${data.approvalSummary.held}건`],
      ["전송 초안", `${data.executionDraft?.payloadCount ?? 0}개`],
      ["차단", `${data.approvalSummary.blocked + (data.executionDraft?.validation?.blockerCount ?? 0)}건`],
      ["조회", `${data.link.accessCount}회`]
    ];
  }, [data]);

  return (
    <main className="account-page shared-report-page">
      <header className="account-header shared-report-header">
        <Link className="landing-brand" href="/">
          <span>SA</span>
          Naver SA Autopilot
        </Link>
        <nav aria-label="공유 리포트 메뉴">
          <Link href="/login">로그인</Link>
          <Link href="/signup">회원가입</Link>
        </nav>
      </header>

      {status === "loading" ? (
        <section className="account-panel history-detail-loading">
          <span className="skeleton-line wide" />
          <span className="skeleton-line" />
          <span className="skeleton-line short" />
        </section>
      ) : null}

      {status === "error" ? (
        <section className="account-panel history-detail-empty shared-report-empty">
          <KeyRound size={24} />
          <strong>공유 리포트를 열 수 없습니다</strong>
          <span>{message}</span>
          <Link className="icon-button subtle" href="/">
            홈으로 이동
          </Link>
        </section>
      ) : null}

      {data ? (
        <>
          <section className="account-hero shared-report-hero">
            <p className="eyebrow">Limited Shared Report</p>
            <h1>{data.run.brandName}</h1>
            <p>
              {productTypeLabel(data.run.productType)} / {data.run.vertical} / {formatKoreanDateTime(data.run.createdAt)}
            </p>
            <div className="history-context-strip shared-report-strip" aria-label="공개 리포트 맥락">
              <div>
                <span>워크스페이스</span>
                <strong>{data.run.workspaceName ?? "미기록"}</strong>
                <em>{data.run.workspaceMode ? plannerModeLabel(data.run.workspaceMode) : "공유 리포트"}</em>
              </div>
              <div>
                <span>링크 만료</span>
                <strong>{formatKoreanDateTime(data.link.expiresAt)}</strong>
                <em>7일 제한 공유</em>
              </div>
              <div>
                <span>공개 범위</span>
                <strong>payload 제외</strong>
                <em>audit/internal key hidden</em>
              </div>
            </div>
            <div className="history-detail-actions">
              <a className="icon-button primary" href={data.run.siteUrl} rel="noreferrer" target="_blank">
                <ExternalLink size={15} />
                사이트 확인
              </a>
              <Link className="icon-button subtle" href="/signup">
                팀 계정 만들기
              </Link>
            </div>
          </section>

          <section className="history-detail-summary" aria-label="공유 리포트 요약">
            {summaryItems.map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </section>

          <section className="history-detail-grid shared-report-grid">
            <article className="history-detail-panel">
              <div className="history-panel-title">
                <ShieldCheck size={19} />
                <div>
                  <p className="eyebrow">Safety</p>
                  <h2>공유 범위</h2>
                </div>
              </div>
              <div className="shared-report-safety">
                <span>Live blocked</span>
                <span>Delete blocked</span>
                <span>Raw payload hidden</span>
                <span>Audit hidden</span>
              </div>
              {data.executionDraft ? (
                <div className="shared-draft-card">
                  <span className={`status-pill ${draftStatusClass(data.executionDraft.status)}`}>
                    {draftStatusLabel(data.executionDraft.status)}
                  </span>
                  <strong>승인 {data.executionDraft.approvedChangeCount}건 / payload {data.executionDraft.payloadCount}개</strong>
                  <p>
                    테스트 실행 {data.executionDraft.validation?.canExecuteTest ? "가능" : "차단"} / 경고{" "}
                    {data.executionDraft.validation?.warningCount ?? 0}건
                  </p>
                  <em>{formatKoreanDateTime(data.executionDraft.generatedAt)}</em>
                </div>
              ) : (
                <div className="history-detail-empty-inline">
                  <FileText size={18} />
                  <span>저장된 전송 초안이 없습니다.</span>
                </div>
              )}
            </article>

            <aside className="history-detail-side">
              <article className="history-detail-panel">
                <div className="history-panel-title">
                  <Clock3 size={19} />
                  <div>
                    <p className="eyebrow">Run</p>
                    <h2>운영 조건</h2>
                  </div>
                </div>
                <dl className="history-info-list">
                  <div>
                    <dt>월 예산</dt>
                    <dd>{formatWon(data.run.monthlyBudget)}</dd>
                  </div>
                  <div>
                    <dt>최대 입찰가</dt>
                    <dd>{formatWon(data.run.maxBid)}</dd>
                  </div>
                  <div>
                    <dt>모드</dt>
                    <dd>{plannerModeLabel(data.run.mode)}</dd>
                  </div>
                </dl>
              </article>

              <article className="history-detail-panel">
                <div className="history-panel-title">
                  <ListChecks size={19} />
                  <div>
                    <p className="eyebrow">Approval</p>
                    <h2>승인 요약</h2>
                  </div>
                </div>
                <div className="history-change-list compact">
                  {data.stagedChanges.slice(0, 8).map((change, index) => (
                    <div key={`${change.target}-${change.action}-${index}`}>
                      <span className={`status-pill ${decisionClass(change.decision)}`}>
                        {decisionLabel(change.decision)}
                      </span>
                      <strong>{change.target}</strong>
                      <p>
                        {change.entityType} / {change.action} / {riskLabel(change.risk)}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            </aside>
          </section>

          <section className="history-detail-grid secondary shared-report-secondary">
            <article className="history-detail-panel">
              <div className="history-panel-title">
                <ListChecks size={19} />
                <div>
                  <p className="eyebrow">Keywords</p>
                  <h2>상위 키워드</h2>
                </div>
              </div>
              <div className="history-keyword-list">
                {data.keywords.map((keyword, index) => (
                  <div key={`${keyword.term}-${keyword.adGroupName}-${index}`}>
                    <strong>{keyword.term}</strong>
                    <span>{keyword.adGroupName}</span>
                    <em>
                      {formatWon(keyword.bid)} / 클릭 {formatKoreanNumber(keyword.expectedClicks)}
                    </em>
                  </div>
                ))}
              </div>
            </article>

            <article className="history-detail-panel">
              <div className="history-panel-title">
                <FileText size={19} />
                <div>
                  <p className="eyebrow">Ad Groups</p>
                  <h2>광고그룹</h2>
                </div>
              </div>
              <div className="history-keyword-list">
                {data.adGroups.map((group, index) => (
                  <div key={`${group.name}-${index}`}>
                    <strong>{group.name}</strong>
                    <span>{group.description}</span>
                    <em>
                      키워드 {group.keywordCount}개 / 일 예산 {formatWon(group.dailyBudget)}
                    </em>
                  </div>
                ))}
              </div>
            </article>

            {data.run.productType === "shoppingSearch" ? (
              <article className="history-detail-panel">
                <div className="history-panel-title">
                  <FileText size={19} />
                  <div>
                    <p className="eyebrow">Product Groups</p>
                    <h2>상품그룹 추천</h2>
                  </div>
                </div>
                <div className="history-keyword-list">
                  {data.productGroups.length === 0 ? (
                    <span>공유 가능한 상품그룹 추천이 없습니다.</span>
                  ) : (
                    data.productGroups.map((group, index) => (
                      <div key={`${group.name}-${index}`}>
                        <strong>{group.name}</strong>
                        <span>
                          {group.sourceGroup} / query {formatKoreanNumber(group.queryCount)}
                        </span>
                        <em>{group.productHints.join(", ") || "상품 힌트 없음"}</em>
                      </div>
                    ))
                  )}
                </div>
              </article>
            ) : null}
          </section>
        </>
      ) : null}
    </main>
  );
}

function decisionLabel(decision: string) {
  const labels: Record<string, string> = {
    approved: "승인",
    held: "보류",
    pending: "대기",
    executed: "실행",
    failed: "실패"
  };

  return labels[decision] ?? decision;
}

function decisionClass(decision: string) {
  return decision === "approved" || decision === "executed" ? "include" : decision === "held" ? "review" : "neutral";
}

function riskLabel(risk: string) {
  return risk === "low" ? "낮음" : risk === "medium" ? "검토" : "차단";
}

function getSharedReportError(response: SharedReportResponse, fallback: string) {
  return "error" in response && response.error ? response.error : fallback;
}
