import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { PlannerPlan } from "@/lib/planner";
import type { ApprovalDecisionMap } from "@/lib/reporting";

export type SavePlanningRunInput = {
  plan: PlannerPlan;
  decisions: ApprovalDecisionMap;
  createdBy?: string;
};

export type SavePlanningRunResult =
  | {
      ok: true;
      planningRunId: string;
    }
  | {
      ok: false;
      error: string;
    };

export async function savePlanningRun(input: SavePlanningRunInput): Promise<SavePlanningRunResult> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      ok: false,
      error: "Supabase admin environment is not configured."
    };
  }

  const { plan, decisions } = input;
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .insert({
      name: `${plan.input.brandName} Workspace`,
      mode: plan.input.mode
    })
    .select("id")
    .single();

  if (workspaceError || !workspace) {
    return {
      ok: false,
      error: sanitizeSupabaseError(workspaceError?.message)
    };
  }

  const { data: run, error: runError } = await supabase
    .from("planning_runs")
    .insert({
      workspace_id: workspace.id,
      brand_name: plan.input.brandName,
      site_url: plan.input.siteUrl,
      vertical: plan.input.vertical,
      monthly_budget: plan.input.monthlyBudget,
      max_bid: plan.input.maxBid,
      mode: plan.input.mode,
      seed_keywords: plan.input.seedKeywords,
      forecast: plan.forecast,
      assumptions: plan.assumptions,
      created_by: input.createdBy
    })
    .select("id")
    .single();

  if (runError || !run) {
    return {
      ok: false,
      error: sanitizeSupabaseError(runError?.message)
    };
  }

  const planningRunId = run.id as string;
  const keywordRows = plan.keywords.map((keyword) => ({
    planning_run_id: planningRunId,
    term: keyword.term,
    intent: keyword.intent,
    ad_group_name: keyword.group,
    match_type: keyword.matchType,
    bid: keyword.bid,
    expected_impressions: keyword.expectedImpressions,
    expected_clicks: keyword.expectedClicks,
    expected_cost: keyword.expectedCost,
    cvr: keyword.cvr,
    confidence: keyword.confidence,
    status: keyword.status,
    reason: keyword.reason
  }));
  const adGroupRows = plan.adGroups.map((group) => ({
    planning_run_id: planningRunId,
    name: group.name,
    description: group.description,
    monthly_budget: group.monthlyBudget,
    daily_budget: group.dailyBudget,
    keyword_count: group.keywordCount,
    expected_clicks: group.expectedClicks,
    avg_bid: group.avgBid,
    sample_ads: group.sampleAds
  }));
  const stagedChangeRows = plan.stagedChanges.map((change) => ({
    planning_run_id: planningRunId,
    external_key: change.id,
    entity_type: change.type,
    target: change.target,
    action: change.action,
    risk: change.risk,
    approval_required: change.approval === "승인 필요",
    details: change.details,
    decision: decisions[change.id] ?? "pending"
  }));

  const [keywordResult, adGroupResult, stagedChangeResult, auditResult] = await Promise.all([
    supabase.from("planning_keywords").insert(keywordRows),
    supabase.from("planning_ad_groups").insert(adGroupRows),
    supabase.from("staged_changes").insert(stagedChangeRows),
    supabase.from("audit_events").insert({
      workspace_id: workspace.id,
      planning_run_id: planningRunId,
      event_type: "planning_run.created",
      actor: input.createdBy,
      entity_type: "planning_run",
      entity_id: planningRunId,
      after_value: {
        forecast: plan.forecast,
        decisions
      },
      reason: "MVP planner dry-run saved."
    })
  ]);

  const error = keywordResult.error ?? adGroupResult.error ?? stagedChangeResult.error ?? auditResult.error;

  if (error) {
    return {
      ok: false,
      error: sanitizeSupabaseError(error.message)
    };
  }

  return {
    ok: true,
    planningRunId
  };
}

function sanitizeSupabaseError(message: string | undefined): string {
  return message?.slice(0, 300) || "Supabase persistence failed.";
}
