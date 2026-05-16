import { NextResponse } from "next/server";

export function jsonNoStore<T>(body: T, init?: ResponseInit) {
  const response = NextResponse.json(body, init);

  response.headers.set("Cache-Control", "no-store");

  return response;
}
