"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Save, Trash2, X } from "lucide-react";
import { Select, TextArea, TextInput } from "@/components/ui";
import { PROMPT_VARIABLE_KEY_PATTERN, promptVariableSchema, variableLabelFromKey } from "@/lib/prompt-variables";
import type { PromptVariable, PromptVariableType } from "@/lib/types";

function emptyVariable(key = ""): PromptVariable {
  return { key, label: variableLabelFromKey(key), type: "text", required: false, default_value: null, description: null, options: [] };
}

function parseOptions(value: string) {
  return value.split("\n").map((option) => option.trim()).filter(Boolean);
}

function CharacterCount({ current, maximum, id }: { current: number; maximum: number; id: string }) {
  return <span id={id} className="shrink-0 tabular-nums">{current} / {maximum}</span>;
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-sm font-semibold text-guard-ink">
      {children}
      <Info aria-hidden="true" className="h-3.5 w-3.5 text-guard-muted" />
    </label>
  );
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
  const keyId = useId();
  const keyHelpId = useId();
  const keyCountId = useId();
  const keyErrorId = useId();
  const labelId = useId();
  const labelHelpId = useId();
  const labelCountId = useId();
  const labelErrorId = useId();
  const typeId = useId();
  const typeHelpId = useId();
  const requiredHelpId = useId();
  const optionsId = useId();
  const optionsHelpId = useId();
  const optionsErrorId = useId();
  const defaultId = useId();
  const defaultHelpId = useId();
  const defaultErrorId = useId();
  const descriptionFieldId = useId();
  const descriptionHelpId = useId();
  const descriptionCountId = useId();
  const descriptionErrorId = useId();
  const [draft, setDraft] = useState<PromptVariable>(variable || emptyVariable(suggestedKey));
  const [labelEdited, setLabelEdited] = useState(Boolean(variable));
  const [defaultValue, setDefaultValue] = useState(draft.default_value === null ? "" : String(draft.default_value));
  const [options, setOptions] = useState(draft.options.join("\n"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    const focusFrame = window.requestAnimationFrame(() => document.getElementById(keyId)?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
    };
  }, [keyId]);

  const trimmedKey = draft.key.trim();
  const duplicateKey = existingKeys.includes(trimmedKey) && trimmedKey !== variable?.key;
  const keyIsValid = trimmedKey.length > 0
    && trimmedKey.length <= 50
    && PROMPT_VARIABLE_KEY_PATTERN.test(trimmedKey)
    && !duplicateKey;
  const previewKey = draft.key || "variable_name";

  function clearError(field: string) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function close() {
    dialogRef.current?.close();
  }

  function changeType(type: PromptVariableType) {
    setDraft((current) => ({ ...current, type, default_value: null, options: [] }));
    setDefaultValue("");
    setOptions("");
    clearError("options");
    clearError("default_value");
  }

  function changeOptions(value: string) {
    setOptions(value);
    const nextOptions = parseOptions(value);
    if (defaultValue && !nextOptions.includes(defaultValue)) setDefaultValue("");
    clearError("options");
    clearError("default_value");
  }

  function save() {
    const parsedOptions = parseOptions(options);
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

  const title = confirmingRemove ? `Remove ${draft.label || draft.key || "variable"}?` : variable ? "Edit Variable" : "Create variable";
  const dialogDescription = confirmingRemove
    ? "The variable configuration will be removed. Any remaining placeholder will become unresolved and block testing or saving."
    : variable
      ? "Update how this variable is configured and used at runtime."
      : "Create a variable to capture dynamic information at runtime.";

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
      className="prompt-variable-drawer fixed inset-y-0 left-auto right-0 m-0 h-[100dvh] max-h-none w-full max-w-none overflow-hidden rounded-none border-0 border-l border-guard-line bg-white p-0 text-left text-guard-text shadow-floating backdrop:bg-slate-900/10 sm:w-[min(34rem,100vw)] sm:rounded-l-2xl"
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-guard-line bg-white px-5 py-5 sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {confirmingRemove ? (
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-guard-redSoft text-guard-red">
                  <AlertTriangle aria-hidden="true" className="h-5 w-5" />
                </div>
              ) : null}
              <h2 id={titleId} className="text-xl font-semibold tracking-tight text-guard-ink">{title}</h2>
              <p id={descriptionId} className="mt-1.5 text-sm leading-6 text-guard-muted">{dialogDescription}</p>
            </div>
            <button type="button" onClick={close} aria-label="Close variable editor" className="focus-ring -mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-guard-muted transition hover:bg-guard-primarySoft hover:text-guard-ink">
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white px-5 py-6 sm:px-7">
          {confirmingRemove ? (
            <div className="rounded-xl border border-red-200 bg-guard-redSoft p-4 text-sm leading-6 text-guard-text">
              Removing this configuration does not remove its placeholder from the prompt. Any unresolved placeholder must be configured or removed before testing and saving.
            </div>
          ) : (
            <div className="grid gap-6">
              <div>
                <FieldLabel htmlFor={keyId}>Variable name</FieldLabel>
                <div className="relative mt-2">
                  <TextInput
                    id={keyId}
                    autoFocus
                    maxLength={50}
                    value={draft.key}
                    onChange={(event) => {
                      const key = event.target.value;
                      setDraft({ ...draft, key, label: labelEdited ? draft.label : variableLabelFromKey(key) });
                      clearError("key");
                    }}
                    placeholder="company_name"
                    aria-invalid={Boolean(errors.key)}
                    aria-describedby={`${keyHelpId} ${keyCountId}${errors.key ? ` ${keyErrorId}` : ""}`}
                    className={`pr-10 ${errors.key ? "border-guard-red hover:border-guard-red" : keyIsValid ? "border-guard-green hover:border-guard-green" : ""}`}
                  />
                  {keyIsValid ? <CheckCircle2 aria-hidden="true" className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-guard-green" /> : null}
                </div>
                <div className="mt-1.5 flex items-start justify-between gap-3 text-xs text-guard-muted">
                  <span id={keyHelpId}>Use lowercase letters, numbers, and underscores, starting with a letter.</span>
                  <CharacterCount id={keyCountId} current={draft.key.length} maximum={50} />
                </div>
                {errors.key ? <p id={keyErrorId} className="mt-1.5 text-xs font-medium text-guard-red">{errors.key}</p> : null}
              </div>

              <div>
                <FieldLabel htmlFor={labelId}>Display label</FieldLabel>
                <TextInput
                  id={labelId}
                  maxLength={100}
                  value={draft.label}
                  onChange={(event) => {
                    setLabelEdited(true);
                    setDraft({ ...draft, label: event.target.value });
                    clearError("label");
                  }}
                  className={`mt-2 ${errors.label ? "border-guard-red hover:border-guard-red" : ""}`}
                  placeholder="Company Name"
                  aria-invalid={Boolean(errors.label)}
                  aria-describedby={`${labelHelpId} ${labelCountId}${errors.label ? ` ${labelErrorId}` : ""}`}
                />
                <div className="mt-1.5 flex items-start justify-between gap-3 text-xs text-guard-muted">
                  <span id={labelHelpId}>This is the label users see when providing a value.</span>
                  <CharacterCount id={labelCountId} current={draft.label.length} maximum={100} />
                </div>
                {errors.label ? <p id={labelErrorId} className="mt-1.5 text-xs font-medium text-guard-red">{errors.label}</p> : null}
              </div>

              <div className="grid gap-5 min-[430px]:grid-cols-[minmax(0,1fr)_9rem]">
                <div>
                  <FieldLabel htmlFor={typeId}>Type</FieldLabel>
                  <Select id={typeId} value={draft.type} onChange={(event) => changeType(event.target.value as PromptVariableType)} className="mt-2" aria-describedby={typeHelpId}>
                    <option value="text">Text</option>
                    <option value="long_text">Long text</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="select">Select</option>
                  </Select>
                  <p id={typeHelpId} className="mt-1.5 text-xs leading-5 text-guard-muted">Changing type clears incompatible defaults and options.</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-guard-ink">Required <Info aria-hidden="true" className="h-3.5 w-3.5 text-guard-muted" /></div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draft.required}
                    aria-label="Required variable value"
                    aria-describedby={requiredHelpId}
                    onClick={() => setDraft({ ...draft, required: !draft.required })}
                    className={`focus-ring mt-2 inline-flex min-h-10 min-w-[5.25rem] items-center gap-2 rounded-lg px-1 transition ${draft.required ? "text-guard-primary" : "text-guard-muted"}`}
                  >
                    <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${draft.required ? "bg-guard-primary" : "bg-slate-300"}`}>
                      <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${draft.required ? "translate-x-5" : "translate-x-0.5"}`} />
                    </span>
                    <span className="min-w-6 whitespace-nowrap text-left text-xs font-semibold">{draft.required ? "On" : "Off"}</span>
                  </button>
                  <span id={requiredHelpId} className="sr-only">Controls whether a value must be provided at runtime.</span>
                </div>
              </div>

              {draft.type === "select" ? (
                <div>
                  <FieldLabel htmlFor={optionsId}>Options, one per line</FieldLabel>
                  <TextArea id={optionsId} value={options} onChange={(event) => changeOptions(event.target.value)} className={`mt-2 min-h-28 ${errors.options ? "border-guard-red hover:border-guard-red" : ""}`} aria-invalid={Boolean(errors.options)} aria-describedby={`${optionsHelpId}${errors.options ? ` ${optionsErrorId}` : ""}`} />
                  <p id={optionsHelpId} className="mt-1.5 text-xs leading-5 text-guard-muted">Each option must be unique and no more than 100 characters.</p>
                  {errors.options ? <p id={optionsErrorId} className="mt-1.5 text-xs font-medium text-guard-red">{errors.options}</p> : null}
                </div>
              ) : null}

              <div>
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel htmlFor={defaultId}>Default value</FieldLabel>
                  {defaultValue !== "" ? <button type="button" onClick={() => { setDefaultValue(""); clearError("default_value"); }} className="focus-ring rounded-md px-2 py-1 text-xs font-semibold text-guard-primary hover:bg-guard-primarySoft">Clear</button> : null}
                </div>
                {draft.type === "boolean" ? (
                  <Select id={defaultId} value={defaultValue} onChange={(event) => { setDefaultValue(event.target.value); clearError("default_value"); }} className={`mt-2 ${errors.default_value ? "border-guard-red hover:border-guard-red" : ""}`} aria-invalid={Boolean(errors.default_value)} aria-describedby={`${defaultHelpId}${errors.default_value ? ` ${defaultErrorId}` : ""}`}><option value="">No default</option><option value="true">True</option><option value="false">False</option></Select>
                ) : draft.type === "long_text" ? (
                  <TextArea id={defaultId} value={defaultValue} onChange={(event) => { setDefaultValue(event.target.value); clearError("default_value"); }} className={`mt-2 min-h-24 ${errors.default_value ? "border-guard-red hover:border-guard-red" : ""}`} aria-invalid={Boolean(errors.default_value)} aria-describedby={`${defaultHelpId}${errors.default_value ? ` ${defaultErrorId}` : ""}`} />
                ) : draft.type === "select" ? (
                  <Select id={defaultId} value={defaultValue} onChange={(event) => { setDefaultValue(event.target.value); clearError("default_value"); }} className={`mt-2 ${errors.default_value ? "border-guard-red hover:border-guard-red" : ""}`} aria-invalid={Boolean(errors.default_value)} aria-describedby={`${defaultHelpId}${errors.default_value ? ` ${defaultErrorId}` : ""}`}><option value="">No default</option>{parseOptions(options).map((option, index) => <option key={`${option}-${index}`} value={option}>{option}</option>)}</Select>
                ) : (
                  <TextInput id={defaultId} type={draft.type === "number" ? "number" : "text"} value={defaultValue} onChange={(event) => { setDefaultValue(event.target.value); clearError("default_value"); }} className={`mt-2 ${errors.default_value ? "border-guard-red hover:border-guard-red" : ""}`} aria-invalid={Boolean(errors.default_value)} aria-describedby={`${defaultHelpId}${errors.default_value ? ` ${defaultErrorId}` : ""}`} />
                )}
                <p id={defaultHelpId} className="mt-1.5 text-xs text-guard-muted">{draft.required ? "This default satisfies the required variable when no test value is provided." : "The value used when no test value is provided."}</p>
                {errors.default_value ? <p id={defaultErrorId} className="mt-1.5 text-xs font-medium text-guard-red">{errors.default_value}</p> : null}
              </div>

              <div>
                <FieldLabel htmlFor={descriptionFieldId}>Description (help text)</FieldLabel>
                <TextArea
                  id={descriptionFieldId}
                  maxLength={250}
                  value={draft.description || ""}
                  onChange={(event) => {
                    setDraft({ ...draft, description: event.target.value });
                    clearError("description");
                  }}
                  className={`mt-2 min-h-24 ${errors.description ? "border-guard-red hover:border-guard-red" : ""}`}
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby={`${descriptionHelpId} ${descriptionCountId}${errors.description ? ` ${descriptionErrorId}` : ""}`}
                />
                <div className="mt-1.5 flex items-start justify-between gap-3 text-xs text-guard-muted">
                  <span id={descriptionHelpId}>Explain what information this variable should contain.</span>
                  <CharacterCount id={descriptionCountId} current={(draft.description || "").length} maximum={250} />
                </div>
                {errors.description ? <p id={descriptionErrorId} className="mt-1.5 text-xs font-medium text-guard-red">{errors.description}</p> : null}
              </div>

              <section aria-labelledby={`${titleId}-preview`} className={`rounded-xl border p-4 ${draft.key && !keyIsValid ? "border-red-200 bg-guard-redSoft" : "border-guard-primaryLine bg-guard-surfaceMuted"}`}>
                <h3 id={`${titleId}-preview`} className="text-sm font-semibold text-guard-ink">Live preview</h3>
                <p className="mt-2 text-xs leading-5 text-guard-muted">This variable will appear in your prompt as:</p>
                <code className={`mt-2 inline-flex rounded-md px-2 py-1 text-sm font-semibold ${draft.key && !keyIsValid ? "bg-white text-guard-red" : "bg-guard-primarySoft text-guard-primaryHover"}`}>{`{{${previewKey}}}`}</code>
                <p className={`mt-2 text-xs leading-5 ${draft.key && !keyIsValid ? "font-medium text-guard-red" : "text-guard-muted"}`}>{draft.key && !keyIsValid ? "Enter a valid, unique variable name before saving." : "At runtime, it will be replaced with the value provided."}</p>
              </section>

              {errors.form ? <p className="rounded-lg border border-red-200 bg-guard-redSoft p-3 text-sm text-guard-red">{errors.form}</p> : null}
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-guard-line bg-white px-5 py-4 sm:px-7">
          {confirmingRemove ? (
            <div className="flex flex-col-reverse gap-3 min-[430px]:flex-row min-[430px]:justify-end">
              <button type="button" onClick={() => setConfirmingRemove(false)} className="focus-ring inline-flex min-h-10 items-center justify-center rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-text transition hover:bg-guard-surfaceMuted">Keep Variable</button>
              <button type="button" onClick={() => { onRemove?.(); close(); }} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-guard-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-guard-red/80"><Trash2 aria-hidden="true" className="h-4 w-4" />Remove Variable</button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 min-[430px]:flex-row min-[430px]:items-center min-[430px]:justify-between">
              <div>{variable && onRemove ? <button type="button" onClick={() => setConfirmingRemove(true)} className="focus-ring inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-guard-red transition hover:bg-guard-redSoft min-[430px]:w-auto"><Trash2 aria-hidden="true" className="h-4 w-4" />Remove</button> : null}</div>
              <div className="flex flex-col-reverse gap-3 min-[430px]:flex-row">
                <button type="button" onClick={close} className="focus-ring inline-flex min-h-10 items-center justify-center rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-text transition hover:bg-guard-surfaceMuted">Cancel</button>
                <button type="button" onClick={save} className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-guard-primaryHover"><Save aria-hidden="true" className="h-4 w-4" />Save Variable</button>
              </div>
            </div>
          )}
        </footer>
      </div>
    </dialog>
  );
}
