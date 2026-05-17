import { generatePlannerPlan } from "@/lib/planner";
import { createNaverExecutionDraft } from "@/lib/execution-draft";
import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";
import {
  coerceDecisionNotes,
  coerceDecisions,
  coerceExecutionContext,
  coercePlannerInput,
  readJsonRecord,
} from "@/lib/planner-request";
import { savePlanningRun } from "@/lib/persistence/planning-runs";
import { getSupabaseAdminState } from "@/lib/supabase-admin";

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
  const access = await verifyUserAccess(request, { requireAdmin: true });

  if (!access.ok) {
    return jsonNoStore(access, { status: access.status });
  }

  const state = getSupabaseAdminState();

  if (!state.ready) {
    return jsonNoStore(
      {
        ok: false,
        error: "Supabase admin environment is not configured.",
        missingCount: state.missing.length,
        environmentVariableNamesExcluded: true
      },
      { status: 503 }
    );
  }

  const body = await readJsonRecord(request);
  const input = coercePlannerInput(body.input);
  const decisions = coerceDecisions(body.decisions);
  const decisionNotes = coerceDecisionNotes(body.decisionNotes);
  const executionContext = coerceExecutionContext(body.executionContext);
  const createdBy = access.user.email ?? access.user.id;
  const createdByUserId = access.user.id;
  const plan = generatePlannerPlan(input);
  const executionDraft = createNaverExecutionDraft(plan, decisions, executionContext);
  const result = await savePlanningRun({ plan, decisions, decisionNotes, executionDraft, createdBy, createdByUserId });

  return jsonNoStore(result, { status: result.ok ? 201 : 500 });
}
