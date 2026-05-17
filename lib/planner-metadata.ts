export type PlannerMetadata = {
  captured: boolean;
  industryTemplate: {
    name: string;
    landingChecks: string[];
    copyRules: string[];
    negativeThemes: string[];
  };
  benchmarkFeatures: Array<{
    name: string;
    status: "implemented" | "partial" | "planned";
    description: string;
  }>;
  operationRules: Array<{
    name: string;
    trigger: string;
    recommendation: string;
    automationLevel: string;
  }>;
};

export function coercePlannerMetadata(input: {
  captured: boolean;
  industryTemplate?: Record<string, unknown> | null;
  benchmarkFeatures?: unknown[] | null;
  operationRules?: unknown[] | null;
}): PlannerMetadata {
  return {
    captured: input.captured,
    industryTemplate: coerceIndustryTemplate(input.industryTemplate ?? null),
    benchmarkFeatures: coerceBenchmarkFeatures(input.benchmarkFeatures ?? []),
    operationRules: coerceOperationRules(input.operationRules ?? [])
  };
}

function coerceIndustryTemplate(value: Record<string, unknown> | null) {
  return {
    name: stringField(value?.name, "미기록"),
    landingChecks: stringArrayField(value?.landingChecks),
    copyRules: stringArrayField(value?.copyRules),
    negativeThemes: stringArrayField(value?.negativeThemes)
  };
}

function coerceBenchmarkFeatures(value: unknown[]): PlannerMetadata["benchmarkFeatures"] {
  return value.filter(isRecord).map((item) => {
    const status: PlannerMetadata["benchmarkFeatures"][number]["status"] =
      item.status === "implemented" || item.status === "partial" || item.status === "planned"
        ? item.status
        : "planned";

    return {
      name: stringField(item.name, "Unnamed feature"),
      status,
      description: stringField(item.description, "")
    };
  });
}

function coerceOperationRules(value: unknown[]) {
  return value.filter(isRecord).map((item) => ({
    name: stringField(item.name, "Unnamed rule"),
    trigger: stringField(item.trigger, ""),
    recommendation: stringField(item.recommendation, ""),
    automationLevel: stringField(item.automationLevel, "")
  }));
}

function stringField(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 240) : fallback;
}

function stringArrayField(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.slice(0, 240))
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
