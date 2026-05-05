import { NextResponse } from "next/server";
import {
  getNaverConfigState,
  listNaverBusinessChannels,
  listNaverCampaigns,
  listNaverProductGroups,
  type NaverBusinessChannelSummary,
  type NaverProductGroupSummary
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

  const [channelsResult, campaignsResult, productGroupsResult] = await Promise.all([
    listNaverBusinessChannels(),
    listNaverCampaigns(20),
    listNaverProductGroups()
  ]);

  const ok = channelsResult.ok && campaignsResult.ok;

  return NextResponse.json(
    {
      ok,
      externalRequest: true,
      operatorAccess: access.state,
      channels: channelsResult.ok ? channelsResult.data.map(normalizeChannel) : [],
      campaigns: campaignsResult.ok ? campaignsResult.data : [],
      productGroups: productGroupsResult.ok ? productGroupsResult.data.map(normalizeProductGroup) : [],
      errors: {
        channels: channelsResult.ok ? null : channelsResult.error,
        campaigns: campaignsResult.ok ? null : campaignsResult.error,
        productGroups: productGroupsResult.ok ? null : productGroupsResult.error
      }
    },
    { status: ok ? 200 : 502 }
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

function normalizeProductGroup(productGroup: NaverProductGroupSummary) {
  return {
    id: productGroup.nccProductGroupId ?? "",
    businessChannelId: productGroup.nccBusinessChannelId ?? "",
    name: productGroup.name ?? "상품그룹 이름 없음",
    registrationMethod: productGroup.registrationMethod ?? null,
    registeredProductType: productGroup.registeredProductType ?? null,
    mallId: productGroup.mallId ?? null,
    mallName: productGroup.mallName ?? null,
    brandName: productGroup.brandName ?? null,
    numberOfAdgroups: productGroup.numberOfAdgroups ?? 0,
    productCount: productGroup.attrJson?.productNvmids?.length ?? null,
    excludeCount: productGroup.attrJson?.excludeNvmids?.length ?? null
  };
}
