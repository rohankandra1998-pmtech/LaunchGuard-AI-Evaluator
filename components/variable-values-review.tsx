"use client";

import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Info, Search, Tag, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { Badge, TextInput } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { PromptVariable } from "@/lib/types";

type VariableValue = string | number | boolean | null;
type DrawerMode = "focused" | "all";

type NormalizedVariable = {
  key: string;
  label: string;
  type: PromptVariable["type"];
  required: boolean;
  description: string | null;
  value: VariableValue | undefined;
  hasSchemaMetadata: boolean;
};

type VariableValuesReviewProps = {
  testCaseId: string;
  variableValues: Record<string, VariableValue>;
  variableSchema: PromptVariable[];
  hasGeneratedOutput: boolean;
};

const typeLabels: Record<PromptVariable["type"], string> = {
  text: "Text",
  long_text: "Long text",
  number: "Number",
  boolean: "Boolean",
  select: "Select"
};

function normalizeVariables(variableSchema: PromptVariable[], variableValues: Record<string, VariableValue>): NormalizedVariable[] {
  const variables: NormalizedVariable[] = [];
  const seen = new Set<string>();

  for (const variable of variableSchema) {
    if (seen.has(variable.key)) continue;
    seen.add(variable.key);
    variables.push({
      key: variable.key,
      label: variable.label || variable.key,
      type: variable.type,
      required: variable.required,
      description: variable.description,
      value: Object.prototype.hasOwnProperty.call(variableValues, variable.key) ? variableValues[variable.key] : undefined,
      hasSchemaMetadata: true
    });
  }

  for (const [key, value] of Object.entries(variableValues)) {
    if (seen.has(key)) continue;
    seen.add(key);
    variables.push({ key, label: key, type: "text", required: false, description: null, value, hasSchemaMetadata: false });
  }

  return variables;
}

function hasActualValue(value: VariableValue | undefined): value is Exclude<VariableValue, null> {
  return value !== undefined && value !== null && value !== "";
}

function formatVariableValue(value: VariableValue | undefined) {
  if (!hasActualValue(value)) return "No value provided";
  if (typeof value === "boolean") return value ? "True" : "False";
  return String(value);
}

function buildCopyAllText(variables: NormalizedVariable[]) {
  return variables.map((variable) => `${variable.label}\n{{${variable.key}}}\n${formatVariableValue(variable.value)}`).join("\n\n");
}

export function VariableValuesReview({ testCaseId, variableValues, variableSchema, hasGeneratedOutput }: VariableValuesReviewProps) {
  const variables = useMemo(() => normalizeVariables(variableSchema, variableValues), [variableSchema, variableValues]);
  const [selectedKey, setSelectedKey] = useState(variables[0]?.key || "");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("focused");
  const [search, setSearch] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set(variables[0] ? [variables[0].key] : []));
  const [mounted, setMounted] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const pillScrollerRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const selectedVariable = variables.find((variable) => variable.key === selectedKey) || variables[0];

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const scroller = pillScrollerRef.current;
    if (!scroller) return;
    const update = () => {
      setCanScrollLeft(scroller.scrollLeft > 2);
      setCanScrollRight(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2);
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [variables.length]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
        openerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  function openFocused(variable: NormalizedVariable, opener: HTMLButtonElement) {
    openerRef.current = opener;
    setSelectedKey(variable.key);
    setDrawerMode("focused");
    setSearch("");
    setExpandedKeys(new Set([variable.key]));
    setDrawerOpen(true);
  }

  function openAll(opener: HTMLButtonElement) {
    openerRef.current = opener;
    setDrawerMode("all");
    setSearch("");
    setExpandedKeys(new Set(variables.map((variable) => variable.key)));
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    openerRef.current?.focus();
  }

  if (!variables.length) return null;

  return (
    <section aria-labelledby={`variable-values-title-${testCaseId}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Tag aria-hidden="true" className="h-4 w-4 text-guard-primary" />
          <h3 id={`variable-values-title-${testCaseId}`} className="text-sm font-semibold text-guard-ink">Variable Values</h3>
          <span className="text-xs text-guard-muted">{variables.length} {variables.length === 1 ? "variable" : "variables"}</span>
        </div>
        <button type="button" onClick={(event) => openAll(event.currentTarget)} className="focus-ring rounded-lg border border-guard-primaryLine bg-white px-3 py-2 text-xs font-semibold text-guard-primaryHover transition hover:bg-guard-primarySoft">View all values</button>
      </div>

      <div className="rounded-xl border border-guard-line bg-guard-surfaceMuted/55 p-2.5 sm:p-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <button type="button" aria-label="Scroll variables left" disabled={!canScrollLeft} onClick={() => pillScrollerRef.current?.scrollBy({ left: -240, behavior: "smooth" })} className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-guard-line bg-white text-guard-muted transition hover:border-guard-primaryLine hover:text-guard-primary disabled:cursor-default disabled:opacity-30"><ChevronLeft aria-hidden="true" className="h-4 w-4" /></button>
          <div ref={pillScrollerRef} className="flex min-w-0 flex-1 touch-pan-x gap-2 overflow-x-auto py-1" aria-label="Test case variables">
            {variables.map((variable) => {
              const selected = variable.key === selectedVariable?.key;
              return (
                <button
                  key={variable.key}
                  type="button"
                  aria-pressed={selected}
                  title={variable.label}
                  onClick={(event) => openFocused(variable, event.currentTarget)}
                  className={cn("focus-ring min-w-24 max-w-48 shrink-0 truncate rounded-lg border px-3 py-2 text-xs font-semibold transition", selected ? "border-guard-primaryLine bg-guard-primarySoft text-guard-primaryHover" : "border-guard-lineStrong bg-white text-guard-text hover:border-guard-primaryLine hover:text-guard-primaryHover")}
                >
                  {variable.label}
                </button>
              );
            })}
          </div>
          <button type="button" aria-label="Scroll variables right" disabled={!canScrollRight} onClick={() => pillScrollerRef.current?.scrollBy({ left: 240, behavior: "smooth" })} className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-guard-line bg-white text-guard-muted transition hover:border-guard-primaryLine hover:text-guard-primary disabled:cursor-default disabled:opacity-30"><ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
        </div>

        {selectedVariable ? (
          <div className="relative mt-2 rounded-lg border border-guard-line bg-white px-3 py-3 pr-14">
            <button type="button" onClick={(event) => openFocused(selectedVariable, event.currentTarget)} className="focus-ring block w-full rounded-md text-left">
              <span className="block text-xs font-semibold text-guard-ink">{selectedVariable.label}</span>
              <span className={cn("mt-1 block break-words whitespace-pre-line text-sm leading-5", hasActualValue(selectedVariable.value) ? "line-clamp-3 text-guard-text" : "italic text-guard-muted")}>{formatVariableValue(selectedVariable.value)}</span>
            </button>
            <CopyButton text={hasActualValue(selectedVariable.value) ? formatVariableValue(selectedVariable.value) : ""} disabled={!hasActualValue(selectedVariable.value)} contextLabel={`${selectedVariable.label} variable value`} iconOnly className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2" />
          </div>
        ) : null}
      </div>

      {mounted && drawerOpen ? createPortal(
        <VariableValuesDrawer
          variables={variables}
          selectedKey={selectedVariable?.key || ""}
          mode={drawerMode}
          search={search}
          expandedKeys={expandedKeys}
          hasGeneratedOutput={hasGeneratedOutput}
          closeButtonRef={closeButtonRef}
          onSearch={setSearch}
          onClose={closeDrawer}
          onToggle={(key) => setExpandedKeys((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
          })}
        />,
        document.body
      ) : null}
    </section>
  );
}

function VariableValuesDrawer({ variables, selectedKey, mode, search, expandedKeys, hasGeneratedOutput, closeButtonRef, onSearch, onClose, onToggle }: {
  variables: NormalizedVariable[];
  selectedKey: string;
  mode: DrawerMode;
  search: string;
  expandedKeys: Set<string>;
  hasGeneratedOutput: boolean;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  onSearch: (value: string) => void;
  onClose: () => void;
  onToggle: (key: string) => void;
}) {
  const titleId = useId();
  const query = search.trim().toLocaleLowerCase();
  const filteredVariables = variables.filter((variable) => !query || [variable.label, variable.key, variable.description || "", formatVariableValue(variable.value)].some((candidate) => candidate.toLocaleLowerCase().includes(query)));
  const orderedVariables = mode === "focused" ? [...filteredVariables].sort((a, b) => Number(b.key === selectedKey) - Number(a.key === selectedKey)) : filteredVariables;

  return (
    <aside role="dialog" aria-modal="false" aria-labelledby={titleId} className="fixed inset-y-0 right-0 z-[70] flex w-full flex-col border-l border-guard-line bg-white shadow-floating sm:w-[82vw] lg:w-[420px]">
      <div className="border-b border-guard-line px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div><h2 id={titleId} className="text-lg font-semibold text-guard-ink">Variable Values</h2><p className="mt-1 text-sm leading-5 text-guard-muted">All variables and values for this test case.</p></div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close variable values" className="focus-ring rounded-lg p-2 text-guard-muted transition hover:bg-guard-surfaceMuted hover:text-guard-ink"><X aria-hidden="true" className="h-5 w-5" /></button>
        </div>
        <div className="relative mt-4">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-guard-muted" />
          <TextInput value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search variables..." aria-label="Search variables" className="pl-9" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-guard-line px-5 py-3">
          <span className="text-xs text-guard-muted">{query ? `${orderedVariables.length} of ${variables.length}` : variables.length} {variables.length === 1 ? "variable" : "variables"}</span>
          <CopyButton text={buildCopyAllText(variables)} idleLabel="Copy all values" successLabel="Copied all values" contextLabel="variable values" className="border-0 px-2 py-1.5" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {orderedVariables.length ? (
            <div className="space-y-3">
              {orderedVariables.map((variable) => <VariableCard key={variable.key} variable={variable} selected={variable.key === selectedKey} expanded={expandedKeys.has(variable.key)} onToggle={() => onToggle(variable.key)} />)}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-guard-lineStrong px-4 py-8 text-center text-sm text-guard-muted">No variable values match your search.</div>
          )}
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-guard-primaryLine bg-guard-primarySoft/60 p-4 text-xs leading-5 text-guard-primaryHover">
            <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{hasGeneratedOutput ? "These are the exact values stored with this test case and used when generating its current output. They are read-only." : "These are the values currently stored with this test case. They are read-only."}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function VariableCard({ variable, selected, expanded, onToggle }: { variable: NormalizedVariable; selected: boolean; expanded: boolean; onToggle: () => void }) {
  const contentId = useId();
  const displayValue = formatVariableValue(variable.value);
  const copyable = hasActualValue(variable.value);
  const showType = variable.type !== "text";

  return (
    <article className={cn("rounded-xl border bg-white transition", selected ? "border-guard-primaryLine shadow-card" : "border-guard-line")}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={contentId} className="focus-ring flex w-full items-start justify-between gap-3 rounded-xl px-4 py-3 text-left">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className="break-words text-sm font-semibold text-guard-ink">{variable.label}</span>{selected ? <Badge tone="primary">Selected</Badge> : null}</div>
          <span className="mt-1 block break-all font-mono text-[11px] text-guard-muted">{`{{${variable.key}}}`}</span>
        </div>
        {expanded ? <ChevronUp aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-guard-primary" /> : <ChevronDown aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-guard-muted" />}
      </button>
      {expanded ? (
        <div id={contentId} className="border-t border-guard-line px-4 py-4">
          {variable.hasSchemaMetadata ? <div className="mb-3 flex flex-wrap gap-2"><Badge tone={variable.required ? "primary" : "neutral"}>{variable.required ? "Required" : "Optional"}</Badge>{showType ? <Badge tone="neutral">{typeLabels[variable.type]}</Badge> : null}</div> : null}
          {variable.description ? <p className="mb-3 text-xs leading-5 text-guard-muted">{variable.description}</p> : null}
          <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-wide text-guard-muted">Value</span><CopyButton text={copyable ? displayValue : ""} disabled={!copyable} contextLabel={`${variable.label} variable value`} iconOnly className="h-9 w-9" /></div>
          <div className={cn("mt-2 break-words whitespace-pre-wrap rounded-lg border border-guard-line bg-guard-surfaceMuted/55 p-3 text-sm leading-6", copyable ? "text-guard-ink" : "italic text-guard-muted")}>{displayValue}</div>
        </div>
      ) : null}
    </article>
  );
}
