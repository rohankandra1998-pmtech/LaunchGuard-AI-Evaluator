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
  type DragOverEvent
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertCircle, Check, GripVertical, Info, ListRestart, Loader2, MoreHorizontal, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { deleteCriterion, reorderCriteria, saveCriterion } from "@/app/actions";
import { Badge, EmptyState, Select, TextArea, TextInput } from "@/components/ui";
import type { EvaluationCriterion, Project, PromptVersion } from "@/lib/types";

type SuggestedCriterion = {
  name: string;
  description: string;
  good_definition: string;
  average_definition: string;
  bad_definition: string;
  category: string;
};
type CriterionDraft = SuggestedCriterion;
type DrawerState = { type: "create" } | { type: "edit"; criterion: EvaluationCriterion } | { type: "suggestions" } | null;

const emptyCriterion: CriterionDraft = { name: "", category: "", description: "", good_definition: "", average_definition: "", bad_definition: "" };

function toDraft(criterion?: EvaluationCriterion): CriterionDraft {
  return criterion ? { name: criterion.name, category: criterion.category || "", description: criterion.description, good_definition: criterion.good_definition, average_definition: criterion.average_definition, bad_definition: criterion.bad_definition } : emptyCriterion;
}

function DrawerShell({ title, description, pending = false, onClose, children, footer }: { title: string; description: string; pending?: boolean; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
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
    <dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={pending} onClose={onClose} onCancel={(event) => { event.preventDefault(); close(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(); } }} className="criterion-drawer fixed inset-y-0 left-auto right-0 m-0 h-[100dvh] max-h-none w-full max-w-none overflow-hidden rounded-none border-0 border-l border-guard-line bg-white p-0 text-left text-guard-text shadow-floating backdrop:bg-slate-900/15 sm:w-[min(36rem,100vw)] sm:rounded-l-2xl">
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

function SuggestionCard({ item, pending, onAccept }: { item: SuggestedCriterion; pending: boolean; onAccept: () => void }) {
  return (
    <article className="rounded-xl border border-guard-line bg-guard-surfaceMuted p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-guard-ink">{item.name}</h3>{item.category ? <Badge tone="primary">{item.category}</Badge> : null}</div><p className="mt-2 text-sm leading-6 text-guard-muted">{item.description}</p></div>
        <button type="button" onClick={onAccept} disabled={pending} className="focus-ring inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-guard-primaryLine bg-white px-3 py-2 text-sm font-semibold text-guard-primaryHover hover:bg-guard-primarySoft disabled:opacity-60">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{pending ? "Adding..." : "Add criterion"}</button>
      </div>
      <dl className="mt-4 grid gap-3 text-sm"><div><dt className="font-semibold text-guard-green">Good</dt><dd className="mt-1 leading-5">{item.good_definition}</dd></div><div><dt className="font-semibold text-guard-amber">Average</dt><dd className="mt-1 leading-5">{item.average_definition}</dd></div><div><dt className="font-semibold text-guard-red">Bad</dt><dd className="mt-1 leading-5">{item.bad_definition}</dd></div></dl>
    </article>
  );
}

function SuggestionsDrawer({ workspaceSlug, projectId, onClose }: { workspaceSlug: string; projectId: string; onClose: () => void }) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<SuggestedCriterion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [acceptedCount, setAcceptedCount] = useState(0);
  async function loadSuggestions(signal?: AbortSignal) {
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/ai/suggest-criteria", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_slug: workspaceSlug, project_id: projectId }), signal });
      const body: { criteria?: SuggestedCriterion[]; error?: string } = await response.json();
      if (!response.ok || !body.criteria) throw new Error(body.error || "Could not suggest criteria.");
      setSuggestions(body.criteria);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "Could not suggest criteria.");
    } finally { setLoading(false); }
  }
  useEffect(() => { const controller = new AbortController(); void loadSuggestions(controller.signal); return () => controller.abort(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function accept(item: SuggestedCriterion, index: number) {
    setSavingIndex(index); setError(null);
    try {
      const form = new FormData(); form.set("workspace_slug", workspaceSlug); form.set("project_id", projectId); Object.entries(item).forEach(([key, value]) => form.set(key, value));
      await saveCriterion(form); setSuggestions((current) => current.filter((candidate) => candidate !== item)); setAcceptedCount((current) => current + 1); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Criterion could not be added."); }
    finally { setSavingIndex(null); }
  }
  const pending = loading || savingIndex !== null;
  return (
    <DrawerShell title="AI-suggested criteria" description="Suggestions are based on the project context, variables, and active prompt." pending={pending} onClose={onClose} footer={<div className="flex justify-end"><button type="button" onClick={onClose} disabled={pending} className="focus-ring min-h-10 rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold hover:bg-guard-surfaceMuted disabled:opacity-50">Done</button></div>}>
      {loading ? <div aria-label="Loading AI suggestions" className="grid gap-4">{[0, 1, 2].map((item) => <div key={item} className="animate-pulse rounded-xl border border-guard-line bg-guard-surfaceMuted p-5"><div className="h-4 w-2/5 rounded bg-guard-lineStrong" /><div className="mt-3 h-3 w-full rounded bg-guard-line" /><div className="mt-2 h-3 w-4/5 rounded bg-guard-line" /><div className="mt-5 h-16 rounded bg-white" /></div>)}</div>
      : error && !suggestions.length ? <div role="alert" className="rounded-xl border border-red-200 bg-guard-redSoft p-5 text-center"><AlertCircle className="mx-auto h-6 w-6 text-guard-red" /><h3 className="mt-3 font-semibold text-guard-ink">Suggestions could not be loaded</h3><p className="mt-2 text-sm leading-6">{error}</p><button type="button" onClick={() => void loadSuggestions()} className="focus-ring mt-4 rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white hover:bg-guard-primaryHover">Retry</button></div>
      : <div className="grid gap-4">{error ? <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-guard-redSoft p-3 text-sm text-guard-red"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div> : null}{suggestions.length ? suggestions.map((item, index) => <SuggestionCard key={`${item.name}-${index}`} item={item} pending={savingIndex === index} onAccept={() => void accept(item, index)} />) : acceptedCount ? <div className="rounded-xl border border-dashed border-guard-primaryLine bg-guard-surfaceMuted p-8 text-center"><Check className="mx-auto h-6 w-6 text-guard-green" /><h3 className="mt-3 font-semibold text-guard-ink">All suggestions added</h3><p className="mt-2 text-sm text-guard-muted">They are now available in your saved evaluation criteria.</p></div> : <div className="rounded-xl border border-dashed border-guard-primaryLine bg-guard-surfaceMuted p-8 text-center"><Sparkles className="mx-auto h-6 w-6 text-guard-primary" /><h3 className="mt-3 font-semibold text-guard-ink">No suggestions returned</h3><p className="mt-2 text-sm text-guard-muted">Try generating a fresh set of rubric criteria.</p><button type="button" onClick={() => void loadSuggestions()} className="focus-ring mt-4 rounded-lg border border-guard-primaryLine bg-white px-4 py-2 text-sm font-semibold text-guard-primaryHover hover:bg-guard-primarySoft">Retry</button></div>}</div>}
    </DrawerShell>
  );
}

export function CriteriaWorkspace({ workspaceSlug, project, activePrompt, criteria }: { workspaceSlug: string; project: Project; activePrompt: PromptVersion | null; criteria: EvaluationCriterion[] }) {
  const router = useRouter();
  const instructionId = useId();
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [persistedCriteria, setPersistedCriteria] = useState(criteria);
  const [reorderDraft, setReorderDraft] = useState(criteria);
  const [isReordering, setIsReordering] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [savingOrder, startOrderTransition] = useTransition();
  const triggerRef = useRef<HTMLElement | null>(null);
  const dragStartOrderRef = useRef<EvaluationCriterion[] | null>(null);
  const criteriaSignature = criteria.map((criterion) => `${criterion.id}:${criterion.updated_at}:${criterion.sort_order}`).join("|");
  const lastCriteriaSignatureRef = useRef(criteriaSignature);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  useEffect(() => {
    if (!isReordering && criteriaSignature !== lastCriteriaSignatureRef.current) {
      setPersistedCriteria(criteria);
      setReorderDraft(criteria);
      lastCriteriaSignatureRef.current = criteriaSignature;
    }
  }, [criteria, criteriaSignature, isReordering]);
  const categories = useMemo(() => Array.from(new Set(persistedCriteria.map((item) => item.category).filter((item): item is string => Boolean(item)))).sort((a, b) => a.localeCompare(b)), [persistedCriteria]);
  const visibleCriteria = useMemo(() => { const query = search.trim().toLocaleLowerCase(); return persistedCriteria.filter((item) => (!query || item.name.toLocaleLowerCase().includes(query) || item.description.toLocaleLowerCase().includes(query)) && (category === "all" || item.category === category)); }, [category, persistedCriteria, search]);
  const orderChanged = reorderDraft.some((criterion, index) => criterion.id !== persistedCriteria[index]?.id);
  function openDrawer(next: Exclude<DrawerState, null>, trigger: HTMLElement) { if (isReordering) return; triggerRef.current = trigger; setDrawer(next); }
  function closeDrawer() { setDrawer(null); window.requestAnimationFrame(() => triggerRef.current?.focus()); }
  function startReordering() { if (persistedCriteria.length < 2) return; setSearch(""); setCategory("all"); setReorderDraft(persistedCriteria); setReorderError(null); setAnnouncement("Reorder mode started. Use a drag handle to move a criterion."); setIsReordering(true); }
  function cancelReordering() { setReorderDraft(persistedCriteria); setReorderError(null); setAnnouncement("Reordering canceled. The saved order was restored."); setIsReordering(false); }
  function beginDrag() { dragStartOrderRef.current = reorderDraft; }
  function cancelDrag() {
    if (dragStartOrderRef.current) setReorderDraft(dragStartOrderRef.current);
    dragStartOrderRef.current = null;
    setAnnouncement("Active drag canceled. The draft order was restored.");
  }
  function moveCriterion(event: DragOverEvent) {
    if (!event.over || event.active.id === event.over.id || savingOrder) return;
    setReorderDraft((current) => {
      const oldIndex = current.findIndex((item) => item.id === event.active.id);
      const newIndex = current.findIndex((item) => item.id === event.over?.id);
      return oldIndex < 0 || newIndex < 0 ? current : arrayMove(current, oldIndex, newIndex);
    });
    setReorderError(null);
  }
  function finishDrag(event: DragEndEvent) { const index = reorderDraft.findIndex((item) => item.id === event.active.id); const criterion = reorderDraft[index]; dragStartOrderRef.current = null; if (criterion) setAnnouncement(`Moved “${criterion.name}” to position ${index + 1} of ${reorderDraft.length}.`); }
  function saveOrder() {
    if (!orderChanged || savingOrder) return;
    setReorderError(null);
    startOrderTransition(async () => {
      try {
        await reorderCriteria(workspaceSlug, project.id, reorderDraft.map((criterion) => criterion.id));
        const saved = reorderDraft.map((criterion, index) => ({ ...criterion, sort_order: index }));
        setPersistedCriteria(saved); setReorderDraft(saved); setAnnouncement("Criterion order saved."); setIsReordering(false); router.refresh();
      } catch (caught) { setReorderError(caught instanceof Error ? caught.message : "Criterion order could not be saved."); }
    });
  }
  const count = `${persistedCriteria.length} ${persistedCriteria.length === 1 ? "criterion" : "criteria"}`;
  const displayedCriteria = isReordering ? reorderDraft : visibleCriteria;
  return (
    <>
      <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-guard-primary">Human rubric</p><h1 className="text-3xl font-semibold tracking-tight text-guard-ink">Evaluation Criteria</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-guard-muted">Define Good, Average, and Bad for each criterion so reviewers score outputs consistently.</p></div>
        <div className="flex flex-wrap gap-3">
          <span className="group relative"><button type="button" disabled={isReordering || !activePrompt} aria-describedby={!activePrompt ? "suggest-disabled-help" : undefined} onClick={(e) => openDrawer({ type: "suggestions" }, e.currentTarget)} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-primaryHover hover:bg-guard-primarySoft disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"><Sparkles className="h-4 w-4" />Suggest with AI</button>{!activePrompt ? <span id="suggest-disabled-help" role="tooltip" className="pointer-events-none absolute right-0 top-full z-10 mt-2 hidden w-56 rounded-lg bg-guard-ink px-3 py-2 text-xs text-white shadow-floating group-hover:block group-focus-within:block">Activate a prompt version to generate suggestions.</span> : null}</span>
          <button type="button" disabled={isReordering} onClick={(e) => openDrawer({ type: "create" }, e.currentTarget)} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white hover:bg-guard-primaryHover disabled:cursor-not-allowed disabled:bg-slate-300"><Plus className="h-4 w-4" />Add criterion</button>
        </div>
      </div>
      <aside className="mb-7 flex gap-3 rounded-xl border border-guard-primaryLine bg-guard-surfaceMuted px-4 py-3.5"><Info className="mt-0.5 h-5 w-5 shrink-0 text-guard-primary" /><div><p className="text-sm font-semibold text-guard-ink">These criteria are used during Human Review</p><p className="mt-1 text-sm leading-5 text-guard-muted">Reviewers score each response using your definitions of Good, Average, and Bad.</p></div></aside>
      <section aria-labelledby="saved-criteria-heading">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div><div className="flex flex-wrap items-center gap-2.5"><h2 id="saved-criteria-heading" className="text-xl font-semibold text-guard-ink">Saved Evaluation Criteria</h2><Badge tone="primary">{count}</Badge></div><p id={instructionId} className="mt-1.5 text-sm text-guard-muted">{isReordering ? "Drag criteria into the order reviewers should see them." : "Manage the rubric reviewers use to evaluate AI responses."}</p></div>
          {persistedCriteria.length ? isReordering ? <div className="flex flex-col-reverse gap-3 sm:flex-row"><button type="button" onClick={cancelReordering} disabled={savingOrder} className="focus-ring min-h-10 rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-text hover:bg-guard-surfaceMuted disabled:opacity-50">Cancel</button><button type="button" onClick={saveOrder} disabled={!orderChanged || savingOrder} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white hover:bg-guard-primaryHover disabled:cursor-not-allowed disabled:bg-slate-300">{savingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{savingOrder ? "Saving order..." : "Save order"}</button></div> : <div className="flex flex-col gap-3 sm:flex-row"><label className="relative sm:w-64"><span className="sr-only">Search criteria</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-guard-muted" /><TextInput type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search criteria..." className="h-10 pl-9" /></label><label><span className="sr-only">Filter by category</span><Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 min-w-48"><option value="all">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</Select></label><button type="button" onClick={startReordering} disabled={persistedCriteria.length < 2} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-text hover:border-guard-primaryLine hover:bg-guard-primarySoft hover:text-guard-primaryHover disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"><ListRestart className="h-4 w-4" />Reorder</button></div> : null}
        </div>
        {reorderError ? <div role="alert" className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-guard-redSoft p-3 text-sm text-guard-red"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{reorderError}</div> : null}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={beginDrag} onDragOver={moveCriterion} onDragCancel={cancelDrag} onDragEnd={finishDrag}>
          <SortableContext items={displayedCriteria.map((criterion) => criterion.id)} strategy={verticalListSortingStrategy}>
            <div className="mt-5 grid gap-3" aria-describedby={isReordering ? instructionId : undefined} aria-busy={savingOrder}>
              {!persistedCriteria.length ? <EmptyState title="Build your human review rubric"><span>Define the standards reviewers will use to score AI responses.</span><span className="mt-5 flex flex-col justify-center gap-3 sm:flex-row"><button type="button" onClick={(e) => openDrawer({ type: "create" }, e.currentTarget)} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Add criterion</button>{activePrompt ? <button type="button" onClick={(e) => openDrawer({ type: "suggestions" }, e.currentTarget)} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-guard-primaryLine bg-white px-4 py-2 text-sm font-semibold text-guard-primaryHover"><Sparkles className="h-4 w-4" />Suggest with AI</button> : null}</span></EmptyState>
              : !displayedCriteria.length ? <EmptyState title="No criteria match your filters"><span>Try a different search or category.</span><span className="mt-5 flex justify-center"><button type="button" onClick={() => { setSearch(""); setCategory("all"); }} className="focus-ring rounded-lg border border-guard-primaryLine bg-white px-4 py-2 text-sm font-semibold text-guard-primaryHover">Clear filters</button></span></EmptyState>
              : displayedCriteria.map((criterion) => <CriterionRow key={criterion.id} criterion={criterion} workspaceSlug={workspaceSlug} projectId={project.id} editing={drawer?.type === "edit" && drawer.criterion.id === criterion.id} reorderMode={isReordering} reorderPending={savingOrder} instructionId={instructionId} onEdit={(trigger) => openDrawer({ type: "edit", criterion }, trigger)} />)}
            </div>
          </SortableContext>
        </DndContext>
        {persistedCriteria.length && !isReordering && (search || category !== "all") ? <p className="mt-3 text-xs text-guard-muted">Showing {visibleCriteria.length} of {persistedCriteria.length} criteria</p> : null}
      </section>
      <p aria-live="polite" className="sr-only">{announcement}</p>
      {drawer?.type === "create" ? <CriterionDrawer mode="create" workspaceSlug={workspaceSlug} projectId={project.id} onClose={closeDrawer} /> : null}
      {drawer?.type === "edit" ? <CriterionDrawer mode="edit" criterion={drawer.criterion} workspaceSlug={workspaceSlug} projectId={project.id} onClose={closeDrawer} /> : null}
      {drawer?.type === "suggestions" ? <SuggestionsDrawer workspaceSlug={workspaceSlug} projectId={project.id} onClose={closeDrawer} /> : null}
    </>
  );
}

function CriterionRow({ criterion, workspaceSlug, projectId, editing, reorderMode, reorderPending, instructionId, onEdit }: { criterion: EvaluationCriterion; workspaceSlug: string; projectId: string; editing: boolean; reorderMode: boolean; reorderPending: boolean; instructionId: string; onEdit: (trigger: HTMLButtonElement) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: criterion.id, disabled: !reorderMode || reorderPending });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : undefined };
  return (
    <article ref={setNodeRef} style={style} className={`criterion-sortable-row relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-4 rounded-xl border bg-white p-4 shadow-sm lg:gap-x-0 lg:gap-y-0 ${reorderMode ? "lg:grid-cols-[2rem_minmax(13rem,1.35fr)_repeat(3,minmax(9rem,1fr))]" : "lg:grid-cols-[2rem_minmax(13rem,1.35fr)_repeat(3,minmax(9rem,1fr))_5rem]"} ${isDragging ? "border-guard-primaryLine opacity-90 shadow-floating ring-2 ring-guard-primary/20" : editing ? "border-guard-primaryLine bg-guard-primarySoft/30 ring-1 ring-guard-primary/10" : "border-guard-line"}`}>
      <div className="row-span-5 flex items-start justify-center lg:row-span-1">
        {reorderMode ? <button type="button" disabled={reorderPending} {...attributes} {...listeners} aria-label={`Drag to reorder ${criterion.name}`} aria-describedby={instructionId} className="focus-ring -ml-2 flex h-9 w-9 touch-none cursor-grab items-center justify-center rounded-lg text-guard-primary hover:bg-guard-primarySoft active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"><GripVertical className="h-5 w-5" /></button> : <span role="img" aria-label="Select Reorder to change criterion order." className="-ml-2 flex h-9 w-9 items-center justify-center text-guard-muted/55"><GripVertical className="h-5 w-5" /></span>}
      </div>
      <div className="col-start-2 min-w-0 lg:col-start-auto lg:pr-5"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-guard-ink">{criterion.name}</h3>{criterion.category ? <Badge tone="primary">{criterion.category}</Badge> : null}</div><p className="mt-2 text-sm leading-5 text-guard-muted">{criterion.description}</p></div>
      <Definition tone="good" label="Good" className="col-start-2 lg:col-start-auto">{criterion.good_definition}</Definition><Definition tone="average" label="Average" className="col-start-2 lg:col-start-auto">{criterion.average_definition}</Definition><Definition tone="bad" label="Bad" className="col-start-2 lg:col-start-auto">{criterion.bad_definition}</Definition>
      {!reorderMode ? <div className="col-start-2 flex items-start justify-end gap-1 border-t border-guard-line pt-3 lg:col-start-auto lg:border-l lg:border-t-0 lg:pl-3 lg:pt-0">
        <button type="button" aria-label={`Edit ${criterion.name}`} onClick={(e) => onEdit(e.currentTarget)} className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-guard-primaryLine text-guard-primary hover:bg-guard-primarySoft"><Pencil className="h-4 w-4" /></button>
        <details className="relative"><summary aria-label={`More actions for ${criterion.name}`} className="focus-ring flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-guard-line text-guard-muted hover:bg-guard-surfaceMuted [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" /></summary><div className="absolute right-0 top-11 z-20 w-44 rounded-xl border border-guard-line bg-white p-1.5 shadow-floating"><form action={deleteCriterion}><input type="hidden" name="id" value={criterion.id} /><input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="workspace_slug" value={workspaceSlug} /><button type="submit" onClick={(e) => { if (!window.confirm(`Delete “${criterion.name}”? This criterion will no longer be available for future reviews.`)) e.preventDefault(); }} className="focus-ring flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-guard-red hover:bg-guard-redSoft"><Trash2 className="h-4 w-4" />Delete criterion</button></form></div></details>
      </div> : null}
    </article>
  );
}
