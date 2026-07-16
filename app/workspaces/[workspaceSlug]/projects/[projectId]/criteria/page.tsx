import { CriteriaWorkspace } from "@/components/criteria-workspace";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export default async function CriteriaPage({ params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }) {
  const { workspaceSlug, projectId } = await params;
  const supabase = await createClient();
  const [{ data: project }, { data: prompts }, { data: criteria }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase.from("prompt_versions").select("*").eq("project_id", projectId),
    supabase.from("evaluation_criteria").select("*").eq("project_id", projectId).order("created_at")
  ]);
  return <div><PageHeader eyebrow="Human rubric" title="Evaluation Criteria">Define Good, Average, and Bad for each criterion so reviewers score outputs consistently.</PageHeader><CriteriaWorkspace workspaceSlug={workspaceSlug} project={project} activePrompt={prompts?.find((prompt) => prompt.is_active) || null} criteria={criteria || []} /></div>;
}
