import { jsonNoStore, methodNotAllowed } from "@/lib/http";

export function GET() {
  return methodNotAllowed(["POST"]);
}

export function POST() {
  return jsonNoStore({
    ok: false,
    error: "This legacy operator endpoint has moved to /api/auth/session.",
    code: "OPERATOR_ENDPOINT_DEPRECATED"
  }, { status: 410 });
}
