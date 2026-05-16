"use client";

import Link from "next/link";
import {
  ArrowRight,
  DatabaseZap,
  Download,
  FileClock,
  ListFilter,
  RefreshCw,
  Search,
  ShieldCheck
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/app/components/auth/AuthGate";
import { useAuth } from "@/app/components/auth/AuthProvider";

type HistoryRun = {
  id: string;
  brandName: string;
  siteUrl: string;
  vertical: string;
  mode: "agency" | "advertiser";
  productType: "powerlink" | "shoppingSearch";
  monthlyBudget: number;
  maxBid: number;
  expectedClicks: number | null;
  avgCpc: number | null;
  adGroupCount: number | null;
  createdBy: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
  createdAt: string;
  approvalSummary: {
    approved: number;
    held: number;
    pending: number;
    blocked: number;
  };
  executionDraft: {
    status: "blocked" | "ready" | "executed" | "failed";
    approvedChangeCount: number;
    blockerCount: number;
    warningCount: number;
    createdAt: string;
  } | null;
};

type HistoryResponse = {
  ok: true;
  runs: HistoryRun[];
  total: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
  scope: "mine" | "all";
};

type ProductFilter = "all" | "powerlink" | "shoppingSearch";
type DraftFilter = "all" | "ready" | "blocked" | "failed" | "executed" | "none";
type DateFilter = "all" | "7" | "30";

const numberFormatter = new Intl.NumberFormat("ko-KR");

export function HistoryListClient() {
  return (
    <AuthGate>
      <HistoryListContent />
    </AuthGate>
  );
}

function HistoryListContent() {
  const { getAccessToken } = useAuth();
  const [runs, setRuns] = useState<HistoryRun[]>([]);
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [status, setStatus] = useState<"idle" | "loading" | "loadingMore" | "error">("loading");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [productFilter, setProductFilter] = useState<ProductFilter>("all");
  const [draftFilter, setDraftFilter] = useState<DraftFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [nextOffset, setNextOffset] = useState<number | null>(null);

  const fetchHistory = useCallback(async (offset: number) => {
    const token = await getAccessToken();

    if (!token) {
      throw new Error("로그인이 필요합니다.");
    }

    const response = await fetch(`/api/plans/history?limit=25&offset=${offset}`, {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    const data = (await response.json()) as HistoryResponse | { ok?: false; error?: string };

    if (!response.ok || data.ok !== true) {
      throw new Error("error" in data && data.error ? data.error : "저장 이력을 불러오지 못했습니다.");
    }

    return data;
  }, [getAccessToken]);

  const loadHistory = useCallback(async () => {
    setStatus("loading");
    setMessage("");

    try {
      const data = await fetchHistory(0);

      setRuns(data.runs);
      setNextOffset(data.nextOffset);
      setScope(data.scope);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "저장 이력을 불러오지 못했습니다.");
    }
  }, [fetchHistory]);

  async function loadMoreHistory() {
    if (nextOffset === null) {
      return;
    }

    setStatus("loadingMore");
    setMessage("");

    try {
      const data = await fetchHistory(nextOffset);

      setRuns((current) => [...current, ...data.runs]);
      setNextOffset(data.nextOffset);
      setScope(data.scope);
      setStatus("idle");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "저장 이력을 더 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadHistory().catch(() => {
        setStatus("error");
        setMessage("저장 이력을 불러오지 못했습니다.");
      });
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadHistory]);

  const summary = useMemo(
    () => ({
      total: runs.length,
      approved: runs.reduce((total, run) => total + run.approvalSummary.approved, 0),
      blocked: runs.reduce(
        (total, run) => total + Math.max(run.approvalSummary.blocked, run.executionDraft?.blockerCount ?? 0),
        0
      ),
      readyDrafts: runs.filter((run) => run.executionDraft?.status === "ready").length
    }),
    [runs]
  );

  const filteredRuns = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return runs.filter((run) => {
      const matchesProduct = productFilter === "all" || run.productType === productFilter;
      const draftStatus = run.executionDraft?.status ?? "none";
      const matchesDraft = draftFilter === "all" || draftFilter === draftStatus;
      const matchesDate = isWithinDateFilter(run.createdAt, dateFilter);
      const matchesQuery =
        !needle ||
        [
          run.brandName,
          run.siteUrl,
          run.vertical,
          run.createdBy,
          run.workspaceName,
          productLabel(run.productType),
          modeLabel(run.mode),
          run.id
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle);

      return matchesProduct && matchesDraft && matchesDate && matchesQuery;
    });
  }, [dateFilter, draftFilter, productFilter, query, runs]);

  function downloadFilteredCsv() {
    if (filteredRuns.length === 0) {
      return;
    }

    const rows = [
      [
        "planning_run_id",
        "brand",
        "workspace",
        "product_type",
        "mode",
        "vertical",
        "created_by",
        "created_at",
        "approved",
        "held",
        "pending",
        "blocked",
        "draft_status",
        "draft_blockers",
        "monthly_budget",
        "max_bid",
        "site_url"
      ],
      ...filteredRuns.map((run) => [
        run.id,
        run.brandName,
        run.workspaceName ?? "",
        productLabel(run.productType),
        modeLabel(run.mode),
        run.vertical,
        run.createdBy ?? "",
        run.createdAt,
        String(run.approvalSummary.approved),
        String(run.approvalSummary.held),
        String(run.approvalSummary.pending),
        String(run.approvalSummary.blocked),
        run.executionDraft ? draftStatusLabel(run.executionDraft.status) : "초안 없음",
        String(run.executionDraft?.blockerCount ?? 0),
        String(run.monthlyBudget),
        String(run.maxBid),
        run.siteUrl
      ])
    ];
    const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `naver-sa-history-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="account-page history-browser-page">
      <header className="account-header">
        <Link className="landing-brand" href="/">
          <span>SA</span>
          Naver SA Autopilot
        </Link>
        <nav aria-label="저장 이력 메뉴">
          <Link href="/workspace">워크스페이스</Link>
          <Link href="/mypage">마이페이지</Link>
        </nav>
      </header>

      <section className="account-hero history-browser-hero">
        <p className="eyebrow">Saved Operations</p>
        <h1>저장 이력</h1>
        <p>Planning run, 승인 결정, execution draft를 검색하고 상세 기록으로 다시 들어갑니다.</p>
        <div className="history-browser-hero-actions">
          <Link className="icon-button primary" href="/workspace">
            워크스페이스 열기
          </Link>
          <button
            className="icon-button subtle"
            disabled={status === "loading" || status === "loadingMore"}
            type="button"
            onClick={loadHistory}
          >
            <RefreshCw size={17} />
            새로고침
          </button>
          <button
            className="icon-button subtle"
            disabled={filteredRuns.length === 0}
            type="button"
            onClick={downloadFilteredCsv}
          >
            <Download size={17} />
            CSV
          </button>
        </div>
      </section>

      <section className="history-detail-summary history-browser-summary" aria-label="저장 이력 요약">
        <article>
          <FileClock size={18} />
          <span>저장 이력</span>
          <strong>{summary.total}건</strong>
        </article>
        <article>
          <ShieldCheck size={18} />
          <span>승인 항목</span>
          <strong>{summary.approved}건</strong>
        </article>
        <article>
          <ListFilter size={18} />
          <span>Ready draft</span>
          <strong>{summary.readyDrafts}건</strong>
        </article>
        <article>
          <DatabaseZap size={18} />
          <span>차단 항목</span>
          <strong>{summary.blocked}건</strong>
        </article>
      </section>

      <section className="account-panel history-browser-filter" aria-label="저장 이력 검색과 필터">
        <label className="search-field">
          <Search size={16} />
          <span className="sr-only">저장 이력 검색</span>
          <input
            placeholder="브랜드, 워크스페이스, 저장자, URL 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="segmented-control history-filter-control product-filter-control" aria-label="상품 유형 필터">
          {(["all", "powerlink", "shoppingSearch"] as const).map((filter) => (
            <button
              aria-pressed={productFilter === filter}
              className={productFilter === filter ? "active" : ""}
              key={filter}
              type="button"
              onClick={() => setProductFilter(filter)}
            >
              {productFilterLabel(filter)}
            </button>
          ))}
        </div>
        <div className="segmented-control history-filter-control draft-filter-control" aria-label="초안 상태 필터">
          {(["all", "ready", "blocked", "failed", "executed", "none"] as const).map((filter) => (
            <button
              aria-pressed={draftFilter === filter}
              className={draftFilter === filter ? "active" : ""}
              key={filter}
              type="button"
              onClick={() => setDraftFilter(filter)}
            >
              {draftFilterLabel(filter)}
            </button>
          ))}
        </div>
        <div className="segmented-control history-filter-control date-filter-control" aria-label="기간 필터">
          {(["all", "7", "30"] as const).map((filter) => (
            <button
              aria-pressed={dateFilter === filter}
              className={dateFilter === filter ? "active" : ""}
              key={filter}
              type="button"
              onClick={() => setDateFilter(filter)}
            >
              {dateFilterLabel(filter)}
            </button>
          ))}
        </div>
      </section>

      <section className="account-panel history-browser-panel">
        <div className="history-browser-heading">
          <div>
            <p className="eyebrow">{scope === "all" ? "Admin Scope" : "My Scope"}</p>
            <h2>이력 탐색</h2>
            <p>
              현재 조건에 맞는 이력 {filteredRuns.length}건을 표시합니다. 상세 화면에서 payload, 승인 로그, audit event를
              확인할 수 있습니다.
            </p>
          </div>
          <span className="status-pill neutral">최근 25건</span>
        </div>

        {status === "loading" ? (
          <div className="history-empty">
            <span className="skeleton-line wide" />
            <span className="skeleton-line" />
            <span className="skeleton-line short" />
          </div>
        ) : null}

        {status === "error" ? (
          <div className="history-empty">
            <DatabaseZap size={20} />
            <strong>저장 이력을 불러오지 못했습니다</strong>
            <span>{message}</span>
          </div>
        ) : null}

        {status === "idle" && runs.length === 0 ? (
          <div className="history-empty">
            <FileClock size={20} />
            <strong>아직 저장된 이력이 없습니다</strong>
            <span>워크스페이스에서 초안 검증 후 이력 저장을 실행하면 이 화면에 표시됩니다.</span>
          </div>
        ) : null}

        {status === "idle" && runs.length > 0 && filteredRuns.length === 0 ? (
          <div className="history-empty">
            <Search size={20} />
            <strong>조건에 맞는 이력이 없습니다</strong>
            <span>검색어 또는 필터를 조정해 주세요.</span>
          </div>
        ) : null}

        {filteredRuns.length > 0 ? (
          <div className="history-browser-list">
            {filteredRuns.map((run) => (
              <Link className="history-browser-item" href={`/history/${run.id}`} key={run.id}>
                <div>
                  <span className="status-pill include">{productLabel(run.productType)}</span>
                  <span className={`status-pill ${draftStatusClass(run.executionDraft?.status)}`}>
                    {run.executionDraft ? draftStatusLabel(run.executionDraft.status) : "초안 없음"}
                  </span>
                  {run.workspaceName ? <span className="status-pill neutral">{run.workspaceName}</span> : null}
                  <strong>{run.brandName}</strong>
                  <p>
                    {run.vertical} / {modeLabel(run.mode)} / {run.createdBy ?? "저장자 미기록"} /{" "}
                    {formatDateTime(run.createdAt)}
                  </p>
                  <div className="history-browser-validation" aria-label="초안 검증 요약">
                    <span>payload {run.executionDraft?.approvedChangeCount ?? 0}</span>
                    <span>차단 {run.executionDraft?.blockerCount ?? 0}</span>
                    <span>경고 {run.executionDraft?.warningCount ?? 0}</span>
                  </div>
                </div>
                <dl>
                  <div>
                    <dt>승인</dt>
                    <dd>{run.approvalSummary.approved}건</dd>
                  </div>
                  <div>
                    <dt>보류</dt>
                    <dd>{run.approvalSummary.held}건</dd>
                  </div>
                  <div>
                    <dt>예산</dt>
                    <dd>{formatCompactWon(run.monthlyBudget)}</dd>
                  </div>
                  <div>
                    <dt>키워드그룹</dt>
                    <dd>{run.adGroupCount ? `${numberFormatter.format(run.adGroupCount)}개` : "미기록"}</dd>
                  </div>
                </dl>
                <span className="history-item-action">
                  상세
                  <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        ) : null}
        {status !== "loading" && nextOffset !== null ? (
          <button
            className="icon-button subtle history-load-more"
            disabled={status === "loadingMore"}
            type="button"
            onClick={loadMoreHistory}
          >
            <RefreshCw size={17} />
            {status === "loadingMore" ? "불러오는 중" : "더 보기"}
          </button>
        ) : null}
      </section>
    </main>
  );
}

function productFilterLabel(value: ProductFilter) {
  const labels = {
    all: "전체",
    powerlink: "파워링크",
    shoppingSearch: "쇼핑검색"
  };

  return labels[value];
}

function draftFilterLabel(value: DraftFilter) {
  const labels = {
    all: "전체",
    ready: "Ready",
    blocked: "차단",
    failed: "실패",
    executed: "실행",
    none: "초안 없음"
  };

  return labels[value];
}

function dateFilterLabel(value: DateFilter) {
  const labels = {
    all: "전체",
    "7": "7일",
    "30": "30일"
  };

  return labels[value];
}

function isWithinDateFilter(value: string, filter: DateFilter) {
  if (filter === "all") {
    return true;
  }

  const date = new Date(value).getTime();

  if (!Number.isFinite(date)) {
    return false;
  }

  const days = Number(filter);
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;

  return date >= threshold;
}

function productLabel(productType: "powerlink" | "shoppingSearch") {
  return productType === "shoppingSearch" ? "쇼핑검색" : "파워링크";
}

function modeLabel(mode: "agency" | "advertiser") {
  return mode === "agency" ? "대행사" : "광고주";
}

function draftStatusLabel(status: "blocked" | "ready" | "executed" | "failed") {
  const labels = {
    blocked: "차단",
    ready: "Ready",
    executed: "실행",
    failed: "실패"
  };

  return labels[status];
}

function draftStatusClass(status: "blocked" | "ready" | "executed" | "failed" | undefined) {
  if (status === "ready" || status === "executed") {
    return "include";
  }

  if (status === "blocked" || status === "failed") {
    return "review";
  }

  return "neutral";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatCompactWon(value: number) {
  if (value >= 100000000) {
    return `${numberFormatter.format(Math.round(value / 100000000))}억`;
  }

  if (value >= 10000) {
    return `${numberFormatter.format(Math.round(value / 10000))}만`;
  }

  return `${numberFormatter.format(value)}원`;
}

function escapeCsvCell(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}
