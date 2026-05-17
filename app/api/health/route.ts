import { jsonNoStore, methodNotAllowed } from "@/lib/http";

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

const recommendedVariables = ["ADMIN_EMAILS"];

export function POST() {
  return methodNotAllowed(["GET"]);
}

export function PUT() {
  return methodNotAllowed(["GET"]);
}

export function PATCH() {
  return methodNotAllowed(["GET"]);
}

export function DELETE() {
  return methodNotAllowed(["GET"]);
}

export function GET() {
  const variables = requiredVariables.map((name) => ({
    name,
    present: Boolean(process.env[name])
  }));
  const recommended = recommendedVariables.map((name) => ({
    name,
    present: Boolean(process.env[name]),
    purpose: "Optional first-admin bootstrap fallback. Supabase app_metadata.role=admin is also supported."
  }));
  const warnings = recommended
    .filter((variable) => !variable.present)
    .map(
      (variable) =>
        `${variable.name} is optional after an app_metadata admin exists; configure it only if no admin can access member management.`
    );

  return jsonNoStore({
    ok: variables.every((variable) => variable.present),
    variables,
    recommended,
    warnings,
    adminBootstrap: {
      appMetadataRoleSupported: true,
      adminEmailsConfigured: Boolean(process.env.ADMIN_EMAILS)
    }
  });
}
