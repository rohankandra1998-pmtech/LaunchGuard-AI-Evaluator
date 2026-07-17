"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FlaskConical, Pencil, Plus, Variable } from "lucide-react";
import { createPromptVersion, updatePromptVersion } from "@/app/actions";
import { PromptVariableDialog } from "@/components/prompt-variable-dialog";
import { SubmitButton } from "@/components/submit-button";
import { Badge, ButtonLink, Card, Select, TextArea, TextInput } from "@/components/ui";
import { compilePromptPreview, extractPromptPlaceholders, findMalformedPlaceholders, findUnconfiguredPlaceholders, findUnusedVariables, promptVariableArraySchema } from "@/lib/prompt-variables";
import type { PromptVariable } from "@/lib/types";

type DialogState = { index?: number; suggestedKey?: string } | null;

export function PromptVersionBuilder({
  workspaceSlug,
  projectId,
  mode,
  versionId,
  versionNumber,
  isActive = false,
  initialModel,
  initialNotes,
  initialSystemPrompt,
  initialVariableSchema,
  models,
  cancelHref
}: {
  workspaceSlug: string;
  projectId: string;
  mode: "create" | "edit";
  versionId?: string;
  versionNumber: number;
  isActive?: boolean;
  initialModel: string;
  initialNotes: string;
  initialSystemPrompt: string;
  initialVariableSchema: PromptVariable[];
  models: string[];
  cancelHref: string;
}) {
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [model, setModel] = useState(initialModel);
  const [notes, setNotes] = useState(initialNotes);
  const [systemPrompt, setSystemPrompt] = useState(initialSystemPrompt);
  const [variables, setVariables] = useState(initialVariableSchema);
  const [variableValues, setVariableValues] = useState<Record<string, unknown>>(() => Object.fromEntries(initialVariableSchema.map((variable) => [variable.key, variable.default_value ?? ""])));
  const [insertKey, setInsertKey] = useState(initialVariableSchema[0]?.key || "");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [userInput, setUserInput] = useState("");
  const [testPending, setTestPending] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testedPrompt, setTestedPrompt] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const detected = useMemo(() => extractPromptPlaceholders(systemPrompt), [systemPrompt]);
  const unresolved = useMemo(() => findUnconfiguredPlaceholders(systemPrompt, variables), [systemPrompt, variables]);
  const unused = useMemo(() => findUnusedVariables(systemPrompt, variables), [systemPrompt, variables]);
  const malformed = useMemo(() => findMalformedPlaceholders(systemPrompt), [systemPrompt]);
  const schemaResult = useMemo(() => promptVariableArraySchema.safeParse(variables), [variables]);
  const preview = useMemo(() => compilePromptPreview(systemPrompt, variables, variableValues), [systemPrompt, variables, variableValues]);
  const blockingMessages = [
    ...(!systemPrompt.trim() ? ["System prompt is required."] : []),
    ...(unresolved.length ? [`Configure unresolved variables: ${unresolved.join(", ")}.`] : []),
    ...(malformed.length ? [`Fix malformed placeholders: ${malformed.join(", ")}.`] : []),
    ...(!schemaResult.success ? schemaResult.error.issues.map((issue) => issue.message) : [])
  ];
  const canSave = blockingMessages.length === 0;
  const canRun = canSave && !preview.errors.length && Boolean(userInput.trim()) && !testPending;

  function openAdd(suggestedKey?: string) {
    setDialog({ suggestedKey });
  }

  function saveVariable(variable: PromptVariable) {
    setVariables((current) => {
      const next = [...current];
      if (dialog?.index !== undefined) next[dialog.index] = variable;
      else next.push(variable);
      return next;
    });
    setVariableValues((current) => ({ ...current, [variable.key]: current[variable.key] ?? variable.default_value ?? "" }));
    setInsertKey(variable.key);
  }

  function removeVariable(index: number) {
    const key = variables[index].key;
    setVariables((current) => current.filter((_, variableIndex) => variableIndex !== index));
    setVariableValues((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    if (insertKey === key) setInsertKey(variables.find((_, variableIndex) => variableIndex !== index)?.key || "");
  }

  function insertVariable() {
    const textarea = promptRef.current;
    if (!textarea || !insertKey) return;
    const placeholder = `{{${insertKey}}}`;
    const start = textarea.selectionStart ?? systemPrompt.length;
    const end = textarea.selectionEnd ?? start;
    const nextPrompt = `${systemPrompt.slice(0, start)}${placeholder}${systemPrompt.slice(end)}`;
    setSystemPrompt(nextPrompt);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + placeholder.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  async function runTest() {
    if (!canRun) return;
    setTestPending(true);
    setTestError(null);
    setTestOutput(null);
    try {
      const response = await fetch("/api/ai/test-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_slug: workspaceSlug,
          project_id: projectId,
          model,
          system_prompt: systemPrompt,
          variable_schema: variables,
          variable_values: variableValues,
          user_input: userInput
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The sandbox test failed.");
      setTestedPrompt(result.compiled_prompt);
      setTestOutput(result.output);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "The sandbox test failed.");
    } finally {
      setTestPending(false);
    }
  }

  return (
    <>
      <form
        action={mode === "create" ? createPromptVersion : updatePromptVersion}
        onSubmit={(event) => {
          if (!canSave) {
            event.preventDefault();
            setSubmitError(blockingMessages.join(" "));
          }
        }}
        className="space-y-6"
      >
        <input type="hidden" name="workspace_slug" value={workspaceSlug} />
        <input type="hidden" name="project_id" value={projectId} />
        {versionId ? <input type="hidden" name="id" value={versionId} /> : null}
        <input type="hidden" name="variable_schema" value={JSON.stringify(variables)} />

        <Card>
          <div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-semibold text-white">Prompt Version v{versionNumber}</h2>{isActive ? <Badge tone="good">Active</Badge> : <Badge>Draft</Badge>}</div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-200">Model<Select required name="model_used" value={model} onChange={(event) => setModel(event.target.value)} className="mt-2">{models.map((availableModel) => <option key={availableModel} value={availableModel}>{availableModel}</option>)}</Select></label>
            <label className="text-sm font-medium text-slate-200">Notes / change summary<TextInput name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} className="mt-2" placeholder="What should this version improve?" /></label>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-white">System Prompt Builder</h2><p className="mt-1 text-sm text-slate-400">Use {"{{variable_name}}"} for version-specific inputs.</p></div><span className="text-xs text-slate-500">{systemPrompt.length.toLocaleString()} characters</span></div>
            <label className="mt-5 block text-sm font-medium text-slate-200">System Prompt<TextArea ref={promptRef} required name="system_prompt" value={systemPrompt} onChange={(event) => { setSystemPrompt(event.target.value); setTestOutput(null); }} className="mt-2 min-h-96 resize-y font-mono leading-6" placeholder="Write the system prompt for this version..." /></label>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              {variables.length ? <><Select aria-label="Variable to insert" value={insertKey} onChange={(event) => setInsertKey(event.target.value)} className="sm:max-w-xs">{variables.map((variable) => <option key={variable.key} value={variable.key}>{variable.label} — {`{{${variable.key}}}`}</option>)}</Select><button type="button" onClick={insertVariable} className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-guard-cyan/30 bg-guard-cyan/10 px-4 py-2 text-sm font-semibold text-guard-cyan hover:bg-guard-cyan/15"><Variable className="h-4 w-4" />Insert Variable</button></> : <p className="text-sm text-slate-400">Add a variable before inserting a placeholder.</p>}
              <button type="button" onClick={() => openAdd()} className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"><Plus className="h-4 w-4" />Add Variable</button>
            </div>
            <div className="mt-5" aria-live="polite">
              {blockingMessages.length ? <div className="rounded-md border border-guard-red/30 bg-guard-red/10 p-4 text-sm text-red-200"><p className="font-semibold">Prompt needs attention</p><ul className="mt-2 list-disc space-y-1 pl-5">{blockingMessages.map((message) => <li key={message}>{message}</li>)}</ul></div> : <div className="flex items-center gap-2 text-sm text-guard-green"><CheckCircle2 className="h-4 w-4" />Prompt placeholders are configured.</div>}
              {unused.length ? <p className="mt-3 flex items-start gap-2 text-sm text-guard-amber"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Unused configured variables: {unused.join(", ")}. They will remain saved.</p> : null}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-white">Variables</h2><p className="mt-1 text-sm text-slate-400">{variables.length} configured · {detected.length} detected</p></div><button type="button" onClick={() => openAdd()} className="focus-ring rounded-md bg-white/10 p-2 text-white hover:bg-white/15"><Plus className="h-4 w-4" /><span className="sr-only">Add Variable</span></button></div>
            <div className="mt-5 space-y-3">
              {variables.map((variable, index) => {
                const isUnused = unused.includes(variable.key);
                return <div key={`${variable.key}-${index}`} className="rounded-md border border-white/10 bg-slate-950/30 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-white">{variable.label}</p><code className="mt-1 block text-xs text-guard-cyan">{`{{${variable.key}}}`}</code></div><button type="button" onClick={() => setDialog({ index })} className="focus-ring rounded-md p-2 text-slate-300 hover:bg-white/10 hover:text-white"><Pencil className="h-4 w-4" /><span className="sr-only">Edit {variable.label}</span></button></div><div className="mt-3 flex flex-wrap gap-2"><Badge>{variable.type.replace("_", " ")}</Badge><Badge tone={variable.required ? "cyan" : "neutral"}>{variable.required ? "Required" : "Optional"}</Badge>{isUnused ? <Badge tone="average">Unused</Badge> : <Badge tone="good">In prompt</Badge>}</div>{variable.default_value !== null ? <p className="mt-3 truncate text-xs text-slate-400">Default: {String(variable.default_value)}</p> : null}</div>;
              })}
              {unresolved.map((key) => <div key={key} className="rounded-md border border-guard-amber/30 bg-guard-amber/10 p-4"><p className="font-medium text-white">{key}</p><p className="mt-1 text-xs text-guard-amber">Needs configuration</p><button type="button" onClick={() => openAdd(key)} className="focus-ring mt-3 rounded-md border border-guard-amber/30 px-3 py-2 text-sm font-semibold text-guard-amber">Configure</button></div>)}
              {!variables.length && !unresolved.length ? <p className="rounded-md border border-dashed border-white/15 p-5 text-center text-sm text-slate-400">No variables configured. Prompts without variables are supported.</p> : null}
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="text-lg font-semibold text-white">Example Variable Values</h2><p className="mt-1 text-sm text-slate-400">Temporary values for preview and sandbox testing. They are not saved with the version.</p>
          {variables.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">{variables.map((variable) => <VariableValueField key={variable.key} variable={variable} value={variableValues[variable.key]} onChange={(value) => { setVariableValues((current) => ({ ...current, [variable.key]: value })); setTestOutput(null); }} />)}</div> : <p className="mt-4 text-sm text-slate-500">This prompt has no example values.</p>}
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card><h2 className="text-lg font-semibold text-white">Final Prompt Preview</h2><p className="mt-1 text-sm text-slate-400">The exact compiled system prompt sent to the model.</p>{preview.errors.length ? <div className="mt-4 rounded-md border border-guard-amber/30 bg-guard-amber/10 p-3 text-sm text-guard-amber">{preview.errors.join(" ")}</div> : null}<pre className="mt-4 min-h-64 whitespace-pre-wrap break-words rounded-md border border-white/10 bg-slate-950/50 p-4 text-sm leading-6 text-slate-200">{preview.compiledPrompt || "Your compiled prompt will appear here."}</pre></Card>
          <Card><h2 className="text-lg font-semibold text-white">Test with a user message</h2><p className="mt-1 text-sm text-slate-400">Run an ephemeral sandbox test. It is not added to the Golden Dataset or evaluation results.</p><label className="mt-4 block text-sm font-medium text-slate-200">Sample user message<TextArea value={userInput} onChange={(event) => { setUserInput(event.target.value); setTestOutput(null); }} maxLength={8000} className="mt-2 min-h-32" placeholder="Enter a realistic user message..." /></label><div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{userInput.length.toLocaleString()} / 8,000</span><button type="button" onClick={runTest} disabled={!canRun} className="focus-ring inline-flex items-center gap-2 rounded-md bg-guard-cyan px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"><FlaskConical className="h-4 w-4" />{testPending ? "Running Test..." : "Run Test"}</button></div><div className="mt-4" aria-live="polite">{testError ? <p className="rounded-md border border-guard-red/30 bg-guard-red/10 p-3 text-sm text-red-200">{testError}</p> : null}{testOutput ? <div><p className="text-sm font-semibold text-white">Model response</p><div className="mt-2 whitespace-pre-wrap break-words rounded-md border border-guard-cyan/20 bg-slate-950/50 p-4 text-sm leading-6 text-slate-200">{testOutput}</div>{testedPrompt !== preview.compiledPrompt ? <p className="mt-2 text-xs text-guard-amber">Inputs changed after this test. Run it again for the current preview.</p> : null}</div> : null}</div></Card>
        </div>

        {submitError ? <p aria-live="assertive" className="rounded-md border border-guard-red/30 bg-guard-red/10 p-3 text-sm text-red-200">{submitError}</p> : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><ButtonLink variant="secondary" href={cancelHref}>Cancel</ButtonLink><SubmitButton disabled={!canSave} pendingText={mode === "create" ? "Creating Version..." : "Saving Changes..."}>{mode === "create" ? "Create Version" : "Save Changes"}</SubmitButton></div>
      </form>

      {dialog ? <PromptVariableDialog variable={dialog.index !== undefined ? variables[dialog.index] : undefined} suggestedKey={dialog.suggestedKey} existingKeys={variables.map((variable) => variable.key)} onSave={saveVariable} onRemove={dialog.index !== undefined ? () => removeVariable(dialog.index!) : undefined} onClose={() => setDialog(null)} /> : null}
    </>
  );
}

function VariableValueField({ variable, value, onChange }: { variable: PromptVariable; value: unknown; onChange: (value: unknown) => void }) {
  const label = <>{variable.label}{variable.required ? <span className="ml-1 text-guard-amber">Required</span> : <span className="ml-1 text-slate-500">Optional</span>}</>;
  if (variable.type === "long_text") return <label className="text-sm font-medium text-slate-200">{label}<TextArea value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-24" />{variable.description ? <span className="mt-1 block text-xs font-normal text-slate-500">{variable.description}</span> : null}</label>;
  if (variable.type === "boolean") return <label className="text-sm font-medium text-slate-200">{label}<Select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-2"><option value="">No value</option><option value="true">True</option><option value="false">False</option></Select>{variable.description ? <span className="mt-1 block text-xs font-normal text-slate-500">{variable.description}</span> : null}</label>;
  if (variable.type === "select") return <label className="text-sm font-medium text-slate-200">{label}<Select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-2"><option value="">No value</option>{variable.options.map((option) => <option key={option} value={option}>{option}</option>)}</Select>{variable.description ? <span className="mt-1 block text-xs font-normal text-slate-500">{variable.description}</span> : null}</label>;
  return <label className="text-sm font-medium text-slate-200">{label}<TextInput type={variable.type === "number" ? "number" : "text"} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-2" />{variable.description ? <span className="mt-1 block text-xs font-normal text-slate-500">{variable.description}</span> : null}</label>;
}
