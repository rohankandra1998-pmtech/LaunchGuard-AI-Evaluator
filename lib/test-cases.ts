import type { CaseType, PromptVariable } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TestCaseVariableValue = string | number | boolean | null;

export type GeneratedSuggestion = {
  user_input: string;
  case_type: CaseType;
  variable_values: Record<string, TestCaseVariableValue>;
  rationale: string;
};

export function normalizeTestCaseInput(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .replace(/[?.!]+$/gu, "")
    .trim();
}

function fallbackValue(variable: PromptVariable): TestCaseVariableValue {
  if (variable.default_value !== null) return variable.default_value;
  return variable.type === "text" || variable.type === "long_text" || variable.type === "select" ? "" : null;
}

function isCompatibleValue(variable: PromptVariable, value: unknown): value is TestCaseVariableValue {
  if (value === null) return !variable.required;
  if (variable.type === "number") return typeof value === "number" && Number.isFinite(value);
  if (variable.type === "boolean") return typeof value === "boolean";
  if (variable.type === "select") return typeof value === "string" && variable.options.includes(value);
  return typeof value === "string";
}

export function prepareSuggestionVariableValues(
  schema: PromptVariable[],
  values: Record<string, unknown>
): Record<string, TestCaseVariableValue> {
  return Object.fromEntries(schema.map((variable) => {
    const value = values[variable.key];
    return [variable.key, isCompatibleValue(variable, value) ? value : fallbackValue(variable)];
  }));
}

export function uniqueGeneratedSuggestions(
  suggestions: GeneratedSuggestion[],
  existingInputs: string[],
  limit = 10
) {
  const seen = new Set(existingInputs.map(normalizeTestCaseInput).filter(Boolean));
  const unique: GeneratedSuggestion[] = [];

  for (const suggestion of suggestions) {
    const normalized = normalizeTestCaseInput(suggestion.user_input);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(suggestion);
    if (unique.length === limit) break;
  }

  return unique;
}

export async function fetchAllTestCaseInputs(supabase: SupabaseClient, projectId: string) {
  const pageSize = 1000;
  const inputs: string[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("test_cases")
      .select("user_input")
      .eq("project_id", projectId)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    inputs.push(...(data || []).map((row) => row.user_input));
    if ((data || []).length < pageSize) return inputs;
  }
}
