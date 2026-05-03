export type OperatorAccessState = {
  configured: boolean;
  sameOrigin: boolean;
  mode: "operator-code" | "open-dry-run";
};

export type OperatorAccessResult =
  | {
      ok: true;
      state: OperatorAccessState;
    }
  | {
      ok: false;
      status: number;
      error: string;
      code: "ORIGIN_NOT_ALLOWED" | "OPERATOR_CODE_NOT_CONFIGURED" | "OPERATOR_CODE_REQUIRED";
      state: OperatorAccessState;
    };

type OperatorAccessOptions = {
  requireConfigured?: boolean;
};

export function verifyOperatorAccess(request: Request, options: OperatorAccessOptions = {}): OperatorAccessResult {
  const configuredCode = process.env.OPERATOR_ACCESS_CODE;
  const configured = Boolean(configuredCode);
  const sameOrigin = isSameOrigin(request);
  const state: OperatorAccessState = {
    configured,
    sameOrigin,
    mode: configured ? "operator-code" : "open-dry-run"
  };

  if (!sameOrigin) {
    return {
      ok: false,
      status: 403,
      error: "Cross-origin requests are not allowed for this endpoint.",
      code: "ORIGIN_NOT_ALLOWED",
      state
    };
  }

  if (!configured) {
    if (options.requireConfigured) {
      return {
        ok: false,
        status: 503,
        error: "OPERATOR_ACCESS_CODE must be configured before reading Naver account inventory.",
        code: "OPERATOR_CODE_NOT_CONFIGURED",
        state
      };
    }

    return {
      ok: true,
      state
    };
  }

  const providedCode = request.headers.get("x-operator-code");

  if (providedCode !== configuredCode) {
    return {
      ok: false,
      status: 401,
      error: "Operator access code is required.",
      code: "OPERATOR_CODE_REQUIRED",
      state
    };
  }

  return {
    ok: true,
    state
  };
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);
    return requestUrl.protocol === originUrl.protocol && requestUrl.host === originUrl.host;
  } catch {
    return false;
  }
}
