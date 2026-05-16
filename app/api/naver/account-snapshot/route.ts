import {
  getNaverConfigState,
  listNaverBusinessChannels,
  listNaverCampaigns,
  listNaverProductGroups,
  type NaverBusinessChannelSummary,
  type NaverProductGroupSummary
} from "@/lib/naver-search-ad";
import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore } from "@/lib/http";

export async function GET(request: Request) {
  const access = await verifyUserAccess(request);

  if (!access.ok) {
    return jsonNoStore(access, { status: access.status });
  }

  const naverState = getNaverConfigState();

  if (!naverState.ready) {
    return jsonNoStore(
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

  const allOk = channelsResult.ok && campaignsResult.ok && productGroupsResult.ok;
  const hasAnyData = channelsResult.ok || campaignsResult.ok || productGroupsResult.ok;
  const errors = {
    channels: channelsResult.ok ? null : channelsResult.error,
    campaigns: campaignsResult.ok ? null : campaignsResult.error,
    productGroups: productGroupsResult.ok ? null : productGroupsResult.error
  };

  return jsonNoStore(
    {
      ok: hasAnyData,
      partial: hasAnyData && !allOk,
      externalRequest: true,
      authAccess: access.state,
      channels: channelsResult.ok ? channelsResult.data.map(normalizeChannel) : [],
      campaigns: campaignsResult.ok ? campaignsResult.data : [],
      productGroups: productGroupsResult.ok ? productGroupsResult.data.map(normalizeProductGroup) : [],
      errors,
      error: hasAnyData ? null : summarizeSnapshotErrors(errors)
    },
    { status: hasAnyData ? 200 : 502 }
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

function summarizeSnapshotErrors(errors: Record<string, string | null>): string {
  const failedScopes = Object.entries(errors)
    .filter(([, message]) => Boolean(message))
    .map(([scope]) => scope);

  return failedScopes.length > 0
    ? `Naver account snapshot failed for: ${failedScopes.join(", ")}.`
    : "Naver account snapshot failed.";
}
