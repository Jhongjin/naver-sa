import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export type SupabaseAdminState =
  | {
      ready: true;
      missing: string[];
      url: SupabaseUrlState;
    }
  | {
      ready: false;
      missing: string[];
      url: SupabaseUrlState;
    };

export type SupabaseUrlState = {
  present: boolean;
  valid: boolean;
  protocol: string | null;
  host: string | null;
};

export function getSupabaseAdminState(): SupabaseAdminState {
  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((name) => !process.env[name]);
  const url = parseSupabaseUrlState(process.env.NEXT_PUBLIC_SUPABASE_URL);

  if (missing.length > 0) {
    return {
      ready: false,
      missing,
      url
    };
  }

  return {
    ready: true,
    missing: [],
    url
  };
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  const state = getSupabaseAdminState();

  if (!state.ready) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );
  }

  return cachedClient;
}

function parseSupabaseUrlState(value: string | undefined): SupabaseUrlState {
  if (!value) {
    return {
      present: false,
      valid: false,
      protocol: null,
      host: null
    };
  }

  try {
    const url = new URL(value);

    return {
      present: true,
      valid: url.protocol === "https:" && url.hostname.endsWith(".supabase.co"),
      protocol: url.protocol,
      host: url.hostname
    };
  } catch {
    return {
      present: true,
      valid: false,
      protocol: null,
      host: null
    };
  }
}
