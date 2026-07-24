import { NextResponse } from "next/server";
import {
  compactVariableContext,
  configuredVariablesFromSchema,
  type CompactVariableContext
} from "@/lib/ai/compact-variable-context";
import { errorAnalysisSchema } from "@/lib/ai/schemas";
import { getWorkspaceProject } from "@/lib/data";
import { runStructuredOutput } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";
import { revalidateProjectActivityPaths } from "@/lib/revalidation";
import type { EvaluationCriterion, HumanReview, HumanReviewRating, PromptVersion, RatingLabel, TestCase } from "@/lib/types";

type CriterionRow = Pick<
  EvaluationCriterion,
  "id" | "name" | "description" | "good_definition" | "average_definition" | "bad_definition" | "category" | "sort_order"
>;

type ReviewRatingRow = Pick<HumanReviewRating, "criterion_id" | "rating_label" | "rating_score">;

type ReviewRow = Pick<HumanReview, "test_case_id" | "human_notes"> & {
  human_review_ratings: ReviewRatingRow[] | null;
};

type TestCaseRow = Pick<TestCase, "id" | "user_input" | "case_type" | "variable_values" | "variable_usage" | "generated_ai_output">;
type PromptRow = Pick<PromptVersion, "id" | "system_prompt" | "variable_schema">;
type FailedRatingLabel = Exclude<RatingLabel, "Good">;

type FailedCriterionContext = {
  criterion_id: string;
  criterion_name: string;
  criterion_description: string;
  rating: FailedRatingLabel;
  good_definition: string;
  average_definition: string;
  bad_definition: string;
};

type ReviewedFailureContext = {
  test_case_id: string;
  user_input: string;
  case_type: TestCase["case_type"];
  variable_context: CompactVariableContext;
  generated_ai_output: TestCase["generated_ai_output"];
  human_notes: string | null;
  failed_criteria: FailedCriterionContext[];
};

function isFailedRating(rating: ReviewRatingRow): rating is ReviewRatingRow & { rating_label: FailedRatingLabel } {
  return rating.rating_score < 3 && (rating.rating_label === "Average" || rating.rating_label === "Bad");
}

const ERROR_ANALYSIS_INSTRUCTIONS = `
Create a concise, decision-ready structured error analysis grounded only in the supplied reviewed failures.

Executive summary:
- Summarize the most important findings without generic statements such as "the prompt could be improved."
- Set analyzed_test_case_count to the number of supplied reviewed failure cases.
- Count high-severity patterns and identify the highest-priority pattern by pattern_id, or use null when none exists.

Failure patterns:
- Consolidate semantically similar failures; do not repeat one underlying issue under different wording.
- Use short stable pattern_id values such as unsupported_action_claims or missing_policy_guidance.
- Use only supplied test-case IDs and criteria. Count unique affected test cases, not failed ratings.
- Sort by severity first, then frequency. Separate what happened from the likely root cause, and do not blame the prompt without evidence.
- Use high for materially misleading, unsafe, policy-breaking, capability-misrepresenting, or repeatedly Bad failures; medium for meaningful correctness or usefulness failures; and low for limited, isolated weaknesses.

Recommended prompt changes:
- Reference at least one valid pattern_id, consolidate overlapping fixes, and sort by priority.
- Provide a concrete, copy-ready exact_prompt_instruction rather than vague advice such as "be more accurate."
- Preserve the product intent and all variable placeholders. Do not repeat the full failure description in the recommendation.

Evidence:
- Include only representative supplied cases and a focused AI-output excerpt rather than an unnecessarily long response.
- Include the supplied failed criterion names, human-selected ratings, and human notes; use null when notes are absent.
- Explain failure relative to the supplied criterion definitions. Never invent notes, ratings, criteria, inputs, outputs, or IDs.

Grounding:
- Only Average and Bad criteria are failures. Good is the target, Average is the partial-success boundary, and Bad is unacceptable.
- Do not infer failures for omitted criteria. Human ratings are the source of truth, human notes are supporting evidence, and every claim must be supported by supplied cases.
- Treat configured_variables defaults as shared baseline context for every failure.
- In variable_context, provenance "runtime" means stored generation-time provenance was available. uses_default_context true means the case supplied no custom overrides, even when empty_variables is non-empty. overrides replace the corresponding configured defaults only for that case, and empty_variables were empty at runtime.
- provenance "legacy_fallback" means reliable runtime provenance was unavailable; resolved_values contains the full available runtime context for that case.
- Distinguish failures under baseline defaults from failures associated with case-specific overrides or empty context. Do not generalize an override into a configured default.
`.trim();

export async function POST(request: Request) {
  try {
    const { workspace_slug, project_id } = await request.json();
    const supabase = await createClient();
    const context = await getWorkspaceProject(supabase, workspace_slug, project_id);
    if (!context) return NextResponse.json({ error: "Project was not found in this workspace." }, { status: 404 });

    const [{ data: prompt, error: promptError }, { data: criteria }, { data: reviews }, { data: testCases }] = await Promise.all([
      supabase.from("prompt_versions").select("id, system_prompt, variable_schema").eq("project_id", project_id).eq("is_active", true).maybeSingle(),
      supabase
        .from("evaluation_criteria")
        .select("id, name, description, good_definition, average_definition, bad_definition, category, sort_order")
        .eq("project_id", project_id)
        .order("sort_order")
        .order("id"),
      supabase
        .from("human_reviews")
        .select("test_case_id, human_notes, human_review_ratings(criterion_id, rating_label, rating_score)")
        .eq("project_id", project_id),
      supabase
        .from("test_cases")
        .select("id, user_input, case_type, variable_values, variable_usage, generated_ai_output")
        .eq("project_id", project_id)
        .eq("status", "reviewed")
    ]);
    if (promptError) throw promptError;
    if (!prompt) return NextResponse.json({ error: "Active prompt version not found." }, { status: 404 });

    const currentPrompt = prompt as PromptRow;
    const criterionById = new Map(((criteria as CriterionRow[] | null) || []).map((criterion) => [criterion.id, criterion]));
    const reviewByCase = new Map(((reviews as ReviewRow[] | null) || []).map((review) => [review.test_case_id, review]));
    const reviewedFailureContexts: ReviewedFailureContext[] = ((testCases as TestCaseRow[] | null) || []).flatMap((testCase) => {
      const review = reviewByCase.get(testCase.id);
      if (!review) return [];

      const failedCriteria = (review.human_review_ratings || [])
        .filter(isFailedRating)
        .flatMap((rating) => {
          const criterion = criterionById.get(rating.criterion_id);
          if (!criterion) return [];

          return [{
            context: {
              criterion_id: criterion.id,
              criterion_name: criterion.name,
              criterion_description: criterion.description,
              rating: rating.rating_label,
              good_definition: criterion.good_definition,
              average_definition: criterion.average_definition,
              bad_definition: criterion.bad_definition
            },
            sortOrder: criterion.sort_order
          }];
        })
        .sort((left, right) => left.sortOrder - right.sortOrder || left.context.criterion_id.localeCompare(right.context.criterion_id))
        .map(({ context: failedCriterion }) => failedCriterion);

      if (!failedCriteria.length) return [];

      return [{
        test_case_id: testCase.id,
        user_input: testCase.user_input,
        case_type: testCase.case_type,
        variable_context: compactVariableContext(
          currentPrompt.variable_schema,
          testCase.variable_usage,
          testCase.variable_values
        ),
        generated_ai_output: testCase.generated_ai_output,
        human_notes: review.human_notes,
        failed_criteria: failedCriteria
      }];
    });
    if (!reviewedFailureContexts.length) {
      return NextResponse.json({ error: "No reviewed failed or average test cases found." }, { status: 400 });
    }

    const summary = await runStructuredOutput({
      schemaName: "error_analysis",
      schema: errorAnalysisSchema,
      instructions: ERROR_ANALYSIS_INSTRUCTIONS,
      input: JSON.stringify({
        project: context.project,
        current_prompt: {
          id: currentPrompt.id,
          system_prompt: currentPrompt.system_prompt
        },
        configured_variables: configuredVariablesFromSchema(currentPrompt.variable_schema),
        reviewed_failures: reviewedFailureContexts
      }, null, 2)
    });
    const { data: report, error } = await supabase
      .from("error_analysis_reports")
      .insert({ project_id, prompt_version_id: currentPrompt.id, summary })
      .select("*")
      .single();
    if (error) throw error;

    revalidateProjectActivityPaths(workspace_slug, project_id, "/reports");
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
