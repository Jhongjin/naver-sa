import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export type SupabaseAdminState =
  | {
      ready: true;
      missing: string[];
    }
  | {
      ready: false;
      missing: string[];
    };

export function getSupabaseAdminState(): SupabaseAdminState {
  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((name) => !process.env[name]);

  if (missing.length > 0) {
    return {
      ready: false,
      missing
    };
  }

  return {
    ready: true,
    missing: []
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
