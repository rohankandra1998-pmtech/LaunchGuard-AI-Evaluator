import type { CaseType } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GeneratedSuggestion = {
  user_input: string;
  case_type: CaseType;
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
