"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Mail, UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type AuthFormProps = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const isSignup = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setStatus("error");
      setMessage("Supabase 공개 인증 환경변수가 설정되지 않았습니다.");
      return;
    }

    const result = isSignup
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName.trim(),
              company_name: companyName.trim()
            }
          }
        })
      : await supabase.auth.signInWithPassword({
          email,
          password
        });

    if (result.error) {
      setStatus("error");
      setMessage(result.error.message);
      return;
    }

    if (isSignup && !result.data.session) {
      setStatus("success");
      setMessage("가입 확인 메일을 보냈습니다. 메일 인증 후 로그인해 주세요.");
      return;
    }

    setStatus("success");
    setMessage(isSignup ? "회원가입이 완료되었습니다." : "로그인되었습니다.");
    router.push("/workspace");
  }

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <Link className="auth-brand" href="/">
          <span>SA</span>
          Naver SA Autopilot
        </Link>
        <div className="auth-copy">
          <p className="eyebrow">Account Access</p>
          <h1>{isSignup ? "팀 계정을 만들고 승인 흐름을 시작하세요" : "회원 계정으로 워크스페이스에 접속하세요"}</h1>
          <p>
            운영자 코드는 더 이상 화면에 입력하지 않습니다. 로그인 세션으로 계정 스캔, 초안 검증, 이력 저장 권한을 확인합니다.
          </p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup ? (
            <>
              <label className="field">
                <span>이름</span>
                <input
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
                <small>마이페이지와 승인 이력에 표시됩니다.</small>
              </label>
              <label className="field">
                <span>회사명</span>
                <input
                  autoComplete="organization"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                />
              </label>
            </>
          ) : null}
          <label className="field">
            <span>이메일</span>
            <input
              autoComplete="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="field">
            <span>비밀번호</span>
            <input
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={8}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <small>8자 이상으로 설정해 주세요.</small>
          </label>
          {message ? <p className={`auth-message ${status}`}>{message}</p> : null}
          <button className="icon-button primary auth-submit" disabled={status === "loading"} type="submit">
            {isSignup ? <UserPlus size={18} /> : <Mail size={18} />}
            {status === "loading" ? "처리 중" : isSignup ? "회원가입" : "로그인"}
          </button>
        </form>
        <div className="auth-switch">
          {isSignup ? (
            <Link href="/login">
              이미 계정이 있습니다
              <ArrowRight size={15} />
            </Link>
          ) : (
            <Link href="/signup">
              새 계정을 만듭니다
              <ArrowRight size={15} />
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
