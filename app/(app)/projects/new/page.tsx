import { createProject } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Card, Label, PageHeader, TextArea, TextInput } from "@/components/ui";

export default function NewProjectPage() {
  return (
    <div className="max-w-5xl">
      <PageHeader eyebrow="New workspace" title="Create AI Project">
        Define the product context, prompt variables, and initial system prompt. LaunchGuard creates Prompt Version 1 automatically.
      </PageHeader>
      <Card>
        <form action={createProject} className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Project name</Label>
              <TextInput required name="name" placeholder="Customer Support Refund Bot" />
            </div>
            <div>
              <Label>AI product type</Label>
              <TextInput name="product_type" placeholder="Support assistant, AI search, sales copilot" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Project goal</Label>
              <TextInput name="goal" placeholder="Answer refund-policy questions accurately" />
            </div>
            <div>
              <Label>Target user</Label>
              <TextInput name="target_user" placeholder="Customers asking about orders and refunds" />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <TextArea name="description" placeholder="Describe the product behavior, risk areas, and launch scenario." />
          </div>
          <div>
            <Label>Prompt variables</Label>
            <TextArea name="variables" placeholder="user_question&#10;product_information&#10;policy_information&#10;retrieved_context" />
          </div>
          <div>
            <Label>Initial system prompt</Label>
            <TextArea required name="system_prompt" className="min-h-56 font-mono" placeholder="You are a careful support assistant..." />
          </div>
          <SubmitButton pendingText="Creating project...">Create AI Project</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
