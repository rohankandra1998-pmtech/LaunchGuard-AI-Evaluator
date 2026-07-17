import { NextResponse } from "next/server";
import { promptVNextSchema } from "@/lib/ai/schemas";
import { getWorkspaceProject } from "@/lib/data";
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
      supabase.from("evaluation_criteria").select("*").eq("project_id", project_id),
      supabase.from("human_reviews").select("*, human_review_ratings(*)").eq("project_id", project_id),
      supabase.from("test_cases").select("*").eq("project_id", project_id).eq("status", "reviewed")
    ]);
    if (!prompt || !report) return NextResponse.json({ error: "Active prompt or error analysis report not found." }, { status: 404 });

    const reviewByCase = new Map((reviews || []).map((review) => [review.test_case_id, review]));
    const failedExamples = (testCases || [])
      .map((testCase) => ({ testCase, review: reviewByCase.get(testCase.id) }))
      .filter(({ review }) => review?.human_review_ratings?.some((rating: { rating_score: number }) => rating.rating_score < 3));

    const draft = await runStructuredOutput({
      schemaName: "prompt_v_next",
      schema: promptVNextSchema,
      instructions:
        "Create an improved system prompt from human error analysis. Preserve the product intent, add concrete rules, remove contradictions, and return structured JSON.",
      input: JSON.stringify({ current_system_prompt: prompt.system_prompt, variable_schema: prompt.variable_schema, error_analysis_summary: report.summary, failed_examples: failedExamples, evaluation_criteria: criteria }, null, 2)
    });

    return NextResponse.json(draft);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
