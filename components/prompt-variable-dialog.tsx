"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Label, Select, TextArea, TextInput } from "@/components/ui";
import { promptVariableSchema, variableLabelFromKey } from "@/lib/prompt-variables";
import type { PromptVariable, PromptVariableType } from "@/lib/types";

function emptyVariable(key = ""): PromptVariable {
  return { key, label: variableLabelFromKey(key), type: "text", required: false, default_value: null, description: null, options: [] };
}

export function PromptVariableDialog({
  variable,
  suggestedKey,
  existingKeys,
  onSave,
  onRemove,
  onClose
}: {
  variable?: PromptVariable;
  suggestedKey?: string;
  existingKeys: string[];
  onSave: (variable: PromptVariable) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [draft, setDraft] = useState<PromptVariable>(variable || emptyVariable(suggestedKey));
  const [labelEdited, setLabelEdited] = useState(Boolean(variable));
  const [defaultValue, setDefaultValue] = useState(draft.default_value === null ? "" : String(draft.default_value));
  const [options, setOptions] = useState(draft.options.join("\n"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  useEffect(() => dialogRef.current?.showModal(), []);

  function close() {
    dialogRef.current?.close();
  }

  function changeType(type: PromptVariableType) {
    setDraft((current) => ({ ...current, type, default_value: null, options: [] }));
    setDefaultValue("");
    if (type !== "select") setOptions("");
  }

  function save() {
    const parsedOptions = options.split("\n").map((option) => option.trim()).filter(Boolean);
    let parsedDefault: string | number | boolean | null = defaultValue === "" ? null : defaultValue;
    if (draft.type === "number" && defaultValue !== "") parsedDefault = Number(defaultValue);
    if (draft.type === "boolean" && defaultValue !== "") parsedDefault = defaultValue === "true";
    const candidate = {
      ...draft,
      key: draft.key.trim(),
      label: draft.label.trim(),
      description: draft.description?.trim() || null,
      default_value: parsedDefault,
      options: draft.type === "select" ? parsedOptions : []
    };
    const result = promptVariableSchema.safeParse(candidate);
    const nextErrors: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) nextErrors[String(issue.path[0] || "form")] ||= issue.message;
    }
    if (existingKeys.includes(candidate.key) && candidate.key !== variable?.key) nextErrors.key = "Variable names must be unique.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !result.success) return;
    onSave(result.data);
    close();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
      className="m-auto max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-guard-panel p-0 text-left text-white shadow-2xl backdrop:bg-slate-950/80 backdrop:backdrop-blur-sm"
    >
      <div className="p-5 sm:p-6">
        {confirmingRemove ? (
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-guard-red/15 text-guard-red"><AlertTriangle className="h-5 w-5" /></div>
            <h2 id={titleId} className="mt-5 text-xl font-semibold">Remove {draft.label || draft.key}?</h2>
            <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-300">The variable configuration will be removed. Any remaining placeholder will become unresolved and block testing or saving.</p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setConfirmingRemove(false)} className="focus-ring rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold">Keep variable</button>
              <button type="button" onClick={() => { onRemove?.(); close(); }} className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-guard-red px-4 py-2 text-sm font-semibold text-white"><Trash2 className="h-4 w-4" />Remove variable</button>
            </div>
          </div>
        ) : (
          <>
            <h2 id={titleId} className="text-xl font-semibold">{variable ? "Edit Variable" : "Add Variable"}</h2>
            <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-300">Configure a version-specific value that can be inserted as <code>{"{{variable_name}}"}</code>.</p>
            <div className="mt-6 grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-200">
                  Variable name
                  <TextInput autoFocus value={draft.key} onChange={(event) => setDraft({ ...draft, key: event.target.value, label: labelEdited ? draft.label : variableLabelFromKey(event.target.value) })} className="mt-2" placeholder="company_name" aria-invalid={Boolean(errors.key)} />
                  {errors.key ? <span className="mt-1 block text-xs text-guard-red">{errors.key}</span> : <span className="mt-1 block text-xs font-normal text-slate-500">Lowercase letters, numbers, and underscores.</span>}
                </label>
                <label className="text-sm font-medium text-slate-200">
                  Display label
                  <TextInput value={draft.label} onChange={(event) => { setLabelEdited(true); setDraft({ ...draft, label: event.target.value }); }} className="mt-2" placeholder="Company Name" aria-invalid={Boolean(errors.label)} />
                  {errors.label ? <span className="mt-1 block text-xs text-guard-red">{errors.label}</span> : null}
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label>Type</Label><Select value={draft.type} onChange={(event) => changeType(event.target.value as PromptVariableType)} className="mt-2"><option value="text">Text</option><option value="long_text">Long text</option><option value="number">Number</option><option value="boolean">Boolean</option><option value="select">Select</option></Select><p className="mt-1 text-xs text-slate-500">Changing type clears incompatible defaults and options.</p></div>
                <label className="flex items-center gap-3 self-start pt-8 text-sm font-medium text-slate-200"><input type="checkbox" checked={draft.required} onChange={(event) => setDraft({ ...draft, required: event.target.checked })} className="h-4 w-4 accent-cyan-300" />Required value</label>
              </div>
              {draft.type === "select" ? (
                <label className="text-sm font-medium text-slate-200">Options, one per line<TextArea value={options} onChange={(event) => setOptions(event.target.value)} className="mt-2 min-h-28" aria-invalid={Boolean(errors.options)} />{errors.options ? <span className="mt-1 block text-xs text-guard-red">{errors.options}</span> : null}</label>
              ) : null}
              <label className="text-sm font-medium text-slate-200">
                Default value
                {draft.type === "boolean" ? <Select value={defaultValue} onChange={(event) => setDefaultValue(event.target.value)} className="mt-2"><option value="">No default</option><option value="true">True</option><option value="false">False</option></Select> : draft.type === "long_text" ? <TextArea value={defaultValue} onChange={(event) => setDefaultValue(event.target.value)} className="mt-2" /> : draft.type === "select" ? <Select value={defaultValue} onChange={(event) => setDefaultValue(event.target.value)} className="mt-2"><option value="">No default</option>{options.split("\n").map((option) => option.trim()).filter(Boolean).map((option) => <option key={option} value={option}>{option}</option>)}</Select> : <TextInput type={draft.type === "number" ? "number" : "text"} value={defaultValue} onChange={(event) => setDefaultValue(event.target.value)} className="mt-2" />}
                {errors.default_value ? <span className="mt-1 block text-xs text-guard-red">{errors.default_value}</span> : null}
              </label>
              <label className="text-sm font-medium text-slate-200">Description / help text<TextArea value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="mt-2 min-h-20" />{errors.description ? <span className="mt-1 block text-xs text-guard-red">{errors.description}</span> : null}</label>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>{variable && onRemove ? <button type="button" onClick={() => setConfirmingRemove(true)} className="focus-ring inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-guard-red hover:bg-guard-red/10"><Trash2 className="h-4 w-4" />Remove</button> : null}</div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row"><button type="button" onClick={close} className="focus-ring rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" onClick={save} className="focus-ring rounded-md bg-guard-cyan px-4 py-2 text-sm font-semibold text-slate-950">Save Variable</button></div>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
