import { notFound } from "next/navigation";
import { PromptVersionBuilder } from "@/components/prompt-version-builder";
import { PageHeader } from "@/components/ui";
import { getNextPromptVersionNumber, getWorkspaceProject, projectPath } from "@/lib/data";
import { getProductModel, getReasoningModel } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";

export default async function NewPromptVersionPage({ params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }) {
  const { workspaceSlug, projectId } = await params;
  const supabase = await createClient();
  const context = await getWorkspaceProject(supabase, workspaceSlug, projectId);
  if (!context) notFound();
  const nextVersionNumber = await getNextPromptVersionNumber(supabase, projectId);
  const promptsPath = projectPath(workspaceSlug, projectId, "/prompts");

  return (
    <div>
      <PageHeader eyebrow="Prompt lab" title="New Prompt Version">
        Build a version-specific prompt, preview it with example values, and run an ephemeral sandbox test before saving the draft.
      </PageHeader>
      <PromptVersionBuilder workspaceSlug={workspaceSlug} projectId={projectId} mode="create" versionNumber={nextVersionNumber} initialModel={getProductModel()} initialNotes="" initialSystemPrompt="" initialVariableSchema={[]} models={[...new Set([getProductModel(), getReasoningModel()])]} cancelHref={promptsPath} />
    </div>
  );
}
