import { generatePlannerPlan } from "@/lib/planner";
import { createNaverExecutionDraft } from "@/lib/execution-draft";
import { jsonNoStore } from "@/lib/http";
import {
  coerceDecisionNotes,
  coerceDecisions,
  coerceExecutionContext,
  coercePlannerInput,
  readJsonRecord,
  stringValueOrUndefined
} from "@/lib/planner-request";
import { savePlanningRun } from "@/lib/persistence/planning-runs";
import { getSupabaseAdminState } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const authResult = verifyAdminSecret(request);

  if (!authResult.ok) {
    return jsonNoStore(authResult, { status: authResult.status });
  }

  const state = getSupabaseAdminState();

  if (!state.ready) {
    return jsonNoStore(
      {
        ok: false,
        error: "Supabase admin environment is not configured.",
        missing: state.missing
      },
      { status: 503 }
    );
  }

  const body = await readJsonRecord(request);
  const input = coercePlannerInput(body.input);
  const decisions = coerceDecisions(body.decisions);
  const decisionNotes = coerceDecisionNotes(body.decisionNotes);
  const executionContext = coerceExecutionContext(body.executionContext);
  const createdBy = typeof body.createdBy === "string" ? body.createdBy : undefined;
  const createdByUserId = stringValueOrUndefined(body.createdByUserId);
  const plan = generatePlannerPlan(input);
  const executionDraft = createNaverExecutionDraft(plan, decisions, executionContext);
  const result = await savePlanningRun({ plan, decisions, decisionNotes, executionDraft, createdBy, createdByUserId });

  return jsonNoStore(result, { status: result.ok ? 201 : 500 });
}

function verifyAdminSecret(request: Request): { ok: true } | { ok: false; status: number; error: string } {
  const configuredSecret = process.env.CRON_SECRET;

  if (!configuredSecret) {
    return {
      ok: false,
      status: 503,
      error: "Persistence route is disabled because CRON_SECRET is not configured."
    };
  }

  const providedSecret = request.headers.get("x-admin-secret");

  if (providedSecret !== configuredSecret) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized."
    };
  }

  return {
    ok: true
  };
}
