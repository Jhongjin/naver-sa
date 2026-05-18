"use client";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/components/auth/AuthProvider";

type ApprovalState = "idle" | "checking" | "approved" | "pending" | "error";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, getAccessToken, signOut } = useAuth();
  const [approvalState, setApprovalState] = useState<ApprovalState>("idle");

  useEffect(() => {
    let active = true;

    async function checkApproval() {
      if (loading || !user) {
        setApprovalState("idle");
        return;
      }

      setApprovalState("checking");
      const token = await getAccessToken();

      if (!token) {
        if (active) {
          setApprovalState("error");
        }
        return;
      }

      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; code?: string };

      if (!active) {
        return;
      }

      if (response.ok && data.ok === true) {
        setApprovalState("approved");
        return;
      }

      if (data.code === "ADMIN_APPROVAL_REQUIRED") {
        setApprovalState("pending");
        return;
      }

      setApprovalState("error");
    }

    checkApproval().catch(() => {
      if (active) {
        setApprovalState("error");
      }
    });

    return () => {
      active = false;
    };
  }, [getAccessToken, loading, user]);

  async function handleSignOut() {
    await signOut();
    setApprovalState("idle");
  }

  if (loading) {
    return (
      <main className="auth-gate">
        <div className="auth-gate-panel">
          <span className="skeleton-line wide" />
          <span className="skeleton-line" />
          <span className="skeleton-line short" />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-gate">
        <div className="auth-gate-panel">
          <LockKeyhole size={26} />
          <p className="eyebrow">로그인 필요</p>
          <h1>회원 계정으로 워크스페이스에 들어가세요</h1>
          <p>승인, 계정 스캔, 초안 검증, 이력 저장은 모두 로그인 세션으로 보호됩니다.</p>
          <div className="auth-gate-actions">
            <Link className="icon-button primary" href="/signup">
              회원가입
            </Link>
            <Link className="icon-button subtle" href="/login">
              로그인
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (approvalState === "checking" || approvalState === "idle") {
    return (
      <main className="auth-gate">
        <div className="auth-gate-panel">
          <span className="skeleton-line wide" />
          <span className="skeleton-line" />
          <span className="skeleton-line short" />
        </div>
      </main>
    );
  }

  if (approvalState === "pending") {
    return (
      <main className="auth-gate">
        <div className="auth-gate-panel">
          <LockKeyhole size={26} />
          <p className="eyebrow">승인 대기</p>
          <h1>관리자 승인 후 이용할 수 있습니다</h1>
          <p>가입 요청은 접수됐습니다. 관리자가 회원관리 화면에서 승인하면 워크스페이스 접근이 열립니다.</p>
          <div className="auth-gate-actions">
            <button className="icon-button subtle" type="button" onClick={handleSignOut}>
              로그아웃
            </button>
            <Link className="icon-button primary" href="/login">
              승인 후 로그인
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (approvalState === "error") {
    return (
      <main className="auth-gate">
        <div className="auth-gate-panel">
          <LockKeyhole size={26} />
          <p className="eyebrow">접근 확인 필요</p>
          <h1>계정 승인 상태를 확인하지 못했습니다</h1>
          <p>잠시 후 다시 시도하거나 관리자에게 승인 상태를 확인해 주세요.</p>
          <div className="auth-gate-actions">
            <button className="icon-button subtle" type="button" onClick={handleSignOut}>
              로그아웃
            </button>
            <Link className="icon-button primary" href="/login">
              로그인
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return children;
}
