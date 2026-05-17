"use client";

import Link from "next/link";
import { Activity, AlertTriangle, FileClock, Network, RefreshCw, Search, ShieldCheck, UserCheck, UserCog, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/app/components/auth/AuthGate";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { formatKoreanDate, formatKoreanDateTime } from "@/lib/formatters";
import { draftStatusLabel, productTypeLabel } from "@/lib/ui-labels";

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

type InviteResponse = {
  ok: true;
  userId: string | null;
  email: string;
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
  limit: number;
  filters: {
    limit: number;
  };
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

type AppHealthResponse = {
  ok: boolean;
  variables: Array<{
    name: string;
    present: boolean;
  }>;
  recommended: Array<{
    name: string;
    present: boolean;
    purpose: string;
  }>;
  warnings: string[];
  adminBootstrap: {
    appMetadataRoleSupported: boolean;
    adminEmailsConfigured: boolean;
  };
};

type SupabaseReadinessResponse = {
  ok: boolean;
  ready: boolean;
  environment: {
    configured: boolean;
    urlPresent: boolean;
    urlValid: boolean;
  };
  connectivity: {
    checked: boolean;
    reachable: boolean;
    status: number | null;
  };
  auth: {
    checked: boolean;
    adminApiReachable: boolean;
  };
  schema: {
    requiredTableCount: number;
    presentTableCount: number;
    requiredColumnCount: number;
    presentColumnCount: number;
  };
  note: string | null;
};

type PerformanceSyncReadinessResponse = {
  ok: boolean;
  ready: boolean;
  externalRequest: false;
  naver: {
    ready: boolean;
    missingCount: number;
    customerIdPresent: boolean;
  };
  database: {
    table: string;
    present: boolean;
    rowCount: number | null;
    error: string | null;
    errorCode: string | null;
  };
  safeguards: {
    externalRequest: false;
    readOnlyStatsOnly: boolean;
    externalReportJobCreation: boolean;
    externalReportDeletion: boolean;
    liveMutation: boolean;
    productionDelete: boolean;
  };
  nextStep: string;
};

type NaverPublicReadinessResponse = {
  ok: boolean;
  ready: boolean;
  configuration: {
    ready: boolean;
    missingCount: number;
    customerIdPresent: boolean;
  };
  externalRequest: boolean;
  readOnlyEndpointCount: number;
  writeExecution: string;
  deleteExecution: string;
};

type AccountSnapshotHistoryItem = {
  id: string;
  userId: string;
  actorEmail: string | null;
  productType: "powerlink" | "shoppingSearch" | null;
  brandName: string | null;
  siteUrl: string | null;
  partial: boolean;
  counts: {
    channels: number;
    campaigns: number;
    productGroups: number;
  };
  diff: {
    comparedSnapshotId: string;
    comparedAt: string;
    channels: SnapshotDiffMetric;
    campaigns: SnapshotDiffMetric;
    productGroups: SnapshotDiffMetric;
  } | null;
  errorScopes: string[];
  createdAt: string;
};

type SnapshotDiffMetric = {
  added: number;
  removed: number;
  changed: number;
  addedLabels: string[];
  removedLabels: string[];
  changedLabels: string[];
};

type AccountSnapshotHistoryResponse = {
  ok: true;
  installed: boolean;
  snapshots: AccountSnapshotHistoryItem[];
  total: number;
  limit: number;
  scope: "all" | "mine";
  warning: string | null;
};

type AdminAuditEventItem = {
  id: string;
  eventType: string;
  actor: string | null;
  entityType: string | null;
  entityId: string | null;
  reason: string | null;
  createdAt: string;
  summary: string;
};

type AdminAuditEventsResponse = {
  ok: true;
  events: AdminAuditEventItem[];
  total: number;
  limit: number;
};

type PerformanceSyncPlanItem = {
  id: string;
  actorEmail: string | null;
  productType: "powerlink" | "shoppingSearch" | null;
  brandName: string | null;
  siteUrl: string | null;
  scope: "powerlinkDailyStats" | "shoppingKeywordDailyStats" | "masterReference";
  requestedFrom: string;
  requestedTo: string;
  status: "planned" | "blocked" | "ready" | "failed" | "completed";
  externalRequest: boolean;
  readOnlyEndpoint: string;
  entityIds: string[];
  fields: string[];
  warnings: string[];
  createdAt: string;
};

type PerformanceSyncPlansResponse = {
  ok: true;
  externalRequest: false;
  plans: PerformanceSyncPlanItem[];
};

type OperationalHealth = {
  app: AppHealthResponse;
  supabase: SupabaseReadinessResponse;
  naver: NaverPublicReadinessResponse;
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
  const [snapshotStatus, setSnapshotStatus] = useState<"idle" | "loading" | "error">("loading");
  const [auditStatus, setAuditStatus] = useState<"idle" | "loading" | "error">("loading");
  const [naverCheckStatus, setNaverCheckStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [naverCheckMessage, setNaverCheckMessage] = useState("");
  const [snapshotHistory, setSnapshotHistory] = useState<AccountSnapshotHistoryItem[]>([]);
  const [snapshotTotal, setSnapshotTotal] = useState(0);
  const [snapshotMessage, setSnapshotMessage] = useState("");
  const [auditEvents, setAuditEvents] = useState<AdminAuditEventItem[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditMessage, setAuditMessage] = useState("");
  const [performanceReadiness, setPerformanceReadiness] = useState<PerformanceSyncReadinessResponse | null>(null);
  const [performancePlans, setPerformancePlans] = useState<PerformanceSyncPlanItem[]>([]);
  const [performanceStatus, setPerformanceStatus] = useState<"idle" | "loading" | "error">("loading");
  const [performancePlanStatus, setPerformancePlanStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [performanceMessage, setPerformanceMessage] = useState("");
  const [operationalHealth, setOperationalHealth] = useState<OperationalHealth | null>(null);
  const [healthStatus, setHealthStatus] = useState<"idle" | "loading" | "error">("loading");
  const [healthMessage, setHealthMessage] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteCompany, setInviteCompany] = useState("");
  const [inviteStatus, setInviteStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [inviteMessage, setInviteMessage] = useState("");
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
  const operationalHealthItems = useMemo(() => {
    if (!operationalHealth) {
      return [];
    }

    const appPresentCount = operationalHealth.app.variables.filter((variable) => variable.present).length;
    const appVariableCount = operationalHealth.app.variables.length;
    const recommendedMissing = operationalHealth.app.recommended.filter((variable) => !variable.present).length;

    return [
      {
        label: "앱 환경",
        value: `${appPresentCount}/${appVariableCount}`,
        ok: operationalHealth.app.ok,
        detail: recommendedMissing > 0 ? `선택 항목 ${recommendedMissing}개 미설정` : "필수 환경값 준비"
      },
      {
        label: "Supabase",
        value: `${operationalHealth.supabase.schema.presentTableCount}/${operationalHealth.supabase.schema.requiredTableCount}`,
        ok: operationalHealth.supabase.ready,
        detail: operationalHealth.supabase.ready
          ? "스키마와 admin API 정상"
          : "스키마 또는 연결 확인 필요"
      },
      {
        label: "Naver API",
        value: operationalHealth.naver.ready ? "ready" : "check",
        ok: operationalHealth.naver.ready,
        detail: `${operationalHealth.naver.readOnlyEndpointCount}개 read-only 엔드포인트 / live off`
      },
      {
        label: "MVP 가드",
        value: "blocked",
        ok: operationalHealth.naver.writeExecution === "blocked in MVP" && operationalHealth.naver.deleteExecution === "blocked in MVP",
        detail: "라이브 전송과 삭제는 차단 유지"
      }
    ];
  }, [operationalHealth]);
  const performanceSummary = useMemo(() => {
    const blocked = performancePlans.filter((plan) => plan.status === "blocked").length;
    const planned = performancePlans.filter((plan) => plan.status === "planned").length;

    return {
      ready: performanceReadiness?.ready ?? false,
      rowCount: performanceReadiness?.database.rowCount ?? 0,
      blocked,
      planned
    };
  }, [performancePlans, performanceReadiness]);

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

  const loadOperationalHealth = useCallback(async () => {
    setHealthStatus("loading");
    setHealthMessage("");

    try {
      const [appResponse, supabaseResponse, naverResponse] = await Promise.all([
        fetch("/api/health", { cache: "no-store" }),
        fetch("/api/supabase/readiness", { cache: "no-store" }),
        fetch("/api/naver/readiness", { cache: "no-store" })
      ]);
      const [app, supabase, naver] = (await Promise.all([
        appResponse.json(),
        supabaseResponse.json(),
        naverResponse.json()
      ])) as [AppHealthResponse, SupabaseReadinessResponse, NaverPublicReadinessResponse];
      const allHealthy = app.ok && supabase.ready && naver.ready;

      setOperationalHealth({ app, supabase, naver });
      setHealthStatus(allHealthy ? "idle" : "error");
      setHealthMessage(allHealthy ? "" : "확인이 필요한 운영 항목이 있습니다.");
    } catch {
      setHealthStatus("error");
      setHealthMessage("운영 헬스 정보를 불러오지 못했습니다.");
    }
  }, []);

  const loadAccountSnapshotHistory = useCallback(async () => {
    setSnapshotStatus("loading");
    setSnapshotMessage("");
    const token = await getAccessToken();

    if (!token) {
      setSnapshotStatus("error");
      setSnapshotMessage("로그인이 필요합니다.");
      return;
    }

    const response = await fetch("/api/naver/account-snapshot/history?limit=8", {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    const data = (await response.json().catch(() => ({}))) as
      | AccountSnapshotHistoryResponse
      | { ok?: false; error?: string };

    if (!response.ok || data.ok !== true) {
      setSnapshotStatus("error");
      setSnapshotMessage("error" in data && data.error ? data.error : "계정 스캔 이력을 불러오지 못했습니다.");
      return;
    }

    setSnapshotHistory(data.snapshots);
    setSnapshotTotal(data.total);
    setSnapshotStatus("idle");
    setSnapshotMessage(data.warning ?? "");
  }, [getAccessToken]);

  const loadAdminAuditEvents = useCallback(async () => {
    setAuditStatus("loading");
    setAuditMessage("");
    const token = await getAccessToken();

    if (!token) {
      setAuditStatus("error");
      setAuditMessage("로그인이 필요합니다.");
      return;
    }

    const response = await fetch("/api/admin/audit-events?limit=8", {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    const data = (await response.json().catch(() => ({}))) as
      | AdminAuditEventsResponse
      | { ok?: false; error?: string };

    if (!response.ok || data.ok !== true) {
      setAuditStatus("error");
      setAuditMessage("error" in data && data.error ? data.error : "관리 이벤트를 불러오지 못했습니다.");
      return;
    }

    setAuditEvents(data.events);
    setAuditTotal(data.total);
    setAuditStatus("idle");
  }, [getAccessToken]);

  const loadPerformanceSyncStatus = useCallback(async () => {
    setPerformanceStatus("loading");
    setPerformanceMessage("");
    const token = await getAccessToken();

    if (!token) {
      setPerformanceStatus("error");
      setPerformanceMessage("로그인이 필요합니다.");
      return;
    }

    const headers = {
      authorization: `Bearer ${token}`
    };
    const [readinessResponse, plansResponse] = await Promise.all([
      fetch("/api/naver/performance-sync/readiness", {
        cache: "no-store",
        headers
      }),
      fetch("/api/naver/performance-sync/plans", {
        cache: "no-store",
        headers
      })
    ]);
    const [readinessData, plansData] = (await Promise.all([
      readinessResponse.json().catch(() => ({})),
      plansResponse.json().catch(() => ({}))
    ])) as [
      PerformanceSyncReadinessResponse | { ok?: false; error?: string },
      PerformanceSyncPlansResponse | { ok?: false; error?: string }
    ];

    if (!readinessResponse.ok || !("ready" in readinessData)) {
      setPerformanceStatus("error");
      setPerformanceMessage(
        "error" in readinessData && readinessData.error
          ? readinessData.error
          : "성과 sync 준비 상태를 불러오지 못했습니다."
      );
      return;
    }

    setPerformanceReadiness(readinessData);

    if (plansResponse.ok && plansData.ok === true) {
      setPerformancePlans(plansData.plans);
    } else {
      setPerformancePlans([]);
      setPerformanceMessage("최근 성과 sync 계획 목록을 불러오지 못했습니다.");
    }

    setPerformanceStatus(readinessData.ready ? "idle" : "error");
  }, [getAccessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadUsers().catch(() => {
        setStatus("error");
        setActivityStatus("error");
        setMessage("사용자 목록을 불러오지 못했습니다.");
      });
      loadOperationalHealth().catch(() => {
        setHealthStatus("error");
        setHealthMessage("운영 헬스 정보를 불러오지 못했습니다.");
      });
      loadAccountSnapshotHistory().catch(() => {
        setSnapshotStatus("error");
        setSnapshotMessage("계정 스캔 이력을 불러오지 못했습니다.");
      });
      loadAdminAuditEvents().catch(() => {
        setAuditStatus("error");
        setAuditMessage("관리 이벤트를 불러오지 못했습니다.");
      });
      loadPerformanceSyncStatus().catch(() => {
        setPerformanceStatus("error");
        setPerformanceMessage("성과 sync 준비 상태를 불러오지 못했습니다.");
      });
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadAccountSnapshotHistory, loadAdminAuditEvents, loadOperationalHealth, loadPerformanceSyncStatus, loadUsers]);

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

  async function confirmUserEmail(userId: string) {
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
      body: JSON.stringify({ action: "confirmEmail", userId })
    });

    if (!response.ok) {
      setStatus("error");
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setMessage(data.error ?? "메일 확인 상태를 변경하지 못했습니다.");
      return;
    }

    await loadUsers();
  }

  async function inviteUser() {
    const email = inviteEmail.trim();

    if (!email) {
      setInviteStatus("error");
      setInviteMessage("초대할 이메일을 입력해 주세요.");
      return;
    }

    setInviteStatus("loading");
    setInviteMessage("");
    const token = await getAccessToken();

    if (!token) {
      setInviteStatus("error");
      setInviteMessage("로그인이 필요합니다.");
      return;
    }

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        email,
        displayName: inviteName,
        companyName: inviteCompany
      })
    });
    const data = (await response.json().catch(() => ({}))) as InviteResponse | { ok?: false; error?: string };

    if (!response.ok || data.ok !== true) {
      setInviteStatus("error");
      setInviteMessage("error" in data && data.error ? data.error : "회원 초대 요청을 완료하지 못했습니다.");
      return;
    }

    setInviteStatus("success");
    setInviteMessage(`${data.email}로 초대 메일을 요청했습니다.`);
    setInviteEmail("");
    setInviteName("");
    setInviteCompany("");
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

  async function createDryRunPerformancePlan() {
    setPerformancePlanStatus("loading");
    setPerformanceMessage("");
    const token = await getAccessToken();

    if (!token) {
      setPerformancePlanStatus("error");
      setPerformanceMessage("로그인이 필요합니다.");
      return;
    }

    const dateTo = new Date();
    dateTo.setDate(dateTo.getDate() - 1);
    const dateFrom = new Date(dateTo);
    dateFrom.setDate(dateFrom.getDate() - 6);
    const response = await fetch("/api/naver/performance-sync/plans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        scope: "powerlinkDailyStats",
        dateFrom: dateFrom.toISOString().slice(0, 10),
        dateTo: dateTo.toISOString().slice(0, 10),
        fields: ["impCnt", "clkCnt", "salesAmt", "ctr", "cpc"]
      })
    });
    const data = (await response.json().catch(() => ({}))) as
      | { ok: true; plan: { status: string; warnings: string[] } }
      | { ok?: false; error?: string };

    if (!response.ok || data.ok !== true) {
      setPerformancePlanStatus("error");
      setPerformanceMessage("error" in data && data.error ? data.error : "dry-run 계획을 저장하지 못했습니다.");
      return;
    }

    await loadPerformanceSyncStatus();
    setPerformancePlanStatus("success");
    setPerformanceMessage(
      data.plan.status === "blocked"
        ? `dry-run 계획을 저장했습니다. ${data.plan.warnings[0] ?? "실제 조회 전 연결 ID가 필요합니다."}`
        : "dry-run 성과 sync 계획을 저장했습니다."
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

      <section className="account-panel admin-health-panel" aria-label="운영 헬스">
        <div className="admin-health-heading">
          <div>
            <ShieldCheck size={22} />
            <strong>운영 헬스</strong>
            <span>환경, Supabase, Naver 설정, MVP 안전 가드를 한 번에 점검합니다.</span>
            {healthMessage ? <em className="admin-check-result error">{healthMessage}</em> : null}
          </div>
          <button
            className="icon-button subtle"
            disabled={healthStatus === "loading"}
            type="button"
            onClick={loadOperationalHealth}
          >
            <RefreshCw size={17} />
            {healthStatus === "loading" ? "확인 중" : "헬스 새로고침"}
          </button>
        </div>
        <div className="admin-health-grid">
          {operationalHealthItems.length > 0 ? (
            operationalHealthItems.map((item) => (
              <article className={item.ok ? "ok" : "needs-check"} key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </article>
            ))
          ) : (
            <article className="loading">
              <span>운영 헬스</span>
              <strong>확인 중</strong>
              <small>배포 환경을 점검하고 있습니다.</small>
            </article>
          )}
        </div>
      </section>

      <section className="account-panel admin-invite-panel" aria-label="회원 초대">
        <div>
          <UserCheck size={22} />
          <strong>회원 초대</strong>
          <span>승인 흐름을 사용할 팀원을 이메일로 초대하고 가입 후 권한을 관리합니다.</span>
        </div>
        <form
          className="admin-invite-form"
          onSubmit={(event) => {
            event.preventDefault();
            inviteUser().catch(() => {
              setInviteStatus("error");
              setInviteMessage("회원 초대 요청을 완료하지 못했습니다.");
            });
          }}
        >
          <label>
            <span>이메일</span>
            <input
              autoComplete="email"
              placeholder="member@company.com"
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
            />
          </label>
          <label>
            <span>이름</span>
            <input
              autoComplete="name"
              placeholder="담당자 이름"
              value={inviteName}
              onChange={(event) => setInviteName(event.target.value)}
            />
          </label>
          <label>
            <span>회사명</span>
            <input
              autoComplete="organization"
              placeholder="회사 또는 브랜드"
              value={inviteCompany}
              onChange={(event) => setInviteCompany(event.target.value)}
            />
          </label>
          <button className="icon-button primary" disabled={inviteStatus === "loading"} type="submit">
            <UserCheck size={17} />
            {inviteStatus === "loading" ? "초대 중" : "초대 보내기"}
          </button>
          {inviteMessage ? (
            <em className={`admin-check-result ${inviteStatus === "success" ? "success" : "error"}`}>
              {inviteMessage}
            </em>
          ) : null}
        </form>
      </section>

      <section className="account-panel admin-snapshot-panel" aria-label="최근 계정 스캔">
        <div className="admin-snapshot-heading">
          <div>
            <Network size={22} />
            <strong>최근 계정 스캔</strong>
            <span>Naver 비즈채널, 캠페인, 상품그룹 조회 결과를 감사용으로 추적합니다.</span>
            {snapshotMessage ? <em className="admin-check-result error">{snapshotMessage}</em> : null}
          </div>
          <button
            className="icon-button subtle"
            disabled={snapshotStatus === "loading"}
            type="button"
            onClick={loadAccountSnapshotHistory}
          >
            <RefreshCw size={17} />
            {snapshotStatus === "loading" ? "불러오는 중" : "스캔 이력 새로고침"}
          </button>
        </div>
        <div className="admin-snapshot-summary">
          <span>저장된 스캔 {snapshotTotal}건</span>
          <Link className="icon-button subtle" href="/workspace">
            <Search size={17} />
            새 스캔
          </Link>
        </div>
        {snapshotStatus === "loading" ? (
          <div className="admin-activity-empty">
            <span className="skeleton-line wide" />
            <span className="skeleton-line" />
            <span className="skeleton-line short" />
          </div>
        ) : null}
        {snapshotStatus === "idle" && snapshotHistory.length === 0 ? (
          <div className="admin-activity-empty">
            <Network size={20} />
            <strong>저장된 계정 스캔이 없습니다</strong>
            <span>워크스페이스에서 계정 스캔을 실행하면 최근 결과가 표시됩니다.</span>
          </div>
        ) : null}
        {snapshotStatus === "idle" && snapshotHistory.length > 0 ? (
          <div className="admin-snapshot-list">
            {snapshotHistory.map((snapshot) => (
              <article className={snapshot.partial ? "partial" : ""} key={snapshot.id}>
                <div>
                  <span className="status-pill include">
                    {snapshot.productType ? productTypeLabel(snapshot.productType) : "계정 스캔"}
                  </span>
                  <strong>{snapshot.brandName ?? snapshot.actorEmail ?? "브랜드 미지정"}</strong>
                  <p>
                    {snapshot.actorEmail ?? "unknown"} / {formatKoreanDateTime(snapshot.createdAt)}
                  </p>
                  <div className={`admin-snapshot-diff ${snapshot.diff ? "" : "empty"}`}>
                    <span>{snapshot.diff ? "직전 스캔 대비" : "비교 기준 없음"}</span>
                    <em>
                      {snapshot.diff
                        ? [
                            `채널 ${snapshotDiffLabel(snapshot.diff.channels)}`,
                            `캠페인 ${snapshotDiffLabel(snapshot.diff.campaigns)}`,
                            `상품그룹 ${snapshotDiffLabel(snapshot.diff.productGroups)}`
                          ].join(" / ")
                        : "같은 계정 조건의 이전 스캔이 아직 없습니다."}
                    </em>
                    {snapshot.diff && snapshotDiffPreview(snapshot.diff) ? (
                      <small>{snapshotDiffPreview(snapshot.diff)}</small>
                    ) : null}
                  </div>
                </div>
                <dl>
                  <div>
                    <dt>채널</dt>
                    <dd>{snapshot.counts.channels}개</dd>
                  </div>
                  <div>
                    <dt>캠페인</dt>
                    <dd>{snapshot.counts.campaigns}개</dd>
                  </div>
                  <div>
                    <dt>상품그룹</dt>
                    <dd>{snapshot.counts.productGroups}개</dd>
                  </div>
                  <div>
                    <dt>상태</dt>
                    <dd>{snapshot.partial ? `${snapshot.errorScopes.length}개 경고` : "정상"}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="account-panel admin-performance-panel" aria-label="성과 sync 준비">
        <div className="admin-performance-heading">
          <div>
            <Activity size={22} />
            <strong>성과 sync 준비</strong>
            <span>Naver stats는 read-only로만 계획하고, report job 생성과 삭제는 계속 차단합니다.</span>
            {performanceMessage ? (
              <em
                className={`admin-check-result ${
                  performancePlanStatus === "success" && performanceStatus !== "error" ? "success" : "error"
                }`}
              >
                {performanceMessage}
              </em>
            ) : null}
          </div>
          <div className="admin-performance-actions">
            <button
              className="icon-button subtle"
              disabled={performanceStatus === "loading"}
              type="button"
              onClick={loadPerformanceSyncStatus}
            >
              <RefreshCw size={17} />
              {performanceStatus === "loading" ? "확인 중" : "준비 상태"}
            </button>
            <button
              className="icon-button subtle"
              disabled={performancePlanStatus === "loading"}
              type="button"
              onClick={createDryRunPerformancePlan}
            >
              <FileClock size={17} />
              {performancePlanStatus === "loading" ? "저장 중" : "dry-run 저장"}
            </button>
          </div>
        </div>
        <div className="admin-performance-summary" aria-label="성과 sync 요약">
          <article className={performanceSummary.ready ? "ok" : "needs-check"}>
            <span>준비 상태</span>
            <strong>{performanceSummary.ready ? "ready" : "check"}</strong>
            <small>{performanceReadiness?.nextStep ?? "성과 sync 준비 상태를 확인하고 있습니다."}</small>
          </article>
          <article>
            <span>계획 이력</span>
            <strong>{performanceSummary.rowCount}건</strong>
            <small>최근 dry-run 계획을 저장하고 추적합니다.</small>
          </article>
          <article>
            <span>차단 계획</span>
            <strong>{performanceSummary.blocked}건</strong>
            <small>연결 ID 또는 범위 보정이 필요한 항목입니다.</small>
          </article>
          <article>
            <span>안전 가드</span>
            <strong>live off</strong>
            <small>external job creation, deletion, mutation 모두 차단</small>
          </article>
        </div>
        {performanceStatus === "loading" ? (
          <div className="admin-activity-empty">
            <span className="skeleton-line wide" />
            <span className="skeleton-line" />
            <span className="skeleton-line short" />
          </div>
        ) : null}
        {performanceStatus !== "loading" && performancePlans.length === 0 ? (
          <div className="admin-activity-empty">
            <Activity size={20} />
            <strong>저장된 성과 sync 계획이 없습니다</strong>
            <span>dry-run 저장으로 DB와 안전 가드 동작을 먼저 확인할 수 있습니다.</span>
          </div>
        ) : null}
        {performancePlans.length > 0 ? (
          <div className="admin-performance-list">
            {performancePlans.map((plan) => (
              <article className={plan.status === "blocked" ? "blocked" : ""} key={plan.id}>
                <div>
                  <span className={`status-pill ${plan.status === "blocked" ? "review" : "include"}`}>
                    {performancePlanStatusLabel(plan.status)}
                  </span>
                  <strong>{performanceScopeLabel(plan.scope)}</strong>
                  <p>
                    {plan.actorEmail ?? "unknown"} / {formatKoreanDateTime(plan.createdAt)}
                  </p>
                  {plan.warnings.length > 0 ? <small>{plan.warnings[0]}</small> : null}
                </div>
                <dl>
                  <div>
                    <dt>기간</dt>
                    <dd>
                      {plan.requestedFrom} ~ {plan.requestedTo}
                    </dd>
                  </div>
                  <div>
                    <dt>필드</dt>
                    <dd>{plan.fields.length > 0 ? plan.fields.join(", ") : "master"}</dd>
                  </div>
                  <div>
                    <dt>연결 ID</dt>
                    <dd>{plan.entityIds.length}개</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="account-panel admin-audit-panel" aria-label="최근 관리 이벤트">
        <div className="admin-audit-heading">
          <div>
            <ShieldCheck size={22} />
            <strong>최근 관리 이벤트</strong>
            <span>회원 초대, 메일 확인 처리, 권한 변경 기록을 추적합니다.</span>
            {auditMessage ? <em className="admin-check-result error">{auditMessage}</em> : null}
          </div>
          <button
            className="icon-button subtle"
            disabled={auditStatus === "loading"}
            type="button"
            onClick={loadAdminAuditEvents}
          >
            <RefreshCw size={17} />
            {auditStatus === "loading" ? "불러오는 중" : "이벤트 새로고침"}
          </button>
        </div>
        <div className="admin-snapshot-summary">
          <span>관리 이벤트 {auditTotal}건</span>
        </div>
        {auditStatus === "loading" ? (
          <div className="admin-activity-empty">
            <span className="skeleton-line wide" />
            <span className="skeleton-line" />
            <span className="skeleton-line short" />
          </div>
        ) : null}
        {auditStatus === "idle" && auditEvents.length === 0 ? (
          <div className="admin-activity-empty">
            <ShieldCheck size={20} />
            <strong>최근 관리 이벤트가 없습니다</strong>
            <span>회원 초대나 권한 변경이 발생하면 이곳에 표시됩니다.</span>
          </div>
        ) : null}
        {auditStatus === "idle" && auditEvents.length > 0 ? (
          <div className="admin-audit-list">
            {auditEvents.map((event) => (
              <article key={event.id}>
                <div>
                  <span className="status-pill include">{adminEventLabel(event.eventType)}</span>
                  <strong>{event.summary}</strong>
                  <p>
                    {event.actor ?? "unknown"} / {formatKoreanDateTime(event.createdAt)}
                  </p>
                </div>
                <span>{event.reason ?? "관리자 액션이 기록되었습니다."}</span>
              </article>
            ))}
          </div>
        ) : null}
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
                  <span className="status-pill include">{productTypeLabel(activity.productType)}</span>
                  <strong>{activity.brandName}</strong>
                  <p>
                    {activity.workspaceName ?? activity.vertical} / {activity.createdBy ?? "unknown"} /{" "}
                    {formatKoreanDateTime(activity.createdAt)}
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
              <div className="admin-user-identity">
                <strong>
                  {user.displayName ?? user.email ?? "이메일 없음"}
                  {user.isCurrentUser ? <span className="current-user-badge">현재 계정</span> : null}
                </strong>
                <span>{user.email}</span>
                {user.planningRunCount > 0 ? (
                  <Link className="admin-user-inline-link" href={`/history?q=${encodeURIComponent(historySearchKey(user))}`}>
                    <FileClock size={13} />
                    이력 보기
                  </Link>
                ) : null}
              </div>
            </div>
            <span>
              <span className="mobile-label">회사</span>
              {user.companyName ?? "미등록"}
            </span>
            <span className="admin-status-cell">
              <span className="mobile-label">상태</span>
              <span className={`status-pill ${user.emailConfirmed ? "include" : "review"}`}>
                {user.emailConfirmed ? "인증됨" : "메일 미확인"}
              </span>
              {!user.emailConfirmed ? (
                <button
                  className="admin-inline-action"
                  disabled={status === "loading"}
                  type="button"
                  onClick={() => confirmUserEmail(user.id)}
                >
                  확인 처리
                </button>
              ) : null}
            </span>
            <span className="admin-activity-cell">
              <span className="mobile-label">운영</span>
              <strong>{user.workspaceCount} WS</strong>
              <small>
                {user.planningRunCount} saved
                {user.latestPlanningRunAt ? ` / ${formatKoreanDate(user.latestPlanningRunAt)}` : ""}
              </small>
              {user.ownedWorkspaceCount > 0 ? <small>owner {user.ownedWorkspaceCount}</small> : null}
            </span>
            <span>
              <span className="mobile-label">가입일</span>
              {formatKoreanDate(user.createdAt)}
            </span>
            <span>
              <span className="mobile-label">마지막 로그인</span>
              {user.lastSignInAt ? formatKoreanDate(user.lastSignInAt) : "없음"}
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

function adminEventLabel(value: string) {
  const labels: Record<string, string> = {
    "admin.user.invited": "초대",
    "admin.user.email_confirmed": "메일 확인",
    "admin.user.role_changed": "권한 변경"
  };

  return labels[value] ?? "관리 이벤트";
}

function performancePlanStatusLabel(value: PerformanceSyncPlanItem["status"]) {
  const labels = {
    planned: "계획됨",
    blocked: "차단",
    ready: "준비",
    failed: "실패",
    completed: "완료"
  };

  return labels[value];
}

function performanceScopeLabel(value: PerformanceSyncPlanItem["scope"]) {
  const labels = {
    powerlinkDailyStats: "파워링크 일별 성과",
    shoppingKeywordDailyStats: "쇼핑검색 키워드 성과",
    masterReference: "마스터 기준 데이터"
  };

  return labels[value];
}

function snapshotDiffLabel(metric: SnapshotDiffMetric) {
  const parts = [
    metric.added > 0 ? `+${metric.added}` : null,
    metric.removed > 0 ? `-${metric.removed}` : null,
    metric.changed > 0 ? `수정 ${metric.changed}` : null
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" ") : "변화 없음";
}

function snapshotDiffPreview(diff: NonNullable<AccountSnapshotHistoryItem["diff"]>) {
  const previews = [
    snapshotDiffMetricPreview("채널", diff.channels),
    snapshotDiffMetricPreview("캠페인", diff.campaigns),
    snapshotDiffMetricPreview("상품그룹", diff.productGroups)
  ].filter(Boolean);

  return previews.length > 0 ? previews.join(" / ") : null;
}

function snapshotDiffMetricPreview(label: string, metric: SnapshotDiffMetric) {
  const items = [
    ...metric.addedLabels.map((item) => `+ ${item}`),
    ...metric.removedLabels.map((item) => `- ${item}`),
    ...metric.changedLabels.map((item) => `수정 ${item}`)
  ].slice(0, 3);

  return items.length > 0 ? `${label}: ${items.join(", ")}` : null;
}

function historySearchKey(user: ManagedUser) {
  return user.email ?? user.displayName ?? user.id;
}
