import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { PlannerPlan } from "@/lib/planner";
import type { ApprovalDecisionMap, ApprovalDecisionNoteMap } from "@/lib/reporting";
import type { NaverExecutionDraft } from "@/lib/execution-draft";

export type SavePlanningRunInput = {
  plan: PlannerPlan;
  decisions: ApprovalDecisionMap;
  decisionNotes?: ApprovalDecisionNoteMap;
  executionDraft?: NaverExecutionDraft;
  createdBy?: string;
};

export type SavePlanningRunResult =
  | {
      ok: true;
      planningRunId: string;
      executionDraftId?: string;
      warnings: string[];
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
  const decisionNotes = input.decisionNotes ?? {};
  const warnings: string[] = [];
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
      product_type: plan.input.productType,
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
  const supportsDecisionMetadata = await getStagedChangeDecisionMetadataSupport(supabase);
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
  const decisionSavedAt = new Date().toISOString();
  const stagedChangeRows = plan.stagedChanges.map((change) => {
    const decision = decisions[change.id] ?? "pending";

    const row = {
      planning_run_id: planningRunId,
      external_key: change.id,
      entity_type: change.type,
      target: change.target,
      action: change.action,
      risk: change.risk,
      approval_required: change.approval === "승인 필요",
      details: change.details,
      decision,
      decided_at: decision === "pending" ? null : decisionSavedAt
    };

    if (!supportsDecisionMetadata) {
      return row;
    }

    return {
      ...row,
      decided_by: decision === "pending" ? null : input.createdBy ?? null,
      decision_note: decision === "pending" ? null : decisionNotes[change.id] ?? null,
      decision_source: "workspace"
    };
  });
  const decisionAuditRows = plan.stagedChanges.flatMap((change) => {
    const decision = decisions[change.id] ?? "pending";

    if (decision === "pending") {
      return [];
    }

    return [
      {
        workspace_id: workspace.id,
        planning_run_id: planningRunId,
        event_type: `staged_change.${decision}`,
        actor: input.createdBy,
        entity_type: "staged_change",
        entity_id: change.id,
        before_value: {
          decision: "pending"
        },
        after_value: {
          decision,
          externalKey: change.id,
          entityType: change.type,
          target: change.target,
          action: change.action,
          risk: change.risk,
          approvalRequired: change.approval === "승인 필요",
          note: decisionNotes[change.id] ?? null
        },
        reason: "Operator approval decision was saved."
      }
    ];
  });

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
        decisions,
        decisionNotes
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

  if (decisionAuditRows.length > 0) {
    const { error: decisionAuditError } = await supabase.from("audit_events").insert(decisionAuditRows);

    if (decisionAuditError) {
      warnings.push(`Approval decision audit was not saved: ${sanitizeSupabaseError(decisionAuditError.message)}`);
    }
  }

  let executionDraftId: string | undefined;

  if (input.executionDraft) {
    const draftResult = await saveExecutionDraft({
      supabase,
      workspaceId: workspace.id as string,
      planningRunId,
      draft: input.executionDraft,
      actor: input.createdBy
    });

    if (draftResult.ok) {
      executionDraftId = draftResult.executionDraftId;
    } else {
      warnings.push(draftResult.error);
    }
  }

  return {
    ok: true,
    planningRunId,
    executionDraftId,
    warnings
  };
}

async function getStagedChangeDecisionMetadataSupport(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>
): Promise<boolean> {
  const { error } = await supabase.from("staged_changes").select("id,decided_by,decision_note,decision_source", {
    head: true
  });

  return !error;
}

async function saveExecutionDraft(input: {
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>;
  workspaceId: string;
  planningRunId: string;
  draft: NaverExecutionDraft;
  actor?: string;
}): Promise<{ ok: true; executionDraftId: string } | { ok: false; error: string }> {
  const { supabase, draft } = input;
  const { data: executionDraft, error: draftError } = await supabase
    .from("execution_drafts")
    .upsert(
      {
        planning_run_id: input.planningRunId,
        draft_key: draft.draftKey,
        draft_id: draft.draftId,
        brand_name: draft.brandName,
        approved_change_count: draft.approvedChangeCount,
        status: draft.validation.canExecuteTest ? "ready" : "blocked",
        validation: draft.validation,
        blocked: draft.blocked,
        generated_at: draft.generatedAt
      },
      { onConflict: "draft_key" }
    )
    .select("id")
    .single();

  if (draftError || !executionDraft) {
    return {
      ok: false,
      error: `Execution draft history was not saved: ${sanitizeSupabaseError(draftError?.message)}`
    };
  }

  const executionDraftId = executionDraft.id as string;

  if (draft.payloads.length > 0) {
    const payloadRows = draft.payloads.map((payload) => ({
      execution_draft_id: executionDraftId,
      payload_key: payload.id,
      idempotency_key: payload.idempotencyKey,
      method: payload.method,
      uri: payload.uri,
      entity_type: payload.entityType,
      target: payload.target,
      params: payload.params ?? {},
      body: payload.body,
      safety: payload.safety
    }));
    let { error: payloadError } = await supabase
      .from("execution_payloads")
      .upsert(payloadRows, { onConflict: "execution_draft_id,payload_key" });

    if (payloadError && isPayloadIdempotencyConstraintError(payloadError)) {
      // Older applied DBs made idempotency_key globally unique; retry against that key until the relaxing migration lands.
      const compatibilityResult = await supabase
        .from("execution_payloads")
        .upsert(payloadRows, { onConflict: "idempotency_key" });

      payloadError = compatibilityResult.error;
    }

    if (payloadError) {
      return {
        ok: false,
        error: `Execution payload history was not saved: ${sanitizeSupabaseError(payloadError.message)}`
      };
    }
  }

  await supabase.from("audit_events").insert({
    workspace_id: input.workspaceId,
    planning_run_id: input.planningRunId,
    event_type: "execution_draft.created",
    actor: input.actor,
    entity_type: "execution_draft",
    entity_id: executionDraftId,
    after_value: {
      draftKey: draft.draftKey,
      draftId: draft.draftId,
      payloadCount: draft.payloads.length,
      validation: draft.validation
    },
    reason: "Operator saved a staged Naver execution draft."
  });

  return {
    ok: true,
    executionDraftId
  };
}

function sanitizeSupabaseError(message: string | undefined): string {
  return message?.slice(0, 300) || "Supabase persistence failed.";
}

function isPayloadIdempotencyConstraintError(error: { code?: string; message?: string; details?: string | null }): boolean {
  const text = [error.message, error.details].filter(Boolean).join(" ");
  return error.code === "23505" && text.includes("execution_payloads_idempotency_key_key");
}
