"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, DatabaseZap, LockKeyhole, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { FormEvent, useState } from "react";
import { redactSensitiveErrorText } from "@/lib/error-redaction";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type AuthFormProps = {
  mode: "login" | "signup";
};

function visibleAuthFormError(message: string | null | undefined, fallback: string) {
  const lower = message?.toLowerCase() ?? "";

  if (lower.includes("email not confirmed") || lower.includes("not confirmed")) {
    return "관리자 승인 대기 중입니다. 승인 후 로그인할 수 있습니다.";
  }

  return redactSensitiveErrorText(message, fallback);
}

const authSteps = [
  {
    label: "01",
    title: "가입 요청",
    body: "계정을 만든 뒤 관리자 승인 대기 상태로 등록합니다."
  },
  {
    label: "02",
    title: "관리자 승인",
    body: "승인된 계정만 워크스페이스와 보호 API를 사용할 수 있습니다."
  },
  {
    label: "03",
    title: "승인 레일",
    body: "승인된 초안만 검증하고 저장합니다."
  }
];

const accessCards = [
  {
    icon: ShieldCheck,
    title: "Live blocked",
    body: "실제 집행은 계속 차단됩니다."
  },
  {
    icon: LockKeyhole,
    title: "Admin approved",
    body: "승인 전 계정은 로그인해도 보호 API가 차단됩니다."
  },
  {
    icon: DatabaseZap,
    title: "History required",
    body: "승인/초안 이력 저장을 기본 흐름으로 둡니다."
  }
];

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

    if (isSignup) {
      const response = await fetch("/api/auth/signup-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password,
          displayName,
          companyName
        })
      });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      if (!response.ok || data.ok !== true) {
        setStatus("error");
        setMessage(redactSensitiveErrorText(data.error, "가입 요청을 접수하지 못했습니다."));
        return;
      }

      await supabase.auth.signOut();
      setStatus("success");
      setMessage("가입 요청을 접수했습니다. 관리자가 승인하면 로그인할 수 있습니다.");
      return;
    }

    const result = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (result.error) {
      setStatus("error");
      setMessage(visibleAuthFormError(result.error.message, "인증 요청에 실패했습니다."));
      return;
    }

    const token = result.data.session?.access_token;

    if (!token) {
      setStatus("error");
      setMessage("로그인 세션을 확인하지 못했습니다.");
      return;
    }

    const approval = await fetch("/api/auth/session", {
      cache: "no-store",
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    const approvalData = (await approval.json().catch(() => ({}))) as { ok?: boolean; code?: string; error?: string };

    if (!approval.ok || approvalData.ok !== true) {
      await supabase.auth.signOut();
      setStatus("error");
      setMessage(
        approvalData.code === "ADMIN_APPROVAL_REQUIRED"
          ? "관리자 승인 대기 중입니다. 승인 후 로그인할 수 있습니다."
          : redactSensitiveErrorText(approvalData.error, "로그인 권한을 확인하지 못했습니다.")
      );
      return;
    }

    setStatus("success");
    setMessage("로그인되었습니다.");
    router.push("/workspace");
  }

  return (
    <main className={`auth-page ${isSignup ? "signup-view" : "login-view"}`}>
      <section className="auth-shell">
        <aside className="auth-side-panel">
          <Link className="auth-brand" href="/">
            <span>SA</span>
            Naver SA Autopilot
          </Link>
          <div className="auth-copy">
            <p className="eyebrow">Account Access</p>
            <h1>{isSignup ? "가입 요청을 보내고 관리자 승인을 기다리세요" : "승인된 계정으로 워크스페이스에 접속하세요"}</h1>
            <p>로그인 세션, 관리자 승인 상태, 권한으로 계정 스캔과 이력 저장 접근을 나눕니다.</p>
          </div>
          <div className="auth-flow-list" aria-label="계정 접근 흐름">
            {authSteps.map((step) => (
              <article key={step.label}>
                <span>{step.label}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              </article>
            ))}
          </div>
        </aside>

        <div className="auth-form-panel">
          <div className="auth-form-heading">
            <span>{isSignup ? "Create workspace account" : "Workspace sign in"}</span>
            <h2>{isSignup ? "계정 정보" : "로그인 정보"}</h2>
          </div>
          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup ? (
              <div className="auth-field-grid">
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
              </div>
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
              {status === "loading" ? "처리 중" : isSignup ? "가입 요청" : "로그인"}
            </button>
          </form>
          <div className="auth-access-grid" aria-label="접근 원칙">
            {accessCards.map((item) => {
              const Icon = item.icon;

              return (
                <article key={item.title}>
                  <Icon size={16} />
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </article>
              );
            })}
          </div>
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
        </div>
      </section>
    </main>
  );
}
