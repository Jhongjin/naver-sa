"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  DatabaseZap,
  FileJson,
  History,
  ListChecks,
  ShieldAlert
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/app/components/auth/AuthGate";
import { useAuth } from "@/app/components/auth/AuthProvider";

type HistoryDetailResponse = {
  ok: true;
  run: {
    id: string;
    brandName: string;
    siteUrl: string;
    vertical: string;
    monthlyBudget: number;
    maxBid: number;
    mode: "agency" | "advertiser";
    productType: "powerlink" | "shoppingSearch";
    seedKeywords: string[];
    forecast: Record<string, unknown>;
    assumptions: string[];
    createdBy: string | null;
    createdByUserId: string | null;
    workspaceId: string | null;
    workspaceName: string | null;
    workspaceMode: "agency" | "advertiser" | null;
    workspaceOwnerUserId: string | null;
    createdAt: string;
    approvalSummary: {
      approved: number;
      held: number;
      pending: number;
      blocked: number;
    };
  };
  keywords: Array<{
    id: string;
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
    id: string;
    name: string;
    description: string;
    dailyBudget: number;
    keywordCount: number;
    expectedClicks: number;
    avgBid: number;
  }>;
  stagedChanges: Array<{
    id: string;
    externalKey: string;
    entityType: string;
    target: string;
    action: string;
    risk: string;
    details: string;
    decision: string;
    decidedAt: string | null;
    decidedBy: string | null;
    decisionNote: string | null;
    decisionSource: string | null;
  }>;
  executionDrafts: Array<{
    id: string;
    draftKey: string;
    draftId: string;
    approvedChangeCount: number;
    status: "blocked" | "ready" | "executed" | "failed";
    validation: {
      canExecuteTest?: boolean;
      blockerCount?: number;
      warningCount?: number;
      blockers?: Array<{ code: string; payloadId?: string; message: string }>;
      warnings?: Array<{ code: string; payloadId?: string; message: string }>;
    } | null;
    generatedAt: string;
    createdAt: string;
    payloads: Array<{
      id: string;
      payloadKey: string;
      idempotencyKey: string;
      method: "POST" | "PUT";
      uri: string;
      entityType: string;
      target: string;
      results: Array<{
        id: string;
        ok: boolean;
        status: number;
        target: string;
        naverEntityId: string | null;
        error: string | null;
        createdAt: string;
      }>;
    }>;
  }>;
  auditEvents: Array<{
    id: string;
    event_type: string;
    actor: string | null;
    entity_type: string | null;
    entity_id: string | null;
    before_value: Record<string, unknown> | null;
    after_value: Record<string, unknown> | null;
    reason: string | null;
    created_at: string;
  }>;
};

const numberFormatter = new Intl.NumberFormat("ko-KR");

export function HistoryDetailClient({ planningRunId }: { planningRunId: string }) {
  return (
    <AuthGate>
      <HistoryDetailContent planningRunId={planningRunId} />
    </AuthGate>
  );
}

function HistoryDetailContent({ planningRunId }: { planningRunId: string }) {
  const { getAccessToken } = useAuth();
  const [data, setData] = useState<HistoryDetailResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "idle">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      setStatus("loading");
      setMessage("");
      const token = await getAccessToken();

      if (!token) {
        throw new Error("로그인이 필요합니다.");
      }

      const response = await fetch(`/api/plans/history/${planningRunId}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const body = (await response.json()) as HistoryDetailResponse | { ok?: false; error?: string };

      if (!response.ok || body.ok !== true) {
        throw new Error("error" in body && body.error ? body.error : "저장 이력을 불러오지 못했습니다.");
      }

      if (active) {
        setData(body);
        setStatus("idle");
      }
    }

    loadDetail().catch((error) => {
      if (active) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "저장 이력을 불러오지 못했습니다.");
      }
    });

    return () => {
      active = false;
    };
  }, [getAccessToken, planningRunId]);

  const latestDraft = data?.executionDrafts[0];
  const approvalAuditEvents = useMemo(
    () => data?.auditEvents.filter((event) => event.event_type.startsWith("staged_change.")) ?? [],
    [data]
  );
  const summaryItems = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      ["승인", `${data.run.approvalSummary.approved}건`],
      ["보류", `${data.run.approvalSummary.held}건`],
      ["Payload", `${latestDraft?.payloads.length ?? 0}개`],
      ["차단", `${latestDraft?.validation?.blockerCount ?? 0}건`]
    ];
  }, [data, latestDraft]);

  return (
    <main className="account-page history-detail-page">
      <header className="account-header">
        <Link className="landing-brand" href="/">
          <span>SA</span>
          Naver SA Autopilot
        </Link>
        <nav aria-label="이력 메뉴">
          <Link href="/workspace">워크스페이스</Link>
          <Link href="/history">저장 이력</Link>
          <Link href="/mypage">마이페이지</Link>
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
        <section className="account-panel history-detail-empty">
          <DatabaseZap size={24} />
          <strong>저장 이력을 불러오지 못했습니다</strong>
          <span>{message}</span>
          <Link className="icon-button subtle" href="/mypage">
            <ArrowLeft size={17} />
            마이페이지
          </Link>
        </section>
      ) : null}

      {data ? (
        <>
          <section className="account-hero history-detail-hero">
            <Link className="history-back-link" href="/history">
              <ArrowLeft size={16} />
              저장 이력
            </Link>
            <p className="eyebrow">Saved Run Detail</p>
            <h1>{data.run.brandName}</h1>
            <p>
              {productLabel(data.run.productType)} / {data.run.vertical} / {formatDateTime(data.run.createdAt)}
            </p>
            <div className="history-context-strip" aria-label="저장 맥락">
              <div>
                <span>워크스페이스</span>
                <strong>{data.run.workspaceName ?? "미기록"}</strong>
                <em>{data.run.workspaceMode ? modeLabel(data.run.workspaceMode) : data.run.workspaceId ? "ID 연결" : "연결 없음"}</em>
              </div>
              <div>
                <span>저장자</span>
                <strong>{data.run.createdBy ?? "미기록"}</strong>
                <em>{data.run.createdByUserId ? "회원 세션 저장" : "레거시 저장"}</em>
              </div>
              <div>
                <span>소유 맥락</span>
                <strong>{ownerContextLabel(data.run.workspaceOwnerUserId, data.run.createdByUserId)}</strong>
                <em>live/delete blocked</em>
              </div>
            </div>
            <div className="history-detail-actions">
              <Link className="icon-button primary" href="/workspace">
                워크스페이스 열기
              </Link>
              <a className="icon-button subtle" href={data.run.siteUrl} rel="noreferrer" target="_blank">
                사이트 확인
              </a>
            </div>
          </section>

          <section className="history-detail-summary" aria-label="저장 이력 요약">
            {summaryItems.map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </section>

          <section className="history-detail-grid">
            <article className="history-detail-panel execution-panel">
              <div className="history-panel-title">
                <FileJson size={19} />
                <div>
                  <p className="eyebrow">Execution Draft</p>
                  <h2>전송 초안</h2>
                </div>
              </div>
              {latestDraft ? (
                <>
                  <div className="history-draft-meta">
                    <span className={`status-pill ${latestDraft.status === "ready" ? "include" : "review"}`}>
                      {draftStatusLabel(latestDraft.status)}
                    </span>
                    <code>{latestDraft.draftKey}</code>
                    <span>{latestDraft.draftId}</span>
                  </div>
                  <div className="history-validation-grid">
                    <div>
                      <span>테스트 실행</span>
                      <strong>{latestDraft.validation?.canExecuteTest ? "가능" : "차단"}</strong>
                    </div>
                    <div>
                      <span>경고</span>
                      <strong>{latestDraft.validation?.warningCount ?? 0}건</strong>
                    </div>
                    <div>
                      <span>생성</span>
                      <strong>{formatDateTime(latestDraft.generatedAt)}</strong>
                    </div>
                  </div>
                  <IssueList title="차단 항목" items={latestDraft.validation?.blockers ?? []} tone="danger" />
                  <IssueList title="경고 항목" items={latestDraft.validation?.warnings ?? []} tone="warning" />
                  <div className="history-payload-list">
                    {latestDraft.payloads.length === 0 ? (
                      <span>저장된 payload가 없습니다.</span>
                    ) : (
                      latestDraft.payloads.map((payload) => (
                        <div className="history-payload-item" key={payload.id}>
                          <div>
                            <strong>{payload.payloadKey}</strong>
                            <span>
                              {payload.method} {payload.uri}
                            </span>
                            <em>{payload.entityType} / {payload.target}</em>
                          </div>
                          <span className="status-pill neutral">결과 {payload.results.length}건</span>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="history-detail-empty-inline">
                  <ShieldAlert size={20} />
                  <span>저장된 execution draft가 없습니다.</span>
                </div>
              )}
            </article>

            <aside className="history-detail-side">
              <article className="history-detail-panel">
                <div className="history-panel-title">
                  <BadgeCheck size={19} />
                  <div>
                    <p className="eyebrow">Run</p>
                    <h2>기본 정보</h2>
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
                    <dd>{modeLabel(data.run.mode)}</dd>
                  </div>
                  <div>
                    <dt>워크스페이스</dt>
                    <dd>{data.run.workspaceName ?? "미기록"}</dd>
                  </div>
                  <div>
                    <dt>저장자</dt>
                    <dd>{data.run.createdBy ?? "미기록"}</dd>
                  </div>
                </dl>
              </article>

              <article className="history-detail-panel">
                <div className="history-panel-title">
                  <ListChecks size={19} />
                  <div>
                    <p className="eyebrow">Approval</p>
                    <h2>승인 큐</h2>
                  </div>
                </div>
                <div className="history-change-list">
                  {data.stagedChanges.map((change) => (
                    <div key={change.id}>
                      <span className={`status-pill ${decisionClass(change.decision)}`}>
                        {decisionLabel(change.decision)}
                      </span>
                      <strong>{change.target}</strong>
                      <p>
                        {change.entityType} / {change.action} / {riskLabel(change.risk)}
                        {change.decidedAt ? ` / ${formatDateTime(change.decidedAt)}` : ""}
                      </p>
                      {change.decisionNote || change.decidedBy ? (
                        <em>
                          {change.decisionNote ?? "메모 없음"}
                          {change.decidedBy ? ` / ${change.decidedBy}` : ""}
                        </em>
                      ) : null}
                    </div>
                  ))}
                </div>
                {approvalAuditEvents.length > 0 ? (
                  <div className="history-approval-timeline" aria-label="승인 결정 로그">
                    <strong>승인 결정 로그</strong>
                    {approvalAuditEvents.slice(0, 6).map((event) => (
                      <div key={event.id}>
                        <span className={`status-pill ${decisionClass(String(event.after_value?.decision ?? ""))}`}>
                          {approvalEventLabel(event.event_type)}
                        </span>
                        <p>{getAuditTextValue(event.after_value, "target") ?? event.entity_id ?? "대상 미기록"}</p>
                        <em>
                          {formatDateTime(event.created_at)}
                          {event.actor ? ` / ${event.actor}` : ""}
                        </em>
                        {getAuditTextValue(event.after_value, "note") ? (
                          <small>{getAuditTextValue(event.after_value, "note")}</small>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            </aside>
          </section>

          <section className="history-detail-grid secondary">
            <article className="history-detail-panel">
              <div className="history-panel-title">
                <CheckCircle2 size={19} />
                <div>
                  <p className="eyebrow">Keywords</p>
                  <h2>상위 키워드</h2>
                </div>
              </div>
              <div className="history-keyword-list">
                {data.keywords.slice(0, 12).map((keyword) => (
                  <div key={keyword.id}>
                    <strong>{keyword.term}</strong>
                    <span>{keyword.adGroupName}</span>
                    <em>
                      {formatWon(keyword.bid)} / 클릭 {numberFormatter.format(keyword.expectedClicks)}
                    </em>
                  </div>
                ))}
              </div>
            </article>

            <article className="history-detail-panel">
              <div className="history-panel-title">
                <History size={19} />
                <div>
                  <p className="eyebrow">Audit</p>
                  <h2>저장 이벤트</h2>
                </div>
              </div>
              <div className="history-audit-list">
                {data.auditEvents.length === 0 ? (
                  <span>기록된 audit event가 없습니다.</span>
                ) : (
                  data.auditEvents.map((event) => (
                    <div key={event.id}>
                      <strong>{event.event_type}</strong>
                      <span>{formatDateTime(event.created_at)}</span>
                      <em>{event.reason ?? event.actor ?? "사유 미기록"}</em>
                      {event.actor ? <small>{event.actor}</small> : null}
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>
        </>
      ) : null}
    </main>
  );
}

function IssueList({
  title,
  items,
  tone
}: {
  title: string;
  items: Array<{ code: string; payloadId?: string; message: string }>;
  tone: "danger" | "warning";
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={`history-issue-list ${tone}`}>
      <strong>{title}</strong>
      {items.map((item) => (
        <span key={`${item.code}-${item.payloadId ?? "draft"}`}>
          {item.payloadId ? `${item.payloadId}: ` : ""}
          {item.message}
        </span>
      ))}
    </div>
  );
}

function productLabel(productType: "powerlink" | "shoppingSearch") {
  return productType === "shoppingSearch" ? "쇼핑검색" : "파워링크";
}

function modeLabel(mode: "agency" | "advertiser") {
  return mode === "agency" ? "대행사" : "광고주";
}

function ownerContextLabel(ownerUserId: string | null, creatorUserId: string | null) {
  if (!ownerUserId || !creatorUserId) {
    return "이력 기반";
  }

  return ownerUserId === creatorUserId ? "소유자 저장" : "멤버 저장";
}

function draftStatusLabel(status: "blocked" | "ready" | "executed" | "failed") {
  const labels = {
    blocked: "차단",
    ready: "준비",
    executed: "실행",
    failed: "실패"
  };

  return labels[status];
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

function approvalEventLabel(eventType: string) {
  if (eventType.endsWith(".approved")) {
    return "승인";
  }

  if (eventType.endsWith(".held")) {
    return "보류";
  }

  return "기록";
}

function getAuditTextValue(value: Record<string, unknown> | null, key: string) {
  const field = value?.[key];

  return typeof field === "string" && field.trim() ? field : null;
}

function riskLabel(risk: string) {
  return risk === "low" ? "낮음" : risk === "medium" ? "검토" : "차단";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatWon(value: number) {
  return `${numberFormatter.format(value)}원`;
}
