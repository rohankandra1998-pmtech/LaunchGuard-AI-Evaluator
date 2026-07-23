import { z } from "zod";
import { criterionFieldLimits } from "@/lib/criteria";

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

export const GENERATED_TEST_CASE_RATIONALE_MAX_LENGTH = 180;

export const generatedTestCaseSchema = z.object({
  user_input: z.string().min(1).max(500),
  case_type: z.enum(["normal", "edge", "ambiguous", "missing_context", "adversarial", "tone_sensitive"]),
  rationale: z
    .string()
    .min(1)
    .max(GENERATED_TEST_CASE_RATIONALE_MAX_LENGTH)
});

export const generatedTestCasesSchema = z.object({
  test_cases: z.array(generatedTestCaseSchema).max(10)
});

export const errorAnalysisSchema = z.object({
  executive_summary: z.object({
    overview: z.string().min(1).max(1200),
    analyzed_test_case_count: z.number().int().nonnegative(),
    high_severity_pattern_count: z.number().int().nonnegative(),
    highest_priority_pattern_id: z.string().min(1).max(80).nullable()
  }),
  failure_patterns: z.array(
    z.object({
      pattern_id: z.string().min(1).max(80),
      title: z.string().min(1).max(160),
      what_happened: z.string().min(1).max(1600),
      affected_test_case_count: z.number().int().positive(),
      affected_test_case_ids: z.array(z.string().min(1)).min(1).max(20),
      severity: z.enum(["high", "medium", "low"]),
      affected_criteria: z.array(z.string().min(1).max(160)).min(1).max(12),
      likely_root_cause: z.string().min(1).max(1600)
    })
  ).min(1).max(5),
  recommended_prompt_changes: z.array(
    z.object({
      change_id: z.string().min(1).max(80),
      related_pattern_ids: z.array(z.string().min(1).max(80)).min(1).max(5),
      priority: z.enum(["high", "medium", "low"]),
      change_type: z.enum(["add", "change", "remove"]),
      recommendation: z.string().min(1).max(1200),
      rationale: z.string().min(1).max(1600),
      exact_prompt_instruction: z.string().min(1).max(2400)
    })
  ).min(1).max(8),
  evidence_examples: z.array(
    z.object({
      test_case_id: z.string().min(1),
      related_pattern_ids: z.array(z.string().min(1).max(80)).min(1).max(5),
      user_input: z.string().min(1).max(2000),
      ai_output_excerpt: z.string().min(1).max(2400),
      failed_criteria: z.array(
        z.object({
          criterion_name: z.string().min(1).max(160),
          rating: z.enum(["Average", "Bad"])
        })
      ).min(1).max(12),
      human_notes: z.string().min(1).max(2000).nullable(),
      why_it_failed: z.string().min(1).max(1600)
    })
  ).min(1).max(6)
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
