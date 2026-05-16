"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, Building2, Clock3, DatabaseZap, FileClock, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthGate } from "@/app/components/auth/AuthGate";
import { useAuth } from "@/app/components/auth/AuthProvider";

type SessionSummary = {
  ok: true;
  role: "member" | "admin";
  email: string | null;
  userId: string;
  capabilities: {
    canReadAccountInventory: boolean;
    canSaveDraftHistory: boolean;
    canManageUsers: boolean;
  };
  guardrails: {
    liveCampaignActivation: string;
    productionDeletion: string;
    externalWriteExecution: string;
  };
};

type HistoryRun = {
  id: string;
  brandName: string;
  vertical: string;
  productType: "powerlink" | "shoppingSearch";
  createdAt: string;
  expectedClicks: number | null;
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
  } | null;
};

type HistoryResponse = {
  ok: true;
  runs: HistoryRun[];
  total: number;
  scope: "mine" | "all";
};

export function MyPageClient() {
  return (
    <AuthGate>
      <MyPageContent />
    </AuthGate>
  );
}

function MyPageContent() {
  const router = useRouter();
  const { user, getAccessToken, signOut } = useAuth();
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [historyRuns, setHistoryRuns] = useState<HistoryRun[]>([]);
  const [historyStatus, setHistoryStatus] = useState<"idle" | "loading" | "error">("loading");
  const [error, setError] = useState("");
  const displayName =
    typeof user?.user_metadata?.display_name === "string" && user.user_metadata.display_name
      ? user.user_metadata.display_name
      : user?.email ?? "사용자";
  const companyName =
    typeof user?.user_metadata?.company_name === "string" && user.user_metadata.company_name
      ? user.user_metadata.company_name
      : "회사명 미등록";

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const token = await getAccessToken();

      if (!token) {
        setError("로그인이 필요합니다.");
        setHistoryStatus("error");
        return;
      }

      const response = await fetch("/api/auth/session", {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const historyResponse = fetch("/api/plans/history?limit=6", {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const data = (await response.json()) as SessionSummary | { ok?: false; error?: string };
      const historyResult = await historyResponse;
      const historyData = (await historyResult.json()) as HistoryResponse | { ok?: false; error?: string };

      if (!active) {
        return;
      }

      if (!response.ok || data.ok !== true) {
        setError("세션 정보를 불러오지 못했습니다.");
        return;
      }

      setSessionSummary(data);

      if (historyResult.ok && historyData.ok === true) {
        setHistoryRuns(historyData.runs);
        setHistoryStatus("idle");
      } else {
        setHistoryStatus("error");
      }
    }

    loadSession().catch(() => {
      if (active) {
        setError("세션 정보를 불러오지 못했습니다.");
        setHistoryStatus("error");
      }
    });

    return () => {
      active = false;
    };
  }, [getAccessToken]);

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <main className="account-page">
      <header className="account-header">
        <Link className="landing-brand" href="/">
          <span>SA</span>
          Naver SA Autopilot
        </Link>
        <nav aria-label="계정 메뉴">
          <Link href="/workspace">워크스페이스</Link>
          {sessionSummary?.role === "admin" ? <Link href="/admin/users">회원관리</Link> : null}
        </nav>
      </header>

      <section className="account-hero">
        <p className="eyebrow">My Page</p>
        <h1>{displayName}</h1>
        <p>{user?.email}</p>
      </section>

      <section className="account-grid">
        <article>
          <Building2 size={22} />
          <strong>소속</strong>
          <span>{companyName}</span>
        </article>
        <article>
          <ShieldCheck size={22} />
          <strong>권한</strong>
          <span>{sessionSummary?.role === "admin" ? "관리자" : "멤버"}</span>
        </article>
        <article>
          <BadgeCheck size={22} />
          <strong>허용 작업</strong>
          <span>
            {sessionSummary
              ? [
                  sessionSummary.capabilities.canReadAccountInventory ? "계정 스캔" : null,
                  sessionSummary.capabilities.canSaveDraftHistory ? "이력 저장" : null,
                  sessionSummary.capabilities.canManageUsers ? "회원관리" : null
                ]
                  .filter(Boolean)
                  .join(", ")
              : "확인 중"}
          </span>
        </article>
        <article>
          <Clock3 size={22} />
          <strong>안전 정책</strong>
          <span>라이브 활성화와 삭제는 차단</span>
        </article>
      </section>

      <section className="account-panel">
        <div>
          <p className="eyebrow">Session</p>
          <h2>로그인 세션으로 보호 API를 호출합니다</h2>
          <p>
            운영자 코드 대신 Supabase Auth access token을 사용합니다. 토큰 값은 화면에 표시하지 않고 요청 헤더에만 포함합니다.
          </p>
          {error ? <p className="auth-message error">{error}</p> : null}
        </div>
        <div className="account-actions">
          <Link className="icon-button primary" href="/workspace">
            워크스페이스 열기
          </Link>
          <button className="icon-button subtle" type="button" onClick={handleSignOut}>
            <LogOut size={17} />
            로그아웃
          </button>
        </div>
      </section>

      <section className="account-panel history-panel">
        <div className="history-panel-heading">
          <div>
            <p className="eyebrow">Saved History</p>
            <h2>최근 저장 이력</h2>
            <p>워크스페이스에서 저장한 planning run과 execution draft 상태를 다시 확인합니다.</p>
          </div>
          <Link className="icon-button subtle" href="/workspace">
            <FileClock size={17} />
            워크스페이스
          </Link>
        </div>
        {historyStatus === "loading" ? (
          <div className="history-empty">
            <span className="skeleton-line wide" />
            <span className="skeleton-line" />
            <span className="skeleton-line short" />
          </div>
        ) : null}
        {historyStatus === "error" ? (
          <div className="history-empty">
            <DatabaseZap size={20} />
            <strong>저장 이력을 불러오지 못했습니다</strong>
            <span>잠시 후 새로고침하거나 Supabase readiness를 확인해 주세요.</span>
          </div>
        ) : null}
        {historyStatus === "idle" && historyRuns.length === 0 ? (
          <div className="history-empty">
            <FileClock size={20} />
            <strong>아직 저장된 이력이 없습니다</strong>
            <span>워크스페이스에서 초안 검증 후 이력 저장을 실행하면 여기에 표시됩니다.</span>
          </div>
        ) : null}
        {historyRuns.length > 0 ? (
          <div className="history-list">
            {historyRuns.map((run) => (
              <Link className="history-item history-item-link" href={`/history/${run.id}`} key={run.id}>
                <div>
                  <span className="status-pill include">{productLabel(run.productType)}</span>
                  <strong>{run.brandName}</strong>
                  <p>{run.vertical} / {formatDateTime(run.createdAt)}</p>
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
                    <dt>초안</dt>
                    <dd>{run.executionDraft ? draftStatusLabel(run.executionDraft.status) : "없음"}</dd>
                  </div>
                  <div>
                    <dt>차단</dt>
                    <dd>{run.executionDraft?.blockerCount ?? 0}건</dd>
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
      </section>
    </main>
  );
}

function productLabel(productType: "powerlink" | "shoppingSearch") {
  return productType === "shoppingSearch" ? "쇼핑검색" : "파워링크";
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
