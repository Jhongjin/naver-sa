import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json({
    ok: false,
    error: "This legacy operator endpoint has moved to /api/auth/session.",
    code: "OPERATOR_ENDPOINT_DEPRECATED"
  }, { status: 410 });
}
