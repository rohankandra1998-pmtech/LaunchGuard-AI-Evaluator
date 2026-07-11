import Link from "next/link";
import { ArrowRight, PlusCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspacePage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();
  const workspace = await getWorkspace(supabase, workspaceSlug);
  if (!workspace) notFound();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*, test_cases(id, status), prompt_versions(id)")
    .eq("workspace_id", workspace.id)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  return (
    <div>
      <PageHeader
        eyebrow="Open Workspace"
        title={workspace.name}
        actions={<ButtonLink href={`/workspaces/${workspace.slug}/projects/new`}><PlusCircle className="mr-2 h-4 w-4" />Create AI Project</ButtonLink>}
      >
        {workspace.description || "A public workspace for collaborative AI prompt evaluation."}
      </PageHeader>

      {projects?.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {projects.map((project) => {
            const testCases = project.test_cases || [];
            const reviewed = testCases.filter((testCase: { status: string }) => testCase.status === "reviewed").length;
            return (
              <Link key={project.id} href={`/workspaces/${workspace.slug}/projects/${project.id}`} className="group block">
                <Card className="h-full transition group-hover:border-guard-cyan/40 group-hover:bg-white/[0.065]">
                  <div className="flex items-start justify-between gap-4">
                    <div><Badge tone="cyan">{project.product_type || "AI product"}</Badge><h2 className="mt-3 text-lg font-semibold text-white">{project.name}</h2></div>
                    <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-1 group-hover:text-guard-cyan" />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{project.goal || project.description || "Structured AI evaluation project."}</p>
                  <div className="mt-5 flex flex-wrap gap-4 border-t border-white/10 pt-4 text-xs text-slate-400">
                    <span>{project.prompt_versions?.length || 0} prompt versions</span>
                    <span>{testCases.length} test cases</span>
                    <span>{reviewed} reviewed</span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No evaluation projects yet">Anyone can create the first AI project in this workspace and Prompt Version 1 will be added automatically.</EmptyState>
      )}
    </div>
  );
}
