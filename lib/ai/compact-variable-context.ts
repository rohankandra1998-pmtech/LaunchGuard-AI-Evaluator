import type { PromptVariable } from "@/lib/types";

export type VariableContextValue = string | number | boolean | null;

export type ConfiguredVariableContext = {
  key: string;
  placeholder: string;
  description: PromptVariable["description"];
  default_value: PromptVariable["default_value"];
};

export type RuntimeVariableContext = {
  provenance: "runtime";
  uses_default_context: boolean;
  overrides: Record<string, Exclude<VariableContextValue, null>>;
  empty_variables: string[];
};

export type LegacyFallbackVariableContext = {
  provenance: "legacy_fallback";
  resolved_values: Record<string, VariableContextValue>;
};

export type CompactVariableContext = RuntimeVariableContext | LegacyFallbackVariableContext;

type VariableSchemaEntry = Pick<PromptVariable, "key" | "description" | "default_value">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRuntimeValue(value: unknown): value is Exclude<VariableContextValue, null> {
  return typeof value === "string"
    || typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value));
}

function isResolvedValue(value: unknown): value is VariableContextValue {
  return value === null || isRuntimeValue(value);
}

function legacyFallback(
  variableSchema: readonly VariableSchemaEntry[],
  variableValues: unknown
): LegacyFallbackVariableContext {
  const values = isRecord(variableValues) ? variableValues : {};
  const resolvedValues: Record<string, VariableContextValue> = {};
  const configuredKeys = new Set(variableSchema.map((variable) => variable.key));

  for (const variable of variableSchema) {
    const value = values[variable.key];
    if (isResolvedValue(value)) resolvedValues[variable.key] = value;
  }

  // Legacy rows may predate the active schema. Preserve safe historical values
  // after configured keys instead of silently dropping their runtime context.
  for (const key of Object.keys(values).filter((key) => !configuredKeys.has(key)).sort()) {
    const value = values[key];
    if (isResolvedValue(value)) resolvedValues[key] = value;
  }

  return {
    provenance: "legacy_fallback",
    resolved_values: resolvedValues
  };
}

export function configuredVariablesFromSchema(
  variableSchema: readonly VariableSchemaEntry[]
): ConfiguredVariableContext[] {
  return variableSchema.map((variable) => ({
    key: variable.key,
    placeholder: `{{${variable.key}}}`,
    description: variable.description,
    default_value: variable.default_value
  }));
}

export function compactVariableContext(
  variableSchema: readonly VariableSchemaEntry[],
  variableUsage: unknown,
  variableValues: unknown
): CompactVariableContext {
  if (!isRecord(variableUsage) || Object.keys(variableUsage).length === 0) {
    return legacyFallback(variableSchema, variableValues);
  }

  const configuredKeys = new Set(variableSchema.map((variable) => variable.key));
  if (
    configuredKeys.size !== variableSchema.length
    || Object.keys(variableUsage).some((key) => !configuredKeys.has(key))
  ) {
    return legacyFallback(variableSchema, variableValues);
  }

  const overrides: RuntimeVariableContext["overrides"] = {};
  const emptyVariables: string[] = [];

  for (const variable of variableSchema) {
    const usageEntry = variableUsage[variable.key];
    if (!isRecord(usageEntry) || !Object.hasOwn(usageEntry, "source") || !Object.hasOwn(usageEntry, "value")) {
      return legacyFallback(variableSchema, variableValues);
    }

    if (usageEntry.source === "default" && isRuntimeValue(usageEntry.value)) {
      continue;
    }
    if (usageEntry.source === "override" && isRuntimeValue(usageEntry.value)) {
      overrides[variable.key] = usageEntry.value;
      continue;
    }
    if (usageEntry.source === "empty" && usageEntry.value === null) {
      emptyVariables.push(variable.key);
      continue;
    }

    return legacyFallback(variableSchema, variableValues);
  }

  return {
    provenance: "runtime",
    uses_default_context: Object.keys(overrides).length === 0,
    overrides,
    empty_variables: emptyVariables
  };
}
