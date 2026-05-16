"use client";

import Link from "next/link";
import { RefreshCw, ShieldCheck, UserCog } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AuthGate } from "@/app/components/auth/AuthGate";
import { useAuth } from "@/app/components/auth/AuthProvider";

type ManagedUser = {
  id: string;
  email: string | null;
  role: "member" | "admin";
  createdAt: string;
  lastSignInAt: string | null;
  displayName: string | null;
  companyName: string | null;
};

type UsersResponse = {
  ok: true;
  users: ManagedUser[];
  total: number;
};

export function AdminUsersClient() {
  return (
    <AuthGate>
      <AdminUsersContent />
    </AuthGate>
  );
}

function AdminUsersContent() {
  const { getAccessToken } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  const loadUsers = useCallback(async () => {
    setStatus("loading");
    setMessage("");
    const token = await getAccessToken();

    if (!token) {
      setStatus("error");
      setMessage("로그인이 필요합니다.");
      return;
    }

    const response = await fetch("/api/admin/users", {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    const data = (await response.json()) as UsersResponse | { ok?: false; error?: string };

    if (!response.ok || data.ok !== true) {
      setStatus("error");
      setMessage("관리자 권한이 필요하거나 사용자 목록을 불러오지 못했습니다.");
      return;
    }

    setUsers(data.users);
    setStatus("idle");
  }, [getAccessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadUsers().catch(() => {
        setStatus("error");
        setMessage("사용자 목록을 불러오지 못했습니다.");
      });
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadUsers]);

  async function updateRole(userId: string, role: "member" | "admin") {
    setStatus("loading");
    const token = await getAccessToken();

    if (!token) {
      setStatus("error");
      setMessage("로그인이 필요합니다.");
      return;
    }

    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ userId, role })
    });

    if (!response.ok) {
      setStatus("error");
      setMessage("권한을 변경하지 못했습니다.");
      return;
    }

    await loadUsers();
  }

  return (
    <main className="account-page admin-page">
      <header className="account-header">
        <Link className="landing-brand" href="/">
          <span>SA</span>
          Naver SA Autopilot
        </Link>
        <nav aria-label="관리자 메뉴">
          <Link href="/workspace">워크스페이스</Link>
          <Link href="/mypage">마이페이지</Link>
        </nav>
      </header>

      <section className="account-hero">
        <p className="eyebrow">User Management</p>
        <h1>회원관리</h1>
        <p>가입 계정, 최근 로그인, 관리자 권한을 한 화면에서 확인합니다.</p>
      </section>

      <section className="account-panel admin-toolbar">
        <div>
          <ShieldCheck size={22} />
          <strong>관리자 전용</strong>
          <span>ADMIN_EMAILS 또는 Supabase app_metadata.role이 admin인 계정만 접근할 수 있습니다.</span>
        </div>
        <button className="icon-button subtle" disabled={status === "loading"} type="button" onClick={loadUsers}>
          <RefreshCw size={17} />
          새로고침
        </button>
      </section>

      {message ? <p className="auth-message error admin-message">{message}</p> : null}

      <section className="admin-table-panel">
        <div className="admin-table-head">
          <span>계정</span>
          <span>회사</span>
          <span>가입일</span>
          <span>마지막 로그인</span>
          <span>권한</span>
        </div>
        {status === "loading" && users.length === 0 ? (
          <div className="admin-empty">
            <span className="skeleton-line wide" />
            <span className="skeleton-line" />
            <span className="skeleton-line short" />
          </div>
        ) : null}
        {users.map((user) => (
          <article className="admin-user-row" key={user.id}>
            <div>
              <UserCog size={18} />
              <div>
                <strong>{user.displayName ?? user.email ?? "이메일 없음"}</strong>
                <span>{user.email}</span>
              </div>
            </div>
            <span>
              <span className="mobile-label">회사</span>
              {user.companyName ?? "미등록"}
            </span>
            <span>
              <span className="mobile-label">가입일</span>
              {formatDate(user.createdAt)}
            </span>
            <span>
              <span className="mobile-label">마지막 로그인</span>
              {user.lastSignInAt ? formatDate(user.lastSignInAt) : "없음"}
            </span>
            <div className="role-actions">
              <button
                aria-pressed={user.role === "member"}
                className={user.role === "member" ? "selected" : ""}
                disabled={status === "loading"}
                type="button"
                onClick={() => updateRole(user.id, "member")}
              >
                멤버
              </button>
              <button
                aria-pressed={user.role === "admin"}
                className={user.role === "admin" ? "selected" : ""}
                disabled={status === "loading"}
                type="button"
                onClick={() => updateRole(user.id, "admin")}
              >
                관리자
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}
