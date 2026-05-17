import { redactSensitiveErrorText } from "@/lib/error-redaction";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { PlannerPlan } from "@/lib/planner";
import type { ApprovalDecisionMap, ApprovalDecisionNoteMap } from "@/lib/reporting";
import type { NaverExecutionContext, NaverExecutionDraft } from "@/lib/execution-draft";
import { createShoppingLinkageSummary } from "@/lib/shopping-linkage";

export type SavePlanningRunInput = {
  plan: PlannerPlan;
  decisions: ApprovalDecisionMap;
  decisionNotes?: ApprovalDecisionNoteMap;
  executionDraft?: NaverExecutionDraft;
  createdBy?: string;
  createdByUserId?: string;
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
      planningRunId?: string;
      warnings?: string[];
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
  const [ownershipSupport, shoppingLinkageSupport, productGroupSupport, plannerMetadataSupport] = await Promise.all([
    getWorkspaceOwnershipSupport(supabase),
    getPlanningRunShoppingLinkageSupport(supabase),
    getPlanningProductGroupSupport(supabase),
    getPlanningRunMetadataSupport(supabase)
  ]);
  const workspaceResult = await getOrCreateWorkspace({
    supabase,
    name: `${plan.input.brandName} Workspace`,
    mode: plan.input.mode,
    ownerUserId: input.createdByUserId,
    ownershipSupport
  });

  if (!workspaceResult.ok) {
    return {
      ok: false,
      error: workspaceResult.error
    };
  }

  const workspaceId = workspaceResult.workspaceId;
  const shoppingLinkage = createShoppingLinkageSummary({
    productType: plan.input.productType,
    context: input.executionDraft?.context ?? {},
    capturedAt: new Date().toISOString()
  });
  const planningRunInsert = {
    workspace_id: workspaceId,
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
    created_by: input.createdBy,
    ...(shoppingLinkageSupport ? { shopping_linkage: shoppingLinkage } : {}),
    ...(plannerMetadataSupport
      ? {
          industry_template: plan.industryTemplate,
          benchmark_features: plan.benchmarkFeatures,
          operation_rules: plan.operationRules
        }
      : {}),
    ...(ownershipSupport.planningRunUser && input.createdByUserId
      ? { created_by_user_id: input.createdByUserId }
      : {})
  };
  const { data: run, error: runError } = await supabase
    .from("planning_runs")
    .insert(planningRunInsert)
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
      approval_required: isStagedChangeApprovalRequired(change),
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
        workspace_id: workspaceId,
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
          approvalRequired: isStagedChangeApprovalRequired(change),
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
      workspace_id: workspaceId,
      planning_run_id: planningRunId,
      event_type: "planning_run.created",
      actor: input.createdBy,
      entity_type: "planning_run",
      entity_id: planningRunId,
      after_value: {
        forecast: plan.forecast,
        decisions,
        decisionNotes,
        shoppingLinkage,
        shoppingLinkageCaptured: shoppingLinkageSupport,
        productGroupRecommendationCount: plan.productGroups.length,
        productGroupRecommendationsCaptured: productGroupSupport,
        plannerMetadataCaptured: plannerMetadataSupport
      },
      reason: "MVP planner dry-run saved."
    })
  ]);

  const error = keywordResult.error ?? adGroupResult.error ?? stagedChangeResult.error ?? auditResult.error;

  if (error) {
    const sanitizedError = sanitizeSupabaseError(error.message);
    await recordPlanningSaveFailure(supabase, {
      workspaceId,
      planningRunId,
      actor: input.createdBy,
      stage: "core_child_history",
      error: sanitizedError,
      details: {
        keywordRows: keywordRows.length,
        adGroupRows: adGroupRows.length,
        stagedChangeRows: stagedChangeRows.length,
        auditAttempted: true
      }
    });

    return {
      ok: false,
      planningRunId,
      error: sanitizedError,
      warnings: [
        "A planning run row may exist, but one or more core child-history writes failed. Review ops.planning_save.failed before re-saving."
      ]
    };
  }

  if (decisionAuditRows.length > 0) {
    const { error: decisionAuditError } = await supabase.from("audit_events").insert(decisionAuditRows);

    if (decisionAuditError) {
      warnings.push(`Approval decision audit was not saved: ${sanitizeSupabaseError(decisionAuditError.message)}`);
    }
  }

  if (productGroupSupport && plan.productGroups.length > 0) {
    const { error: productGroupError } = await supabase.from("planning_product_groups").insert(
      plan.productGroups.map((group) => ({
        planning_run_id: planningRunId,
        name: group.name,
        source_group: group.sourceGroup,
        query_count: group.queryCount,
        product_hints: group.productHints,
        feed_actions: group.feedActions
      }))
    );

    if (productGroupError) {
      warnings.push(`Shopping product-group recommendations were not saved: ${sanitizeSupabaseError(productGroupError.message)}`);
    }
  }

  if (ownershipSupport.workspaceMembers && input.createdByUserId) {
    const { error: memberError } = await supabase.from("workspace_members").upsert(
      {
        workspace_id: workspaceId,
        user_id: input.createdByUserId,
        email: input.createdBy ?? null,
        role: "owner"
      },
      { onConflict: "workspace_id,user_id" }
    );

    if (memberError) {
      warnings.push(`Workspace membership was not saved: ${sanitizeSupabaseError(memberError.message)}`);
    }
  }

  let executionDraftId: string | undefined;

  if (input.executionDraft) {
    const draftResult = await saveExecutionDraft({
      supabase,
      workspaceId,
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

function isStagedChangeApprovalRequired(change: PlannerPlan["stagedChanges"][number]): boolean {
  return change.approval === "승인 필요" || change.risk === "blocked";
}

async function getWorkspaceOwnershipSupport(supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>) {
  const [workspaceResult, runResult, memberResult] = await Promise.all([
    supabase.from("workspaces").select("id,owner_user_id", { head: true }),
    supabase.from("planning_runs").select("id,created_by_user_id", { head: true }),
    supabase.from("workspace_members").select("id", { head: true })
  ]);

  return {
    workspaceOwner: !workspaceResult.error,
    planningRunUser: !runResult.error,
    workspaceMembers: !memberResult.error
  };
}

async function getPlanningRunShoppingLinkageSupport(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>
): Promise<boolean> {
  const { error } = await supabase.from("planning_runs").select("id,shopping_linkage", {
    head: true
  });

  return !error;
}

async function getPlanningProductGroupSupport(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>
): Promise<boolean> {
  const { error } = await supabase.from("planning_product_groups").select("id", {
    head: true
  });

  return !error;
}

async function getPlanningRunMetadataSupport(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>
): Promise<boolean> {
  const { error } = await supabase.from("planning_runs").select("id,industry_template,benchmark_features,operation_rules", {
    head: true
  });

  return !error;
}

async function getOrCreateWorkspace(input: {
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>;
  name: string;
  mode: PlannerPlan["input"]["mode"];
  ownerUserId?: string;
  ownershipSupport: Awaited<ReturnType<typeof getWorkspaceOwnershipSupport>>;
}): Promise<{ ok: true; workspaceId: string } | { ok: false; error: string }> {
  const { supabase, name, mode, ownerUserId, ownershipSupport } = input;

  if (ownershipSupport.workspaceOwner && ownerUserId) {
    const { data: existingWorkspace, error: lookupError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("owner_user_id", ownerUserId)
      .eq("name", name)
      .eq("mode", mode)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      return {
        ok: false,
        error: sanitizeSupabaseError(lookupError.message)
      };
    }

    if (existingWorkspace?.id) {
      await supabase.from("workspaces").update({ updated_at: new Date().toISOString() }).eq("id", existingWorkspace.id);

      return {
        ok: true,
        workspaceId: existingWorkspace.id as string
      };
    }
  }

  const workspaceInsert = {
    name,
    mode,
    ...(ownershipSupport.workspaceOwner && ownerUserId ? { owner_user_id: ownerUserId } : {})
  };
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .insert(workspaceInsert)
    .select("id")
    .single();

  if (workspaceError || !workspace) {
    return {
      ok: false,
      error: sanitizeSupabaseError(workspaceError?.message)
    };
  }

  return {
    ok: true,
    workspaceId: workspace.id as string
  };
}

async function recordPlanningSaveFailure(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  input: {
    workspaceId: string;
    planningRunId: string;
    actor?: string;
    stage: string;
    error: string;
    details: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await supabase.from("audit_events").insert({
      workspace_id: input.workspaceId,
      planning_run_id: input.planningRunId,
      event_type: "ops.planning_save.failed",
      actor: input.actor,
      entity_type: "planning_run",
      entity_id: input.planningRunId,
      after_value: {
        partial: true,
        stage: input.stage,
        error: input.error,
        ...input.details
      },
      reason: "Planning run core child-history persistence failed after the parent row was created."
    });
  } catch {
    // Failure visibility is best-effort and must not mask the original persistence error.
  }
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
  const contextSupport = await getExecutionDraftContextSupport(supabase);
  const draftRow = {
    planning_run_id: input.planningRunId,
    draft_key: draft.draftKey,
    draft_id: draft.draftId,
    brand_name: draft.brandName,
    approved_change_count: draft.approvedChangeCount,
    status: draft.validation.canExecuteTest ? "ready" : "blocked",
    validation: draft.validation,
    blocked: draft.blocked,
    generated_at: draft.generatedAt,
    ...(contextSupport ? { execution_context: sanitizeExecutionContext(draft.context) } : {})
  };
  const { data: executionDraft, error: draftError } = await supabase
    .from("execution_drafts")
    .upsert(draftRow, { onConflict: "draft_key" })
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

    if (payloadError && isPayloadIdempotencyConstraintError(payloadError)) {
      const alreadySaved = await areExecutionPayloadsAlreadySaved(supabase, payloadRows);

      if (alreadySaved) {
        payloadError = null;
      }
    }

    if (payloadError) {
      return {
        ok: false,
        error: formatPayloadPersistenceError(payloadError)
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
      contextCaptured: contextSupport,
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

async function getExecutionDraftContextSupport(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>
): Promise<boolean> {
  const { error } = await supabase.from("execution_drafts").select("id,execution_context", {
    head: true
  });

  return !error;
}

function sanitizeExecutionContext(context: NaverExecutionContext): NaverExecutionContext {
  const sanitized: NaverExecutionContext = {};

  for (const [key, value] of Object.entries(context) as Array<[keyof NaverExecutionContext, unknown]>) {
    if (key === "adgroupIdsByName" && value && typeof value === "object" && !Array.isArray(value)) {
      const adgroupIdsByName = Object.fromEntries(
        Object.entries(value)
          .filter((entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1].trim()))
          .map(([name, id]) => [name.slice(0, 140), id.trim().slice(0, 140)])
      );

      if (Object.keys(adgroupIdsByName).length > 0) {
        sanitized.adgroupIdsByName = adgroupIdsByName;
      }

      continue;
    }

    if (typeof value === "string" && value.trim()) {
      sanitized[key] = value.trim().slice(0, 140) as never;
    }
  }

  return sanitized;
}

function sanitizeSupabaseError(message: string | undefined): string {
  return redactSensitiveErrorText(message, "Supabase persistence failed.", 300);
}

function formatPayloadPersistenceError(error: { code?: string; message?: string; details?: string | null }): string {
  if (isPayloadIdempotencyConstraintError(error)) {
    return [
      "Execution payload history was not saved because the legacy global idempotency constraint is still active.",
      "Apply supabase/migrations/20260516101400_relax_execution_payload_idempotency.sql, then save the draft again."
    ].join(" ");
  }

  return `Execution payload history was not saved: ${sanitizeSupabaseError(error.message)}`;
}

function isPayloadIdempotencyConstraintError(error: { code?: string; message?: string; details?: string | null }): boolean {
  const text = [error.message, error.details].filter(Boolean).join(" ");
  return error.code === "23505" && text.includes("execution_payloads") && text.includes("idempotency");
}

async function areExecutionPayloadsAlreadySaved(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  payloadRows: Array<{ idempotency_key: string }>
): Promise<boolean> {
  const idempotencyKeys = [...new Set(payloadRows.map((row) => row.idempotency_key).filter(Boolean))];

  if (idempotencyKeys.length === 0) {
    return true;
  }

  const { data, error } = await supabase
    .from("execution_payloads")
    .select("idempotency_key")
    .in("idempotency_key", idempotencyKeys);

  if (error) {
    return false;
  }

  const savedKeys = new Set((data ?? []).map((row) => row.idempotency_key));

  return idempotencyKeys.every((key) => savedKeys.has(key));
}
