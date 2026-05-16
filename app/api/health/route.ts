import { NextResponse } from "next/server";

const requiredVariables = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NAVER_SEARCH_AD_API_KEY",
  "NAVER_SEARCH_AD_SECRET_KEY",
  "NAVER_SEARCH_AD_CUSTOMER_ID",
  "NAVER_SEARCH_AD_BASE_URL",
  "OPENAI_API_KEY",
  "CRON_SECRET",
  "ENCRYPTION_KEY"
];

const optionalVariables = ["ADMIN_EMAILS"];

export function GET() {
  const variables = requiredVariables.map((name) => ({
    name,
    present: Boolean(process.env[name])
  }));
  const optional = optionalVariables.map((name) => ({
    name,
    present: Boolean(process.env[name])
  }));

  return NextResponse.json({
    ok: variables.every((variable) => variable.present),
    variables,
    optional
  });
}
