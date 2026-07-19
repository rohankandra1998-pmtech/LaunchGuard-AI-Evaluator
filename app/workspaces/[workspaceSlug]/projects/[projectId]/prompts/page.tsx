import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { activatePromptVersion, duplicatePromptVersion } from "@/app/actions";
import { DeletePromptVersionDialog } from "@/components/delete-prompt-version-dialog";
import { SubmitButton } from "@/components/submit-button";
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from "@/components/ui";
import { getWorkspaceProject, projectPath } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function PromptsPage({ params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }) {
  const { workspaceSlug, projectId } = await params;
  const supabase = await createClient();
  const context = await getWorkspaceProject(supabase, workspaceSlug, projectId);
  if (!context) notFound();
  const { data: versions, error } = await supabase.from("prompt_versions").select("*").eq("project_id", projectId).order("version_number");
  if (error) throw error;

  return (
    <div>
      <PageHeader eyebrow="Prompt lab" title="Prompt Versions" actions={<ButtonLink href={projectPath(workspaceSlug, projectId, "/prompts/new")}><Plus className="h-4 w-4" />New Prompt Version</ButtonLink>}>
        Create, inspect, edit, duplicate, and activate version-specific prompts and variables. The active version is used by default for formal evaluations.
      </PageHeader>
      <div className="space-y-5">
        {versions?.length ? versions.map((version) => {
          const variableCount = Array.isArray(version.variable_schema) ? version.variable_schema.length : 0;
          return (
            <Card key={version.id}>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-semibold text-guard-ink">Prompt Version v{version.version_number}</h2>{version.is_active ? <Badge tone="good">Active</Badge> : <Badge>Draft</Badge>}<Badge tone="primary">{version.model_used}</Badge></div>
                  <p className="mt-3 text-sm text-guard-text">{version.notes || "No change summary provided."}</p>
                  <p className="mt-3 text-xs text-guard-muted">{variableCount} variable{variableCount === 1 ? "" : "s"}</p>
                  <pre className="mt-4 max-h-24 overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-guard-line bg-guard-surfaceMuted p-4 text-xs leading-5 text-guard-text">{version.system_prompt}</pre>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <ButtonLink variant="secondary" href={projectPath(workspaceSlug, projectId, `/prompts/${version.id}/edit`)}>Edit Version</ButtonLink>
                  <form action={duplicatePromptVersion}><input type="hidden" name="workspace_slug" value={workspaceSlug} /><input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="id" value={version.id} /><SubmitButton className="!border !border-guard-lineStrong !bg-white !text-guard-primaryHover hover:!bg-guard-primarySoft" pendingText="Duplicating...">Duplicate</SubmitButton></form>
                  {!version.is_active ? <DeletePromptVersionDialog workspaceSlug={workspaceSlug} projectId={projectId} versionId={version.id} versionNumber={version.version_number} /> : null}
                  {!version.is_active ? <form action={activatePromptVersion}><input type="hidden" name="workspace_slug" value={workspaceSlug} /><input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="id" value={version.id} /><SubmitButton pendingText="Activating...">Mark Active</SubmitButton></form> : null}
                </div>
              </div>
            </Card>
          );
        }) : <EmptyState title="No prompt versions">Create a project to generate Prompt Version 1 automatically.</EmptyState>}
      </div>
    </div>
  );
}
