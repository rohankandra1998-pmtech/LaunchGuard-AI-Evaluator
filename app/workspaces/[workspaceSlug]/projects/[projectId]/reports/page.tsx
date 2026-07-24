import { ReportsWorkspace } from "@/components/reports-workspace";
import { ButtonLink, PageHeader } from "@/components/ui";
import { getNextPromptVersionNumber } from "@/lib/data";
import { toPromptProposalResponse } from "@/lib/prompt-proposal-drafts";
import { createClient } from "@/lib/supabase/server";
import type { PromptProposalResponse, SavedPromptVersion } from "@/lib/types";

export default async function ReportsPage({ params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }) {
  const { workspaceSlug, projectId } = await params;
  const supabase = await createClient();
  const { data: reports, error: reportsError } = await supabase
    .from("error_analysis_reports")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (reportsError) throw reportsError;

  const latestReport = reports?.[0];
  const [{ data: draftRow, error: draftError }, proposedVersionNumber, savedVersionResult] = await Promise.all([
    supabase.from("prompt_proposal_drafts").select("*").eq("project_id", projectId).maybeSingle(),
    getNextPromptVersionNumber(supabase, projectId),
    latestReport
      ? supabase
        .from("prompt_versions")
        .select("id, version_number")
        .eq("project_id", projectId)
        .eq("source_error_analysis_report_id", latestReport.id)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);
  if (savedVersionResult.error) throw savedVersionResult.error;
  const initialSavedVersion: SavedPromptVersion | null = savedVersionResult.data
    ? {
      id: savedVersionResult.data.id,
      versionNumber: savedVersionResult.data.version_number
    }
    : null;
  let initialDraft: PromptProposalResponse | null = null;
  let initialDraftError: { draftId: string | null; kind: "unavailable" | "invalid"; message: string } | null = null;
  if (draftError) {
    const schemaUnavailable = draftError.code === "PGRST205" || draftError.code === "42P01";
    console.warn("Prompt Proposal draft load unavailable", {
      workspaceSlug,
      projectId,
      code: draftError.code,
      message: draftError.message
    });
    initialDraftError = {
      draftId: null,
      kind: "unavailable",
      message: schemaUnavailable
        ? "Prompt Proposal storage is not ready. Apply supabase/migrations/20260723120000_prompt_proposal_drafts.sql, then refresh this page."
        : "Prompt Proposal storage is temporarily unavailable. Refresh the page or try again later."
    };
  } else if (draftRow) {
    try {
      initialDraft = toPromptProposalResponse(draftRow, proposedVersionNumber);
    } catch (error) {
      console.warn("Stored Prompt Proposal draft is invalid", {
        workspaceSlug,
        projectId,
        draftId: typeof draftRow.id === "string" ? draftRow.id : null,
        error
      });
      initialDraftError = {
        draftId: typeof draftRow.id === "string" ? draftRow.id : null,
        kind: "invalid",
        message: "This saved Prompt Proposal is unusable because its stored data is invalid. Discard it and create a new proposal."
      };
    }
  }
  const exportUrl = `/api/export/project-csv?workspaceSlug=${encodeURIComponent(workspaceSlug)}&projectId=${encodeURIComponent(projectId)}`;
  return <div><PageHeader eyebrow="Error analysis" title="Error Analysis" actions={<ButtonLink variant="secondary" href={exportUrl}>Export CSV</ButtonLink>}>Summarize reviewed failures, identify root causes, and draft a safer next prompt version.</PageHeader><ReportsWorkspace workspaceSlug={workspaceSlug} projectId={projectId} reports={reports || []} initialDraft={initialDraft} initialDraftError={initialDraftError} initialSavedVersion={initialSavedVersion} /></div>;
}
