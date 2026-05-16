import { NextResponse } from "next/server";
import { createNaverExecutionDraft } from "@/lib/execution-draft";
import { verifyUserAccess } from "@/lib/auth-access";
import { generatePlannerPlan } from "@/lib/planner";
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
  const access = await verifyUserAccess(request);

  if (!access.ok) {
    return NextResponse.json(access, { status: access.status });
  }

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

  const body = await readJsonRecord(request);
  const input = coercePlannerInput(body.input);
  const decisions = coerceDecisions(body.decisions);
  const decisionNotes = coerceDecisionNotes(body.decisionNotes);
  const executionContext = coerceExecutionContext(body.executionContext);
  const stagedDraftKey = stringValueOrUndefined(body.stagedDraftKey);
  const createdBy = access.user.email ?? access.user.id;
  const plan = generatePlannerPlan(input);
  const executionDraft = createNaverExecutionDraft(plan, decisions, executionContext);

  if (stagedDraftKey && stagedDraftKey !== executionDraft.draftKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Validated draft key does not match the current save request. Run draft validation again before saving."
      },
      { status: 409 }
    );
  }

  const result = await savePlanningRun({ plan, decisions, decisionNotes, executionDraft, createdBy });

  return NextResponse.json(
    {
      ...result,
      draft: {
        draftId: executionDraft.draftId,
        draftKey: executionDraft.draftKey,
        payloadCount: executionDraft.payloads.length,
        canExecuteTest: executionDraft.validation.canExecuteTest,
        blockerCount: executionDraft.validation.blockerCount
      }
    },
    { status: result.ok ? 201 : 500 }
  );
}
