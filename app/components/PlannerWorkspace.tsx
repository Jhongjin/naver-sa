"use client";

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileText,
  PauseCircle,
  Rocket,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  WandSparkles
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createPlannerCsv,
  generatePlannerPlan,
  type BenchmarkFeature,
  type ChangeRisk,
  type KeywordStatus,
  type PlannerInput,
  type PlannerMode
} from "@/lib/planner";
import { createNaverExecutionDraft } from "@/lib/execution-draft";
import {
  createApprovalCsv,
  createPlannerReport,
  summarizeApprovals,
  type ApprovalDecision,
  type ApprovalDecisionMap
} from "@/lib/reporting";
import { generateOptimizationRecommendations, type OptimizationSeverity } from "@/lib/optimization";

type PlannerWorkspaceProps = {
  initialInput: PlannerInput;
};

const currencyFormatter = new Intl.NumberFormat("ko-KR");

type NaverReadiness = {
  ok: boolean;
  state: {
    ready: boolean;
    missing: string[];
    baseUrl: string;
    customerIdPresent: boolean;
  };
  externalRequest: boolean;
  writeExecution: string;
};

type StageDraftResponse = {
  ok: boolean;
  dryRun: boolean;
  automationLevel: string;
  operatorAccess: {
    configured: boolean;
    sameOrigin: boolean;
    mode: "operator-code" | "open-dry-run";
  };
  naver: {
    ready: boolean;
    missing: string[];
    baseUrl: string;
    customerIdPresent: boolean;
  };
  draft: {
    draftId: string;
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
  error?: string;
  code?: string;
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

export function PlannerWorkspace({ initialInput }: PlannerWorkspaceProps) {
  const [mode, setMode] = useState<PlannerMode>(initialInput.mode);
  const [brandName, setBrandName] = useState(initialInput.brandName);
  const [siteUrl, setSiteUrl] = useState(initialInput.siteUrl);
  const [vertical, setVertical] = useState(initialInput.vertical);
  const [monthlyBudget, setMonthlyBudget] = useState(initialInput.monthlyBudget);
  const [maxBid, setMaxBid] = useState(initialInput.maxBid);
  const [seedText, setSeedText] = useState(initialInput.seedKeywords.join("\n"));
  const [approvalDecisions, setApprovalDecisions] = useState<ApprovalDecisionMap>({});
  const [naverReadiness, setNaverReadiness] = useState<NaverReadiness | null>(null);
  const [stageDraftState, setStageDraftState] = useState<StageDraftState>({ status: "idle" });
  const [accountSnapshotState, setAccountSnapshotState] = useState<AccountSnapshotState>({ status: "idle" });
  const [operatorCode, setOperatorCode] = useState("");
  const [pcChannelId, setPcChannelId] = useState("");
  const [mobileChannelId, setMobileChannelId] = useState("");

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
      mode
    }),
    [brandName, maxBid, mode, monthlyBudget, seedKeywords, siteUrl, vertical]
  );
  const executionContext = useMemo(
    () => ({
      pcChannelId: pcChannelId.trim() || undefined,
      mobileChannelId: mobileChannelId.trim() || undefined
    }),
    [mobileChannelId, pcChannelId]
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
  const draftFingerprint = useMemo(
    () => JSON.stringify({ input, decisions: approvalDecisions, executionContext }),
    [approvalDecisions, executionContext, input]
  );
  const activeStageDraftState =
    stageDraftState.status !== "idle" && stageDraftState.fingerprint !== draftFingerprint
      ? ({ status: "idle" } as const)
      : stageDraftState;

  const includedKeywords = plan.keywords.filter((keyword) => keyword.status === "include");
  const reviewKeywords = plan.keywords.filter((keyword) => keyword.status === "review");
  const excludedKeywords = plan.keywords.filter((keyword) => keyword.status === "exclude");
  const channelApplied = Boolean(pcChannelId && mobileChannelId);
  const appliedChannel =
    accountSnapshotState.status === "success"
      ? accountSnapshotState.response.channels?.find((channel) => channel.id === pcChannelId)
      : undefined;
  const stageValidated = activeStageDraftState.status === "success";
  const canRequestProtectedExecution =
    stageValidated && activeStageDraftState.response.draft.validation.canExecuteTest && channelApplied;
  const nextAction = getNextAction({
    approvedCount: approvalSummary.approved,
    channelApplied,
    stageValidated,
    canRequestProtectedExecution,
    blockerCount: executionDraft.validation.blockerCount,
    channelStatus: appliedChannel?.inspectStatus
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
      label: "비즈채널",
      state: channelApplied ? "done" : "attention",
      detail: channelApplied ? "적용됨" : "필요"
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
      createApprovalCsv(plan, approvalDecisions),
      `${slugFileName(plan.input.brandName)}-approval-queue.csv`,
      "text/csv;charset=utf-8"
    );
  }

  function downloadReport() {
    downloadTextFile(
      createPlannerReport(plan, approvalDecisions),
      `${slugFileName(plan.input.brandName)}-setup-report.md`,
      "text/markdown;charset=utf-8"
    );
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

  function approveAllChanges() {
    setApprovalDecisions(
      Object.fromEntries(plan.stagedChanges.map((change) => [change.id, "approved" satisfies ApprovalDecision]))
    );
  }

  function resetDecisions() {
    setApprovalDecisions({});
  }

  async function stageExecutionDraft() {
    setStageDraftState({ status: "loading", fingerprint: draftFingerprint, message: "초안 검증 중" });

    try {
      const response = await fetch("/api/naver/stage-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(operatorCode.trim() ? { "x-operator-code": operatorCode.trim() } : {})
        },
        body: JSON.stringify({
          input,
          decisions: approvalDecisions,
          executionContext
        })
      });
      const data = (await response.json()) as StageDraftResponse | { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error("error" in data && data.error ? data.error : "초안 검증에 실패했습니다.");
      }

      setStageDraftState({ status: "success", fingerprint: draftFingerprint, response: data as StageDraftResponse });
    } catch (error) {
      setStageDraftState({
        status: "error",
        fingerprint: draftFingerprint,
        message: error instanceof Error ? error.message : "초안 검증에 실패했습니다."
      });
    }
  }

  async function loadAccountSnapshot() {
    setAccountSnapshotState({ status: "loading" });

    try {
      const response = await fetch("/api/naver/account-snapshot", {
        headers: {
          ...(operatorCode.trim() ? { "x-operator-code": operatorCode.trim() } : {})
        }
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

  function applyBusinessChannel(channelId: string) {
    setPcChannelId(channelId);
    setMobileChannelId(channelId);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="주요 메뉴">
        <div className="brand-block">
          <div className="brand-mark">SA</div>
          <div>
            <p className="brand-name">Naver SA Autopilot</p>
            <p className="brand-subtitle">세팅부터 운영까지</p>
          </div>
        </div>

        <nav className="nav-list" aria-label="워크스페이스 메뉴">
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
        </nav>

        <div className="sidebar-note">
          <p className="note-title">MVP 안전모드</p>
          <p>라이브 집행 금지, 삭제 금지, 승인 후 테스트 생성/수정만 허용합니다.</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Powerlink / Site Search Ads</p>
            <h1>키워드부터 승인 큐까지 자동 세팅</h1>
          </div>
          <div className="topbar-actions">
            <a className="icon-button subtle" href={plan.input.siteUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={17} />
              사이트 보기
            </a>
            <button className="icon-button subtle" type="button" onClick={downloadCsv}>
              <Download size={17} />
              CSV
            </button>
            <button
              className="icon-button primary"
              type="button"
              disabled={activeStageDraftState.status === "loading"}
              onClick={stageExecutionDraft}
            >
              <Rocket size={17} />
              {activeStageDraftState.status === "loading" ? "검증 중" : "초안 검증"}
            </button>
          </div>
        </header>

        <section className="workflow-strip" aria-label="세팅 진행 단계">
          {setupSteps.map((step, index) => (
            <div className={`workflow-step ${step.state}`} key={step.label}>
              <span>{index + 1}</span>
              <strong>{step.label}</strong>
              <em>{step.detail}</em>
            </div>
          ))}
        </section>

        <section className="command-grid" id="execution">
          <article className={`next-action-panel ${nextAction.tone}`}>
            <div>
              <p className="eyebrow">Next Action</p>
              <h2>{nextAction.title}</h2>
              <span>{nextAction.description}</span>
            </div>
            <b>{nextAction.status}</b>
          </article>

          <section className="execution-panel priority">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Execution Readiness</p>
                <h2>전송 직전 점검</h2>
              </div>
              <button className="icon-button subtle" type="button" onClick={downloadExecutionDraft}>
                <Download size={17} />
                JSON
              </button>
            </div>
            <div className="execution-controls">
              <label className="field">
                <span>운영자 코드</span>
                <input
                  autoComplete="off"
                  type="password"
                  value={operatorCode}
                  onChange={(event) => setOperatorCode(event.target.value)}
                />
              </label>
              <label className="field">
                <span>PC 채널 ID</span>
                <input value={pcChannelId} onChange={(event) => setPcChannelId(event.target.value)} />
              </label>
              <label className="field">
                <span>모바일 채널 ID</span>
                <input value={mobileChannelId} onChange={(event) => setMobileChannelId(event.target.value)} />
              </label>
              <button
                className="icon-button subtle"
                type="button"
                disabled={accountSnapshotState.status === "loading"}
                onClick={loadAccountSnapshot}
              >
                <Search size={17} />
                {accountSnapshotState.status === "loading" ? "스캔 중" : "계정 스캔"}
              </button>
            </div>
            <AccountSnapshotNotice state={accountSnapshotState} onApplyChannel={applyBusinessChannel} />
            <div className="execution-grid">
              <div>
                <span>승인</span>
                <strong>{executionDraft.approvedChangeCount}건</strong>
              </div>
              <div>
                <span>Payload</span>
                <strong>{executionDraft.payloads.length}개</strong>
              </div>
              <div>
                <span>가드레일</span>
                <strong>Live off</strong>
              </div>
              <div>
                <span>차단</span>
                <strong>{executionDraft.validation.blockerCount}건</strong>
              </div>
            </div>
            <StageDraftNotice state={activeStageDraftState} />
            <div className="payload-list compact">
              {executionDraft.payloads.length === 0 ? (
                <p>승인된 항목이 없어서 아직 전송 초안이 없습니다.</p>
              ) : (
                executionDraft.payloads.slice(0, 6).map((payload) => (
                  <div className="payload-item" key={payload.id}>
                    <strong>{payload.target}</strong>
                    <span>
                      {payload.method} {payload.uri}
                    </span>
                    <em>{payload.entityType}</em>
                  </div>
                ))
              )}
              {executionDraft.payloads.length > 6 ? <p>외 {executionDraft.payloads.length - 6}개 payload</p> : null}
            </div>
          </section>
        </section>

        <section className="planner-grid" id="planner">
          <article className="setup-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Input</p>
                <h2>세팅 입력값</h2>
              </div>
              <div className="segmented-control" aria-label="사용자 모드">
                <button className={mode === "agency" ? "active" : ""} type="button" onClick={() => setMode("agency")}>
                  대행사
                </button>
                <button
                  className={mode === "advertiser" ? "active" : ""}
                  type="button"
                  onClick={() => setMode("advertiser")}
                >
                  광고주
                </button>
              </div>
            </div>

            <div className="control-grid">
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
              <span>Seed keyword</span>
              <textarea value={seedText} onChange={(event) => setSeedText(event.target.value)} />
            </label>
          </article>

          <aside className="summary-stack">
            <article className="workflow-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Forecast</p>
                  <h2>예상 효과</h2>
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

            <article className="policy-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Guardrails</p>
                  <h2>실행 제한</h2>
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
                    : `환경변수 ${naverReadiness?.state.missing.length ?? "-"}개 확인 필요`}
                </li>
              </ul>
            </article>
          </aside>
        </section>

        <section className="forecast-band" aria-label="자동 생성 요약">
          <SummaryCard label="포함 키워드" value={`${includedKeywords.length}개`} caption="등록 초안 생성 대상" tone="green" />
          <SummaryCard label="검토 키워드" value={`${reviewKeywords.length}개`} caption="승인 전 보류" tone="amber" />
          <SummaryCard label="제외 키워드" value={`${excludedKeywords.length}개`} caption="저품질 유입 차단" tone="rose" />
          <SummaryCard label="광고그룹" value={`${plan.forecast.adGroupCount}개`} caption="상품군/의도 기준" tone="blue" />
        </section>

        <section className="work-grid">
          <article className="table-panel" id="keywords">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Keyword Engine</p>
                <h2>추천 키워드와 입찰 초안</h2>
              </div>
              <button className="icon-button subtle" type="button" onClick={downloadCsv}>
                <Download size={17} />
                내보내기
              </button>
            </div>

            <div className="table-wrap">
              <table>
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
            <article className="adgroup-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Structure</p>
                  <h2>광고그룹 초안</h2>
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

            <article className="policy-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Negative</p>
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

        <section className="approval-grid" id="approval">
          <article className="table-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Approval Queue</p>
                <h2>승인 대기 실행계획</h2>
              </div>
              <div className="inline-actions">
                <button className="icon-button subtle" type="button" onClick={approveAllChanges}>
                  <CheckCircle2 size={17} />
                  전체 승인
                </button>
                <button className="icon-button subtle" type="button" onClick={resetDecisions}>
                  <PauseCircle size={17} />
                  초기화
                </button>
                <button className="icon-button subtle" type="button" onClick={downloadApprovalCsv}>
                  <Download size={17} />
                  승인 CSV
                </button>
                <span className="pill">Live off</span>
              </div>
            </div>
            <div className="approval-summary" aria-label="승인 상태 요약">
              <span>승인 {approvalSummary.approved}</span>
              <span>보류 {approvalSummary.held}</span>
              <span>대기 {approvalSummary.pending}</span>
            </div>
            <div className="table-wrap approval-table">
              <table>
                <thead>
                  <tr>
                    <th>상태</th>
                    <th>유형</th>
                    <th>대상</th>
                    <th>작업</th>
                    <th>위험</th>
                    <th>결정</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.stagedChanges.map((change) => {
                    const decision = approvalDecisions[change.id] ?? "pending";

                    return (
                      <tr key={change.id}>
                        <td>
                          <span className={`status-pill ${decisionClass(decision)}`}>{decisionLabel(decision)}</span>
                        </td>
                        <td>{change.type}</td>
                        <td>
                          <strong>{change.target}</strong>
                          <span>{change.details}</span>
                        </td>
                        <td>{change.action}</td>
                        <td>
                          <span className={`status-pill ${riskClass(change.risk)}`}>{riskLabel(change.risk)}</span>
                        </td>
                        <td>
                          <div className="decision-actions inline">
                            <button type="button" onClick={() => setDecision(change.id, "approved")}>
                              승인
                            </button>
                            <button type="button" onClick={() => setDecision(change.id, "held")}>
                              보류
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>

          <article className="table-panel" id="operation">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Operation</p>
                <h2>운영 자동화 추천</h2>
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
        </section>

        <section className="report-panel" id="report">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Report</p>
              <h2>광고주/내부 공유용 리포트</h2>
            </div>
            <button className="icon-button subtle" type="button" onClick={downloadReport}>
              <Download size={17} />
              Markdown
            </button>
          </div>
          <div className="report-grid">
            <div>
              <strong>{plan.input.brandName} 세팅 요약</strong>
              <p>
                {plan.input.vertical} 기준으로 {plan.forecast.adGroupCount}개 광고그룹과{" "}
                {plan.forecast.includedKeywords}개 포함 키워드를 생성했습니다.
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
              <p className="eyebrow">Benchmark Coverage</p>
              <h2>벤치마크 기능 구현 범위</h2>
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
      </section>
    </main>
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

function AccountSnapshotNotice({
  state,
  onApplyChannel
}: {
  state: AccountSnapshotState;
  onApplyChannel: (channelId: string) => void;
}) {
  if (state.status === "idle") {
    return null;
  }

  if (state.status === "loading") {
    return (
      <div className="stage-notice neutral">
        <strong>Naver 계정 스캔 중</strong>
        <span>비즈채널과 캠페인을 read-only로 조회합니다.</span>
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

  const siteChannels = (state.response.channels ?? []).filter((channel) => channel.id);

  return (
    <div className="account-snapshot">
      <div className="snapshot-summary">
        <span>비즈채널 {siteChannels.length}개</span>
        <span>캠페인 {state.response.campaigns?.length ?? 0}개</span>
      </div>
      <div className="channel-list">
        {siteChannels.length === 0 ? (
          <span>사용 가능한 비즈채널이 없습니다. Naver 검색광고에서 사이트 비즈채널을 먼저 등록해야 합니다.</span>
        ) : (
          siteChannels.map((channel) => (
            <div className="channel-item" key={channel.id}>
              <div>
                <strong>{channel.name}</strong>
                <span>
                  {channel.channelTp} / {channel.inspectStatus ?? "상태 미확인"}
                </span>
                <em>{channel.site ?? channel.mobileSite ?? "URL 미확인"}</em>
              </div>
              <button className="icon-button subtle" type="button" onClick={() => onApplyChannel(channel.id)}>
                적용
              </button>
            </div>
          ))
        )}
      </div>
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

function severityClass(severity: OptimizationSeverity): string {
  return severity === "high" ? "exclude" : severity === "medium" ? "review" : "include";
}

function severityLabel(severity: OptimizationSeverity): string {
  return severity === "high" ? "높음" : severity === "medium" ? "중간" : "낮음";
}

function decisionLabel(decision: ApprovalDecision): string {
  return decision === "approved" ? "승인됨" : decision === "held" ? "보류됨" : "승인 대기";
}

function decisionClass(decision: ApprovalDecision): string {
  return decision === "approved" ? "include" : decision === "held" ? "review" : "neutral";
}

type NextActionInput = {
  approvedCount: number;
  channelApplied: boolean;
  stageValidated: boolean;
  canRequestProtectedExecution: boolean;
  blockerCount: number;
  channelStatus?: string | null;
};

function getNextAction(input: NextActionInput) {
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
      title: "비즈채널을 스캔하고 적용하세요",
      description: "Naver 계정에서 사이트 비즈채널을 가져와 PC/모바일 채널 ID를 채워야 합니다.",
      status: "채널 필요",
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
