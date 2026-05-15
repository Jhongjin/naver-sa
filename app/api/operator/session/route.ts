import { NextResponse } from "next/server";
import { verifyOperatorAccess } from "@/lib/operator-access";

export async function POST(request: Request) {
  const access = verifyOperatorAccess(request, { requireConfigured: true });

  if (!access.ok) {
    return NextResponse.json(access, { status: access.status });
  }

  return NextResponse.json({
    ok: true,
    role: access.state.role,
    mode: access.state.mode,
    capabilities: access.state.capabilities,
    session: {
      expiresInSeconds: access.state.sessionTtlSeconds,
      workspaceScope: "default"
    },
    guardrails: {
      liveCampaignActivation: "blocked",
      productionDeletion: "blocked",
      externalWriteExecution: "test-route-only"
    }
  });
}
