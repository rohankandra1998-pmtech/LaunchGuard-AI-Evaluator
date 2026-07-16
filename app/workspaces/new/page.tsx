import { createWorkspace } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Card, Label, PageHeader, TextArea, TextInput } from "@/components/ui";

export default function NewWorkspacePage() {
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Open collaboration" title="Create a Workspace">
        Start a public workspace where anyone can browse projects and contribute to AI evaluations.
      </PageHeader>
      <Card>
        <form action={createWorkspace} className="grid gap-5">
          <div><Label>Workspace name</Label><TextInput required name="name" placeholder="Responsible AI Prompt Lab" /></div>
          <div><Label>Description</Label><TextArea name="description" placeholder="What kinds of AI experiences and evaluation goals belong here?" /></div>
          <p className="text-xs leading-5 text-slate-400">Workspace names receive a unique public URL automatically. Duplicate names are supported.</p>
          <SubmitButton pendingText="Creating workspace...">Create Workspace</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
