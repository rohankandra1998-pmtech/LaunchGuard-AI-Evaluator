import Link from "next/link";
import { ArrowRight, PlusCircle, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { ProjectActionsMenu } from "@/components/project-actions-menu";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();
  const workspace = await getWorkspace(supabase, workspaceSlug);
  if (!workspace) notFound();

  const [{ data: projects, error }, { count: trashCount, error: trashCountError }] = await Promise.all([
    supabase
      .from("projects")
      .select("*, test_cases(id, status), prompt_versions(id)")
      .eq("workspace_id", workspace.id)
      .is("trashed_at", null)
      .order("updated_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .not("trashed_at", "is", null)
  ]);
  if (error) throw error;
  if (trashCountError) throw trashCountError;

  return (
    <div>
      <PageHeader
        eyebrow="Open Workspace"
        title={workspace.name}
        actions={
          <>
            <ButtonLink variant="secondary" href={`/workspaces/${workspace.slug}/trash`}>
              <Trash2 className="mr-2 h-4 w-4" />Trash{trashCount ? ` (${trashCount})` : ""}
            </ButtonLink>
            <ButtonLink href={`/workspaces/${workspace.slug}/projects/new`}>
              <PlusCircle className="mr-2 h-4 w-4" />Create AI Project
            </ButtonLink>
          </>
        }
      >
        {workspace.description || "A public workspace for collaborative AI prompt evaluation."}
      </PageHeader>

      {projects?.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {projects.map((project) => {
            const testCases = project.test_cases || [];
            const reviewed = testCases.filter((testCase: { status: string }) => testCase.status === "reviewed").length;
            return (
              <Card key={project.id} className="group relative h-full transition hover:-translate-y-0.5 hover:border-guard-primaryLine hover:shadow-floating">
                <div className="absolute right-4 top-4">
                  <ProjectActionsMenu workspaceSlug={workspace.slug} projectId={project.id} projectName={project.name} />
                </div>
                <Link href={`/workspaces/${workspace.slug}/projects/${project.id}`} className="focus-ring block rounded-md pr-12">
                  <div className="flex items-start justify-between gap-4">
                    <div><Badge tone="primary">{project.product_type || "AI product"}</Badge><h2 className="mt-3 text-lg font-semibold text-guard-ink">{project.name}</h2></div>
                    <ArrowRight className="h-4 w-4 text-guard-muted transition group-hover:translate-x-1 group-hover:text-guard-primary" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-guard-muted">{project.goal || project.description || "Structured AI evaluation project."}</p>
                  <div className="mt-5 flex flex-wrap gap-4 border-t border-guard-line pt-4 text-xs text-guard-muted">
                    <span>{project.prompt_versions?.length || 0} prompt versions</span>
                    <span>{testCases.length} test cases</span>
                    <span>{reviewed} reviewed</span>
                  </div>
                </Link>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title={trashCount ? "No active projects" : "No evaluation projects yet"}>
          {trashCount
            ? "This workspace has projects in Trash. Restore one or create a new active project."
            : "Anyone can create the first AI project in this workspace and Prompt Version 1 will be added automatically."}
        </EmptyState>
      )}
    </div>
  );
}
