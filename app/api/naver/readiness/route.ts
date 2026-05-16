import { NextResponse } from "next/server";
import { getNaverConfigState, listNaverCampaigns } from "@/lib/naver-search-ad";
import { verifyUserAccess } from "@/lib/auth-access";

export async function GET(request: Request) {
  const state = getNaverConfigState();
  const url = new URL(request.url);
  const shouldCheckCampaigns = url.searchParams.get("check") === "campaigns";

  if (!shouldCheckCampaigns) {
    return NextResponse.json({
      ok: state.ready,
      state,
      externalRequest: false,
      readOnlyEndpoints: ["/ncc/campaigns", "/ncc/adgroups", "/ncc/keywords", "/stats"],
      writeExecution: "blocked in MVP"
    });
  }

  const access = await verifyUserAccess(request, { requireAdmin: true });

  if (!access.ok) {
    return NextResponse.json(access, { status: access.status });
  }

  if (!state.ready) {
    return NextResponse.json(
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

  return NextResponse.json({
    ok: result.ok,
    state,
    authAccess: access.state,
    externalRequest: true,
    readOnlyCheck: result
  });
}
