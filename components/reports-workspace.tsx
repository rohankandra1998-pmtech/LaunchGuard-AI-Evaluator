"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, ChevronDown, ChevronUp, EllipsisVertical, LoaderCircle, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { deleteErrorAnalysisReport, discardPromptProposalDraft } from "@/app/actions";
import { PromptVNextDiffWorkspace } from "@/components/prompt-vnext-diff-workspace";
import { Badge, Card, EmptyState } from "@/components/ui";
import { errorAnalysisSchema, type ErrorAnalysisResponse } from "@/lib/ai/schemas";
import { promptProposalResponseSchema } from "@/lib/prompt-proposal-drafts";
import type { ErrorAnalysisReport, PromptProposalResponse } from "@/lib/types";

type InitialDraftError = { draftId: string | null; message: string };

export function ReportsWorkspace({
  workspaceSlug,
  projectId,
  reports,
  initialDraft,
  initialDraftError
}: {
  workspaceSlug: string;
  projectId: string;
  reports: ErrorAnalysisReport[];
  initialDraft: PromptProposalResponse | null;
  initialDraftError: InitialDraftError | null;
}) {
  const router = useRouter();
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PromptProposalResponse | null>(initialDraft);
  const [draftLoadError, setDraftLoadError] = useState<InitialDraftError | null>(initialDraftError);
  const [analysisPending, startAnalysisTransition] = useTransition();
  const [proposalPending, startProposalTransition] = useTransition();
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const analysisToggleRef = useRef<HTMLButtonElement | null>(null);
  const analysisSummaryRef = useRef<HTMLDivElement | null>(null);
  const proposalInFlightRef = useRef(false);
  const [invalidDraftDiscardPending, startInvalidDraftDiscardTransition] = useTransition();
  const [runAnalysisDialogOpen, setRunAnalysisDialogOpen] = useState(false);
  const runAnalysisOpenerRef = useRef<HTMLButtonElement | null>(null);
  const [openMenuReportId, setOpenMenuReportId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ErrorAnalysisReport | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, startDeleteTransition] = useTransition();
  const deleteOpenerRef = useRef<HTMLButtonElement | null>(null);
  const deleteInFlightRef = useRef(false);
  const historyHeadingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    setDraft(initialDraft);
    setDraftLoadError(initialDraftError);
  }, [initialDraft, initialDraftError]);

  function summarize() {
    if (analysisPending) return;
    setAnalysisError(null);
    startAnalysisTransition(async () => {
      try {
        const res = await fetch("/api/ai/error-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace_slug: workspaceSlug, project_id: projectId })
        });
        const json = await res.json();
        if (!res.ok) setAnalysisError(json.error || "Could not summarize error analysis.");
        else router.refresh();
      } catch {
        setAnalysisError("Could not summarize Error Analysis. Check your connection and try again.");
      }
    });
  }

  function createPrompt() {
    if (proposalPending || proposalInFlightRef.current) return;
    proposalInFlightRef.current = true;
    setProposalError(null);
    startProposalTransition(async () => {
      try {
        const res = await fetch("/api/ai/create-prompt-version", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspace_slug: workspaceSlug, project_id: projectId })
        });
        const json = await res.json();
        if (!res.ok) setProposalError(json.error || "Could not generate the Prompt Proposal.");
        else {
          const parsed = promptProposalResponseSchema.safeParse(json);
          if (!parsed.success) {
            setProposalError("The Prompt Proposal was saved, but its response could not be validated. Refresh the page to restore it.");
            router.refresh();
            return;
          }
          setAnalysisExpanded(false);
          setDraftLoadError(null);
          setDraft(parsed.data);
        }
      } catch {
        setProposalError("Could not generate the Prompt Proposal. Check your connection and try again.");
      } finally {
        proposalInFlightRef.current = false;
      }
    });
  }

  function requestNewAnalysis(opener: HTMLButtonElement) {
    if (analysisPending) return;
    runAnalysisOpenerRef.current = opener;
    setRunAnalysisDialogOpen(true);
  }

  function collapseAnalysis() {
    setAnalysisExpanded(false);
    requestAnimationFrame(() => {
      const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      analysisSummaryRef.current?.scrollIntoView({ behavior, block: "start" });
      analysisToggleRef.current?.focus({ preventScroll: true });
    });
  }

  function closeRunAnalysisDialog() {
    if (analysisPending) return;
    setRunAnalysisDialogOpen(false);
    requestAnimationFrame(() => runAnalysisOpenerRef.current?.focus());
  }

  function confirmNewAnalysis() {
    if (analysisPending) return;
    setRunAnalysisDialogOpen(false);
    summarize();
  }

  function requestDelete(report: ErrorAnalysisReport, opener: HTMLButtonElement) {
    deleteOpenerRef.current = opener;
    setOpenMenuReportId(null);
    setDeleteError(null);
    setDeleteTarget(report);
  }

  function closeDeleteDialog() {
    if (deletePending || deleteInFlightRef.current) return;
    setDeleteTarget(null);
    setDeleteError(null);
    requestAnimationFrame(() => deleteOpenerRef.current?.focus());
  }

  function confirmDelete() {
    if (!deleteTarget || deletePending || deleteInFlightRef.current) return;
    deleteInFlightRef.current = true;
    setDeleteError(null);
    const formData = new FormData();
    formData.set("workspace_slug", workspaceSlug);
    formData.set("project_id", projectId);
    formData.set("report_id", deleteTarget.id);

    startDeleteTransition(async () => {
      try {
        await deleteErrorAnalysisReport(formData);
        if (draft?.source_report.id === deleteTarget.id) {
          setAnalysisExpanded(false);
          setDraft(null);
        }
        setDeleteTarget(null);
        setOpenMenuReportId(null);
        router.refresh();
        requestAnimationFrame(() => historyHeadingRef.current?.focus());
      } catch {
        setDeleteError("Report could not be deleted. It may already have been removed. Refresh the page and try again.");
      } finally {
        deleteInFlightRef.current = false;
      }
    });
  }

  const latest = reports[0];
  const proposalStageActive = proposalPending || Boolean(draft) || Boolean(draftLoadError);
  const showPromptProposalAction = Boolean(latest) && !analysisPending && !proposalStageActive;
  const sourceReport = draft
    ? reports.find((report) => report.id === draft.source_report.id) ?? latest
    : latest;

  function discardInvalidDraft() {
    if (!draftLoadError?.draftId || invalidDraftDiscardPending) return;
    setProposalError(null);
    const formData = new FormData();
    formData.set("workspace_slug", workspaceSlug);
    formData.set("project_id", projectId);
    formData.set("draft_id", draftLoadError.draftId);
    startInvalidDraftDiscardTransition(async () => {
      try {
        await discardPromptProposalDraft(formData);
        setDraftLoadError(null);
        router.refresh();
      } catch {
        setProposalError("The unusable Prompt Proposal could not be discarded. Refresh the page and try again.");
      }
    });
  }

  return (
    <>
      <div className={`space-y-6 ${showPromptProposalAction ? "pb-48 sm:pb-32" : ""}`}>
        <ErrorAnalysisProgress
          hasReport={Boolean(latest)}
          analysisPending={analysisPending}
          proposalStageActive={proposalStageActive}
        />

        {!proposalStageActive ? (
          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-guard-ink">Error Analysis</h2>
                <p className="mt-2 text-sm text-guard-muted">GPT-5 summarizes reviewed failed or average test cases only.</p>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  if (latest) requestNewAnalysis(event.currentTarget);
                  else summarize();
                }}
                disabled={analysisPending}
                className={latest
                  ? "focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-primaryHover hover:bg-guard-primarySoft disabled:cursor-not-allowed disabled:opacity-50"
                  : "focus-ring shrink-0 rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white hover:bg-guard-primaryHover disabled:cursor-not-allowed disabled:bg-slate-300"}
              >
                {latest ? <RefreshCw aria-hidden="true" className={`h-4 w-4 ${analysisPending ? "animate-spin motion-reduce:animate-none" : ""}`} /> : null}
                {analysisPending
                  ? latest
                    ? "Running New Analysis…"
                    : "Running Error Analysis…"
                  : latest
                    ? "Run New Analysis"
                    : "Run Error Analysis"}
              </button>
            </div>
            {analysisError ? <p role="alert" className="mt-4 rounded-md border border-guard-red/30 bg-guard-red/10 p-3 text-sm text-guard-red">{analysisError}</p> : null}
            {proposalError ? <p role="alert" className="mt-4 rounded-md border border-guard-red/30 bg-guard-red/10 p-3 text-sm text-guard-red">{proposalError}</p> : null}
            <div className="mt-6">
              {latest ? <ReportBlock report={latest} /> : <EmptyState title="No reports yet">Run error analysis after completing human reviews.</EmptyState>}
            </div>
          </Card>
        ) : (
          <>
            <div ref={analysisSummaryRef}>
              <AnalysisSummaryCard
                report={sourceReport}
                fallbackSummary={draft?.source_report.summary}
                expanded={analysisExpanded}
                reportSectionId="full-error-analysis"
                toggleRef={analysisToggleRef}
                onToggle={() => setAnalysisExpanded((current) => !current)}
              />
            </div>
            {analysisExpanded && sourceReport ? (
              <Card className="p-0">
                <section id="full-error-analysis" aria-labelledby="full-error-analysis-heading">
                  <header className="sticky top-4 z-20 flex flex-col gap-3 rounded-t-xl border-b border-guard-line bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div>
                      <h2 id="full-error-analysis-heading" className="font-semibold text-guard-ink">Full analysis</h2>
                      <p className="mt-1 text-sm text-guard-muted">Review the findings used to create this prompt proposal.</p>
                    </div>
                    <button
                      type="button"
                      onClick={collapseAnalysis}
                      className="focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-primaryHover hover:bg-guard-primarySoft"
                    >
                      Collapse analysis
                      <ChevronUp aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </header>
                  <div className="p-4 sm:p-5">
                    <ReportBlock report={sourceReport} />
                    <div className="mt-5 flex justify-end border-t border-guard-line pt-5">
                      <button
                        type="button"
                        onClick={collapseAnalysis}
                        className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-text hover:bg-guard-surfaceMuted"
                      >
                        Collapse full analysis
                        <ChevronUp aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </section>
              </Card>
            ) : null}
            {proposalError ? <p role="alert" className="rounded-md border border-guard-red/30 bg-guard-red/10 p-3 text-sm text-guard-red">{proposalError}</p> : null}
            {draftLoadError ? (
              <Card className="border-red-200 bg-guard-redSoft">
                <div role="alert">
                  <h2 className="font-semibold text-guard-red">Saved Prompt Proposal unavailable</h2>
                  <p className="mt-2 text-sm leading-6 text-guard-red">{draftLoadError.message}</p>
                </div>
                {draftLoadError.draftId ? (
                  <button
                    type="button"
                    onClick={discardInvalidDraft}
                    disabled={invalidDraftDiscardPending}
                    className="focus-ring mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-guard-red hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                    {invalidDraftDiscardPending ? "Discardingâ€¦" : "Discard unusable proposal"}
                  </button>
                ) : null}
              </Card>
            ) : null}
            {proposalPending ? <ProposalGenerationState /> : null}
            {draft ? (
              <PromptVNextDiffWorkspace
                data={draft}
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                onProposalRemoved={() => {
                  setAnalysisExpanded(false);
                  setDraft(null);
                }}
              />
            ) : null}
          </>
        )}

      <div>
        <Card>
          <h2 ref={historyHeadingRef} tabIndex={-1} className="text-lg font-semibold text-guard-ink">Previous reports</h2>
          <div className="mt-4 space-y-4">
            {reports.length ? reports.map((report) => (
              <ReportBlock
                key={report.id}
                report={report}
                compact
                actions={(
                  <ReportActions
                    open={openMenuReportId === report.id}
                    onToggle={() => setOpenMenuReportId((current) => current === report.id ? null : report.id)}
                    onClose={() => setOpenMenuReportId(null)}
                    onDelete={(opener) => requestDelete(report, opener)}
                  />
                )}
              />
            )) : <EmptyState title="No report history">Reports will appear here after generation.</EmptyState>}
          </div>
        </Card>
      </div>
      </div>

      {showPromptProposalAction ? (
        <div
          role="group"
          aria-label="Prompt proposal action"
          className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 rounded-xl border border-guard-line bg-white/95 p-4 shadow-floating backdrop-blur-sm lg:inset-x-8"
        >
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-guard-ink">Ready to improve the prompt?</p>
              <p className="mt-1 text-sm text-guard-muted">Turn these findings into a reviewable next-version proposal.</p>
            </div>
            <button
              type="button"
              onClick={createPrompt}
              disabled={proposalPending}
              className="focus-ring inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-guard-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-guard-primaryHover disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
            >
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              Create Prompt Proposal
            </button>
          </div>
        </div>
      ) : null}

      {runAnalysisDialogOpen ? (
        <RunAnalysisDialog
          pending={analysisPending}
          onCancel={closeRunAnalysisDialog}
          onConfirm={confirmNewAnalysis}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteReportDialog
          pending={deletePending}
          error={deleteError}
          onCancel={closeDeleteDialog}
          onConfirm={confirmDelete}
        />
      ) : null}
    </>
  );
}

type WorkflowStepState = "completed" | "ready" | "inProgress" | "upcoming";

const workflowStatusText: Record<WorkflowStepState, string> = {
  completed: "Completed",
  ready: "Ready",
  inProgress: "In progress",
  upcoming: "Upcoming"
};

function ErrorAnalysisProgress({
  hasReport,
  analysisPending,
  proposalStageActive
}: {
  hasReport: boolean;
  analysisPending: boolean;
  proposalStageActive: boolean;
}) {
  const analysisStepState: WorkflowStepState = analysisPending ? "inProgress" : hasReport ? "completed" : "ready";
  const proposalStepState: WorkflowStepState = proposalStageActive
    ? "inProgress"
    : hasReport && !analysisPending
      ? "ready"
      : "upcoming";
  const steps: Array<{ label: string; state: WorkflowStepState }> = [
    { label: "Run analysis", state: analysisStepState },
    { label: "Review proposal", state: proposalStepState },
    { label: "Save next version", state: "upcoming" }
  ];

  return (
    <nav aria-label="Error Analysis workflow" className="rounded-xl border border-guard-line bg-white px-4 py-4 shadow-card sm:px-6">
      <ol className="flex flex-col md:flex-row">
        {steps.map((step, index) => (
          <li
            key={step.label}
            aria-current={step.state === "ready" || step.state === "inProgress" ? "step" : undefined}
            className="relative flex min-w-0 items-start gap-3 pb-5 last:pb-0 md:block md:flex-1 md:pb-0"
          >
            <span
              aria-hidden="true"
              className={
                step.state === "completed"
                  ? "relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-guard-primary text-white"
                  : step.state === "ready"
                    ? "relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-guard-primary bg-guard-primarySoft font-semibold text-guard-primary"
                    : step.state === "inProgress"
                      ? "relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-guard-primary font-semibold text-white"
                    : "relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-guard-lineStrong bg-white font-semibold text-guard-muted"
              }
            >
              {step.state === "completed" ? <Check aria-hidden="true" className="h-5 w-5" /> : index + 1}
            </span>
            <span className="min-w-0 md:mt-3 md:block md:pr-6">
              <span className="block text-sm font-semibold text-guard-ink">{index + 1}. {step.label}</span>
              <span className={step.state === "ready" || step.state === "inProgress" ? "block text-xs font-medium text-guard-primary" : "block text-xs text-guard-muted"}>
                {workflowStatusText[step.state]}
              </span>
            </span>
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={`absolute bottom-0 left-[1.0625rem] top-9 border-l-2 md:bottom-auto md:left-9 md:right-0 md:top-[1.0625rem] md:border-l-0 md:border-t-2 ${
                  step.state === "completed" && (steps[index + 1].state === "ready" || steps[index + 1].state === "inProgress")
                    ? "border-guard-primary"
                    : "border-guard-lineStrong"
                }`}
              />
            ) : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function AnalysisSummaryCard({
  report,
  fallbackSummary,
  expanded,
  reportSectionId,
  toggleRef,
  onToggle
}: {
  report?: ErrorAnalysisReport;
  fallbackSummary?: unknown;
  expanded: boolean;
  reportSectionId: string;
  toggleRef: React.RefObject<HTMLButtonElement | null>;
  onToggle: () => void;
}) {
  const summary = report?.summary ?? fallbackSummary;
  const parsed = errorAnalysisSchema.safeParse(summary);
  const overview = parsed.success
    ? parsed.data.executive_summary.overview
    : isLegacySummary(summary)
      ? summary.top_failure_patterns[0] || summary.most_severe_mistakes[0] || "Legacy Error Analysis report."
      : "The source Error Analysis remains available for review.";
  const highestPriorityPattern = parsed.success
    ? parsed.data.failure_patterns.find((pattern) => pattern.pattern_id === parsed.data.executive_summary.highest_priority_pattern_id)?.title
      ?? (parsed.data.executive_summary.highest_priority_pattern_id ? formatIdentifier(parsed.data.executive_summary.highest_priority_pattern_id) : "None")
    : "Not available";

  return (
    <Card className="p-4 sm:p-5">
      <div className="grid gap-5 xl:grid-cols-[13rem_minmax(0,1fr)_minmax(30rem,0.9fr)] xl:items-center">
        <div className="flex items-start gap-3 xl:border-r xl:border-guard-line xl:pr-5">
          <span className="rounded-lg bg-guard-primarySoft p-2 text-guard-primary">
            <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold text-guard-ink">Analysis complete</h2>
            <p className="mt-1 text-xs text-guard-muted">{report ? new Date(report.created_at).toLocaleString() : "Source report"}</p>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-guard-muted">Executive summary</p>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-guard-text">{overview}</p>
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={expanded}
            aria-controls={reportSectionId}
            onClick={onToggle}
            disabled={!report}
            className="focus-ring mt-2 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-guard-primary hover:text-guard-primaryHover disabled:cursor-not-allowed disabled:text-guard-muted"
          >
            {expanded ? "Hide full analysis" : "View full analysis"}
            {expanded
              ? <ChevronUp aria-hidden="true" className="h-4 w-4" />
              : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryMetric label="Failure cases analyzed" value={parsed.success ? String(parsed.data.executive_summary.analyzed_test_case_count) : "—"} />
          <SummaryMetric label="High-severity patterns" value={parsed.success ? String(parsed.data.executive_summary.high_severity_pattern_count) : "—"} tone={parsed.success && parsed.data.executive_summary.high_severity_pattern_count ? "danger" : "neutral"} />
          <SummaryMetric label="Highest-priority pattern" value={highestPriorityPattern} />
        </div>
      </div>
    </Card>
  );
}

function ProposalGenerationState() {
  return (
    <Card className="border-guard-primaryLine bg-guard-surfaceMuted">
      <div aria-live="polite" className="flex flex-col items-center py-8 text-center">
        <span className="rounded-full bg-white p-3 text-guard-primary shadow-card">
          <LoaderCircle aria-hidden="true" className="h-6 w-6 animate-spin motion-reduce:animate-none" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-guard-ink">Generating Prompt Proposal…</h2>
        <p className="mt-2 text-sm text-guard-muted">Grounding changes in the latest reviewed failures and current prompt.</p>
        <div aria-hidden="true" className="mt-6 h-2 w-full max-w-lg overflow-hidden rounded-full bg-white">
          <div className="starter-progress-indicator h-full w-1/3 rounded-full bg-guard-primary" />
        </div>
      </div>
    </Card>
  );
}

function ReportHeader({ createdAt, badge, actions }: { createdAt: string; badge?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="text-xs text-slate-500">{new Date(createdAt).toLocaleString()}</p>
        {badge}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

function ReportActions({ open, onToggle, onClose, onDelete }: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onDelete: (opener: HTMLButtonElement) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItemRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) onClose();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => menuItemRef.current?.focus());
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open report actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={onToggle}
        className="focus-ring rounded-md p-1.5 text-guard-muted transition hover:bg-white hover:text-guard-primary"
      >
        <EllipsisVertical aria-hidden="true" className="h-4 w-4" />
      </button>
      {open ? (
        <div id={menuId} role="menu" className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-guard-line bg-white p-1 shadow-floating">
          <button
            ref={menuItemRef}
            type="button"
            role="menuitem"
            onClick={() => {
              if (triggerRef.current) onDelete(triggerRef.current);
            }}
            className="focus-ring flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-guard-red transition hover:bg-guard-redSoft"
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            Delete report
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RunAnalysisDialog({ pending, onCancel, onConfirm }: {
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-guard-line bg-white p-0 text-guard-text shadow-floating backdrop:bg-slate-950/25"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-xl font-semibold tracking-tight text-guard-ink">Run a new error analysis?</h2>
        <div id={descriptionId} className="mt-2 space-y-2 text-sm leading-6 text-guard-muted">
          <p>LaunchGuard will analyze the latest human-reviewed test cases and create a new report. Your existing reports will remain available under Previous reports.</p>
          <p>Prompt recommendations may change if human reviews or evaluation results have changed.</p>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            autoFocus
            onClick={onCancel}
            disabled={pending}
            className="focus-ring rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-text hover:bg-guard-surfaceMuted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white hover:bg-guard-primaryHover disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Run New Analysis
          </button>
        </div>
      </div>
    </dialog>
  );
}

function DeleteReportDialog({ pending, error, onCancel, onConfirm }: {
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-guard-line bg-white p-0 text-guard-text shadow-floating backdrop:bg-slate-950/25"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-xl font-semibold tracking-tight text-guard-ink">Delete this report?</h2>
        <p id={descriptionId} className="mt-2 text-sm leading-6 text-guard-muted">
          This report will be permanently removed. This will not delete any test cases, human reviews, evaluation criteria, generated outputs, or prompt versions.
        </p>
        {error ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-guard-redSoft p-3 text-sm text-guard-red">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" autoFocus onClick={onCancel} disabled={pending} className="focus-ring rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-text hover:bg-guard-surfaceMuted disabled:cursor-not-allowed disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={pending} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-guard-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            {pending ? "Deleting..." : "Delete report"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function ReportBlock({ report, compact = false, actions }: { report: ErrorAnalysisReport; compact?: boolean; actions?: ReactNode }) {
  const parsedSummary = errorAnalysisSchema.safeParse(report.summary);
  if (parsedSummary.success) {
    return <StructuredReportBlock createdAt={report.created_at} summary={parsedSummary.data} compact={compact} actions={actions} />;
  }
  if (isLegacySummary(report.summary)) {
    return <LegacyReportBlock createdAt={report.created_at} summary={report.summary} compact={compact} actions={actions} />;
  }

  return (
    <div className="rounded-lg border border-guard-line bg-guard-surfaceMuted p-4">
      <ReportHeader createdAt={report.created_at} actions={actions} />
      <div className="mt-3 rounded-lg border border-dashed border-guard-lineStrong bg-white p-4">
        <p className="text-sm font-semibold text-guard-ink">This report uses an unsupported format</p>
        <p className="mt-1 text-sm text-guard-muted">Generate a new Error Analysis report to view structured findings.</p>
      </div>
    </div>
  );
}

type Severity = ErrorAnalysisResponse["failure_patterns"][number]["severity"];
type Priority = ErrorAnalysisResponse["recommended_prompt_changes"][number]["priority"];

function StructuredReportBlock({ createdAt, summary, compact, actions }: { createdAt: string; summary: ErrorAnalysisResponse; compact: boolean; actions?: ReactNode }) {
  const patterns = [...summary.failure_patterns].sort((left, right) =>
    severityRank[left.severity] - severityRank[right.severity]
    || right.affected_test_case_count - left.affected_test_case_count
  );
  const patternTitles = new Map(summary.failure_patterns.map((pattern) => [pattern.pattern_id, pattern.title]));

  if (compact) {
    return (
      <div className="rounded-lg border border-guard-line bg-guard-surfaceMuted p-4">
        <ReportHeader createdAt={createdAt} actions={actions} />
        <p className="mt-3 text-sm leading-6 text-guard-text">{summary.executive_summary.overview}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="primary">{summary.executive_summary.analyzed_test_case_count} analyzed</Badge>
          <Badge tone={summary.executive_summary.high_severity_pattern_count ? "bad" : "neutral"}>
            {summary.executive_summary.high_severity_pattern_count} high severity
          </Badge>
        </div>
        <div className="mt-4 space-y-2">
          {patterns.map((pattern, index) => (
            <div key={`${pattern.pattern_id}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-guard-line bg-white px-3 py-2">
              <p className="text-sm font-medium text-guard-ink">{pattern.title}</p>
              <div className="flex items-center gap-2">
                <SeverityBadge severity={pattern.severity} />
                <span className="text-xs text-guard-muted">{pattern.affected_test_case_count} case{pattern.affected_test_case_count === 1 ? "" : "s"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const recommendations = [...summary.recommended_prompt_changes].sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority]);

  return (
    <div className="rounded-lg border border-guard-line bg-guard-surfaceMuted p-4">
      <ReportHeader createdAt={createdAt} actions={actions} />
      <div className="mt-4 space-y-7">
        <ExecutiveSummarySection summary={summary.executive_summary} />

        <section>
          <h3 className="text-base font-semibold text-guard-ink">Failure Patterns</h3>
          <div className="mt-3 space-y-3">
            {patterns.map((pattern, index) => <FailurePatternCard key={`${pattern.pattern_id}-${index}`} pattern={pattern} />)}
          </div>
        </section>

        <section>
          <h3 className="text-base font-semibold text-guard-ink">Recommended Prompt Changes</h3>
          <div className="mt-3 space-y-3">
            {recommendations.map((change, index) => (
              <RecommendedChangeCard key={`${change.change_id}-${index}`} change={change} patternTitles={patternTitles} />
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-base font-semibold text-guard-ink">Evidence Examples</h3>
          <div className="mt-3 space-y-3">
            {summary.evidence_examples.map((example, index) => (
              <EvidenceExampleCard key={`${example.test_case_id}-${index}`} example={example} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ExecutiveSummarySection({ summary }: { summary: ErrorAnalysisResponse["executive_summary"] }) {
  return (
    <section>
      <h3 className="text-base font-semibold text-guard-ink">Executive Summary</h3>
      <p className="mt-2 text-sm leading-6 text-guard-text">{summary.overview}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SummaryMetric label="Failure cases analyzed" value={String(summary.analyzed_test_case_count)} />
        <SummaryMetric label="High-severity patterns" value={String(summary.high_severity_pattern_count)} tone={summary.high_severity_pattern_count ? "danger" : "neutral"} />
        <SummaryMetric label="Highest-priority pattern" value={summary.highest_priority_pattern_id ? formatIdentifier(summary.highest_priority_pattern_id) : "None"} />
      </div>
    </section>
  );
}

function SummaryMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "danger" }) {
  return (
    <div className={tone === "danger" ? "rounded-lg border border-red-200 bg-guard-redSoft p-3" : "rounded-lg border border-guard-line bg-white p-3"}>
      <p className={tone === "danger" ? "text-xs font-medium text-guard-red" : "text-xs font-medium text-guard-muted"}>{label}</p>
      <p className="mt-1 break-words text-lg font-semibold text-guard-ink">{value}</p>
    </div>
  );
}

function FailurePatternCard({ pattern }: { pattern: ErrorAnalysisResponse["failure_patterns"][number] }) {
  return (
    <article className="rounded-lg border border-guard-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h4 className="font-semibold text-guard-ink">{pattern.title}</h4>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={pattern.severity} />
          <Badge tone="neutral">{pattern.affected_test_case_count} affected case{pattern.affected_test_case_count === 1 ? "" : "s"}</Badge>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <LabeledText label="What happened">{pattern.what_happened}</LabeledText>
        <LabeledText label="Likely root cause">{pattern.likely_root_cause}</LabeledText>
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-guard-muted">Affected criteria</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {pattern.affected_criteria.map((criterion, index) => <Badge key={`${criterion}-${index}`} tone="primary">{criterion}</Badge>)}
        </div>
      </div>
    </article>
  );
}

function RecommendedChangeCard({ change, patternTitles }: {
  change: ErrorAnalysisResponse["recommended_prompt_changes"][number];
  patternTitles: Map<string, string>;
}) {
  return (
    <article className="rounded-lg border border-guard-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h4 className="font-semibold text-guard-ink">{change.recommendation}</h4>
        <div className="flex gap-2">
          <PriorityBadge priority={change.priority} />
          <Badge tone="neutral">{capitalize(change.change_type)}</Badge>
        </div>
      </div>
      <LabeledText className="mt-4" label="Rationale">{change.rationale}</LabeledText>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-guard-muted">Related patterns</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {change.related_pattern_ids.map((patternId, index) => (
            <Badge key={`${patternId}-${index}`} tone="primary">{patternTitles.get(patternId) || formatIdentifier(patternId)}</Badge>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-guard-muted">Exact prompt instruction</p>
        <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-guard-primaryLine bg-guard-primarySoft/50 p-4 font-mono text-xs leading-5 text-guard-ink [overflow-wrap:anywhere]">{change.exact_prompt_instruction}</pre>
      </div>
    </article>
  );
}

function EvidenceExampleCard({ example }: { example: ErrorAnalysisResponse["evidence_examples"][number] }) {
  return (
    <article className="rounded-lg border border-guard-line bg-white p-4">
      <p className="text-xs font-medium text-guard-muted">Test case {compactId(example.test_case_id)}</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <LabeledText label="User input">{example.user_input}</LabeledText>
        <LabeledText label="Relevant AI output">{example.ai_output_excerpt}</LabeledText>
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-guard-muted">Failed criteria</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {example.failed_criteria.map((criterion, index) => (
            <Badge key={`${criterion.criterion_name}-${index}`} tone={criterion.rating === "Bad" ? "bad" : "average"}>
              {criterion.criterion_name} · {criterion.rating}
            </Badge>
          ))}
        </div>
      </div>
      {example.human_notes ? <LabeledText className="mt-4" label="Human notes">{example.human_notes}</LabeledText> : null}
      <LabeledText className="mt-4" label="Why it failed">{example.why_it_failed}</LabeledText>
    </article>
  );
}

function LabeledText({ label, children, className = "" }: { label: string; children: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-guard-muted">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-guard-text">{children}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge tone={severity === "high" ? "bad" : severity === "medium" ? "average" : "neutral"}>{capitalize(severity)} severity</Badge>;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge tone={priority === "high" ? "bad" : priority === "medium" ? "average" : "neutral"}>{capitalize(priority)} priority</Badge>;
}

type LegacyExample = { user_input: string; output_issue: string };
type LegacySummary = {
  top_failure_patterns: string[];
  most_severe_mistakes: string[];
  likely_root_causes: string[];
  suggested_prompt_improvements: string[];
  recommended_rules_to_add: string[];
  problematic_examples: LegacyExample[];
};

const legacySections: Array<{ key: Exclude<keyof LegacySummary, "problematic_examples">; label: string }> = [
  { key: "top_failure_patterns", label: "Top failure patterns" },
  { key: "most_severe_mistakes", label: "Most severe mistakes" },
  { key: "likely_root_causes", label: "Likely root causes" },
  { key: "suggested_prompt_improvements", label: "Suggested prompt improvements" },
  { key: "recommended_rules_to_add", label: "Recommended rules to add" }
];

function LegacyReportBlock({ createdAt, summary, compact, actions }: { createdAt: string; summary: LegacySummary; compact: boolean; actions?: ReactNode }) {
  return (
    <div className="rounded-lg border border-guard-line bg-guard-surfaceMuted p-4">
      <ReportHeader createdAt={createdAt} badge={<Badge tone="neutral">Legacy format</Badge>} actions={actions} />
      <div className={`mt-4 grid gap-4 ${compact ? "md:grid-cols-2" : ""}`}>
        {legacySections.map(({ key, label }) => (
          <section key={key}>
            <h3 className="text-sm font-semibold text-guard-ink">{label}</h3>
            {summary[key].length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-guard-text">
                {summary[key].map((item, index) => <li key={index}>{item}</li>)}
              </ul>
            ) : <p className="mt-2 text-sm text-guard-muted">No findings recorded.</p>}
          </section>
        ))}
      </div>
      {summary.problematic_examples.length ? (
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-guard-ink">Problematic examples</h3>
          <div className={`mt-2 grid gap-3 ${compact ? "md:grid-cols-2" : ""}`}>
            {summary.problematic_examples.map((example, index) => (
              <div key={index} className="rounded-md border border-guard-line bg-white p-3">
                <LabeledText label="User input">{example.user_input}</LabeledText>
                <LabeledText className="mt-3" label="Output issue">{example.output_issue}</LabeledText>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function isLegacySummary(value: unknown): value is LegacySummary {
  if (!isRecord(value)) return false;
  const stringSectionsAreValid = legacySections.every(({ key }) => isStringArray(value[key]));
  return stringSectionsAreValid
    && Array.isArray(value.problematic_examples)
    && value.problematic_examples.every((example) =>
      isRecord(example) && typeof example.user_input === "string" && typeof example.output_issue === "string"
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

const severityRank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatIdentifier(value: string) {
  return value.replaceAll("_", " ");
}

function compactId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}
