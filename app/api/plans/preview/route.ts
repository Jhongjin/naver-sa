import { NextResponse } from "next/server";
import { generatePlannerPlan, mardDefaultInput } from "@/lib/planner";
import { coercePlannerInput, readJsonRecord } from "@/lib/planner-request";

export function GET() {
  return NextResponse.json({
    ok: true,
    plan: generatePlannerPlan(mardDefaultInput)
  });
}

export async function POST(request: Request) {
  const body = await readJsonRecord(request);
  const input = coercePlannerInput(body);

  return NextResponse.json({
    ok: true,
    plan: generatePlannerPlan(input)
  });
}
