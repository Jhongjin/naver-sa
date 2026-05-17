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

  if (relativePath === "app/api/naver/performance-sync/cron/route.ts") {
    requireSourceIncludes(source, relativePath, "authorization !== `Bearer ${cronSecret}`");
    requireSourceIncludes(source, relativePath, "heartbeatRecorded");
    requireSourceIncludes(source, relativePath, "catch {");
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

  if (relativePath === "app/api/admin/report-share-links/route.ts") {
    requireSourceIncludes(source, relativePath, "verifyUserAccess(request, { requireAdmin: true })");
    requireSourceIncludes(source, relativePath, "tokenExcluded: true");
    requireSourceIncludes(source, relativePath, "tokenHashExcluded: true");
    requireSourceIncludes(source, relativePath, "tokenAvailable: false");
    requireSourceExcludes(source, relativePath, "token_hash", "admin share-link registry must not select or expose token hashes");
    requireSourceExcludes(source, relativePath, "shareUrl", "admin share-link registry must not reconstruct public URLs");
  }

  if (relativePath === "app/api/plans/history/[planningRunId]/share-links/route.ts") {
    requireSourceIncludes(source, relativePath, "hashReportShareToken(token)");
    requireSourceIncludes(source, relativePath, "token_hash: tokenHash");
    requireSourceIncludes(source, relativePath, "tokenStored: false");
    requireSourceIncludes(source, relativePath, "tokenHashOnly: true");
    requireSourceIncludes(source, relativePath, "toSafeShareLink");
    requireSourceCount(source, relativePath, "shareUrl", 1);
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
    requireSourceIncludes(source, relativePath, 'select("id",');
    requireSourceIncludes(source, relativePath, "head: true");
    requireSourceExcludes(source, relativePath, '.select("body', "public report route must not select raw execution payload bodies");
    requireSourceExcludes(source, relativePath, "idempotency_key", "public report route must not select idempotency keys");
    requireSourceExcludes(source, relativePath, "before_value", "public report route must not expose audit before values");
    requireSourceExcludes(source, relativePath, "after_value", "public report route must not expose audit after values");
    requireSourceExcludes(source, relativePath, '.from("audit_events")', "public report route must not expose internal audit events");
  }
}

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
