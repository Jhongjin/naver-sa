import { createHash, randomBytes } from "node:crypto";

const tokenPattern = /^[A-Za-z0-9_-]{32,160}$/;
const defaultExpiryDays = 7;
const maxExpiryDays = 30;
const minExpiryDays = 1;

export const reportShareLinksTable = "report_share_links";

export function createReportShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashReportShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isValidReportShareToken(token: string): boolean {
  return tokenPattern.test(token);
}

export function coerceReportShareExpiryDays(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultExpiryDays;
  }

  return Math.min(maxExpiryDays, Math.max(minExpiryDays, Math.floor(value)));
}

export function getReportShareExpiryDate(expiresInDays: number): Date {
  return new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
}

export function isReportShareExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

export function isMissingReportShareTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  const message = error?.message ?? "";

  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    (message.includes(reportShareLinksTable) && /does not exist|schema cache/i.test(message))
  );
}

export function sanitizeShareError(message: string | undefined): string {
  return message
    ?.replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]")
    .replace(/apikey[=:]\s*[^,\s}]+/gi, "apikey=[REDACTED]")
    .slice(0, 220) ?? "Report share request failed.";
}
