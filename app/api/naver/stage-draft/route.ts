import { NextResponse } from "next/server";
import { createNaverExecutionDraft } from "@/lib/execution-draft";
import { getNaverConfigState } from "@/lib/naver-search-ad";
import { verifyUserAccess } from "@/lib/auth-access";
import { generatePlannerPlan } from "@/lib/planner";
import { coerceDecisions, coerceExecutionContext, coercePlannerInput, readJsonRecord } from "@/lib/planner-request";
import { summarizeApprovals } from "@/lib/reporting";

export async function POST(request: Request) {
  const access = await verifyUserAccess(request);

  if (!access.ok) {
    return NextResponse.json(access, { status: access.status });
  }

  const body = await readJsonRecord(request);
  const input = coercePlannerInput(body.input);
  const decisions = coerceDecisions(body.decisions);
  const executionContext = coerceExecutionContext(body.executionContext);
  const plan = generatePlannerPlan(input);
  const draft = createNaverExecutionDraft(plan, decisions, executionContext);
  const naverState = getNaverConfigState();
  const approvalSummary = summarizeApprovals(plan.stagedChanges, decisions);

  return NextResponse.json({
    ok: true,
    dryRun: true,
    externalRequest: false,
    automationLevel: "Level 2 Staged Changes",
    authAccess: access.state,
    naver: {
      ready: naverState.ready,
      missingCount: naverState.missing.length,
      customerIdPresent: naverState.customerIdPresent
    },
    approvalSummary,
    draft,
    nextAction: draft.validation.canExecuteTest
      ? "Protected test execution may be requested with a separate admin secret and confirmation phrase."
      : "Resolve validation blockers before requesting protected test execution."
  });
}
