import { notFound } from "next/navigation";
import { PromptVersionBuilder } from "@/components/prompt-version-builder";
import { Card, PageHeader, TextArea, TextInput } from "@/components/ui";
import { getWorkspace } from "@/lib/data";
import { getProductModel, getReasoningModel } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";

export default async function NewProjectPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params;
  const supabase = await createClient();
  const workspace = await getWorkspace(supabase, workspaceSlug);
  if (!workspace) notFound();

  return (
    <div className="max-w-7xl">
      <PageHeader eyebrow={workspace.name} title="Create AI Project">
        Define the project context, then build and optionally test Prompt Version 1. The project and its active initial version are saved together.
      </PageHeader>
      <PromptVersionBuilder
        mode="project-create"
        workspaceSlug={workspace.slug}
        workspaceId={workspace.id}
        versionNumber={1}
        initialModel={getProductModel()}
        initialNotes=""
        initialSystemPrompt=""
        initialVariableSchema={[]}
        models={[...new Set([getProductModel(), getReasoningModel()])]}
        cancelHref={`/workspaces/${workspace.slug}`}
        projectContext={
          <Card>
            <div>
              <h2 className="text-lg font-semibold text-white">Project Context</h2>
              <p className="mt-1 text-sm text-slate-400">Describe the AI product and the people it should serve.</p>
            </div>
            <div className="mt-5 grid gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-200">Project name<TextInput required name="name" maxLength={120} className="mt-2" placeholder="Customer Support Refund Bot" /></label>
                <label className="text-sm font-medium text-slate-200">AI product type<TextInput name="product_type" maxLength={120} className="mt-2" placeholder="Support assistant, AI search, sales copilot" /></label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-200">Project goal<TextInput name="goal" maxLength={250} className="mt-2" placeholder="Answer refund-policy questions accurately" /></label>
                <label className="text-sm font-medium text-slate-200">Target user<TextInput name="target_user" maxLength={250} className="mt-2" placeholder="Customers asking about orders and refunds" /></label>
              </div>
              <label className="text-sm font-medium text-slate-200">Description<TextArea name="description" maxLength={1000} className="mt-2" placeholder="Describe the product behavior, risk areas, and launch scenario." /></label>
            </div>
          </Card>
        }
      />
    </div>
  );
}
