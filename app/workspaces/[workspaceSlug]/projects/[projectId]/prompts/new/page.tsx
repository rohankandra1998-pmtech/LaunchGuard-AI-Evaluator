import { createPromptVersion } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { ButtonLink, Card, Label, PageHeader, Select, TextArea, TextInput } from "@/components/ui";
import { projectPath } from "@/lib/data";

export default async function NewPromptVersionPage({ params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }) {
  const { workspaceSlug, projectId } = await params;
  const promptsPath = projectPath(workspaceSlug, projectId, "/prompts");

  return (
    <div>
      <PageHeader eyebrow="Prompt lab" title="Create Prompt Version">
        Start a new draft independently with a blank system prompt instead of copying an existing version.
      </PageHeader>
      <Card>
        <form action={createPromptVersion} className="grid gap-5">
          <input type="hidden" name="workspace_slug" value={workspaceSlug} />
          <input type="hidden" name="project_id" value={projectId} />
          <div className="grid gap-4 md:grid-cols-2">
            <Label>
              <span className="block">Model used</span>
              <Select required name="model_used" defaultValue="gpt-4.1" className="mt-2">
                <option value="gpt-4.1">gpt-4.1</option>
                <option value="gpt-5">gpt-5</option>
              </Select>
            </Label>
            <Label>
              <span className="block">Notes / change summary</span>
              <TextInput name="notes" className="mt-2" placeholder="What is this version intended to improve?" />
            </Label>
          </div>
          <Label>
            <span className="block">System prompt</span>
            <TextArea
              required
              name="system_prompt"
              className="mt-2 min-h-60 font-mono"
              placeholder="Write the system prompt for this new version..."
            />
          </Label>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <ButtonLink variant="secondary" href={promptsPath}>Cancel</ButtonLink>
            <SubmitButton pendingText="Creating version...">Create version</SubmitButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
