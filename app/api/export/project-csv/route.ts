import { NextResponse } from "next/server";
import { getWorkspaceProject } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { todaySlug } from "@/lib/utils";

function csv(value: unknown) {
  const text = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "launchguard-project";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const workspaceSlug = searchParams.get("workspaceSlug");
    if (!projectId || !workspaceSlug) {
      return NextResponse.json({ error: "workspaceSlug and projectId are required." }, { status: 400 });
    }

    const supabase = await createClient();
    const context = await getWorkspaceProject(supabase, workspaceSlug, projectId);
    if (!context) return NextResponse.json({ error: "Project was not found in this workspace." }, { status: 404 });

    const [{ data: testCases }, { data: promptVersions }, { data: reviews }, { data: criteria }] = await Promise.all([
      supabase.from("test_cases").select("*").eq("project_id", projectId).order("created_at"),
      supabase.from("prompt_versions").select("*").eq("project_id", projectId),
      supabase.from("human_reviews").select("*").eq("project_id", projectId),
      supabase.from("evaluation_criteria").select("*").eq("project_id", projectId)
    ]);
    const reviewIds = (reviews || []).map((review) => review.id);
    const { data: ratings, error: ratingsError } = reviewIds.length
      ? await supabase.from("human_review_ratings").select("*").in("review_id", reviewIds)
      : { data: [], error: null };
    if (ratingsError) throw ratingsError;

    const promptMap = new Map((promptVersions || []).map((prompt) => [prompt.id, `v${prompt.version_number}`]));
    const reviewMap = new Map((reviews || []).map((review) => [review.test_case_id, review]));
    const criterionMap = new Map((criteria || []).map((criterion) => [criterion.id, criterion.name]));
    const ratingsByReview = new Map<string, string[]>();
    (ratings || []).forEach((rating) => {
      const label = `${criterionMap.get(rating.criterion_id) || rating.criterion_id}: ${rating.rating_label} (${rating.rating_score})`;
      ratingsByReview.set(rating.review_id, [...(ratingsByReview.get(rating.review_id) || []), label]);
    });

    const header = [
      "workspace_name", "project_name", "prompt_version", "model_used", "test_case_id", "user_input",
      "variable_values", "ai_output", "criterion_ratings", "failure_category", "severity",
      "human_notes", "review_status", "created_at", "updated_at"
    ];
    const rows = (testCases || []).map((testCase) => {
      const review = reviewMap.get(testCase.id);
      return [
        context.workspace.name,
        context.project.name,
        testCase.prompt_version_id ? promptMap.get(testCase.prompt_version_id) || "" : "",
        testCase.model_used,
        testCase.id,
        testCase.user_input,
        testCase.variable_values,
        testCase.generated_ai_output,
        review ? ratingsByReview.get(review.id)?.join("; ") : "",
        review?.failure_category,
        review?.severity,
        review?.human_notes,
        testCase.status,
        testCase.created_at,
        testCase.updated_at
      ];
    });

    const body = [header, ...rows].map((row) => row.map(csv).join(",")).join("\n");
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug(context.project.name)}-${todaySlug()}.csv"`
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
