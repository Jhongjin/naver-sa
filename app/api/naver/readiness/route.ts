import { getNaverConfigState, listNaverCampaigns, type NaverConfigState } from "@/lib/naver-search-ad";
import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore } from "@/lib/http";

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
    return jsonNoStore(
      {
        ok: false,
        state,
        externalRequest: false,
        error: "Naver Search Ad API environment variables are incomplete."
      },
      { status: 400 }
    );
  }

  const result = await listNaverCampaigns(1);

  return jsonNoStore({
    ok: result.ok,
    state,
    authAccess: access.state,
    externalRequest: true,
    readOnlyCheck: result
  });
}

function toPublicReadiness(state: NaverConfigState) {
  return {
    ok: state.ready,
    ready: state.ready,
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
