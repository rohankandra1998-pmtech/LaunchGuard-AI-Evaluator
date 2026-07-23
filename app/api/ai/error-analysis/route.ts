import { NextResponse } from "next/server";
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

type TestCaseRow = Pick<TestCase, "id" | "user_input" | "case_type" | "variable_values" | "generated_ai_output">;
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
  variable_values: TestCase["variable_values"];
  generated_ai_output: TestCase["generated_ai_output"];
  human_notes: string | null;
  failed_criteria: FailedCriterionContext[];
};

function isFailedRating(rating: ReviewRatingRow): rating is ReviewRatingRow & { rating_label: FailedRatingLabel } {
  return rating.rating_score < 3 && (rating.rating_label === "Average" || rating.rating_label === "Bad");
}

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
        .select("id, user_input, case_type, variable_values, generated_ai_output")
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
        variable_values: testCase.variable_values,
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
      instructions: "Analyze the reviewed AI-output failures and return a concise structured error analysis for prompt improvement. Each test case contains only criteria rated Average or Bad. Use the Good definition as the target behavior, the Average definition as the partial-success boundary, and the Bad definition as the unacceptable behavior to avoid. Do not infer failures for criteria omitted from a test case. Ground patterns and prompt improvements in the provided failed criteria and human notes.",
      input: JSON.stringify({ project: context.project, current_prompt: currentPrompt, reviewed_failures: reviewedFailureContexts }, null, 2)
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
