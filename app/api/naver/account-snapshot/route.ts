import {
  getNaverConfigState,
  listNaverBusinessChannels,
  listNaverCampaigns,
  listNaverProductGroups,
  type NaverBusinessChannelSummary,
  type NaverProductGroupSummary
} from "@/lib/naver-search-ad";
import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import { createAccountSnapshotDiff, type AccountSnapshotDiff } from "@/lib/naver-account-snapshot-diff";
import { getSupabaseAdminClient, getSupabaseAdminState } from "@/lib/supabase-admin";

type PreviousSnapshotRow = {
  id: string;
  created_at: string;
  channels: unknown[] | null;
  campaigns: unknown[] | null;
  product_groups: unknown[] | null;
};

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
  const access = await verifyUserAccess(request, { requireAdmin: true });
  const url = new URL(request.url);

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
  const channels = channelsResult.ok ? channelsResult.data.map(normalizeChannel) : [];
  const campaigns = campaignsResult.ok ? campaignsResult.data : [];
  const productGroups = productGroupsResult.ok ? productGroupsResult.data.map(normalizeProductGroup) : [];
  const history = hasAnyData
    ? await saveAccountSnapshotHistory({
        userId: access.user.id,
        actorEmail: access.user.email ?? null,
        context: readSnapshotContext(url),
        partial: hasAnyData && !allOk,
        channels,
        campaigns,
        productGroups,
        errors
      })
    : null;

  return jsonNoStore(
    {
      ok: hasAnyData,
      partial: hasAnyData && !allOk,
      externalRequest: true,
      authAccess: access.state,
      channels,
      campaigns,
      productGroups,
      history,
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

async function saveAccountSnapshotHistory(input: {
  userId: string;
  actorEmail: string | null;
  context: ReturnType<typeof readSnapshotContext>;
  partial: boolean;
  channels: ReturnType<typeof normalizeChannel>[];
  campaigns: unknown[];
  productGroups: ReturnType<typeof normalizeProductGroup>[];
  errors: Record<string, string | null>;
}): Promise<
  | {
      saved: true;
      id: string;
      savedAt: string;
      counts: {
        channels: number;
        campaigns: number;
        productGroups: number;
      };
      diff: AccountSnapshotDiff | null;
      diffWarning?: string;
    }
  | {
      saved: false;
      warning: string;
    }
> {
  const state = getSupabaseAdminState();

  if (!state.ready) {
    return {
      saved: false,
      warning: "Supabase admin environment is not configured, so account snapshot history was not saved."
    };
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      saved: false,
      warning: "Supabase admin client is unavailable, so account snapshot history was not saved."
    };
  }

  const createdAt = new Date().toISOString();
  const previousSnapshotPromise = findPreviousAccountSnapshot({
    supabase,
    userId: input.userId,
    context: input.context
  });
  const { data, error } = await supabase
    .from("naver_account_snapshots")
    .insert({
      user_id: input.userId,
      actor_email: input.actorEmail,
      product_type: input.context.productType,
      brand_name: input.context.brandName,
      site_url: input.context.siteUrl,
      partial: input.partial,
      external_request: true,
      channels: input.channels,
      campaigns: input.campaigns,
      product_groups: input.productGroups,
      errors: input.errors,
      summary: {
        channels: input.channels.length,
        campaigns: input.campaigns.length,
        productGroups: input.productGroups.length
      },
      created_at: createdAt
    })
    .select("id,created_at")
    .single();

  if (error || !data) {
    return {
      saved: false,
      warning: isMissingSnapshotTableError(error)
        ? "Naver account snapshot history table is not installed yet, so the scan result was not saved."
        : `Naver account snapshot history was not saved: ${sanitizeSnapshotError(error?.message)}`
    };
  }

  const previousSnapshotResult = await previousSnapshotPromise;
  const savedAt = (data.created_at as string | null) ?? createdAt;
  const diff =
    previousSnapshotResult.snapshot
      ? createAccountSnapshotDiff(
          {
            id: data.id as string,
            createdAt: savedAt,
            channels: input.channels,
            campaigns: input.campaigns,
            productGroups: input.productGroups
          },
          {
            id: previousSnapshotResult.snapshot.id,
            createdAt: previousSnapshotResult.snapshot.created_at,
            channels: previousSnapshotResult.snapshot.channels,
            campaigns: previousSnapshotResult.snapshot.campaigns,
            productGroups: previousSnapshotResult.snapshot.product_groups
          }
        )
      : null;

  return {
    saved: true,
    id: data.id as string,
    savedAt,
    counts: {
      channels: input.channels.length,
      campaigns: input.campaigns.length,
      productGroups: input.productGroups.length
    },
    diff,
    ...(previousSnapshotResult.warning ? { diffWarning: previousSnapshotResult.warning } : {})
  };
}

async function findPreviousAccountSnapshot(input: {
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>;
  userId: string;
  context: ReturnType<typeof readSnapshotContext>;
}): Promise<{ snapshot: PreviousSnapshotRow | null; warning?: string }> {
  let query = input.supabase
    .from("naver_account_snapshots")
    .select("id, created_at, channels, campaigns, product_groups")
    .eq("user_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(1);

  query = input.context.productType ? query.eq("product_type", input.context.productType) : query.is("product_type", null);
  query = input.context.brandName ? query.eq("brand_name", input.context.brandName) : query.is("brand_name", null);
  query = input.context.siteUrl ? query.eq("site_url", input.context.siteUrl) : query.is("site_url", null);

  const { data, error } = await query;

  if (error) {
    return {
      snapshot: null,
      warning: `Previous account snapshot was not loaded: ${sanitizeSnapshotError(error.message)}`
    };
  }

  return {
    snapshot: ((data ?? []) as PreviousSnapshotRow[])[0] ?? null
  };
}

function readSnapshotContext(url: URL) {
  return {
    productType: coerceProductType(url.searchParams.get("productType")),
    brandName: stringParam(url.searchParams.get("brandName"), 140),
    siteUrl: stringParam(url.searchParams.get("siteUrl"), 240)
  };
}

function coerceProductType(value: string | null): "powerlink" | "shoppingSearch" | null {
  return value === "powerlink" || value === "shoppingSearch" ? value : null;
}

function stringParam(value: string | null, maxLength: number): string | null {
  return value?.trim() ? value.trim().slice(0, maxLength) : null;
}

function summarizeSnapshotErrors(errors: Record<string, string | null>): string {
  const failedScopes = Object.entries(errors)
    .filter(([, message]) => Boolean(message))
    .map(([scope]) => scope);

  return failedScopes.length > 0
    ? `Naver account snapshot failed for: ${failedScopes.join(", ")}.`
    : "Naver account snapshot failed.";
}

function isMissingSnapshotTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) {
    return false;
  }

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /naver_account_snapshots/i.test(error.message ?? "")
  );
}

function sanitizeSnapshotError(message: string | undefined): string {
  if (!message) {
    return "Unknown persistence error.";
  }

  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
    .replace(/apikey[=:]\s*[^,\s}]+/gi, "apikey=[REDACTED]")
    .slice(0, 220);
}
