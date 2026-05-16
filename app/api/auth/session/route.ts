import { NextResponse } from "next/server";
import { verifyUserAccess } from "@/lib/auth-access";

export async function GET(request: Request) {
  const access = await verifyUserAccess(request);

  if (!access.ok) {
    return NextResponse.json(access, { status: access.status });
  }

  return NextResponse.json({
    ok: true,
    role: access.state.role,
    mode: access.state.mode,
    userId: access.state.userId,
    email: access.state.email,
    capabilities: access.state.capabilities,
    session: {
      expiresInSeconds: access.state.sessionTtlSeconds,
      workspaceScope: "authenticated"
    },
    guardrails: {
      liveCampaignActivation: "blocked",
      productionDeletion: "blocked",
      externalWriteExecution: "test-route-only"
    }
  });
}
