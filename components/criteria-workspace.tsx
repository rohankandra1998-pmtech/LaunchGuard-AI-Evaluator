"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertCircle, Check, CircleDot, GripVertical, Info, Loader2, Pencil, Plus, Search, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { deleteCriterion, reorderCriteria, saveCriterion, saveSuggestedCriteria } from "@/app/actions";
import { Badge, EmptyState, Select, TextArea, TextInput } from "@/components/ui";
import { criterionFieldLimits, validateCriterion, type CriterionField, type CriterionValidationErrors, type SuggestedCriterionInput } from "@/lib/criteria";
import type { EvaluationCriterion, Project, PromptVersion } from "@/lib/types";

type SuggestedCriterion = SuggestedCriterionInput;
type CriterionDraft = SuggestedCriterionInput;
type LocalSuggestion = {
  id: string;
  draft: SuggestedCriterion;
  editSnapshot: SuggestedCriterion | null;
  isEditing: boolean;
  validationErrors: CriterionValidationErrors;
};
type ResultMessage = { tone: "status" | "error"; text: string };
type DrawerState = { type: "create" } | { type: "edit"; criterion: EvaluationCriterion } | { type: "suggestions" } | null;
type UndoSnapshot = { previous: EvaluationCriterion[]; saved: EvaluationCriterion[] };
type ReorderToast = { message: string; tone: "success" | "error"; undo?: UndoSnapshot };

const emptyCriterion: CriterionDraft = { name: "", category: "", description: "", good_definition: "", average_definition: "", bad_definition: "" };

function toDraft(criterion?: EvaluationCriterion): CriterionDraft {
  return criterion ? { name: criterion.name, category: criterion.category || "", description: criterion.description, good_definition: criterion.good_definition, average_definition: criterion.average_definition, bad_definition: criterion.bad_definition } : emptyCriterion;
}

function DrawerShell({ title, description, pending = false, size = "default", onClose, children, footer }: { title: string; description: string; pending?: boolean; size?: "default" | "wide"; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.showModal();
    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>("[data-initial-focus]")?.focus());
    return () => { window.cancelAnimationFrame(focusFrame); document.body.style.overflow = previousOverflow; };
  }, []);
  const close = () => { if (!pending) dialogRef.current?.close(); };
  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={pending} onClose={onClose} onCancel={(event) => { event.preventDefault(); close(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }} className={`criterion-drawer fixed inset-y-0 left-auto right-0 m-0 h-[100dvh] max-h-none w-full max-w-none overflow-hidden rounded-none border-0 border-l border-guard-line bg-white p-0 text-left text-guard-text shadow-floating backdrop:bg-slate-900/15 sm:rounded-l-2xl ${size === "wide" ? "sm:w-[min(44rem,100vw)]" : "sm:w-[min(36rem,100vw)]"}`}>
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-guard-line px-5 py-5 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div><h2 id={titleId} className="text-xl font-semibold tracking-tight text-guard-ink">{title}</h2><p id={descriptionId} className="mt-1.5 text-sm leading-6 text-guard-muted">{description}</p></div>
            <button type="button" onClick={close} disabled={pending} aria-label={`Close ${title}`} className="focus-ring -mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-guard-muted hover:bg-guard-primarySoft hover:text-guard-ink disabled:cursor-not-allowed disabled:opacity-50"><X aria-hidden="true" className="h-5 w-5" /></button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">{children}</div>
        {footer ? <footer className="shrink-0 border-t border-guard-line px-5 py-4 sm:px-7">{footer}</footer> : null}
      </div>
    </dialog>
  );
}

function DeleteCriterionDialog({ criterion, workspaceSlug, projectId, onClose, onDeleted }: { criterion: EvaluationCriterion; workspaceSlug: string; projectId: string; onClose: () => void; onDeleted: (criterionId: string) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.showModal();
    const focusFrame = window.requestAnimationFrame(() => cancelRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function requestClose() {
    if (!pending) dialogRef.current?.close();
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await deleteCriterion(formData);
        onDeleted(criterion.id);
      } catch {
        setError("This criterion could not be deleted. Please try again.");
      }
    });
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={pending}
      onClose={onClose}
      onCancel={(event) => { event.preventDefault(); requestClose(); }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100vw-2rem))] max-w-none overflow-y-auto rounded-2xl border border-guard-line bg-white p-0 text-left text-guard-text shadow-floating backdrop:bg-slate-900/20"
    >
      <div className="p-5 sm:p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-guard-redSoft text-guard-red">
          <Trash2 aria-hidden="true" className="h-5 w-5" />
        </div>
        <h2 id={titleId} className="mt-4 text-xl font-semibold tracking-tight text-guard-ink">Delete criterion?</h2>
        <div id={descriptionId} className="mt-2 text-sm leading-6 text-guard-muted">
          <p>You&apos;re about to delete “{criterion.name}”. This criterion will no longer be available for future reviews.</p>
          <p className="mt-2 font-semibold text-guard-text">This action cannot be undone.</p>
        </div>
        {error ? <div role="alert" className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-guard-redSoft p-3 text-sm text-guard-red"><AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{error}</div> : null}
        <form onSubmit={submit} className="mt-6 flex flex-col-reverse gap-3 min-[430px]:flex-row min-[430px]:justify-end">
          <input type="hidden" name="id" value={criterion.id} />
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="workspace_slug" value={workspaceSlug} />
          <button ref={cancelRef} type="button" onClick={requestClose} disabled={pending} className="focus-ring min-h-10 rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-ink hover:bg-guard-surfaceMuted disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={pending} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-guard-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300">
            {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Trash2 aria-hidden="true" className="h-4 w-4" />}
            {pending ? "Deleting…" : "Delete criterion"}
          </button>
        </form>
      </div>
    </dialog>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-semibold text-guard-ink"><span>{label}{required ? <span className="ml-1 text-guard-red" aria-hidden="true">*</span> : null}</span>{children}</label>;
}

function CriterionDrawer({ mode, criterion, workspaceSlug, projectId, onClose }: { mode: "create" | "edit"; criterion?: EvaluationCriterion; workspaceSlug: string; projectId: string; onClose: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => toDraft(criterion));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const update = (field: keyof CriterionDraft, value: string) => { setDraft((current) => ({ ...current, [field]: value })); setError(null); };
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try { await saveCriterion(formData); router.refresh(); onClose(); }
      catch (caught) { setError(caught instanceof Error ? caught.message : "Criterion could not be saved."); }
    });
  }
  const editing = mode === "edit";
  return (
    <DrawerShell title={editing ? "Edit criterion" : "Add criterion"} description={editing ? "Changes will affect how this criterion appears during future reviews." : "Create a criterion reviewers will use to score AI responses."} pending={pending} onClose={onClose} footer={<div className="flex flex-col-reverse gap-3 min-[430px]:flex-row min-[430px]:justify-end"><button type="button" onClick={onClose} disabled={pending} className="focus-ring min-h-10 rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold hover:bg-guard-surfaceMuted disabled:opacity-50">Cancel</button><button type="submit" form="criterion-form" disabled={pending} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white hover:bg-guard-primaryHover disabled:bg-slate-300">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{pending ? (editing ? "Saving changes..." : "Adding criterion...") : editing ? "Save changes" : "Add criterion"}</button></div>}>
      <form id="criterion-form" onSubmit={submit} className="grid gap-5">
        <input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="workspace_slug" value={workspaceSlug} />{criterion ? <input type="hidden" name="id" value={criterion.id} /> : null}
        <Field label="Name" required><TextInput autoFocus data-initial-focus required name="name" maxLength={100} value={draft.name} onChange={(e) => update("name", e.target.value)} placeholder="Factual accuracy" /></Field>
        <Field label="Category"><TextInput name="category" maxLength={100} value={draft.category} onChange={(e) => update("category", e.target.value)} placeholder="Correctness" /></Field>
        <Field label="Description" required><TextArea required name="description" maxLength={300} value={draft.description} onChange={(e) => update("description", e.target.value)} className="min-h-24" /></Field>
        <Field label="Good definition" required><TextArea required name="good_definition" maxLength={300} value={draft.good_definition} onChange={(e) => update("good_definition", e.target.value)} className="min-h-24" /></Field>
        <Field label="Average definition" required><TextArea required name="average_definition" maxLength={300} value={draft.average_definition} onChange={(e) => update("average_definition", e.target.value)} className="min-h-24" /></Field>
        <Field label="Bad definition" required><TextArea required name="bad_definition" maxLength={300} value={draft.bad_definition} onChange={(e) => update("bad_definition", e.target.value)} className="min-h-24" /></Field>
        {error ? <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-guard-redSoft p-3 text-sm text-guard-red"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div> : null}
      </form>
    </DrawerShell>
  );
}

function Definition({ tone, label, children, className = "" }: { tone: "good" | "average" | "bad"; label: string; children: React.ReactNode; className?: string }) {
  const color = { good: "text-guard-green", average: "text-guard-amber", bad: "text-guard-red" }[tone];
  return <div className={`min-w-0 border-t border-guard-line pt-4 lg:border-l lg:border-t-0 lg:px-4 lg:pt-0 ${className}`}><p className={`text-xs font-semibold ${color}`}>{label}</p><p className="mt-2 text-sm leading-5 text-guard-text">{children}</p></div>;
}

function SuggestionEditField({ suggestionId, field, label, required = false, value, error, disabled, multiline = false, labelClassName = "", onChange }: { suggestionId: string; field: CriterionField; label: string; required?: boolean; value: string; error?: string; disabled: boolean; multiline?: boolean; labelClassName?: string; onChange: (value: string) => void }) {
  const inputId = `${suggestionId}-${field}`;
  const errorId = `${inputId}-error`;
  const props = {
    id: inputId,
    required,
    maxLength: criterionFieldLimits[field],
    value,
    disabled,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? errorId : undefined,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value)
  };
  return <label className="grid gap-2 text-sm font-semibold text-guard-ink"><span className={labelClassName}>{label}{required ? <span className="ml-1 text-guard-red" aria-hidden="true">*</span> : null}</span>{multiline ? <TextArea {...props} className="min-h-24" /> : <TextInput {...props} />}{error ? <span id={errorId} className="text-xs font-medium text-guard-red">{error}</span> : null}</label>;
}

function SuggestionCard({ item, index, saving, actionsDisabled, onEdit, onUpdate, onSaveEdit, onCancelEdit, onAccept }: { item: LocalSuggestion; index: number; saving: boolean; actionsDisabled: boolean; onEdit: () => void; onUpdate: (field: CriterionField, value: string) => void; onSaveEdit: () => void; onCancelEdit: () => void; onAccept: () => void }) {
  if (item.isEditing) {
    return (
      <article aria-busy={actionsDisabled} className="rounded-xl border border-guard-primaryLine bg-guard-surfaceMuted p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3 border-b border-guard-primaryLine pb-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-guard-primarySoft text-sm font-semibold text-guard-primary">{index + 1}</span>
          <div className="min-w-0 flex-1"><p className="truncate font-semibold text-guard-ink">{item.editSnapshot?.name || item.draft.name || "Suggested criterion"}</p><p className="mt-0.5 text-xs text-guard-muted">Edit the suggestion before adding it to your rubric.</p></div>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); onSaveEdit(); }} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <SuggestionEditField suggestionId={item.id} field="name" label="Name" required value={item.draft.name} error={item.validationErrors.name} disabled={actionsDisabled} onChange={(value) => onUpdate("name", value)} />
            <SuggestionEditField suggestionId={item.id} field="category" label="Category" value={item.draft.category} error={item.validationErrors.category} disabled={actionsDisabled} onChange={(value) => onUpdate("category", value)} />
          </div>
          <SuggestionEditField suggestionId={item.id} field="description" label="Description" required multiline value={item.draft.description} error={item.validationErrors.description} disabled={actionsDisabled} onChange={(value) => onUpdate("description", value)} />
          <div className="grid gap-3 md:grid-cols-3">
            <div className="min-w-0"><SuggestionEditField suggestionId={item.id} field="good_definition" label="Good definition" labelClassName="text-guard-green" required multiline value={item.draft.good_definition} error={item.validationErrors.good_definition} disabled={actionsDisabled} onChange={(value) => onUpdate("good_definition", value)} /></div>
            <div className="min-w-0"><SuggestionEditField suggestionId={item.id} field="average_definition" label="Average definition" labelClassName="text-guard-amber" required multiline value={item.draft.average_definition} error={item.validationErrors.average_definition} disabled={actionsDisabled} onChange={(value) => onUpdate("average_definition", value)} /></div>
            <div className="min-w-0"><SuggestionEditField suggestionId={item.id} field="bad_definition" label="Bad definition" labelClassName="text-guard-red" required multiline value={item.draft.bad_definition} error={item.validationErrors.bad_definition} disabled={actionsDisabled} onChange={(value) => onUpdate("bad_definition", value)} /></div>
          </div>
          <div className="flex flex-col-reverse gap-2 min-[430px]:flex-row min-[430px]:justify-end"><button type="button" onClick={onCancelEdit} disabled={actionsDisabled} className="focus-ring min-h-10 rounded-lg border border-guard-lineStrong bg-white px-3 py-2 text-sm font-semibold hover:bg-guard-surfaceMuted disabled:opacity-50">Cancel</button><button type="submit" disabled={actionsDisabled} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-guard-primary px-3 py-2 text-sm font-semibold text-white hover:bg-guard-primaryHover disabled:bg-slate-300"><Check aria-hidden="true" className="h-4 w-4" />Save changes</button></div>
        </form>
      </article>
    );
  }

  return (
    <article aria-busy={saving} className="overflow-hidden rounded-xl border border-guard-line bg-white">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 p-4 sm:p-5">
        <span className="row-span-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-guard-primarySoft text-sm font-semibold text-guard-primary">{index + 1}</span>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="break-words font-semibold text-guard-ink">{item.draft.name}</h3>
          {item.draft.category ? <Badge tone="primary">{item.draft.category}</Badge> : null}
        </div>
        <button id={`edit-${item.id}`} type="button" onClick={onEdit} disabled={actionsDisabled} aria-label={`Edit ${item.draft.name || "suggested criterion"}`} className="focus-ring inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-guard-lineStrong bg-white px-3 py-2 text-sm font-semibold text-guard-ink hover:bg-guard-surfaceMuted disabled:opacity-50">
          <Pencil aria-hidden="true" className="h-4 w-4" />
          <span className="hidden min-[430px]:inline">Edit</span>
        </button>
        <p className="col-start-2 col-end-4 break-words text-sm leading-5 text-guard-muted">{item.draft.description}</p>
      </div>
      <dl className="grid gap-3 px-4 pb-4 sm:grid-cols-3 sm:px-5 sm:pb-5"><div className="rounded-lg border border-guard-criterionGoodBorder bg-guard-criterionGoodSurface p-3.5"><dt className="text-xs font-semibold text-guard-green">Good</dt><dd className="mt-1.5 break-words text-sm leading-5 text-guard-text">{item.draft.good_definition}</dd></div><div className="rounded-lg border border-guard-criterionAverageBorder bg-guard-criterionAverageSurface p-3.5"><dt className="text-xs font-semibold text-guard-amber">Average</dt><dd className="mt-1.5 break-words text-sm leading-5 text-guard-text">{item.draft.average_definition}</dd></div><div className="rounded-lg border border-guard-criterionBadBorder bg-guard-criterionBadSurface p-3.5"><dt className="text-xs font-semibold text-guard-red">Bad</dt><dd className="mt-1.5 break-words text-sm leading-5 text-guard-text">{item.draft.bad_definition}</dd></div></dl>
      <div className="flex justify-end border-t border-guard-line px-4 py-3"><button type="button" onClick={onAccept} disabled={actionsDisabled} aria-label={`Add ${item.draft.name || "suggested"} criterion`} className="focus-ring inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-guard-primaryLine bg-white px-3 py-2 text-sm font-semibold text-guard-primaryHover hover:bg-guard-primarySoft disabled:opacity-60">{saving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Plus aria-hidden="true" className="h-4 w-4" />}{saving ? "Adding..." : "Add criterion"}</button></div>
    </article>
  );
}

function localSuggestion(draft: SuggestedCriterion): LocalSuggestion {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `suggestion-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { id, draft: { ...draft }, editSnapshot: null, isEditing: false, validationErrors: validateCriterion(draft) };
}

function saveResultMessage(insertedCount: number, skippedCount: number, individual = false) {
  if (individual && !insertedCount) return "This criterion already exists and was not added.";
  if (!insertedCount && skippedCount) return "All remaining suggestions already exist.";
  const added = `${insertedCount} ${insertedCount === 1 ? "criterion" : "criteria"} added.`;
  return skippedCount ? `${added} ${skippedCount} ${skippedCount === 1 ? "duplicate was" : "duplicates were"} skipped.` : added;
}

function SuggestionsSummary({ suggestionCount, savedCriteriaCount, hasActivePrompt }: { suggestionCount: number; savedCriteriaCount: number; hasActivePrompt: boolean }) {
  const chips = [
    { label: "Gap-based", icon: CircleDot },
    { label: "Editable", icon: Pencil },
    { label: "No duplicates", icon: ShieldCheck }
  ];
  return (
    <aside aria-label="Suggestion summary" className="rounded-xl border border-guard-primaryLine bg-guard-surfaceMuted p-4">
      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-y-4 min-[520px]:grid-cols-[1.15fr_1fr_0.8fr]">
        <div className="flex items-center gap-3 pr-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-guard-primary shadow-sm"><Sparkles aria-hidden="true" className="h-5 w-5" /></span>
          <div><p className="text-2xl font-semibold leading-none text-guard-primary">{suggestionCount}</p><p className="mt-1 text-xs font-medium text-guard-muted">{suggestionCount === 1 ? "Suggestion found" : "Suggestions found"}</p></div>
        </div>
        <div className="border-l border-guard-primaryLine px-4"><p className="text-xs text-guard-muted">Based on</p><p className="mt-1 text-sm font-semibold text-guard-ink">{hasActivePrompt ? "Active prompt" : "No active prompt"}</p></div>
        <div className="col-span-2 border-l border-guard-primaryLine pl-4 min-[520px]:col-span-1"><p className="text-xs text-guard-muted">Saved criteria</p><p className="mt-1 text-sm font-semibold text-guard-ink">{savedCriteriaCount}</p></div>
      </div>
      <div className="mt-4 grid gap-2 border-t border-guard-primaryLine pt-3 min-[430px]:grid-cols-3">
        {chips.map(({ label, icon: Icon }) => <span key={label} className="inline-flex min-h-8 items-center justify-center gap-2 rounded-lg border border-guard-primaryLine bg-white px-3 py-1.5 text-xs font-semibold text-guard-primaryHover"><Icon aria-hidden="true" className="h-3.5 w-3.5" />{label}</span>)}
      </div>
    </aside>
  );
}

function SuggestionsDrawer({ workspaceSlug, projectId, savedCriteriaCount, hasActivePrompt, onClose }: { workspaceSlug: string; projectId: string; savedCriteriaCount: number; hasActivePrompt: boolean; onClose: () => void }) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<LocalSuggestion[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<ResultMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [batchSaving, setBatchSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const mountedRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);

  async function loadSuggestions() {
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setLoading(true); setGenerationError(null); setResultMessage(null); setSuggestions([]); setCompleted(false);
    try {
      const response = await fetch("/api/ai/suggest-criteria", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_slug: workspaceSlug, project_id: projectId }), signal: controller.signal });
      const body: { criteria?: SuggestedCriterion[]; error?: string } = await response.json();
      if (!response.ok || !Array.isArray(body.criteria)) throw new Error(body.error || "Could not suggest criteria.");
      if (mountedRef.current && controllerRef.current === controller) setSuggestions(body.criteria.map(localSuggestion));
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      if (mountedRef.current && controllerRef.current === controller) setGenerationError(caught instanceof Error ? caught.message : "Could not suggest criteria.");
    } finally {
      if (mountedRef.current && controllerRef.current === controller) setLoading(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    void loadSuggestions();
    return () => { mountedRef.current = false; controllerRef.current?.abort(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function requestClose() {
    if (savingId || batchSaving) return;
    controllerRef.current?.abort();
    onClose();
  }

  function updateSuggestion(id: string, update: (item: LocalSuggestion) => LocalSuggestion) {
    setSuggestions((current) => current.map((item) => item.id === id ? update(item) : item));
  }

  function beginEdit(id: string) {
    setResultMessage(null);
    updateSuggestion(id, (item) => ({ ...item, editSnapshot: { ...item.draft }, isEditing: true, validationErrors: {} }));
  }

  function updateDraft(id: string, field: CriterionField, value: string) {
    updateSuggestion(id, (item) => ({ ...item, draft: { ...item.draft, [field]: value }, validationErrors: { ...item.validationErrors, [field]: undefined } }));
  }

  function saveEdit(id: string) {
    const item = suggestions.find((candidate) => candidate.id === id);
    if (!item) return;
    const validationErrors = validateCriterion(item.draft);
    if (Object.keys(validationErrors).length) {
      updateSuggestion(id, (current) => ({ ...current, validationErrors }));
      return;
    }
    updateSuggestion(id, (current) => ({ ...current, editSnapshot: null, isEditing: false, validationErrors: {} }));
    window.requestAnimationFrame(() => document.getElementById(`edit-${id}`)?.focus());
  }

  function cancelEdit(id: string) {
    updateSuggestion(id, (item) => {
      const draft = item.editSnapshot ? { ...item.editSnapshot } : item.draft;
      return { ...item, draft, editSnapshot: null, isEditing: false, validationErrors: validateCriterion(draft) };
    });
    window.requestAnimationFrame(() => document.getElementById(`edit-${id}`)?.focus());
  }

  async function accept(id: string) {
    const item = suggestions.find((candidate) => candidate.id === id);
    if (!item) return;
    const validationErrors = validateCriterion(item.draft);
    if (Object.keys(validationErrors).length) {
      updateSuggestion(id, (current) => ({ ...current, editSnapshot: { ...current.draft }, isEditing: true, validationErrors }));
      setResultMessage({ tone: "error", text: "Fix the highlighted fields before adding this criterion." });
      return;
    }
    setSavingId(id); setResultMessage(null);
    try {
      const result = await saveSuggestedCriteria(workspaceSlug, projectId, [item.draft]);
      setSuggestions((current) => current.filter((candidate) => candidate.id !== id));
      setCompleted(true);
      setResultMessage({ tone: "status", text: saveResultMessage(result.insertedCount, result.skippedNames.length, true) });
      router.refresh();
    } catch {
      setResultMessage({ tone: "error", text: "This criterion could not be added. Your edits were preserved; please try again." });
    } finally { setSavingId(null); }
  }

  async function addAll() {
    const invalid = suggestions.filter((item) => Object.keys(validateCriterion(item.draft)).length);
    if (invalid.length) {
      setSuggestions((current) => current.map((item) => ({ ...item, validationErrors: validateCriterion(item.draft) })));
      setResultMessage({ tone: "error", text: "Fix the highlighted fields before adding all criteria." });
      return;
    }
    setBatchSaving(true); setResultMessage(null);
    const submittedIds = new Set(suggestions.map((item) => item.id));
    try {
      const result = await saveSuggestedCriteria(workspaceSlug, projectId, suggestions.map((item) => item.draft));
      setSuggestions((current) => current.filter((item) => !submittedIds.has(item.id)));
      setCompleted(true);
      setResultMessage({ tone: "status", text: saveResultMessage(result.insertedCount, result.skippedNames.length) });
      router.refresh();
    } catch {
      setResultMessage({ tone: "error", text: "The suggestions could not be added. Your edits were preserved; please try again." });
    } finally { setBatchSaving(false); }
  }

  const saving = savingId !== null || batchSaving;
  const hasInvalidSuggestion = suggestions.some((item) => Object.keys(validateCriterion(item.draft)).length > 0);
  const hasEditingSuggestion = suggestions.some((item) => item.isEditing);
  const addAllDisabled = loading || !suggestions.length || saving || hasInvalidSuggestion || hasEditingSuggestion;
  const footer = <div className="flex flex-col-reverse gap-3 min-[430px]:flex-row min-[430px]:justify-end"><button type="button" onClick={requestClose} disabled={saving} className="focus-ring min-h-10 rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold hover:bg-guard-surfaceMuted disabled:opacity-50">Done</button><button type="button" onClick={() => void addAll()} disabled={addAllDisabled} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white hover:bg-guard-primaryHover disabled:cursor-not-allowed disabled:bg-slate-300">{batchSaving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Sparkles aria-hidden="true" className="h-4 w-4" />}{batchSaving ? "Adding all..." : `Add all (${suggestions.length})`}</button></div>;

  return (
    <DrawerShell title="AI-suggested criteria" description="Suggestions identify gaps based on the active prompt and your saved criteria." pending={saving} size="wide" onClose={requestClose} footer={footer}>
      {resultMessage ? <div role={resultMessage.tone === "error" ? "alert" : "status"} className={`mb-4 flex gap-2 rounded-lg border p-3 text-sm ${resultMessage.tone === "error" ? "border-red-200 bg-guard-redSoft text-guard-red" : "border-green-200 bg-guard-greenSoft text-guard-green"}`}>{resultMessage.tone === "error" ? <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" /> : <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}{resultMessage.text}</div> : null}
      {loading ? <div aria-label="Loading AI suggestions" aria-busy="true" className="grid gap-4">{[0, 1, 2].map((item) => <div key={item} className="animate-pulse rounded-xl border border-guard-line bg-guard-surfaceMuted p-5"><div className="h-4 w-2/5 rounded bg-guard-lineStrong" /><div className="mt-3 h-3 w-full rounded bg-guard-line" /><div className="mt-2 h-3 w-4/5 rounded bg-guard-line" /><div className="mt-5 h-16 rounded bg-white" /></div>)}</div>
      : generationError ? <div role="alert" className="rounded-xl border border-red-200 bg-guard-redSoft p-5 text-center"><AlertCircle aria-hidden="true" className="mx-auto h-6 w-6 text-guard-red" /><h3 className="mt-3 font-semibold text-guard-ink">Suggestions could not be loaded</h3><p className="mt-2 text-sm leading-6">{generationError}</p><button type="button" onClick={() => void loadSuggestions()} className="focus-ring mt-4 rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white hover:bg-guard-primaryHover">Retry</button></div>
      : <div className="grid gap-4" aria-busy={saving}>{suggestions.length ? <><SuggestionsSummary suggestionCount={suggestions.length} savedCriteriaCount={savedCriteriaCount} hasActivePrompt={hasActivePrompt} />{suggestions.map((item, index) => <SuggestionCard key={item.id} item={item} index={index} saving={savingId === item.id} actionsDisabled={saving} onEdit={() => beginEdit(item.id)} onUpdate={(field, value) => updateDraft(item.id, field, value)} onSaveEdit={() => saveEdit(item.id)} onCancelEdit={() => cancelEdit(item.id)} onAccept={() => void accept(item.id)} />)}</> : completed ? <div className="rounded-xl border border-dashed border-guard-primaryLine bg-guard-surfaceMuted p-8 text-center"><Check aria-hidden="true" className="mx-auto h-6 w-6 text-guard-green" /><h3 className="mt-3 font-semibold text-guard-ink">All suggestions added</h3><p className="mt-2 text-sm text-guard-muted">All suggestions have been added or were already present in the rubric.</p></div> : <div className="rounded-xl border border-dashed border-guard-primaryLine bg-guard-surfaceMuted p-8 text-center"><Sparkles aria-hidden="true" className="mx-auto h-6 w-6 text-guard-primary" /><h3 className="mt-3 font-semibold text-guard-ink">Your rubric is well covered</h3><p className="mt-2 text-sm leading-6 text-guard-muted">No meaningful additional criteria were identified based on the active prompt and your saved criteria.</p><button type="button" onClick={() => void loadSuggestions()} className="focus-ring mt-4 rounded-lg border border-guard-primaryLine bg-white px-4 py-2 text-sm font-semibold text-guard-primaryHover hover:bg-guard-primarySoft">Regenerate</button></div>}</div>}
    </DrawerShell>
  );
}

export function CriteriaWorkspace({ workspaceSlug, project, activePrompt, criteria }: { workspaceSlug: string; project: Project; activePrompt: PromptVersion | null; criteria: EvaluationCriterion[] }) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [persistedCriteria, setPersistedCriteria] = useState(criteria);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [reorderToast, setReorderToast] = useState<ReorderToast | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EvaluationCriterion | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);
  const savedCriteriaHeadingRef = useRef<HTMLHeadingElement>(null);
  const dragStartOrderRef = useRef<EvaluationCriterion[] | null>(null);
  const latestOrderRef = useRef(criteria);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const criteriaSignature = criteria.map((criterion) => `${criterion.id}:${criterion.updated_at}:${criterion.sort_order}`).join("|");
  const lastCriteriaSignatureRef = useRef(criteriaSignature);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  useEffect(() => {
    if (!activeDragId && !savingOrder && criteriaSignature !== lastCriteriaSignatureRef.current) {
      setPersistedCriteria(criteria);
      latestOrderRef.current = criteria;
      lastCriteriaSignatureRef.current = criteriaSignature;
    }
  }, [activeDragId, criteria, criteriaSignature, savingOrder]);
  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);
  const categories = useMemo(() => Array.from(new Set(persistedCriteria.map((item) => item.category).filter((item): item is string => Boolean(item)))).sort((a, b) => a.localeCompare(b)), [persistedCriteria]);
  const visibleCriteria = useMemo(() => { const query = search.trim().toLocaleLowerCase(); return persistedCriteria.filter((item) => (!query || item.name.toLocaleLowerCase().includes(query) || item.description.toLocaleLowerCase().includes(query)) && (category === "all" || item.category === category)); }, [category, persistedCriteria, search]);
  const filtersActive = Boolean(search.trim()) || category !== "all";
  const canReorder = persistedCriteria.length > 1 && !filtersActive && !savingOrder;
  function openDrawer(next: Exclude<DrawerState, null>, trigger: HTMLElement) { triggerRef.current = trigger; setDrawer(next); }
  function closeDrawer() { setDrawer(null); window.requestAnimationFrame(() => triggerRef.current?.focus()); }
  function openDeleteDialog(criterion: EvaluationCriterion, trigger: HTMLButtonElement) {
    deleteTriggerRef.current = trigger;
    setDeleteTarget(criterion);
  }
  function closeDeleteDialog() {
    setDeleteTarget(null);
    window.requestAnimationFrame(() => deleteTriggerRef.current?.focus());
  }
  function completeDelete(criterionId: string) {
    setPersistedCriteria((current) => {
      const next = current.filter((criterion) => criterion.id !== criterionId);
      latestOrderRef.current = next;
      return next;
    });
    deleteTriggerRef.current = null;
    setDeleteTarget(null);
    router.refresh();
    window.requestAnimationFrame(() => savedCriteriaHeadingRef.current?.focus());
  }
  function dismissToast() {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
    setReorderToast(null);
  }
  function showToast(toast: ReorderToast, refreshAfter = false) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setReorderToast(toast);
    toastTimerRef.current = setTimeout(() => {
      setReorderToast(null);
      toastTimerRef.current = null;
      if (refreshAfter) router.refresh();
    }, 5000);
  }
  function setOrder(next: EvaluationCriterion[]) {
    latestOrderRef.current = next;
    setPersistedCriteria(next);
  }
  function normalizeOrder(order: EvaluationCriterion[]) { return order.map((criterion, index) => ({ ...criterion, sort_order: index })); }
  function sameOrder(left: EvaluationCriterion[], right: EvaluationCriterion[]) { return left.length === right.length && left.every((criterion, index) => criterion.id === right[index]?.id); }
  function reorderFailure(caught: unknown) {
    const detail = caught instanceof Error ? caught.message : "";
    return detail.startsWith("Criterion order could not be saved") ? detail : `Criterion order could not be saved.${detail ? ` ${detail}` : ""}`;
  }
  function beginDrag(event: DragStartEvent) {
    if (!canReorder) return;
    dismissToast();
    dragStartOrderRef.current = latestOrderRef.current;
    setActiveDragId(String(event.active.id));
    setReorderError(null);
  }
  function cancelDrag() {
    if (dragStartOrderRef.current) setOrder(dragStartOrderRef.current);
    dragStartOrderRef.current = null;
    setActiveDragId(null);
    setAnnouncement("Active drag canceled. The draft order was restored.");
  }
  function moveCriterion(event: DragOverEvent) {
    if (!event.over || event.active.id === event.over.id || savingOrder) return;
    setPersistedCriteria((current) => {
      const oldIndex = current.findIndex((item) => item.id === event.active.id);
      const newIndex = current.findIndex((item) => item.id === event.over?.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      const next = arrayMove(current, oldIndex, newIndex);
      latestOrderRef.current = next;
      return next;
    });
    setReorderError(null);
  }
  async function persistOrder(nextOrder: EvaluationCriterion[], previousOrder: EvaluationCriterion[]) {
    setSavingOrder(true);
    setReorderError(null);
    try {
      await reorderCriteria(workspaceSlug, project.id, nextOrder.map((criterion) => criterion.id));
      const saved = normalizeOrder(nextOrder);
      setOrder(saved);
      setAnnouncement("Criteria order updated.");
      showToast({ message: "Criteria order updated", tone: "success", undo: { previous: previousOrder, saved } }, true);
    } catch (caught) {
      const message = reorderFailure(caught);
      setOrder(previousOrder);
      setReorderError(message);
      setAnnouncement(message);
      showToast({ message, tone: "error" });
    } finally {
      setSavingOrder(false);
    }
  }
  function finishDrag(event: DragEndEvent) {
    const previousOrder = dragStartOrderRef.current;
    const completedOrder = latestOrderRef.current;
    const index = completedOrder.findIndex((item) => item.id === event.active.id);
    const criterion = completedOrder[index];
    dragStartOrderRef.current = null;
    setActiveDragId(null);
    if (criterion) setAnnouncement(`Moved “${criterion.name}” to position ${index + 1} of ${completedOrder.length}.`);
    if (!previousOrder || sameOrder(previousOrder, completedOrder)) return;
    void persistOrder(completedOrder, previousOrder);
  }
  async function undoOrder(snapshot: UndoSnapshot) {
    if (savingOrder) return;
    dismissToast();
    const previous = normalizeOrder(snapshot.previous);
    const lastSaved = normalizeOrder(snapshot.saved);
    setOrder(previous);
    setSavingOrder(true);
    setReorderError(null);
    try {
      await reorderCriteria(workspaceSlug, project.id, previous.map((criterion) => criterion.id));
      setAnnouncement("Previous order restored.");
      showToast({ message: "Previous order restored", tone: "success" }, true);
    } catch (caught) {
      const message = reorderFailure(caught);
      setOrder(lastSaved);
      setReorderError(message);
      setAnnouncement(message);
      showToast({ message, tone: "error" });
    } finally {
      setSavingOrder(false);
    }
  }
  const count = `${persistedCriteria.length} ${persistedCriteria.length === 1 ? "criterion" : "criteria"}`;
  return (
    <>
      <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-guard-primary">Human rubric</p><h1 className="text-3xl font-semibold tracking-tight text-guard-ink">Evaluation Criteria</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-guard-muted">Define Good, Average, and Bad for each criterion so reviewers score outputs consistently.</p></div>
        <div className="flex flex-wrap gap-3">
          <span className="group relative"><button type="button" disabled={!activePrompt} aria-describedby={!activePrompt ? "suggest-disabled-help" : undefined} onClick={(e) => openDrawer({ type: "suggestions" }, e.currentTarget)} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-primaryHover hover:bg-guard-primarySoft disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"><Sparkles className="h-4 w-4" />Suggest with AI</button>{!activePrompt ? <span id="suggest-disabled-help" role="tooltip" className="pointer-events-none absolute right-0 top-full z-10 mt-2 hidden w-56 rounded-lg bg-guard-ink px-3 py-2 text-xs text-white shadow-floating group-hover:block group-focus-within:block">Activate a prompt version to generate suggestions.</span> : null}</span>
          <button type="button" onClick={(e) => openDrawer({ type: "create" }, e.currentTarget)} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white hover:bg-guard-primaryHover"><Plus className="h-4 w-4" />Add criterion</button>
        </div>
      </div>
      <aside className="mb-7 flex gap-3 rounded-xl border border-guard-primaryLine bg-guard-surfaceMuted px-4 py-3.5"><Info className="mt-0.5 h-5 w-5 shrink-0 text-guard-primary" /><div><p className="text-sm font-semibold text-guard-ink">These criteria are used in Golden Dataset reviews</p><p className="mt-1 text-sm leading-5 text-guard-muted">Reviewers score each response using your definitions of Good, Average, and Bad.</p></div></aside>
      <section aria-labelledby="saved-criteria-heading">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div><div className="flex flex-wrap items-center gap-2.5"><h2 ref={savedCriteriaHeadingRef} id="saved-criteria-heading" tabIndex={-1} className="text-xl font-semibold text-guard-ink">Saved Evaluation Criteria</h2><Badge tone="primary">{count}</Badge></div><p className="mt-1.5 text-sm text-guard-muted">Manage the rubric reviewers use to evaluate AI responses.</p></div>
          {persistedCriteria.length ? <div className="flex flex-col gap-3 sm:flex-row"><label className="relative sm:w-64"><span className="sr-only">Search criteria</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-guard-muted" /><TextInput type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search criteria..." className="h-10 pl-9" /></label><label><span className="sr-only">Filter by category</span><Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 min-w-48"><option value="all">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</Select></label></div> : null}
        </div>
        {reorderError ? <div role="alert" className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-guard-redSoft p-3 text-sm text-guard-red"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{reorderError}</div> : null}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={beginDrag} onDragOver={moveCriterion} onDragCancel={cancelDrag} onDragEnd={finishDrag}>
          <SortableContext items={visibleCriteria.map((criterion) => criterion.id)} strategy={verticalListSortingStrategy}>
            <div className="mt-5 grid gap-3" aria-busy={savingOrder}>
              {!persistedCriteria.length ? <EmptyState title="Build your human review rubric"><span>Define the standards reviewers will use to score AI responses.</span><span className="mt-5 flex flex-col justify-center gap-3 sm:flex-row"><button type="button" onClick={(e) => openDrawer({ type: "create" }, e.currentTarget)} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Add criterion</button>{activePrompt ? <button type="button" onClick={(e) => openDrawer({ type: "suggestions" }, e.currentTarget)} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-guard-primaryLine bg-white px-4 py-2 text-sm font-semibold text-guard-primaryHover"><Sparkles className="h-4 w-4" />Suggest with AI</button> : null}</span></EmptyState>
              : !visibleCriteria.length ? <EmptyState title="No criteria match your filters"><span>Try a different search or category.</span><span className="mt-5 flex justify-center"><button type="button" onClick={() => { setSearch(""); setCategory("all"); }} className="focus-ring rounded-lg border border-guard-primaryLine bg-white px-4 py-2 text-sm font-semibold text-guard-primaryHover">Clear filters</button></span></EmptyState>
              : visibleCriteria.map((criterion) => <CriterionRow key={criterion.id} criterion={criterion} editing={drawer?.type === "edit" && drawer.criterion.id === criterion.id} canReorder={canReorder} filtersActive={filtersActive} totalCriteria={persistedCriteria.length} onEdit={(trigger) => openDrawer({ type: "edit", criterion }, trigger)} onDelete={(trigger) => openDeleteDialog(criterion, trigger)} />)}
            </div>
          </SortableContext>
        </DndContext>
        {persistedCriteria.length && (search || category !== "all") ? <p className="mt-3 text-xs text-guard-muted">Showing {visibleCriteria.length} of {persistedCriteria.length} criteria</p> : null}
      </section>
      <p aria-live="polite" className="sr-only">{announcement}</p>
      {reorderToast ? <div role={reorderToast.tone === "error" ? "alert" : "status"} className={`fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-floating sm:left-auto sm:right-6 sm:w-auto sm:max-w-lg ${reorderToast.tone === "error" ? "border-red-200 text-guard-red" : "border-guard-line text-guard-ink"}`}>
        {reorderToast.tone === "error" ? <AlertCircle className="h-5 w-5 shrink-0 text-guard-red" /> : <Check className="h-5 w-5 shrink-0 text-guard-green" />}
        <span className="min-w-0 flex-1">{reorderToast.message}</span>
        {reorderToast.undo ? <button type="button" onClick={() => void undoOrder(reorderToast.undo!)} disabled={savingOrder} className="focus-ring rounded-lg bg-guard-primarySoft px-3 py-1.5 font-semibold text-guard-primary hover:text-guard-primaryHover disabled:cursor-not-allowed disabled:opacity-50">Undo</button> : null}
      </div> : null}
      {drawer?.type === "create" ? <CriterionDrawer mode="create" workspaceSlug={workspaceSlug} projectId={project.id} onClose={closeDrawer} /> : null}
      {drawer?.type === "edit" ? <CriterionDrawer mode="edit" criterion={drawer.criterion} workspaceSlug={workspaceSlug} projectId={project.id} onClose={closeDrawer} /> : null}
      {drawer?.type === "suggestions" ? <SuggestionsDrawer workspaceSlug={workspaceSlug} projectId={project.id} savedCriteriaCount={persistedCriteria.length} hasActivePrompt={Boolean(activePrompt)} onClose={closeDrawer} /> : null}
      {deleteTarget ? <DeleteCriterionDialog criterion={deleteTarget} workspaceSlug={workspaceSlug} projectId={project.id} onClose={closeDeleteDialog} onDeleted={completeDelete} /> : null}
    </>
  );
}

function CriterionRow({ criterion, editing, canReorder, filtersActive, totalCriteria, onEdit, onDelete }: { criterion: EvaluationCriterion; editing: boolean; canReorder: boolean; filtersActive: boolean; totalCriteria: number; onEdit: (trigger: HTMLButtonElement) => void; onDelete: (trigger: HTMLButtonElement) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: criterion.id, disabled: !canReorder });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined };
  const disabledLabel = filtersActive
    ? `Clear search and category filters to reorder ${criterion.name}`
    : totalCriteria < 2
      ? `Add another criterion to reorder ${criterion.name}`
      : `Saving criterion order. Reordering ${criterion.name} is temporarily unavailable`;
  return (
    <article ref={setNodeRef} style={style} className={`criterion-sortable-row relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-4 rounded-xl border bg-white p-4 shadow-sm lg:grid-cols-[2rem_minmax(13rem,1.35fr)_repeat(3,minmax(9rem,1fr))_5rem] lg:gap-x-0 lg:gap-y-0 ${isDragging ? "border-guard-primaryLine opacity-90 shadow-floating ring-2 ring-guard-primary/20" : editing ? "border-guard-primaryLine bg-guard-primarySoft/30 ring-1 ring-guard-primary/10" : "border-guard-line"}`}>
      <div className="row-span-5 flex items-start justify-center lg:row-span-1">
        <button type="button" disabled={!canReorder} {...attributes} {...listeners} aria-label={canReorder ? `Drag to reorder ${criterion.name}` : disabledLabel} title={canReorder ? `Drag to reorder ${criterion.name}` : disabledLabel} className="focus-ring -ml-2 flex h-9 w-9 touch-none cursor-grab items-center justify-center rounded-lg text-guard-primary hover:bg-guard-primarySoft active:cursor-grabbing disabled:cursor-not-allowed disabled:text-guard-muted/45"><GripVertical className="h-5 w-5" /></button>
      </div>
      <div className="col-start-2 min-w-0 lg:col-start-auto lg:pr-5"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-guard-ink">{criterion.name}</h3>{criterion.category ? <Badge tone="primary">{criterion.category}</Badge> : null}</div><p className="mt-2 text-sm leading-5 text-guard-muted">{criterion.description}</p></div>
      <Definition tone="good" label="Good" className="col-start-2 lg:col-start-auto">{criterion.good_definition}</Definition><Definition tone="average" label="Average" className="col-start-2 lg:col-start-auto">{criterion.average_definition}</Definition><Definition tone="bad" label="Bad" className="col-start-2 lg:col-start-auto">{criterion.bad_definition}</Definition>
      <div className="col-start-2 flex items-start justify-end gap-1 border-t border-guard-line pt-3 lg:col-start-auto lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
        <button type="button" aria-label={`Edit ${criterion.name}`} onClick={(e) => onEdit(e.currentTarget)} className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-guard-primaryLine text-guard-primary hover:bg-guard-primarySoft">
          <Pencil aria-hidden="true" className="h-4 w-4" />
        </button>
        <button type="button" aria-label={`Delete ${criterion.name}`} title={`Delete ${criterion.name}`} onClick={(event) => onDelete(event.currentTarget)} className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-guard-lineStrong text-guard-red hover:border-red-200 hover:bg-guard-redSoft">
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}
