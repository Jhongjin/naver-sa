import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import { getSupabaseAdminClient, getSupabaseAdminState } from "@/lib/supabase-admin";

type AuditEventRow = {
  id: string;
  event_type: string;
  actor: string | null;
  entity_type: string | null;
  entity_id: string | null;
  after_value: Record<string, unknown> | null;
  reason: string | null;
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
  const access = await verifyUserAccess(request, { requireAdmin: true });

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
  const filter = coerceAuditFilter(url.searchParams);
  let query = supabase
    .from("audit_events")
    .select("id, event_type, actor, entity_type, entity_id, after_value, reason, created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filter.eventType) {
    query = query.eq("event_type", filter.eventType);
  } else if (filter.group === "ops") {
    query = query.like("event_type", "ops.%");
  } else if (filter.group === "admin") {
    query = query.like("event_type", "admin.%");
  } else {
    query = query.or("event_type.like.admin.%,event_type.like.ops.%");
  }

  const { data, error, count } = await query.limit(limit);

  if (error) {
    return jsonNoStore({ ok: false, error: sanitizeAuditError(error.message) }, { status: 502 });
  }

  return jsonNoStore({
    ok: true,
    events: ((data ?? []) as AuditEventRow[]).map(toAuditEventItem),
    total: count ?? data?.length ?? 0,
    limit,
    filter
  });
}

function toAuditEventItem(row: AuditEventRow) {
  return {
    id: row.id,
    eventType: row.event_type,
    actor: row.actor,
    entityType: row.entity_type,
    entityId: row.entity_id,
    reason: row.reason,
    createdAt: row.created_at,
    summary: summarizeAuditEvent(row.event_type, row.after_value)
  };
}

function summarizeAuditEvent(eventType: string, value: Record<string, unknown> | null): string {
  const email = stringValue(value?.email);

  if (eventType === "admin.user.invited") {
    return email ? `${email} invited` : "User invite requested";
  }

  if (eventType === "admin.user.email_confirmed") {
    return email ? `${email} email confirmed` : "User email confirmed";
  }

  if (eventType === "admin.user.role_changed") {
    const role = stringValue(value?.role);
    return [email, role ? `role ${role}` : null].filter(Boolean).join(" / ") || "User role changed";
  }

  if (eventType.startsWith("ops.")) {
    if (eventType === "ops.report_share.created" || eventType === "ops.report_share.revoked") {
      const status = stringValue(value?.status);
      const planningRunId = stringValue(value?.planningRunId);
      return [
        eventType === "ops.report_share.created" ? "report share created" : "report share revoked",
        status ? `status ${status}` : null,
        planningRunId ? `run ${planningRunId.slice(0, 8)}` : null
      ]
        .filter(Boolean)
        .join(" / ");
    }

    if (eventType === "ops.performance_sync.cron_checked") {
      const processed = scalarValue(value?.processed);
      const remaining = scalarValue(value?.remainingAfter);

      return [`cron checked ${processed ?? "0"} plan(s)`, remaining ? `remaining ${remaining}` : null]
        .filter(Boolean)
        .join(" / ");
    }

    const error = stringValue(value?.error);
    const warning = Array.isArray(value?.warnings) ? stringValue(value.warnings[0]) : null;
    const status = scalarValue(value?.status);
    return [error ?? warning ?? "Operational alert", status ? `status ${status}` : null].filter(Boolean).join(" / ");
  }

  return eventType;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 160) : null;
}

function scalarValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim().slice(0, 80);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function clampLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return 8;
  }

  return Math.min(Math.max(parsed, 1), 20);
}

function coerceAuditFilter(searchParams: URLSearchParams): {
  group: "all" | "admin" | "ops";
  eventType: string | null;
} {
  const eventType = searchParams.get("eventType");

  if (eventType && /^(admin|ops)\.[a-z0-9_.]+$/i.test(eventType)) {
    return {
      group: eventType.startsWith("ops.") ? "ops" : "admin",
      eventType
    };
  }

  const group = searchParams.get("group");

  if (group === "ops" || group === "admin") {
    return {
      group,
      eventType: null
    };
  }

  return {
    group: "all",
    eventType: null
  };
}

function sanitizeAuditError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
    .replace(/apikey[=:]\s*[^,\s}]+/gi, "apikey=[REDACTED]")
    .slice(0, 220);
}
