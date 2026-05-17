import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const recommendationFile = path.join(root, "lib", "performance-recommendations.ts");
const source = readFileSync(recommendationFile, "utf8");
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

if (failures.length > 0) {
  console.error("Performance safety check failed:");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log("Performance safety check passed.");
