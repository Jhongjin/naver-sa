import Link from "next/link";
import {
  ArrowRight,
  DatabaseZap,
  Fingerprint,
  Gauge,
  LayoutDashboard,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  Workflow,
  Users
} from "lucide-react";
import { DigitalHeroCanvas } from "@/app/components/DigitalHeroCanvas";

const flowSteps = [
  {
    label: "01",
    eyebrow: "Auth gate",
    title: "회원가입과 권한",
    body: "운영자 코드를 걷어내고 Supabase Auth 세션과 관리자 권한으로 워크스페이스 접근을 보호합니다."
  },
  {
    label: "02",
    eyebrow: "Approval queue",
    title: "승인 큐 정리",
    body: "키워드와 광고그룹 후보를 승인/보류로 분리하고, 승인된 항목만 다음 단계로 넘깁니다."
  },
  {
    label: "03",
    eyebrow: "Account scan",
    title: "채널 연결",
    body: "비즈채널, 캠페인, 쇼핑검색 상품그룹을 읽어 초안에 필요한 연결 정보를 적용합니다."
  },
  {
    label: "04",
    eyebrow: "Payload draft",
    title: "초안 검증",
    body: "승인된 변경만 payload로 만들고 live off, delete off, 테스트 전송 차단 규칙을 검증합니다."
  },
  {
    label: "05",
    eyebrow: "History",
    title: "이력 저장",
    body: "planning run, staged changes, execution draft와 payload history를 한 번에 남깁니다."
  }
];

const pagePlans = [
  {
    icon: LockKeyhole,
    title: "회원가입/로그인",
    label: "Auth",
    body: "이메일 기반 계정 생성과 로그인, 만료된 세션의 재인증 안내를 제품 흐름 안에 둡니다.",
    size: "medium"
  },
  {
    icon: Workflow,
    title: "워크스페이스",
    label: "Rail",
    body: "승인, 스캔, 검증, 저장을 한 줄의 실행 레일로 묶어 다음 액션을 명확하게 만듭니다.",
    size: "wide"
  },
  {
    icon: Users,
    title: "회원관리",
    label: "Admin",
    body: "관리자만 사용자 목록, 가입일, 마지막 로그인, 권한 전환을 확인하고 조정합니다.",
    size: "tall"
  },
  {
    icon: LayoutDashboard,
    title: "마이페이지",
    label: "Account",
    body: "내 계정, 현재 역할, 세션 상태, 최근 planning run으로 돌아가는 개인 홈입니다.",
    size: "medium"
  }
];

const heroSignals = [
  ["Live", "blocked"],
  ["Delete", "blocked"],
  ["Approved", "only"],
  ["History", "required"]
];

const safetySignals = [
  {
    icon: ShieldCheck,
    title: "승인 기반",
    body: "승인된 변경만 Naver 전송 초안으로 변환합니다."
  },
  {
    icon: Fingerprint,
    title: "세션 기반",
    body: "보호 API는 로그인 토큰과 서버 검증을 통과해야 합니다."
  },
  {
    icon: DatabaseZap,
    title: "이력 중심",
    body: "planning run과 execution draft를 같은 흐름에서 저장합니다."
  }
];

export function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link className="landing-brand" href="/">
          <span>SA</span>
          Naver SA Autopilot
        </Link>
        <nav aria-label="제품 메뉴">
          <Link href="#flow">운영 레일</Link>
          <Link href="#pages">화면 구성</Link>
          <Link href="/mypage">마이페이지</Link>
        </nav>
        <div className="landing-nav-actions">
          <Link className="icon-button subtle" href="/login">
            로그인
          </Link>
          <Link className="icon-button primary" href="/signup">
            시작하기
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <DigitalHeroCanvas />
        <div className="hero-noise" aria-hidden="true" />
        <div className="landing-hero-shell">
          <div className="landing-hero-content">
            <p className="eyebrow">SA autopilot / membership control</p>
            <h1>
              <span>Naver SA</span>
              <span>운영을 하나의</span>
              <span>승인 레일로.</span>
            </h1>
            <p>
              키워드 선정, 승인 큐, 비즈채널 연결, payload 검증, 이력 저장을 흩어진 버튼이 아니라 하나의 실행 흐름으로
              정리합니다.
            </p>
            <div className="landing-hero-actions">
              <Link className="icon-button primary" href="/signup">
                회원가입
                <ArrowRight size={17} />
              </Link>
              <Link className="icon-button subtle" href="/workspace">
                워크스페이스 보기
              </Link>
            </div>
            <div className="hero-signal-row" aria-label="운영 원칙">
              {heroSignals.map(([label, value]) => (
                <span key={label}>
                  <b>{label}</b>
                  {value}
                </span>
              ))}
            </div>
          </div>

          <aside className="hero-art-board" aria-label="전송 초안 운영 상태 미리보기">
            <div className="art-toolbar">
              <span>Draft console</span>
              <span>dry-run only</span>
            </div>
            <div className="art-window primary-window">
              <div>
                <p>Payload radar</p>
                <strong>22</strong>
                <span>approved operations</span>
              </div>
              <div className="hero-orbit" aria-hidden="true">
                <span className="orbit-ring outer" />
                <span className="orbit-ring middle" />
                <span className="orbit-ring inner" />
                <span className="orbit-node one" />
                <span className="orbit-node two" />
                <span className="orbit-node three" />
              </div>
            </div>
            <div className="art-window payload-window">
              <span>POST /campaigns</span>
              <span>PUT /adgroups/test</span>
              <span>POST /keywords</span>
              <span>history.store()</span>
            </div>
            <div className="art-window scan-window">
              <ScanLine size={18} />
              <div>
                <strong>Channel matched</strong>
                <span>business channel + product group</span>
              </div>
            </div>
            <div className="hero-status-stack" aria-hidden="true">
              <span>approval</span>
              <span>scan</span>
              <span>validate</span>
              <span>save</span>
            </div>
          </aside>
        </div>
        <div className="hero-marquee" aria-hidden="true">
          <span>Approval first</span>
          <span>Payload draft</span>
          <span>History required</span>
          <span>Live blocked</span>
          <span>Delete blocked</span>
        </div>
      </section>

      <section className="landing-section landing-flow" id="flow">
        <div className="landing-section-heading">
          <div>
            <p className="eyebrow">New operating rail</p>
            <h2>흩어진 버튼을 하나의 실행 순서로 바꿉니다</h2>
          </div>
          <p className="section-note">
            승인 후 무엇을 눌러야 하는지 헤매지 않도록, 오른쪽 패널과 워크스페이스의 핵심 액션을 같은 순서로 재배치합니다.
          </p>
        </div>
        <div className="flow-lanes">
          {flowSteps.map((step) => (
            <article key={step.label}>
              <span>{step.label}</span>
              <em>{step.eyebrow}</em>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section page-plan-section" id="pages">
        <div className="landing-section-heading">
          <div>
            <p className="eyebrow">Membership product map</p>
            <h2>회원 기반 제품 화면을 운영 단위로 나눕니다</h2>
          </div>
          <p className="section-note">
            홈페이지는 제품의 첫인상, 워크스페이스는 실행, 마이페이지는 개인 상태, 회원관리는 권한 운영을 맡습니다.
          </p>
        </div>
        <div className="page-plan-grid">
          {pagePlans.map((item) => {
            const Icon = item.icon;

            return (
              <article data-size={item.size} key={item.title}>
                <div>
                  <Icon size={22} />
                  <span>{item.label}</span>
                </div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-section guardrail-band">
        <div className="guardrail-copy">
          <p className="eyebrow">MVP safety mode</p>
          <h2>디자인은 더 선명하게, 집행 정책은 그대로 보수적으로.</h2>
        </div>
        {safetySignals.map((item) => {
          const Icon = item.icon;

          return (
            <div key={item.title}>
              <Icon size={22} />
              <strong>{item.title}</strong>
              <span>{item.body}</span>
            </div>
          );
        })}
        <div className="guardrail-meter" aria-label="MVP 보호 정책">
          <Gauge size={20} />
          <strong>Mutation lock</strong>
          <span>live off / delete off</span>
          <i />
        </div>
      </section>
    </main>
  );
}
