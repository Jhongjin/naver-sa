export type AccountSnapshotDiffMetric = {
  added: number;
  removed: number;
  changed: number;
  addedLabels: string[];
  removedLabels: string[];
  changedLabels: string[];
};

export type AccountSnapshotDiff = {
  comparedSnapshotId: string;
  comparedAt: string;
  channels: AccountSnapshotDiffMetric;
  campaigns: AccountSnapshotDiffMetric;
  productGroups: AccountSnapshotDiffMetric;
};

export type AccountSnapshotDiffSource = {
  id: string;
  createdAt: string;
  channels: unknown[] | null;
  campaigns: unknown[] | null;
  productGroups: unknown[] | null;
};

export type AccountSnapshotComparableContext = {
  userId: string;
  productType: "powerlink" | "shoppingSearch" | null;
  brandName: string | null;
  siteUrl: string | null;
};

type SnapshotEntityKind = "channels" | "campaigns" | "productGroups";

type SnapshotEntity = {
  id: string;
  label: string;
  signature: string;
};

export function createAccountSnapshotDiff(
  current: AccountSnapshotDiffSource,
  previous: AccountSnapshotDiffSource
): AccountSnapshotDiff {
  return {
    comparedSnapshotId: previous.id,
    comparedAt: previous.createdAt,
    channels: diffEntities(entityMap(current.channels, "channels"), entityMap(previous.channels, "channels")),
    campaigns: diffEntities(entityMap(current.campaigns, "campaigns"), entityMap(previous.campaigns, "campaigns")),
    productGroups: diffEntities(
      entityMap(current.productGroups, "productGroups"),
      entityMap(previous.productGroups, "productGroups")
    )
  };
}

export function hasSameAccountSnapshotContext(
  current: AccountSnapshotComparableContext,
  candidate: AccountSnapshotComparableContext
): boolean {
  return (
    current.userId === candidate.userId &&
    current.productType === candidate.productType &&
    normalizeComparableText(current.brandName) === normalizeComparableText(candidate.brandName) &&
    normalizeComparableText(current.siteUrl) === normalizeComparableText(candidate.siteUrl)
  );
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
