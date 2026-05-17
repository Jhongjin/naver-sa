import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
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

type SnapshotEntityKind = "channels" | "campaigns" | "productGroups";

type SnapshotEntity = {
  id: string;
  label: string;
  signature: string;
};

export function POST() {
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
  return (
    current.user_id === candidate.user_id &&
    current.product_type === candidate.product_type &&
    normalizeComparableText(current.brand_name) === normalizeComparableText(candidate.brand_name) &&
    normalizeComparableText(current.site_url) === normalizeComparableText(candidate.site_url)
  );
}

function createSnapshotDiff(current: AccountSnapshotRow, previous: AccountSnapshotRow) {
  return {
    comparedSnapshotId: previous.id,
    comparedAt: previous.created_at,
    channels: diffEntities(entityMap(current.channels, "channels"), entityMap(previous.channels, "channels")),
    campaigns: diffEntities(entityMap(current.campaigns, "campaigns"), entityMap(previous.campaigns, "campaigns")),
    productGroups: diffEntities(
      entityMap(current.product_groups, "productGroups"),
      entityMap(previous.product_groups, "productGroups")
    )
  };
}

function entityMap(value: unknown[] | null, kind: SnapshotEntityKind): Map<string, SnapshotEntity> {
  const entities = new Map<string, SnapshotEntity>();

  for (const record of asRecordArray(value)) {
    const id = entityId(record, kind);

    if (!id) {
      continue;
    }

    const label = entityLabel(record, kind) ?? id;
    const signature = entitySignature(record, label, kind);
    entities.set(id, { id, label, signature });
  }

  return entities;
}

function diffEntities(current: Map<string, SnapshotEntity>, previous: Map<string, SnapshotEntity>) {
  const added = [...current.values()].filter((entity) => !previous.has(entity.id));
  const removed = [...previous.values()].filter((entity) => !current.has(entity.id));
  const changed = [...current.values()].filter((entity) => {
    const previousEntity = previous.get(entity.id);
    return previousEntity ? previousEntity.signature !== entity.signature : false;
  });

  return {
    added: added.length,
    removed: removed.length,
    changed: changed.length,
    addedLabels: added.slice(0, 3).map((entity) => entity.label),
    removedLabels: removed.slice(0, 3).map((entity) => entity.label),
    changedLabels: changed.slice(0, 3).map((entity) => entity.label)
  };
}

function asRecordArray(value: unknown[] | null): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function entityId(record: Record<string, unknown>, kind: SnapshotEntityKind): string | null {
  if (kind === "campaigns") {
    return scalarText(record.nccCampaignId) ?? scalarText(record.id);
  }

  return scalarText(record.id);
}

function entityLabel(record: Record<string, unknown>, kind: SnapshotEntityKind): string | null {
  if (kind === "productGroups") {
    return scalarText(record.name) ?? scalarText(record.mallName);
  }

  return scalarText(record.name);
}

function entitySignature(record: Record<string, unknown>, label: string, kind: SnapshotEntityKind): string {
  const fields =
    kind === "channels"
      ? [label, record.channelTp, record.site, record.mobileSite, record.inspectStatus]
      : kind === "campaigns"
        ? [label, record.userLock, record.deliveryMethod]
        : [label, record.businessChannelId, record.mallId, record.mallName, record.productCount, record.excludeCount];

  return fields.map((field) => scalarText(field) ?? "").join("|");
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

function normalizeComparableText(value: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function scalarText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim().slice(0, 180);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMissingSnapshotTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /naver_account_snapshots/i.test(error.message ?? "")
  );
}

function sanitizeSnapshotError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
    .replace(/apikey[=:]\s*[^,\s}]+/gi, "apikey=[REDACTED]")
    .slice(0, 220);
}
