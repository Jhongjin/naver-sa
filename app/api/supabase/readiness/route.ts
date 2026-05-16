import { NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAdminState, type SupabaseUrlState } from "@/lib/supabase-admin";

const requiredTables = [
  "workspaces",
  "ad_accounts",
  "planning_runs",
  "planning_keywords",
  "planning_ad_groups",
  "staged_changes",
  "audit_events",
  "execution_drafts",
  "execution_payloads",
  "execution_results"
];

const requiredColumns = [
  {
    table: "planning_runs",
    column: "product_type"
  }
];

export async function GET() {
  const state = getSupabaseAdminState();
  const connectivity = await checkSupabaseConnectivity(state.url);

  if (!state.ready) {
    return NextResponse.json({
      ok: false,
      state,
      connectivity,
      auth: {
        checked: false,
        adminApiReachable: false,
        error: "Skipped because the Supabase admin environment is not configured."
      },
      tables: [],
      columns: [],
      note: "Supabase admin environment is not configured."
    });
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({
      ok: false,
      state,
      connectivity,
      auth: {
        checked: false,
        adminApiReachable: false,
        error: "Skipped because the Supabase admin client is unavailable."
      },
      tables: [],
      columns: [],
      note: "Supabase admin client is unavailable."
    });
  }

  const tables = connectivity.reachable
    ? await Promise.all(
        requiredTables.map(async (table) => {
          const { error, count } = await supabase.from(table).select("id", {
            count: "exact",
            head: true
          });

          return {
            name: table,
            present: !error,
            rowCount: error ? null : count,
            error: error ? sanitizeSupabaseError(error.message) : null,
            errorCode: error?.code ?? null
          };
        })
      )
    : requiredTables.map((table) => ({
        name: table,
        present: false,
        rowCount: null,
        error: "Skipped because the Supabase REST endpoint is not reachable.",
        errorCode: "CONNECTIVITY_UNREACHABLE"
      }));

  const columns = connectivity.reachable
    ? await Promise.all(requiredColumns.map((column) => checkColumnPresence(supabase, column)))
    : requiredColumns.map((column) => ({
        ...column,
        present: false,
        error: "Skipped because the Supabase REST endpoint is not reachable.",
        errorCode: "CONNECTIVITY_UNREACHABLE"
      }));
  const auth = connectivity.reachable
    ? await checkAuthAdminReadiness(supabase)
    : {
        checked: false,
        adminApiReachable: false,
        error: "Skipped because the Supabase REST endpoint is not reachable.",
        userCountSample: null
      };

  return NextResponse.json({
    ok:
      connectivity.reachable &&
      auth.adminApiReachable &&
      tables.every((table) => table.present) &&
      columns.every((column) => column.present),
    state,
    connectivity,
    auth,
    tables,
    columns
  });
}

async function checkAuthAdminReadiness(supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>) {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1
  });

  return {
    checked: true,
    adminApiReachable: !error,
    error: error ? sanitizeSupabaseError(error.message) : null,
    userCountSample: error ? null : data.users.length
  };
}

async function checkColumnPresence(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  input: { table: string; column: string }
) {
  const { error } = await supabase.from(input.table).select(`id,${input.column}`, {
    head: true
  });

  return {
    ...input,
    present: !error,
    error: error ? sanitizeSupabaseError(error.message) : null,
    errorCode: error?.code ?? null
  };
}

async function checkSupabaseConnectivity(url: SupabaseUrlState) {
  if (!url.valid || !url.protocol || !url.host) {
    return {
      checked: false,
      reachable: false,
      endpoint: null,
      status: null,
      statusText: null,
      error: "Supabase URL is not valid.",
      note: null
    };
  }

  const endpoint = `${url.protocol}//${url.host}/rest/v1/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json"
      },
      cache: "no-store",
      signal: controller.signal
    });

    return {
      checked: true,
      reachable: true,
      endpoint,
      status: response.status,
      statusText: response.statusText,
      error: null,
      note:
        response.status === 401
          ? "Reachable; unauthenticated REST calls are expected to be rejected."
          : null
    };
  } catch (error) {
    return {
      checked: true,
      reachable: false,
      endpoint,
      status: null,
      statusText: null,
      error: sanitizeSupabaseError(getErrorMessage(error)),
      note: null
    };
  } finally {
    clearTimeout(timeout);
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? `; cause=${error.cause.name}: ${error.cause.message}` : "";

    return `${error.name}: ${error.message}${cause}`;
  }

  return String(error);
}

function sanitizeSupabaseError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
    .replace(/apikey[=:]\s*[^,\s}]+/gi, "apikey=[REDACTED]")
    .slice(0, 220);
}
