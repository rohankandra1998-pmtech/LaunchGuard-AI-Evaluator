import { notFound } from "next/navigation";
import { ButtonLink, Card, PageHeader, StatCard } from "@/components/ui";
import { ProjectActionsMenu } from "@/components/project-actions-menu";
import { getWorkspaceProject, projectPath } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectPage({ params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }) {
  const { workspaceSlug, projectId } = await params;
  const supabase = await createClient();
  const context = await getWorkspaceProject(supabase, workspaceSlug, projectId);
  if (!context) notFound();
  const [{ data: prompts }, { data: criteria }, { data: testCases }, { data: reviews }] = await Promise.all([
    supabase.from("prompt_versions").select("*").eq("project_id", projectId).order("version_number"),
    supabase.from("evaluation_criteria").select("*").eq("project_id", projectId),
    supabase.from("test_cases").select("*").eq("project_id", projectId),
    supabase.from("human_reviews").select("*").eq("project_id", projectId)
  ]);
  const project = context.project;
  const activePrompt = prompts?.find((prompt) => prompt.is_active);

  return (
    <div>
      <PageHeader
        eyebrow={project.product_type || "AI project"}
        title={project.name}
        actions={
          <>
            <ProjectActionsMenu workspaceSlug={workspaceSlug} projectId={projectId} projectName={project.name} />
            <ButtonLink href={projectPath(workspaceSlug, projectId, "/dataset")}>Run AI Outputs</ButtonLink>
          </>
        }
      >
        {project.goal || "Build a structured human evaluation loop before launch."}
      </PageHeader>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Prompt versions" value={prompts?.length || 0} detail={activePrompt ? `Active v${activePrompt.version_number}` : "No active prompt"} />
        <StatCard label="Evaluation criteria" value={criteria?.length || 0} />
        <StatCard label="Golden dataset" value={testCases?.length || 0} />
        <StatCard label="Reviewed cases" value={reviews?.length || 0} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold text-guard-ink">Project context</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-guard-muted">Target user</dt><dd className="text-guard-ink">{project.target_user || "Not defined"}</dd></div>
            <div><dt className="text-guard-muted">Description</dt><dd className="text-guard-ink">{project.description || "No description yet."}</dd></div>
            <div><dt className="text-guard-muted">Variables</dt><dd className="text-guard-ink">{project.variables?.join(", ") || "No variables"}</dd></div>
          </dl>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold text-guard-ink">Next best actions</h2>
          <div className="mt-4 grid gap-3">
            <ButtonLink variant="secondary" href={projectPath(workspaceSlug, projectId, "/criteria")}>Suggest Criteria</ButtonLink>
            <ButtonLink variant="secondary" href={projectPath(workspaceSlug, projectId, "/dataset")}>Generate Starter Test Set</ButtonLink>
            <ButtonLink variant="secondary" href={projectPath(workspaceSlug, projectId, "/dataset")}>Review AI Outputs</ButtonLink>
            <ButtonLink variant="secondary" href={projectPath(workspaceSlug, projectId, "/results")}>View Results</ButtonLink>
          </div>
        </Card>
      </div>
    </div>
  );
}
