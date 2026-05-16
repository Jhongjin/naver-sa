import { verifyUserAccess } from "@/lib/auth-access";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";

export function POST() {
  return methodNotAllowed(["GET"]);
}

export async function GET(request: Request) {
  const access = await verifyUserAccess(request);

  if (!access.ok) {
    return jsonNoStore(access, { status: access.status });
  }

  return jsonNoStore({
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
