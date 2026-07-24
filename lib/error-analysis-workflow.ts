export type WorkflowStepState = "completed" | "ready" | "inProgress" | "upcoming";

export type ErrorAnalysisWorkflowState = {
  analysis: WorkflowStepState;
  proposal: WorkflowStepState;
  save: WorkflowStepState;
};

export type ErrorAnalysisWorkflowInput = {
  hasReport: boolean;
  analysisPending: boolean;
  proposalPending: boolean;
  hasDraft: boolean;
  invalidDraftPendingResolution: boolean;
  savePending: boolean;
  hasSavedVersion: boolean;
};

export function resolveErrorAnalysisWorkflow({
  hasReport,
  analysisPending,
  proposalPending,
  hasDraft,
  invalidDraftPendingResolution,
  savePending,
  hasSavedVersion
}: ErrorAnalysisWorkflowInput): ErrorAnalysisWorkflowState {
  if (analysisPending) {
    return {
      analysis: "inProgress",
      proposal: "upcoming",
      save: "upcoming"
    };
  }

  if (hasSavedVersion) {
    return {
      analysis: "completed",
      proposal: "completed",
      save: "completed"
    };
  }

  if (savePending) {
    return {
      analysis: "completed",
      proposal: "completed",
      save: "inProgress"
    };
  }

  if (proposalPending) {
    return {
      analysis: "completed",
      proposal: "inProgress",
      save: "upcoming"
    };
  }

  if (hasDraft || invalidDraftPendingResolution) {
    return {
      analysis: "completed",
      proposal: "ready",
      save: "upcoming"
    };
  }

  if (hasReport) {
    return {
      analysis: "completed",
      proposal: "ready",
      save: "upcoming"
    };
  }

  return {
    analysis: "ready",
    proposal: "upcoming",
    save: "upcoming"
  };
}
