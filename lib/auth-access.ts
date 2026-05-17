import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

let cachedAuthClient: SupabaseClient | null = null;

export type AppUserRole = "member" | "admin";

export type AuthCapabilities = {
  canReadAccountInventory: boolean;
  canSaveDraftHistory: boolean;
  canCreateTestEntities: boolean;
  canActivateLiveCampaigns: boolean;
  canDeleteProductionData: boolean;
  canManageUsers: boolean;
};

export type AuthAccessState = {
  mode: "supabase-auth";
  role: AppUserRole;
  userId: string;
  email: string | null;
  emailConfirmed: boolean;
  capabilities: AuthCapabilities;
  sessionTtlSeconds: number;
};

export type AuthAccessResult =
  | {
      ok: true;
      user: User;
      state: AuthAccessState;
    }
  | {
      ok: false;
      status: number;
      error: string;
      code: "AUTH_ENV_NOT_CONFIGURED" | "AUTH_TOKEN_REQUIRED" | "AUTH_TOKEN_INVALID" | "ADMIN_ROLE_REQUIRED";
    };

type AuthAccessOptions = {
  requireAdmin?: boolean;
};

export async function verifyUserAccess(
  request: Request,
  options: AuthAccessOptions = {}
): Promise<AuthAccessResult> {
  const client = getSupabaseAuthClient();

  if (!client) {
    return {
      ok: false,
      status: 503,
      error: "Supabase auth environment is not configured.",
      code: "AUTH_ENV_NOT_CONFIGURED"
    };
  }

  const token = getBearerToken(request);

  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Signed-in user session is required.",
      code: "AUTH_TOKEN_REQUIRED"
    };
  }

  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) {
    return {
      ok: false,
      status: 401,
      error: "User session is invalid or expired.",
      code: "AUTH_TOKEN_INVALID"
    };
  }

  const role = getUserRole(data.user);

  if (options.requireAdmin && role !== "admin") {
    return {
      ok: false,
      status: 403,
      error: "Admin role is required.",
      code: "ADMIN_ROLE_REQUIRED"
    };
  }

  return {
    ok: true,
    user: data.user,
    state: {
      mode: "supabase-auth",
      role,
      userId: data.user.id,
      email: data.user.email ?? null,
      emailConfirmed: Boolean(data.user.email_confirmed_at),
      capabilities: getAuthCapabilities(role),
      sessionTtlSeconds: getTokenTtlSeconds(token)
    }
  };
}

export function getAuthCapabilities(role: AppUserRole): AuthCapabilities {
  return {
    canReadAccountInventory: role === "admin",
    canSaveDraftHistory: true,
    canCreateTestEntities: false,
    canActivateLiveCampaigns: false,
    canDeleteProductionData: false,
    canManageUsers: role === "admin"
  };
}

export function getUserRole(user: User): AppUserRole {
  const metadataRole = typeof user.app_metadata?.role === "string" ? user.app_metadata.role : null;

  if (metadataRole === "admin") {
    return "admin";
  }

  const adminEmails = getConfiguredAdminEmails();
  const email = user.email?.toLowerCase();

  if (email && adminEmails.has(email)) {
    return "admin";
  }

  return "member";
}

export function getConfiguredAdminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getSupabaseAuthClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  if (!cachedAuthClient) {
    cachedAuthClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return cachedAuthClient;
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function getTokenTtlSeconds(token: string): number {
  const fallbackTtlSeconds = 60 * 60;
  const payloadPart = token.split(".")[1];

  if (!payloadPart) {
    return fallbackTtlSeconds;
  }

  try {
    const normalizedPayload = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(normalizedPayload, "base64").toString("utf8")) as { exp?: unknown };

    if (typeof payload.exp !== "number") {
      return fallbackTtlSeconds;
    }

    return Math.max(0, Math.floor(payload.exp - Date.now() / 1000));
  } catch {
    return fallbackTtlSeconds;
  }
}
