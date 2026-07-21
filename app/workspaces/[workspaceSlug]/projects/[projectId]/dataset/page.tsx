import { DatasetWorkspace } from "@/components/dataset-workspace";
import { notFound } from "next/navigation";
import { getProductModel, getReasoningModel } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";

export default async function DatasetPage({ params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }) {
  const { workspaceSlug, projectId } = await params;
  const supabase = await createClient();
  const [{ data: project }, { data: prompts }, criteriaResult, { data: testCases }, { data: reviews }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase.from("prompt_versions").select("*").eq("project_id", projectId).order("version_number"),
    supabase.from("evaluation_criteria").select("*").eq("project_id", projectId).order("sort_order").order("created_at").order("id"),
    supabase.from("test_cases").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("human_reviews").select("*").eq("project_id", projectId)
  ]);
  if (!project) notFound();

  let criteria = criteriaResult.data;
  if (criteriaResult.error?.code === "42703") {
    const fallback = await supabase.from("evaluation_criteria").select("*").eq("project_id", projectId).order("created_at").order("id");
    criteria = fallback.data?.map((criterion, index) => ({ ...criterion, sort_order: index })) || [];
  }

  const reviewIds = (reviews || []).map((review) => review.id);
  const { data: ratings } = reviewIds.length
    ? await supabase.from("human_review_ratings").select("*").in("review_id", reviewIds)
    : { data: [] };

  return (
    <DatasetWorkspace
      workspaceSlug={workspaceSlug}
      project={project}
      promptVersions={prompts || []}
      criteria={criteria || []}
      testCases={testCases || []}
      reviews={reviews || []}
      ratings={ratings || []}
      supportedModels={[...new Set([getProductModel(), getReasoningModel()])]}
    />
  );
}
