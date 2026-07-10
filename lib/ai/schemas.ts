import { z } from "zod";

export const suggestedCriteriaSchema = z.object({
  criteria: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      good_definition: z.string(),
      average_definition: z.string(),
      bad_definition: z.string(),
      category: z.string()
    })
  )
});

export const generatedTestCasesSchema = z.object({
  test_cases: z.array(
    z.object({
      user_input: z.string(),
      case_type: z.enum(["normal", "edge", "ambiguous", "missing_context", "adversarial", "tone_sensitive"]),
      variable_values: z.record(z.string()),
      expected_answer: z.string().optional().nullable(),
      rationale: z.string()
    })
  )
});

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
