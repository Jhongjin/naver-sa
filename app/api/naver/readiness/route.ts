import { getNaverConfigState, listNaverCampaigns, type NaverConfigState } from "@/lib/naver-search-ad";
import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";

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

export async function GET(request: Request) {
  const state = getNaverConfigState();
  const url = new URL(request.url);
  const shouldCheckCampaigns = url.searchParams.get("check") === "campaigns";

  if (!shouldCheckCampaigns) {
    return jsonNoStore(toPublicReadiness(state));
  }

  const access = await verifyUserAccess(request, { requireAdmin: true });

  if (!access.ok) {
    return jsonNoStore(access, { status: access.status });
  }

  if (!state.ready) {
    const readiness = toPublicReadiness(state);

    return jsonNoStore(
      {
        ...readiness,
        ok: false,
        externalRequest: false,
        error: "Naver Search Ad API environment variables are incomplete."
      },
      { status: 400 }
    );
  }

  const result = await listNaverCampaigns(1);
  const readiness = toPublicReadiness(state);

  return jsonNoStore({
    ok: result.ok,
    ready: state.ready,
    configuration: readiness.configuration,
    environmentVariableNamesExcluded: true,
    baseUrlExcluded: true,
    authAccess: access.state,
    externalRequest: true,
    readOnlyEndpointCount: readiness.readOnlyEndpointCount,
    writeExecution: readiness.writeExecution,
    deleteExecution: readiness.deleteExecution,
    readOnlyCheck: result
  });
}

function toPublicReadiness(state: NaverConfigState) {
  return {
    ok: state.ready,
    ready: state.ready,
    environmentVariableNamesExcluded: true,
    baseUrlExcluded: true,
    configuration: {
      ready: state.ready,
      missingCount: state.missing.length,
      customerIdPresent: state.customerIdPresent
    },
    externalRequest: false,
    readOnlyEndpointCount: 4,
    writeExecution: "blocked in MVP",
    deleteExecution: "blocked in MVP",
    detail: "Use ?check=campaigns with an admin session for a live read-only connectivity check."
  };
}
