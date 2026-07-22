"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Info,
  Lightbulb,
  Loader2,
  Pencil,
  Play,
  Plus,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X
} from "lucide-react";
import { deleteTestCase, saveGeneratedTestCases, saveHumanReview, saveTestCase } from "@/app/actions";
import { CopyButton } from "@/components/copy-button";
import { Badge, EmptyState, Label, Select, TextArea, TextInput } from "@/components/ui";
import { cn } from "@/lib/utils";
import { normalizeTestCaseInput, type GeneratedSuggestion } from "@/lib/test-cases";
import type {
  EvaluationCriterion,
  HumanReview,
  HumanReviewRating,
  Project,
  PromptVariable,
  PromptVersion,
  RatingLabel,
  TestCase,
  TestCaseStatus
} from "@/lib/types";

const PAGE_SIZE = 10;
const CASE_TYPES = ["normal", "edge", "ambiguous", "missing_context", "adversarial", "tone_sensitive"] as const;
const statusLabels: Record<TestCaseStatus, string> = {
  draft: "Draft",
  generated: "Ready to Review",
  reviewed: "Reviewed"
};
const statusTones = { draft: "neutral", generated: "average", reviewed: "good" } as const;
const typeTones: Record<string, "neutral" | "primary" | "average" | "bad" | "good"> = {
  normal: "good",
  edge: "primary",
  ambiguous: "average",
  missing_context: "neutral",
  adversarial: "bad",
  tone_sensitive: "primary"
};
const ratingOptions: Record<RatingLabel, { icon: typeof ThumbsUp; iconClassName?: string; styles: string }> = {
  Good: {
    icon: ThumbsUp,
    styles: "border-guard-criterionGoodBorder bg-guard-criterionGoodSurface hover:border-green-300 hover:bg-guard-greenSoft/30 peer-checked:border-guard-green peer-checked:bg-guard-greenSoft/70 peer-checked:shadow-sm"
  },
  Average: {
    icon: ThumbsUp,
    iconClassName: "rotate-90",
    styles: "border-guard-criterionAverageBorder bg-guard-criterionAverageSurface hover:border-amber-300 hover:bg-guard-amberSoft/30 peer-checked:border-guard-amber peer-checked:bg-guard-amberSoft/70 peer-checked:shadow-sm"
  },
  Bad: {
    icon: ThumbsDown,
    styles: "border-guard-criterionBadBorder bg-guard-criterionBadSurface hover:border-red-300 hover:bg-guard-redSoft/30 peer-checked:border-guard-red peer-checked:bg-guard-redSoft/70 peer-checked:shadow-sm"
  }
};

const ratingTextStyles: Record<RatingLabel, string> = {
  Good: "text-guard-green",
  Average: "text-guard-amber",
  Bad: "text-guard-red"
};

type Toast = { tone: "success" | "error"; message: string } | null;
type StarterFilter = "all" | "selected" | "excluded";
type StarterSuggestion = GeneratedSuggestion & {
  uiId: string;
  included: boolean;
};

function caseTypeLabel(value: string | null) {
  return (value || "normal").split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function compactCaseId(id: string) {
  return `TC-${id.replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}

function initialVariableValues(schema: PromptVariable[], existing: TestCase | null) {
  const values: Record<string, string | number | boolean | null> = { ...(existing?.variable_values || {}) };
  for (const variable of schema) {
    if (values[variable.key] === undefined) values[variable.key] = variable.default_value ?? "";
  }
  return values;
}

export function DatasetWorkspace({
  workspaceSlug,
  project,
  promptVersions,
  criteria,
  testCases,
  reviews,
  ratings,
  supportedModels
}: {
  workspaceSlug: string;
  project: Project;
  promptVersions: PromptVersion[];
  criteria: EvaluationCriterion[];
  testCases: TestCase[];
  reviews: HumanReview[];
  ratings: HumanReviewRating[];
  supportedModels: string[];
}) {
  const router = useRouter();
  const activePrompt = promptVersions.find((prompt) => prompt.is_active) || promptVersions[0];
  const initialCase = testCases.find((testCase) => testCase.status === "generated") || testCases[0];
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState(initialCase?.id || "");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [promptVersionId, setPromptVersionId] = useState(activePrompt?.id || "");
  const [model, setModel] = useState(supportedModels[0] || activePrompt?.model_used || "");
  const [busy, setBusy] = useState<"run" | "starter" | "save-starter" | "save-case" | "delete" | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [caseDialog, setCaseDialog] = useState<{ mode: "add" | "edit"; testCase: TestCase | null } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<TestCase | null>(null);
  const [generatedSuggestions, setGeneratedSuggestions] = useState<StarterSuggestion[]>([]);
  const [starterPromptVersionId, setStarterPromptVersionId] = useState("");
  const [starterFilter, setStarterFilter] = useState<StarterFilter>("all");
  const [starterOpen, setStarterOpen] = useState(false);

  const visibleCases = useMemo(() => {
    const query = search.trim().toLowerCase();
    return testCases.filter((testCase) => {
      const matchesStatus = status === "all" || testCase.status === status;
      const matchesSearch = !query || testCase.user_input.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [search, status, testCases]);

  const pageCount = Math.max(1, Math.ceil(visibleCases.length / PAGE_SIZE));
  const pageCases = visibleCases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedCase = visibleCases.find((testCase) => testCase.id === selectedCaseId) || null;
  const selectedIndex = selectedCase ? visibleCases.findIndex((testCase) => testCase.id === selectedCase.id) : -1;
  const starterPrompt = promptVersions.find((prompt) => prompt.id === starterPromptVersionId);
  const includedStarterCount = generatedSuggestions.filter((suggestion) => suggestion.included).length;
  const excludedStarterCount = generatedSuggestions.length - includedStarterCount;
  const visibleStarterSuggestions = generatedSuggestions.filter((suggestion) => starterFilter === "all" || (starterFilter === "selected" ? suggestion.included : !suggestion.included));
  const starterQuestionErrors = useMemo(() => {
    const existing = new Set(testCases.map((testCase) => normalizeTestCaseInput(testCase.user_input)).filter(Boolean));
    const included = generatedSuggestions.filter((suggestion) => suggestion.included);
    const normalized = included.map((suggestion) => normalizeTestCaseInput(suggestion.user_input));
    const counts = normalized.reduce((result, value) => {
      if (value) result.set(value, (result.get(value) || 0) + 1);
      return result;
    }, new Map<string, number>());

    return Object.fromEntries(included.map((suggestion, index) => {
      const value = normalized[index];
      if (!value) return [suggestion.uiId, "Enter a question before saving."];
      if (existing.has(value)) return [suggestion.uiId, "This question already exists in the Golden Dataset."];
      if ((counts.get(value) || 0) > 1) return [suggestion.uiId, "This duplicates another included question."];
      return [suggestion.uiId, null];
    })) as Record<string, string | null>;
  }, [generatedSuggestions, testCases]);
  const starterHasBlockingErrors = includedStarterCount === 0 || Object.values(starterQuestionErrors).some(Boolean);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  useEffect(() => {
    if (selectedCaseId && visibleCases.some((testCase) => testCase.id === selectedCaseId)) return;
    const fallback = visibleCases.find((testCase) => testCase.status === "generated") || visibleCases[0];
    setSelectedCaseId(fallback?.id || "");
  }, [selectedCaseId, visibleCases]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => testCases.some((testCase) => testCase.id === id)));
  }, [testCases]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function changeStatus(nextStatus: string) {
    setStatus(nextStatus);
    setPage(1);
  }

  function changeSearch(nextSearch: string) {
    setSearch(nextSearch);
    setPage(1);
  }

  async function runCases(ids: string[]) {
    if (!ids.length || !promptVersionId || !model) return;
    setBusy("run");
    setToast(null);
    try {
      const response = await fetch("/api/ai/generate-output", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_slug: workspaceSlug,
          project_id: project.id,
          test_case_ids: ids,
          prompt_version_id: promptVersionId,
          model
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not run AI outputs.");
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setSelectedCaseId(ids[0]);
      setToast({ tone: "success", message: ids.length === 1 ? "AI output generated. This case is ready to review." : `${ids.length} AI outputs generated and ready to review.` });
      router.refresh();
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not run AI outputs." });
    } finally {
      setBusy(null);
    }
  }

  async function generateStarterSet() {
    setBusy("starter");
    setToast(null);
    try {
      const response = await fetch("/api/ai/generate-test-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_slug: workspaceSlug, project_id: project.id, prompt_version_id: promptVersionId })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not generate a starter set.");
      if (!json.test_cases?.length) throw new Error("No unique starter test cases were generated. Try again after updating the prompt or dataset.");
      setGeneratedSuggestions((json.test_cases as GeneratedSuggestion[]).map((suggestion) => ({
        ...suggestion,
        uiId: window.crypto.randomUUID(),
        included: true
      })));
      setStarterPromptVersionId(json.prompt_version_id);
      setStarterFilter("all");
      setStarterOpen(true);
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not generate a starter set." });
    } finally {
      setBusy(null);
    }
  }

  async function saveStarterSet() {
    setBusy("save-starter");
    try {
      const includedSuggestions: GeneratedSuggestion[] = generatedSuggestions.filter((suggestion) => suggestion.included).map(({ user_input, case_type, rationale }) => ({ user_input, case_type, rationale }));
      const result = await saveGeneratedTestCases(workspaceSlug, project.id, starterPromptVersionId, includedSuggestions);
      setStarterOpen(false);
      setGeneratedSuggestions([]);
      setStarterPromptVersionId("");
      setStarterFilter("all");
      setToast({
        tone: "success",
        message: result.skippedDuplicateCount
          ? `${result.insertedCount} test ${result.insertedCount === 1 ? "case" : "cases"} added. ${result.skippedDuplicateCount} ${result.skippedDuplicateCount === 1 ? "duplicate was" : "duplicates were"} skipped.`
          : `${result.insertedCount} test ${result.insertedCount === 1 ? "case" : "cases"} added to Golden Dataset.`
      });
      router.refresh();
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not save generated cases." });
    } finally {
      setBusy(null);
    }
  }

  async function submitCase(formData: FormData) {
    setBusy("save-case");
    try {
      await saveTestCase(formData);
      const mode = caseDialog?.mode;
      setCaseDialog(null);
      setToast({ tone: "success", message: mode === "edit" ? "Test case updated. Generate a fresh output before reviewing." : "Test case added to the queue." });
      router.refresh();
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not save the test case." });
    } finally {
      setBusy(null);
    }
  }

  async function confirmDelete() {
    if (!deleteDialog) return;
    setBusy("delete");
    const formData = new FormData();
    formData.set("id", deleteDialog.id);
    formData.set("project_id", project.id);
    formData.set("workspace_slug", workspaceSlug);
    try {
      await deleteTestCase(formData);
      setDeleteDialog(null);
      setToast({ tone: "success", message: "Test case deleted." });
      router.refresh();
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Could not delete the test case." });
    } finally {
      setBusy(null);
    }
  }

  const reviewedCount = testCases.filter((testCase) => testCase.status === "reviewed").length;
  const readyCount = testCases.filter((testCase) => testCase.status === "generated").length;

  return (
    <div className="pb-8">
      <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-guard-ink">Golden Dataset</h1>
          <p className="mt-2 text-sm leading-6 text-guard-muted">Create, run, and review test cases in one workflow.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="min-w-36">
            <span className="mb-1 block text-xs font-medium text-guard-muted">Status</span>
            <Select aria-label="Filter test cases by status" value={status} onChange={(event) => changeStatus(event.target.value)}>
              <option value="all">All ({testCases.length})</option>
              <option value="draft">Draft</option>
              <option value="generated">Ready to Review</option>
              <option value="reviewed">Reviewed</option>
            </Select>
          </div>
          <div className="min-w-44">
            <span className="mb-1 block text-xs font-medium text-guard-muted">Prompt Version</span>
            <Select aria-label="Prompt version" value={promptVersionId} onChange={(event) => setPromptVersionId(event.target.value)}>
              {promptVersions.map((prompt) => <option key={prompt.id} value={prompt.id}>v{prompt.version_number}{prompt.is_active ? " (Active)" : ""}</option>)}
            </Select>
          </div>
          <div className="min-w-36">
            <span className="mb-1 block text-xs font-medium text-guard-muted">Model</span>
            <Select aria-label="AI model" value={model} onChange={(event) => setModel(event.target.value)}>
              {supportedModels.map((supportedModel) => <option key={supportedModel} value={supportedModel}>{supportedModel}</option>)}
            </Select>
          </div>
          <button type="button" onClick={generateStarterSet} disabled={busy !== null || !promptVersionId} className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-guard-primaryLine bg-white px-3.5 text-sm font-semibold text-guard-primaryHover transition hover:bg-guard-primarySoft disabled:cursor-not-allowed disabled:border-guard-line disabled:text-slate-400">
            {busy === "starter" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate Starter Set
          </button>
          <button type="button" onClick={() => runCases(selectedIds)} disabled={busy !== null || !selectedIds.length || !promptVersionId || !model} className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-guard-primary px-4 text-sm font-semibold text-white transition hover:bg-guard-primaryHover disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">
            {busy === "run" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run Selected{selectedIds.length ? ` (${selectedIds.length})` : ""}
          </button>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.7fr)]">
        <section aria-labelledby="queue-title" className="overflow-hidden rounded-xl border border-guard-line bg-white shadow-card">
          <div className="border-b border-guard-line px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h2 id="queue-title" className="font-semibold text-guard-ink">Test Case Queue</h2>
                <Badge tone="primary">{testCases.length}</Badge>
              </div>
              <button type="button" onClick={() => setCaseDialog({ mode: "add", testCase: null })} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-guard-primaryLine bg-white px-2.5 py-1.5 text-xs font-semibold text-guard-primaryHover transition hover:bg-guard-primarySoft"><Plus className="h-3.5 w-3.5" /> Add</button>
            </div>
            <p className="mt-2 text-xs text-guard-muted"><span className="font-semibold text-guard-amber">{readyCount}</span> ready · <span className="font-semibold text-guard-green">{reviewedCount}</span> reviewed</p>
            <div className="relative mt-4">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-guard-muted" />
              <TextInput aria-label="Search test cases" value={search} onChange={(event) => changeSearch(event.target.value)} placeholder="Search test cases..." className="pl-9" />
            </div>
          </div>

          <div className="grid grid-cols-[1.4rem_minmax(0,1fr)_auto_4.5rem] items-center gap-2 border-b border-guard-line bg-guard-surfaceMuted/60 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-guard-muted">
            <input
              aria-label="Select all test cases on this page"
              type="checkbox"
              checked={pageCases.length > 0 && pageCases.every((testCase) => selectedIds.includes(testCase.id))}
              onChange={(event) => {
                const pageIds = pageCases.map((testCase) => testCase.id);
                setSelectedIds((current) => event.target.checked ? [...new Set([...current, ...pageIds])] : current.filter((id) => !pageIds.includes(id)));
              }}
              className="h-4 w-4 rounded border-guard-lineStrong accent-guard-primary"
            />
            <span>User Input</span><span>Status</span><span className="text-right">Actions</span>
          </div>

          {pageCases.length ? (
            <div>
              {pageCases.map((testCase) => (
                <div key={testCase.id} className={cn("grid grid-cols-[1.4rem_minmax(0,1fr)_auto_4.5rem] items-center gap-2 border-b border-guard-line px-4 py-3 transition", selectedCase?.id === testCase.id ? "bg-guard-primarySoft" : "bg-white hover:bg-guard-surfaceMuted/70")}>
                  <input
                    aria-label={`Select ${compactCaseId(testCase.id)} to run`}
                    type="checkbox"
                    checked={selectedIds.includes(testCase.id)}
                    onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, testCase.id] : current.filter((id) => id !== testCase.id))}
                    className="h-4 w-4 rounded border-guard-lineStrong accent-guard-primary"
                  />
                  <button type="button" onClick={() => setSelectedCaseId(testCase.id)} className="focus-ring min-w-0 rounded-md text-left">
                    <span className="line-clamp-2 text-sm leading-5 text-guard-ink">{testCase.user_input}</span>
                    <span className="mt-1 block text-[11px] text-guard-muted">{compactCaseId(testCase.id)} · {caseTypeLabel(testCase.case_type)}</span>
                  </button>
                  <Badge tone={statusTones[testCase.status]}>{statusLabels[testCase.status]}</Badge>
                  <div className="flex justify-end gap-1">
                    <button type="button" onClick={() => setCaseDialog({ mode: "edit", testCase })} aria-label={`Edit ${compactCaseId(testCase.id)}`} className="focus-ring rounded-md p-2 text-guard-muted transition hover:bg-white hover:text-guard-primary"><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => setDeleteDialog(testCase)} aria-label={`Delete ${compactCaseId(testCase.id)}`} className="focus-ring rounded-md p-2 text-guard-muted transition hover:bg-guard-redSoft hover:text-guard-red"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5"><EmptyState title={testCases.length ? "No matching test cases" : "No test cases yet"}>{testCases.length ? "Adjust the status filter or search query." : "Add a test case manually or generate a starter set."}</EmptyState></div>
          )}

          <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-guard-muted">
            <span>{visibleCases.length ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, visibleCases.length)} of ${visibleCases.length}` : "0 cases"}</span>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="focus-ring rounded-md p-2 hover:bg-guard-primarySoft disabled:cursor-not-allowed disabled:opacity-35"><ChevronLeft className="h-4 w-4" /></button>
              <span className="rounded-md bg-guard-primarySoft px-2.5 py-1 font-semibold text-guard-primaryHover">{page}</span>
              <span>of {pageCount}</span>
              <button type="button" aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="focus-ring rounded-md p-2 hover:bg-guard-primarySoft disabled:cursor-not-allowed disabled:opacity-35"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </section>

        <ReviewPanel
          workspaceSlug={workspaceSlug}
          projectId={project.id}
          selected={selectedCase}
          criteria={criteria}
          reviews={reviews}
          ratings={ratings}
          promptVersions={promptVersions}
          busy={busy}
          onRun={(id) => runCases([id])}
          onSaved={() => {
            setToast({ tone: "success", message: selectedCase?.status === "reviewed" ? "Review updated." : "Case marked as reviewed." });
            router.refresh();
          }}
          onError={(message) => setToast({ tone: "error", message })}
          onPrevious={selectedIndex > 0 ? () => setSelectedCaseId(visibleCases[selectedIndex - 1].id) : undefined}
          onNext={selectedIndex >= 0 && selectedIndex < visibleCases.length - 1 ? () => setSelectedCaseId(visibleCases[selectedIndex + 1].id) : undefined}
        />
      </div>

      {caseDialog ? (
        <CaseEditorDialog
          mode={caseDialog.mode}
          testCase={caseDialog.testCase}
          projectId={project.id}
          workspaceSlug={workspaceSlug}
          prompt={promptVersions.find((prompt) => prompt.id === promptVersionId) || activePrompt}
          pending={busy === "save-case"}
          onClose={() => setCaseDialog(null)}
          onSubmit={submitCase}
        />
      ) : null}

      {deleteDialog ? (
        <Modal title="Delete test case?" description="This removes the test case, its current review, and its generated-output history. This action cannot be undone." onClose={() => setDeleteDialog(null)}>
          <div className="rounded-lg border border-guard-line bg-guard-surfaceMuted p-4 text-sm leading-6 text-guard-ink">{deleteDialog.user_input}</div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setDeleteDialog(null)} className="focus-ring rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-text hover:bg-guard-surfaceMuted">Cancel</button>
            <button type="button" onClick={confirmDelete} disabled={busy === "delete"} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-guard-red px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">{busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete test case</button>
          </div>
        </Modal>
      ) : null}

      {starterOpen ? (
        <Modal
          title="Review starter set"
          titleIcon={<Sparkles className="h-5 w-5" />}
          titleMeta={<Badge tone="primary">Prompt v{starterPrompt?.version_number ?? "?"}</Badge>}
          description={`Review cases generated from Prompt v${starterPrompt?.version_number ?? "?"}. Edit questions before saving; rationales are for review only. Prompt variable values can be added later when editing a saved test case.`}
          onClose={() => setStarterOpen(false)}
          closeDisabled={busy === "save-starter"}
          extraWide
          bodyClassName="bg-guard-surfaceMuted/30 px-4 py-4 sm:px-5"
          toolbar={
            <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between sm:px-6">
              <div className="flex items-center gap-3 lg:min-w-48">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-guard-primarySoft text-guard-primary"><Database className="h-4 w-4" /></span>
                <div><p className="text-sm font-semibold text-guard-ink">{generatedSuggestions.length} {generatedSuggestions.length === 1 ? "case" : "cases"}</p><p className="text-xs text-guard-muted">Generated with Prompt v{starterPrompt?.version_number ?? "?"}</p></div>
              </div>
              <div className="flex flex-wrap items-center gap-2" aria-label="Filter generated cases">
                {([
                  ["all", "All", generatedSuggestions.length],
                  ["selected", "Selected", includedStarterCount],
                  ["excluded", "Excluded", excludedStarterCount]
                ] as const).map(([value, label, count]) => <button key={value} type="button" aria-pressed={starterFilter === value} onClick={() => setStarterFilter(value)} className={cn("focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition", starterFilter === value ? "border-guard-primaryLine bg-guard-primarySoft text-guard-primaryHover" : "border-guard-line bg-white text-guard-muted hover:border-guard-primaryLine hover:text-guard-primaryHover")}>{label} <span className="ml-1">{count}</span></button>)}
              </div>
              <div className="flex flex-wrap items-center gap-x-1 gap-y-2 lg:justify-end">
                <button type="button" onClick={() => setGeneratedSuggestions((current) => current.map((suggestion) => ({ ...suggestion, included: true })))} className="focus-ring rounded-lg px-3 py-2 text-xs font-semibold text-guard-primary hover:bg-guard-primarySoft">Select all</button>
                <button type="button" onClick={() => setGeneratedSuggestions((current) => current.map((suggestion) => ({ ...suggestion, included: false })))} className="focus-ring rounded-lg px-3 py-2 text-xs font-semibold text-guard-primary hover:bg-guard-primarySoft">Deselect all</button>
              </div>
            </div>
          }
          footer={
            <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className={cn("text-sm font-semibold", starterHasBlockingErrors && includedStarterCount > 0 ? "text-guard-red" : "text-guard-ink")}><span>{includedStarterCount} selected</span><span className="mx-2 text-guard-lineStrong">•</span><span className="font-normal text-guard-muted">{excludedStarterCount} excluded</span></p>
                <p className="mt-0.5 text-xs text-guard-muted">{starterHasBlockingErrors && includedStarterCount > 0 ? "Resolve empty or duplicate included questions before saving." : `${generatedSuggestions.length} total ${generatedSuggestions.length === 1 ? "case" : "cases"}`}</p>
              </div>
              <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row">
                <button type="button" onClick={() => setStarterOpen(false)} disabled={busy === "save-starter"} className="focus-ring min-h-10 rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-text hover:bg-guard-surfaceMuted disabled:opacity-50">Cancel</button>
                <button type="button" onClick={saveStarterSet} disabled={starterHasBlockingErrors || busy === "save-starter"} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-guard-primary px-5 py-2 text-sm font-semibold text-white hover:bg-guard-primaryHover disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">{busy === "save-starter" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {busy === "save-starter" ? "Saving..." : `Save ${includedStarterCount} to Golden Dataset`}</button>
              </div>
            </div>
          }
        >
          {visibleStarterSuggestions.length ? (
            <div className="space-y-3">
              {visibleStarterSuggestions.map((suggestion) => (
                <StarterSuggestionCard
                  key={suggestion.uiId}
                  suggestion={suggestion}
                  caseNumber={generatedSuggestions.findIndex((item) => item.uiId === suggestion.uiId) + 1}
                  error={starterQuestionErrors[suggestion.uiId]}
                  onChange={(update) => setGeneratedSuggestions((current) => current.map((item) => item.uiId === suggestion.uiId ? { ...item, ...update } : item))}
                  onRemove={() => setGeneratedSuggestions((current) => current.filter((item) => item.uiId !== suggestion.uiId))}
                />
              ))}
            </div>
          ) : <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-guard-lineStrong bg-white px-6 text-center text-sm text-guard-muted">No {starterFilter} cases match this filter.</div>}
        </Modal>
      ) : null}

      {toast ? (
        <div role={toast.tone === "error" ? "alert" : "status"} aria-live="polite" className={cn("fixed bottom-5 right-5 z-50 flex max-w-md items-start gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-floating", toast.tone === "success" ? "border-green-200 text-guard-green" : "border-red-200 text-guard-red")}>
          {toast.tone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}<span>{toast.message}</span><button type="button" onClick={() => setToast(null)} aria-label="Dismiss message" className="focus-ring ml-1 rounded p-0.5"><X className="h-4 w-4" /></button>
        </div>
      ) : null}
    </div>
  );
}

function ReviewPanel({
  workspaceSlug,
  projectId,
  selected,
  criteria,
  reviews,
  ratings,
  promptVersions,
  busy,
  onRun,
  onSaved,
  onError,
  onPrevious,
  onNext
}: {
  workspaceSlug: string;
  projectId: string;
  selected: TestCase | null;
  criteria: EvaluationCriterion[];
  reviews: HumanReview[];
  ratings: HumanReviewRating[];
  promptVersions: PromptVersion[];
  busy: string | null;
  onRun: (id: string) => void;
  onSaved: () => void;
  onError: (message: string) => void;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  if (!selected) {
    return <section aria-labelledby="review-title" className="rounded-xl border border-guard-line bg-white p-5 shadow-card"><h2 id="review-title" className="font-semibold text-guard-ink">Review Panel</h2><div className="mt-5"><EmptyState title="No test case selected">Choose a visible test case from the queue to inspect and review it.</EmptyState></div></section>;
  }

  const review = reviews.find((candidate) => candidate.test_case_id === selected.id);
  const reviewRatings = ratings.filter((rating) => rating.review_id === review?.id);
  const prompt = promptVersions.find((candidate) => candidate.id === selected.prompt_version_id);
  const hasOutput = Boolean(selected.generated_ai_output) && selected.status !== "draft";

  return (
    <section aria-labelledby="review-title" className="overflow-hidden rounded-xl border border-guard-line bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-guard-line px-5 py-4">
        <h2 id="review-title" className="font-semibold text-guard-ink">Review Panel</h2>
        <div className="flex items-center gap-2 text-xs text-guard-muted"><span>Case ID: <strong className="font-semibold text-guard-text">{compactCaseId(selected.id)}</strong></span><button type="button" aria-label="Previous test case" onClick={onPrevious} disabled={!onPrevious} className="focus-ring rounded-md p-1.5 hover:bg-guard-primarySoft disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button><button type="button" aria-label="Next test case" onClick={onNext} disabled={!onNext} className="focus-ring rounded-md p-1.5 hover:bg-guard-primarySoft disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button></div>
      </div>

      <div className="space-y-5 p-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-guard-ink">User Input</h3>
          <div className="relative rounded-xl border border-guard-primaryLine/70 bg-guard-surfaceMuted px-4 py-3 pr-16 text-sm leading-6 text-guard-ink">
            <CopyButton text={selected.user_input} contextLabel="user input" iconOnly className="absolute right-3 top-1/2 -translate-y-1/2" />
            {selected.user_input}
          </div>
        </div>

        {hasOutput ? (
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-guard-ink">AI Output</h3><Badge tone="neutral">{selected.model_used || "Model unknown"}</Badge><Badge tone="primary">{prompt ? `v${prompt.version_number}` : "Prompt unknown"}</Badge><span className="text-xs font-medium text-guard-green">{selected.status === "reviewed" ? "Reviewed" : "Output ready"}</span></div>
            <div className="relative whitespace-pre-wrap rounded-xl border border-green-100 bg-green-50/60 px-4 py-4 pr-16 text-sm leading-7 text-guard-ink">
              <CopyButton text={selected.generated_ai_output || ""} contextLabel="AI output" iconOnly tone="green" className="absolute right-3 top-3" />
              {selected.generated_ai_output}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-guard-primaryLine bg-guard-surfaceMuted p-7 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-guard-primary shadow-card"><Database className="h-5 w-5" /></div>
            <h3 className="mt-3 font-semibold text-guard-ink">No output yet</h3><p className="mt-1 text-sm text-guard-muted">Run this case to generate an output before reviewing.</p>
            <button type="button" onClick={() => onRun(selected.id)} disabled={busy !== null} className="focus-ring mt-4 inline-flex items-center gap-2 rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white hover:bg-guard-primaryHover disabled:bg-slate-300">{busy === "run" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run this case</button>
          </div>
        )}

        {hasOutput ? (
          criteria.length ? (
            <ReviewForm key={`${selected.id}-${review?.reviewed_at || "new"}`} workspaceSlug={workspaceSlug} projectId={projectId} testCase={selected} criteria={criteria} review={review} savedRatings={reviewRatings} onSaved={onSaved} onError={onError} />
          ) : (
            <div className="rounded-xl border border-dashed border-guard-primaryLine bg-guard-surfaceMuted p-7 text-center"><Info className="mx-auto h-6 w-6 text-guard-primary" /><h3 className="mt-3 font-semibold text-guard-ink">No evaluation criteria</h3><p className="mt-1 text-sm text-guard-muted">Add criteria before this output can be reviewed.</p><Link href={`/workspaces/${workspaceSlug}/projects/${projectId}/criteria`} className="focus-ring mt-4 inline-flex rounded-lg border border-guard-primaryLine bg-white px-4 py-2 text-sm font-semibold text-guard-primaryHover hover:bg-guard-primarySoft">Go to Evaluation Criteria</Link></div>
          )
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-guard-line bg-guard-surfaceMuted px-4 py-3 text-sm text-guard-muted"><Info className="h-4 w-4 shrink-0" /> Review controls unlock after a valid AI output is generated.</div>
        )}
      </div>
    </section>
  );
}

function ReviewForm({ workspaceSlug, projectId, testCase, criteria, review, savedRatings, onSaved, onError }: { workspaceSlug: string; projectId: string; testCase: TestCase; criteria: EvaluationCriterion[]; review?: HumanReview; savedRatings: HumanReviewRating[]; onSaved: () => void; onError: (message: string) => void }) {
  const [pending, setPending] = useState(false);
  const [selectedRatings, setSelectedRatings] = useState<Record<string, RatingLabel>>(Object.fromEntries(savedRatings.map((rating) => [rating.criterion_id, rating.rating_label])));
  const complete = criteria.every((criterion) => selectedRatings[criterion.id]);
  const hasSelectedRatings = Object.keys(selectedRatings).length > 0;

  function clearCriterionRating(criterionId: string) {
    setSelectedRatings((current) => {
      const next = { ...current };
      delete next[criterionId];
      return next;
    });
  }

  async function submit(formData: FormData) {
    setPending(true);
    try {
      await saveHumanReview(formData);
      onSaved();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not save this review.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submit} className="space-y-5">
      <input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="workspace_slug" value={workspaceSlug} /><input type="hidden" name="test_case_id" value={testCase.id} />
      <div className="grid gap-4 xl:grid-cols-2">
        {criteria.map((criterion) => (
          <fieldset key={criterion.id} className="min-w-0 rounded-xl border border-guard-line bg-white p-4 sm:p-5">
            <legend className="sr-only">{criterion.name}</legend>
            <div className="relative min-h-8">
              <h3 className="min-w-0 pr-24 text-sm font-semibold leading-5 text-guard-ink">{criterion.name}</h3>
              {selectedRatings[criterion.id] ? <button type="button" disabled={pending} onClick={() => clearCriterionRating(criterion.id)} aria-label={`Clear rating for ${criterion.name}`} className="focus-ring absolute -top-2 right-0 inline-flex h-8 items-center rounded-lg px-2 text-xs font-semibold text-guard-primary transition hover:bg-guard-primarySoft hover:text-guard-primaryHover disabled:cursor-not-allowed disabled:text-slate-400">Clear Rating</button> : null}
            </div>
            <p className="mt-1 text-xs leading-5 text-guard-muted">{criterion.description}</p>
            <div className="mt-4 space-y-2.5">
              <RatingDefinitionOption criterion={criterion} rating="Good" selectedRating={selectedRatings[criterion.id]} onSelect={(rating) => setSelectedRatings((current) => ({ ...current, [criterion.id]: rating }))} />
              <RatingDefinitionOption criterion={criterion} rating="Average" selectedRating={selectedRatings[criterion.id]} onSelect={(rating) => setSelectedRatings((current) => ({ ...current, [criterion.id]: rating }))} />
              <RatingDefinitionOption criterion={criterion} rating="Bad" selectedRating={selectedRatings[criterion.id]} onSelect={(rating) => setSelectedRatings((current) => ({ ...current, [criterion.id]: rating }))} />
            </div>
          </fieldset>
        ))}
      </div>

      <div className="border-t border-guard-line pt-5">
        <Label>Human Notes</Label>
        <TextArea name="human_notes" defaultValue={review?.human_notes || ""} placeholder="Explain what worked, what failed, and why you gave these ratings." maxLength={1000} className="mt-2 min-h-32 w-full" />
      </div>
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-guard-line bg-guard-surfaceMuted/95 px-4 py-3 shadow-card backdrop-blur-sm">
        <p className="text-xs text-guard-muted">{complete ? "All criteria rated. Ready to save." : `Rate all ${criteria.length} criteria to continue.`}</p>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <button type="button" aria-label="Clear all selected ratings" disabled={!hasSelectedRatings || pending} onClick={() => setSelectedRatings({})} className="focus-ring min-h-10 rounded-lg px-3 text-sm font-semibold text-guard-primaryHover transition hover:bg-white/80 disabled:cursor-not-allowed disabled:text-slate-400">Clear Ratings</button>
          <button type="submit" disabled={!complete || pending} className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-lg bg-guard-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-guard-primaryHover disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{pending ? "Saving review..." : review ? "Update Review" : "Mark as Reviewed"}</button>
        </div>
      </div>
    </form>
  );
}

function RatingDefinitionOption({ criterion, rating, selectedRating, onSelect }: { criterion: EvaluationCriterion; rating: RatingLabel; selectedRating?: RatingLabel; onSelect: (rating: RatingLabel) => void }) {
  const option = ratingOptions[rating];
  const RatingIcon = option.icon;
  const definition = rating === "Good" ? criterion.good_definition : rating === "Average" ? criterion.average_definition : criterion.bad_definition;

  return (
    <label className="block min-w-0 cursor-pointer">
      <input
        className="peer sr-only"
        required
        type="radio"
        name={`rating_${criterion.id}`}
        value={rating}
        aria-label={`${rating}: ${definition}`}
        checked={selectedRating === rating}
        onChange={() => onSelect(rating)}
      />
      <span className={cn("flex min-h-12 items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs leading-5 text-guard-text transition peer-focus-visible:ring-2 peer-focus-visible:ring-guard-primary/70 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white sm:gap-3", option.styles)}>
        <RatingIcon aria-hidden="true" className={cn("mt-0.5 h-4 w-4 shrink-0", ratingTextStyles[rating], option.iconClassName)} />
        <span className="min-w-0">
          <span className={cn("font-semibold", ratingTextStyles[rating])}>{rating}</span>
          <span aria-hidden="true" className="mx-1.5 text-guard-muted">—</span>
          <span>{definition}</span>
        </span>
      </span>
    </label>
  );
}

function CaseEditorDialog({ mode, testCase, projectId, workspaceSlug, prompt, pending, onClose, onSubmit }: { mode: "add" | "edit"; testCase: TestCase | null; projectId: string; workspaceSlug: string; prompt?: PromptVersion; pending: boolean; onClose: () => void; onSubmit: (formData: FormData) => void }) {
  const schema = prompt?.variable_schema || [];
  const [variableValues, setVariableValues] = useState(() => initialVariableValues(schema, testCase));

  return (
    <Modal title={mode === "edit" ? "Edit test case" : "Add test case"} description={mode === "edit" ? "Updating the case invalidates its current output and review so the next rating always matches fresh content." : "Add a focused input to the Golden Dataset queue."} onClose={onClose} wide>
      <form action={(formData) => { formData.set("variable_values", JSON.stringify(variableValues)); onSubmit(formData); }} className="space-y-5">
        <input type="hidden" name="id" value={testCase?.id || ""} /><input type="hidden" name="project_id" value={projectId} /><input type="hidden" name="workspace_slug" value={workspaceSlug} />
        <div><Label>User Input</Label><TextArea autoFocus required name="user_input" defaultValue={testCase?.user_input || ""} placeholder="Enter the message or scenario to evaluate." className="mt-2 min-h-32" /></div>
        <div><Label>Case Type</Label><Select name="case_type" defaultValue={testCase?.case_type || "normal"} className="mt-2">{CASE_TYPES.map((caseType) => <option key={caseType} value={caseType}>{caseTypeLabel(caseType)}</option>)}</Select></div>
        {schema.length ? (
          <fieldset className="rounded-xl border border-guard-line bg-guard-surfaceMuted p-4"><legend className="px-1 text-sm font-semibold text-guard-ink">Prompt Variables · {prompt ? `v${prompt.version_number}` : "Selected version"}</legend><p className="mb-4 mt-1 text-xs leading-5 text-guard-muted">Values are stored with this case and inserted into the selected prompt when it runs.</p><div className="grid gap-4 sm:grid-cols-2">{schema.map((variable) => <VariableField key={variable.key} variable={variable} value={variableValues[variable.key]} onChange={(value) => setVariableValues((current) => ({ ...current, [variable.key]: value }))} />)}</div></fieldset>
        ) : null}
        <div className="flex justify-end gap-3 border-t border-guard-line pt-5"><button type="button" onClick={onClose} className="focus-ring rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-text hover:bg-guard-surfaceMuted">Cancel</button><button type="submit" disabled={pending} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white hover:bg-guard-primaryHover disabled:bg-slate-300">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{pending ? "Saving..." : mode === "edit" ? "Update Test Case" : "Add Test Case"}</button></div>
      </form>
    </Modal>
  );
}

function StarterSuggestionCard({ suggestion, caseNumber, error, onChange, onRemove }: {
  suggestion: StarterSuggestion;
  caseNumber: number;
  error?: string | null;
  onChange: (update: Partial<StarterSuggestion>) => void;
  onRemove: () => void;
}) {
  const questionId = `starter-question-${suggestion.uiId}`;
  const questionErrorId = `starter-question-error-${suggestion.uiId}`;

  return (
    <article className={cn("rounded-xl border bg-white p-4 transition sm:p-5", suggestion.included ? "border-guard-primaryLine shadow-sm" : "border-guard-line opacity-80")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="checkbox"
            checked={suggestion.included}
            onChange={(event) => onChange({ included: event.target.checked })}
            aria-label={`${suggestion.included ? "Exclude" : "Include"} generated case ${caseNumber} ${suggestion.included ? "from" : "in"} Golden Dataset`}
            className="focus-ring h-4 w-4 rounded border-guard-lineStrong accent-guard-primary"
          />
          <span aria-hidden="true" className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-guard-line bg-white px-1.5 text-xs font-semibold text-guard-primary">{caseNumber}</span>
          <Badge tone={typeTones[suggestion.case_type] || "neutral"}>{caseTypeLabel(suggestion.case_type)}</Badge>
        </div>
        <button type="button" onClick={onRemove} aria-label={`Remove generated case ${caseNumber}: ${suggestion.user_input || "untitled question"}`} className="focus-ring -mr-1 -mt-1 shrink-0 rounded-md p-2 text-guard-muted hover:bg-guard-surfaceMuted hover:text-guard-red"><X className="h-4 w-4" /></button>
      </div>

      <div className="mt-4 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(12rem,1fr)]">
        <div className="min-w-0">
          <label htmlFor={questionId} className="text-xs font-semibold text-guard-text">Question</label>
          <TextArea id={questionId} value={suggestion.user_input} aria-invalid={Boolean(error)} aria-describedby={error ? questionErrorId : undefined} onChange={(event) => onChange({ user_input: event.target.value })} className={cn("mt-1.5 min-h-24 resize-y", error && "border-guard-red hover:border-guard-red")} />
          {error ? <p id={questionErrorId} role="alert" className="mt-1.5 text-xs leading-5 text-guard-red">{error}</p> : null}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold text-guard-text">Why suggested</p>
          <div className="mt-2 flex items-start gap-2 text-xs leading-5 text-guard-muted"><Lightbulb aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-guard-primary" /><p>{suggestion.rationale}</p></div>
        </div>
      </div>
    </article>
  );
}

function VariableField({ variable, value, onChange, idPrefix = "test-case-variable" }: { variable: PromptVariable; value: string | number | boolean | null; onChange: (value: string | number | boolean | null) => void; idPrefix?: string }) {
  const inputId = `${idPrefix}-${variable.key}`;
  return <div className={variable.type === "long_text" ? "sm:col-span-2" : ""}><label htmlFor={inputId} className="text-sm font-medium text-guard-text">{variable.label}{variable.required ? <span className="text-guard-red"> *</span> : null}</label>{variable.type === "long_text" ? <TextArea id={inputId} required={variable.required} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-24" /> : variable.type === "boolean" ? <Select id={inputId} required={variable.required} value={value === true || value === "true" ? "true" : value === false || value === "false" ? "false" : ""} onChange={(event) => onChange(event.target.value === "" ? null : event.target.value === "true")} className="mt-2"><option value="">Select a value</option><option value="true">True</option><option value="false">False</option></Select> : variable.type === "select" ? <Select id={inputId} required={variable.required} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-2"><option value="">Select an option</option>{variable.options.map((option) => <option key={option} value={option}>{option}</option>)}</Select> : <TextInput id={inputId} type={variable.type === "number" ? "number" : "text"} required={variable.required} value={String(value ?? "")} onChange={(event) => onChange(variable.type === "number" ? event.target.value === "" ? null : Number(event.target.value) : event.target.value)} className="mt-2" />}{variable.description ? <p className="mt-1 text-xs leading-5 text-guard-muted">{variable.description}</p> : null}</div>;
}


function Modal({ title, description, onClose, children, wide = false, extraWide = false, closeDisabled = false, titleIcon, titleMeta, toolbar, footer, bodyClassName }: { title: string; description: string; onClose: () => void; children: React.ReactNode; wide?: boolean; extraWide?: boolean; closeDisabled?: boolean; titleIcon?: React.ReactNode; titleMeta?: React.ReactNode; toolbar?: React.ReactNode; footer?: React.ReactNode; bodyClassName?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return <dialog ref={ref} aria-labelledby="workspace-dialog-title" aria-describedby="workspace-dialog-description" onCancel={(event) => { event.preventDefault(); if (!closeDisabled) onClose(); }} className={cn("m-auto max-h-[90dvh] w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-guard-line bg-white p-0 text-guard-text shadow-floating backdrop:bg-slate-950/25", extraWide ? "max-w-6xl" : wide ? "max-w-3xl" : "max-w-lg")}><div className="flex max-h-[90dvh] flex-col"><header className="flex shrink-0 items-start justify-between gap-4 border-b border-guard-line px-5 py-5 sm:px-6"><div className="flex min-w-0 items-start gap-3">{titleIcon ? <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-guard-primarySoft text-guard-primary">{titleIcon}</span> : null}<div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 id="workspace-dialog-title" className="text-xl font-semibold tracking-tight text-guard-ink">{title}</h2>{titleMeta}</div><p id="workspace-dialog-description" className="mt-1 text-sm leading-6 text-guard-muted">{description}</p></div></div><button type="button" onClick={onClose} disabled={closeDisabled} aria-label="Close dialog" className="focus-ring shrink-0 rounded-lg p-2 text-guard-muted hover:bg-guard-primarySoft hover:text-guard-primary disabled:cursor-not-allowed disabled:opacity-40"><X className="h-5 w-5" /></button></header>{toolbar ? <div className="shrink-0 border-b border-guard-line bg-white">{toolbar}</div> : null}<div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6", bodyClassName)}>{children}</div>{footer ? <footer className="shrink-0 border-t border-guard-line bg-white/95 shadow-[0_-8px_24px_rgba(54,39,97,0.05)] backdrop-blur-sm">{footer}</footer> : null}</div></dialog>;
}
