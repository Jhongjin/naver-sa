import { NextResponse } from "next/server";
import { verifyOperatorAccess } from "@/lib/operator-access";

export async function POST(request: Request) {
  const access = verifyOperatorAccess(request, { requireConfigured: true });

  if (!access.ok) {
    return NextResponse.json(access, { status: access.status });
  }

  return NextResponse.json({
    ok: true,
    role: "operator",
    mode: access.state.mode,
    capabilities: {
      canReadAccountInventory: true,
      canSaveDraftHistory: true,
      canCreateTestEntities: false,
      canActivateLiveCampaigns: false,
      canDeleteProductionData: false
    }
  });
}
