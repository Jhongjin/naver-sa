import { NextResponse } from "next/server";
import { getUserRole, verifyUserAccess, type AppUserRole } from "@/lib/auth-access";
import { getSupabaseAdminClient, getSupabaseAdminState } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const access = await verifyUserAccess(request, { requireAdmin: true });

  if (!access.ok) {
    return NextResponse.json(access, { status: access.status });
  }

  const admin = getAdminClientOrResponse();

  if (admin instanceof NextResponse) {
    return admin;
  }

  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 100
  });

  if (error) {
    return NextResponse.json({ ok: false, error: sanitizeAdminError(error.message) }, { status: 502 });
  }

  const users = data.users.map((user) => ({
    id: user.id,
    email: user.email ?? null,
    role: getUserRole(user),
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
    displayName: stringMetadata(user.user_metadata?.display_name),
    companyName: stringMetadata(user.user_metadata?.company_name)
  }));

  return NextResponse.json({
    ok: true,
    users,
    total: users.length
  });
}

export async function PATCH(request: Request) {
  const access = await verifyUserAccess(request, { requireAdmin: true });

  if (!access.ok) {
    return NextResponse.json(access, { status: access.status });
  }

  const admin = getAdminClientOrResponse();

  if (admin instanceof NextResponse) {
    return admin;
  }

  const body = await readJson(request);
  const userId = typeof body.userId === "string" ? body.userId : "";
  const role = body.role === "admin" || body.role === "member" ? (body.role as AppUserRole) : null;

  if (!userId || !role) {
    return NextResponse.json({ ok: false, error: "userId and role are required." }, { status: 400 });
  }

  const { data: existing, error: getError } = await admin.auth.admin.getUserById(userId);

  if (getError || !existing.user) {
    return NextResponse.json({ ok: false, error: "User was not found." }, { status: 404 });
  }

  const nextMetadata = {
    ...existing.user.app_metadata,
    role
  };
  const { error } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: nextMetadata
  });

  if (error) {
    return NextResponse.json({ ok: false, error: sanitizeAdminError(error.message) }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    userId,
    role
  });
}

function getAdminClientOrResponse() {
  const state = getSupabaseAdminState();

  if (!state.ready) {
    return NextResponse.json(
      {
        ok: false,
        error: "Supabase admin environment is not configured.",
        missing: state.missing
      },
      { status: 503 }
    );
  }

  const admin = getSupabaseAdminClient();

  if (!admin) {
    return NextResponse.json({ ok: false, error: "Supabase admin client is unavailable." }, { status: 503 });
  }

  return admin;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = (await request.json()) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function stringMetadata(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sanitizeAdminError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
    .replace(/apikey[=:]\s*[^,\s}]+/gi, "apikey=[REDACTED]")
    .slice(0, 220);
}
