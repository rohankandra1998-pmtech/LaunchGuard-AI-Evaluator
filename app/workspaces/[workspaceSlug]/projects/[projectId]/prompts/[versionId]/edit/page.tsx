import { notFound } from "next/navigation";
import { PromptVersionBuilder } from "@/components/prompt-version-builder";
import { PageHeader } from "@/components/ui";
import { assertUuid, getWorkspaceProject, projectPath } from "@/lib/data";
import { getProductModel, getReasoningModel } from "@/lib/openai";
import { validateVariableSchema } from "@/lib/prompt-variables";
import { createClient } from "@/lib/supabase/server";

export default async function EditPromptVersionPage({ params }: { params: Promise<{ workspaceSlug: string; projectId: string; versionId: string }> }) {
  const { workspaceSlug, projectId, versionId } = await params;
  const supabase = await createClient();
  const context = await getWorkspaceProject(supabase, workspaceSlug, projectId);
  if (!context) notFound();

  let validatedVersionId: string;
  try {
    validatedVersionId = assertUuid(versionId, "Prompt version ID");
  } catch {
    notFound();
  }
  const { data: version, error } = await supabase.from("prompt_versions").select("*").eq("id", validatedVersionId).eq("project_id", projectId).maybeSingle();
  if (error) throw error;
  if (!version) notFound();

  const promptsPath = projectPath(workspaceSlug, projectId, "/prompts");
  return (
    <div>
      <PageHeader eyebrow="Prompt lab" title={`Edit Version v${version.version_number}`}>
        Update this version’s structured variables, prompt, preview, and sandbox test without changing its Active or Draft status.
      </PageHeader>
      <PromptVersionBuilder workspaceSlug={workspaceSlug} projectId={projectId} mode="version-edit" versionId={version.id} versionNumber={version.version_number} isActive={version.is_active} initialModel={version.model_used} initialNotes={version.notes || ""} initialSystemPrompt={version.system_prompt} initialVariableSchema={validateVariableSchema(version.variable_schema)} models={[...new Set([getProductModel(), getReasoningModel(), version.model_used])]} cancelHref={promptsPath} />
    </div>
  );
}
