import { NextResponse } from "next/server";
import { errorAnalysisSchema } from "@/lib/ai/schemas";
import { getWorkspaceProject } from "@/lib/data";
import { runStructuredOutput } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";
import { revalidateProjectActivityPaths } from "@/lib/revalidation";

export async function POST(request: Request) {
  try {
    const { workspace_slug, project_id } = await request.json();
    const supabase = await createClient();
    const context = await getWorkspaceProject(supabase, workspace_slug, project_id);
    if (!context) return NextResponse.json({ error: "Project was not found in this workspace." }, { status: 404 });

    const [{ data: prompt, error: promptError }, { data: criteria }, { data: reviews }, { data: testCases }] = await Promise.all([
      supabase.from("prompt_versions").select("*").eq("project_id", project_id).eq("is_active", true).maybeSingle(),
      supabase.from("evaluation_criteria").select("*").eq("project_id", project_id).order("sort_order").order("created_at").order("id"),
      supabase.from("human_reviews").select("*, human_review_ratings(*)").eq("project_id", project_id),
      supabase.from("test_cases").select("*").eq("project_id", project_id).eq("status", "reviewed")
    ]);
    if (promptError) throw promptError;
    if (!prompt) return NextResponse.json({ error: "Active prompt version not found." }, { status: 404 });

    const reviewByCase = new Map((reviews || []).map((review) => [review.test_case_id, review]));
    const reviewedFailures = (testCases || [])
      .map((testCase) => ({ testCase, review: reviewByCase.get(testCase.id) }))
      .filter(({ review }) => review && review.human_review_ratings?.some((rating: { rating_score: number }) => rating.rating_score < 3));
    if (!reviewedFailures.length) {
      return NextResponse.json({ error: "No reviewed failed or average test cases found." }, { status: 400 });
    }

    const summary = await runStructuredOutput({
      schemaName: "error_analysis",
      schema: errorAnalysisSchema,
      instructions: "Analyze reviewed AI output failures and return a concise structured error analysis for prompt improvement.",
      input: JSON.stringify({ project: context.project, current_prompt: prompt, criteria, reviewed_failures: reviewedFailures }, null, 2)
    });
    const { data: report, error } = await supabase
      .from("error_analysis_reports")
      .insert({ project_id, prompt_version_id: prompt.id, summary })
      .select("*")
      .single();
    if (error) throw error;

    revalidateProjectActivityPaths(workspace_slug, project_id, "/reports");
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
