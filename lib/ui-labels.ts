export type ExecutionDraftStatus = "blocked" | "ready" | "executed" | "failed";

export function draftStatusClass(status: ExecutionDraftStatus | undefined) {
  if (status === "ready" || status === "executed") {
    return "include";
  }

  if (status === "blocked" || status === "failed") {
    return "review";
  }

  return "neutral";
}
