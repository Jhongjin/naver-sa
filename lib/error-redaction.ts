export function redactSensitiveErrorText(
  message: string | null | undefined,
  fallback: string,
  maxLength = 220
): string {
  const trimmed = message?.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [REDACTED]")
    .replace(
      /([?&](?:access_token|refresh_token|token|api_key|apikey|secret|client_secret)=)[^&\s]+/gi,
      "$1[REDACTED]"
    )
    .replace(
      /\b(api[-_ ]?key|apikey|x-api-key|secret[-_ ]?key|client[-_ ]?secret|access[-_ ]?token|refresh[-_ ]?token|token_hash|customer[-_ ]?id)[=:]\s*["']?[^"',\s}]+/gi,
      "$1=[REDACTED]"
    )
    .replace(/\b(authorization|cookie):\s*[^,\n]+/gi, "$1: [REDACTED]")
    .slice(0, maxLength);
}

export function redactSensitiveOptionalText(value: string | null | undefined, maxLength = 220): string | null {
  return value?.trim() ? redactSensitiveErrorText(value, "", maxLength) : null;
}
