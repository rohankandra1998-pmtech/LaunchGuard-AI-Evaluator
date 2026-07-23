"use client";

import { forwardRef, useMemo, useRef, useState, useTransition, type UIEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, RotateCcw, Save, Trash2 } from "lucide-react";
import { savePromptDraft } from "@/app/actions";
import { Badge } from "@/components/ui";
import { errorAnalysisSchema, type PromptVNextResponse } from "@/lib/ai/schemas";
import { createPromptDiff, type PromptDiffLine } from "@/lib/prompt-diff";
import { cn } from "@/lib/utils";

export type PromptVNextApiResponse = {
  source_prompt: {
    id: string;
    version_number: number;
    system_prompt: string;
  };
  proposed_version_number: number;
  source_report: {
    id: string;
    summary: unknown;
  };
  failed_test_case_count: number;
  proposal: PromptVNextResponse;
};

type PromptVNextDiffWorkspaceProps = {
  data: PromptVNextApiResponse;
  workspaceSlug: string;
  projectId: string;
  onDiscard: () => void;
};

export function PromptVNextDiffWorkspace({
  data,
  workspaceSlug,
  projectId,
  onDiscard
}: PromptVNextDiffWorkspaceProps) {
  const router = useRouter();
  const generatedText = data.proposal.improved_system_prompt;
  const [proposedText, setProposedText] = useState(generatedText);
  const [editingText, setEditingText] = useState(generatedText);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<"before" | "after">("after");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const saveInFlight = useRef(false);
  const syncingScroll = useRef(false);
  const beforeScrollRef = useRef<HTMLDivElement>(null);
  const afterScrollRef = useRef<HTMLDivElement>(null);
  const beforeRowRefs = useRef<Array<HTMLDivElement | HTMLButtonElement | null>>([]);
  const afterRowRefs = useRef<Array<HTMLDivElement | HTMLButtonElement | null>>([]);
  const diff = useMemo(
    () => createPromptDiff(data.source_prompt.system_prompt, proposedText, data.proposal.change_annotations),
    [data.proposal.change_annotations, data.source_prompt.system_prompt, proposedText]
  );
  const structuredReport = errorAnalysisSchema.safeParse(data.source_report.summary);
  const patternTitles = structuredReport.success
    ? new Map(structuredReport.data.failure_patterns.map((pattern) => [pattern.pattern_id, pattern.title]))
    : new Map<string, string>();
  const highestPriorityPattern = structuredReport.success
    ? structuredReport.data.failure_patterns.find(
      (pattern) => pattern.pattern_id === structuredReport.data.executive_summary.highest_priority_pattern_id
    )?.title
    : undefined;
  const selectedAnnotation = data.proposal.change_annotations.find(
    (annotation) => annotation.change_id === selectedChangeId
  ) ?? null;
  const edited = proposedText !== generatedText;
  const annotationsStale = edited;
  const selectedHasMatch = selectedChangeId
    ? diff.some((line) => line.annotationIds.includes(selectedChangeId))
    : true;

  function synchronizeScroll(source: "before" | "after", event: UIEvent<HTMLDivElement>) {
    if (syncingScroll.current || isEditing || !window.matchMedia("(min-width: 768px)").matches) return;
    const target = source === "before" ? afterScrollRef.current : beforeScrollRef.current;
    if (!target) return;
    syncingScroll.current = true;
    target.scrollTop = event.currentTarget.scrollTop;
    requestAnimationFrame(() => {
      syncingScroll.current = false;
    });
  }

  function selectChange(changeId: string, scrollToMatch = false) {
    setSelectedChangeId(changeId);
    if (!scrollToMatch) return;
    const rowIndex = diff.findIndex((line) => line.annotationIds.includes(changeId));
    if (rowIndex < 0) return;
    requestAnimationFrame(() => {
      scrollRowIntoPane(beforeScrollRef.current, beforeRowRefs.current[rowIndex]);
      scrollRowIntoPane(afterScrollRef.current, afterRowRefs.current[rowIndex]);
    });
  }

  function discard() {
    if (edited && !window.confirm("Discard this proposal and your unsaved edits?")) return;
    onDiscard();
  }

  function beginEditing() {
    setEditingText(proposedText);
    setIsEditing(true);
    setMobilePane("after");
  }

  function cancelEditing() {
    setEditingText(generatedText);
    setProposedText(generatedText);
    setIsEditing(false);
  }

  function finishEditing() {
    setProposedText(editingText);
    setIsEditing(false);
  }

  function save() {
    if (saving || saveInFlight.current) return;
    if (!proposedText.trim()) {
      setSaveError("The proposed system prompt cannot be empty.");
      return;
    }
    saveInFlight.current = true;
    setSaveError(null);
    const formData = new FormData();
    formData.set("workspace_slug", workspaceSlug);
    formData.set("project_id", projectId);
    formData.set("system_prompt", proposedText);
    formData.set("change_summary", data.proposal.change_summary);
    startSaving(async () => {
      try {
        await savePromptDraft(formData);
        onDiscard();
        router.refresh();
      } catch {
        setSaveError("The prompt draft could not be saved. Check that all configured placeholders are still present, then try again.");
      } finally {
        saveInFlight.current = false;
      }
    });
  }

  return (
    <section aria-labelledby="prompt-proposal-heading" className="space-y-4">
      <div className="rounded-xl border border-guard-line bg-white p-5 shadow-card">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
          <div className="shrink-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-guard-primary">Prompt vNext proposal</p>
            <h2 id="prompt-proposal-heading" className="mt-1 text-xl font-semibold text-guard-ink">
              v{data.source_prompt.version_number} <span aria-hidden="true" className="text-guard-muted">→</span>{" "}
              v{data.proposed_version_number} proposed
            </h2>
          </div>
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            <SummaryItem label="Meaningful changes" value={data.proposal.change_annotations.length} />
            <SummaryItem label="Failed cases considered" value={data.failed_test_case_count} />
            <SummaryItem label="Highest-priority pattern" value={highestPriorityPattern ?? "Not available"} compact />
          </div>
          <div className="xl:max-w-md xl:border-l xl:border-guard-line xl:pl-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-guard-muted">Change summary</p>
            <p className="mt-1 text-sm leading-5 text-guard-text">{data.proposal.change_summary || "No summary was provided."}</p>
          </div>
        </div>
      </div>

      <div className="sm:hidden">
        <div className="grid grid-cols-2 rounded-lg border border-guard-lineStrong bg-white p-1" role="tablist" aria-label="Prompt comparison panels">
          {(["before", "after"] as const).map((pane) => (
            <button
              key={pane}
              type="button"
              role="tab"
              aria-selected={mobilePane === pane}
              aria-controls={`${pane}-prompt-panel`}
              onClick={() => setMobilePane(pane)}
              className={cn(
                "focus-ring rounded-md px-3 py-2 text-sm font-semibold",
                mobilePane === pane ? "bg-guard-primarySoft text-guard-primaryHover" : "text-guard-muted"
              )}
            >
              {pane === "before" ? "Before" : "After"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:col-span-2">
          <div className={cn("min-w-0", mobilePane !== "before" && "hidden sm:block")}>
            <DiffPane
              id="before-prompt-panel"
              title="Before — Current System Prompt"
              badge={`v${data.source_prompt.version_number} current`}
              side="before"
              rows={diff}
              selectedChangeId={selectedChangeId}
              scrollRef={beforeScrollRef}
              rowRefs={beforeRowRefs}
              onScroll={(event) => synchronizeScroll("before", event)}
              onSelectChange={(changeId) => selectChange(changeId)}
            />
          </div>
          <div className={cn("min-w-0", mobilePane !== "after" && "hidden sm:block")}>
            {isEditing ? (
              <div id="after-prompt-panel" className="overflow-hidden rounded-xl border border-guard-primaryLine bg-white shadow-card">
                <EditorHeader title="After — Proposed System Prompt" badge={`v${data.proposed_version_number} editing`} />
                <label className="sr-only" htmlFor="proposed-prompt-editor">Edit proposed system prompt</label>
                <textarea
                  id="proposed-prompt-editor"
                  value={editingText}
                  onChange={(event) => setEditingText(event.target.value)}
                  spellCheck={false}
                  className="focus-ring block h-[32rem] w-full resize-none overflow-auto border-0 bg-white p-4 font-mono text-xs leading-6 text-guard-ink"
                />
              </div>
            ) : (
              <DiffPane
                id="after-prompt-panel"
                title="After — Proposed System Prompt"
                badge={`v${data.proposed_version_number} proposed`}
                side="after"
                rows={diff}
                selectedChangeId={selectedChangeId}
                scrollRef={afterScrollRef}
                rowRefs={afterRowRefs}
                onScroll={(event) => synchronizeScroll("after", event)}
                onSelectChange={(changeId) => selectChange(changeId)}
              />
            )}
          </div>
        </div>

        <aside aria-labelledby="why-change-heading" className="rounded-xl border border-guard-line bg-white p-5 shadow-card xl:sticky xl:top-4 xl:self-start">
          <h3 id="why-change-heading" className="text-lg font-semibold text-guard-ink">Why this change?</h3>
          {annotationsStale ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-guard-amberSoft p-3 text-xs leading-5 text-guard-amber">
              Change explanations were generated for the original proposal and may not exactly match your edits.
            </p>
          ) : null}
          {selectedAnnotation ? (
            <SelectedChange
              annotation={selectedAnnotation}
              patternTitles={patternTitles}
              hasMatch={selectedHasMatch}
              onBack={() => setSelectedChangeId(null)}
            />
          ) : (
            <ChangeOverview
              summary={data.proposal.change_summary}
              failedCount={data.failed_test_case_count}
              annotations={data.proposal.change_annotations}
              onSelect={(changeId) => selectChange(changeId, true)}
            />
          )}
        </aside>
      </div>

      <div className="rounded-xl border border-guard-line bg-white p-4 shadow-card">
        {saveError ? <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-guard-redSoft p-3 text-sm text-guard-red">{saveError}</p> : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end" role="group" aria-label="Prompt proposal actions">
          <button type="button" onClick={discard} disabled={saving} className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-red hover:bg-guard-redSoft disabled:opacity-50">
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            Discard proposal
          </button>
          {isEditing ? (
            <>
              <button type="button" onClick={cancelEditing} className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-text hover:bg-guard-surfaceMuted">
                <RotateCcw aria-hidden="true" className="h-4 w-4" />
                Cancel editing
              </button>
              <button type="button" onClick={finishEditing} className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-guard-primaryLine bg-guard-primarySoft px-4 py-2 text-sm font-semibold text-guard-primaryHover hover:bg-guard-surfaceStrong">
                <Check aria-hidden="true" className="h-4 w-4" />
                Done editing
              </button>
            </>
          ) : (
            <button type="button" onClick={beginEditing} disabled={saving} className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-text hover:bg-guard-surfaceMuted disabled:opacity-50">
              <Pencil aria-hidden="true" className="h-4 w-4" />
              Edit proposal
            </button>
          )}
          <button type="button" onClick={save} disabled={saving || isEditing} className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-guard-primary px-5 py-2 text-sm font-semibold text-white hover:bg-guard-primaryHover disabled:cursor-not-allowed disabled:bg-slate-300">
            <Save aria-hidden="true" className="h-4 w-4" />
            {saving ? "Saving draft..." : "Save as next prompt version"}
          </button>
        </div>
      </div>
    </section>
  );
}

function SummaryItem({ label, value, compact = false }: { label: string; value: string | number; compact?: boolean }) {
  return (
    <div className="rounded-lg border border-guard-line bg-guard-surfaceMuted px-3 py-2">
      <p className="text-xs font-medium text-guard-muted">{label}</p>
      <p className={cn("mt-1 font-semibold text-guard-ink", compact ? "text-sm" : "text-lg")}>{value}</p>
    </div>
  );
}

function EditorHeader({ title, badge }: { title: string; badge: string }) {
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-guard-line bg-guard-surfaceMuted px-4 py-3">
      <h3 className="text-sm font-semibold text-guard-ink">{title}</h3>
      <Badge tone="primary">{badge}</Badge>
    </div>
  );
}

function DiffPane({
  id,
  title,
  badge,
  side,
  rows,
  selectedChangeId,
  scrollRef,
  rowRefs,
  onScroll,
  onSelectChange
}: {
  id: string;
  title: string;
  badge: string;
  side: "before" | "after";
  rows: PromptDiffLine[];
  selectedChangeId: string | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  rowRefs: React.MutableRefObject<Array<HTMLDivElement | HTMLButtonElement | null>>;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  onSelectChange: (changeId: string) => void;
}) {
  return (
    <section id={id} aria-label={title} className="overflow-hidden rounded-xl border border-guard-line bg-white shadow-card">
      <EditorHeader title={title} badge={badge} />
      <div ref={scrollRef} onScroll={onScroll} tabIndex={0} className="focus-ring h-[32rem] overflow-auto bg-white" aria-label={`${title} read-only prompt`}>
        <div className="min-w-max py-2 font-mono text-xs leading-6">
          {rows.map((row, index) => (
            <DiffRow
              key={row.key}
              ref={(node) => {
                rowRefs.current[index] = node;
              }}
              row={row}
              side={side}
              selected={Boolean(selectedChangeId && row.annotationIds.includes(selectedChangeId))}
              onSelect={row.annotationIds[0] ? () => onSelectChange(row.annotationIds[0]) : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

const DiffRow = forwardRef<HTMLDivElement | HTMLButtonElement, {
  row: PromptDiffLine;
  side: "before" | "after";
  selected: boolean;
  onSelect?: () => void;
}>(function DiffRow({ row, side, selected, onSelect }, ref) {
  const kind = side === "before" ? row.beforeKind : row.afterKind;
  const text = side === "before" ? row.beforeText : row.afterText;
  const lineNumber = side === "before" ? row.beforeLineNumber : row.afterLineNumber;
  const marker = kind === "removed" ? "−" : kind === "added" ? "+" : "";
  const className = cn(
    "grid h-6 min-w-full grid-cols-[2rem_3rem_minmax(max-content,1fr)] text-left",
    kind === "removed" && "bg-guard-redSoft text-red-900",
    kind === "added" && "bg-guard-greenSoft text-green-900",
    kind === "placeholder" && "bg-slate-50 text-slate-400",
    kind === "unchanged" && "text-guard-text",
    selected && "relative z-[1] outline outline-2 -outline-offset-2 outline-guard-primary"
  );
  const content = (
    <>
      <span aria-hidden="true" className={cn("border-r border-guard-line px-2 text-center font-semibold", kind === "removed" && "text-guard-red", kind === "added" && "text-guard-green")}>{marker}</span>
      <span aria-hidden="true" className="border-r border-guard-line bg-black/[0.02] px-2 text-right text-slate-500">{lineNumber ?? ""}</span>
      <span className="whitespace-pre px-3">{text ?? " "}</span>
      {marker ? <span className="sr-only">{kind === "removed" ? "Removed line" : "Added line"}</span> : null}
    </>
  );
  if (onSelect) {
    return <button ref={ref as React.Ref<HTMLButtonElement>} type="button" onClick={onSelect} aria-pressed={selected} className={cn("focus-ring", className)}>{content}</button>;
  }
  return <div ref={ref as React.Ref<HTMLDivElement>} className={className}>{content}</div>;
});

function ChangeOverview({
  summary,
  failedCount,
  annotations,
  onSelect
}: {
  summary: string;
  failedCount: number;
  annotations: PromptVNextResponse["change_annotations"];
  onSelect: (changeId: string) => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-sm leading-6 text-guard-text">{summary || "Review the proposed prompt changes."}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge tone="primary">{annotations.length} change{annotations.length === 1 ? "" : "s"}</Badge>
        <Badge>{failedCount} failed case{failedCount === 1 ? "" : "s"} considered</Badge>
      </div>
      <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-guard-muted">Available changes</h4>
      {annotations.length ? (
        <div className="mt-2 space-y-2">
          {annotations.map((annotation) => (
            <button
              key={annotation.change_id}
              type="button"
              onClick={() => onSelect(annotation.change_id)}
              className="focus-ring flex w-full items-start justify-between gap-3 rounded-lg border border-guard-line bg-guard-surfaceMuted p-3 text-left hover:border-guard-primaryLine hover:bg-guard-primarySoft"
            >
              <span className="text-sm font-medium leading-5 text-guard-ink">{annotation.title}</span>
              <ChangeTypeBadge type={annotation.change_type} />
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-2 rounded-lg border border-dashed border-guard-lineStrong p-4 text-sm text-guard-muted">No meaningful changes were annotated. You can still review, edit, discard, or save the proposed prompt.</p>
      )}
    </div>
  );
}

function SelectedChange({
  annotation,
  patternTitles,
  hasMatch,
  onBack
}: {
  annotation: PromptVNextResponse["change_annotations"][number];
  patternTitles: Map<string, string>;
  hasMatch: boolean;
  onBack: () => void;
}) {
  return (
    <div className="mt-4">
      <button type="button" onClick={onBack} className="focus-ring rounded-md text-sm font-semibold text-guard-primary hover:text-guard-primaryHover">← All changes</button>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-base font-semibold leading-6 text-guard-ink">{annotation.title}</h4>
        <ChangeTypeBadge type={annotation.change_type} />
      </div>
      {!hasMatch ? (
        <p className="mt-3 rounded-lg border border-guard-line bg-guard-surfaceMuted p-3 text-xs leading-5 text-guard-muted">
          This explanation remains available, but its exact location is not highlighted in the current comparison.
        </p>
      ) : null}
      <Detail label="Rationale">{annotation.rationale}</Detail>
      <Detail label="Expected impact">{annotation.expected_impact}</Detail>
      <ChipGroup label="Related failure patterns">
        {annotation.related_pattern_ids.length
          ? annotation.related_pattern_ids.map((id) => <Badge key={id} tone="average">{patternTitles.get(id) || formatIdentifier(id)}</Badge>)
          : <span className="text-xs text-guard-muted">None linked</span>}
      </ChipGroup>
      <ChipGroup label="Related test cases">
        {annotation.related_test_case_ids.length
          ? annotation.related_test_case_ids.map((id) => <span key={id} className="inline-flex rounded-full border border-guard-primaryLine bg-guard-primarySoft px-2.5 py-1 text-xs font-medium text-guard-primaryHover">{compactId(id)}</span>)
          : <span className="text-xs text-guard-muted">None linked</span>}
      </ChipGroup>
      <ChipGroup label="Affected evaluation criteria">
        {annotation.affected_criteria.length
          ? annotation.affected_criteria.map((criterion) => <Badge key={criterion} tone="primary">{criterion}</Badge>)
          : <span className="text-xs text-guard-muted">None linked</span>}
      </ChipGroup>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: string }) {
  return (
    <div className="mt-5 border-t border-guard-line pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-guard-muted">{label}</p>
      <p className="mt-2 text-sm leading-6 text-guard-text">{children}</p>
    </div>
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-guard-muted">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ChangeTypeBadge({ type }: { type: "add" | "change" | "remove" }) {
  return <Badge tone={type === "add" ? "good" : type === "remove" ? "bad" : "average"}>{type === "add" ? "Added" : type === "remove" ? "Removed" : "Changed"}</Badge>;
}

function scrollRowIntoPane(pane: HTMLDivElement | null, row: HTMLDivElement | HTMLButtonElement | null) {
  if (!pane || !row) return;
  pane.scrollTo({ top: Math.max(0, row.offsetTop - pane.clientHeight / 2), behavior: "smooth" });
}

function compactId(value: string) {
  return value.length > 12 ? value.slice(0, 8) : value;
}

function formatIdentifier(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
