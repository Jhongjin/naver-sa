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
