import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  FileClock,
  Fingerprint,
  LayoutDashboard,
  LockKeyhole,
  Radar,
  Users
} from "lucide-react";
import { DigitalHeroCanvas } from "@/app/components/DigitalHeroCanvas";

const flowSteps = [
  {
    label: "01",
    title: "회원가입",
    body: "운영자 코드를 없애고 Supabase Auth 세션으로 워크스페이스 접근과 API 호출을 보호합니다."
  },
  {
    label: "02",
    title: "승인 레일",
    body: "승인, 계정 스캔, 초안 검증, 이력 저장을 한 줄의 순서로 정리해 작업 흐름을 분명하게 만듭니다."
  },
  {
    label: "03",
    title: "Naver 초안",
    body: "승인된 변경만 payload 초안으로 만들고, live off와 delete off 정책을 계속 유지합니다."
  }
];

const pagePlans = [
  {
    icon: LockKeyhole,
    title: "회원가입/로그인",
    body: "이메일과 비밀번호로 계정을 만들고, 세션 만료나 권한 오류는 화면 안에서 바로 안내합니다."
  },
  {
    icon: LayoutDashboard,
    title: "마이페이지",
    body: "계정, 회사명, 세션 상태, 최근 planning run을 확인하는 개인 운영 홈으로 확장합니다."
  },
  {
    icon: Users,
    title: "회원관리",
    body: "관리자에게만 사용자 목록, 가입일, 마지막 로그인, 권한 전환을 보여주는 운영자 콘솔입니다."
  },
  {
    icon: Radar,
    title: "워크스페이스",
    body: "현재 자동 세팅 화면은 단계형 실행 레일 중심으로 재구성해 다음 액션을 한 곳에서 처리합니다."
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
          <Link href="/workspace">워크스페이스</Link>
          <Link href="/mypage">마이페이지</Link>
          <Link href="/admin/users">회원관리</Link>
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
        <div className="hero-overlay-grid" aria-hidden="true" />
        <div className="landing-hero-content">
          <p className="eyebrow">Membership based SA Autopilot</p>
          <h1>Naver SA Autopilot</h1>
          <p>
            파워링크와 쇼핑검색 세팅을 회원 계정 기반 워크스페이스로 묶고, 승인부터 저장까지 한 줄의 운영 레일로 정리합니다.
          </p>
          <div className="landing-hero-actions">
            <Link className="icon-button primary" href="/signup">
              회원가입
              <ArrowRight size={17} />
            </Link>
            <Link className="icon-button subtle" href="/workspace">
              작업 화면 보기
            </Link>
          </div>
          <div className="hero-signal-row" aria-label="운영 원칙">
            <span>Live off</span>
            <span>Delete off</span>
            <span>Approval first</span>
            <span>History saved</span>
          </div>
        </div>
      </section>

      <section className="landing-section landing-flow">
        <div className="landing-section-heading">
          <p className="eyebrow">New Information Architecture</p>
          <h2>흩어진 버튼을 하나의 실행 순서로 바꿉니다</h2>
        </div>
        <div className="flow-lanes">
          {flowSteps.map((step) => (
            <article key={step.label}>
              <span>{step.label}</span>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section page-plan-section">
        <div className="landing-section-heading">
          <p className="eyebrow">Page Plan</p>
          <h2>회원 기반 제품 화면 구성</h2>
        </div>
        <div className="page-plan-grid">
          {pagePlans.map((item) => {
            const Icon = item.icon;

            return (
              <article key={item.title}>
                <Icon size={22} />
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-section guardrail-band">
        <div>
          <BadgeCheck size={22} />
          <strong>승인 기반</strong>
          <span>승인된 작업만 초안으로 변환합니다.</span>
        </div>
        <div>
          <Fingerprint size={22} />
          <strong>세션 기반</strong>
          <span>API 요청은 로그인 토큰으로 보호합니다.</span>
        </div>
        <div>
          <FileClock size={22} />
          <strong>이력 중심</strong>
          <span>planning run과 draft history를 남깁니다.</span>
        </div>
      </section>
    </main>
  );
}
