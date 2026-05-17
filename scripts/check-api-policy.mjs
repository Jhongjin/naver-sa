import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiRoot = path.join(root, "app", "api");
const routeFiles = findRouteFiles(apiRoot);
const failures = [];

for (const file of routeFiles) {
  const source = readFileSync(file, "utf8");
  const relativePath = path.relative(root, file).replaceAll(path.sep, "/");

  if (source.includes("NextResponse.json(")) {
    failures.push(`${relativePath}: use jsonNoStore instead of NextResponse.json`);
  }

  if (source.includes("NextResponse")) {
    failures.push(`${relativePath}: keep NextResponse usage inside lib/http.ts`);
  }

  if (source.includes("x-admin-secret") || source.includes("verifyAdminSecret")) {
    failures.push(`${relativePath}: use Supabase Auth access checks instead of shared admin secrets`);
  }

  if (!source.includes("jsonNoStore")) {
    failures.push(`${relativePath}: missing jsonNoStore no-cache response helper`);
  }

  if (!source.includes("methodNotAllowed")) {
    failures.push(`${relativePath}: missing explicit 405 methodNotAllowed handler`);
  }

  const exportedMethods = [...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map(
    (match) => match[1]
  );

  if (exportedMethods.length === 0) {
    failures.push(`${relativePath}: no exported route method found`);
  }

  for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
    if (!exportedMethods.includes(method)) {
      failures.push(`${relativePath}: missing explicit ${method} handler; avoid Next.js default cacheable method responses`);
    }
  }

  if (relativePath === "app/api/naver/execute-draft/route.ts") {
    requireSourceIncludes(source, relativePath, "verifyUserAccess(request, { requireAdmin: true })");
    requireSourceIncludes(source, relativePath, "loadReadyExecutionDraft(draft.draftKey)");
    requireSourceIncludes(source, relativePath, "EXECUTION_ALREADY_RECORDED");
    requireSourceOrder(source, relativePath, "loadReadyExecutionDraft(draft.draftKey)", "requestNaverSearchAd<unknown>");
  }

  if (relativePath === "app/api/plans/store/route.ts") {
    requireSourceIncludes(source, relativePath, "verifyUserAccess(request, { requireAdmin: true })");
    requireSourceIncludes(source, relativePath, "createdByUserId = access.user.id");
  }

  if (relativePath === "app/api/workspaces/mine/route.ts") {
    requireSourceIncludes(source, relativePath, "verifyUserAccess(request)");
    requireSourceIncludes(source, relativePath, '.eq("user_id", access.state.userId)');
    requireSourceIncludes(source, relativePath, "scopeEnforced: true");
    requireSourceIncludes(source, relativePath, "internalOwnerIdExcluded: true");
    requireSourceIncludes(source, relativePath, "isOwner:");
    requireSourceExcludes(
      source,
      relativePath,
      "ownerUserId:",
      "workspace membership responses must not expose internal owner user ids"
    );
  }

  if (relativePath === "app/api/operator/session/route.ts") {
    requireSourceIncludes(source, relativePath, 'methodNotAllowed(["POST"])');
    requireSourceIncludes(source, relativePath, "OPERATOR_ENDPOINT_DEPRECATED");
    requireSourceIncludes(source, relativePath, "This legacy operator endpoint has moved to /api/auth/session.");
    requireSourceIncludes(source, relativePath, "/api/auth/session");
    requireSourceIncludes(source, relativePath, "{ status: 410 }");
    requireSourceExcludes(
      source,
      relativePath,
      "verifyUserAccess",
      "legacy operator endpoint must stay deprecated instead of becoming a second auth surface"
    );
    requireSourceExcludes(
      source,
      relativePath,
      "capabilities:",
      "legacy operator endpoint must not return session capabilities"
    );
    requireSourceExcludes(
      source,
      relativePath,
      "userId:",
      "legacy operator endpoint must not return user identity"
    );
  }

  if (relativePath === "app/api/auth/session/route.ts") {
    requireSourceIncludes(source, relativePath, "verifyUserAccess(request)");
    requireSourceIncludes(source, relativePath, 'liveCampaignActivation: "blocked"');
    requireSourceIncludes(source, relativePath, 'productionDeletion: "blocked"');
    requireSourceIncludes(source, relativePath, 'externalWriteExecution: "test-route-only"');
  }

  if (relativePath === "app/api/health/route.ts") {
    requireSourceIncludes(source, relativePath, "secretNamesExcluded: true");
    requireSourceIncludes(source, relativePath, "environmentVariableNamesExcluded: true");
    requireSourceIncludes(source, relativePath, "requiredPresentCount");
    requireSourceIncludes(source, relativePath, "requiredTotalCount");
    requireSourceIncludes(source, relativePath, "recommendedPresentCount");
    requireSourceIncludes(source, relativePath, "recommendedTotalCount");

    const healthBody = getSourceSegment(source, relativePath, "return jsonNoStore({", "\n  });\n}");

    requireSourceExcludes(healthBody, relativePath, "requiredVariables", "public health must not return env var names");
    requireSourceExcludes(healthBody, relativePath, "recommendedVariables", "public health must not return env var names");
    requireSourceExcludes(healthBody, relativePath, "variables:", "public health must not return env var arrays");
    requireSourceExcludes(healthBody, relativePath, "recommended:", "public health must not return env var arrays");
    requireSourceExcludes(healthBody, relativePath, "name:", "public health must not return individual env var names");
    requireSourceExcludes(healthBody, relativePath, "SUPABASE_SERVICE_ROLE_KEY", "public health must not expose secret env names");
    requireSourceExcludes(healthBody, relativePath, "NAVER_SEARCH_AD_SECRET_KEY", "public health must not expose secret env names");
    requireSourceExcludes(healthBody, relativePath, "OPENAI_API_KEY", "public health must not expose secret env names");
    requireSourceExcludes(healthBody, relativePath, "CRON_SECRET", "public health must not expose secret env names");
    requireSourceExcludes(healthBody, relativePath, "ENCRYPTION_KEY", "public health must not expose secret env names");
  }

  if (relativePath === "app/api/naver/performance-sync/cron/route.ts") {
    requireSourceIncludes(source, relativePath, "authorization !== `Bearer ${cronSecret}`");
    requireSourceIncludes(source, relativePath, "heartbeatRecorded");
    requireSourceIncludes(source, relativePath, "catch {");
  }

  if (relativePath === "app/api/supabase/readiness/route.ts") {
    requireSourceIncludes(source, relativePath, "verifyUserAccess(request, { requireAdmin: true })");
    requireSourceIncludes(source, relativePath, "optionalFeatures");
    requireSourceIncludes(source, relativePath, "planning_product_groups");
    requireSourceIncludes(source, relativePath, "shopping_linkage");
    requireSourceIncludes(source, relativePath, "execution_context");
    requireSourceIncludes(source, relativePath, "industry_template");
    requireSourceIncludes(source, relativePath, "benchmark_features");
    requireSourceIncludes(source, relativePath, "operation_rules");
    requireSourceExcludes(
      source,
      relativePath,
      "rowCount: table.rowCount",
      "public Supabase readiness must not expose optional table row counts"
    );
  }

  if (relativePath === "app/api/naver/performance-sync/preview/route.ts") {
    requireSourceIncludes(source, relativePath, "verifyUserAccess(request, { requireAdmin: true })");
    requireSourceIncludes(source, relativePath, 'requestNaverSearchAd<unknown>("GET", "/api/stats"');
    requireSourceIncludes(source, relativePath, "scope: preview.scope");
    requireSourceIncludes(source, relativePath, "scope: input.preview.scope");
    requireSourceIncludes(source, relativePath, "storedRawStats: false");
    requireSourceIncludes(source, relativePath, "readOnly: true");
  }

  if (relativePath === "app/api/naver/performance-sync/readiness/route.ts") {
    requireSourceIncludes(source, relativePath, "verifyUserAccess(request, { requireAdmin: true })");
    requireSourceIncludes(source, relativePath, "const { client: databaseClient, ...database } = databaseCheck;");
    requireSourceIncludes(source, relativePath, "database,");
    requireSourceIncludes(source, relativePath, "ops,");
    requireSourceIncludes(source, relativePath, "externalRequest: false");
    requireSourceExcludes(source, relativePath, "databaseCheck,", "readiness must return the sanitized database object without the internal client");
  }

  if (relativePath === "app/api/naver/account-snapshot/route.ts") {
    requireSourceIncludes(source, relativePath, "verifyUserAccess(request, { requireAdmin: true })");
  }

  if (relativePath === "app/api/naver/account-snapshot/history/route.ts") {
    requireSourceIncludes(source, relativePath, "verifyUserAccess(request)");
    requireSourceIncludes(source, relativePath, 'access.state.role !== "admin"');
    requireSourceIncludes(source, relativePath, 'query = query.eq("user_id", access.user.id)');
    requireSourceIncludes(source, relativePath, "rawInventoryExcluded: true");
    requireSourceIncludes(source, relativePath, "scopeEnforced: true");

    const snapshotHistoryItem = getSourceSegment(
      source,
      relativePath,
      "function toSnapshotHistoryItem",
      "\nfunction findComparisonRow"
    );

    requireSourceExcludes(
      snapshotHistoryItem,
      relativePath,
      "channels: row.channels",
      "account snapshot history items must not expose raw channel inventory"
    );
    requireSourceExcludes(
      snapshotHistoryItem,
      relativePath,
      "campaigns: row.campaigns",
      "account snapshot history items must not expose raw campaign inventory"
    );
    requireSourceExcludes(
      snapshotHistoryItem,
      relativePath,
      "productGroups: row.product_groups",
      "account snapshot history items must not expose raw product-group inventory"
    );
  }

  if (relativePath === "app/api/admin/report-share-links/route.ts") {
    requireSourceIncludes(source, relativePath, "verifyUserAccess(request, { requireAdmin: true })");
    requireSourceIncludes(source, relativePath, "tokenExcluded: true");
    requireSourceIncludes(source, relativePath, "tokenHashExcluded: true");
    requireSourceIncludes(source, relativePath, "tokenAvailable: false");
    requireSourceExcludes(source, relativePath, "token_hash", "admin share-link registry must not select or expose token hashes");
    requireSourceExcludes(source, relativePath, "shareUrl", "admin share-link registry must not reconstruct public URLs");
  }

  if (relativePath === "app/api/admin/audit-events/route.ts") {
    requireSourceIncludes(source, relativePath, "verifyUserAccess(request, { requireAdmin: true })");
    requireSourceIncludes(source, relativePath, "rawValuesExcluded: true");
    requireSourceIncludes(source, relativePath, "auditTextSanitized: true");
    requireSourceIncludes(source, relativePath, "reason: sanitizeAuditText(row.reason, 220)");
    requireSourceIncludes(source, relativePath, "sanitizeAuditText(value, 160)");
    requireSourceIncludes(source, relativePath, "return sanitizeAuditText(value, 80)");
    requireSourceIncludes(source, relativePath, "function sanitizeAuditText");
    requireSourceExcludes(source, relativePath, "before_value", "admin audit event API must not select or return raw before values");
    requireSourceExcludes(source, relativePath, "beforeValue:", "admin audit event API must not return raw before values");
    requireSourceExcludes(source, relativePath, "afterValue:", "admin audit event API must not return raw after values");
  }

  if (relativePath === "app/api/plans/history/[planningRunId]/share-links/route.ts") {
    requireSourceIncludes(source, relativePath, "hashReportShareToken(token)");
    requireSourceIncludes(source, relativePath, "token_hash: tokenHash");
    requireSourceIncludes(source, relativePath, "tokenStored: false");
    requireSourceIncludes(source, relativePath, "tokenHashOnly: true");
    requireSourceIncludes(source, relativePath, "toSafeShareLink");
    requireSourceCount(source, relativePath, "shareUrl", 1);
  }

  if (relativePath === "app/api/plans/history/[planningRunId]/route.ts") {
    requireSourceIncludes(source, relativePath, "verifyUserAccess(request)");
    requireSourceIncludes(source, relativePath, "hasWorkspaceMembership");
    requireSourceIncludes(source, relativePath, "internalUserIdsExcluded: true");
    requireSourceIncludes(source, relativePath, "auditRawValuesExcluded: true");
    requireSourceIncludes(source, relativePath, "toSafeAuditEvent");
    requireSourceIncludes(source, relativePath, "auditEvents: ((auditResult.data ?? []) as AuditEventRow[]).map(toSafeAuditEvent)");
    requireSourceIncludes(source, relativePath, "createdByUserLinked: Boolean(planningRun.created_by_user_id)");
    requireSourceIncludes(source, relativePath, "workspaceOwnerMatchesCreator: getWorkspaceOwnerMatchesCreator(workspace, planningRun)");
    requireSourceExcludes(
      source,
      relativePath,
      "before_value",
      "history detail responses must not select or expose raw audit before values"
    );
    requireSourceExcludes(
      source,
      relativePath,
      "auditEvents: auditResult.data ?? []",
      "history detail responses must map audit rows through a safe formatter"
    );
    requireSourceExcludes(
      source,
      relativePath,
      "createdByUserId:",
      "history detail responses must not expose internal creator user ids"
    );
    requireSourceExcludes(
      source,
      relativePath,
      "workspaceOwnerUserId:",
      "history detail responses must not expose internal workspace owner user ids"
    );
  }

  if (relativePath === "app/api/share/reports/[token]/route.ts") {
    requireSourceIncludes(source, relativePath, "isValidReportShareToken(token)");
    requireSourceIncludes(source, relativePath, "hashReportShareToken(token)");
    requireSourceIncludes(source, relativePath, "publicReport: true");
    requireSourceIncludes(source, relativePath, "liveBlocked: true");
    requireSourceIncludes(source, relativePath, "deleteBlocked: true");
    requireSourceIncludes(source, relativePath, "rawPayloadExcluded: true");
    requireSourceIncludes(source, relativePath, "idempotencyKeysExcluded: true");
    requireSourceIncludes(source, relativePath, "auditExcluded: true");
    requireSourceIncludes(source, relativePath, "productGroups:");
    requireSourceIncludes(source, relativePath, "planning_product_groups");
    requireSourceIncludes(source, relativePath, "sanitizePublicValidation(draft.validation)");
    requireSourceIncludes(source, relativePath, "coercePlannerMetadata");
    requireSourceIncludes(source, relativePath, "toPublicPlannerMetadata");
    requireSourceIncludes(source, relativePath, "hasPlannerMetadataSupport");
    requireSourceIncludes(source, relativePath, "industry_template");
    requireSourceIncludes(source, relativePath, "benchmark_features");
    requireSourceIncludes(source, relativePath, "operation_rules");
    requireSourceIncludes(source, relativePath, "plannerMetadataSanitized: true");
    requireSourceIncludes(source, relativePath, "industryTemplateName");
    requireSourceIncludes(source, relativePath, "benchmarkFeatureSummary");
    requireSourceIncludes(source, relativePath, "operationRules");
    requireSourceIncludes(source, relativePath, 'select("id",');
    requireSourceIncludes(source, relativePath, "head: true");
    requireSourceExcludes(source, relativePath, '.select("body', "public report route must not select raw execution payload bodies");
    requireSourceExcludes(source, relativePath, "idempotency_key", "public report route must not select idempotency keys");
    requireSourceExcludes(source, relativePath, "before_value", "public report route must not expose audit before values");
    requireSourceExcludes(source, relativePath, "after_value", "public report route must not expose audit after values");
    requireSourceExcludes(source, relativePath, '.from("audit_events")', "public report route must not expose internal audit events");

    const publicReportBody = getSourceSegment(
      source,
      relativePath,
      "return jsonNoStore({\n    ok: true,",
      "\n  });\n}\n\nasync function getExecutionPayloadCount"
    );

    requireSourceIncludes(publicReportBody, relativePath, "productGroups:");
    requireSourceIncludes(publicReportBody, relativePath, "plannerMetadata:");
    requireSourceIncludes(publicReportBody, relativePath, "plannerMetadataSanitized: true");
    requireSourceIncludes(publicReportBody, relativePath, "sourceGroup: group.source_group");
    requireSourceIncludes(publicReportBody, relativePath, "queryCount: group.query_count");
    requireSourceIncludes(publicReportBody, relativePath, "productHints: group.product_hints");
    requireSourceIncludes(publicReportBody, relativePath, "feedActions: group.feed_actions");
    requireSourceExcludes(publicReportBody, relativePath, "planningRunId", "public report body must not expose internal planning run ids");
    requireSourceExcludes(publicReportBody, relativePath, "planning_run_id", "public report body must not expose internal planning run ids");
    requireSourceExcludes(publicReportBody, relativePath, "workspaceId", "public report body must not expose internal workspace ids");
    requireSourceExcludes(publicReportBody, relativePath, "workspace_id", "public report body must not expose internal workspace ids");
    requireSourceExcludes(publicReportBody, relativePath, "executionDraftId", "public report body must not expose internal execution draft ids");
    requireSourceExcludes(publicReportBody, relativePath, "draftKey", "public report body must not expose execution draft keys");
    requireSourceExcludes(publicReportBody, relativePath, "draftId", "public report body must not expose execution draft ids");
    requireSourceExcludes(publicReportBody, relativePath, "idempotencyKey:", "public report body must not expose idempotency keys");
    requireSourceExcludes(publicReportBody, relativePath, "payloadId", "public report body must not expose internal payload ids");
    requireSourceExcludes(publicReportBody, relativePath, "share.id", "public report body must not expose share-link row ids");
    requireSourceExcludes(publicReportBody, relativePath, "createdBy", "public report body must not expose internal creator identity");
    requireSourceExcludes(publicReportBody, relativePath, "landingChecks", "public report body must not expose full planner template internals");
    requireSourceExcludes(publicReportBody, relativePath, "copyRules", "public report body must not expose full planner template internals");
    requireSourceExcludes(publicReportBody, relativePath, "negativeThemes", "public report body must not expose full planner template internals");
  }
}

requireProjectSurfaceChecks();

if (failures.length > 0) {
  console.error("API policy check failed:");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log(`API policy check passed for ${routeFiles.length} route files.`);

function findRouteFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return findRouteFiles(entryPath);
    }

    return entry.isFile() && entry.name === "route.ts" ? [entryPath] : [];
  });
}

function requireSourceIncludes(source, relativePath, expected) {
  if (!source.includes(expected)) {
    failures.push(`${relativePath}: missing required policy guard: ${expected}`);
  }
}

function requireSourceExcludes(source, relativePath, forbidden, reason) {
  if (source.includes(forbidden)) {
    failures.push(`${relativePath}: forbidden policy surface: ${reason}`);
  }
}

function getSourceSegment(source, relativePath, startMarker, endMarker) {
  const start = source.indexOf(startMarker);

  if (start === -1) {
    failures.push(`${relativePath}: missing required policy segment start: ${startMarker}`);

    return "";
  }

  const end = source.indexOf(endMarker, start + startMarker.length);

  if (end === -1) {
    failures.push(`${relativePath}: missing required policy segment end: ${endMarker}`);

    return "";
  }

  return source.slice(start, end);
}

function requireSourceCount(source, relativePath, expected, count) {
  const actual = source.split(expected).length - 1;

  if (actual !== count) {
    failures.push(`${relativePath}: expected ${expected} to appear ${count} time(s), found ${actual}`);
  }
}

function requireSourceOrder(source, relativePath, before, after) {
  const beforeIndex = source.indexOf(before);
  const afterIndex = source.indexOf(after);

  if (beforeIndex === -1 || afterIndex === -1 || beforeIndex > afterIndex) {
    failures.push(`${relativePath}: ${before} must appear before ${after}`);
  }
}

function requireProjectSurfaceChecks() {
  const persistencePath = "lib/persistence/planning-runs.ts";
  const persistenceSource = readProjectFile(persistencePath);

  requireSourceIncludes(persistenceSource, persistencePath, "recordPlanningSaveFailure");
  requireSourceIncludes(persistenceSource, persistencePath, "ops.planning_save.failed");
  requireSourceIncludes(persistenceSource, persistencePath, "planningRunId,");
  requireSourceIncludes(persistenceSource, persistencePath, "partial: true");
  requireSourceIncludes(persistenceSource, persistencePath, "core_child_history");
  requireSourceIncludes(persistenceSource, persistencePath, "getPlanningProductGroupSupport");
  requireSourceIncludes(persistenceSource, persistencePath, "getPlanningRunMetadataSupport");
  requireSourceIncludes(persistenceSource, persistencePath, "planning_product_groups");
  requireSourceIncludes(persistenceSource, persistencePath, "industry_template");
  requireSourceIncludes(persistenceSource, persistencePath, "benchmark_features");
  requireSourceIncludes(persistenceSource, persistencePath, "operation_rules");

  const adminClientPath = "app/components/admin/AdminUsersClient.tsx";
  const adminClientSource = readProjectFile(adminClientPath);

  requireSourceIncludes(adminClientSource, adminClientPath, "optionalFeatures");
  requireSourceIncludes(adminClientSource, adminClientPath, "formatOptionalFeatureDetail");
  requireSourceIncludes(adminClientSource, adminClientPath, "admin-health-feature-list");
  requireSourceIncludes(adminClientSource, adminClientPath, "선택 기능");
  requireSourceIncludes(adminClientSource, adminClientPath, "activityLinkageFilter");
  requireSourceIncludes(adminClientSource, adminClientPath, "activityLinkageFilterLabel");
  requireSourceIncludes(adminClientSource, adminClientPath, "최근 활동 쇼핑 linkage 필터");
  requireSourceIncludes(adminClientSource, adminClientPath, "internalCreatorUserIdsExcluded");
  requireSourceIncludes(adminClientSource, adminClientPath, 'event.eventType.startsWith("ops.")');
  requireSourceIncludes(adminClientSource, adminClientPath, "ops.report_share.created");
  requireSourceIncludes(adminClientSource, adminClientPath, "ops.report_share.revoked");
  requireSourceIncludes(adminClientSource, adminClientPath, "ops.planning_save.failed");
  requireSourceIncludes(adminClientSource, adminClientPath, "ops.performance_sync.failed");
  requireSourceExcludes(
    adminClientSource,
    adminClientPath,
    "ops.performance_sync.*",
    "admin ops alert summary must cover all ops.* events, not only performance sync"
  );
  requireSourceExcludes(
    adminClientSource,
    adminClientPath,
    "createdByUserId",
    "admin activity UI must not type or render internal creator user ids"
  );

  const sharedReportClientPath = "app/components/share/SharedReportClient.tsx";
  const sharedReportClientSource = readProjectFile(sharedReportClientPath);

  requireSourceIncludes(sharedReportClientSource, sharedReportClientPath, "plannerMetadata");
  requireSourceIncludes(sharedReportClientSource, sharedReportClientPath, "plannerMetadataSanitized");
  requireSourceIncludes(sharedReportClientSource, sharedReportClientPath, "전략 근거");
  requireSourceExcludes(
    sharedReportClientSource,
    sharedReportClientPath,
    "payloadId",
    "shared report UI must not type or render internal payload ids"
  );

  const historyListClientPath = "app/components/history/HistoryListClient.tsx";
  const historyListClientSource = readProjectFile(historyListClientPath);

  requireSourceIncludes(historyListClientSource, historyListClientPath, "linkageFilter");
  requireSourceIncludes(historyListClientSource, historyListClientPath, "coerceShoppingLinkageFilter");
  requireSourceIncludes(historyListClientSource, historyListClientPath, 'params.set("linkage", linkageFilter)');
  requireSourceIncludes(historyListClientSource, historyListClientPath, "쇼핑 linkage 필터");
  requireSourceIncludes(historyListClientSource, historyListClientPath, "internalCreatorUserIdsExcluded");
  requireSourceExcludes(
    historyListClientSource,
    historyListClientPath,
    "createdByUserId",
    "history list UI must not type or render internal creator user ids"
  );

  const shoppingLinkagePath = "lib/shopping-linkage.ts";
  const shoppingLinkageSource = readProjectFile(shoppingLinkagePath);

  requireSourceIncludes(shoppingLinkageSource, shoppingLinkagePath, "coerceShoppingLinkageStatusFilter");

  const historyApiPath = "app/api/plans/history/route.ts";
  const historyApiSource = readProjectFile(historyApiPath);

  requireSourceIncludes(historyApiSource, historyApiPath, "coerceShoppingLinkageStatusFilter");
  requireSourceIncludes(historyApiSource, historyApiPath, "linkageFilter");
  requireSourceIncludes(historyApiSource, historyApiPath, "linkage: linkageFilter ?? \"all\"");
  requireSourceIncludes(historyApiSource, historyApiPath, "internalCreatorUserIdsExcluded: true");
  requireSourceExcludes(
    historyApiSource,
    historyApiPath,
    "createdByUserId:",
    "history list responses must not expose internal creator user ids"
  );

  const adminActivityApiPath = "app/api/admin/activity/route.ts";
  const adminActivityApiSource = readProjectFile(adminActivityApiPath);

  requireSourceIncludes(adminActivityApiSource, adminActivityApiPath, "coerceShoppingLinkageStatusFilter");
  requireSourceIncludes(adminActivityApiSource, adminActivityApiPath, "linkageFilter");
  requireSourceIncludes(adminActivityApiSource, adminActivityApiPath, "linkage: linkageFilter ?? \"all\"");
  requireSourceIncludes(adminActivityApiSource, adminActivityApiPath, "internalCreatorUserIdsExcluded: true");
  requireSourceExcludes(
    adminActivityApiSource,
    adminActivityApiPath,
    "createdByUserId:",
    "admin activity responses must not expose internal creator user ids"
  );

  const myPageClientPath = "app/components/account/MyPageClient.tsx";
  const myPageClientSource = readProjectFile(myPageClientPath);

  requireSourceIncludes(myPageClientSource, myPageClientPath, "internalOwnerIdExcluded");
  requireSourceIncludes(myPageClientSource, myPageClientPath, "internalCreatorUserIdsExcluded");
  requireSourceIncludes(myPageClientSource, myPageClientPath, "workspaceOwnerLabel(workspace.isOwner");
  requireSourceExcludes(
    myPageClientSource,
    myPageClientPath,
    "ownerUserId",
    "my page workspace UI must not type or render internal owner user ids"
  );
  requireSourceExcludes(
    myPageClientSource,
    myPageClientPath,
    "createdByUserId",
    "my page history UI must not type or render internal creator user ids"
  );

  const historyDetailClientPath = "app/components/history/HistoryDetailClient.tsx";
  const historyDetailClientSource = readProjectFile(historyDetailClientPath);

  requireSourceIncludes(historyDetailClientSource, historyDetailClientPath, "internalUserIdsExcluded");
  requireSourceIncludes(historyDetailClientSource, historyDetailClientPath, "auditRawValuesExcluded");
  requireSourceIncludes(historyDetailClientSource, historyDetailClientPath, "workspaceOwnerMatchesCreator");
  requireSourceIncludes(historyDetailClientSource, historyDetailClientPath, "createdByUserLinked");
  requireSourceIncludes(historyDetailClientSource, historyDetailClientPath, "event.eventType");
  requireSourceExcludes(
    historyDetailClientSource,
    historyDetailClientPath,
    "workspaceOwnerUserId",
    "history detail UI must not type or render internal workspace owner user ids"
  );
  requireSourceExcludes(
    historyDetailClientSource,
    historyDetailClientPath,
    "createdByUserId",
    "history detail UI must not type or render internal creator user ids"
  );
  requireSourceExcludes(
    historyDetailClientSource,
    historyDetailClientPath,
    "before_value",
    "history detail UI must not type or render raw audit before values"
  );
  requireSourceExcludes(
    historyDetailClientSource,
    historyDetailClientPath,
    "after_value",
    "history detail UI must not type or render raw audit after values"
  );
  requireSourceExcludes(
    historyDetailClientSource,
    historyDetailClientPath,
    "event_type",
    "history detail UI must consume mapped camelCase audit event fields"
  );

}

function readProjectFile(relativePath) {
  return readFileSync(path.join(root, ...relativePath.split("/")), "utf8");
}
