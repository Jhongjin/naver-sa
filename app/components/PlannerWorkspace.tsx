"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileText,
  PauseCircle,
  Printer,
  Rocket,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  WandSparkles
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import {
  createPlannerCsv,
  generatePlannerPlan,
  mardDefaultInput,
  type BenchmarkFeature,
  type ChangeRisk,
  type KeywordStatus,
  type PlannerInput,
  type PlannerMode,
  type PlannerProductType
} from "@/lib/planner";
import { createNaverExecutionDraft } from "@/lib/execution-draft";
import {
  createApprovalCsv,
  createPlannerExcelReport,
  createPlannerReport,
  summarizeApprovals,
  type ApprovalDecision,
  type ApprovalDecisionMap,
  type ApprovalDecisionNoteMap,
  type ExecutionReportContext
} from "@/lib/reporting";
import { generateOptimizationRecommendations, type OptimizationSeverity } from "@/lib/optimization";

type PlannerWorkspaceProps = {
  initialInput: PlannerInput;
};

const currencyFormatter = new Intl.NumberFormat("ko-KR");

type NaverReadiness = {
  ok: boolean;
  ready: boolean;
  configuration: {
    ready: boolean;
    missingCount: number;
    customerIdPresent: boolean;
  };
  externalRequest: boolean;
  writeExecution: string;
};

type StageDraftResponse = {
  ok: boolean;
  dryRun: boolean;
  automationLevel: string;
  authAccess: {
    mode: "supabase-auth";
    role: "member" | "admin";
    userId: string;
    email: string | null;
  };
  naver: {
    ready: boolean;
    missingCount: number;
    customerIdPresent: boolean;
  };
  draft: {
    draftId: string;
    draftKey: string;
    approvedChangeCount: number;
    payloads: Array<{
      id: string;
      method: string;
      uri: string;
      entityType: string;
      target: string;
    }>;
    validation: {
      canExecuteTest: boolean;
      blockerCount: number;
      warningCount: number;
      blockers: Array<{
        code: string;
        payloadId?: string;
        message: string;
      }>;
      warnings: Array<{
        code: string;
        payloadId?: string;
        message: string;
      }>;
    };
  };
  nextAction: string;
};

type AccountSnapshotResponse = {
  ok: boolean;
  externalRequest?: boolean;
  partial?: boolean;
  error?: string;
  code?: string;
  errors?: {
    channels?: string | null;
    campaigns?: string | null;
    productGroups?: string | null;
  };
  channels?: Array<{
    id: string;
    name: string;
    channelTp: string;
    site: string | null;
    mobileSite: string | null;
    inspectStatus: string | null;
  }>;
  campaigns?: Array<{
    nccCampaignId?: string;
    name?: string;
    userLock?: boolean | number;
  }>;
  productGroups?: Array<{
    id: string;
    businessChannelId: string;
    name: string;
    registrationMethod: string | null;
    registeredProductType: string | null;
    mallId: string | null;
    mallName: string | null;
    brandName: string | null;
    numberOfAdgroups: number;
    productCount: number | null;
    excludeCount: number | null;
  }>;
};

type AccountSnapshotState =
  | {
      status: "idle";
    }
  | {
      status: "loading";
    }
  | {
      status: "success";
      response: AccountSnapshotResponse;
    }
  | {
      status: "error";
      message: string;
    };

type StageDraftState =
  | {
      status: "idle";
    }
  | {
      status: "loading";
      fingerprint: string;
      message: string;
    }
  | {
      status: "success";
      fingerprint: string;
      response: StageDraftResponse;
    }
  | {
      status: "error";
      fingerprint: string;
      message: string;
    };

type SaveDraftState =
  | {
      status: "idle";
    }
  | {
      status: "loading";
      fingerprint: string;
    }
  | {
      status: "success";
      fingerprint: string;
      message: string;
      planningRunId: string;
      executionDraftId?: string;
      warnings: string[];
    }
  | {
      status: "error";
      fingerprint: string;
      message: string;
    };

type ApprovalFilter = "all" | "pending" | "approved" | "held" | "blocked";

type WorkspaceDraftSnapshot = {
  version: 1;
  savedAt: string;
  input: PlannerInput;
  decisions: ApprovalDecisionMap;
  decisionNotes?: ApprovalDecisionNoteMap;
  executionContext: {
    campaignId?: string;
    pcChannelId?: string;
    mobileChannelId?: string;
    shoppingChannelId?: string;
    productGroupId?: string;
  };
};

const WORKSPACE_DRAFT_STORAGE_PREFIX = "naver-sa:workspace-draft:v1";

export function PlannerWorkspace({ initialInput }: PlannerWorkspaceProps) {
  const { user, getAccessToken } = useAuth();
  const initialDraftSnapshot = useMemo(() => readWorkspaceDraftSnapshot(user?.id), [user?.id]);
  const [mode, setMode] = useState<PlannerMode>(initialDraftSnapshot?.input.mode ?? initialInput.mode);
  const [productType, setProductType] = useState<PlannerProductType>(
    initialDraftSnapshot?.input.productType ?? initialInput.productType
  );
  const [brandName, setBrandName] = useState(initialDraftSnapshot?.input.brandName ?? initialInput.brandName);
  const [siteUrl, setSiteUrl] = useState(initialDraftSnapshot?.input.siteUrl ?? initialInput.siteUrl);
  const [vertical, setVertical] = useState(initialDraftSnapshot?.input.vertical ?? initialInput.vertical);
  const [monthlyBudget, setMonthlyBudget] = useState(initialDraftSnapshot?.input.monthlyBudget ?? initialInput.monthlyBudget);
  const [maxBid, setMaxBid] = useState(initialDraftSnapshot?.input.maxBid ?? initialInput.maxBid);
  const [seedText, setSeedText] = useState(
    (initialDraftSnapshot?.input.seedKeywords ?? initialInput.seedKeywords).join("\n")
  );
  const [approvalDecisions, setApprovalDecisions] = useState<ApprovalDecisionMap>(
    initialDraftSnapshot?.decisions ?? {}
  );
  const [approvalNotes, setApprovalNotes] = useState<ApprovalDecisionNoteMap>(
    initialDraftSnapshot?.decisionNotes ?? {}
  );
  const [naverReadiness, setNaverReadiness] = useState<NaverReadiness | null>(null);
  const [stageDraftState, setStageDraftState] = useState<StageDraftState>({ status: "idle" });
  const [saveDraftState, setSaveDraftState] = useState<SaveDraftState>({ status: "idle" });
  const [accountSnapshotState, setAccountSnapshotState] = useState<AccountSnapshotState>({ status: "idle" });
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>("all");
  const [approvalSearch, setApprovalSearch] = useState("");
  const [campaignId, setCampaignId] = useState(initialDraftSnapshot?.executionContext.campaignId ?? "");
  const [pcChannelId, setPcChannelId] = useState(initialDraftSnapshot?.executionContext.pcChannelId ?? "");
  const [mobileChannelId, setMobileChannelId] = useState(initialDraftSnapshot?.executionContext.mobileChannelId ?? "");
  const [shoppingChannelId, setShoppingChannelId] = useState(
    initialDraftSnapshot?.executionContext.shoppingChannelId ?? ""
  );
  const [productGroupId, setProductGroupId] = useState(initialDraftSnapshot?.executionContext.productGroupId ?? "");
  const workspaceDraftStorageKey = useMemo(
    () => `${WORKSPACE_DRAFT_STORAGE_PREFIX}:${user?.id ?? "anonymous"}`,
    [user?.id]
  );

  const seedKeywords = useMemo(
    () =>
      seedText
        .split(/\r?\n|,/)
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    [seedText]
  );

  const input = useMemo<PlannerInput>(
    () => ({
      brandName,
      siteUrl,
      vertical,
      monthlyBudget,
      maxBid,
      seedKeywords,
      mode,
      productType
    }),
    [brandName, maxBid, mode, monthlyBudget, productType, seedKeywords, siteUrl, vertical]
  );
  const executionContext = useMemo(
    () => ({
      campaignId: campaignId.trim() || undefined,
      pcChannelId: pcChannelId.trim() || undefined,
      mobileChannelId: mobileChannelId.trim() || undefined,
      shoppingChannelId: shoppingChannelId.trim() || undefined,
      productGroupId: productGroupId.trim() || undefined
    }),
    [campaignId, mobileChannelId, pcChannelId, productGroupId, shoppingChannelId]
  );

  const plan = useMemo(() => generatePlannerPlan(input), [input]);
  const optimizationRecommendations = useMemo(() => generateOptimizationRecommendations(plan), [plan]);
  const executionDraft = useMemo(
    () => createNaverExecutionDraft(plan, approvalDecisions, executionContext),
    [approvalDecisions, executionContext, plan]
  );
  const approvalSummary = useMemo(
    () => summarizeApprovals(plan.stagedChanges, approvalDecisions),
    [approvalDecisions, plan.stagedChanges]
  );
  const executionFingerprint = useMemo(
    () => JSON.stringify({ input, decisions: approvalDecisions, executionContext }),
    [approvalDecisions, executionContext, input]
  );
  const saveFingerprint = useMemo(
    () => JSON.stringify({ input, decisions: approvalDecisions, decisionNotes: approvalNotes, executionContext }),
    [approvalDecisions, approvalNotes, executionContext, input]
  );
  const activeStageDraftState =
    stageDraftState.status !== "idle" && stageDraftState.fingerprint !== executionFingerprint
      ? ({ status: "idle" } as const)
      : stageDraftState;
  const activeSaveDraftState =
    saveDraftState.status !== "idle" && saveDraftState.fingerprint !== saveFingerprint
      ? ({ status: "idle" } as const)
      : saveDraftState;

  const includedKeywords = plan.keywords.filter((keyword) => keyword.status === "include");
  const reviewKeywords = plan.keywords.filter((keyword) => keyword.status === "review");
  const excludedKeywords = plan.keywords.filter((keyword) => keyword.status === "exclude");
  const isShoppingSearch = productType === "shoppingSearch";
  const productLabel = isShoppingSearch ? "쇼핑검색" : "파워링크";
  const keywordLabel = isShoppingSearch ? "검색어" : "키워드";
  const productBrief = isShoppingSearch
    ? {
        eyebrow: "SHOPPING SEARCH",
        title: "상품그룹 기반으로 검색어를 묶습니다",
        description: "쇼핑검색은 쇼핑몰 채널과 상품그룹 연결이 먼저 맞아야 전송 초안을 안정적으로 만들 수 있습니다.",
        rows: [
          ["세팅 단위", "캠페인 / 쇼핑 광고그룹 / 상품검색어"],
          ["필수 연결", "쇼핑몰 채널 ID와 상품그룹 ID"],
          ["현재 정책", "조회와 초안 검증만, 라이브 전송 차단"]
        ]
      }
    : {
        eyebrow: "POWERLINK",
        title: "사이트 비즈채널 기준으로 키워드를 확장합니다",
        description: "파워링크는 PC/모바일 사이트 채널을 기준으로 캠페인, 광고그룹, 키워드, 소재 초안을 생성합니다.",
        rows: [
          ["세팅 단위", "캠페인 / 광고그룹 / 키워드 / 소재"],
          ["필수 연결", "PC 채널 ID와 모바일 채널 ID"],
          ["현재 정책", "승인된 초안만 생성, 삭제와 라이브 전환 금지"]
        ]
      };
  const channelApplied = isShoppingSearch ? Boolean(shoppingChannelId) : Boolean(pcChannelId && mobileChannelId);
  const productGroupApplied = isShoppingSearch ? Boolean(productGroupId) : true;
  const executionConnectionApplied = channelApplied && productGroupApplied;
  const appliedChannel =
    accountSnapshotState.status === "success"
      ? accountSnapshotState.response.channels?.find((channel) =>
          isShoppingSearch ? channel.id === shoppingChannelId : channel.id === pcChannelId
        )
      : undefined;
  const stageValidated = activeStageDraftState.status === "success";
  const stageHasBlockers = stageValidated && activeStageDraftState.response.draft.validation.blockerCount > 0;
  const canRequestProtectedExecution =
    stageValidated && activeStageDraftState.response.draft.validation.canExecuteTest && executionConnectionApplied;
  const canScanAccount = approvalSummary.approved > 0;
  const canValidateDraft = approvalSummary.approved > 0 && executionConnectionApplied;
  const canSaveHistory = stageValidated;
  const modeLabel = mode === "agency" ? "대행사 모드" : "광고주 모드";
  const memberEmail = user?.email ?? "로그인 계정";
  const channelStatusLabel = executionConnectionApplied
    ? "연결됨"
    : isShoppingSearch && channelApplied
      ? "상품그룹 필요"
      : "미연결";
  const blockerTone = executionDraft.validation.blockerCount > 0 ? "rose" : "green";
  const approvalTone = approvalSummary.pending > 0 ? "amber" : "green";
  const approvalProgress =
    plan.stagedChanges.length === 0
      ? 100
      : Math.round((approvalSummary.approved / plan.stagedChanges.length) * 100);
  const nextAction = getNextAction({
    approvedCount: approvalSummary.approved,
    channelApplied: executionConnectionApplied,
    stageValidated,
    canRequestProtectedExecution,
    blockerCount: executionDraft.validation.blockerCount,
    channelStatus: appliedChannel?.inspectStatus,
    productType
  });
  const setupSteps = [
    {
      label: "입력",
      state: "done",
      detail: `${plan.input.brandName} / ${plan.input.vertical}`
    },
    {
      label: "키워드",
      state: includedKeywords.length > 0 ? "done" : "pending",
      detail: `${includedKeywords.length}개 포함`
    },
    {
      label: "승인",
      state: approvalSummary.approved > 0 ? "done" : "attention",
      detail: `${approvalSummary.approved}/${plan.stagedChanges.length}건`
    },
    {
      label: isShoppingSearch ? "쇼핑채널" : "비즈채널",
      state: executionConnectionApplied ? "done" : "attention",
      detail: executionConnectionApplied ? "적용됨" : isShoppingSearch && channelApplied ? "상품그룹 필요" : "필요"
    },
    {
      label: "검증",
      state: executionDraft.validation.blockerCount === 0 ? "done" : "attention",
      detail: `${executionDraft.validation.blockerCount}건 차단`
    },
    {
      label: "테스트 실행",
      state: canRequestProtectedExecution ? "attention" : "pending",
      detail: "별도 확인 필요"
    }
  ] as const;
  const filteredStagedChanges = plan.stagedChanges.filter((change) => {
    const decision = approvalDecisions[change.id] ?? "pending";
    const matchesFilter =
      approvalFilter === "all" ||
      approvalFilter === decision ||
      (approvalFilter === "blocked" && change.risk === "blocked");
    const query = approvalSearch.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [change.target, change.details, change.action, change.type, change.risk]
        .join(" ")
        .toLowerCase()
        .includes(query);

    return matchesFilter && matchesSearch;
  });
  const preflightChecks = [
    {
      label: "승인 항목",
      detail:
        approvalSummary.approved > 0
          ? `${approvalSummary.approved}건 승인됨`
          : "승인된 항목이 아직 없습니다",
      state: approvalSummary.approved > 0 ? "done" : "attention"
    },
    {
      label: isShoppingSearch ? "쇼핑 연결" : "채널 연결",
      detail: executionConnectionApplied
        ? "전송 대상 연결 적용됨"
        : isShoppingSearch && channelApplied
          ? "상품그룹 ID를 적용하세요"
          : "계정 스캔 후 채널을 적용하세요",
      state: executionConnectionApplied ? "done" : "attention"
    },
    {
      label: "검증 차단",
      detail:
        executionDraft.validation.blockerCount === 0
          ? "차단 항목 없음"
          : `${executionDraft.validation.blockerCount}건 해결 필요`,
      state: executionDraft.validation.blockerCount === 0 ? "done" : "attention"
    },
    {
      label: "서버 검증",
      detail: stageValidated ? "전송 직전 payload 검증 완료" : "초안 검증을 실행하세요",
      state: stageValidated ? "done" : "pending"
    }
  ] as const;
  const executionFlowSteps = [
    {
      label: "승인",
      detail: approvalSummary.approved > 0 ? `${approvalSummary.approved}건 승인` : "승인 필요",
      state: approvalSummary.approved > 0 ? "done" : "attention"
    },
    {
      label: "스캔/연결",
      detail: executionConnectionApplied ? channelStatusLabel : "채널 적용 필요",
      state: executionConnectionApplied ? "done" : "attention"
    },
    {
      label: "초안 검증",
      detail: stageValidated ? "서버 검증 완료" : canValidateDraft ? "검증 가능" : "검증 대기",
      state: stageValidated ? "done" : canValidateDraft ? "attention" : "pending"
    },
    {
      label: "이력 저장",
      detail: activeSaveDraftState.status === "success" ? "저장 완료" : canSaveHistory ? "저장 가능" : "검증 후 가능",
      state: activeSaveDraftState.status === "success" ? "done" : canSaveHistory ? "attention" : "pending"
    }
  ] as const;

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") {
      return;
    }

    const snapshot: WorkspaceDraftSnapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      input,
      decisions: approvalDecisions,
      decisionNotes: approvalNotes,
      executionContext
    };

    window.localStorage.setItem(workspaceDraftStorageKey, JSON.stringify(snapshot));
  }, [approvalDecisions, approvalNotes, executionContext, input, user?.id, workspaceDraftStorageKey]);

  useEffect(() => {
    let active = true;

    fetch("/api/naver/readiness")
      .then((response) => response.json() as Promise<NaverReadiness>)
      .then((data) => {
        if (active) {
          setNaverReadiness(data);
        }
      })
      .catch(() => {
        if (active) {
          setNaverReadiness(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  function downloadCsv() {
    const blob = new Blob([createPlannerCsv(plan)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${plan.input.brandName.toLowerCase().replace(/\s+/g, "-")}-keyword-plan.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadApprovalCsv() {
    downloadTextFile(
      createApprovalCsv(plan, approvalDecisions, approvalNotes),
      `${slugFileName(plan.input.brandName)}-approval-queue.csv`,
      "text/csv;charset=utf-8"
    );
  }

  function downloadReport() {
    downloadTextFile(
      createPlannerReport(plan, approvalDecisions, approvalNotes, createExecutionReportContext()),
      `${slugFileName(plan.input.brandName)}-setup-report.md`,
      "text/markdown;charset=utf-8"
    );
  }

  function downloadExcelReport() {
    downloadTextFile(
      createPlannerExcelReport(plan, approvalDecisions, approvalNotes, createExecutionReportContext()),
      `${slugFileName(plan.input.brandName)}-setup-report.xls`,
      "application/vnd.ms-excel;charset=utf-8"
    );
  }

  function createExecutionReportContext(): ExecutionReportContext {
    return {
      executionContext,
      draft: {
        draftId: executionDraft.draftId,
        draftKey: executionDraft.draftKey,
        generatedAt: executionDraft.generatedAt,
        payloadCount: executionDraft.payloads.length,
        canExecuteTest: executionDraft.validation.canExecuteTest,
        blockerCount: executionDraft.validation.blockerCount,
        warningCount: executionDraft.validation.warningCount
      },
      saved:
        activeSaveDraftState.status === "success"
          ? {
              planningRunId: activeSaveDraftState.planningRunId,
              executionDraftId: activeSaveDraftState.executionDraftId
            }
          : undefined
    };
  }

  function printReport() {
    const cleanup = () => {
      document.body.classList.remove("print-report-mode");
      window.removeEventListener("afterprint", cleanup);
    };

    window.addEventListener("afterprint", cleanup, { once: true });
    document.body.classList.add("print-report-mode");
    window.print();
    window.setTimeout(cleanup, 1200);
  }

  function downloadExecutionDraft() {
    downloadTextFile(
      JSON.stringify(executionDraft, null, 2),
      `${slugFileName(plan.input.brandName)}-naver-execution-draft.json`,
      "application/json;charset=utf-8"
    );
  }

  function setDecision(changeId: string, decision: ApprovalDecision) {
    setApprovalDecisions((current) => ({
      ...current,
      [changeId]: decision
    }));
  }

  function setDecisionNote(changeId: string, note: string) {
    setApprovalNotes((current) => {
      const normalized = note.slice(0, 240);

      if (!normalized.trim()) {
        const next = { ...current };
        delete next[changeId];
        return next;
      }

      return {
        ...current,
        [changeId]: normalized
      };
    });
  }

  function approveAllChanges() {
    setApprovalDecisions(
      Object.fromEntries(
        plan.stagedChanges.map((change) => [
          change.id,
          change.risk === "blocked" ? ("held" satisfies ApprovalDecision) : ("approved" satisfies ApprovalDecision)
        ])
      )
    );
  }

  function resetDecisions() {
    setApprovalDecisions({});
    setApprovalNotes({});
  }

  function resetWorkspaceDraft() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(workspaceDraftStorageKey);
    }

    setMode(initialInput.mode);
    setProductType(initialInput.productType);
    setBrandName(initialInput.brandName);
    setSiteUrl(initialInput.siteUrl);
    setVertical(initialInput.vertical);
    setMonthlyBudget(initialInput.monthlyBudget);
    setMaxBid(initialInput.maxBid);
    setSeedText(initialInput.seedKeywords.join("\n"));
    setApprovalDecisions({});
    setApprovalNotes({});
    setCampaignId("");
    setPcChannelId("");
    setMobileChannelId("");
    setShoppingChannelId("");
    setProductGroupId("");
    setStageDraftState({ status: "idle" });
    setSaveDraftState({ status: "idle" });
    setAccountSnapshotState({ status: "idle" });
  }

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await getAccessToken();

    if (!token) {
      throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
    }

    return {
      authorization: `Bearer ${token}`
    };
  }

  async function stageExecutionDraft() {
    setStageDraftState({ status: "loading", fingerprint: executionFingerprint, message: "초안 검증 중" });

    try {
      const response = await fetch("/api/naver/stage-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders())
        },
        body: JSON.stringify({
          input,
          decisions: approvalDecisions,
          executionContext,
          stagedDraftKey:
            activeStageDraftState.status === "success" ? activeStageDraftState.response.draft.draftKey : undefined
        })
      });
      const data = (await response.json()) as StageDraftResponse | { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error("error" in data && data.error ? data.error : "초안 검증에 실패했습니다.");
      }

      setStageDraftState({ status: "success", fingerprint: executionFingerprint, response: data as StageDraftResponse });
    } catch (error) {
      setStageDraftState({
        status: "error",
        fingerprint: executionFingerprint,
        message: error instanceof Error ? error.message : "초안 검증에 실패했습니다."
      });
    }
  }

  async function saveDraftHistory() {
    setSaveDraftState({ status: "loading", fingerprint: saveFingerprint });

    try {
      const response = await fetch("/api/plans/store-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders())
        },
        body: JSON.stringify({
          input,
          decisions: approvalDecisions,
          decisionNotes: approvalNotes,
          executionContext,
          stagedDraftKey:
            activeStageDraftState.status === "success" ? activeStageDraftState.response.draft.draftKey : undefined
        })
      });
      const data = (await response.json()) as
        | {
            ok: true;
            planningRunId: string;
            executionDraftId?: string;
            warnings?: string[];
          }
        | { ok?: false; error?: string; missing?: string[] };

      if (!response.ok || data.ok !== true) {
        const missing = "missing" in data && data.missing?.length ? ` (${data.missing.join(", ")})` : "";
        const message = "error" in data ? data.error : undefined;
        throw new Error(`${message ?? "저장에 실패했습니다."}${missing}`);
      }

      setSaveDraftState({
        status: "success",
        fingerprint: saveFingerprint,
        message: "승인 상태와 전송 초안 이력을 저장했습니다.",
        planningRunId: data.planningRunId,
        executionDraftId: data.executionDraftId,
        warnings: data.warnings ?? []
      });
    } catch (error) {
      setSaveDraftState({
        status: "error",
        fingerprint: saveFingerprint,
        message: error instanceof Error ? error.message : "저장에 실패했습니다."
      });
    }
  }

  async function loadAccountSnapshot() {
    setAccountSnapshotState({ status: "loading" });

    try {
      const response = await fetch("/api/naver/account-snapshot", {
        headers: await authHeaders()
      });
      const data = (await response.json()) as AccountSnapshotResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "계정 스캔에 실패했습니다.");
      }

      setAccountSnapshotState({ status: "success", response: data });
    } catch (error) {
      setAccountSnapshotState({
        status: "error",
        message: error instanceof Error ? error.message : "계정 스캔에 실패했습니다."
      });
    }
  }

  function applyBusinessChannel(channelId: string, target: "shopping" | "pc" | "mobile" | "both" = "both") {
    if (isShoppingSearch) {
      setShoppingChannelId(channelId);
      return;
    }

    if (target === "pc" || target === "both") {
      setPcChannelId(channelId);
    }

    if (target === "mobile" || target === "both") {
      setMobileChannelId(channelId);
    }
  }

  function applyCampaign(nextCampaignId: string) {
    setCampaignId(nextCampaignId);
  }

  function applyProductGroup(productGroupIdValue: string, businessChannelId: string) {
    setProductGroupId(productGroupIdValue);

    if (businessChannelId) {
      setShoppingChannelId(businessChannelId);
    }
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        본문으로 이동
      </a>
      <main className="app-shell" data-product={productType}>
      <aside className="sidebar" aria-label="주요 메뉴">
        <div className="brand-block">
          <div className="brand-mark">SA</div>
          <div>
            <p className="brand-name">Naver SA Autopilot</p>
            <p className="brand-subtitle">세팅부터 운영까지</p>
          </div>
        </div>

        <nav className="nav-list" aria-label="워크스페이스 메뉴">
          <Link className="nav-link" href="/">
            <ExternalLink size={18} />
            홈페이지
          </Link>
          <a className="nav-link active" href="#planner">
            <WandSparkles size={18} />
            자동 세팅
          </a>
          <a className="nav-link" href="#keywords">
            <Search size={18} />
            키워드
          </a>
          <a className="nav-link" href="#approval">
            <ClipboardCheck size={18} />
            승인 큐
          </a>
          <a className="nav-link" href="#operation">
            <Settings2 size={18} />
            운영 추천
          </a>
          <a className="nav-link" href="#report">
            <FileText size={18} />
            리포트
          </a>
          <a className="nav-link" href="#benchmark">
            <BarChart3 size={18} />
            기능 범위
          </a>
          <Link className="nav-link" href="/mypage">
            <ShieldCheck size={18} />
            마이페이지
          </Link>
        </nav>

        <div className="sidebar-note">
          <p className="note-title">MVP 안전모드</p>
          <p>라이브 집행 금지, 삭제 금지, 승인 후 테스트 생성/수정만 허용합니다.</p>
        </div>
      </aside>

      <section className="workspace" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <div>
            <p className="eyebrow">세팅 워크벤치</p>
            <h1>{plan.input.brandName} {productLabel} 자동 세팅</h1>
            <div className="topbar-meta" aria-label="현재 작업 정보">
              <span>{productLabel}</span>
              <span>{plan.input.vertical}</span>
              <span>{modeLabel}</span>
              <span>{memberEmail}</span>
              <span>임시저장 활성</span>
            </div>
          </div>
          <div className="topbar-actions">
            <a className="icon-button subtle" href={plan.input.siteUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={17} />
              사이트
            </a>
            <button className="icon-button subtle" type="button" onClick={downloadCsv}>
              <Download size={17} />
              {keywordLabel} CSV
            </button>
            <button className="icon-button subtle" type="button" onClick={resetWorkspaceDraft}>
              <PauseCircle size={17} />
              임시저장 초기화
            </button>
            <Link className="icon-button primary" href="/mypage">
              <ShieldCheck size={17} />
              계정
            </Link>
          </div>
        </header>

        <section className="status-board" aria-label="작업 상태판">
          <StatusTile
            label="승인 큐"
            value={`${approvalSummary.approved}/${plan.stagedChanges.length}`}
            caption={`${approvalSummary.pending}건 대기`}
            tone={approvalTone}
          />
          <StatusTile
            label={isShoppingSearch ? "쇼핑채널" : "비즈채널"}
            value={channelStatusLabel}
            caption={
              executionConnectionApplied
                ? isShoppingSearch
                  ? "쇼핑몰/상품그룹 적용"
                  : "PC/모바일 적용"
                : isShoppingSearch && channelApplied
                  ? "상품그룹 적용 필요"
                  : "계정 스캔 필요"
            }
            tone={executionConnectionApplied ? "green" : "amber"}
          />
          <StatusTile
            label="차단"
            value={`${executionDraft.validation.blockerCount}건`}
            caption="전송 전 해결"
            tone={blockerTone}
          />
          <StatusTile
            label="예상 클릭"
            value={`${currencyFormatter.format(plan.forecast.expectedClicks)}회`}
            caption={`평균 CPC ${currencyFormatter.format(plan.forecast.avgCpc)}원`}
            tone="blue"
          />
          <StatusTile label="집행 상태" value="Live off" caption="삭제도 금지" tone="green" />
        </section>

        <section className="execution-rail" aria-label="승인부터 저장까지 실행 순서">
          <div className="execution-rail-heading">
            <div>
              <p className="eyebrow">Execution Rail</p>
              <h2>승인에서 이력 저장까지 한 번에 진행</h2>
            </div>
            <span>{nextAction.status}</span>
          </div>
          <div className="rail-step-grid">
            <article className={approvalSummary.approved > 0 ? "done" : "attention"}>
              <span>01</span>
              <strong>승인 확정</strong>
              <p>{approvalSummary.approved}건 승인, {approvalSummary.pending}건 대기</p>
              <button className="icon-button subtle" type="button" onClick={approveAllChanges}>
                <CheckCircle2 size={17} />
                차단 제외 승인
              </button>
            </article>
            <article className={executionConnectionApplied ? "done" : "attention"}>
              <span>02</span>
              <strong>계정 스캔</strong>
              <p>
                {executionConnectionApplied
                  ? isShoppingSearch
                    ? "쇼핑몰 채널과 상품그룹이 적용되었습니다"
                    : "채널이 적용되었습니다"
                  : isShoppingSearch && channelApplied
                    ? "상품그룹을 조회하고 적용합니다"
                  : canScanAccount
                    ? "Naver 채널을 조회하고 적용합니다"
                    : "먼저 승인할 항목을 선택하세요"}
              </p>
              <button
                className="icon-button subtle"
                disabled={!canScanAccount || accountSnapshotState.status === "loading"}
                type="button"
                onClick={loadAccountSnapshot}
              >
                <Search size={17} />
                {accountSnapshotState.status === "loading" ? "스캔 중" : "계정 스캔"}
              </button>
            </article>
            <article className={stageValidated ? "done" : "attention"}>
              <span>03</span>
              <strong>초안 검증</strong>
              <p>
                {canValidateDraft
                  ? `${executionDraft.validation.blockerCount}건 차단, ${executionDraft.payloads.length}개 payload`
                  : "승인과 채널 적용 후 검증할 수 있습니다"}
              </p>
              <button
                className="icon-button subtle"
                disabled={!canValidateDraft || activeStageDraftState.status === "loading"}
                type="button"
                onClick={stageExecutionDraft}
              >
                <Rocket size={17} />
                {activeStageDraftState.status === "loading" ? "검증 중" : "초안 검증"}
              </button>
            </article>
            <article className={activeSaveDraftState.status === "success" ? "done" : "pending"}>
              <span>04</span>
              <strong>이력 저장</strong>
              <p>
                {canSaveHistory
                  ? stageHasBlockers
                    ? "차단된 검증 결과까지 이력으로 남깁니다"
                    : "승인 상태와 전송 초안을 Supabase에 남깁니다"
                  : "초안 검증 후 저장할 수 있습니다"}
              </p>
              <button
                className="icon-button primary"
                disabled={!canSaveHistory || activeSaveDraftState.status === "loading"}
                type="button"
                onClick={saveDraftHistory}
              >
                <FileText size={17} />
                {activeSaveDraftState.status === "loading" ? "저장 중" : stageHasBlockers ? "차단 이력 저장" : "이력 저장"}
              </button>
            </article>
          </div>
          <div className="rail-notice-stack">
            <MemberSessionNotice email={memberEmail} />
            <AccountSnapshotNotice
              productType={productType}
              state={accountSnapshotState}
              onApplyChannel={applyBusinessChannel}
              onApplyCampaign={applyCampaign}
              onApplyProductGroup={applyProductGroup}
            />
            <StageDraftNotice state={activeStageDraftState} />
            <SaveDraftNotice state={activeSaveDraftState} />
          </div>
        </section>

        <section className="workbench-grid" id="planner" aria-label="세팅 워크벤치">
          <article className="setup-panel input-column">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">입력값</p>
                <h2>캠페인 기준</h2>
              </div>
              <div className="segmented-control product-control" aria-label="검색 상품">
                <button
                  aria-pressed={productType === "powerlink"}
                  className={productType === "powerlink" ? "active" : ""}
                  type="button"
                  onClick={() => setProductType("powerlink")}
                >
                  파워링크
                </button>
                <button
                  aria-pressed={productType === "shoppingSearch"}
                  className={productType === "shoppingSearch" ? "active" : ""}
                  type="button"
                  onClick={() => setProductType("shoppingSearch")}
                >
                  쇼핑검색
                </button>
              </div>
              <div className="segmented-control" aria-label="사용자 모드">
                <button
                  aria-pressed={mode === "agency"}
                  className={mode === "agency" ? "active" : ""}
                  type="button"
                  onClick={() => setMode("agency")}
                >
                  대행사
                </button>
                <button
                  aria-pressed={mode === "advertiser"}
                  className={mode === "advertiser" ? "active" : ""}
                  type="button"
                  onClick={() => setMode("advertiser")}
                >
                  광고주
                </button>
              </div>
            </div>

            <div className="product-brief" aria-label={`${productLabel} 세팅 안내`}>
              <p>{productBrief.eyebrow}</p>
              <strong>{productBrief.title}</strong>
              <span>{productBrief.description}</span>
              <dl>
                {productBrief.rows.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="control-grid single">
              <label className="field">
                <span>브랜드명</span>
                <input value={brandName} onChange={(event) => setBrandName(event.target.value)} />
              </label>
              <label className="field">
                <span>사이트 URL</span>
                <input value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} />
              </label>
              <label className="field">
                <span>업종</span>
                <input value={vertical} onChange={(event) => setVertical(event.target.value)} />
              </label>
              <label className="field">
                <span>월 테스트 예산</span>
                <input
                  min={100000}
                  step={100000}
                  type="number"
                  value={monthlyBudget}
                  onChange={(event) => setMonthlyBudget(event.target.valueAsNumber)}
                />
              </label>
              <label className="field">
                <span>최대 입찰가</span>
                <input
                  min={300}
                  step={50}
                  type="number"
                  value={maxBid}
                  onChange={(event) => setMaxBid(event.target.valueAsNumber)}
                />
              </label>
            </div>

            <label className="field keyword-input">
              <span>{isShoppingSearch ? "상품 검색어 시드" : "시드 키워드"}</span>
              <textarea value={seedText} onChange={(event) => setSeedText(event.target.value)} />
            </label>
          </article>

          <article className="table-panel approval-core" id="approval">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">승인 큐</p>
                <h2>전송 전 검수할 작업</h2>
              </div>
              <div className="inline-actions">
                <button className="icon-button subtle" type="button" onClick={approveAllChanges}>
                  <CheckCircle2 size={17} />
                  차단 제외 승인
                </button>
                <button className="icon-button subtle" type="button" onClick={resetDecisions}>
                  <PauseCircle size={17} />
                  초기화
                </button>
                <button className="icon-button subtle" type="button" onClick={downloadApprovalCsv}>
                  <Download size={17} />
                  승인 CSV
                </button>
              </div>
            </div>
            <div className="approval-summary" aria-label="승인 상태 요약">
              <span>승인 {approvalSummary.approved}</span>
              <span>보류 {approvalSummary.held}</span>
              <span>대기 {approvalSummary.pending}</span>
            </div>
            <div className="approval-toolbar" aria-label="승인 큐 필터와 검색">
              <div className="segmented-control filter-control" aria-label="승인 상태 필터">
                {(["all", "pending", "approved", "held", "blocked"] as const).map((filter) => (
                  <button
                    aria-pressed={approvalFilter === filter}
                    className={approvalFilter === filter ? "active" : ""}
                    key={filter}
                    type="button"
                    onClick={() => setApprovalFilter(filter)}
                  >
                    {approvalFilterLabel(filter)}
                  </button>
                ))}
              </div>
              <label className="search-field">
                <Search size={16} />
                <span className="sr-only">승인 큐 검색</span>
                <input
                  placeholder="대상, 액션, 위험도 검색"
                  value={approvalSearch}
                  onChange={(event) => setApprovalSearch(event.target.value)}
                />
              </label>
            </div>
            <div className="approval-progress" aria-label={`승인 진행률 ${approvalProgress}%`}>
              <span>
                <i style={{ width: `${approvalProgress}%` }} />
              </span>
              <em>{approvalProgress}% 승인 완료</em>
            </div>
            <div className="approval-worklist" aria-label="승인할 변경 목록">
              {filteredStagedChanges.length === 0 ? (
                <div className="empty-state">
                  <strong>조건에 맞는 승인 항목이 없습니다</strong>
                  <span>필터나 검색어를 조정하면 숨겨진 항목을 다시 볼 수 있습니다.</span>
                </div>
              ) : null}
              {filteredStagedChanges.map((change) => {
                const decision = approvalDecisions[change.id] ?? "pending";
                const note = approvalNotes[change.id] ?? "";

                return (
                  <div className="approval-row" key={change.id}>
                    <div className="approval-row-main">
                      <span className={`status-pill ${decisionClass(decision)}`}>{decisionLabel(decision)}</span>
                      <div>
                        <strong>{change.target}</strong>
                        <p>{change.details}</p>
                      </div>
                    </div>
                    <div className="approval-row-meta">
                      <span>{changeTypeLabel(change.type)}</span>
                      <span>{change.action}</span>
                      <span className={`status-pill ${riskClass(change.risk)}`}>{riskLabel(change.risk)}</span>
                    </div>
                    <div className="decision-actions inline">
                      <button
                        aria-pressed={decision === "approved"}
                        className={decision === "approved" ? "selected approved" : ""}
                        type="button"
                        onClick={() => setDecision(change.id, "approved")}
                      >
                        승인
                      </button>
                      <button
                        aria-pressed={decision === "held"}
                        className={decision === "held" ? "selected held" : ""}
                        type="button"
                        onClick={() => setDecision(change.id, "held")}
                      >
                        보류
                      </button>
                    </div>
                    <label className="approval-note-field">
                      <span>승인 메모</span>
                      <input
                        maxLength={240}
                        placeholder="선택 사항: 보류 사유, 승인 근거"
                        value={note}
                        onChange={(event) => setDecisionNote(change.id, event.target.value)}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </article>

          <aside className="inspector-stack" id="execution">
            <article className={`next-action-panel ${nextAction.tone}`} aria-live="polite">
              <div>
                <p className="eyebrow">다음 작업</p>
                <h2>{nextAction.title}</h2>
                <span>{nextAction.description}</span>
              </div>
              <b>{nextAction.status}</b>
            </article>

            <section className="execution-panel priority">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">전송 점검</p>
                  <h2>Naver 전송 준비</h2>
                </div>
                <button className="icon-button subtle" type="button" onClick={downloadExecutionDraft}>
                  <Download size={17} />
                  JSON
                </button>
              </div>
              <div className="execution-flow-guide" aria-label="전송 준비 진행 순서">
                {executionFlowSteps.map((step, index) => (
                  <div className={step.state} key={step.label}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{step.label}</strong>
                    <em>{step.detail}</em>
                  </div>
                ))}
              </div>
              <div className="execution-controls">
                <label className="field">
                  <span>캠페인 ID</span>
                  <input value={campaignId} onChange={(event) => setCampaignId(event.target.value)} />
                </label>
                {isShoppingSearch ? (
                  <>
                    <label className="field">
                      <span>쇼핑몰 채널 ID</span>
                      <input value={shoppingChannelId} onChange={(event) => setShoppingChannelId(event.target.value)} />
                    </label>
                    <label className="field">
                      <span>상품그룹 ID</span>
                      <input value={productGroupId} onChange={(event) => setProductGroupId(event.target.value)} />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="field">
                      <span>PC 채널 ID</span>
                      <input value={pcChannelId} onChange={(event) => setPcChannelId(event.target.value)} />
                    </label>
                    <label className="field">
                      <span>모바일 채널 ID</span>
                      <input value={mobileChannelId} onChange={(event) => setMobileChannelId(event.target.value)} />
                    </label>
                  </>
                )}
              </div>
              <ul className="preflight-checklist" aria-label="전송 전 체크리스트">
                {preflightChecks.map((check) => (
                  <li className={check.state} key={check.label}>
                    <span aria-hidden="true" />
                    <div>
                      <strong>{check.label}</strong>
                      <em>{check.detail}</em>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="execution-grid">
                <div>
                  <span>승인</span>
                  <strong>{executionDraft.approvedChangeCount}건</strong>
                </div>
                <div>
                  <span>전송 초안</span>
                  <strong>{executionDraft.payloads.length}개</strong>
                </div>
                <div>
                  <span>안전모드</span>
                  <strong>Live off</strong>
                </div>
                <div>
                  <span>차단</span>
                  <strong>{executionDraft.validation.blockerCount}건</strong>
                </div>
              </div>
              <div className="payload-list compact">
                {executionDraft.payloads.length === 0 ? (
                  <p>승인된 항목이 없어서 아직 전송 초안이 없습니다.</p>
                ) : (
                  executionDraft.payloads.slice(0, 4).map((payload) => (
                    <div className="payload-item" key={payload.id}>
                      <strong>{payload.target}</strong>
                      <span>
                        {payload.method} {payload.uri}
                      </span>
                      <em>{payload.entityType} / {payload.idempotencyKey}</em>
                    </div>
                  ))
                )}
                {executionDraft.payloads.length > 4 ? <p>외 {executionDraft.payloads.length - 4}개 초안</p> : null}
              </div>
            </section>

            <article className="workflow-panel compact-flow">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">진행 단계</p>
                  <h2>세팅 완료까지</h2>
                </div>
              </div>
              <div className="workflow-strip vertical">
                {setupSteps.map((step, index) => (
                  <div className={`workflow-step ${step.state}`} key={step.label}>
                    <span>{index + 1}</span>
                    <strong>{step.label}</strong>
                    <em>{step.detail}</em>
                  </div>
                ))}
              </div>
            </article>
          </aside>
        </section>

        <section className="forecast-band" aria-label="자동 생성 요약">
          <SummaryCard label={`포함 ${keywordLabel}`} value={`${includedKeywords.length}개`} caption="등록 초안 생성 대상" tone="green" />
          <SummaryCard label={`검토 ${keywordLabel}`} value={`${reviewKeywords.length}개`} caption="승인 전 보류" tone="amber" />
          <SummaryCard label={`제외 ${keywordLabel}`} value={`${excludedKeywords.length}개`} caption="저품질 유입 차단" tone="rose" />
          <SummaryCard label="광고그룹" value={`${plan.forecast.adGroupCount}개`} caption="상품군/의도 기준" tone="blue" />
        </section>

        <section className="work-grid">
          <article className="table-panel" id="keywords">
            <div className="section-heading">
              <div>
                <p className="eyebrow">키워드 엔진</p>
                <h2>{isShoppingSearch ? "상품 검색어와 그룹 초안" : "추천 키워드와 입찰 초안"}</h2>
              </div>
              <button className="icon-button subtle" type="button" onClick={downloadCsv}>
                <Download size={17} />
                내보내기
              </button>
            </div>

            <div className="table-wrap">
              <table>
                <caption className="sr-only">{productLabel} 추천 {keywordLabel} 목록</caption>
                <thead>
                  <tr>
                    <th>키워드</th>
                    <th>의도</th>
                    <th>광고그룹</th>
                    <th>입찰가</th>
                    <th>예상 클릭</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.keywords.map((keyword) => (
                    <tr key={keyword.term}>
                      <td>
                        <strong>{keyword.term}</strong>
                        <span>{keyword.reason}</span>
                      </td>
                      <td>{keyword.intent}</td>
                      <td>{keyword.group}</td>
                      <td>{keyword.bid ? `${currencyFormatter.format(keyword.bid)}원` : "-"}</td>
                      <td>{currencyFormatter.format(keyword.expectedClicks)}</td>
                      <td>
                        <span className={`status-pill ${statusClass(keyword.status)}`}>{keyword.statusLabel}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <aside className="side-stack">
            <article className="workflow-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">예상 효과</p>
                  <h2>테스트 운영 범위</h2>
                </div>
                <Sparkles size={20} />
              </div>
              <div className="forecast-list">
                <Metric label="월 예산" value={`${currencyFormatter.format(plan.forecast.monthlyBudget)}원`} />
                <Metric label="예상 클릭" value={`${currencyFormatter.format(plan.forecast.expectedClicks)}회`} />
                <Metric label="평균 CPC" value={`${currencyFormatter.format(plan.forecast.avgCpc)}원`} />
                <Metric label="절감 시간" value={`${plan.forecast.setupHoursSaved}시간`} />
              </div>
            </article>

            <article className="adgroup-panel">
              <div className="section-heading">
                <div>
                <p className="eyebrow">광고 구조</p>
                  <h2>{isShoppingSearch ? "쇼핑 광고그룹 초안" : "광고그룹 초안"}</h2>
                </div>
              </div>
              <div className="adgroup-list">
                {plan.adGroups.map((group) => (
                  <div className="adgroup-item" key={group.name}>
                    <div>
                      <strong>{group.name}</strong>
                      <span>{group.description}</span>
                    </div>
                    <p>{currencyFormatter.format(group.dailyBudget)}원/일</p>
                  </div>
                ))}
              </div>
            </article>

            {isShoppingSearch ? (
              <article className="adgroup-panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">쇼핑 구조</p>
                    <h2>상품그룹 추천</h2>
                  </div>
                </div>
                <div className="adgroup-list">
                  {plan.productGroups.map((group) => (
                    <div className="product-group-card" key={group.name}>
                      <strong>{group.name}</strong>
                      <span>{group.queryCount}개 검색어를 {group.sourceGroup} 상품군에 연결합니다.</span>
                      <div className="keyword-chips compact">
                        {group.productHints.map((hint) => (
                          <span key={hint}>{hint}</span>
                        ))}
                      </div>
                      <ul>
                        {group.feedActions.slice(0, 2).map((action) => (
                          <li key={action}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </article>
            ) : (
              <article className="adgroup-panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">파워링크 템플릿</p>
                    <h2>{plan.industryTemplate.name} 세팅 기준</h2>
                  </div>
                </div>
                <div className="template-list">
                  <div>
                    <strong>랜딩 체크</strong>
                    {plan.industryTemplate.landingChecks.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                  <div>
                    <strong>소재 규칙</strong>
                    {plan.industryTemplate.copyRules.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </div>
              </article>
            )}

            <article className="policy-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">제외어</p>
                  <h2>제외 키워드 제안</h2>
                </div>
              </div>
              <div className="keyword-chips">
                {plan.negativeKeywords.map((keyword) => (
                  <span key={keyword}>{keyword}</span>
                ))}
              </div>
            </article>
          </aside>
        </section>

        <section className="operation-section" id="operation">
          <article className="table-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">운영 추천</p>
                <h2>자동 최적화 후보</h2>
              </div>
            </div>
            <div className="optimization-list">
              {optimizationRecommendations.map((item) => (
                <div className="optimization-item" key={item.id}>
                  <div>
                    <span className={`status-pill ${severityClass(item.severity)}`}>{severityLabel(item.severity)}</span>
                    <strong>{item.entity}</strong>
                  </div>
                  <p>{item.trigger}</p>
                  <span>{item.recommendation}</span>
                  <em>
                    {item.scope} / {item.automationLevel} / {item.expectedImpact}
                  </em>
                </div>
              ))}
            </div>
            <div className="rule-list">
              {plan.operationRules.map((rule) => (
                <div className="rule-item" key={rule.name}>
                  <strong>{rule.name}</strong>
                  <p>{rule.trigger}</p>
                  <span>{rule.recommendation}</span>
                  <em>{rule.automationLevel}</em>
                </div>
              ))}
            </div>
          </article>

          <article className="policy-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">안전 제한</p>
                <h2>실행 가드레일</h2>
              </div>
              <ShieldCheck size={20} />
            </div>
            <ul className="policy-list">
              <li>
                <PauseCircle size={18} />
                라이브 캠페인 활성화 차단
              </li>
              <li>
                <AlertTriangle size={18} />
                입찰가 최대 {currencyFormatter.format(plan.input.maxBid)}원
              </li>
              <li>
                <CheckCircle2 size={18} />
                승인 {approvalSummary.approved}건 / 보류 {approvalSummary.held}건
              </li>
              <li>
                <ShieldCheck size={18} />
                {naverReadiness?.ok
                  ? "공식 Search AD 서명 방식 준비 완료"
                  : `환경변수 ${naverReadiness?.configuration.missingCount ?? "-"}개 확인 필요`}
              </li>
            </ul>
          </article>
        </section>

        <section className="report-panel" id="report">
          <div className="section-heading">
            <div>
              <p className="eyebrow">리포트</p>
              <h2>광고주/내부 공유용 요약</h2>
            </div>
            <div className="inline-actions report-actions">
              <button className="icon-button subtle" type="button" onClick={printReport}>
                <Printer size={17} />
                PDF
              </button>
              <button className="icon-button subtle" type="button" onClick={downloadExcelReport}>
                <Download size={17} />
                Excel
              </button>
              <button className="icon-button subtle" type="button" onClick={downloadReport}>
                <Download size={17} />
                Markdown
              </button>
            </div>
          </div>
          <div className="report-grid">
            <div>
              <strong>{plan.input.brandName} 세팅 요약</strong>
              <p>
                {plan.input.vertical} 기준으로 {plan.forecast.adGroupCount}개 광고그룹과{" "}
                {plan.forecast.includedKeywords}개 포함 {keywordLabel}를 생성했습니다.
              </p>
            </div>
            <div>
              <strong>예상 운영 범위</strong>
              <p>
                월 {currencyFormatter.format(plan.forecast.monthlyBudget)}원 테스트 예산에서 예상 클릭{" "}
                {currencyFormatter.format(plan.forecast.expectedClicks)}회, 평균 CPC{" "}
                {currencyFormatter.format(plan.forecast.avgCpc)}원입니다.
              </p>
            </div>
            <div>
              <strong>다음 액션</strong>
              <p>
                승인 {approvalSummary.approved}건, 보류 {approvalSummary.held}건, 대기{" "}
                {approvalSummary.pending}건입니다. 승인된 항목도 현재는 외부 전송 없이 초안 상태로만 유지됩니다.
              </p>
            </div>
          </div>
        </section>

        <section className="benchmark-panel" id="benchmark">
          <div className="section-heading">
            <div>
              <p className="eyebrow">구현 범위</p>
              <h2>벤치마크 기능 반영 상태</h2>
            </div>
            <FileText size={20} />
          </div>
          <div className="benchmark-grid">
            {plan.benchmarkFeatures.map((feature) => (
              <FeatureCard feature={feature} key={feature.name} />
            ))}
          </div>
          <div className="assumption-box">
            {plan.assumptions.map((assumption) => (
              <p key={assumption}>{assumption}</p>
            ))}
          </div>
        </section>

        <section className="productization-panel" aria-label="제품화 준비 상태">
          <div className="section-heading">
            <div>
              <p className="eyebrow">제품화</p>
              <h2>대행사/광고주 운영 전환 체크</h2>
            </div>
            <ShieldCheck size={20} />
          </div>
          <div className="productization-grid">
            <div>
              <strong>권한</strong>
              <span>회원 세션 기반으로 보호 API를 호출합니다. 다음 단계는 워크스페이스별 역할 분리입니다.</span>
            </div>
            <div>
              <strong>워크스페이스</strong>
              <span>저장 시 workspace와 planning run을 생성해 계정별 이력을 묶을 수 있습니다.</span>
            </div>
            <div>
              <strong>리포트</strong>
              <span>Markdown/CSV export 이후 PDF, Excel, 공유 링크로 확장할 준비가 되어 있습니다.</span>
            </div>
          </div>
        </section>
      </section>
    </main>
    </>
  );
}

function StageDraftNotice({ state }: { state: StageDraftState }) {
  if (state.status === "idle") {
    return null;
  }

  if (state.status === "loading") {
    return (
      <div className="stage-notice neutral">
        <strong>{state.message}</strong>
        <span>서버에서 승인 항목과 안전 가드레일을 다시 계산합니다.</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="stage-notice danger">
        <strong>초안 검증 실패</strong>
        <span>{state.message}</span>
      </div>
    );
  }

  const validation = state.response.draft.validation;
  const readyLabel = validation.canExecuteTest ? "보호 실행 요청 가능" : `차단 ${validation.blockerCount}건`;
  const visibleBlockers = validation.blockers.slice(0, 4);
  const visibleWarnings = validation.warnings.slice(0, 3);

  return (
    <div className={`stage-notice ${validation.canExecuteTest ? "success" : "warning"}`}>
      <div>
        <strong>{readyLabel}</strong>
        <span>{state.response.draft.draftId}</span>
      </div>
      {visibleBlockers.length > 0 ? (
        <div className="blocker-list">
          {visibleBlockers.map((blocker) => (
            <span key={`${blocker.code}-${blocker.payloadId ?? "draft"}`}>
              {blocker.payloadId ? `${blocker.payloadId}: ` : ""}
              {blocker.message}
            </span>
          ))}
        </div>
      ) : null}
      {visibleWarnings.length > 0 ? (
        <div className="blocker-list">
          {visibleWarnings.map((warning) => (
            <span key={`${warning.code}-${warning.payloadId ?? "draft"}`}>
              {warning.payloadId ? `${warning.payloadId}: ` : ""}
              {warning.message}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MemberSessionNotice({ email }: { email: string }) {
  return (
    <div className="stage-notice success member-session-notice">
      <div>
        <strong>회원 세션 확인 완료</strong>
        <span>{email}</span>
      </div>
      <div className="member-capability-grid">
        <span className="enabled">계정 스캔</span>
        <span className="enabled">이력 저장</span>
        <span className="blocked">테스트 생성</span>
        <span className="blocked">라이브 활성화</span>
        <span className="blocked">삭제</span>
      </div>
      <span>live: blocked / delete: blocked</span>
    </div>
  );
}

function SaveDraftNotice({ state }: { state: SaveDraftState }) {
  if (state.status === "idle") {
    return null;
  }

  if (state.status === "loading") {
    return (
      <div className="stage-notice neutral">
        <strong>이력 저장 중</strong>
        <span>승인 상태, 전송 초안, payload 지문을 Supabase에 저장합니다.</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="stage-notice danger">
        <strong>이력 저장 실패</strong>
        <span>{state.message}</span>
      </div>
    );
  }

  return (
    <div className="stage-notice success">
      <strong>{state.message}</strong>
      <span>planning run: {state.planningRunId}</span>
      {state.executionDraftId ? <span>execution draft: {state.executionDraftId}</span> : null}
      <Link className="inline-history-link" href={`/history/${state.planningRunId}`}>
        저장 이력 열기
      </Link>
      {state.warnings.length > 0 ? (
        <div className="blocker-list">
          {state.warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AccountSnapshotNotice({
  productType,
  state,
  onApplyChannel,
  onApplyCampaign,
  onApplyProductGroup
}: {
  productType: PlannerProductType;
  state: AccountSnapshotState;
  onApplyChannel: (channelId: string, target?: "shopping" | "pc" | "mobile" | "both") => void;
  onApplyCampaign: (campaignId: string) => void;
  onApplyProductGroup: (productGroupId: string, businessChannelId: string) => void;
}) {
  if (state.status === "idle") {
    return null;
  }

  if (state.status === "loading") {
    return (
      <div className="stage-notice neutral">
        <strong>Naver 계정 스캔 중</strong>
        <span>비즈채널, 상품그룹, 캠페인을 read-only로 조회합니다.</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="stage-notice danger">
        <strong>계정 스캔 실패</strong>
        <span>{state.message}</span>
      </div>
    );
  }

  const isShoppingSearch = productType === "shoppingSearch";
  const productGroups = (state.response.productGroups ?? []).filter((productGroup) => productGroup.id);
  const campaigns = (state.response.campaigns ?? []).filter((campaign) => campaign.nccCampaignId);
  const snapshotWarnings = Object.entries(state.response.errors ?? {}).filter((entry): entry is [string, string] =>
    Boolean(entry[1])
  );
  const eligibleChannels = (state.response.channels ?? []).filter((channel) => {
    if (!channel.id) {
      return false;
    }

    if (!isShoppingSearch) {
      return channel.channelTp === "SITE" || Boolean(channel.site || channel.mobileSite);
    }

    return (
      ["MALL", "CATALOG", "SHOPPING", "SHOPPING_BRAND"].includes(channel.channelTp) ||
      productGroups.some((productGroup) => productGroup.businessChannelId === channel.id)
    );
  });

  return (
    <div className="account-snapshot">
      <div className="snapshot-summary">
        <span>{isShoppingSearch ? "쇼핑채널" : "비즈채널"} {eligibleChannels.length}개</span>
        {isShoppingSearch ? <span>상품그룹 {productGroups.length}개</span> : null}
        <span>캠페인 {campaigns.length}개</span>
      </div>
      {state.response.partial && snapshotWarnings.length > 0 ? (
        <div className="snapshot-warning-list">
          <strong>일부 항목은 조회하지 못했습니다</strong>
          {snapshotWarnings.map(([scope, message]) => (
            <span key={scope}>
              {snapshotScopeLabel(scope)}: {message}
            </span>
          ))}
        </div>
      ) : null}
      <div className="channel-list">
        {eligibleChannels.length === 0 ? (
          <span>
            {isShoppingSearch
              ? "사용 가능한 쇼핑몰 채널이 없습니다. Naver 검색광고에서 쇼핑몰 비즈채널을 먼저 등록해야 합니다."
              : "사용 가능한 비즈채널이 없습니다. Naver 검색광고에서 사이트 비즈채널을 먼저 등록해야 합니다."}
          </span>
        ) : (
          eligibleChannels.map((channel) => (
            <div className="channel-item" key={channel.id}>
              <div>
                <strong>{channel.name}</strong>
                <span>
                  {channel.channelTp} / {channel.inspectStatus ?? "상태 미확인"}
                </span>
                <em>{channel.site ?? channel.mobileSite ?? "URL 미확인"}</em>
              </div>
              <button className="icon-button subtle" type="button" onClick={() => onApplyChannel(channel.id)}>
                {isShoppingSearch ? "적용" : "둘 다"}
              </button>
              {!isShoppingSearch ? (
                <div className="channel-action-group">
                  <button className="icon-button subtle" type="button" onClick={() => onApplyChannel(channel.id, "pc")}>
                    PC
                  </button>
                  <button
                    className="icon-button subtle"
                    type="button"
                    onClick={() => onApplyChannel(channel.id, "mobile")}
                  >
                    모바일
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
      <div className="channel-list campaign-list">
        {campaigns.length === 0 ? (
          <span>조회된 캠페인이 없습니다. 캠페인 생성 초안을 승인하거나 캠페인 ID를 직접 입력하세요.</span>
        ) : (
          campaigns.map((campaign) => (
            <div className="channel-item" key={campaign.nccCampaignId}>
              <div>
                <strong>{campaign.name ?? "캠페인 이름 없음"}</strong>
                <span>{campaign.userLock ? "OFF/잠금 상태" : "상태 확인 필요"}</span>
                <em>{campaign.nccCampaignId}</em>
              </div>
              <button
                className="icon-button subtle"
                type="button"
                onClick={() => onApplyCampaign(campaign.nccCampaignId ?? "")}
              >
                캠페인 적용
              </button>
            </div>
          ))
        )}
      </div>
      {isShoppingSearch ? (
        <div className="channel-list product-group-list">
          {productGroups.length === 0 ? (
            <span>등록된 상품그룹이 없습니다. 쇼핑검색 상품그룹은 네이버 콘솔에서 먼저 구성한 뒤 API로 조회합니다.</span>
          ) : (
            productGroups.map((productGroup) => (
              <div className="channel-item" key={productGroup.id}>
                <div>
                  <strong>{productGroup.name}</strong>
                  <span>
                    {productGroup.mallName ?? "몰 이름 없음"} / {productGroup.registeredProductType ?? "유형 미확인"}
                  </span>
                  <em>
                    상품 {productGroup.productCount ?? "-"}개 / 연결 광고그룹 {productGroup.numberOfAdgroups}개
                  </em>
                </div>
                <button
                  className="icon-button subtle"
                  type="button"
                  onClick={() => onApplyProductGroup(productGroup.id, productGroup.businessChannelId)}
                >
                  적용
                </button>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryCard({ label, value, caption, tone }: { label: string; value: string; caption: string; tone: string }) {
  return (
    <article className={`metric-card ${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{caption}</span>
    </article>
  );
}

function StatusTile({ label, value, caption, tone }: { label: string; value: string; caption: string; tone: string }) {
  return (
    <article className={`status-tile ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{caption}</em>
    </article>
  );
}

function readWorkspaceDraftSnapshot(userId: string | undefined): WorkspaceDraftSnapshot | null {
  if (!userId || typeof window === "undefined") {
    return null;
  }

  return parseWorkspaceDraftSnapshot(window.localStorage.getItem(`${WORKSPACE_DRAFT_STORAGE_PREFIX}:${userId}`));
}

function parseWorkspaceDraftSnapshot(value: string | null): WorkspaceDraftSnapshot | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!isRecord(parsed) || parsed.version !== 1 || typeof parsed.savedAt !== "string") {
      return null;
    }

    const input = parseWorkspaceInput(parsed.input);

    if (!input) {
      return null;
    }

    return {
      version: 1,
      savedAt: parsed.savedAt,
      input,
      decisions: parseApprovalDecisions(parsed.decisions),
      decisionNotes: parseApprovalNotes(parsed.decisionNotes),
      executionContext: parseExecutionContext(parsed.executionContext)
    };
  } catch {
    return null;
  }
}

function parseWorkspaceInput(value: unknown): PlannerInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const productType = value.productType === "shoppingSearch" || value.productType === "powerlink" ? value.productType : null;
  const mode = value.mode === "agency" || value.mode === "advertiser" ? value.mode : null;
  const monthlyBudget = finiteNumber(value.monthlyBudget);
  const maxBid = finiteNumber(value.maxBid);

  if (!productType || !mode || monthlyBudget === null || maxBid === null) {
    return null;
  }

  return {
    brandName: stringOrDefault(value.brandName, mardDefaultInput.brandName),
    siteUrl: stringOrDefault(value.siteUrl, mardDefaultInput.siteUrl),
    vertical: stringOrDefault(value.vertical, mardDefaultInput.vertical),
    monthlyBudget,
    maxBid,
    mode,
    productType,
    seedKeywords: Array.isArray(value.seedKeywords)
      ? value.seedKeywords.filter((item): item is string => typeof item === "string")
      : mardDefaultInput.seedKeywords
  };
}

function parseApprovalDecisions(value: unknown): ApprovalDecisionMap {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, ApprovalDecision] => {
      return entry[1] === "approved" || entry[1] === "held" || entry[1] === "pending";
    })
  );
}

function parseApprovalNotes(value: unknown): ApprovalDecisionNoteMap {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, note]) => [key, typeof note === "string" ? note.slice(0, 240) : ""] as const)
      .filter((entry): entry is [string, string] => entry[1].trim().length > 0)
  );
}

function parseExecutionContext(value: unknown): WorkspaceDraftSnapshot["executionContext"] {
  if (!isRecord(value)) {
    return {};
  }

  return {
    campaignId: stringOrUndefined(value.campaignId),
    pcChannelId: stringOrUndefined(value.pcChannelId),
    mobileChannelId: stringOrUndefined(value.mobileChannelId),
    shoppingChannelId: stringOrUndefined(value.shoppingChannelId),
    productGroupId: stringOrUndefined(value.productGroupId)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number") {
    return null;
  }

  return Number.isFinite(value) ? value : null;
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function FeatureCard({ feature }: { feature: BenchmarkFeature }) {
  const label =
    feature.status === "implemented" ? "MVP 구현" : feature.status === "partial" ? "부분 구현" : "예정";

  return (
    <article className="feature-card">
      <div>
        <strong>{feature.name}</strong>
        <span className={`status-pill ${feature.status}`}>{label}</span>
      </div>
      <p>{feature.description}</p>
    </article>
  );
}

function statusClass(status: KeywordStatus): string {
  return status === "include" ? "include" : status === "review" ? "review" : "exclude";
}

function riskClass(risk: ChangeRisk): string {
  return risk === "low" ? "green" : risk === "medium" ? "amber" : "rose";
}

function riskLabel(risk: ChangeRisk): string {
  return risk === "low" ? "낮음" : risk === "medium" ? "검토" : "차단";
}

function changeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    Campaign: "캠페인",
    Guardrail: "가드레일",
    "Ad Group": "광고그룹",
    "Shopping Ad Group": "쇼핑광고그룹",
    Keyword: "키워드",
    "Ad Copy": "소재",
    "Shopping Feed": "쇼핑피드",
    "Product Query": "상품검색어"
  };

  return labels[type] ?? type;
}

function severityClass(severity: OptimizationSeverity): string {
  return severity === "high" ? "exclude" : severity === "medium" ? "review" : "include";
}

function severityLabel(severity: OptimizationSeverity): string {
  return severity === "high" ? "높음" : severity === "medium" ? "중간" : "낮음";
}

function snapshotScopeLabel(scope: string): string {
  const labels: Record<string, string> = {
    channels: "비즈채널",
    campaigns: "캠페인",
    productGroups: "상품그룹"
  };

  return labels[scope] ?? scope;
}

function decisionLabel(decision: ApprovalDecision): string {
  return decision === "approved" ? "승인됨" : decision === "held" ? "보류됨" : "승인 대기";
}

function decisionClass(decision: ApprovalDecision): string {
  return decision === "approved" ? "include" : decision === "held" ? "review" : "neutral";
}

function approvalFilterLabel(filter: ApprovalFilter): string {
  const labels: Record<ApprovalFilter, string> = {
    all: "전체",
    pending: "대기",
    approved: "승인",
    held: "보류",
    blocked: "차단"
  };

  return labels[filter];
}

type NextActionInput = {
  approvedCount: number;
  channelApplied: boolean;
  stageValidated: boolean;
  canRequestProtectedExecution: boolean;
  blockerCount: number;
  channelStatus?: string | null;
  productType: PlannerProductType;
};

function getNextAction(input: NextActionInput) {
  const isShoppingSearch = input.productType === "shoppingSearch";

  if (input.approvedCount === 0) {
    return {
      title: "승인 큐에서 항목을 승인하세요",
      description: "초안은 준비되어 있지만 승인된 변경이 없어 전송 payload가 생성되지 않습니다.",
      status: "승인 필요",
      tone: "warning"
    };
  }

  if (!input.channelApplied) {
    return {
      title: isShoppingSearch ? "쇼핑몰 채널을 스캔하고 적용하세요" : "비즈채널을 스캔하고 적용하세요",
      description: isShoppingSearch
        ? "Naver 계정의 쇼핑몰 비즈채널 또는 상품그룹을 가져와 쇼핑검색 채널 ID를 채워야 합니다."
        : "Naver 계정에서 사이트 비즈채널을 가져와 PC/모바일 채널 ID를 채워야 합니다.",
      status: isShoppingSearch ? "쇼핑채널 필요" : "채널 필요",
      tone: "warning"
    };
  }

  if (input.blockerCount > 0) {
    return {
      title: "검증 차단 항목을 해결하세요",
      description: `${input.blockerCount}개 차단이 남아 있습니다. 초안 검증 결과에서 원인을 확인하세요.`,
      status: "차단",
      tone: "danger"
    };
  }

  if (!input.stageValidated) {
    return {
      title: "초안 검증을 실행하세요",
      description: "승인과 채널 연결이 끝났습니다. 서버에서 전송 직전 payload를 다시 검증합니다.",
      status: "검증 대기",
      tone: "neutral"
    };
  }

  if (input.channelStatus && input.channelStatus.includes("검토")) {
    return {
      title: "비즈채널 검토 완료를 기다리세요",
      description: "payload는 준비됐지만 Naver 비즈채널이 검토 중이면 실제 테스트 생성은 보류하는 편이 안전합니다.",
      status: "검토중",
      tone: "warning"
    };
  }

  return {
    title: input.canRequestProtectedExecution ? "테스트 실행 요청 준비 완료" : "보호 실행 조건을 확인하세요",
    description: "실제 Naver 생성 요청은 별도 확인 후 보호 라우트에서만 실행합니다.",
    status: "준비",
    tone: "success"
  };
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

function slugFileName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-");
}
