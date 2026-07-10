import { NextResponse } from "next/server";
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
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId is required." }, { status: 400 });

  const [{ data: project }, { data: testCases }, { data: promptVersions }, { data: reviews }, { data: ratings }, { data: criteria }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).eq("user_id", user.id).single(),
    supabase.from("test_cases").select("*").eq("project_id", projectId).eq("user_id", user.id).order("created_at"),
    supabase.from("prompt_versions").select("*").eq("project_id", projectId).eq("user_id", user.id),
    supabase.from("human_reviews").select("*").eq("project_id", projectId).eq("user_id", user.id),
    supabase.from("human_review_ratings").select("*").eq("user_id", user.id),
    supabase.from("evaluation_criteria").select("*").eq("project_id", projectId).eq("user_id", user.id)
  ]);

  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const promptMap = new Map((promptVersions || []).map((prompt) => [prompt.id, `v${prompt.version_number}`]));
  const reviewMap = new Map((reviews || []).map((review) => [review.test_case_id, review]));
  const criterionMap = new Map((criteria || []).map((criterion) => [criterion.id, criterion.name]));
  const ratingsByReview = new Map<string, string[]>();
  (ratings || []).forEach((rating) => {
    const label = `${criterionMap.get(rating.criterion_id) || rating.criterion_id}: ${rating.rating_label} (${rating.rating_score})`;
    ratingsByReview.set(rating.review_id, [...(ratingsByReview.get(rating.review_id) || []), label]);
  });

  const header = [
    "project_name",
    "prompt_version",
    "model_used",
    "test_case_id",
    "user_input",
    "variable_values",
    "expected_answer",
    "ai_output",
    "criterion_ratings",
    "failure_category",
    "severity",
    "human_notes",
    "review_status",
    "created_at",
    "updated_at"
  ];

  const rows = (testCases || []).map((testCase) => {
    const review = reviewMap.get(testCase.id);
    return [
      project.name,
      testCase.prompt_version_id ? promptMap.get(testCase.prompt_version_id) || "" : "",
      testCase.model_used,
      testCase.id,
      testCase.user_input,
      testCase.variable_values,
      testCase.expected_answer,
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
      "Content-Disposition": `attachment; filename="${slug(project.name)}-${todaySlug()}.csv"`
    }
  });
}
