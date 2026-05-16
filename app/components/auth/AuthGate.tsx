"use client";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { useAuth } from "@/app/components/auth/AuthProvider";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

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

  return children;
}
