import { NextResponse } from "next/server";
import {
  getNaverConfigState,
  listNaverBusinessChannels,
  listNaverCampaigns,
  type NaverBusinessChannelSummary
} from "@/lib/naver-search-ad";
import { verifyOperatorAccess } from "@/lib/operator-access";

export async function GET(request: Request) {
  const access = verifyOperatorAccess(request, { requireConfigured: true });

  if (!access.ok) {
    return NextResponse.json(access, { status: access.status });
  }

  const naverState = getNaverConfigState();

  if (!naverState.ready) {
    return NextResponse.json(
      {
        ok: false,
        naver: naverState,
        error: "Naver Search Ad API environment variables are incomplete."
      },
      { status: 503 }
    );
  }

  const [channelsResult, campaignsResult] = await Promise.all([
    listNaverBusinessChannels(),
    listNaverCampaigns(20)
  ]);

  return NextResponse.json(
    {
      ok: channelsResult.ok && campaignsResult.ok,
      externalRequest: true,
      operatorAccess: access.state,
      channels: channelsResult.ok ? channelsResult.data.map(normalizeChannel) : [],
      campaigns: campaignsResult.ok ? campaignsResult.data : [],
      errors: {
        channels: channelsResult.ok ? null : channelsResult.error,
        campaigns: campaignsResult.ok ? null : campaignsResult.error
      }
    },
    { status: channelsResult.ok && campaignsResult.ok ? 200 : 502 }
  );
}

function normalizeChannel(channel: NaverBusinessChannelSummary) {
  return {
    id: channel.nccBusinessChannelId ?? "",
    name: channel.name ?? "이름 없음",
    channelTp: channel.channelTp ?? "UNKNOWN",
    site: channel.businessInfo?.site ?? null,
    mobileSite: channel.businessInfo?.mobileSite ?? null,
    inspectStatus: channel.inspectStatus ?? null
  };
}
