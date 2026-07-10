import { NextResponse } from "next/server";
import { errorAnalysisSchema } from "@/lib/ai/schemas";
import { runStructuredOutput } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { project_id } = await request.json();
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [{ data: project }, { data: prompt }, { data: criteria }, { data: reviews }, { data: testCases }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", project_id).eq("user_id", user.id).single(),
      supabase.from("prompt_versions").select("*").eq("project_id", project_id).eq("user_id", user.id).eq("is_active", true).single(),
      supabase.from("evaluation_criteria").select("*").eq("project_id", project_id).eq("user_id", user.id),
      supabase.from("human_reviews").select("*, human_review_ratings(*)").eq("project_id", project_id).eq("user_id", user.id),
      supabase.from("test_cases").select("*").eq("project_id", project_id).eq("user_id", user.id).eq("status", "reviewed")
    ]);

    if (!project || !prompt) return NextResponse.json({ error: "Project or active prompt version not found." }, { status: 404 });
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
      input: JSON.stringify({ project, current_prompt: prompt, criteria, reviewed_failures: reviewedFailures }, null, 2)
    });

    const { data: report, error } = await supabase
      .from("error_analysis_reports")
      .insert({ user_id: user.id, project_id, prompt_version_id: prompt.id, summary })
      .select("*")
      .single();
    if (error) throw error;

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
