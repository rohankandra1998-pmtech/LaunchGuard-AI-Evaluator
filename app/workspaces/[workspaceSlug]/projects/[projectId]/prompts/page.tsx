import { activatePromptVersion, deletePromptVersion, duplicatePromptVersion, updatePromptVersion } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Badge, ButtonLink, Card, EmptyState, Label, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { projectPath } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { Plus } from "lucide-react";

export default async function PromptsPage({ params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }) {
  const { workspaceSlug, projectId } = await params;
  const supabase = await createClient();
  const { data: versions } = await supabase.from("prompt_versions").select("*").eq("project_id", projectId).order("version_number");
  const hidden = <><input type="hidden" name="workspace_slug" value={workspaceSlug} /><input type="hidden" name="project_id" value={projectId} /></>;

  return (
    <div>
      <PageHeader
        eyebrow="Prompt lab"
        title="Prompt Versions"
        actions={<ButtonLink href={projectPath(workspaceSlug, projectId, "/prompts/new")}><Plus className="h-4 w-4" />New prompt version</ButtonLink>}
      >
        Create, view, edit, duplicate, and activate prompt versions. The active version is used by default when running AI outputs.
      </PageHeader>
      <div className="space-y-5">
        {versions?.length ? versions.map((version) => (
          <Card key={version.id}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3"><h2 className="text-lg font-semibold text-white">v{version.version_number}</h2>{version.is_active ? <Badge tone="good">Active</Badge> : <Badge>Draft</Badge>}</div>
              <div className="flex flex-wrap gap-2">
                <form action={duplicatePromptVersion}>{hidden}<input type="hidden" name="id" value={version.id} /><SubmitButton className="bg-white/10 text-white hover:bg-white/15" pendingText="Duplicating...">Duplicate</SubmitButton></form>
                {!version.is_active ? <form action={deletePromptVersion}>{hidden}<input type="hidden" name="id" value={version.id} /><SubmitButton confirmMessage={`Delete v${version.version_number}? This action cannot be undone.`} className="bg-guard-red/15 text-guard-red hover:bg-guard-red/25" pendingText="Deleting...">Delete</SubmitButton></form> : null}
                {!version.is_active ? <form action={activatePromptVersion}>{hidden}<input type="hidden" name="id" value={version.id} /><SubmitButton pendingText="Activating...">Mark active</SubmitButton></form> : null}
              </div>
            </div>
            <form action={updatePromptVersion} className="grid gap-4">
              {hidden}<input type="hidden" name="id" value={version.id} />
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Model used</Label><Select name="model_used" defaultValue={version.model_used}><option value="gpt-4.1">gpt-4.1</option><option value="gpt-5">gpt-5</option></Select></div>
                <div><Label>Notes / change summary</Label><TextInput name="notes" defaultValue={version.notes || ""} /></div>
              </div>
              <div><Label>System prompt</Label><TextArea name="system_prompt" defaultValue={version.system_prompt} className="min-h-60 font-mono" /></div>
              <SubmitButton pendingText="Saving prompt...">Save changes</SubmitButton>
            </form>
          </Card>
        )) : <EmptyState title="No prompt versions">Create a project to generate Prompt Version 1 automatically.</EmptyState>}
      </div>
    </div>
  );
}
