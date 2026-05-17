import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import { getSupabaseAdminClient, getSupabaseAdminState, type SupabaseUrlState } from "@/lib/supabase-admin";

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
  "execution_results",
  "workspace_members"
];

const requiredColumns = [
  {
    table: "planning_runs",
    column: "product_type"
  },
  {
    table: "planning_runs",
    column: "created_by_user_id"
  },
  {
    table: "workspaces",
    column: "owner_user_id"
  },
  {
    table: "staged_changes",
    column: "decided_by"
  },
  {
    table: "staged_changes",
    column: "decision_note"
  },
  {
    table: "staged_changes",
    column: "decision_source"
  }
];

const optionalTables = [
  {
    name: "naver_account_snapshots",
    feature: "Naver account snapshot history"
  },
  {
    name: "naver_performance_sync_runs",
    feature: "Naver performance sync planning"
  },
  {
    name: "report_share_links",
    feature: "Limited public report share links"
  }
];

const optionalColumns = [
  {
    table: "planning_runs",
    column: "shopping_linkage",
    feature: "Shopping Search linkage summary"
  },
  {
    table: "execution_drafts",
    column: "execution_context",
    feature: "Execution draft context history"
  }
];

type TableReadiness = {
  name: string;
  present: boolean;
  rowCount: number | null;
  error: string | null;
  errorCode: string | null;
};

type OptionalTableReadiness = TableReadiness & {
  feature: string;
};

type ColumnReadiness = {
  table: string;
  column: string;
  present: boolean;
  error: string | null;
  errorCode: string | null;
};

type OptionalColumnReadiness = ColumnReadiness & {
  feature: string;
};

type SupabaseReadinessReport = {
  ok: boolean;
  state: ReturnType<typeof getSupabaseAdminState>;
  connectivity: Awaited<ReturnType<typeof checkSupabaseConnectivity>>;
  auth: Awaited<ReturnType<typeof checkAuthAdminReadiness>>;
  tables: TableReadiness[];
  optionalTables: OptionalTableReadiness[];
  columns: ColumnReadiness[];
  optionalColumns: OptionalColumnReadiness[];
  note?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wantsDetail = ["1", "true", "full"].includes(url.searchParams.get("detail")?.toLowerCase() ?? "");

  if (wantsDetail) {
    const access = await verifyUserAccess(request, { requireAdmin: true });

    if (!access.ok) {
      return jsonNoStore(
        {
          ok: false,
          error: access.error,
          code: access.code
        },
        { status: access.status }
      );
    }
  }

  const report = await collectSupabaseReadiness();

  if (wantsDetail) {
    return jsonNoStore(report);
  }

  return jsonNoStore(toPublicReadiness(report));
}

async function collectSupabaseReadiness(): Promise<SupabaseReadinessReport> {
  const state = getSupabaseAdminState();
  const connectivity = await checkSupabaseConnectivity(state.url);

  if (!state.ready) {
    return {
      ok: false,
      state,
      connectivity,
      auth: {
        checked: false,
        adminApiReachable: false,
        error: "Skipped because the Supabase admin environment is not configured.",
        userCountSample: null
      },
      tables: [],
      optionalTables: [],
      columns: [],
      optionalColumns: [],
      note: "Supabase admin environment is not configured."
    };
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      ok: false,
      state,
      connectivity,
      auth: {
        checked: false,
        adminApiReachable: false,
        error: "Skipped because the Supabase admin client is unavailable.",
        userCountSample: null
      },
      tables: [],
      optionalTables: [],
      columns: [],
      optionalColumns: [],
      note: "Supabase admin client is unavailable."
    };
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
  const optionalTableReports = connectivity.reachable
    ? await Promise.all(
        optionalTables.map(async (table) => {
          const { error, count } = await supabase.from(table.name).select("id", {
            count: "exact",
            head: true
          });

          return {
            feature: table.feature,
            name: table.name,
            present: !error,
            rowCount: error ? null : count,
            error: error ? sanitizeSupabaseError(error.message) : null,
            errorCode: error?.code ?? null
          };
        })
      )
    : optionalTables.map((table) => ({
        feature: table.feature,
        name: table.name,
        present: false,
        rowCount: null,
        error: "Skipped because the Supabase REST endpoint is not reachable.",
        errorCode: "CONNECTIVITY_UNREACHABLE"
      }));
  const optionalColumnReports = connectivity.reachable
    ? await Promise.all(
        optionalColumns.map(async (column) => ({
          ...(await checkColumnPresence(supabase, column)),
          feature: column.feature
        }))
      )
    : optionalColumns.map((column) => ({
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

  return {
    ok:
      connectivity.reachable &&
      auth.adminApiReachable &&
      tables.every((table) => table.present) &&
      columns.every((column) => column.present),
    state,
    connectivity,
    auth,
    tables,
    optionalTables: optionalTableReports,
    columns,
    optionalColumns: optionalColumnReports
  };
}

function toPublicReadiness(report: SupabaseReadinessReport) {
  const presentTableCount = report.tables.filter((table) => table.present).length;
  const presentColumnCount = report.columns.filter((column) => column.present).length;

  return {
    ok: report.ok,
    ready: report.ok,
    environment: {
      configured: report.state.ready,
      urlPresent: report.state.url.present,
      urlValid: report.state.url.valid
    },
    connectivity: {
      checked: report.connectivity.checked,
      reachable: report.connectivity.reachable,
      status: report.connectivity.status
    },
    auth: {
      checked: report.auth.checked,
      adminApiReachable: report.auth.adminApiReachable
    },
    schema: {
      requiredTableCount: requiredTables.length,
      presentTableCount,
      requiredColumnCount: requiredColumns.length,
      presentColumnCount
    },
    optionalFeatures: [
      ...report.optionalTables.map((table) => ({
        feature: table.feature,
        table: table.name,
        column: null,
        ready: table.present,
        rowCount: table.rowCount,
        note: table.present ? null : "Optional table is not installed yet."
      })),
      ...report.optionalColumns.map((column) => ({
        feature: column.feature,
        table: column.table,
        column: column.column,
        ready: column.present,
        rowCount: null,
        note: column.present ? null : "Optional column is not installed yet."
      }))
    ],
    detail: "Append ?detail=1 with an admin session to inspect table-level diagnostics.",
    note: report.note ?? null
  };
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
