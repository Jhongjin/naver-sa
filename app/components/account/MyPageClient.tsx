"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Building2, Clock3, LogOut, ShieldCheck } from "lucide-react";
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
        return;
      }

      const response = await fetch("/api/auth/session", {
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const data = (await response.json()) as SessionSummary | { ok?: false; error?: string };

      if (!active) {
        return;
      }

      if (!response.ok || data.ok !== true) {
        setError("세션 정보를 불러오지 못했습니다.");
        return;
      }

      setSessionSummary(data);
    }

    loadSession().catch(() => {
      if (active) {
        setError("세션 정보를 불러오지 못했습니다.");
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
          <span>계정 스캔, 초안 검증, 이력 저장</span>
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
    </main>
  );
}
