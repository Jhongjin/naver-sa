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
  const { data, error, count } = await supabase
    .from("audit_events")
    .select("id, event_type, actor, entity_type, entity_id, after_value, reason, created_at", { count: "exact" })
    .like("event_type", "admin.%")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return jsonNoStore({ ok: false, error: sanitizeAuditError(error.message) }, { status: 502 });
  }

  return jsonNoStore({
    ok: true,
    events: ((data ?? []) as AuditEventRow[]).map(toAuditEventItem),
    total: count ?? data?.length ?? 0,
    limit
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

  return eventType;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 160) : null;
}

function clampLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return 8;
  }

  return Math.min(Math.max(parsed, 1), 20);
}

function sanitizeAuditError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
    .replace(/apikey[=:]\s*[^,\s}]+/gi, "apikey=[REDACTED]")
    .slice(0, 220);
}
