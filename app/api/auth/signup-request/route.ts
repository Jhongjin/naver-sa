import { redactSensitiveErrorText } from "@/lib/error-redaction";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import { getSupabaseAdminClient, getSupabaseAdminState } from "@/lib/supabase-admin";

type SignupRequestBody = {
  email?: unknown;
  password?: unknown;
  displayName?: unknown;
  companyName?: unknown;
};

export function GET() {
  return methodNotAllowed(["POST"]);
}

export function PUT() {
  return methodNotAllowed(["POST"]);
}

export function PATCH() {
  return methodNotAllowed(["POST"]);
}

export function DELETE() {
  return methodNotAllowed(["POST"]);
}

export async function POST(request: Request) {
  const state = getSupabaseAdminState();

  if (!state.ready) {
    return jsonNoStore({ ok: false, error: "Signup approval request is not configured." }, { status: 503 });
  }

  const admin = getSupabaseAdminClient();

  if (!admin) {
    return jsonNoStore({ ok: false, error: "Signup approval request is unavailable." }, { status: 503 });
  }

  const body = await readSignupRequest(request);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  const displayName = stringBodyValue(body.displayName);
  const companyName = stringBodyValue(body.companyName);

  if (!email) {
    return jsonNoStore({ ok: false, error: "A valid email is required." }, { status: 400 });
  }

  if (password.length < 8) {
    return jsonNoStore({ ok: false, error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: {
      ...(displayName ? { display_name: displayName } : {}),
      ...(companyName ? { company_name: companyName } : {})
    },
    app_metadata: {
      role: "member",
      approval_status: "pending"
    }
  });

  if (error) {
    if (isDuplicateSignupError(error.message)) {
      return jsonNoStore({
        ok: true,
        email,
        approvalStatus: "pending_admin_approval",
        duplicateRequestHandled: true
      });
    }

    return jsonNoStore({ ok: false, error: sanitizeSignupError(error.message) }, { status: 502 });
  }

  const auditWarning = data.user
    ? await writeSignupAuditEvent(admin, {
        actor: email,
        entityId: data.user.id,
        email,
        displayName,
        companyName
      })
    : null;

  return jsonNoStore({
    ok: true,
    email,
    approvalStatus: "pending_admin_approval",
    warnings: auditWarning ? [auditWarning] : []
  });
}

async function readSignupRequest(request: Request): Promise<SignupRequestBody> {
  try {
    const parsed = (await request.json()) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as SignupRequestBody) : {};
  } catch {
    return {};
  }
}

async function writeSignupAuditEvent(
  admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  input: {
    actor: string;
    entityId: string;
    email: string;
    displayName: string | null;
    companyName: string | null;
  }
): Promise<string | null> {
  const { error } = await admin.from("audit_events").insert({
    event_type: "admin.user.approval_requested",
    actor: input.actor,
    entity_type: "auth_user",
    entity_id: input.entityId,
    before_value: null,
    after_value: {
      email: input.email,
      displayName: input.displayName,
      companyName: input.companyName,
      adminApproved: false
    },
    reason: "A user requested administrator approval for workspace access."
  });

  return error ? `Signup audit event was not saved: ${sanitizeSignupError(error.message)}` : null;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function stringBodyValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 120) : null;
}

function isDuplicateSignupError(message: string | undefined): boolean {
  const lower = message?.toLowerCase() ?? "";
  return lower.includes("already") || lower.includes("registered") || lower.includes("exists");
}

function sanitizeSignupError(message: string | undefined): string {
  return redactSensitiveErrorText(message, "Signup approval request failed.");
}
