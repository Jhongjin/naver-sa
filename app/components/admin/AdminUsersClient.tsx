"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Download,
  FileClock,
  Network,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  UserCheck,
  UserCog,
  Users
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/app/components/auth/AuthGate";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { formatKoreanDate, formatKoreanDateTime } from "@/lib/formatters";
import {
  shoppingLinkageStatusClass,
  shoppingLinkageStatusLabel,
  type ShoppingLinkageStatus,
  type ShoppingLinkageSummary
} from "@/lib/shopping-linkage";
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
  shoppingLinkage: ShoppingLinkageSummary;
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
  internalCreatorUserIdsExcluded: true;
  limit: number;
  filters: {
    limit: number;
    linkage: ActivityLinkageFilter;
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
  secretNamesExcluded: true;
  environmentVariableNamesExcluded: true;
  environment: {
    requiredPresentCount: number;
    requiredTotalCount: number;
    recommendedPresentCount: number;
    recommendedTotalCount: number;
  };
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
  optionalFeatures: SupabaseOptionalFeature[];
  note: string | null;
};

type SupabaseOptionalFeature = {
  feature: string;
  table: string;
  column: string | null;
  ready: boolean;
  rowCount: number | null;
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
  scheduler?: {
    ready: boolean;
    automaticCronConfigured: boolean;
    cronSecretPresent: boolean;
    endpoint: string;
    scheduleUtc: string;
    scheduleKst: string;
    maxRunsPerInvocation: number;
    targetStatuses: string[];
    excludedStatuses: string[];
    excludesMasterReference: boolean;
    automaticRetry: boolean;
    externalRequestOnSchedule: boolean;
    nextStep: string;
  };
  ops?: {
    externalRequest: false;
    backlog: {
      statusCounts: Record<"planned" | "blocked" | "ready" | "failed" | "completed", number>;
      cronEligible: number;
      staleReady: number;
      staleReadyThresholdMinutes: number;
      oldestCronEligible: {
        id: string;
        scope: "powerlinkDailyStats" | "shoppingKeywordDailyStats" | "masterReference";
        status: "planned" | "failed";
        requestedFrom: string;
        requestedTo: string;
        createdAt: string;
      } | null;
    };
    latestCronHeartbeat: {
      eventType: string;
      entityId: string | null;
      createdAt: string;
      reason: string | null;
      processed: number | null;
      remainingAfter: number | null;
      status: string | null;
      source: string | null;
      error: string | null;
    } | null;
    latestAlert: {
      eventType: string;
      entityId: string | null;
      createdAt: string;
      reason: string | null;
      processed: number | null;
      remainingAfter: number | null;
      status: string | null;
      source: string | null;
      error: string | null;
    } | null;
  } | null;
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
  rawInventoryExcluded: true;
  scopeEnforced: true;
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
  rawValuesExcluded: true;
  auditTextSanitized: true;
  total: number;
  limit: number;
  filter?: {
    group: "all" | "admin" | "ops";
    eventType: string | null;
  };
};

type ReportShareLinkItem = {
  id: string;
  planningRunId: string;
  createdByEmail: string | null;
  status: "active" | "revoked";
  expiresAt: string;
  lastAccessedAt: string | null;
  accessCount: number;
  createdAt: string;
  updatedAt: string;
  isExpired: boolean;
  tokenAvailable: false;
  planningRun: {
    id: string;
    brandName: string;
    siteUrl: string;
    productType: "powerlink" | "shoppingSearch";
    createdBy: string | null;
    createdAt: string;
  } | null;
};

type ReportShareSummary = {
  total: number;
  active: number;
  activeUsable: number;
  activeExpired: number;
  revoked: number;
  accessed: number;
};

type AdminReportShareLinksResponse = {
  ok: true;
  installed: boolean;
  tokenExcluded: boolean;
  tokenHashExcluded: boolean;
  links: ReportShareLinkItem[];
  total: number;
  limit: number;
  summary: ReportShareSummary;
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
  resultSummary: {
    entityCount: number;
    fieldCount: number;
    rowCount: number;
    recommendationCount: number;
    recommendationDraftCount: number;
    storedRawStats: boolean;
    source: "manual" | "cron" | "preview" | null;
    statusCode: number | null;
    error: string | null;
    queuedAt: string | null;
    completedAt: string | null;
    message: string | null;
  };
  createdAt: string;
};

type PerformanceSyncPlansResponse = {
  ok: true;
  externalRequest: false;
  plans: PerformanceSyncPlanItem[];
};

type PerformancePlanStatusFilter = "all" | PerformanceSyncPlanItem["status"];
type PerformancePlanScopeFilter = "all" | PerformanceSyncPlanItem["scope"];

type PerformanceStatsPreviewResponse = {
  ok: true;
  externalRequest: true;
  readOnly: true;
  request: {
    scope: PerformanceSyncPlanItem["scope"];
    entityCount: number;
    fields: string[];
    dateFrom: string;
    dateTo: string;
    timeIncrement: "allDays";
  };
  stats: unknown;
  recommendations: PerformanceRecommendationItem[];
  recommendationSummary: {
    total: number;
    bySeverity: {
      low: number;
      medium: number;
      high: number;
    };
    byAction: Record<string, number>;
  };
  recommendationDrafts: PerformanceRecommendationDraftItem[];
  recommendationDraftSummary: {
    total: number;
    byRisk: {
      low: number;
      medium: number;
      high: number;
    };
    byAction: Record<string, number>;
    approvalRequired: true;
    safeDraftOnly: true;
    liveBlocked: true;
    deleteBlocked: true;
  };
  history?: {
    saved: boolean;
    id?: string;
    rowCount?: number;
    warning?: string;
  };
};

type PerformanceManualQueueResponse =
  | {
      ok: true;
      externalRequest: true;
      readOnly: true;
      plan: {
        id: string;
        status: "completed";
        entityCount: number;
        fieldCount: number;
        rowCount: number;
        recommendationCount: number;
        recommendationDraftCount: number;
        storedRawStats: false;
        completedAt: string;
      };
    }
  | {
      ok?: false;
      externalRequest?: boolean;
      readOnly?: boolean;
      status?: number;
      error?: string;
      warnings?: string[];
    };

type PerformanceRecommendationItem = {
  id: string;
  entityId: string;
  severity: "low" | "medium" | "high";
  action: "increaseBidCandidate" | "decreaseBidCandidate" | "holdAndInspect" | "creativeReview" | "keepLearning";
  title: string;
  trigger: string;
  recommendation: string;
  metricSummary: {
    impressions: number;
    clicks: number;
    cost: number;
    ctr: number | null;
    cpc: number | null;
    avgRank: number | null;
    conversions: number;
    revenue: number;
  };
  automationLevel: "Level 1 Review" | "Level 2 Staged";
  safeDraftOnly: true;
};

type PerformanceRecommendationDraftItem = {
  id: string;
  sourceRecommendationId: string;
  entityId: string;
  entityType: "naverSearchAdPerformanceEntity";
  action: "reviewBidIncrease" | "reviewBidDecrease" | "inspectDelivery" | "reviewCreative" | "keepLearning";
  title: string;
  details: string;
  suggestedChange: string;
  guardrail: string;
  risk: "low" | "medium" | "high";
  approvalRequired: true;
  safeDraftOnly: true;
  liveBlocked: true;
  deleteBlocked: true;
};

type OperationalHealth = {
  app: AppHealthResponse;
  supabase: SupabaseReadinessResponse;
  naver: NaverPublicReadinessResponse;
};

type ActivityFilter = "all" | "ready" | "blocked" | "missingDraft";
type ActivityLinkageFilter = "all" | ShoppingLinkageStatus;
type ActivityLimit = 8 | 20;
type AuditEventFilter = "all" | "ops" | "invited" | "emailConfirmed" | "roleChanged" | "other";
type UserStatusFilter = "all" | "unconfirmed" | "neverSignedIn" | "noWorkspace";

const emptyActivitySummary: ActivityResponse["summary"] = {
  total: 0,
  approved: 0,
  held: 0,
  blocked: 0,
  readyDrafts: 0
};
const emptyReportShareSummary: ReportShareSummary = {
  total: 0,
  active: 0,
  activeUsable: 0,
  activeExpired: 0,
  revoked: 0,
  accessed: 0
};
const defaultPreviewRange = getDefaultPerformancePreviewRange();

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
  const [shareLinkStatus, setShareLinkStatus] = useState<"idle" | "loading" | "error">("loading");
  const [naverCheckStatus, setNaverCheckStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [naverCheckMessage, setNaverCheckMessage] = useState("");
  const [snapshotHistory, setSnapshotHistory] = useState<AccountSnapshotHistoryItem[]>([]);
  const [snapshotTotal, setSnapshotTotal] = useState(0);
  const [snapshotMessage, setSnapshotMessage] = useState("");
  const [auditEvents, setAuditEvents] = useState<AdminAuditEventItem[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditMessage, setAuditMessage] = useState("");
  const [shareLinks, setShareLinks] = useState<ReportShareLinkItem[]>([]);
  const [shareLinkTotal, setShareLinkTotal] = useState(0);
  const [shareLinkSummary, setShareLinkSummary] = useState<ReportShareSummary>(emptyReportShareSummary);
  const [shareLinkMessage, setShareLinkMessage] = useState("");
  const [performanceReadiness, setPerformanceReadiness] = useState<PerformanceSyncReadinessResponse | null>(null);
  const [performancePlans, setPerformancePlans] = useState<PerformanceSyncPlanItem[]>([]);
  const [performanceStatus, setPerformanceStatus] = useState<"idle" | "loading" | "error">("loading");
  const [performancePlanStatus, setPerformancePlanStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [performanceQueueStatus, setPerformanceQueueStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [performanceQueuePlanId, setPerformanceQueuePlanId] = useState<string | null>(null);
  const [performancePreviewStatus, setPerformancePreviewStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [performanceMessage, setPerformanceMessage] = useState("");
  const [performancePreviewIds, setPerformancePreviewIds] = useState(readInitialPerformancePreviewIds);
  const [performancePreviewFrom, setPerformancePreviewFrom] = useState(defaultPreviewRange.from);
  const [performancePreviewTo, setPerformancePreviewTo] = useState(defaultPreviewRange.to);
  const [performancePreviewResult, setPerformancePreviewResult] = useState<PerformanceStatsPreviewResponse | null>(null);
  const [performancePlanStatusFilter, setPerformancePlanStatusFilter] = useState<PerformancePlanStatusFilter>("all");
  const [performancePlanScopeFilter, setPerformancePlanScopeFilter] = useState<PerformancePlanScopeFilter>("all");
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
  const [activityLinkageFilter, setActivityLinkageFilter] = useState<ActivityLinkageFilter>("all");
  const [activityLimit, setActivityLimit] = useState<ActivityLimit>(8);
  const [auditEventFilter, setAuditEventFilter] = useState<AuditEventFilter>("all");

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
    return activities.filter((activity) => {
      const matchesLinkage =
        activityLinkageFilter === "all" || activity.shoppingLinkage.status === activityLinkageFilter;

      if (!matchesLinkage) {
        return false;
      }

      if (activityFilter === "ready") {
        return activity.executionDraft?.status === "ready";
      }

      if (activityFilter === "blocked") {
        return (activity.executionDraft?.blockerCount ?? activity.approvalSummary.blocked) > 0;
      }

      if (activityFilter === "missingDraft") {
        return !activity.executionDraft;
      }

      return true;
    });
  }, [activities, activityFilter, activityLinkageFilter]);
  const auditSummary = useMemo(
    () =>
      auditEvents.reduce(
        (summary, event) => {
          if (event.eventType === "admin.user.invited") {
            summary.invited += 1;
          } else if (event.eventType === "admin.user.email_confirmed") {
            summary.emailConfirmed += 1;
          } else if (event.eventType === "admin.user.role_changed") {
            summary.roleChanged += 1;
          } else if (event.eventType.startsWith("ops.")) {
            summary.ops += 1;
          } else {
            summary.other += 1;
          }

          return summary;
        },
        {
          loaded: auditEvents.length,
          total: auditTotal,
          latestActor: auditEvents[0]?.actor ?? "unknown",
          invited: 0,
          emailConfirmed: 0,
          roleChanged: 0,
          ops: 0,
          other: 0
        }
      ),
    [auditEvents, auditTotal]
  );
  const filteredAuditEvents = useMemo(
    () => auditEvents.filter((event) => auditEventMatchesFilter(event, auditEventFilter)),
    [auditEventFilter, auditEvents]
  );
  const operationalHealthItems = useMemo(() => {
    if (!operationalHealth) {
      return [];
    }

    const appPresentCount = operationalHealth.app.environment.requiredPresentCount;
    const appVariableCount = operationalHealth.app.environment.requiredTotalCount;
    const recommendedMissing =
      operationalHealth.app.environment.recommendedTotalCount - operationalHealth.app.environment.recommendedPresentCount;
    const optionalFeatures = operationalHealth.supabase.optionalFeatures ?? [];
    const optionalReadyCount = optionalFeatures.filter((feature) => feature.ready).length;

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
        label: "선택 기능",
        value: optionalFeatures.length > 0 ? `${optionalReadyCount}/${optionalFeatures.length}` : "-",
        ok: optionalFeatures.length === 0 || optionalReadyCount === optionalFeatures.length,
        detail: formatOptionalFeatureDetail(optionalFeatures)
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
      schedulerReady: performanceReadiness?.scheduler?.ready ?? false,
      cronConfigured: performanceReadiness?.scheduler?.automaticCronConfigured ?? false,
      cronSecretPresent: performanceReadiness?.scheduler?.cronSecretPresent ?? false,
      rowCount: performanceReadiness?.database.rowCount ?? 0,
      cronEligible: performanceReadiness?.ops?.backlog.cronEligible ?? 0,
      failed: performanceReadiness?.ops?.backlog.statusCounts.failed ?? 0,
      staleReady: performanceReadiness?.ops?.backlog.staleReady ?? 0,
      latestCronAt: performanceReadiness?.ops?.latestCronHeartbeat?.createdAt ?? null,
      latestAlertAt: performanceReadiness?.ops?.latestAlert?.createdAt ?? null,
      blocked,
      planned
    };
  }, [performancePlans, performanceReadiness]);
  const filteredPerformancePlans = useMemo(
    () =>
      performancePlans.filter((plan) => {
        const matchesStatus = performancePlanStatusFilter === "all" || plan.status === performancePlanStatusFilter;
        const matchesScope = performancePlanScopeFilter === "all" || plan.scope === performancePlanScopeFilter;

        return matchesStatus && matchesScope;
      }),
    [performancePlanScopeFilter, performancePlanStatusFilter, performancePlans]
  );
  const performancePreviewJson = useMemo(() => {
    if (!performancePreviewResult) {
      return "";
    }

    return JSON.stringify(performancePreviewResult.stats, null, 2).slice(0, 1800);
  }, [performancePreviewResult]);

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
      cache: "no-store",
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    const activityParams = new URLSearchParams({
      limit: String(activityLimit)
    });

    if (activityLinkageFilter !== "all") {
      activityParams.set("linkage", activityLinkageFilter);
    }

    const activityRequest = fetch(`/api/admin/activity?${activityParams.toString()}`, {
      cache: "no-store",
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
  }, [activityLimit, activityLinkageFilter, getAccessToken]);

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
      cache: "no-store",
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

  const loadAdminAuditEvents = useCallback(async (filter: AuditEventFilter = "all") => {
    setAuditStatus("loading");
    setAuditMessage("");
    const token = await getAccessToken();

    if (!token) {
      setAuditStatus("error");
      setAuditMessage("로그인이 필요합니다.");
      return;
    }

    const params = new URLSearchParams({
      limit: "20"
    });
    const serverFilter = auditServerFilterParams(filter);

    for (const [key, value] of Object.entries(serverFilter)) {
      params.set(key, value);
    }

    const response = await fetch(`/api/admin/audit-events?${params.toString()}`, {
      cache: "no-store",
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

  const loadReportShareLinks = useCallback(async () => {
    setShareLinkStatus("loading");
    setShareLinkMessage("");
    const token = await getAccessToken();

    if (!token) {
      setShareLinkStatus("error");
      setShareLinkMessage("로그인이 필요합니다.");
      return;
    }

    const response = await fetch("/api/admin/report-share-links?limit=12", {
      cache: "no-store",
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    const data = (await response.json().catch(() => ({}))) as
      | AdminReportShareLinksResponse
      | { ok?: false; error?: string };

    if (!response.ok || data.ok !== true) {
      setShareLinkStatus("error");
      setShareLinkMessage("error" in data && data.error ? data.error : "공유 링크 현황을 불러오지 못했습니다.");
      return;
    }

    setShareLinks(data.links);
    setShareLinkTotal(data.total);
    setShareLinkSummary(data.summary);
    setShareLinkStatus("idle");
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
      loadReportShareLinks().catch(() => {
        setShareLinkStatus("error");
        setShareLinkMessage("공유 링크 현황을 불러오지 못했습니다.");
      });
      loadPerformanceSyncStatus().catch(() => {
        setPerformanceStatus("error");
        setPerformanceMessage("성과 sync 준비 상태를 불러오지 못했습니다.");
      });
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    loadAccountSnapshotHistory,
    loadAdminAuditEvents,
    loadOperationalHealth,
    loadPerformanceSyncStatus,
    loadReportShareLinks,
    loadUsers
  ]);

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
    setPerformanceQueueStatus("idle");
    setPerformanceQueuePlanId(null);
    setPerformanceMessage("");
    const token = await getAccessToken();

    if (!token) {
      setPerformancePlanStatus("error");
      setPerformanceMessage("로그인이 필요합니다.");
      return;
    }

    const entityIds = parseEntityIds(performancePreviewIds);
    const response = await fetch("/api/naver/performance-sync/plans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        scope: "powerlinkDailyStats",
        dateFrom: performancePreviewFrom,
        dateTo: performancePreviewTo,
        entityIds,
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
        : `dry-run 성과 sync 계획을 저장했습니다. ${entityIds.length}개 ID가 수동 sync 대기 상태입니다.`
    );
  }

  async function runPerformanceStatsPreview(
    overrides: { idsText?: string; dateFrom?: string; dateTo?: string; fields?: string[]; scope?: PerformanceSyncPlanItem["scope"] } = {}
  ) {
    const idsText = overrides.idsText ?? performancePreviewIds;
    const dateFrom = overrides.dateFrom ?? performancePreviewFrom;
    const dateTo = overrides.dateTo ?? performancePreviewTo;
    const entityIds = parseEntityIds(idsText);

    if (entityIds.length === 0) {
      setPerformancePreviewStatus("error");
      setPerformanceMessage("성과 preview에는 최소 1개의 campaign/ad group/keyword/ad ID가 필요합니다.");
      return;
    }

    setPerformancePreviewStatus("loading");
    setPerformancePlanStatus("idle");
    setPerformanceQueueStatus("idle");
    setPerformanceQueuePlanId(null);
    setPerformanceMessage("");
    const token = await getAccessToken();

    if (!token) {
      setPerformancePreviewStatus("error");
      setPerformanceMessage("로그인이 필요합니다.");
      return;
    }

    const response = await fetch("/api/naver/performance-sync/preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        entityIds,
        scope: overrides.scope ?? "powerlinkDailyStats",
        dateFrom,
        dateTo,
        fields: overrides.fields ?? ["impCnt", "clkCnt", "salesAmt", "ctr", "cpc", "avgRnk"]
      })
    });
    const data = (await response.json().catch(() => ({}))) as
      | PerformanceStatsPreviewResponse
      | { ok?: false; error?: string; warnings?: string[] };

    if (!response.ok || data.ok !== true) {
      setPerformancePreviewStatus("error");
      setPerformancePreviewResult(null);
      setPerformanceMessage(
        "warnings" in data && data.warnings?.length
          ? data.warnings[0]
          : "error" in data && data.error
            ? data.error
            : "성과 preview를 불러오지 못했습니다."
      );
      return;
    }

    setPerformancePreviewStatus("success");
    setPerformancePreviewResult(data);
    await loadPerformanceSyncStatus();
    setPerformancePreviewStatus("success");
    setPerformanceMessage(
      data.history?.saved
        ? `read-only stats preview 완료: ${data.request.entityCount}개 ID / ${data.history.rowCount ?? 0} rows 저장`
        : `read-only stats preview 완료: ${data.request.entityCount}개 ID 조회`
    );
  }

  async function rerunPerformancePreviewFromPlan(plan: PerformanceSyncPlanItem) {
    if (plan.entityIds.length === 0) {
      setPerformancePreviewStatus("error");
      setPerformanceMessage("이 저장 이력에는 재조회할 연결 ID가 없습니다.");
      return;
    }

    const idsText = plan.entityIds.join(", ");
    setPerformancePreviewIds(idsText);
    setPerformancePreviewFrom(plan.requestedFrom);
    setPerformancePreviewTo(plan.requestedTo);
    await runPerformanceStatsPreview({
      idsText,
      dateFrom: plan.requestedFrom,
      dateTo: plan.requestedTo,
      fields: plan.fields.length > 0 ? plan.fields : undefined,
      scope: plan.scope
    });
  }

  async function runManualPerformanceSyncPlan(plan: PerformanceSyncPlanItem) {
    if (!canRunManualPerformanceSync(plan)) {
      setPerformanceQueueStatus("error");
      setPerformanceMessage(manualPerformanceSyncBlockReason(plan));
      return;
    }

    setPerformanceQueueStatus("loading");
    setPerformanceQueuePlanId(plan.id);
    setPerformancePlanStatus("idle");
    setPerformanceMessage("");
    const token = await getAccessToken();

    if (!token) {
      setPerformanceQueueStatus("error");
      setPerformanceQueuePlanId(null);
      setPerformanceMessage("로그인이 필요합니다.");
      return;
    }

    const response = await fetch("/api/naver/performance-sync/queue", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        planId: plan.id
      })
    });
    const data = (await response.json().catch(() => ({}))) as PerformanceManualQueueResponse;

    if (!response.ok || data.ok !== true) {
      setPerformanceQueueStatus("error");
      setPerformanceQueuePlanId(null);
      setPerformanceMessage(
        "warnings" in data && data.warnings?.length
          ? data.warnings[0]
          : "error" in data && data.error
            ? data.error
            : "수동 performance sync를 실행하지 못했습니다."
      );
      await loadPerformanceSyncStatus();
      return;
    }

    await loadPerformanceSyncStatus();
    setPerformanceQueueStatus("success");
    setPerformanceQueuePlanId(null);
    setPerformanceMessage(
      `수동 read-only sync 완료: ${data.plan.rowCount} rows / 추천 ${data.plan.recommendationCount}개 / 초안 ${data.plan.recommendationDraftCount}개`
    );
  }

  function downloadPerformancePreviewMarkdown() {
    if (!performancePreviewResult) {
      return;
    }

    downloadTextFile(
      buildPerformancePreviewMarkdown(performancePreviewResult),
      buildPerformancePreviewFileName(performancePreviewResult),
      "text/markdown;charset=utf-8"
    );
  }

  function downloadPerformancePlansCsv() {
    if (filteredPerformancePlans.length === 0) {
      return;
    }

    const dateStamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");

    downloadTextFile(
      createPerformancePlansCsv(filteredPerformancePlans),
      `naver-sa-performance-plans-${dateStamp}.csv`,
      "text/csv;charset=utf-8"
    );
  }

  function downloadFilteredActivitiesCsv() {
    if (filteredActivities.length === 0) {
      return;
    }

    const dateStamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");

    downloadTextFile(
      createAdminActivitiesCsv(filteredActivities),
      `naver-sa-admin-activities-${activityFilter}-${dateStamp}.csv`,
      "text/csv;charset=utf-8"
    );
  }

  function downloadSnapshotHistoryCsv() {
    if (snapshotHistory.length === 0) {
      return;
    }

    const dateStamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");

    downloadTextFile(
      createSnapshotHistoryCsv(snapshotHistory),
      `naver-sa-account-snapshots-${dateStamp}.csv`,
      "text/csv;charset=utf-8"
    );
  }

  function downloadAdminAuditCsv() {
    if (filteredAuditEvents.length === 0) {
      return;
    }

    const dateStamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");

    downloadTextFile(
      createAdminAuditCsv(filteredAuditEvents),
      `naver-sa-admin-audit-${auditEventFilter}-${dateStamp}.csv`,
      "text/csv;charset=utf-8"
    );
  }

  function downloadReportShareLinksCsv() {
    if (shareLinks.length === 0) {
      return;
    }

    const dateStamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");

    downloadTextFile(
      createReportShareLinksCsv(shareLinks),
      `naver-sa-report-share-links-${dateStamp}.csv`,
      "text/csv;charset=utf-8"
    );
  }

  function downloadFilteredUsersCsv() {
    if (filteredUsers.length === 0) {
      return;
    }

    const dateStamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");

    downloadTextFile(createUsersCsv(filteredUsers), `naver-sa-users-${dateStamp}.csv`, "text/csv;charset=utf-8");
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
        {operationalHealth?.supabase.optionalFeatures?.length ? (
          <div className="admin-health-feature-list" aria-label="Supabase 선택 기능 준비 상태">
            {operationalHealth.supabase.optionalFeatures.map((feature) => (
              <span
                className={`status-pill ${feature.ready ? "include" : "review"}`}
                key={`${feature.table}:${feature.column ?? "table"}`}
              >
                {feature.feature}: {feature.ready ? "ready" : "migration"}
              </span>
            ))}
          </div>
        ) : null}
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
          <div className="admin-snapshot-actions">
            <button
              className="icon-button subtle"
              disabled={snapshotHistory.length === 0}
              type="button"
              onClick={downloadSnapshotHistoryCsv}
            >
              <Download size={17} />
              CSV
            </button>
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

      <section className="account-panel admin-share-panel" aria-label="리포트 공유 링크">
        <div className="admin-share-heading">
          <div>
            <Share2 size={22} />
            <strong>리포트 공유 링크</strong>
            <span>공개 리포트 링크의 활성, 만료, 폐기, 접근 상태를 토큰 없이 추적합니다.</span>
            {shareLinkMessage ? <em className="admin-check-result error">{shareLinkMessage}</em> : null}
          </div>
          <div className="admin-share-actions">
            <button
              className="icon-button subtle"
              disabled={shareLinks.length === 0}
              type="button"
              onClick={downloadReportShareLinksCsv}
            >
              <Download size={17} />
              CSV
            </button>
            <button
              className="icon-button subtle"
              disabled={shareLinkStatus === "loading"}
              type="button"
              onClick={loadReportShareLinks}
            >
              <RefreshCw size={17} />
              {shareLinkStatus === "loading" ? "불러오는 중" : "공유 링크 새로고침"}
            </button>
          </div>
        </div>
        <div className="admin-activity-summary admin-share-summary" aria-label="리포트 공유 링크 요약">
          <article>
            <span>전체 링크</span>
            <strong>{shareLinkSummary.total}건</strong>
            <em>최근 {shareLinks.length}/{shareLinkTotal}건 표시</em>
          </article>
          <article>
            <span>사용 가능</span>
            <strong>{shareLinkSummary.activeUsable}건</strong>
            <em>active + not expired</em>
          </article>
          <article>
            <span>만료 대기</span>
            <strong>{shareLinkSummary.activeExpired}건</strong>
            <em>active 상태지만 만료 시각 지남</em>
          </article>
          <article>
            <span>폐기됨</span>
            <strong>{shareLinkSummary.revoked}건</strong>
            <em>revoked</em>
          </article>
          <article>
            <span>접근 기록</span>
            <strong>{shareLinkSummary.accessed}건</strong>
            <em>access_count &gt; 0</em>
          </article>
        </div>
        {shareLinkStatus === "loading" ? (
          <div className="admin-activity-empty">
            <span className="skeleton-line wide" />
            <span className="skeleton-line" />
            <span className="skeleton-line short" />
          </div>
        ) : null}
        {shareLinkStatus === "idle" && shareLinks.length === 0 ? (
          <div className="admin-activity-empty">
            <Share2 size={20} />
            <strong>공유 링크가 없습니다</strong>
            <span>저장 이력 상세에서 제한형 공개 리포트 링크를 만들면 이곳에 표시됩니다.</span>
          </div>
        ) : null}
        {shareLinks.length > 0 ? (
          <div className="admin-share-list">
            {shareLinks.map((link) => (
              <article className={link.status === "revoked" || link.isExpired ? "partial" : ""} key={link.id}>
                <div>
                  <span className={`status-pill ${reportShareLinkTone(link)}`}>{reportShareLinkStatusLabel(link)}</span>
                  <strong>{link.planningRun?.brandName ?? "저장 이력 확인 필요"}</strong>
                  <p>
                    {link.createdByEmail ?? "unknown"} / {formatKoreanDateTime(link.createdAt)}
                  </p>
                  <small>
                    token 미노출 / hash 미노출 / 링크 ID {link.id.slice(0, 8)}
                  </small>
                  <Link className="icon-button subtle compact" href={`/history/${link.planningRunId}`}>
                    <FileClock size={15} />
                    저장 이력
                  </Link>
                </div>
                <dl>
                  <div>
                    <dt>만료</dt>
                    <dd>{formatKoreanDateTime(link.expiresAt)}</dd>
                  </div>
                  <div>
                    <dt>최근 접근</dt>
                    <dd>{link.lastAccessedAt ? formatKoreanDateTime(link.lastAccessedAt) : "없음"}</dd>
                  </div>
                  <div>
                    <dt>접근 수</dt>
                    <dd>{link.accessCount}회</dd>
                  </div>
                  <div>
                    <dt>상품</dt>
                    <dd>{link.planningRun ? productTypeLabel(link.planningRun.productType) : "unknown"}</dd>
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
                  (performancePlanStatus === "success" || performanceQueueStatus === "success") &&
                  performanceStatus !== "error"
                    ? "success"
                    : "error"
                }`}
              >
                {performanceMessage}
              </em>
            ) : null}
          </div>
          <div className="admin-performance-actions">
            <button
              className="icon-button subtle"
              disabled={filteredPerformancePlans.length === 0}
              type="button"
              onClick={downloadPerformancePlansCsv}
            >
              <Download size={17} />
              CSV
            </button>
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
            <small>
              예약 대상 {performanceSummary.cronEligible}건 / failed {performanceSummary.failed}건
            </small>
          </article>
          <article>
            <span>차단 계획</span>
            <strong>{performanceSummary.blocked}건</strong>
            <small>stale ready {performanceSummary.staleReady}건 / planned {performanceSummary.planned}건</small>
          </article>
          <article className={performanceSummary.schedulerReady ? "ok" : "needs-check"}>
            <span>예약 실행</span>
            <strong>{performanceSummary.cronConfigured ? "cron on" : "manual"}</strong>
            <small>
              {performanceReadiness?.scheduler?.scheduleKst ?? "매일 오전 9:10 KST"} / 최대{" "}
              {performanceReadiness?.scheduler?.maxRunsPerInvocation ?? 3}건
            </small>
            <small>
              {performanceSummary.cronSecretPresent ? "CRON_SECRET 등록됨" : "CRON_SECRET 확인 필요"} /{" "}
              {performanceReadiness?.scheduler?.targetStatuses?.join(", ") ?? "planned, failed"}
            </small>
            <small>
              최근 cron{" "}
              {performanceSummary.latestCronAt ? formatKoreanDateTime(performanceSummary.latestCronAt) : "기록 없음"}
            </small>
          </article>
          <article>
            <span>안전 가드</span>
            <strong>live off</strong>
            <small>
              external job creation, deletion, mutation 모두 차단
              {performanceSummary.latestAlertAt
                ? ` / 최근 알림 ${formatKoreanDateTime(performanceSummary.latestAlertAt)}`
                : ""}
            </small>
          </article>
        </div>
        <form
          className="admin-performance-preview"
          onSubmit={(event) => {
            event.preventDefault();
            runPerformanceStatsPreview().catch(() => {
              setPerformancePreviewStatus("error");
              setPerformanceMessage("성과 preview를 불러오지 못했습니다.");
            });
          }}
        >
          <div>
            <label>
              <span>성과 조회 ID</span>
              <input
                placeholder="nccCampaignId, nccAdgroupId, keyword ID"
                value={performancePreviewIds}
                onChange={(event) => setPerformancePreviewIds(event.target.value)}
              />
            </label>
            <label>
              <span>시작일</span>
              <input
                type="date"
                value={performancePreviewFrom}
                onChange={(event) => setPerformancePreviewFrom(event.target.value)}
              />
            </label>
            <label>
              <span>종료일</span>
              <input
                type="date"
                value={performancePreviewTo}
                onChange={(event) => setPerformancePreviewTo(event.target.value)}
              />
            </label>
            <button className="icon-button primary" disabled={performancePreviewStatus === "loading"} type="submit">
              <Activity size={17} />
              {performancePreviewStatus === "loading" ? "조회 중" : "read-only 조회"}
            </button>
          </div>
          {performancePreviewResult ? (
            <section className="admin-performance-preview-result" aria-label="성과 preview 결과">
              <div>
                <span>preview result</span>
                <strong>{countPreviewRows(performancePreviewResult.stats)} rows</strong>
                <small>
                  {performanceScopeLabel(performancePreviewResult.request.scope)} / {performancePreviewResult.request.dateFrom} ~{" "}
                  {performancePreviewResult.request.dateTo} / {performancePreviewResult.request.fields.join(", ")}
                </small>
                <button className="icon-button subtle compact" type="button" onClick={downloadPerformancePreviewMarkdown}>
                  <Download size={15} />
                  운영 메모
                </button>
              </div>
              <pre>{performancePreviewJson}</pre>
            </section>
          ) : null}
          {performancePreviewResult?.recommendations.length ? (
            <section className="admin-performance-recommendations" aria-label="성과 기반 운영 추천">
              <div>
                <span>recommendations</span>
                <strong>{performancePreviewResult.recommendationSummary.total}개 추천</strong>
                <small>
                  high {performancePreviewResult.recommendationSummary.bySeverity.high} / medium{" "}
                  {performancePreviewResult.recommendationSummary.bySeverity.medium} / low{" "}
                  {performancePreviewResult.recommendationSummary.bySeverity.low}
                </small>
              </div>
              <div>
                {performancePreviewResult.recommendations.map((recommendation) => (
                  <article className={recommendation.severity} key={recommendation.id}>
                    <span className={`status-pill ${recommendation.severity === "high" ? "review" : "include"}`}>
                      {performanceRecommendationActionLabel(recommendation.action)}
                    </span>
                    <strong>{recommendation.title}</strong>
                    <p>{recommendation.entityId}</p>
                    <small>{recommendation.trigger}</small>
                    <em>{recommendation.recommendation}</em>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          {performancePreviewResult?.recommendationDrafts.length ? (
            <section className="admin-performance-drafts" aria-label="성과 추천 승인 초안">
              <div>
                <span>approval drafts</span>
                <strong>{performancePreviewResult.recommendationDraftSummary.total}개 안전 초안</strong>
                <small>
                  high {performancePreviewResult.recommendationDraftSummary.byRisk.high} / medium{" "}
                  {performancePreviewResult.recommendationDraftSummary.byRisk.medium} / low{" "}
                  {performancePreviewResult.recommendationDraftSummary.byRisk.low}
                </small>
                <small>live blocked / delete blocked / 승인 필수</small>
              </div>
              <div>
                {performancePreviewResult.recommendationDrafts.map((draft) => (
                  <article className={draft.risk} key={draft.id}>
                    <span className={`status-pill ${draft.risk === "high" ? "review" : "include"}`}>
                      {performanceRecommendationDraftActionLabel(draft.action)}
                    </span>
                    <strong>{draft.title}</strong>
                    <p>{draft.entityId}</p>
                    <small>{draft.details}</small>
                    <em>{draft.suggestedChange}</em>
                    <code>{draft.guardrail}</code>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </form>
        <div className="admin-performance-filters" aria-label="성과 sync 계획 필터">
          <label>
            <span>상태</span>
            <select
              value={performancePlanStatusFilter}
              onChange={(event) => setPerformancePlanStatusFilter(event.target.value as PerformancePlanStatusFilter)}
            >
              <option value="all">전체 상태</option>
              <option value="planned">계획됨</option>
              <option value="blocked">차단</option>
              <option value="ready">준비</option>
              <option value="failed">실패</option>
              <option value="completed">완료</option>
            </select>
          </label>
          <label>
            <span>범위</span>
            <select
              value={performancePlanScopeFilter}
              onChange={(event) => setPerformancePlanScopeFilter(event.target.value as PerformancePlanScopeFilter)}
            >
              <option value="all">전체 범위</option>
              <option value="powerlinkDailyStats">파워링크 일별 성과</option>
              <option value="shoppingKeywordDailyStats">쇼핑검색 키워드 성과</option>
              <option value="masterReference">마스터 기준 데이터</option>
            </select>
          </label>
          <small>
            {filteredPerformancePlans.length}/{performancePlans.length}건 표시
          </small>
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
        {performanceStatus !== "loading" && performancePlans.length > 0 && filteredPerformancePlans.length === 0 ? (
          <div className="admin-activity-empty">
            <Activity size={20} />
            <strong>필터에 맞는 성과 sync 계획이 없습니다</strong>
            <span>상태 또는 범위 필터를 조정해 주세요.</span>
          </div>
        ) : null}
        {filteredPerformancePlans.length > 0 ? (
          <div className="admin-performance-list">
            {filteredPerformancePlans.map((plan) => (
              <article className={plan.status === "blocked" ? "blocked" : ""} key={plan.id}>
                <div>
                  <span className={`status-pill ${plan.status === "blocked" ? "review" : "include"}`}>
                    {performancePlanStatusLabel(plan.status)}
                  </span>
                  <strong>{performanceScopeLabel(plan.scope)}</strong>
                  <p>
                    {plan.actorEmail ?? "unknown"} / {formatKoreanDateTime(plan.createdAt)}
                  </p>
                  <small>
                    {performancePlanSourceLabel(plan.resultSummary.source)} /{" "}
                    {plan.resultSummary.completedAt
                      ? `완료 ${formatKoreanDateTime(plan.resultSummary.completedAt)}`
                      : plan.resultSummary.queuedAt
                        ? `시작 ${formatKoreanDateTime(plan.resultSummary.queuedAt)}`
                        : "실행 대기"}
                  </small>
                  {plan.warnings.length > 0 ? <small>{plan.warnings[0]}</small> : null}
                  {plan.resultSummary.message ? <small>{plan.resultSummary.message}</small> : null}
                  {plan.resultSummary.error ? (
                    <small>
                      {plan.resultSummary.statusCode ? `status ${plan.resultSummary.statusCode} / ` : ""}
                      {plan.resultSummary.error}
                    </small>
                  ) : null}
                  {plan.externalRequest ? <small>read-only external sync 실행됨 / raw stats 저장 안 함</small> : null}
                  <div className="admin-performance-plan-actions">
                    <button
                      className="icon-button primary"
                      disabled={performanceQueueStatus === "loading" || !canRunManualPerformanceSync(plan)}
                      title={manualPerformanceSyncBlockReason(plan)}
                      type="button"
                      onClick={() => {
                        runManualPerformanceSyncPlan(plan).catch(() => {
                          setPerformanceQueueStatus("error");
                          setPerformanceQueuePlanId(null);
                          setPerformanceMessage("수동 performance sync를 실행하지 못했습니다.");
                        });
                      }}
                    >
                      <Activity size={16} />
                      {performanceQueuePlanId === plan.id ? "sync 중" : "수동 sync"}
                    </button>
                    <button
                      className="icon-button subtle"
                      disabled={performancePreviewStatus === "loading" || plan.entityIds.length === 0}
                      title={plan.entityIds.length === 0 ? "연결 ID가 있는 이력만 재조회할 수 있습니다." : undefined}
                      type="button"
                      onClick={() => {
                        rerunPerformancePreviewFromPlan(plan).catch(() => {
                          setPerformancePreviewStatus("error");
                          setPerformanceMessage("저장 이력 기반 preview를 다시 불러오지 못했습니다.");
                        });
                      }}
                    >
                      <Activity size={16} />
                      preview 재조회
                    </button>
                  </div>
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
                    <dd>{plan.resultSummary.entityCount || plan.entityIds.length}개</dd>
                  </div>
                  <div>
                    <dt>추천</dt>
                    <dd>
                      {plan.resultSummary.rowCount} rows / 추천 {plan.resultSummary.recommendationCount}개 / 초안{" "}
                      {plan.resultSummary.recommendationDraftCount}개
                    </dd>
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
            <span>회원 관리와 운영 실패/차단 알림을 함께 추적합니다.</span>
            {auditMessage ? <em className="admin-check-result error">{auditMessage}</em> : null}
          </div>
          <div className="admin-audit-actions">
            <button
              className="icon-button subtle"
              disabled={filteredAuditEvents.length === 0}
              type="button"
              onClick={downloadAdminAuditCsv}
            >
              <Download size={17} />
              CSV
            </button>
            <button
              className="icon-button subtle"
              disabled={auditStatus === "loading"}
              type="button"
              onClick={() => {
                loadAdminAuditEvents(auditEventFilter).catch(() => {
                  setAuditStatus("error");
                  setAuditMessage("관리 이벤트를 불러오지 못했습니다.");
                });
              }}
            >
              <RefreshCw size={17} />
              {auditStatus === "loading" ? "불러오는 중" : "이벤트 새로고침"}
            </button>
          </div>
        </div>
        <div className="admin-snapshot-summary">
          <span>
            관리 이벤트 {auditTotal}건 / 필터 {filteredAuditEvents.length}건
          </span>
        </div>
        <div className="admin-activity-summary admin-audit-summary" aria-label="관리 이벤트 요약">
          <article>
            <span>불러온 이벤트</span>
            <strong>
              {auditSummary.loaded}/{auditSummary.total}
            </strong>
            <em>
              기타 {auditSummary.other}건 / 최근 작업자 {auditSummary.latestActor}
            </em>
          </article>
          <article>
            <span>운영 알림</span>
            <strong>{auditSummary.ops}건</strong>
            <em>ops.* alerts</em>
          </article>
          <article>
            <span>초대</span>
            <strong>{auditSummary.invited}건</strong>
            <em>admin.user.invited</em>
          </article>
          <article>
            <span>메일 확인</span>
            <strong>{auditSummary.emailConfirmed}건</strong>
            <em>admin.user.email_confirmed</em>
          </article>
          <article>
            <span>권한 변경</span>
            <strong>{auditSummary.roleChanged}건</strong>
            <em>admin.user.role_changed</em>
          </article>
        </div>
        <div className="segmented-control admin-audit-filter" aria-label="관리 이벤트 타입 필터">
          {(["all", "ops", "invited", "emailConfirmed", "roleChanged", "other"] as const).map((filter) => (
            <button
              aria-pressed={auditEventFilter === filter}
              className={auditEventFilter === filter ? "active" : ""}
              key={filter}
              type="button"
              onClick={() => {
                setAuditEventFilter(filter);
                loadAdminAuditEvents(filter).catch(() => {
                  setAuditStatus("error");
                  setAuditMessage("관리 이벤트를 불러오지 못했습니다.");
                });
              }}
            >
              {auditEventFilterLabel(filter)}
            </button>
          ))}
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
        {auditStatus === "idle" && auditEvents.length > 0 && filteredAuditEvents.length === 0 ? (
          <div className="admin-activity-empty">
            <ShieldCheck size={20} />
            <strong>필터에 맞는 관리 이벤트가 없습니다</strong>
            <span>이벤트 타입 필터를 전체로 바꿔 주세요.</span>
          </div>
        ) : null}
        {auditStatus === "idle" && filteredAuditEvents.length > 0 ? (
          <div className="admin-audit-list">
            {filteredAuditEvents.map((event) => (
              <article key={event.id}>
                <div>
                  <span className={`status-pill ${adminEventTone(event.eventType)}`}>{adminEventLabel(event.eventType)}</span>
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
            <button
              className="icon-button subtle"
              disabled={filteredActivities.length === 0}
              type="button"
              onClick={downloadFilteredActivitiesCsv}
            >
              <Download size={17} />
              CSV
            </button>
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
        <div className="segmented-control admin-activity-filter" aria-label="최근 활동 쇼핑 linkage 필터">
          {(["all", "verified", "mismatch", "unverified", "not_applicable"] as const).map((filter) => (
            <button
              aria-pressed={activityLinkageFilter === filter}
              className={activityLinkageFilter === filter ? "active" : ""}
              key={filter}
              type="button"
              onClick={() => setActivityLinkageFilter(filter)}
            >
              {activityLinkageFilterLabel(filter)}
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
            <span>상태/linkage 필터를 전체로 바꾸거나 표시 개수를 늘려 주세요.</span>
          </div>
        ) : null}
        {filteredActivities.length > 0 ? (
          <div className="admin-activity-list">
            {filteredActivities.map((activity) => (
              <Link className="admin-activity-item" href={`/history/${activity.id}`} key={activity.id}>
                <div>
                  <span className="status-pill include">{productTypeLabel(activity.productType)}</span>
                  {activity.productType === "shoppingSearch" ? (
                    <span className={`status-pill ${shoppingLinkageStatusClass(activity.shoppingLinkage.status)}`}>
                      {shoppingLinkageStatusLabel(activity.shoppingLinkage.status)}
                    </span>
                  ) : null}
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
        <button className="icon-button subtle" disabled={filteredUsers.length === 0} type="button" onClick={downloadFilteredUsersCsv}>
          <Download size={17} />
          CSV
        </button>
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

function getDefaultPerformancePreviewRange() {
  const to = new Date();
  to.setDate(to.getDate() - 1);
  const from = new Date(to);
  from.setDate(from.getDate() - 6);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10)
  };
}

function readInitialPerformancePreviewIds() {
  if (typeof window === "undefined") {
    return "";
  }

  const params = new URLSearchParams(window.location.search);
  const linkedPerformanceIds = params.get("performanceIds") ?? params.get("perfIds");

  return linkedPerformanceIds ? parseEntityIds(linkedPerformanceIds).join(", ") : "";
}

function parseEntityIds(value: string) {
  return [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.slice(0, 120))
    )
  ].slice(0, 10);
}

function countPreviewRows(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (value && typeof value === "object" && "data" in value && Array.isArray(value.data)) {
    return value.data.length;
  }

  if (value && typeof value === "object" && "summaryStatResponse" in value) {
    const response = value.summaryStatResponse;

    if (response && typeof response === "object" && "data" in response && Array.isArray(response.data)) {
      return response.data.length;
    }
  }

  if (value && typeof value === "object" && "dailyStatResponse" in value) {
    const response = value.dailyStatResponse;

    if (response && typeof response === "object" && "data" in response && Array.isArray(response.data)) {
      return response.data.length;
    }
  }

  return value ? 1 : 0;
}

function buildPerformancePreviewMarkdown(result: PerformanceStatsPreviewResponse) {
  const historyText = result.history?.saved
    ? `저장됨 (${result.history.id ?? "history id 없음"}, ${result.history.rowCount ?? 0} rows)`
    : `저장 안 됨${result.history?.warning ? `: ${result.history.warning}` : ""}`;
  const lines = [
    "# Naver SA Performance Preview",
    "",
    `- 생성 시각: ${new Date().toISOString()}`,
    `- 범위: ${performanceScopeLabel(result.request.scope)}`,
    `- 기간: ${result.request.dateFrom} ~ ${result.request.dateTo}`,
    `- 연결 ID: ${result.request.entityCount}개`,
    `- 필드: ${result.request.fields.join(", ")}`,
    `- rows: ${countPreviewRows(result.stats)}`,
    `- 이력 저장: ${historyText}`,
    "- 안전 정책: read-only stats preview, live blocked, delete blocked, approval required",
    "- 원본 stats JSON은 이 메모에 포함하지 않습니다.",
    "",
    "## Recommendations",
    ""
  ];

  if (result.recommendations.length === 0) {
    lines.push("- 추천 없음");
  } else {
    result.recommendations.forEach((recommendation, index) => {
      lines.push(
        `${index + 1}. [${recommendation.severity}] ${recommendation.title}`,
        `   - ID: ${recommendation.entityId}`,
        `   - 액션: ${performanceRecommendationActionLabel(recommendation.action)}`,
        `   - 트리거: ${recommendation.trigger}`,
        `   - 제안: ${recommendation.recommendation}`
      );
    });
  }

  lines.push("", "## Approval Draft Suggestions", "");

  if (result.recommendationDrafts.length === 0) {
    lines.push("- 승인 초안 없음");
  } else {
    result.recommendationDrafts.forEach((draft, index) => {
      lines.push(
        `${index + 1}. [${draft.risk}] ${draft.title}`,
        `   - ID: ${draft.entityId}`,
        `   - 액션: ${performanceRecommendationDraftActionLabel(draft.action)}`,
        `   - 근거: ${draft.details}`,
        `   - 초안: ${draft.suggestedChange}`,
        `   - 가드레일: ${draft.guardrail}`
      );
    });
  }

  return `${lines.join("\n")}\n`;
}

function buildPerformancePreviewFileName(result: PerformanceStatsPreviewResponse) {
  const dateStamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");

  return `naver-sa-performance-preview-${result.request.dateFrom}-${result.request.dateTo}-${result.request.entityCount}ids-${dateStamp}.md`;
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

function createAdminAuditCsv(events: AdminAuditEventItem[]) {
  const rows = [
    ["created_at", "event_type", "label", "actor", "entity_type", "entity_id", "summary", "reason"],
    ...events.map((event) => [
      event.createdAt,
      event.eventType,
      adminEventLabel(event.eventType),
      event.actor ?? "",
      event.entityType ?? "",
      event.entityId ?? "",
      event.summary,
      event.reason ?? ""
    ])
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

function createReportShareLinksCsv(links: ReportShareLinkItem[]) {
  const rows = [
    [
      "created_at",
      "status",
      "expired",
      "planning_run_id",
      "brand_name",
      "product_type",
      "created_by_email",
      "expires_at",
      "last_accessed_at",
      "access_count",
      "token_exposed"
    ],
    ...links.map((link) => [
      link.createdAt,
      link.status,
      link.isExpired ? "true" : "false",
      link.planningRunId,
      link.planningRun?.brandName ?? "",
      link.planningRun?.productType ?? "",
      link.createdByEmail ?? "",
      link.expiresAt,
      link.lastAccessedAt ?? "",
      link.accessCount,
      link.tokenAvailable ? "true" : "false"
    ])
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

function createPerformancePlansCsv(plans: PerformanceSyncPlanItem[]) {
  const rows = [
    [
      "created_at",
      "status",
      "scope",
      "source",
      "product_type",
      "brand_name",
      "site_url",
      "actor_email",
      "requested_from",
      "requested_to",
      "entity_count",
      "fields",
      "row_count",
      "recommendations",
      "recommendation_drafts",
      "status_code",
      "error",
      "queued_at",
      "completed_at",
      "read_only_endpoint",
      "warnings",
      "result_message"
    ],
    ...plans.map((plan) => [
      plan.createdAt,
      plan.status,
      plan.scope,
      plan.resultSummary.source ?? "",
      plan.productType ?? "",
      plan.brandName ?? "",
      plan.siteUrl ?? "",
      plan.actorEmail ?? "",
      plan.requestedFrom,
      plan.requestedTo,
      plan.resultSummary.entityCount || plan.entityIds.length,
      plan.fields.join("; "),
      plan.resultSummary.rowCount,
      plan.resultSummary.recommendationCount,
      plan.resultSummary.recommendationDraftCount,
      plan.resultSummary.statusCode ?? "",
      plan.resultSummary.error ?? "",
      plan.resultSummary.queuedAt ?? "",
      plan.resultSummary.completedAt ?? "",
      plan.readOnlyEndpoint,
      plan.warnings.join("; "),
      plan.resultSummary.message ?? ""
    ])
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

function createAdminActivitiesCsv(activities: AdminActivityItem[]) {
  const rows = [
    [
      "planning_run_id",
      "brand_name",
      "workspace_name",
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
      "draft_approved_changes",
      "draft_blockers",
      "draft_warnings",
      "shopping_linkage_status",
      "shopping_channel_id",
      "product_group_id",
      "product_group_channel_id"
    ],
    ...activities.map((activity) => [
      activity.id,
      activity.brandName,
      activity.workspaceName ?? "",
      activity.productType,
      activity.mode,
      activity.vertical,
      activity.createdBy ?? "",
      activity.createdAt,
      activity.approvalSummary.approved,
      activity.approvalSummary.held,
      activity.approvalSummary.pending,
      activity.approvalSummary.blocked,
      activity.executionDraft?.status ?? "",
      activity.executionDraft?.approvedChangeCount ?? "",
      activity.executionDraft?.blockerCount ?? "",
      activity.executionDraft?.warningCount ?? "",
      shoppingLinkageStatusLabel(activity.shoppingLinkage.status),
      activity.shoppingLinkage.shoppingChannelId ?? "",
      activity.shoppingLinkage.productGroupId ?? "",
      activity.shoppingLinkage.productGroupBusinessChannelId ?? ""
    ])
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

function createSnapshotHistoryCsv(snapshots: AccountSnapshotHistoryItem[]) {
  const rows = [
    [
      "created_at",
      "snapshot_id",
      "actor_email",
      "brand_name",
      "product_type",
      "site_url",
      "partial",
      "channels",
      "campaigns",
      "product_groups",
      "diff_compared_at",
      "channel_diff",
      "campaign_diff",
      "product_group_diff",
      "changed_labels",
      "error_scopes"
    ],
    ...snapshots.map((snapshot) => [
      snapshot.createdAt,
      snapshot.id,
      snapshot.actorEmail ?? "",
      snapshot.brandName ?? "",
      snapshot.productType ?? "",
      snapshot.siteUrl ?? "",
      snapshot.partial ? "true" : "false",
      snapshot.counts.channels,
      snapshot.counts.campaigns,
      snapshot.counts.productGroups,
      snapshot.diff?.comparedAt ?? "",
      snapshot.diff ? snapshotDiffLabel(snapshot.diff.channels) : "",
      snapshot.diff ? snapshotDiffLabel(snapshot.diff.campaigns) : "",
      snapshot.diff ? snapshotDiffLabel(snapshot.diff.productGroups) : "",
      snapshot.diff ? snapshotDiffPreview(snapshot.diff) : "",
      snapshot.errorScopes.join("; ")
    ])
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

function createUsersCsv(users: ManagedUser[]) {
  const rows = [
    [
      "email",
      "role",
      "role_source",
      "email_confirmed",
      "display_name",
      "company_name",
      "workspaces",
      "owned_workspaces",
      "planning_runs",
      "latest_planning_run_at",
      "created_at",
      "last_sign_in_at"
    ],
    ...users.map((user) => [
      user.email ?? "",
      user.role,
      user.roleSource,
      user.emailConfirmed ? "true" : "false",
      user.displayName ?? "",
      user.companyName ?? "",
      user.workspaceCount,
      user.ownedWorkspaceCount,
      user.planningRunCount,
      user.latestPlanningRunAt ?? "",
      user.createdAt,
      user.lastSignInAt ?? ""
    ])
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

function escapeCsvCell(value: unknown): string {
  const text = String(value ?? "");

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function formatOptionalFeatureDetail(features: SupabaseOptionalFeature[]) {
  if (features.length === 0) {
    return "선택 스키마 없음";
  }

  const missing = features.filter((feature) => !feature.ready).map((feature) => feature.feature);

  if (missing.length === 0) {
    return "공유/쇼핑/메타데이터 준비";
  }

  const preview = missing.slice(0, 2).join(", ");
  const suffix = missing.length > 2 ? ` 외 ${missing.length - 2}개` : "";

  return `${preview}${suffix} 확인`;
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

function activityLinkageFilterLabel(value: ActivityLinkageFilter) {
  return value === "all" ? "전체" : shoppingLinkageStatusLabel(value);
}

function auditEventFilterLabel(value: AuditEventFilter) {
  const labels = {
    all: "전체",
    ops: "운영 알림",
    invited: "초대",
    emailConfirmed: "메일 확인",
    roleChanged: "권한 변경",
    other: "기타"
  };

  return labels[value];
}

function auditEventMatchesFilter(event: AdminAuditEventItem, filter: AuditEventFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "ops") {
    return event.eventType.startsWith("ops.");
  }

  if (filter === "invited") {
    return event.eventType === "admin.user.invited";
  }

  if (filter === "emailConfirmed") {
    return event.eventType === "admin.user.email_confirmed";
  }

  if (filter === "roleChanged") {
    return event.eventType === "admin.user.role_changed";
  }

  return (
    !event.eventType.startsWith("ops.") &&
    !["admin.user.invited", "admin.user.email_confirmed", "admin.user.role_changed"].includes(event.eventType)
  );
}

function auditServerFilterParams(filter: AuditEventFilter): Record<string, string> {
  if (filter === "ops") {
    return {
      group: "ops"
    };
  }

  if (filter === "invited") {
    return {
      eventType: "admin.user.invited"
    };
  }

  if (filter === "emailConfirmed") {
    return {
      eventType: "admin.user.email_confirmed"
    };
  }

  if (filter === "roleChanged") {
    return {
      eventType: "admin.user.role_changed"
    };
  }

  return {};
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
    "admin.user.role_changed": "권한 변경",
    "ops.report_share.created": "공유 생성",
    "ops.report_share.revoked": "공유 폐기",
    "ops.planning_save.failed": "저장 실패",
    "ops.performance_sync.blocked": "Sync 차단",
    "ops.performance_sync.cron_checked": "Cron 확인",
    "ops.performance_sync.config_missing": "설정 경고",
    "ops.performance_sync.failed": "Sync 실패"
  };

  return labels[value] ?? (value.startsWith("ops.") ? "운영 알림" : "관리 이벤트");
}

function adminEventTone(value: string) {
  return value.startsWith("ops.") ? "review" : "include";
}

function reportShareLinkStatusLabel(link: ReportShareLinkItem) {
  if (link.status === "revoked") {
    return "폐기됨";
  }

  return link.isExpired ? "만료됨" : "활성";
}

function reportShareLinkTone(link: ReportShareLinkItem) {
  return link.status === "active" && !link.isExpired ? "include" : "review";
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

function performancePlanSourceLabel(value: PerformanceSyncPlanItem["resultSummary"]["source"]) {
  const labels = {
    manual: "수동 sync",
    cron: "예약 cron",
    preview: "preview 저장"
  };

  return value ? labels[value] : "dry-run 계획";
}

function canRunManualPerformanceSync(plan: PerformanceSyncPlanItem) {
  return (
    (plan.status === "planned" || plan.status === "ready" || plan.status === "failed") &&
    plan.scope !== "masterReference" &&
    plan.entityIds.length > 0 &&
    plan.fields.length > 0
  );
}

function manualPerformanceSyncBlockReason(plan: PerformanceSyncPlanItem) {
  if (canRunManualPerformanceSync(plan)) {
    return "저장된 계획을 read-only stats sync로 수동 실행합니다.";
  }

  if (plan.status === "blocked") {
    return "차단된 계획은 연결 ID와 기간을 보정한 뒤 다시 저장해야 합니다.";
  }

  if (plan.status === "completed") {
    return "이미 완료된 계획은 중복 실행하지 않습니다.";
  }

  if (plan.scope === "masterReference") {
    return "Master report job 생성이 필요한 scope는 수동 sync 큐에서도 차단합니다.";
  }

  if (plan.entityIds.length === 0) {
    return "수동 sync에는 연결 ID가 필요합니다.";
  }

  if (plan.fields.length === 0) {
    return "수동 sync에는 stats field가 필요합니다.";
  }

  return "이 계획은 수동 sync 대상이 아닙니다.";
}

function performanceScopeLabel(value: PerformanceSyncPlanItem["scope"]) {
  const labels = {
    powerlinkDailyStats: "파워링크 일별 성과",
    shoppingKeywordDailyStats: "쇼핑검색 키워드 성과",
    masterReference: "마스터 기준 데이터"
  };

  return labels[value];
}

function performanceRecommendationActionLabel(value: PerformanceRecommendationItem["action"]) {
  const labels = {
    increaseBidCandidate: "상향 후보",
    decreaseBidCandidate: "하향 후보",
    holdAndInspect: "점검",
    creativeReview: "소재 검토",
    keepLearning: "관찰"
  };

  return labels[value];
}

function performanceRecommendationDraftActionLabel(value: PerformanceRecommendationDraftItem["action"]) {
  const labels = {
    reviewBidIncrease: "입찰 상향 검토",
    reviewBidDecrease: "입찰 하향 검토",
    inspectDelivery: "송출 점검",
    reviewCreative: "소재 검토",
    keepLearning: "관찰 유지"
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
