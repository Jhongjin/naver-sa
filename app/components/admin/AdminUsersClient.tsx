"use client";

import Link from "next/link";
import { Activity, AlertTriangle, FileClock, Network, RefreshCw, Search, ShieldCheck, UserCheck, UserCog, Users } from "lucide-react";
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

type AdminActivityItem = {
  id: string;
  workspaceName: string | null;
  brandName: string;
  vertical: string;
  mode: "agency" | "advertiser";
  productType: "powerlink" | "shoppingSearch";
  createdBy: string | null;
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
  } | null;
};

type ActivityResponse = {
  ok: true;
  activities: AdminActivityItem[];
  summary: {
    total: number;
    approved: number;
    held: number;
    blocked: number;
    readyDrafts: number;
  };
};

type NaverReadinessCheckResponse = {
  ok: boolean;
  externalRequest?: boolean;
  error?: string;
  readOnlyCheck?: {
    ok: boolean;
    error?: string;
    status?: number;
  };
};

type ActivityFilter = "all" | "ready" | "blocked" | "missingDraft";
type ActivityLimit = 8 | 20;
type UserStatusFilter = "all" | "unconfirmed" | "neverSignedIn" | "noWorkspace";

const emptyActivitySummary: ActivityResponse["summary"] = {
  total: 0,
  approved: 0,
  held: 0,
  blocked: 0,
  readyDrafts: 0
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
  const [activities, setActivities] = useState<AdminActivityItem[]>([]);
  const [activitySummary, setActivitySummary] = useState<ActivityResponse["summary"]>(emptyActivitySummary);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [activityStatus, setActivityStatus] = useState<"idle" | "loading" | "error">("loading");
  const [naverCheckStatus, setNaverCheckStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [naverCheckMessage, setNaverCheckMessage] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "member">("all");
  const [userStatusFilter, setUserStatusFilter] = useState<UserStatusFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [activityLimit, setActivityLimit] = useState<ActivityLimit>(8);
  const summary = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((user) => user.role === "admin").length,
      members: users.filter((user) => user.role === "member").length,
      unconfirmed: users.filter((user) => !user.emailConfirmed).length,
      neverSignedIn: users.filter((user) => !user.lastSignInAt).length,
      workspaceLinks: users.reduce((total, user) => total + user.workspaceCount, 0),
      planningRuns: users.reduce((total, user) => total + user.planningRunCount, 0)
    }),
    [users]
  );
  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return users.filter((user) => {
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus =
        userStatusFilter === "all" ||
        (userStatusFilter === "unconfirmed" && !user.emailConfirmed) ||
        (userStatusFilter === "neverSignedIn" && !user.lastSignInAt) ||
        (userStatusFilter === "noWorkspace" && user.workspaceCount === 0);
      const matchesQuery =
        !needle ||
        [user.email, user.displayName, user.companyName, user.role]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle);

      return matchesRole && matchesStatus && matchesQuery;
    });
  }, [query, roleFilter, userStatusFilter, users]);
  const filteredActivities = useMemo(() => {
    if (activityFilter === "ready") {
      return activities.filter((activity) => activity.executionDraft?.status === "ready");
    }

    if (activityFilter === "blocked") {
      return activities.filter(
        (activity) => (activity.executionDraft?.blockerCount ?? activity.approvalSummary.blocked) > 0
      );
    }

    if (activityFilter === "missingDraft") {
      return activities.filter((activity) => !activity.executionDraft);
    }

    return activities;
  }, [activities, activityFilter]);

  const loadUsers = useCallback(async () => {
    setStatus("loading");
    setActivityStatus("loading");
    setMessage("");
    const token = await getAccessToken();

    if (!token) {
      setStatus("error");
      setActivityStatus("error");
      setMessage("로그인이 필요합니다.");
      return;
    }

    const usersRequest = fetch("/api/admin/users", {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    const activityRequest = fetch(`/api/admin/activity?limit=${activityLimit}`, {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    const [response, activityResponse] = await Promise.all([usersRequest, activityRequest]);
    const [data, activityData] = (await Promise.all([
      response.json(),
      activityResponse.json()
    ])) as [UsersResponse | { ok?: false; error?: string }, ActivityResponse | { ok?: false; error?: string }];

    if (!response.ok || data.ok !== true) {
      setStatus("error");
      setActivityStatus("error");
      setMessage("error" in data && data.error ? data.error : "관리자 권한이 필요하거나 사용자 목록을 불러오지 못했습니다.");
      return;
    }

    setUsers(data.users);
    if (activityResponse.ok && activityData.ok === true) {
      setActivities(activityData.activities);
      setActivitySummary(activityData.summary);
      setActivityStatus("idle");
    } else {
      setActivitySummary(emptyActivitySummary);
      setActivityStatus("error");
    }
    setStatus("idle");
  }, [activityLimit, getAccessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadUsers().catch(() => {
        setStatus("error");
        setActivityStatus("error");
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

  async function runNaverReadinessCheck() {
    setNaverCheckStatus("loading");
    setNaverCheckMessage("");
    const token = await getAccessToken();

    if (!token) {
      setNaverCheckStatus("error");
      setNaverCheckMessage("로그인이 필요합니다.");
      return;
    }

    const response = await fetch("/api/naver/readiness?check=campaigns", {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    const data = (await response.json().catch(() => ({}))) as NaverReadinessCheckResponse;
    const readOnlyOk = Boolean(data.ok && data.readOnlyCheck?.ok);

    setNaverCheckStatus(readOnlyOk ? "success" : "error");
    setNaverCheckMessage(
      readOnlyOk
        ? "Naver 캠페인 read-only 연결이 정상입니다."
        : data.error ?? data.readOnlyCheck?.error ?? "Naver read-only 점검에 실패했습니다."
    );
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
          <Link href="/history">저장 이력</Link>
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
          {naverCheckStatus !== "idle" ? (
            <em className={`admin-check-result ${naverCheckStatus}`}>{naverCheckMessage}</em>
          ) : null}
        </div>
        <div className="admin-toolbar-actions">
          <button
            className="icon-button subtle"
            disabled={naverCheckStatus === "loading"}
            type="button"
            onClick={runNaverReadinessCheck}
          >
            <Activity size={17} />
            {naverCheckStatus === "loading" ? "점검 중" : "Naver 읽기 점검"}
          </button>
          <button className="icon-button subtle" disabled={status === "loading"} type="button" onClick={loadUsers}>
            <RefreshCw size={17} />
            새로고침
          </button>
        </div>
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
          <AlertTriangle size={18} />
          <span>메일 미확인</span>
          <strong>{summary.unconfirmed}명</strong>
        </article>
        <article>
          <UserCheck size={18} />
          <span>로그인 전</span>
          <strong>{summary.neverSignedIn}명</strong>
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

      <section className="account-panel admin-activity-panel">
        <div className="admin-activity-heading">
          <div>
            <p className="eyebrow">Recent Operations</p>
            <h2>최근 저장 활동</h2>
            <p>최근 planning run과 execution draft 상태를 회원관리에서 바로 추적합니다.</p>
          </div>
          <div className="admin-activity-actions">
            <div className="segmented-control admin-activity-limit" aria-label="최근 활동 표시 개수">
              {([8, 20] as const).map((limit) => (
                <button
                  aria-pressed={activityLimit === limit}
                  className={activityLimit === limit ? "active" : ""}
                  key={limit}
                  type="button"
                  onClick={() => setActivityLimit(limit)}
                >
                  {limit}개
                </button>
              ))}
            </div>
            <Link className="icon-button subtle" href="/history">
              <Activity size={17} />
              전체 이력
            </Link>
          </div>
        </div>
        <div className="admin-activity-summary" aria-label="최근 저장 활동 요약">
          <article>
            <span>최근 이력</span>
            <strong>{activitySummary.total}건</strong>
          </article>
          <article>
            <span>승인</span>
            <strong>{activitySummary.approved}건</strong>
          </article>
          <article>
            <span>Ready draft</span>
            <strong>{activitySummary.readyDrafts}건</strong>
          </article>
          <article>
            <span>차단</span>
            <strong>{activitySummary.blocked}건</strong>
          </article>
        </div>
        <div className="segmented-control admin-activity-filter" aria-label="최근 활동 상태 필터">
          {(["all", "ready", "blocked", "missingDraft"] as const).map((filter) => (
            <button
              aria-pressed={activityFilter === filter}
              className={activityFilter === filter ? "active" : ""}
              key={filter}
              type="button"
              onClick={() => setActivityFilter(filter)}
            >
              {activityFilterLabel(filter)}
            </button>
          ))}
        </div>
        {activityStatus === "loading" ? (
          <div className="admin-activity-empty">
            <span className="skeleton-line wide" />
            <span className="skeleton-line" />
            <span className="skeleton-line short" />
          </div>
        ) : null}
        {activityStatus === "error" ? (
          <div className="admin-activity-empty">
            <AlertTriangle size={20} />
            <strong>최근 활동을 불러오지 못했습니다</strong>
            <span>Supabase readiness 또는 관리자 세션을 확인해 주세요.</span>
          </div>
        ) : null}
        {activityStatus === "idle" && activities.length === 0 ? (
          <div className="admin-activity-empty">
            <FileClock size={20} />
            <strong>아직 저장 활동이 없습니다</strong>
            <span>워크스페이스에서 이력 저장을 실행하면 최근 활동이 표시됩니다.</span>
          </div>
        ) : null}
        {activityStatus === "idle" && activities.length > 0 && filteredActivities.length === 0 ? (
          <div className="admin-activity-empty">
            <Search size={20} />
            <strong>필터에 맞는 최근 활동이 없습니다</strong>
            <span>상태 필터를 전체로 바꾸거나 표시 개수를 늘려 주세요.</span>
          </div>
        ) : null}
        {filteredActivities.length > 0 ? (
          <div className="admin-activity-list">
            {filteredActivities.map((activity) => (
              <Link className="admin-activity-item" href={`/history/${activity.id}`} key={activity.id}>
                <div>
                  <span className="status-pill include">{productLabel(activity.productType)}</span>
                  <strong>{activity.brandName}</strong>
                  <p>
                    {activity.workspaceName ?? activity.vertical} / {activity.createdBy ?? "unknown"} /{" "}
                    {formatDateTime(activity.createdAt)}
                  </p>
                </div>
                <dl>
                  <div>
                    <dt>승인</dt>
                    <dd>{activity.approvalSummary.approved}건</dd>
                  </div>
                  <div>
                    <dt>보류</dt>
                    <dd>{activity.approvalSummary.held}건</dd>
                  </div>
                  <div>
                    <dt>초안</dt>
                    <dd>{activity.executionDraft ? draftStatusLabel(activity.executionDraft.status) : "없음"}</dd>
                  </div>
                  <div>
                    <dt>차단</dt>
                    <dd>{activity.executionDraft?.blockerCount ?? activity.approvalSummary.blocked}건</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        ) : null}
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
        <div className="segmented-control admin-status-filter" aria-label="계정 상태 필터">
          {(["all", "unconfirmed", "neverSignedIn", "noWorkspace"] as const).map((filter) => (
            <button
              aria-pressed={userStatusFilter === filter}
              className={userStatusFilter === filter ? "active" : ""}
              key={filter}
              type="button"
              onClick={() => setUserStatusFilter(filter)}
            >
              {userStatusFilterLabel(filter)}
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

function userStatusFilterLabel(value: UserStatusFilter) {
  const labels = {
    all: "전체 상태",
    unconfirmed: "메일 미확인",
    neverSignedIn: "로그인 전",
    noWorkspace: "WS 없음"
  };

  return labels[value];
}

function activityFilterLabel(value: ActivityFilter) {
  const labels = {
    all: "전체",
    ready: "준비",
    blocked: "차단",
    missingDraft: "초안없음"
  };

  return labels[value];
}

function roleSourceLabel(value: ManagedUser["roleSource"]) {
  const labels = {
    appMetadata: "metadata",
    adminEmails: "환경변수",
    default: "기본 멤버"
  };

  return labels[value];
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
