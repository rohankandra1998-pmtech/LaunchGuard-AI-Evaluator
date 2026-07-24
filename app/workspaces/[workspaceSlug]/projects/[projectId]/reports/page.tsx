import { ReportsWorkspace } from "@/components/reports-workspace";
import { ButtonLink, PageHeader } from "@/components/ui";
import { getNextPromptVersionNumber } from "@/lib/data";
import { toPromptProposalResponse } from "@/lib/prompt-proposal-drafts";
import { createClient } from "@/lib/supabase/server";
import type { PromptProposalResponse } from "@/lib/types";

export default async function ReportsPage({ params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }) {
  const { workspaceSlug, projectId } = await params;
  const supabase = await createClient();
  const [{ data: reports }, { data: draftRow, error: draftError }, proposedVersionNumber] = await Promise.all([
    supabase.from("error_analysis_reports").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("prompt_proposal_drafts").select("*").eq("project_id", projectId).maybeSingle(),
    getNextPromptVersionNumber(supabase, projectId)
  ]);
  let initialDraft: PromptProposalResponse | null = null;
  let initialDraftError: { draftId: string | null; message: string } | null = null;
  if (draftError) {
    console.error("Prompt Proposal draft load failed", { workspaceSlug, projectId, error: draftError });
    initialDraftError = {
      draftId: null,
      message: "The saved Prompt Proposal could not be loaded. Refresh the page or try again later."
    };
  } else if (draftRow) {
    try {
      initialDraft = toPromptProposalResponse(draftRow, proposedVersionNumber);
    } catch (error) {
      console.error("Stored Prompt Proposal draft is invalid", {
        workspaceSlug,
        projectId,
        draftId: typeof draftRow.id === "string" ? draftRow.id : null,
        error
      });
      initialDraftError = {
        draftId: typeof draftRow.id === "string" ? draftRow.id : null,
        message: "This saved Prompt Proposal is unusable because its stored data is invalid. Discard it and create a new proposal."
      };
    }
  }
  const exportUrl = `/api/export/project-csv?workspaceSlug=${encodeURIComponent(workspaceSlug)}&projectId=${encodeURIComponent(projectId)}`;
  return <div><PageHeader eyebrow="Error analysis" title="Error Analysis" actions={<ButtonLink variant="secondary" href={exportUrl}>Export CSV</ButtonLink>}>Summarize reviewed failures, identify root causes, and draft a safer next prompt version.</PageHeader><ReportsWorkspace workspaceSlug={workspaceSlug} projectId={projectId} reports={reports || []} initialDraft={initialDraft} initialDraftError={initialDraftError} /></div>;
}
