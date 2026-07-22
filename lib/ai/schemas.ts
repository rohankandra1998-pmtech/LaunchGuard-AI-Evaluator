import { z } from "zod";
import { criterionFieldLimits } from "@/lib/criteria";
import type { PromptVariable } from "@/lib/types";

export const suggestedCriterionSchema = z.object({
  name: z.string().max(criterionFieldLimits.name),
  description: z.string().max(criterionFieldLimits.description),
  good_definition: z.string().max(criterionFieldLimits.good_definition),
  average_definition: z.string().max(criterionFieldLimits.average_definition),
  bad_definition: z.string().max(criterionFieldLimits.bad_definition),
  category: z.string().max(criterionFieldLimits.category)
});

export const suggestedCriteriaSchema = z.object({
  criteria: z.array(suggestedCriterionSchema).max(3)
});

export const generatedTestCaseSchema = z.object({
  user_input: z.string().min(1),
  case_type: z.enum(["normal", "edge", "ambiguous", "missing_context", "adversarial", "tone_sensitive"]),
  variable_values: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  rationale: z.string().min(1)
});

export const generatedTestCasesSchema = z.object({
  test_cases: z.array(generatedTestCaseSchema).max(10)
});

export function generatedTestCasesSchemaForVariables(variables: PromptVariable[]) {
  const variableValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
  const variableShape = Object.fromEntries(variables.map((variable) => [variable.key, variableValueSchema]));
  return z.object({
    test_cases: z.array(generatedTestCaseSchema.extend({ variable_values: z.object(variableShape) })).max(10)
  });
}

export const errorAnalysisSchema = z.object({
  top_failure_patterns: z.array(z.string()),
  most_severe_mistakes: z.array(z.string()),
  likely_root_causes: z.array(z.string()),
  suggested_prompt_improvements: z.array(z.string()),
  recommended_rules_to_add: z.array(z.string()),
  problematic_examples: z.array(
    z.object({
      user_input: z.string(),
      output_issue: z.string(),
      severity: z.string().optional()
    })
  )
});

export const promptVNextSchema = z.object({
  improved_system_prompt: z.string(),
  change_summary: z.string(),
  added_rules: z.array(z.string()),
  changed_instructions: z.array(z.string()),
  removed_instructions: z.array(z.string())
});

export type SuggestedCriteriaResponse = z.infer<typeof suggestedCriteriaSchema>;
export type GeneratedTestCasesResponse = z.infer<typeof generatedTestCasesSchema>;
export type ErrorAnalysisResponse = z.infer<typeof errorAnalysisSchema>;
export type PromptVNextResponse = z.infer<typeof promptVNextSchema>;
