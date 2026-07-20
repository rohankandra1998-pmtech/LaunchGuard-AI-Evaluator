import { ReviewWorkspace } from "@/components/review-workspace";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export default async function ReviewPage({ params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }) {
  const { workspaceSlug, projectId } = await params;
  const supabase = await createClient();
  const [{ data: testCases }, criteriaResult, { data: reviews }, { data: promptVersions }] = await Promise.all([
    supabase.from("test_cases").select("*").eq("project_id", projectId).in("status", ["generated", "reviewed"]).order("updated_at", { ascending: false }),
    supabase.from("evaluation_criteria").select("*").eq("project_id", projectId).order("sort_order").order("created_at").order("id"),
    supabase.from("human_reviews").select("*").eq("project_id", projectId),
    supabase.from("prompt_versions").select("*").eq("project_id", projectId)
  ]);
  let criteria = criteriaResult.data;
  if (criteriaResult.error?.code === "42703") {
    const fallback = await supabase.from("evaluation_criteria").select("*").eq("project_id", projectId).order("created_at").order("id");
    criteria = fallback.data?.map((criterion, index) => ({ ...criterion, sort_order: index })) || [];
  }
  const reviewIds = (reviews || []).map((review) => review.id);
  const { data: ratings } = reviewIds.length ? await supabase.from("human_review_ratings").select("*").in("review_id", reviewIds) : { data: [] };
  return <div><PageHeader eyebrow="Human review" title="Human Review">Inspect input-output pairs, rate each criterion, annotate failures, and mark outputs as reviewed.</PageHeader><ReviewWorkspace workspaceSlug={workspaceSlug} projectId={projectId} testCases={testCases || []} criteria={criteria || []} reviews={reviews || []} ratings={ratings || []} promptVersions={promptVersions || []} /></div>;
}
