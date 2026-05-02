import { NextResponse } from "next/server";
import { getNaverConfigState, listNaverCampaigns } from "@/lib/naver-search-ad";

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
    externalRequest: true,
    readOnlyCheck: result
  });
}
