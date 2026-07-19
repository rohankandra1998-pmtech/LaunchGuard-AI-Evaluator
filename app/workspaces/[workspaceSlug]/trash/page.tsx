import { ArrowLeft, Clock3, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { RestoreProjectButton } from "@/components/restore-project-button";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { getWorkspace } from "@/lib/data";
import { PROJECT_TRASH_RETENTION_DAYS, projectPurgeDate, projectTrashDaysRemaining } from "@/lib/project-trash";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TrashPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();
  const workspace = await getWorkspace(supabase, workspaceSlug);
  if (!workspace) notFound();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, product_type, trashed_at")
    .eq("workspace_id", workspace.id)
    .not("trashed_at", "is", null)
    .order("trashed_at", { ascending: false });
  if (error) throw error;

  return (
    <div>
      <PageHeader
        eyebrow={workspace.name}
        title="Trash"
        actions={<ButtonLink variant="secondary" href={`/workspaces/${workspace.slug}`}><ArrowLeft className="mr-2 h-4 w-4" />Back to workspace</ButtonLink>}
      >
        Projects remain recoverable for {PROJECT_TRASH_RETENTION_DAYS} days, then are permanently deleted by the daily cleanup job.
      </PageHeader>

      {projects?.length ? (
        <div className="grid gap-4">
          {projects.map((project) => {
            const trashedAt = project.trashed_at as string;
            const purgeDate = projectPurgeDate(trashedAt);
            const daysRemaining = projectTrashDaysRemaining(trashedAt);
            return (
              <Card key={project.id} className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-md bg-guard-red/10 p-2 text-guard-red"><Trash2 className="h-4 w-4" aria-hidden="true" /></span>
                    <h2 className="text-lg font-semibold text-guard-ink">{project.name}</h2>
                    {project.product_type ? <Badge tone="neutral">{project.product_type}</Badge> : null}
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-guard-muted md:grid-cols-2 md:gap-x-8">
                    <p>Moved to Trash on {new Date(trashedAt).toLocaleDateString()}</p>
                    <p>Scheduled for deletion on {purgeDate.toLocaleDateString()}</p>
                    <p className="flex items-center gap-2 text-slate-400 md:col-span-2">
                      <Clock3 className="h-4 w-4" aria-hidden="true" />
                      {daysRemaining === 0 ? "Cleanup is due" : `Approximately ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`}
                    </p>
                  </div>
                </div>
                <div className="shrink-0"><RestoreProjectButton workspaceSlug={workspace.slug} projectId={project.id} /></div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState title="Trash is empty">
          Projects moved to Trash will appear here and can be restored during their {PROJECT_TRASH_RETENTION_DAYS}-day recovery window.
        </EmptyState>
      )}
    </div>
  );
}
