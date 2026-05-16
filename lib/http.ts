import { NextResponse } from "next/server";

export function jsonNoStore<T>(body: T, init?: ResponseInit) {
  const response = NextResponse.json(body, init);

  response.headers.set("Cache-Control", "no-store");

  return response;
}

export function methodNotAllowed(allowedMethods: string[]) {
  const allow = allowedMethods.join(", ");

  const response = jsonNoStore(
    {
      ok: false,
      error: `Method not allowed. Use ${allow}.`,
      code: "METHOD_NOT_ALLOWED"
    },
    {
      status: 405
    }
  );

  response.headers.set("Allow", allow);

  return response;
}
