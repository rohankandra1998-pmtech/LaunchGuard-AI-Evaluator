import { CriteriaWorkspace } from "@/components/criteria-workspace";
import { createClient } from "@/lib/supabase/server";

export default async function CriteriaPage({ params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }) {
  const { workspaceSlug, projectId } = await params;
  const supabase = await createClient();
  const [{ data: project }, { data: prompts }, criteriaResult] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase.from("prompt_versions").select("*").eq("project_id", projectId),
    supabase.from("evaluation_criteria").select("*").eq("project_id", projectId).order("sort_order").order("created_at").order("id")
  ]);
  let criteria = criteriaResult.data;
  if (criteriaResult.error?.code === "42703") {
    const fallback = await supabase.from("evaluation_criteria").select("*").eq("project_id", projectId).order("created_at").order("id");
    criteria = fallback.data?.map((criterion, index) => ({ ...criterion, sort_order: index })) || [];
  }
  return <CriteriaWorkspace workspaceSlug={workspaceSlug} project={project} activePrompt={prompts?.find((prompt) => prompt.is_active) || null} criteria={criteria || []} />;
}
