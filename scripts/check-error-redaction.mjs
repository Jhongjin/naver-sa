import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const source = readFileSync("lib/error-redaction.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
}).outputText;
const cjsModule = { exports: {} };

new Function("exports", "require", "module", compiled)(cjsModule.exports, require, cjsModule);

const { redactSensitiveErrorText, redactSensitiveOptionalText } = cjsModule.exports;
const failures = [];

assertEqual(redactSensitiveErrorText(undefined, "Fallback message."), "Fallback message.", "uses fallback for empty input");
assertEqual(redactSensitiveOptionalText("   "), null, "optional text preserves null-like blank output");

const headerRedacted = redactSensitiveErrorText(
  "Request failed: Bearer abc.def-ghi authorization: Bearer raw-token, cookie: session=raw-cookie",
  "fallback"
);
assertExcludes(headerRedacted, "abc.def-ghi", "masks bearer token bodies");
assertExcludes(headerRedacted, "raw-token", "masks authorization header values");
assertExcludes(headerRedacted, "raw-cookie", "masks cookie header values");
assertIncludes(headerRedacted, "Bearer [REDACTED]", "keeps bearer redaction marker");

const queryRedacted = redactSensitiveErrorText(
  "https://example.test/callback?access_token=access-123&client_secret=secret-456&ok=true",
  "fallback"
);
assertExcludes(queryRedacted, "access-123", "masks access_token query values");
assertExcludes(queryRedacted, "secret-456", "masks client_secret query values");
assertIncludes(queryRedacted, "access_token=[REDACTED]", "keeps access_token query marker");
assertIncludes(queryRedacted, "client_secret=[REDACTED]", "keeps client_secret query marker");

const keyValueRedacted = redactSensitiveErrorText(
  "apiKey=key-123 token_hash=hash-456 customer id: 789 refresh token=refresh-000",
  "fallback"
);
assertExcludes(keyValueRedacted, "key-123", "masks API key values");
assertExcludes(keyValueRedacted, "hash-456", "masks token hash values");
assertExcludes(keyValueRedacted, "789", "masks customer id values");
assertExcludes(keyValueRedacted, "refresh-000", "masks refresh token values");

const jsonKeyRedacted = redactSensitiveErrorText(
  '{"apiKey":"key-json-123","secretKey":"secret-json-456","tokenHash":"hash-json-789","customerId":"customer-json-000","ok":true}',
  "fallback"
);
assertExcludes(jsonKeyRedacted, "key-json-123", "masks JSON apiKey values");
assertExcludes(jsonKeyRedacted, "secret-json-456", "masks JSON secretKey values");
assertExcludes(jsonKeyRedacted, "hash-json-789", "masks JSON tokenHash values");
assertExcludes(jsonKeyRedacted, "customer-json-000", "masks JSON customerId values");
assertIncludes(jsonKeyRedacted, '"apiKey": "[REDACTED]"', "keeps JSON apiKey redaction marker");

const limited = redactSensitiveErrorText("A".repeat(40), "fallback", 12);
assertEqual(limited.length, 12, "respects max length");

if (failures.length > 0) {
  console.error("Error redaction check failed:");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log("Error redaction check passed.");

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(actual, expected, label) {
  if (!actual.includes(expected)) {
    failures.push(`${label}: missing ${JSON.stringify(expected)} in ${JSON.stringify(actual)}`);
  }
}

function assertExcludes(actual, forbidden, label) {
  if (actual.includes(forbidden)) {
    failures.push(`${label}: found ${JSON.stringify(forbidden)} in ${JSON.stringify(actual)}`);
  }
}
