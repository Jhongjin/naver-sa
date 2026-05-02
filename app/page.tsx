import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  PauseCircle,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  WandSparkles
} from "lucide-react";
import {
  adGroups,
  forecastCards,
  keywordCandidates,
  mardSeedKeywords,
  setupSteps
} from "@/lib/sample-data";

const currencyFormatter = new Intl.NumberFormat("ko-KR");

export default function Home() {
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
          <a className="nav-link active" href="#setup">
            <WandSparkles size={18} />
            캠페인 세팅
          </a>
          <a className="nav-link" href="#keywords">
            <Search size={18} />
            키워드 엔진
          </a>
          <a className="nav-link" href="#forecast">
            <FileText size={18} />
            예측 리포트
          </a>
          <a className="nav-link" href="#policy">
            <ShieldCheck size={18} />
            운영 정책
          </a>
        </nav>

        <div className="sidebar-note">
          <p className="note-title">MVP 안전모드</p>
          <p>라이브 집행 금지, 삭제 금지, 승인 후 생성/수정만 허용합니다.</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">쇼핑몰 파워링크 샘플</p>
            <h1>Mard 광고 세팅 초안</h1>
          </div>
          <div className="topbar-actions">
            <a className="icon-button subtle" href="https://mard.at/" target="_blank" rel="noreferrer">
              <ExternalLink size={17} />
              사이트 보기
            </a>
            <button className="icon-button primary" type="button">
              <Rocket size={17} />
              초안 생성
            </button>
          </div>
        </header>

        <section className="status-band" aria-label="프로젝트 상태">
          <div>
            <span className="status-dot green" />
            Git, Supabase, Vercel 연결 완료
          </div>
          <div>
            <span className="status-dot amber" />
            Naver API 테스트 생성 허용, 라이브 금지
          </div>
          <div>
            <span className="status-dot blue" />
            UI 한국어, 코드/문서 영어
          </div>
        </section>

        <section className="summary-grid" id="setup">
          <article className="setup-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Input</p>
                <h2>입력된 사업자/사이트 정보</h2>
              </div>
              <span className="pill">샘플 계정</span>
            </div>

            <dl className="info-list">
              <div>
                <dt>브랜드</dt>
                <dd>마드(Mard)</dd>
              </div>
              <div>
                <dt>사이트</dt>
                <dd>https://mard.at/</dd>
              </div>
              <div>
                <dt>업종</dt>
                <dd>여성 의류 쇼핑몰</dd>
              </div>
              <div>
                <dt>광고 상품</dt>
                <dd>파워링크 / 사이트검색광고</dd>
              </div>
              <div>
                <dt>예산 모드</dt>
                <dd>테스트, 라이브 집행 금지</dd>
              </div>
            </dl>

            <div className="seed-box">
              <div className="section-heading compact">
                <h3>초기 seed keyword</h3>
                <span>{mardSeedKeywords.length}개</span>
              </div>
              <div className="keyword-chips">
                {mardSeedKeywords.map((keyword) => (
                  <span key={keyword}>{keyword}</span>
                ))}
              </div>
            </div>
          </article>

          <article className="workflow-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Workflow</p>
                <h2>세팅 자동화 진행 흐름</h2>
              </div>
              <Sparkles size={20} />
            </div>

            <ol className="timeline">
              {setupSteps.map((step) => (
                <li key={step.title}>
                  <span className={`timeline-state ${step.state}`} />
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </article>
        </section>

        <section className="forecast-band" id="forecast" aria-label="예상 효과">
          {forecastCards.map((card) => (
            <article className="metric-card" key={card.label}>
              <p>{card.label}</p>
              <strong>{card.value}</strong>
              <span>{card.caption}</span>
            </article>
          ))}
        </section>

        <section className="work-grid">
          <article className="table-panel" id="keywords">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Keyword Engine</p>
                <h2>추천 키워드와 광고그룹</h2>
              </div>
              <button className="icon-button subtle" type="button">
                <Download size={17} />
                CSV
              </button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>키워드</th>
                    <th>의도</th>
                    <th>광고그룹</th>
                    <th>추천 입찰가</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {keywordCandidates.map((keyword) => (
                    <tr key={keyword.term}>
                      <td>
                        <strong>{keyword.term}</strong>
                        <span>{keyword.reason}</span>
                      </td>
                      <td>{keyword.intent}</td>
                      <td>{keyword.group}</td>
                      <td>{currencyFormatter.format(keyword.bid)}원</td>
                      <td>
                        <span className={`status-pill ${keyword.statusTone}`}>{keyword.status}</span>
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
                {adGroups.map((group) => (
                  <div className="adgroup-item" key={group.name}>
                    <div>
                      <strong>{group.name}</strong>
                      <span>{group.description}</span>
                    </div>
                    <p>{group.keywordCount}개</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="policy-panel" id="policy">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Guardrails</p>
                  <h2>운영 제한</h2>
                </div>
                <ShieldCheck size={20} />
              </div>
              <ul className="policy-list">
                <li>
                  <PauseCircle size={18} />
                  삭제 대신 pause/off 처리
                </li>
                <li>
                  <AlertTriangle size={18} />
                  라이브 캠페인 활성화 금지
                </li>
                <li>
                  <CheckCircle2 size={18} />
                  생성/수정은 승인 후 실행
                </li>
              </ul>
            </article>
          </aside>
        </section>
      </section>
    </main>
  );
}

