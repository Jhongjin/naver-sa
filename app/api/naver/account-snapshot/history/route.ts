import { verifyUserAccess } from "@/lib/auth-access";
import { redactSensitiveErrorText } from "@/lib/error-redaction";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import { createAccountSnapshotDiff, hasSameAccountSnapshotContext } from "@/lib/naver-account-snapshot-diff";
import { getSupabaseAdminClient, getSupabaseAdminState } from "@/lib/supabase-admin";

type AccountSnapshotRow = {
  id: string;
  user_id: string;
  actor_email: string | null;
  product_type: "powerlink" | "shoppingSearch" | null;
  brand_name: string | null;
  site_url: string | null;
  partial: boolean;
  channels: unknown[] | null;
  campaigns: unknown[] | null;
  product_groups: unknown[] | null;
  summary: Record<string, unknown> | null;
  errors: Record<string, unknown> | null;
  created_at: string;
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
  const access = await verifyUserAccess(request);

  if (!access.ok) {
    return jsonNoStore(access, { status: access.status });
  }

  const state = getSupabaseAdminState();

  if (!state.ready) {
    return jsonNoStore(
      {
        ok: false,
        error: "Supabase admin environment is not configured."
      },
      { status: 503 }
    );
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return jsonNoStore({ ok: false, error: "Supabase admin client is unavailable." }, { status: 503 });
  }

  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get("limit"));
  const productType = coerceProductType(url.searchParams.get("productType"));
  let query = supabase
    .from("naver_account_snapshots")
    .select(
      "id, user_id, actor_email, product_type, brand_name, site_url, partial, channels, campaigns, product_groups, summary, errors, created_at",
      {
        count: "exact"
      }
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (productType) {
    query = query.eq("product_type", productType);
  }

  if (access.state.role !== "admin") {
    query = query.eq("user_id", access.user.id);
  }

  const { data, error, count } = await query;

  if (error) {
    if (isMissingSnapshotTableError(error)) {
      return jsonNoStore({
        ok: true,
        installed: false,
        snapshots: [],
        rawInventoryExcluded: true,
        scopeEnforced: true,
        total: 0,
        limit,
        scope: access.state.role === "admin" ? "all" : "mine",
        warning: "Naver account snapshot history table is not installed yet."
      });
    }

    return jsonNoStore({ ok: false, error: sanitizeSnapshotError(error.message) }, { status: 502 });
  }

  const rows = (data ?? []) as AccountSnapshotRow[];

  return jsonNoStore({
    ok: true,
    installed: true,
    snapshots: rows.map((row, index) => toSnapshotHistoryItem(row, findComparisonRow(rows, index))),
    rawInventoryExcluded: true,
    scopeEnforced: true,
    total: count ?? data?.length ?? 0,
    limit,
    scope: access.state.role === "admin" ? "all" : "mine",
    warning: null
  });
}

function toSnapshotHistoryItem(row: AccountSnapshotRow, comparisonRow: AccountSnapshotRow | null) {
  const summary = row.summary ?? {};
  const errors = row.errors ?? {};

  return {
    id: row.id,
    userId: row.user_id,
    actorEmail: row.actor_email,
    productType: row.product_type,
    brandName: row.brand_name,
    siteUrl: row.site_url,
    partial: row.partial,
    counts: {
      channels: numberValue(summary.channels),
      campaigns: numberValue(summary.campaigns),
      productGroups: numberValue(summary.productGroups)
    },
    errorScopes: Object.entries(errors)
      .filter(([, message]) => Boolean(message))
      .map(([scope]) => scope),
    diff: comparisonRow ? createSnapshotDiff(row, comparisonRow) : null,
    createdAt: row.created_at
  };
}

function findComparisonRow(rows: AccountSnapshotRow[], currentIndex: number): AccountSnapshotRow | null {
  const current = rows[currentIndex];

  if (!current) {
    return null;
  }

  return rows.slice(currentIndex + 1).find((candidate) => hasSameSnapshotContext(current, candidate)) ?? null;
}

function hasSameSnapshotContext(current: AccountSnapshotRow, candidate: AccountSnapshotRow): boolean {
  return hasSameAccountSnapshotContext(toComparableContext(current), toComparableContext(candidate));
}

function createSnapshotDiff(current: AccountSnapshotRow, previous: AccountSnapshotRow) {
  return createAccountSnapshotDiff(toDiffSource(current), toDiffSource(previous));
}

function toComparableContext(row: AccountSnapshotRow) {
  return {
    userId: row.user_id,
    productType: row.product_type,
    brandName: row.brand_name,
    siteUrl: row.site_url
  };
}

function toDiffSource(row: AccountSnapshotRow) {
  return {
    id: row.id,
    createdAt: row.created_at,
    channels: row.channels,
    campaigns: row.campaigns,
    productGroups: row.product_groups
  };
}

function clampLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return 8;
  }

  return Math.min(Math.max(parsed, 1), 20);
}

function coerceProductType(value: string | null): "powerlink" | "shoppingSearch" | null {
  return value === "powerlink" || value === "shoppingSearch" ? value : null;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isMissingSnapshotTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /naver_account_snapshots/i.test(error.message ?? "")
  );
}

function sanitizeSnapshotError(message: string): string {
  return redactSensitiveErrorText(message, "Account snapshot history request failed.");
}
