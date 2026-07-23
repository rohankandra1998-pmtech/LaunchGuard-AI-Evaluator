import { NextResponse } from "next/server";
import { promptVNextSchema } from "@/lib/ai/schemas";
import { getNextPromptVersionNumber, getWorkspaceProject } from "@/lib/data";
import { runStructuredOutput } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { workspace_slug, project_id } = await request.json();
    const supabase = await createClient();
    const context = await getWorkspaceProject(supabase, workspace_slug, project_id);
    if (!context) return NextResponse.json({ error: "Project was not found in this workspace." }, { status: 404 });

    const [{ data: prompt }, { data: report }, { data: criteria }, { data: reviews }, { data: testCases }] = await Promise.all([
      supabase.from("prompt_versions").select("*").eq("project_id", project_id).eq("is_active", true).maybeSingle(),
      supabase.from("error_analysis_reports").select("*").eq("project_id", project_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("evaluation_criteria").select("*").eq("project_id", project_id).order("sort_order").order("created_at").order("id"),
      supabase.from("human_reviews").select("*, human_review_ratings(*)").eq("project_id", project_id),
      supabase.from("test_cases").select("*").eq("project_id", project_id).eq("status", "reviewed")
    ]);
    if (!prompt) return NextResponse.json({ error: "An active prompt version is required before creating Prompt vNext." }, { status: 404 });
    if (!report) return NextResponse.json({ error: "Generate an Error Analysis report before creating Prompt vNext." }, { status: 404 });

    const reviewByCase = new Map((reviews || []).map((review) => [review.test_case_id, review]));
    const failedExamples = (testCases || [])
      .map((testCase) => ({ testCase, review: reviewByCase.get(testCase.id) }))
      .filter(({ review }) => review?.human_review_ratings?.some((rating: { rating_score: number }) => rating.rating_score < 3));

    const proposal = await runStructuredOutput({
      schemaName: "prompt_v_next",
      schema: promptVNextSchema,
      instructions: `Create an improved, complete system prompt from the human Error Analysis and return the requested structured JSON.

Ground every change in the Error Analysis recommendations, failure patterns, evidence examples, evaluation criteria, failed human-reviewed examples, current system prompt, and variable schema. For structured reports, use recommended_prompt_changes and each exact_prompt_instruction as the primary guidance. For legacy reports, treat the available failure, root-cause, improvement, rule, and example sections as equivalent guidance.

Preserve the product intent, preserve every configured variable placeholder exactly, preserve unrelated correct instructions, and avoid silently deleting useful instructions. Resolve contradictions instead of stacking conflicting rules. Return the entire improved prompt, not a patch.

Represent every material modification with one change_annotations entry. Consolidate annotations that describe the same underlying modification and do not create separate annotations for trivial wording edits. Each before_text must be a short, smallest-useful contiguous excerpt copied verbatim from current_system_prompt. Each after_text must be copied verbatim from improved_system_prompt. Never paraphrase excerpts. Use null before_text only for entirely new content and null after_text only for removed content.

Only use pattern IDs, test-case IDs, and criterion names present in the supplied input. Do not invent supporting evidence. Explain the expected behavioral improvement in expected_impact rather than merely saying the prompt is better.`,
      input: JSON.stringify({ current_system_prompt: prompt.system_prompt, variable_schema: prompt.variable_schema, error_analysis_summary: report.summary, failed_examples: failedExamples, evaluation_criteria: criteria }, null, 2)
    });

    const proposedVersionNumber = await getNextPromptVersionNumber(supabase, project_id);

    return NextResponse.json({
      source_prompt: {
        id: prompt.id,
        version_number: prompt.version_number,
        system_prompt: prompt.system_prompt
      },
      proposed_version_number: proposedVersionNumber,
      source_report: {
        id: report.id,
        summary: report.summary
      },
      failed_test_case_count: failedExamples.length,
      proposal
    });
  } catch (error) {
    console.error("Prompt vNext generation failed", error);
    return NextResponse.json({ error: "Could not generate the Prompt vNext proposal. Please try again." }, { status: 500 });
  }
}
