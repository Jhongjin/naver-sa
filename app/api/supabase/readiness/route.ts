import { NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseAdminState } from "@/lib/supabase-admin";

const requiredTables = [
  "workspaces",
  "ad_accounts",
  "planning_runs",
  "planning_keywords",
  "planning_ad_groups",
  "staged_changes",
  "audit_events"
];

export async function GET() {
  const state = getSupabaseAdminState();

  if (!state.ready) {
    return NextResponse.json({
      ok: false,
      state,
      tables: [],
      note: "Supabase admin environment is not configured."
    });
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({
      ok: false,
      state,
      tables: [],
      note: "Supabase admin client is unavailable."
    });
  }

  const tables = await Promise.all(
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
  );

  return NextResponse.json({
    ok: tables.every((table) => table.present),
    state,
    tables
  });
}

function sanitizeSupabaseError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
    .replace(/apikey[=:]\s*[^,\s}]+/gi, "apikey=[REDACTED]")
    .slice(0, 220);
}
