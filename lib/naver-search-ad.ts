import { createHmac } from "node:crypto";
import { redactSensitiveErrorText } from "@/lib/error-redaction";

export type NaverSearchAdConfig = {
  baseUrl: string;
  apiKey: string;
  secretKey: string;
  customerId: string;
};

export type NaverConfigState =
  | {
      ready: true;
      missing: string[];
      baseUrl: string;
      customerIdPresent: true;
    }
  | {
      ready: false;
      missing: string[];
      baseUrl: string;
      customerIdPresent: boolean;
    };

export type NaverApiResult<T> =
  | {
      ok: true;
      status: number;
      data: T;
    }
  | {
      ok: false;
      status: number;
      error: string;
      transactionId?: string;
    };

const defaultRequestTimeoutMs = 20_000;

export type NaverCampaignSummary = {
  nccCampaignId?: string;
  name?: string;
  campaignTp?: string;
  userLock?: boolean | number;
  deliveryMethod?: string;
};

export type NaverBusinessChannelSummary = {
  nccBusinessChannelId?: string;
  name?: string;
  channelTp?: string;
  businessInfo?: {
    site?: string;
    mobileSite?: string;
    [key: string]: unknown;
  };
  inspectStatus?: string;
  regTm?: string;
  editTm?: string;
};

export type NaverProductGroupSummary = {
  nccProductGroupId?: string;
  nccBusinessChannelId?: string;
  name?: string;
  registrationMethod?: string;
  registeredProductType?: string;
  mallId?: string;
  mallName?: string;
  brandNo?: string;
  brandName?: string;
  attrJson?: {
    productNvmids?: string[];
    excludeNvmids?: string[];
    prvdrId?: string;
    [key: string]: unknown;
  };
  numberOfAdgroups?: number;
  regTm?: string;
  editTm?: string;
};

const envNames = {
  apiKey: "NAVER_SEARCH_AD_API_KEY",
  secretKey: "NAVER_SEARCH_AD_SECRET_KEY",
  customerId: "NAVER_SEARCH_AD_CUSTOMER_ID",
  baseUrl: "NAVER_SEARCH_AD_BASE_URL"
} as const;

export function getNaverConfigState(): NaverConfigState {
  const missing = Object.values(envNames).filter((name) => !process.env[name]);
  const baseUrl = process.env[envNames.baseUrl] || "https://api.searchad.naver.com";
  const customerIdPresent = Boolean(process.env[envNames.customerId]);

  if (missing.length > 0) {
    return {
      ready: false,
      missing,
      baseUrl,
      customerIdPresent
    };
  }

  return {
    ready: true,
    missing: [],
    baseUrl,
    customerIdPresent: true
  };
}

export function getNaverSearchAdConfig(): NaverSearchAdConfig | null {
  const state = getNaverConfigState();

  if (!state.ready) {
    return null;
  }

  return {
    baseUrl: normalizeBaseUrl(state.baseUrl),
    apiKey: process.env[envNames.apiKey] ?? "",
    secretKey: process.env[envNames.secretKey] ?? "",
    customerId: process.env[envNames.customerId] ?? ""
  };
}

export function createNaverSignature(timestamp: string, method: string, uri: string, secretKey: string): string {
  const message = `${timestamp}.${method.toUpperCase()}.${uri}`;
  return createHmac("sha256", secretKey).update(message).digest("base64");
}

export function createNaverHeaders(method: string, uri: string, config: NaverSearchAdConfig): HeadersInit {
  const timestamp = String(Date.now());

  return {
    "Content-Type": "application/json; charset=UTF-8",
    "X-Timestamp": timestamp,
    "X-API-KEY": config.apiKey,
    "X-Customer": config.customerId,
    "X-Signature": createNaverSignature(timestamp, method, uri, config.secretKey)
  };
}

export async function requestNaverSearchAd<T>(
  method: "GET" | "POST" | "PUT",
  uri: string,
  options: {
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {}
): Promise<NaverApiResult<T>> {
  const config = getNaverSearchAdConfig();

  if (!config) {
    return {
      ok: false,
      status: 0,
      error: "Naver Search Ad API environment variables are incomplete."
    };
  }

  const url = buildUrl(config.baseUrl, uri, options.query);
  const requestSignal = createRequestSignal(options.signal, options.timeoutMs ?? defaultRequestTimeoutMs);
  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: createNaverHeaders(method, uri, config),
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: requestSignal.signal
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: formatFetchError(error, requestSignal.timedOut, options.timeoutMs ?? defaultRequestTimeoutMs)
    };
  } finally {
    requestSignal.cleanup();
  }

  const responseText = await response.text().catch(() => "");
  const transactionId = response.headers.get("x-transaction-id") ?? undefined;

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: sanitizeNaverError(responseText),
      transactionId
    };
  }

  const parsed = parseJson<T>(responseText);

  if (!parsed.ok) {
    return {
      ok: false,
      status: response.status,
      error: parsed.error,
      transactionId
    };
  }

  return {
    ok: true,
    status: response.status,
    data: parsed.data
  };
}

export async function listNaverCampaigns(recordSize = 10): Promise<NaverApiResult<NaverCampaignSummary[]>> {
  return requestNaverSearchAd<NaverCampaignSummary[]>("GET", "/ncc/campaigns", {
    query: {
      recordSize
    }
  });
}

export async function listNaverBusinessChannels(): Promise<NaverApiResult<NaverBusinessChannelSummary[]>> {
  return requestNaverSearchAd<NaverBusinessChannelSummary[]>("GET", "/ncc/channels");
}

export async function listNaverProductGroups(): Promise<NaverApiResult<NaverProductGroupSummary[]>> {
  return requestNaverSearchAd<NaverProductGroupSummary[]>("GET", "/ncc/product-groups");
}

function buildUrl(baseUrl: string, uri: string, query?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(uri, `${normalizeBaseUrl(baseUrl)}/`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function parseJson<T>(value: string): { ok: true; data: T } | { ok: false; error: string } {
  if (!value) {
    return {
      ok: true,
      data: [] as T
    };
  }

  try {
    return {
      ok: true,
      data: JSON.parse(value) as T
    };
  } catch {
    return {
      ok: false,
      error: "Naver API returned an invalid JSON response."
    };
  }
}

function sanitizeNaverError(value: string): string {
  if (!value) {
    return "Naver API request failed without response body.";
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (isRecord(parsed)) {
      const title = typeof parsed.title === "string" ? parsed.title : undefined;
      const message = typeof parsed.message === "string" ? parsed.message : undefined;
      const detail = typeof parsed.detail === "string" ? parsed.detail : undefined;
      return redactSensitiveErrorText([title, message, detail].filter(Boolean).join(" - "), "Naver API request failed.", 300);
    }
  } catch {
    return redactSensitiveErrorText(value, "Naver API request failed.", 300);
  }

  return "Naver API request failed.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createRequestSignal(externalSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const abortFromExternalSignal = () => controller.abort();

  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });
  }

  return {
    signal: controller.signal,
    get timedOut() {
      return timedOut;
    },
    cleanup() {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromExternalSignal);
    }
  };
}

function formatFetchError(error: unknown, timedOut: boolean, timeoutMs: number): string {
  if (timedOut) {
    return `Naver API request timed out after ${timeoutMs}ms.`;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return "Naver API request was aborted before completion.";
  }

  return "Naver API network request failed before a response was received.";
}
