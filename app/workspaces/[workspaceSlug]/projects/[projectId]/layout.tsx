import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectNav } from "@/components/project-nav";
import { getWorkspaceProject } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string; projectId: string }>;
}) {
  const { workspaceSlug, projectId } = await params;
  const supabase = await createClient();
  const context = await getWorkspaceProject(supabase, workspaceSlug, projectId);
  if (!context) notFound();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-400">
        <Link href="/workspaces" className="hover:text-white">Workspaces</Link><span>/</span>
        <Link href={`/workspaces/${workspaceSlug}`} className="hover:text-white">{context.workspace.name}</Link><span>/</span>
        <span className="text-slate-200">{context.project.name}</span>
      </div>
      <ProjectNav workspaceSlug={workspaceSlug} projectId={projectId} />
      {children}
    </div>
  );
}
