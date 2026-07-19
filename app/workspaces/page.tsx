import Link from "next/link";
import { ArrowRight, FolderKanban, PlusCircle } from "lucide-react";
import { ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WorkspacesPage() {
  const supabase = await createClient();
  const [{ data: workspaces, error }, { data: activeProjects, error: projectsError }] = await Promise.all([
    supabase.from("workspaces").select("*").order("updated_at", { ascending: false }),
    supabase.from("projects").select("id, workspace_id, test_cases(id, status)").is("trashed_at", null)
  ]);
  if (error) throw error;
  if (projectsError) throw projectsError;

  return (
    <div>
      <PageHeader
        eyebrow="Open directory"
        title="Community Workspaces"
        actions={<ButtonLink href="/workspaces/new"><PlusCircle className="mr-2 h-4 w-4" />Create Workspace</ButtonLink>}
      >
        Browse public AI evaluation workspaces, inspect their projects, or create a new place for collaborative prompt testing.
      </PageHeader>

      {workspaces?.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((workspace) => {
            const projects = activeProjects?.filter((project) => project.workspace_id === workspace.id) || [];
            const testCases = projects.flatMap((project) => project.test_cases || []);
            const reviewed = testCases.filter((testCase) => testCase.status === "reviewed").length;
            return (
              <Link key={workspace.id} href={`/workspaces/${workspace.slug}`} className="group block">
                <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-guard-primaryLine group-hover:shadow-floating">
                  <div className="flex items-start justify-between gap-4">
                    <span className="rounded-lg bg-guard-primarySoft p-2 text-guard-primary"><FolderKanban className="h-5 w-5" /></span>
                    <ArrowRight className="h-4 w-4 text-guard-muted transition group-hover:translate-x-1 group-hover:text-guard-primary" />
                  </div>
                  <h2 className="mt-5 text-lg font-semibold text-guard-ink">{workspace.name}</h2>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-guard-muted">{workspace.description || "Open workspace for collaborative AI evaluation."}</p>
                  <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-guard-line pt-4 text-sm">
                    <div><dt className="text-xs text-guard-muted">Projects</dt><dd className="mt-1 font-semibold text-guard-ink">{projects.length}</dd></div>
                    <div><dt className="text-xs text-guard-muted">Test cases</dt><dd className="mt-1 font-semibold text-guard-ink">{testCases.length}</dd></div>
                    <div><dt className="text-xs text-guard-muted">Reviewed</dt><dd className="mt-1 font-semibold text-guard-ink">{reviewed}</dd></div>
                  </dl>
                  <p className="mt-4 text-xs text-guard-muted">Updated {new Date(workspace.updated_at).toLocaleDateString()}</p>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No public workspaces yet">Create the first workspace and start a shared AI evaluation project.</EmptyState>
      )}
    </div>
  );
}
