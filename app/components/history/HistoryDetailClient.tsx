"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Copy,
  DatabaseZap,
  Download,
  FileJson,
  History,
  Link2Off,
  ListChecks,
  Share2,
  ShieldAlert
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/app/components/auth/AuthGate";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { redactSensitiveErrorText } from "@/lib/error-redaction";
import { formatKoreanDateTime, formatKoreanNumber, formatWon } from "@/lib/formatters";
import {
  shoppingLinkageStatusLabel,
  type ShoppingLinkageSummary
} from "@/lib/shopping-linkage";
import { draftStatusClass, draftStatusLabel, plannerModeLabel, productTypeLabel } from "@/lib/ui-labels";

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
    shoppingLinkage: ShoppingLinkageSummary;
    shoppingLinkageCaptured: boolean;
    plannerMetadata: {
      captured: boolean;
      industryTemplate: {
        name: string;
        landingChecks: string[];
        copyRules: string[];
        negativeThemes: string[];
      };
      benchmarkFeatures: Array<{
        name: string;
        status: "implemented" | "partial" | "planned";
        description: string;
      }>;
      operationRules: Array<{
        name: string;
        trigger: string;
        recommendation: string;
        automationLevel: string;
      }>;
    };
    createdBy: string | null;
    createdByUserLinked: boolean;
    workspaceId: string | null;
    workspaceName: string | null;
    workspaceMode: "agency" | "advertiser" | null;
    workspaceOwnerMatchesCreator: boolean | null;
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
  productGroups: Array<{
    id: string;
    name: string;
    sourceGroup: string;
    queryCount: number;
    productHints: string[];
    feedActions: string[];
    createdAt: string;
  }>;
  productGroupsCaptured: boolean;
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
    executionContext: {
      campaignId?: string;
      pcChannelId?: string;
      mobileChannelId?: string;
      shoppingChannelId?: string;
      productGroupId?: string;
      productGroupBusinessChannelId?: string;
      adgroupIdsByName?: Record<string, string>;
    };
    executionContextCaptured: boolean;
    generatedAt: string;
    createdAt: string;
    payloads: Array<{
      id: string;
      payloadKey: string;
      method: "POST" | "PUT";
      uri: string;
      entityType: string;
      target: string;
      params: unknown;
      body: unknown;
      safety: unknown;
      results: Array<{
        id: string;
        executionDraftId: string | null;
        ok: boolean;
        status: number;
        target: string;
        naverEntityId: string | null;
        error: string | null;
        createdAt: string;
      }>;
    }>;
  }>;
  internalUserIdsExcluded: true;
  idempotencyKeysExcluded: true;
  auditEvents: Array<{
    id: string;
    eventType: string;
    actor: string | null;
    entityType: string | null;
    entityId: string | null;
    reason: string | null;
    createdAt: string;
    decision: string | null;
    target: string | null;
    note: string | null;
  }>;
  auditRawValuesExcluded: true;
};

type ShareLink = {
  id: string;
  status: "active" | "revoked";
  createdByEmail: string | null;
  expiresAt: string;
  lastAccessedAt: string | null;
  accessCount: number;
  createdAt: string;
  updatedAt: string;
  isExpired: boolean;
};

type ShareLinksResponse =
  | {
      ok: true;
      installed: true;
      planningRunId: string;
      links: ShareLink[];
    }
  | {
      ok?: false;
      installed?: boolean;
      error?: string;
      migration?: string;
    };

type CreateShareLinkResponse =
  | {
      ok: true;
      installed: true;
      planningRunId: string;
      shareUrl: string;
      expiresInDays: number;
      link: ShareLink;
    }
  | {
      ok?: false;
      installed?: boolean;
      error?: string;
      migration?: string;
    };

type RevokeShareLinkResponse =
  | {
      ok: true;
      installed: true;
      planningRunId: string;
      link: ShareLink;
    }
  | {
      ok?: false;
      installed?: boolean;
      error?: string;
      migration?: string;
    };

function visibleHistoryDetailError(message: string | null | undefined, fallback: string) {
  return redactSensitiveErrorText(message, fallback);
}

function visibleCaughtHistoryDetailError(error: unknown, fallback: string) {
  return visibleHistoryDetailError(error instanceof Error ? error.message : undefined, fallback);
}

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
  const [copiedPayloadKey, setCopiedPayloadKey] = useState<string | null>(null);
  const [copiedReference, setCopiedReference] = useState<string | null>(null);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [shareStatus, setShareStatus] = useState<"idle" | "loading" | "creating" | "revoking" | "error">("idle");
  const [shareMessage, setShareMessage] = useState("");
  const [createdShareUrl, setCreatedShareUrl] = useState("");

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
        cache: "no-store",
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const body = (await response.json()) as HistoryDetailResponse | { ok?: false; error?: string };

      if (!response.ok || body.ok !== true) {
        throw new Error(visibleHistoryDetailError("error" in body ? body.error : undefined, "저장 이력을 불러오지 못했습니다."));
      }

      if (active) {
        setData(body);
        setStatus("idle");
      }

      try {
        if (active) {
          setShareStatus("loading");
          setShareMessage("");
        }

        const links = await fetchShareLinks(planningRunId, token);

        if (active) {
          setShareLinks(links);
          setShareStatus("idle");
        }
      } catch (error) {
        if (active) {
          setShareStatus("error");
          setShareMessage(visibleCaughtHistoryDetailError(error, "공유 링크 상태를 불러오지 못했습니다."));
        }
      }
    }

    loadDetail().catch((error) => {
      if (active) {
        setStatus("error");
        setMessage(visibleCaughtHistoryDetailError(error, "저장 이력을 불러오지 못했습니다."));
      }
    });

    return () => {
      active = false;
    };
  }, [getAccessToken, planningRunId]);

  const latestDraft = data?.executionDrafts[0];
  const latestExecutionContextRows = useMemo(() => executionContextRows(latestDraft?.executionContext ?? {}), [latestDraft]);
  const approvalAuditEvents = useMemo(
    () => data?.auditEvents.filter((event) => event.eventType.startsWith("staged_change.")) ?? [],
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
      ["차단", `${latestDraft?.validation?.blockerCount ?? 0}건`],
      ["Audit", `${data.auditEvents.length}건`]
    ];
  }, [data, latestDraft]);

  async function copyPayloadJson(payload: NonNullable<typeof latestDraft>["payloads"][number]) {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(formatPayloadJson(payload));
    setCopiedPayloadKey(payload.payloadKey);
    window.setTimeout(() => {
      setCopiedPayloadKey((current) => (current === payload.payloadKey ? null : current));
    }, 1500);
  }

  async function copyReference(referenceKey: string, value: string) {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopiedReference(referenceKey);
    window.setTimeout(() => {
      setCopiedReference((current) => (current === referenceKey ? null : current));
    }, 1500);
  }

  function downloadLatestPayloads() {
    if (!data || !latestDraft) {
      return;
    }

    downloadTextFile(
      JSON.stringify(
        {
          planningRunId: data.run.id,
          draftKey: latestDraft.draftKey,
          draftId: latestDraft.draftId,
          payloads: latestDraft.payloads
        },
        null,
        2
      ),
      `${safeFileName(data.run.brandName)}-saved-payloads.json`,
      "application/json;charset=utf-8"
    );
  }

  function downloadHistoryMemo() {
    if (!data) {
      return;
    }

    downloadTextFile(
      buildHistoryMemoMarkdown(data),
      `${safeFileName(data.run.brandName)}-history-memo.md`,
      "text/markdown;charset=utf-8"
    );
  }

  async function createShareLink() {
    setShareStatus("creating");
    setShareMessage("");
    setCreatedShareUrl("");

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error("로그인이 필요합니다.");
      }

      const response = await fetch(`/api/plans/history/${planningRunId}/share-links`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          expiresInDays: 7
        })
      });
      const body = (await response.json()) as CreateShareLinkResponse;

      if (!response.ok || body.ok !== true) {
        throw new Error(getShareResponseError(body, "공유 링크를 생성하지 못했습니다."));
      }

      setShareLinks((current) => [body.link, ...current]);
      setCreatedShareUrl(body.shareUrl);
      setShareMessage(`${body.expiresInDays}일 제한 공유 링크를 생성했습니다.`);
      setShareStatus("idle");
    } catch (error) {
      setShareStatus("error");
      setShareMessage(visibleCaughtHistoryDetailError(error, "공유 링크를 생성하지 못했습니다."));
    }
  }

  async function revokeShareLink(shareId: string) {
    setShareStatus("revoking");
    setShareMessage("");

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error("로그인이 필요합니다.");
      }

      const response = await fetch(`/api/plans/history/${planningRunId}/share-links`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          shareId
        })
      });
      const body = (await response.json()) as RevokeShareLinkResponse;

      if (!response.ok || body.ok !== true) {
        throw new Error(getShareResponseError(body, "공유 링크를 폐기하지 못했습니다."));
      }

      setShareLinks((current) => current.map((link) => (link.id === body.link.id ? body.link : link)));
      setShareMessage("공유 링크를 폐기했습니다.");
      setShareStatus("idle");
    } catch (error) {
      setShareStatus("error");
      setShareMessage(visibleCaughtHistoryDetailError(error, "공유 링크를 폐기하지 못했습니다."));
    }
  }

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
              {productTypeLabel(data.run.productType)} / {data.run.vertical} / {formatKoreanDateTime(data.run.createdAt)}
            </p>
            <div className="history-context-strip" aria-label="저장 맥락">
              <div>
                <span>워크스페이스</span>
                <strong>{data.run.workspaceName ?? "미기록"}</strong>
                <em>{data.run.workspaceMode ? plannerModeLabel(data.run.workspaceMode) : data.run.workspaceId ? "ID 연결" : "연결 없음"}</em>
              </div>
              <div>
                <span>저장자</span>
                <strong>{data.run.createdBy ?? "미기록"}</strong>
                <em>{data.run.createdByUserLinked ? "회원 세션 저장" : "레거시 저장"}</em>
              </div>
              <div>
                <span>소유 맥락</span>
                <strong>{ownerContextLabel(data.run.workspaceOwnerMatchesCreator)}</strong>
                <em>live/delete blocked</em>
              </div>
            </div>
            <div className="history-detail-actions">
              <Link className="icon-button primary" href="/workspace">
                워크스페이스 열기
              </Link>
              <Link className="icon-button subtle" href={`/history?q=${encodeURIComponent(data.run.brandName)}`}>
                같은 브랜드 이력
              </Link>
              <button className="icon-button subtle" type="button" onClick={() => copyReference("planning-run-id", data.run.id)}>
                <Copy size={15} />
                {copiedReference === "planning-run-id" ? "복사됨" : "Run ID"}
              </button>
              <button
                className="icon-button subtle"
                type="button"
                onClick={() => copyReference("detail-link", buildHistoryDetailUrl(planningRunId))}
              >
                <Copy size={15} />
                {copiedReference === "detail-link" ? "복사됨" : "내부 링크"}
              </button>
              <button className="icon-button subtle" type="button" onClick={downloadHistoryMemo}>
                <Download size={15} />
                운영 메모
              </button>
              <button
                className="icon-button subtle"
                disabled={shareStatus === "creating" || shareStatus === "loading"}
                type="button"
                onClick={createShareLink}
              >
                <Share2 size={15} />
                {shareStatus === "creating" ? "생성 중" : "공유 링크"}
              </button>
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
                    <span className={`status-pill ${draftStatusClass(latestDraft.status)}`}>
                      {draftStatusLabel(latestDraft.status)}
                    </span>
                    <code>{latestDraft.draftKey}</code>
                    <span>{latestDraft.draftId}</span>
                  </div>
                  <div className="history-draft-toolbar">
                    <button
                      className="icon-button subtle compact"
                      disabled={latestDraft.payloads.length === 0}
                      type="button"
                      onClick={downloadLatestPayloads}
                    >
                      <Download size={15} />
                      Payload JSON
                    </button>
                    <button
                      className="icon-button subtle compact"
                      type="button"
                      onClick={() => copyReference("draft-id", latestDraft.draftId)}
                    >
                      <Copy size={14} />
                      {copiedReference === "draft-id" ? "복사됨" : "Draft ID"}
                    </button>
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
                      <strong>{formatKoreanDateTime(latestDraft.generatedAt)}</strong>
                    </div>
                  </div>
                  {latestExecutionContextRows.length > 0 ? (
                    <dl className="history-info-list execution-context-list">
                      {latestExecutionContextRows.map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : latestDraft.executionContextCaptured ? (
                    <p className="history-context-empty">이 draft는 별도 실행 연결값 없이 저장되었습니다.</p>
                  ) : (
                    <p className="history-context-empty">실행 연결값 컬럼이 아직 적용되지 않은 이력입니다.</p>
                  )}
                  <IssueList title="차단 항목" items={latestDraft.validation?.blockers ?? []} tone="danger" />
                  <IssueList title="경고 항목" items={latestDraft.validation?.warnings ?? []} tone="warning" />
                  <div className="history-payload-list">
                    {latestDraft.payloads.length === 0 ? (
                      <span>저장된 payload가 없습니다.</span>
                    ) : (
                      latestDraft.payloads.map((payload) => (
                        <div className="history-payload-item" key={payload.id}>
                          <div className="history-payload-row">
                            <div>
                              <strong>{payload.payloadKey}</strong>
                              <span>
                                {payload.method} {payload.uri}
                              </span>
                              <em>{payload.entityType} / {payload.target}</em>
                            </div>
                            <div className="history-payload-actions">
                              <span className="status-pill neutral">결과 {payload.results.length}건</span>
                              <button
                                className="icon-button subtle compact"
                                type="button"
                                onClick={() => copyPayloadJson(payload)}
                              >
                                <Copy size={14} />
                                {copiedPayloadKey === payload.payloadKey ? "복사됨" : "JSON"}
                              </button>
                            </div>
                          </div>
                          <details className="history-payload-json">
                            <summary>payload 본문</summary>
                            <pre>{formatPayloadJson(payload)}</pre>
                          </details>
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
                    <dd>{plannerModeLabel(data.run.mode)}</dd>
                  </div>
                  <div>
                    <dt>업종 템플릿</dt>
                    <dd>{data.run.plannerMetadata.industryTemplate.name}</dd>
                  </div>
                  <div>
                    <dt>워크스페이스</dt>
                    <dd>{data.run.workspaceName ?? "미기록"}</dd>
                  </div>
                  {data.run.productType === "shoppingSearch" ? (
                    <>
                      <div>
                        <dt>쇼핑 linkage</dt>
                        <dd>{shoppingLinkageStatusLabel(data.run.shoppingLinkage.status)}</dd>
                      </div>
                      <div>
                        <dt>상품그룹</dt>
                        <dd>{data.run.shoppingLinkage.productGroupId ?? "미기록"}</dd>
                      </div>
                    </>
                  ) : null}
                  <div>
                    <dt>저장자</dt>
                    <dd>{data.run.createdBy ?? "미기록"}</dd>
                  </div>
                </dl>
              </article>

              <article className="history-detail-panel history-share-panel">
                <div className="history-panel-title">
                  <Share2 size={19} />
                  <div>
                    <p className="eyebrow">Share</p>
                    <h2>제한 공유</h2>
                  </div>
                </div>
                <p className="history-share-note">
                  7일 제한 공개 리포트입니다. payload 본문, idempotency key, 내부 audit 원문은 제외됩니다.
                </p>
                <div className="history-share-actions">
                  <button
                    className="icon-button primary compact"
                    disabled={shareStatus === "creating" || shareStatus === "loading"}
                    type="button"
                    onClick={createShareLink}
                  >
                    <Share2 size={14} />
                    {shareStatus === "creating" ? "생성 중" : "링크 생성"}
                  </button>
                  {createdShareUrl ? (
                    <button
                      className="icon-button subtle compact"
                      type="button"
                      onClick={() => copyReference("share-url", createdShareUrl)}
                    >
                      <Copy size={14} />
                      {copiedReference === "share-url" ? "복사됨" : "링크 복사"}
                    </button>
                  ) : null}
                </div>
                {shareMessage ? (
                  <p className={`history-share-message ${shareStatus === "error" ? "error" : ""}`}>{shareMessage}</p>
                ) : null}
                {createdShareUrl ? (
                  <div className="history-share-created">
                    <span>방금 생성된 링크</span>
                    <code>{createdShareUrl}</code>
                  </div>
                ) : null}
                <div className="history-share-list">
                  {shareStatus === "loading" ? <span>공유 링크를 확인하는 중입니다.</span> : null}
                  {shareStatus !== "loading" && shareLinks.length === 0 ? <span>생성된 공유 링크가 없습니다.</span> : null}
                  {shareLinks.map((link) => (
                    <div key={link.id}>
                      <span className={`status-pill ${shareLinkClass(link)}`}>{shareLinkLabel(link)}</span>
                      <strong>{formatKoreanDateTime(link.expiresAt)} 만료</strong>
                      <p>
                        조회 {formatKoreanNumber(link.accessCount)}회
                        {link.lastAccessedAt ? ` / 최근 ${formatKoreanDateTime(link.lastAccessedAt)}` : ""}
                      </p>
                      <em>{link.createdByEmail ?? "생성자 미기록"}</em>
                      {link.status === "active" && !link.isExpired ? (
                        <button
                          className="icon-button subtle compact"
                          disabled={shareStatus === "revoking"}
                          type="button"
                          onClick={() => revokeShareLink(link.id)}
                        >
                          <Link2Off size={14} />
                          폐기
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
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
                        {change.decidedAt ? ` / ${formatKoreanDateTime(change.decidedAt)}` : ""}
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
                        <span className={`status-pill ${decisionClass(event.decision ?? "")}`}>
                          {approvalEventLabel(event.eventType)}
                        </span>
                        <p>{event.target ?? event.entityId ?? "대상 미기록"}</p>
                        <em>
                          {formatKoreanDateTime(event.createdAt)}
                          {event.actor ? ` / ${event.actor}` : ""}
                        </em>
                        {event.note ? <small>{event.note}</small> : null}
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
                      {formatWon(keyword.bid)} / 클릭 {formatKoreanNumber(keyword.expectedClicks)}
                    </em>
                  </div>
                ))}
              </div>
            </article>

            {data.run.productType === "shoppingSearch" ? (
              <article className="history-detail-panel">
                <div className="history-panel-title">
                  <ListChecks size={19} />
                  <div>
                    <p className="eyebrow">Product Groups</p>
                    <h2>상품그룹 추천</h2>
                  </div>
                </div>
                <div className="history-keyword-list">
                  {data.productGroups.length === 0 ? (
                    <span>{data.productGroupsCaptured ? "저장된 상품그룹 추천이 없습니다." : "상품그룹 추천 이력 테이블이 아직 적용되지 않았습니다."}</span>
                  ) : (
                    data.productGroups.map((group) => (
                      <div key={group.id}>
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

            <article className="history-detail-panel">
              <div className="history-panel-title">
                <ListChecks size={19} />
                <div>
                  <p className="eyebrow">Operations</p>
                  <h2>운영 룰</h2>
                </div>
              </div>
              <div className="history-keyword-list">
                {data.run.plannerMetadata.operationRules.length === 0 ? (
                  <span>
                    {data.run.plannerMetadata.captured
                      ? "저장된 운영 룰이 없습니다."
                      : "운영 룰 이력 컬럼이 아직 적용되지 않았습니다."}
                  </span>
                ) : (
                  data.run.plannerMetadata.operationRules.map((rule) => (
                    <div key={rule.name}>
                      <strong>{rule.name}</strong>
                      <span>{rule.trigger}</span>
                      <em>
                        {rule.recommendation}
                        {rule.automationLevel ? ` / ${rule.automationLevel}` : ""}
                      </em>
                    </div>
                  ))
                )}
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
                      <strong>{event.eventType}</strong>
                      <span>{formatKoreanDateTime(event.createdAt)}</span>
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

async function fetchShareLinks(planningRunId: string, token: string): Promise<ShareLink[]> {
  const response = await fetch(`/api/plans/history/${planningRunId}/share-links`, {
    cache: "no-store",
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  const body = (await response.json()) as ShareLinksResponse;

  if (!response.ok || body.ok !== true) {
    throw new Error(getShareResponseError(body, "공유 링크 상태를 불러오지 못했습니다."));
  }

  return body.links;
}

function shareLinkLabel(link: ShareLink) {
  if (link.status === "revoked") {
    return "폐기됨";
  }

  return link.isExpired ? "만료" : "활성";
}

function shareLinkClass(link: ShareLink) {
  if (link.status === "revoked" || link.isExpired) {
    return "review";
  }

  return "include";
}

function getShareResponseError(
  response: ShareLinksResponse | CreateShareLinkResponse | RevokeShareLinkResponse,
  fallback: string
) {
  return visibleHistoryDetailError("error" in response ? response.error : undefined, fallback);
}

function ownerContextLabel(ownerMatchesCreator: boolean | null) {
  if (ownerMatchesCreator === null) {
    return "이력 기반";
  }

  return ownerMatchesCreator ? "소유자 저장" : "멤버 저장";
}

function executionContextRows(context: HistoryDetailResponse["executionDrafts"][number]["executionContext"]) {
  const rows: Array<[string, string]> = [
    ["Campaign ID", context.campaignId ?? ""],
    ["PC channel ID", context.pcChannelId ?? ""],
    ["Mobile channel ID", context.mobileChannelId ?? ""],
    ["Shopping channel ID", context.shoppingChannelId ?? ""],
    ["Product group ID", context.productGroupId ?? ""],
    ["Product group channel ID", context.productGroupBusinessChannelId ?? ""]
  ].filter((row): row is [string, string] => Boolean(row[1]));
  const adgroupCount = context.adgroupIdsByName ? Object.keys(context.adgroupIdsByName).length : 0;

  return adgroupCount > 0 ? [...rows, ["Existing ad group map", `${adgroupCount}개`]] : rows;
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

function riskLabel(risk: string) {
  return risk === "low" ? "낮음" : risk === "medium" ? "검토" : "차단";
}

function formatPayloadJson(payload: HistoryDetailResponse["executionDrafts"][number]["payloads"][number]) {
  return JSON.stringify(
    {
      payloadKey: payload.payloadKey,
      method: payload.method,
      uri: payload.uri,
      entityType: payload.entityType,
      target: payload.target,
      params: payload.params,
      body: payload.body,
      safety: payload.safety,
      results: payload.results
    },
    null,
    2
  );
}

function buildHistoryDetailUrl(planningRunId: string) {
  if (typeof window === "undefined") {
    return `/history/${planningRunId}`;
  }

  return `${window.location.origin}/history/${planningRunId}`;
}

function buildHistoryMemoMarkdown(data: HistoryDetailResponse) {
  const latestDraft = data.executionDrafts[0];
  const validation = latestDraft?.validation;
  const contextRows = latestDraft ? executionContextRows(latestDraft.executionContext) : [];
  const lines = [
    "# Naver SA Saved Operation Memo",
    "",
    `- Planning run: ${data.run.id}`,
    `- Brand: ${data.run.brandName}`,
    `- Product: ${productTypeLabel(data.run.productType)}`,
    `- Industry template: ${data.run.plannerMetadata.industryTemplate.name}`,
    ...(data.run.productType === "shoppingSearch"
      ? [
          `- Shopping linkage: ${shoppingLinkageStatusLabel(data.run.shoppingLinkage.status)}`,
          `- Shopping channel ID: ${data.run.shoppingLinkage.shoppingChannelId ?? "not recorded"}`,
          `- Product group ID: ${data.run.shoppingLinkage.productGroupId ?? "not recorded"}`,
          `- Product group channel ID: ${data.run.shoppingLinkage.productGroupBusinessChannelId ?? "not recorded"}`
        ]
      : []),
    `- Vertical: ${data.run.vertical}`,
    `- Created: ${data.run.createdAt}`,
    `- Workspace: ${data.run.workspaceName ?? "not recorded"}`,
    `- Saved by: ${data.run.createdBy ?? "not recorded"}`,
    `- Detail link: ${buildHistoryDetailUrl(data.run.id)}`,
    "",
    "## Approval Summary",
    "",
    `- Approved: ${data.run.approvalSummary.approved}`,
    `- Held: ${data.run.approvalSummary.held}`,
    `- Pending: ${data.run.approvalSummary.pending}`,
    `- Blocked: ${data.run.approvalSummary.blocked}`,
    "",
    "## Execution Draft",
    "",
    latestDraft
      ? `- Status: ${draftStatusLabel(latestDraft.status)}\n- Draft ID: ${latestDraft.draftId}\n- Payloads: ${latestDraft.payloads.length}\n- Can execute test: ${
          validation?.canExecuteTest ? "yes" : "no"
        }\n- Blockers: ${validation?.blockerCount ?? 0}\n- Warnings: ${validation?.warningCount ?? 0}`
      : "- No execution draft saved.",
    ...(contextRows.length > 0
      ? ["", "## Execution Context", "", ...contextRows.map(([label, value]) => `- ${label}: ${value}`)]
      : []),
    "",
    "## Top Keywords",
    "",
    ...data.keywords.slice(0, 12).map((keyword) => `- ${keyword.term} (${keyword.adGroupName}) / bid ${keyword.bid}`),
    ...(data.run.plannerMetadata.operationRules.length > 0
      ? [
          "",
          "## Operation Rules",
          "",
          ...data.run.plannerMetadata.operationRules.map(
            (rule) => `- ${rule.name}: ${rule.trigger} -> ${rule.recommendation} (${rule.automationLevel || "manual"})`
          )
        ]
      : []),
    ...(data.productGroups.length > 0
      ? [
          "",
          "## Shopping Product Groups",
          "",
          ...data.productGroups.flatMap((group) => [
            `- ${group.name} (${group.sourceGroup}) / queries ${group.queryCount}`,
            `  - Product hints: ${group.productHints.join(", ") || "not recorded"}`,
            `  - Feed actions: ${group.feedActions.join(" / ") || "not recorded"}`
          ])
        ]
      : []),
    "",
    "## Recent Audit Events",
    "",
    ...(data.auditEvents.length > 0
      ? data.auditEvents
          .slice(0, 10)
          .map((event) => `- ${event.createdAt} / ${event.eventType} / ${event.actor ?? event.reason ?? "not recorded"}`)
      : ["- No audit events saved."]),
    "",
    "## Safety",
    "",
    "- Live execution: blocked in MVP",
    "- Delete execution: blocked in MVP",
    "- This memo excludes raw payload body data; download Payload JSON separately when needed."
  ];

  return lines.join("\n");
}

function downloadTextFile(content: string, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "naver-sa";
}
