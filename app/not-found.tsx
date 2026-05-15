import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <section>
        <p className="eyebrow">404</p>
        <h1>요청한 워크스페이스를 찾을 수 없습니다</h1>
        <p>
          현재 MVP는 자동 세팅 워크벤치를 중심으로 운영됩니다. 잘못된 경로라면 메인 화면으로 돌아가 세팅 상태를
          다시 확인하세요.
        </p>
        <Link className="icon-button primary" href="/">
          워크벤치로 이동
        </Link>
      </section>
    </main>
  );
}
