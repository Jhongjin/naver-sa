import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const recommendationFile = path.join(root, "lib", "performance-recommendations.ts");
const source = readFileSync(recommendationFile, "utf8");
const performanceSyncSource = readFileSync(path.join(root, "lib", "naver-performance-sync.ts"), "utf8");
const performanceSyncRunnerSource = readFileSync(path.join(root, "lib", "performance-sync-runner.ts"), "utf8");
const cronRouteSource = readFileSync(
  path.join(root, "app", "api", "naver", "performance-sync", "cron", "route.ts"),
  "utf8"
);
const queueRouteSource = readFileSync(
  path.join(root, "app", "api", "naver", "performance-sync", "queue", "route.ts"),
  "utf8"
);
const previewRouteSource = readFileSync(
  path.join(root, "app", "api", "naver", "performance-sync", "preview", "route.ts"),
  "utf8"
);
const failures = [];

for (const exportName of [
  "PerformanceRecommendationDraft",
  "generatePerformanceRecommendationDrafts",
  "summarizePerformanceRecommendationDrafts"
]) {
  if (!source.includes(exportName)) {
    failures.push(`missing ${exportName}`);
  }
}

for (const requiredFlag of ["approvalRequired: true", "safeDraftOnly: true", "liveBlocked: true", "deleteBlocked: true"]) {
  if (!source.includes(requiredFlag)) {
    failures.push(`missing draft safety flag: ${requiredFlag}`);
  }
}

for (const blockedFlag of ["approvalRequired: false", "safeDraftOnly: false", "liveBlocked: false", "deleteBlocked: false"]) {
  if (source.includes(blockedFlag)) {
    failures.push(`unsafe draft flag found: ${blockedFlag}`);
  }
}

for (const action of [
  "increaseBidCandidate",
  "decreaseBidCandidate",
  "holdAndInspect",
  "creativeReview",
  "keepLearning"
]) {
  if (!source.includes(`case "${action}"`)) {
    failures.push(`missing draft policy case for ${action}`);
  }
}

for (const requiredSafeguard of [
  "readOnlyStatsOnly: true",
  "externalReportJobCreation: false",
  "externalReportDeletion: false",
  "liveMutation: false",
  "productionDelete: false"
]) {
  if (!performanceSyncSource.includes(requiredSafeguard)) {
    failures.push(`missing performance sync safeguard: ${requiredSafeguard}`);
  }
}

for (const blockedSafeguard of [
  "readOnlyStatsOnly: false",
  "externalReportJobCreation: true",
  "externalReportDeletion: true",
  "liveMutation: true",
  "productionDelete: true"
]) {
  if (performanceSyncSource.includes(blockedSafeguard)) {
    failures.push(`unsafe performance sync safeguard found: ${blockedSafeguard}`);
  }
}

for (const requiredCronPolicy of [
  'scheduleUtc: "10 0 * * *"',
  'scheduleKst: "매일 오전 9:10 KST"',
  "maxRunsPerInvocation: 3",
  'targetStatuses: ["planned", "failed"] as const',
  'excludedStatuses: ["blocked", "completed", "ready"] as const',
  "excludesMasterReference: true",
  "automaticRetry: false"
]) {
  if (!performanceSyncSource.includes(requiredCronPolicy)) {
    failures.push(`missing performance cron policy: ${requiredCronPolicy}`);
  }
}

for (const requiredPreviewGuard of [
  "scope: PerformanceSyncScope;",
  "const requestedScope = coerceScope(input.scope);",
  'const scope = requestedScope === "masterReference" ? "powerlinkDailyStats" : requestedScope;',
  'requestedScope === "masterReference"',
  "scope,"
]) {
  if (!performanceSyncSource.includes(requiredPreviewGuard)) {
    failures.push(`missing performance preview guard: ${requiredPreviewGuard}`);
  }
}

for (const requiredRunnerGuard of [
  "validatePerformanceSyncPlan(input.plan, input.allowedStatuses, input.source)",
  'requestNaverSearchAd<unknown>("GET", "/api/stats"',
  "timeIncrement: \"allDays\"",
  "storedRawStats: false",
  "generatePerformanceRecommendations(result.data)",
  "generatePerformanceRecommendationDrafts(recommendations)",
  "readOnly: true",
  "status: \"completed\"",
  "error: sanitizedError"
]) {
  if (!performanceSyncRunnerSource.includes(requiredRunnerGuard)) {
    failures.push(`missing performance sync runner guard: ${requiredRunnerGuard}`);
  }
}

requireSourceOrder(
  performanceSyncRunnerSource,
  "performance sync runner",
  "validatePerformanceSyncPlan(input.plan, input.allowedStatuses, input.source)",
  "requestNaverSearchAd<unknown>"
);

for (const requiredValidationGuard of [
  'plan.status === "blocked"',
  'plan.status === "completed"',
  "!allowedStatuses.includes(plan.status)",
  'plan.scope === "masterReference"'
]) {
  if (!performanceSyncRunnerSource.includes(requiredValidationGuard)) {
    failures.push(`missing performance sync validation guard: ${requiredValidationGuard}`);
  }
}

for (const forbiddenRunnerSurface of ['"POST"', '"PUT"', '"DELETE"', '"/api/master-reports"', '"/api/stat-reports"', '"/api/reports"']) {
  if (performanceSyncRunnerSource.includes(forbiddenRunnerSurface)) {
    failures.push(`performance sync runner must stay read-only stats-only: ${forbiddenRunnerSurface}`);
  }
}

if (performanceSyncRunnerSource.includes("error: result.error")) {
  failures.push("performance sync runner failure responses must return sanitizedError, not raw result.error");
}

const runnerStatsRequest = extractSourceBetween(
  performanceSyncRunnerSource,
  'requestNaverSearchAd<unknown>("GET", "/api/stats"',
  "\n  });"
);

if (!runnerStatsRequest) {
  failures.push("missing performance sync runner stats request block");
} else {
  for (const requiredQuery of ["ids: JSON.stringify(entityIds)", "fields: JSON.stringify(fields)", "timeRange: JSON.stringify({"]) {
    if (!runnerStatsRequest.includes(requiredQuery)) {
      failures.push(`performance sync runner stats request missing query guard: ${requiredQuery}`);
    }
  }
}

const runnerResultSummary = extractSourceBetween(performanceSyncRunnerSource, 'status: "completed"', "updated_at: completedAt");

if (!runnerResultSummary) {
  failures.push("missing completed performance sync result summary block");
} else {
  for (const forbiddenPersistedRawStats of ["stats:", "rawStats", "raw_stats", "result.data", "response:"]) {
    if (runnerResultSummary.includes(forbiddenPersistedRawStats)) {
      failures.push(`performance sync runner must not persist raw stats: ${forbiddenPersistedRawStats}`);
    }
  }
}

const runnerFailureSummary = extractSourceBetween(performanceSyncRunnerSource, 'status: "failed"', "updated_at: new Date().toISOString()");

if (!runnerFailureSummary) {
  failures.push("missing failed performance sync result summary block");
} else {
  if (!runnerFailureSummary.includes("storedRawStats: false")) {
    failures.push("failed performance sync result summary must mark storedRawStats: false");
  }

  for (const forbiddenPersistedRawStats of ["stats:", "rawStats", "raw_stats", "result.data", "response:"]) {
    if (runnerFailureSummary.includes(forbiddenPersistedRawStats)) {
      failures.push(`failed performance sync summary must not persist raw stats: ${forbiddenPersistedRawStats}`);
    }
  }
}

for (const requiredCronRouteGuard of [
  "authorization !== `Bearer ${cronSecret}`",
  '.in("status", [...performanceSyncCronPolicy.targetStatuses])',
  '.neq("scope", "masterReference")',
  ".limit(performanceSyncCronPolicy.maxRunsPerInvocation)",
  ".slice(0, performanceSyncCronPolicy.maxRunsPerInvocation)",
  'actor: "system:cron"',
  'source: "cron"',
  "allowedStatuses: [...performanceSyncCronPolicy.targetStatuses]",
  "configMissingMarksFailed: true",
  "recordCronHeartbeat",
  "heartbeatRecorded",
  "try {",
  "catch {",
  "return false;",
  "readOnly: true",
  "storedRawStats: false"
]) {
  if (!cronRouteSource.includes(requiredCronRouteGuard)) {
    failures.push(`missing performance cron route guard: ${requiredCronRouteGuard}`);
  }
}

for (const forbiddenCronRouteSurface of ['"POST"', '"PUT"', '"DELETE"', '"/api/master-reports"', '"/api/reports"']) {
  if (cronRouteSource.includes(`requestNaverSearchAd<unknown>(${forbiddenCronRouteSurface}`)) {
    failures.push(`performance cron route must not perform external write/report calls: ${forbiddenCronRouteSurface}`);
  }
}

for (const requiredQueueRouteGuard of [
  "verifyUserAccess(request, { requireAdmin: true })",
  'allowedStatuses: ["planned", "ready", "failed"]',
  'source: "manual"'
]) {
  if (!queueRouteSource.includes(requiredQueueRouteGuard)) {
    failures.push(`missing performance queue route guard: ${requiredQueueRouteGuard}`);
  }
}

for (const requiredPreviewRouteGuard of [
  "scope: preview.scope",
  "scope: input.preview.scope",
  "storedRawStats: false",
  'source: "preview"'
]) {
  if (!previewRouteSource.includes(requiredPreviewRouteGuard)) {
    failures.push(`missing performance preview route guard: ${requiredPreviewRouteGuard}`);
  }
}

const previewHistoryInsert = extractSourceBetween(previewRouteSource, ".insert({", '    .select("id")');

if (!previewHistoryInsert) {
  failures.push("missing performance preview history insert block");
} else {
  for (const forbiddenPersistedRawStats of ["stats:", "rawStats", "raw_stats", "result.data", "input.stats"]) {
    if (previewHistoryInsert.includes(forbiddenPersistedRawStats)) {
      failures.push(`performance preview history insert must not persist raw stats: ${forbiddenPersistedRawStats}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Performance safety check failed:");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log("Performance safety check passed.");

function extractSourceBetween(sourceText, start, end) {
  const startIndex = sourceText.indexOf(start);

  if (startIndex === -1) {
    return null;
  }

  const endIndex = sourceText.indexOf(end, startIndex);

  if (endIndex === -1) {
    return null;
  }

  return sourceText.slice(startIndex, endIndex);
}

function requireSourceOrder(sourceText, label, before, after) {
  const beforeIndex = sourceText.indexOf(before);
  const afterIndex = sourceText.indexOf(after);

  if (beforeIndex === -1 || afterIndex === -1 || beforeIndex > afterIndex) {
    failures.push(`${label}: ${before} must appear before ${after}`);
  }
}
