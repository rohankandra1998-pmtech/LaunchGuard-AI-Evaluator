import { NextResponse } from "next/server";
import { promptVNextSchema } from "@/lib/ai/schemas";
import { getNextPromptVersionNumber, getWorkspaceProject } from "@/lib/data";
import { runStructuredOutput } from "@/lib/openai";
import { promptProposalResponseSchema } from "@/lib/prompt-proposal-drafts";
import { createClient } from "@/lib/supabase/server";
import type {
  EvaluationCriterion,
  HumanReview,
  HumanReviewRating,
  PromptVariable,
  PromptVersion,
  RatingLabel,
  TestCase
} from "@/lib/types";

type PromptRow = Pick<PromptVersion, "id" | "version_number" | "system_prompt" | "variable_schema">;
type TestCaseRow = Pick<TestCase, "id" | "user_input" | "case_type" | "variable_values" | "generated_ai_output">;
type ReviewRatingRow = Pick<HumanReviewRating, "criterion_id" | "rating_label" | "rating_score">;
type ReviewRow = Pick<HumanReview, "test_case_id" | "human_notes"> & {
  human_review_ratings: ReviewRatingRow[] | null;
};
type FailedRatingLabel = Exclude<RatingLabel, "Good">;

type ConfiguredVariable = {
  placeholder: string;
  description: PromptVariable["description"];
  default_value: PromptVariable["default_value"];
};

type CompactFailedExample = {
  test_case_id: string;
  user_input: string;
  case_type: TestCase["case_type"];
  variable_values: TestCase["variable_values"];
  ai_output: string | null;
  human_notes: string | null;
  failed_ratings: Array<{
    criterion_name: string;
    rating: FailedRatingLabel;
  }>;
  passed_criteria: string[];
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

    const [{ data: prompt }, { data: report }, { data: criteria }, { data: reviews }, { data: testCases }] = await Promise.all([
      supabase
        .from("prompt_versions")
        .select("id, version_number, system_prompt, variable_schema")
        .eq("project_id", project_id)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("error_analysis_reports")
        .select("id, summary")
        .eq("project_id", project_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("evaluation_criteria").select("*").eq("project_id", project_id).order("sort_order").order("created_at").order("id"),
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
    if (!prompt) return NextResponse.json({ error: "An active prompt version is required before creating Prompt vNext." }, { status: 404 });
    if (!report) return NextResponse.json({ error: "Generate an Error Analysis report before creating Prompt vNext." }, { status: 404 });

    const currentPrompt = prompt as PromptRow;
    const orderedCriteria = (criteria as EvaluationCriterion[] | null) || [];
    const reviewByCase = new Map(((reviews as ReviewRow[] | null) || []).map((review) => [review.test_case_id, review]));
    const configuredVariables: ConfiguredVariable[] = currentPrompt.variable_schema.map((variable) => ({
      placeholder: `{{${variable.key}}}`,
      description: variable.description,
      default_value: variable.default_value
    }));
    const compactFailedExamples: CompactFailedExample[] = ((testCases as TestCaseRow[] | null) || []).flatMap((testCase) => {
      const review = reviewByCase.get(testCase.id);
      const ratings = review?.human_review_ratings || [];
      if (!review || !ratings.some((rating) => rating.rating_score < 3)) return [];

      const orderedResolvedRatings = orderedCriteria.flatMap((criterion) =>
        ratings
          .filter((rating) => rating.criterion_id === criterion.id)
          .map((rating) => ({ criterion, rating }))
      );

      return [{
        test_case_id: testCase.id,
        user_input: testCase.user_input,
        case_type: testCase.case_type,
        variable_values: testCase.variable_values,
        ai_output: testCase.generated_ai_output,
        human_notes: review.human_notes,
        failed_ratings: orderedResolvedRatings.flatMap(({ criterion, rating }) => {
          if (!isFailedRating(rating)) return [];

          return [{
            criterion_name: criterion.name,
            rating: rating.rating_label
          }];
        }),
        passed_criteria: orderedResolvedRatings
          .filter(({ rating }) => rating.rating_label === "Good")
          .map(({ criterion }) => criterion.name)
      }];
    });

    const proposal = await runStructuredOutput({
      schemaName: "prompt_v_next",
      schema: promptVNextSchema,
      instructions: `Create an improved, complete system prompt from the human Error Analysis and return the requested structured JSON.

Ground every change in the Error Analysis recommendations, failure patterns, evidence examples, evaluation criteria, failed human-reviewed examples, current system prompt, and configured variables. For structured reports, use recommended_prompt_changes and each exact_prompt_instruction as the primary guidance. For legacy reports, treat the available failure, root-cause, improvement, rule, and example sections as equivalent guidance.

Preserve the product intent, preserve every supplied configured placeholder exactly as written, preserve unrelated correct instructions, and avoid silently deleting useful instructions. Configured variable descriptions and defaults provide context only: never rename a placeholder or replace it with a hardcoded default value. Resolve contradictions instead of stacking conflicting rules. Return the entire improved prompt, not a patch.

Represent every material modification with one change_annotations entry. Consolidate annotations that describe the same underlying modification and do not create separate annotations for trivial wording edits. Each before_text must be a short, smallest-useful contiguous excerpt copied verbatim from current_system_prompt. Each after_text must be copied verbatim from improved_system_prompt. Never paraphrase excerpts. Use null before_text only for entirely new content and null after_text only for removed content.

Only use pattern IDs, test-case IDs, and criterion names present in the supplied input. Do not invent supporting evidence. Explain the expected behavioral improvement in expected_impact rather than merely saying the prompt is better.`,
      input: JSON.stringify({
        current_system_prompt: currentPrompt.system_prompt,
        configured_variables: configuredVariables,
        error_analysis_summary: report.summary,
        failed_examples: compactFailedExamples,
        evaluation_criteria: orderedCriteria
      }, null, 2)
    });

    const proposedVersionNumber = await getNextPromptVersionNumber(supabase, project_id);

    const sourcePromptSnapshot = {
      id: currentPrompt.id,
      version_number: currentPrompt.version_number,
      system_prompt: currentPrompt.system_prompt
    };
    const sourceReportSnapshot = {
      id: report.id,
      summary: report.summary
    };
    const { data: persistedDraft, error: persistenceError } = await supabase
      .from("prompt_proposal_drafts")
      .upsert(
        {
          project_id,
          source_prompt_version_id: currentPrompt.id,
          source_error_analysis_report_id: report.id,
          source_prompt_snapshot: sourcePromptSnapshot,
          source_report_snapshot: sourceReportSnapshot,
          proposal,
          current_proposed_prompt: proposal.improved_system_prompt,
          failed_test_case_count: compactFailedExamples.length
        },
        { onConflict: "project_id" }
      )
      .select("id")
      .single();
    if (persistenceError || !persistedDraft) {
      console.error("Prompt Proposal draft persistence failed", {
        projectId: project_id,
        promptVersionId: currentPrompt.id,
        reportId: report.id,
        error: persistenceError
      });
      return NextResponse.json(
        { error: "The Prompt Proposal was generated but could not be saved. Please retry." },
        { status: 500 }
      );
    }

    const response = promptProposalResponseSchema.parse({
      draft_id: persistedDraft.id,
      source_prompt: {
        ...sourcePromptSnapshot
      },
      proposed_version_number: proposedVersionNumber,
      source_report: sourceReportSnapshot,
      failed_test_case_count: compactFailedExamples.length,
      proposal,
      current_proposed_prompt: proposal.improved_system_prompt
    });
    return NextResponse.json(response);
  } catch (error) {
    console.error("Prompt vNext generation failed", error);
    return NextResponse.json({ error: "Could not generate the Prompt vNext proposal. Please try again." }, { status: 500 });
  }
}
