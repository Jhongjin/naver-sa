"use client";

import Link from "next/link";
import { FileClock, Network, RefreshCw, Search, ShieldCheck, UserCheck, UserCog, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/app/components/auth/AuthGate";
import { useAuth } from "@/app/components/auth/AuthProvider";

type ManagedUser = {
  id: string;
  email: string | null;
  role: "member" | "admin";
  roleSource: "appMetadata" | "adminEmails" | "default";
  emailConfirmed: boolean;
  isCurrentUser: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  displayName: string | null;
  companyName: string | null;
  workspaceCount: number;
  ownedWorkspaceCount: number;
  planningRunCount: number;
  latestPlanningRunAt: string | null;
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
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "member">("all");
  const summary = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((user) => user.role === "admin").length,
      members: users.filter((user) => user.role === "member").length,
      workspaceLinks: users.reduce((total, user) => total + user.workspaceCount, 0),
      planningRuns: users.reduce((total, user) => total + user.planningRunCount, 0)
    }),
    [users]
  );
  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return users.filter((user) => {
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesQuery =
        !needle ||
        [user.email, user.displayName, user.companyName, user.role]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle);

      return matchesRole && matchesQuery;
    });
  }, [query, roleFilter, users]);

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
      setMessage("error" in data && data.error ? data.error : "관리자 권한이 필요하거나 사용자 목록을 불러오지 못했습니다.");
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
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setMessage(data.error ?? "권한을 변경하지 못했습니다.");
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
        <p>가입 계정, 최근 로그인, 관리자 권한과 워크스페이스 연결 상태를 한 화면에서 확인합니다.</p>
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

      <section className="admin-summary-grid" aria-label="회원 요약">
        <article>
          <Users size={18} />
          <span>전체 회원</span>
          <strong>{summary.total}명</strong>
        </article>
        <article>
          <ShieldCheck size={18} />
          <span>관리자</span>
          <strong>{summary.admins}명</strong>
        </article>
        <article>
          <UserCheck size={18} />
          <span>멤버</span>
          <strong>{summary.members}명</strong>
        </article>
        <article>
          <Network size={18} />
          <span>워크스페이스 연결</span>
          <strong>{summary.workspaceLinks}건</strong>
        </article>
        <article>
          <FileClock size={18} />
          <span>저장 이력</span>
          <strong>{summary.planningRuns}건</strong>
        </article>
      </section>

      <section className="account-panel admin-filter-panel" aria-label="회원 검색과 필터">
        <label className="search-field">
          <Search size={16} />
          <span className="sr-only">회원 검색</span>
          <input
            placeholder="이름, 이메일, 회사명 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="segmented-control admin-role-filter" aria-label="권한 필터">
          {(["all", "admin", "member"] as const).map((filter) => (
            <button
              aria-pressed={roleFilter === filter}
              className={roleFilter === filter ? "active" : ""}
              key={filter}
              type="button"
              onClick={() => setRoleFilter(filter)}
            >
              {roleFilterLabel(filter)}
            </button>
          ))}
        </div>
      </section>

      {message ? <p className="auth-message error admin-message">{message}</p> : null}

      <section className="admin-table-panel">
        <div className="admin-table-head">
          <span>계정</span>
          <span>회사</span>
          <span>상태</span>
          <span>운영</span>
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
        {filteredUsers.map((user) => (
          <article className={`admin-user-row ${user.isCurrentUser ? "current-user" : ""}`} key={user.id}>
            <div>
              <UserCog size={18} />
              <div>
                <strong>
                  {user.displayName ?? user.email ?? "이메일 없음"}
                  {user.isCurrentUser ? <span className="current-user-badge">현재 계정</span> : null}
                </strong>
                <span>{user.email}</span>
              </div>
            </div>
            <span>
              <span className="mobile-label">회사</span>
              {user.companyName ?? "미등록"}
            </span>
            <span>
              <span className="mobile-label">상태</span>
              <span className={`status-pill ${user.emailConfirmed ? "include" : "review"}`}>
                {user.emailConfirmed ? "인증됨" : "메일 미확인"}
              </span>
            </span>
            <span className="admin-activity-cell">
              <span className="mobile-label">운영</span>
              <strong>{user.workspaceCount} WS</strong>
              <small>
                {user.planningRunCount} saved
                {user.latestPlanningRunAt ? ` / ${formatDate(user.latestPlanningRunAt)}` : ""}
              </small>
              {user.ownedWorkspaceCount > 0 ? <small>owner {user.ownedWorkspaceCount}</small> : null}
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
              <span className="role-source">{roleSourceLabel(user.roleSource)}</span>
              <button
                aria-pressed={user.role === "member"}
                className={user.role === "member" ? "selected" : ""}
                disabled={status === "loading" || user.isCurrentUser || user.roleSource === "adminEmails"}
                type="button"
                onClick={() => updateRole(user.id, "member")}
                title={
                  user.isCurrentUser
                    ? "본인 관리자 권한은 직접 내릴 수 없습니다."
                    : user.roleSource === "adminEmails"
                      ? "ADMIN_EMAILS 환경변수에서 먼저 제거해야 합니다."
                      : undefined
                }
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
        {status === "idle" && filteredUsers.length === 0 ? (
          <div className="admin-empty">
            <strong>조건에 맞는 회원이 없습니다</strong>
            <span>검색어 또는 권한 필터를 조정해 주세요.</span>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function roleFilterLabel(value: "all" | "admin" | "member") {
  return value === "all" ? "전체" : value === "admin" ? "관리자" : "멤버";
}

function roleSourceLabel(value: ManagedUser["roleSource"]) {
  const labels = {
    appMetadata: "metadata",
    adminEmails: "환경변수",
    default: "기본 멤버"
  };

  return labels[value];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}
