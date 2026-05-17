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
  const requiredPresentCount = variables.filter((variable) => variable.present).length;
  const recommendedPresentCount = recommended.filter((variable) => variable.present).length;
  const requiredTotalCount = requiredVariables.length;
  const recommendedTotalCount = recommendedVariables.length;
  const warnings = recommended
    .filter((variable) => !variable.present)
    .map(
      () =>
        "Optional first-admin bootstrap fallback is not configured; this is acceptable after an app_metadata admin exists."
    );

  return jsonNoStore({
    ok: requiredPresentCount === requiredTotalCount,
    secretNamesExcluded: true,
    environmentVariableNamesExcluded: true,
    environment: {
      requiredPresentCount,
      requiredTotalCount,
      recommendedPresentCount,
      recommendedTotalCount
    },
    warnings,
    adminBootstrap: {
      appMetadataRoleSupported: true,
      adminEmailsConfigured: Boolean(process.env.ADMIN_EMAILS)
    }
  });
}
