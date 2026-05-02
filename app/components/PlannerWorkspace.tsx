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
import { useMemo, useState } from "react";
import {
  createPlannerCsv,
  generatePlannerPlan,
  type BenchmarkFeature,
  type ChangeRisk,
  type KeywordStatus,
  type PlannerInput,
  type PlannerMode
} from "@/lib/planner";

type PlannerWorkspaceProps = {
  initialInput: PlannerInput;
};

const currencyFormatter = new Intl.NumberFormat("ko-KR");

export function PlannerWorkspace({ initialInput }: PlannerWorkspaceProps) {
  const [mode, setMode] = useState<PlannerMode>(initialInput.mode);
  const [brandName, setBrandName] = useState(initialInput.brandName);
  const [siteUrl, setSiteUrl] = useState(initialInput.siteUrl);
  const [vertical, setVertical] = useState(initialInput.vertical);
  const [monthlyBudget, setMonthlyBudget] = useState(initialInput.monthlyBudget);
  const [maxBid, setMaxBid] = useState(initialInput.maxBid);
  const [seedText, setSeedText] = useState(initialInput.seedKeywords.join("\n"));

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

  const plan = useMemo(() => generatePlannerPlan(input), [input]);

  const includedKeywords = plan.keywords.filter((keyword) => keyword.status === "include");
  const reviewKeywords = plan.keywords.filter((keyword) => keyword.status === "review");
  const excludedKeywords = plan.keywords.filter((keyword) => keyword.status === "exclude");

  function downloadCsv() {
    const blob = new Blob([createPlannerCsv(plan)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${plan.input.brandName.toLowerCase().replace(/\s+/g, "-")}-keyword-plan.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
            <button className="icon-button primary" type="button">
              <Rocket size={17} />
              실행 초안 준비
            </button>
          </div>
        </header>

        <section className="status-band" aria-label="프로젝트 상태">
          <div>
            <span className="status-dot green" />
            키워드 확장/그룹화 구현
          </div>
          <div>
            <span className="status-dot amber" />
            Naver 전송 전 승인 필수
          </div>
          <div>
            <span className="status-dot blue" />
            삭제 대신 pause/off 정책
          </div>
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
                  승인 대기 {plan.forecast.approvalItems}건
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
              <span className="pill">Live off</span>
            </div>
            <div className="change-list">
              {plan.stagedChanges.map((change) => (
                <div className="change-item" key={change.id}>
                  <div>
                    <span className={`risk-dot ${riskClass(change.risk)}`} />
                    <strong>{change.target}</strong>
                    <p>{change.details}</p>
                  </div>
                  <div className="change-meta">
                    <span>{change.type}</span>
                    <b>{change.approval}</b>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="table-panel" id="operation">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Operation</p>
                <h2>운영 자동화 추천</h2>
              </div>
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
