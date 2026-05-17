import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const recommendationFile = path.join(root, "lib", "performance-recommendations.ts");
const source = readFileSync(recommendationFile, "utf8");
const performanceSyncSource = readFileSync(path.join(root, "lib", "naver-performance-sync.ts"), "utf8");
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
