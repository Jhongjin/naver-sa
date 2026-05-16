import { generatePlannerPlan, mardDefaultInput } from "@/lib/planner";
import { coercePlannerInput, readJsonRecord } from "@/lib/planner-request";
import { jsonNoStore, methodNotAllowed } from "@/lib/http";

export function GET() {
  return jsonNoStore({
    ok: true,
    plan: generatePlannerPlan(mardDefaultInput)
  });
}

export async function POST(request: Request) {
  const body = await readJsonRecord(request);
  const input = coercePlannerInput(body);

  return jsonNoStore({
    ok: true,
    plan: generatePlannerPlan(input)
  });
}

export function PATCH() {
  return methodNotAllowed(["GET", "POST"]);
}

export function PUT() {
  return methodNotAllowed(["GET", "POST"]);
}

export function DELETE() {
  return methodNotAllowed(["GET", "POST"]);
}
