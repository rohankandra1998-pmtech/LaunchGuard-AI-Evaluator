"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, FlaskConical, Pencil, Plus, Variable } from "lucide-react";
import { createProject, createPromptVersion, updatePromptVersion } from "@/app/actions";
import { CopyButton } from "@/components/copy-button";
import { HighlightedPromptPreview } from "@/components/highlighted-prompt-preview";
import { PromptVariableDialog } from "@/components/prompt-variable-dialog";
import { PromptSyntaxEditor } from "@/components/prompt-syntax-editor";
import { SubmitButton } from "@/components/submit-button";
import { Badge, ButtonLink, Card, Select, TextArea, TextInput } from "@/components/ui";
import { compilePromptPreview, extractPromptPlaceholders, findMalformedPlaceholders, findUnconfiguredPlaceholders, findUnusedVariables, promptVariableArraySchema } from "@/lib/prompt-variables";
import type { PromptVariable } from "@/lib/types";

type DialogState = { index?: number; suggestedKey?: string } | null;

type CommonBuilderProps = {
  workspaceSlug: string;
  versionNumber: number;
  initialModel: string;
  initialNotes: string;
  initialSystemPrompt: string;
  initialVariableSchema: PromptVariable[];
  models: string[];
  cancelHref: string;
};

type PromptVersionBuilderProps =
  | (CommonBuilderProps & {
      mode: "project-create";
      workspaceId: string;
      projectId?: never;
      versionId?: never;
      versionNumber: 1;
      isActive?: never;
      projectContext: ReactNode;
    })
  | (CommonBuilderProps & {
      mode: "version-create";
      projectId: string;
      workspaceId?: never;
      versionId?: never;
      isActive?: never;
      projectContext?: never;
    })
  | (CommonBuilderProps & {
      mode: "version-edit";
      projectId: string;
      workspaceId?: never;
      versionId: string;
      isActive: boolean;
      projectContext?: never;
    });

export function PromptVersionBuilder(props: PromptVersionBuilderProps) {
  const {
    workspaceSlug,
    mode,
    versionNumber,
    initialModel,
    initialNotes,
    initialSystemPrompt,
    initialVariableSchema,
    models,
    cancelHref
  } = props;
  const projectId = mode === "project-create" ? undefined : props.projectId;
  const versionId = mode === "version-edit" ? props.versionId : undefined;
  const isActive = mode === "version-edit" ? props.isActive : false;
  const formAction = mode === "project-create" ? createProject : mode === "version-create" ? createPromptVersion : updatePromptVersion;
  const submitLabel = mode === "project-create" ? "Create AI Project" : mode === "version-create" ? "Create Version" : "Save Changes";
  const pendingLabel = mode === "project-create" ? "Creating AI Project..." : mode === "version-create" ? "Creating Version..." : "Saving Changes...";
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
  const [testedFingerprint, setTestedFingerprint] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const detected = useMemo(() => extractPromptPlaceholders(systemPrompt), [systemPrompt]);
  const unresolved = useMemo(() => findUnconfiguredPlaceholders(systemPrompt, variables), [systemPrompt, variables]);
  const unused = useMemo(() => findUnusedVariables(systemPrompt, variables), [systemPrompt, variables]);
  const malformed = useMemo(() => findMalformedPlaceholders(systemPrompt), [systemPrompt]);
  const schemaResult = useMemo(() => promptVariableArraySchema.safeParse(variables), [variables]);
  const preview = useMemo(() => compilePromptPreview(systemPrompt, variables, variableValues), [systemPrompt, variables, variableValues]);
  const currentTestFingerprint = JSON.stringify({ model, systemPrompt, variables, variableValues, userInput });
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
      const payload: {
        workspace_slug: string;
        project_id?: string;
        model: string;
        system_prompt: string;
        variable_schema: PromptVariable[];
        variable_values: Record<string, unknown>;
        user_input: string;
      } = {
        workspace_slug: workspaceSlug,
        model,
        system_prompt: systemPrompt,
        variable_schema: variables,
        variable_values: variableValues,
        user_input: userInput
      };
      if (projectId) payload.project_id = projectId;
      const response = await fetch("/api/ai/test-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The sandbox test failed.");
      setTestedFingerprint(currentTestFingerprint);
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
        action={formAction}
        onSubmit={(event) => {
          if (!canSave) {
            event.preventDefault();
            setSubmitError(blockingMessages.join(" "));
          }
        }}
        className="space-y-6"
      >
        <input type="hidden" name="workspace_slug" value={workspaceSlug} />
        {mode === "project-create" ? <input type="hidden" name="workspace_id" value={props.workspaceId} /> : null}
        {projectId ? <input type="hidden" name="project_id" value={projectId} /> : null}
        {versionId ? <input type="hidden" name="id" value={versionId} /> : null}
        <input type="hidden" name="variable_schema" value={JSON.stringify(variables)} />

        {mode === "project-create" ? props.projectContext : null}

        <Card>
          <div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-semibold text-guard-ink">Prompt Version v{versionNumber}</h2>{mode === "project-create" ? <Badge tone="good">Will be Active</Badge> : isActive ? <Badge tone="good">Active</Badge> : <Badge>Draft</Badge>}</div>
          {mode === "project-create" ? <p className="mt-2 text-sm text-slate-400">This initial version is saved only when you create the project.</p> : null}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-guard-text">Model<Select required name="model_used" value={model} onChange={(event) => setModel(event.target.value)} className="mt-2">{models.map((availableModel) => <option key={availableModel} value={availableModel}>{availableModel}</option>)}</Select></label>
            <label className="text-sm font-medium text-guard-text">Notes / change summary<TextInput name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} className="mt-2" placeholder="What should this version improve?" /></label>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-guard-ink">System Prompt Builder</h2><p className="mt-1 text-sm text-guard-muted">Use {"{{variable_name}}"} for version-specific inputs.</p></div><span className="text-xs text-guard-muted">{systemPrompt.length.toLocaleString()} characters</span></div>
            <label className="mt-5 block text-sm font-medium text-guard-text">System Prompt<PromptSyntaxEditor ref={promptRef} required name="system_prompt" value={systemPrompt} variables={variables} onChange={(event) => setSystemPrompt(event.target.value)} className="mt-2" placeholder="Write the system prompt for this version..." /></label>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              {variables.length ? <><Select aria-label="Variable to insert" value={insertKey} onChange={(event) => setInsertKey(event.target.value)} className="sm:max-w-xs">{variables.map((variable) => <option key={variable.key} value={variable.key}>{variable.label} — {`{{${variable.key}}}`}</option>)}</Select><button type="button" onClick={insertVariable} className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-guard-primaryLine bg-guard-primarySoft px-4 py-2 text-sm font-semibold text-guard-primaryHover hover:bg-guard-surfaceStrong"><Variable className="h-4 w-4" />Insert Variable</button></> : <p className="text-sm text-guard-muted">Add a variable before inserting a placeholder.</p>}
              <button type="button" onClick={() => openAdd()} className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-primaryHover hover:bg-guard-primarySoft"><Plus className="h-4 w-4" />Add Variable</button>
            </div>
            <div className="mt-5" aria-live="polite">
              {blockingMessages.length ? <div className="rounded-md border border-guard-red/30 bg-guard-red/10 p-4 text-sm text-red-200"><p className="font-semibold">Prompt needs attention</p><ul className="mt-2 list-disc space-y-1 pl-5">{blockingMessages.map((message) => <li key={message}>{message}</li>)}</ul></div> : <div className="flex items-center gap-2 text-sm text-guard-green"><CheckCircle2 className="h-4 w-4" />Prompt placeholders are configured.</div>}
              {unused.length ? <p className="mt-3 flex items-start gap-2 text-sm text-guard-amber"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Unused configured variables: {unused.join(", ")}. They will remain saved.</p> : null}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-guard-ink">Variables</h2><p className="mt-1 text-sm text-guard-muted">{variables.length} configured · {detected.length} detected</p></div><button type="button" onClick={() => openAdd()} className="focus-ring rounded-lg bg-guard-primarySoft p-2 text-guard-primary hover:bg-guard-surfaceStrong"><Plus className="h-4 w-4" /><span className="sr-only">Add Variable</span></button></div>
            <div className="mt-5 space-y-3">
              {variables.map((variable, index) => {
                const isUnused = unused.includes(variable.key);
                return <div key={`${variable.key}-${index}`} className="rounded-lg border border-guard-line bg-guard-surfaceMuted p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-guard-ink">{variable.label}</p><code className="mt-1 block text-xs text-guard-primary">{`{{${variable.key}}}`}</code></div><button type="button" onClick={() => setDialog({ index })} className="focus-ring rounded-md p-2 text-guard-muted hover:bg-guard-primarySoft hover:text-guard-primary"><Pencil className="h-4 w-4" /><span className="sr-only">Edit {variable.label}</span></button></div><div className="mt-3 flex flex-wrap gap-2"><Badge>{variable.type.replace("_", " ")}</Badge><Badge tone={variable.required ? "primary" : "neutral"}>{variable.required ? "Required" : "Optional"}</Badge>{isUnused ? <Badge tone="average">Unused</Badge> : <Badge tone="good">In prompt</Badge>}</div>{variable.default_value !== null ? <p className="mt-3 truncate text-xs text-guard-muted">Default: {String(variable.default_value)}</p> : null}</div>;
              })}
              {unresolved.map((key) => <div key={key} className="rounded-lg border border-amber-200 bg-guard-amberSoft p-4"><p className="font-medium text-guard-ink">{key}</p><p className="mt-1 text-xs text-guard-amber">Needs configuration</p><button type="button" onClick={() => openAdd(key)} className="focus-ring mt-3 rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-guard-amber">Configure</button></div>)}
              {!variables.length && !unresolved.length ? <p className="rounded-lg border border-dashed border-guard-lineStrong p-5 text-center text-sm text-guard-muted">No variables configured. Prompts without variables are supported.</p> : null}
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="text-lg font-semibold text-guard-ink">Example Variable Values</h2><p className="mt-1 text-sm text-guard-muted">Temporary values for preview and sandbox testing. They are not saved with the version.</p>
          {variables.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">{variables.map((variable) => <VariableValueField key={variable.key} variable={variable} value={variableValues[variable.key]} onChange={(value) => setVariableValues((current) => ({ ...current, [variable.key]: value }))} />)}</div> : <p className="mt-4 text-sm text-slate-500">This prompt has no example values.</p>}
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-guard-ink">Final Prompt Preview</h2><p className="mt-1 text-sm text-guard-muted">The exact compiled system prompt sent to the model.</p></div><CopyButton text={preview.compiledPrompt} disabled={!preview.compiledPrompt || preview.errors.length > 0} /></div>{preview.errors.length ? <div className="mt-4 rounded-lg border border-amber-200 bg-guard-amberSoft p-3 text-sm text-guard-amber">{preview.errors.join(" ")}</div> : null}<HighlightedPromptPreview segments={preview.segments} className="mt-4" /></Card>
          <Card><h2 className="text-lg font-semibold text-guard-ink">Test with a user message</h2><p className="mt-1 text-sm text-guard-muted">Run an ephemeral sandbox test. It is not added to the Golden Dataset or evaluation results.</p><label className="mt-4 block text-sm font-medium text-guard-text">Sample user message<TextArea value={userInput} onChange={(event) => setUserInput(event.target.value)} maxLength={8000} className="mt-2 min-h-32" placeholder="Enter a realistic user message..." /></label><div className="mt-3 flex items-center justify-between text-xs text-guard-muted"><span>{userInput.length.toLocaleString()} / 8,000</span><button type="button" onClick={runTest} disabled={!canRun} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white hover:bg-guard-primaryHover disabled:cursor-not-allowed disabled:bg-slate-300"><FlaskConical className="h-4 w-4" />{testPending ? "Running Test..." : "Run Test"}</button></div><div className="mt-4" aria-live="polite">{testError ? <p className="rounded-lg border border-red-200 bg-guard-redSoft p-3 text-sm text-guard-red">{testError}</p> : null}{testOutput ? <div><p className="text-sm font-semibold text-guard-ink">Model response</p><div className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-guard-primaryLine bg-guard-surfaceMuted p-4 text-sm leading-6 text-guard-text">{testOutput}</div>{testedFingerprint !== currentTestFingerprint ? <p className="mt-2 text-xs text-guard-amber">Inputs changed after this test. Run it again for the current preview.</p> : null}</div> : null}</div></Card>
        </div>

        {submitError ? <p aria-live="assertive" className="rounded-md border border-guard-red/30 bg-guard-red/10 p-3 text-sm text-red-200">{submitError}</p> : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><ButtonLink variant="secondary" href={cancelHref}>Cancel</ButtonLink><SubmitButton disabled={!canSave} pendingText={pendingLabel}>{submitLabel}</SubmitButton></div>
      </form>

      {dialog ? <PromptVariableDialog variable={dialog.index !== undefined ? variables[dialog.index] : undefined} suggestedKey={dialog.suggestedKey} existingKeys={variables.map((variable) => variable.key)} onSave={saveVariable} onRemove={dialog.index !== undefined ? () => removeVariable(dialog.index!) : undefined} onClose={() => setDialog(null)} /> : null}
    </>
  );
}

function VariableValueField({ variable, value, onChange }: { variable: PromptVariable; value: unknown; onChange: (value: unknown) => void }) {
  const label = <>{variable.label}{variable.required ? <span className="ml-1 text-guard-amber">Required</span> : <span className="ml-1 text-slate-500">Optional</span>}</>;
  if (variable.type === "long_text") return <label className="text-sm font-medium text-guard-text">{label}<TextArea value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-24" />{variable.description ? <span className="mt-1 block text-xs font-normal text-guard-muted">{variable.description}</span> : null}</label>;
  if (variable.type === "boolean") return <label className="text-sm font-medium text-guard-text">{label}<Select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-2"><option value="">No value</option><option value="true">True</option><option value="false">False</option></Select>{variable.description ? <span className="mt-1 block text-xs font-normal text-guard-muted">{variable.description}</span> : null}</label>;
  if (variable.type === "select") return <label className="text-sm font-medium text-guard-text">{label}<Select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-2"><option value="">No value</option>{variable.options.map((option) => <option key={option} value={option}>{option}</option>)}</Select>{variable.description ? <span className="mt-1 block text-xs font-normal text-guard-muted">{variable.description}</span> : null}</label>;
  return <label className="text-sm font-medium text-guard-text">{label}<TextInput type={variable.type === "number" ? "number" : "text"} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} className="mt-2" />{variable.description ? <span className="mt-1 block text-xs font-normal text-guard-muted">{variable.description}</span> : null}</label>;
}
