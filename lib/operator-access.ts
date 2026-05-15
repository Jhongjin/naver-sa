export type OperatorRole = "operator" | "open-dry-run";

export type OperatorCapabilities = {
  canReadAccountInventory: boolean;
  canSaveDraftHistory: boolean;
  canCreateTestEntities: boolean;
  canActivateLiveCampaigns: boolean;
  canDeleteProductionData: boolean;
};

export type OperatorAccessState = {
  configured: boolean;
  sameOrigin: boolean;
  mode: "operator-code" | "open-dry-run";
  role: OperatorRole;
  capabilities: OperatorCapabilities;
  sessionTtlSeconds: number;
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
  const pendingState = createOperatorAccessState({
    configured,
    sameOrigin,
    verified: false
  });

  if (!sameOrigin) {
    return {
      ok: false,
      status: 403,
      error: "Cross-origin requests are not allowed for this endpoint.",
      code: "ORIGIN_NOT_ALLOWED",
      state: pendingState
    };
  }

  if (!configured) {
    if (options.requireConfigured) {
      return {
        ok: false,
        status: 503,
        error: "OPERATOR_ACCESS_CODE must be configured before reading Naver account inventory.",
        code: "OPERATOR_CODE_NOT_CONFIGURED",
        state: pendingState
      };
    }

    return {
      ok: true,
      state: pendingState
    };
  }

  const providedCode = request.headers.get("x-operator-code");

  if (providedCode !== configuredCode) {
    return {
      ok: false,
      status: 401,
      error: "Operator access code is required.",
      code: "OPERATOR_CODE_REQUIRED",
      state: pendingState
    };
  }

  return {
    ok: true,
    state: createOperatorAccessState({
      configured,
      sameOrigin,
      verified: true
    })
  };
}

export function createOperatorAccessState(input: {
  configured: boolean;
  sameOrigin: boolean;
  verified: boolean;
}): OperatorAccessState {
  const mode = input.configured ? "operator-code" : "open-dry-run";
  const role: OperatorRole = input.configured && input.verified ? "operator" : "open-dry-run";

  return {
    configured: input.configured,
    sameOrigin: input.sameOrigin,
    mode,
    role,
    capabilities: getOperatorCapabilities(role),
    sessionTtlSeconds: role === "operator" ? 60 * 60 * 8 : 0
  };
}

export function getOperatorCapabilities(role: OperatorRole): OperatorCapabilities {
  if (role === "operator") {
    return {
      canReadAccountInventory: true,
      canSaveDraftHistory: true,
      canCreateTestEntities: false,
      canActivateLiveCampaigns: false,
      canDeleteProductionData: false
    };
  }

  return {
    canReadAccountInventory: false,
    canSaveDraftHistory: false,
    canCreateTestEntities: false,
    canActivateLiveCampaigns: false,
    canDeleteProductionData: false
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
