"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTestCase, saveGeneratedTestCases, saveTestCase } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, EmptyState, Label, Select, TextArea, TextInput } from "@/components/ui";
import type { EvaluationCriterion, Project, PromptVersion, TestCase } from "@/lib/types";

const statusTone = { draft: "neutral", generated: "cyan", reviewed: "good" } as const;

export function DatasetWorkspace({
  workspaceSlug,
  project,
  promptVersions,
  criteria,
  testCases
}: {
  workspaceSlug: string;
  project: Project;
  promptVersions: PromptVersion[];
  criteria: EvaluationCriterion[];
  testCases: TestCase[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState("all");
  const [promptVersion, setPromptVersion] = useState(promptVersions.find((p) => p.is_active)?.id || promptVersions[0]?.id || "");
  const [model, setModel] = useState("gpt-4.1");
  const [generated, setGenerated] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const activeVariableKeys = (promptVersions.find((prompt) => prompt.is_active) || promptVersions[0])?.variable_schema?.map((variable) => variable.key) || project.variables;

  const visibleCases = useMemo(() => {
    return testCases.filter((testCase) => status === "all" || testCase.status === status);
  }, [status, testCases]);

  function generateStarterSet() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/ai/generate-test-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_slug: workspaceSlug, project_id: project.id })
      });
      const json = await res.json();
      if (!res.ok) setError(json.error || "Could not generate starter test cases.");
      else setGenerated(json.test_cases);
    });
  }

  function runOutputs() {
    setError(null);
    startTransition(async () => {
      const ids = selected.length ? selected : visibleCases.map((testCase) => testCase.id);
      const res = await fetch("/api/ai/generate-output", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_slug: workspaceSlug, project_id: project.id, test_case_ids: ids, prompt_version_id: promptVersion, model })
      });
      const json = await res.json();
      if (!res.ok) setError(json.error || "Could not run AI outputs.");
      else {
        setSelected([]);
        router.refresh();
      }
    });
  }

  async function saveSuggestions() {
    await saveGeneratedTestCases(workspaceSlug, project.id, generated);
    setGenerated([]);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <form action={saveTestCase} className="grid gap-4">
            <input type="hidden" name="project_id" value={project.id} />
            <input type="hidden" name="workspace_slug" value={workspaceSlug} />
            <h2 className="text-lg font-semibold text-white">Add test case</h2>
            <div><Label>User input / question</Label><TextArea required name="user_input" /></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label>Case type</Label><Select name="case_type"><option value="normal">normal</option><option value="edge">edge</option><option value="ambiguous">ambiguous</option><option value="missing_context">missing_context</option><option value="adversarial">adversarial</option><option value="tone_sensitive">tone_sensitive</option></Select></div>
              <div><Label>Expected answer</Label><TextInput name="expected_answer" /></div>
            </div>
            <div><Label>Variable values JSON</Label><TextArea name="variable_values" defaultValue={JSON.stringify(Object.fromEntries(activeVariableKeys.map((key) => [key, ""])), null, 2)} className="font-mono" /></div>
            <SubmitButton>Add test case</SubmitButton>
          </form>
          <div>
            <h2 className="text-lg font-semibold text-white">Generate Starter Test Set</h2>
            <p className="mt-2 text-sm text-slate-300">GPT-5 creates normal, edge, ambiguous, missing-context, adversarial, and tone-sensitive cases.</p>
            <button onClick={generateStarterSet} disabled={pending || !criteria.length} className="focus-ring mt-4 rounded-md bg-guard-cyan px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
              {pending ? "Generating..." : "Generate Starter Test Set"}
            </button>
            {error ? <p className="mt-4 rounded-md border border-guard-red/30 bg-guard-red/10 p-3 text-sm text-guard-red">{error}</p> : null}
            {generated.length ? (
              <div className="mt-4 space-y-3">
                {generated.map((item, index) => (
                  <div key={index} className="rounded-md border border-white/10 bg-slate-950/35 p-3 text-sm text-slate-200">
                    <Badge>{String(item.case_type)}</Badge>
                    <p className="mt-2">{String(item.user_input)}</p>
                  </div>
                ))}
                <button onClick={saveSuggestions} className="rounded-md bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">Save generated cases</button>
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Golden Dataset</h2>
            <p className="mt-1 text-sm text-slate-400">Select cases, choose a prompt version, and run GPT outputs.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">All statuses</option><option value="draft">Draft</option><option value="generated">Generated</option><option value="reviewed">Reviewed</option>
            </Select>
            <Select value={promptVersion} onChange={(event) => setPromptVersion(event.target.value)}>
              {promptVersions.map((prompt) => <option key={prompt.id} value={prompt.id}>v{prompt.version_number}{prompt.is_active ? " active" : ""}</option>)}
            </Select>
            <Select value={model} onChange={(event) => setModel(event.target.value)}>
              <option value="gpt-4.1">gpt-4.1</option><option value="gpt-5">gpt-5</option>
            </Select>
            <button onClick={runOutputs} disabled={pending || !visibleCases.length || !promptVersion} className="focus-ring rounded-md bg-guard-cyan px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
              {pending ? "Running..." : "Run AI Outputs"}
            </button>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto">
          {visibleCases.length ? (
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-400"><tr><th className="p-3">Select</th><th className="p-3">Input</th><th className="p-3">Status</th><th className="p-3">Case</th><th className="p-3">Output</th><th className="p-3">Actions</th></tr></thead>
              <tbody>
                {visibleCases.map((testCase) => (
                  <tr key={testCase.id} className="border-t border-white/10">
                    <td className="p-3"><input type="checkbox" checked={selected.includes(testCase.id)} onChange={(event) => setSelected((cur) => event.target.checked ? [...cur, testCase.id] : cur.filter((id) => id !== testCase.id))} /></td>
                    <td className="max-w-md p-3 text-slate-200">{testCase.user_input}</td>
                    <td className="p-3"><Badge tone={statusTone[testCase.status]}>{testCase.status}</Badge></td>
                    <td className="p-3 text-slate-300">{testCase.case_type}</td>
                    <td className="max-w-sm truncate p-3 text-slate-400">{testCase.generated_ai_output || "Not generated"}</td>
                    <td className="p-3">
                      <div className="flex items-start gap-2">
                        <details>
                          <summary className="cursor-pointer rounded-md bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15">Edit</summary>
                          <form action={saveTestCase} className="mt-3 grid w-80 gap-3 rounded-md border border-white/10 bg-guard-panel p-4 shadow-glow">
                            <input type="hidden" name="id" value={testCase.id} />
                            <input type="hidden" name="project_id" value={project.id} />
                            <input type="hidden" name="workspace_slug" value={workspaceSlug} />
                            <div><Label>User input</Label><TextArea required name="user_input" defaultValue={testCase.user_input} /></div>
                            <div><Label>Case type</Label><Select name="case_type" defaultValue={testCase.case_type || "normal"}><option value="normal">normal</option><option value="edge">edge</option><option value="ambiguous">ambiguous</option><option value="missing_context">missing_context</option><option value="adversarial">adversarial</option><option value="tone_sensitive">tone_sensitive</option></Select></div>
                            <div><Label>Expected answer</Label><TextArea name="expected_answer" defaultValue={testCase.expected_answer || ""} /></div>
                            <div><Label>Variable values JSON</Label><TextArea name="variable_values" defaultValue={JSON.stringify(testCase.variable_values, null, 2)} className="font-mono" /></div>
                            <SubmitButton pendingText="Updating case...">Update test case</SubmitButton>
                          </form>
                        </details>
                        <form action={deleteTestCase}>
                          <input type="hidden" name="id" value={testCase.id} />
                          <input type="hidden" name="project_id" value={project.id} />
                          <input type="hidden" name="workspace_slug" value={workspaceSlug} />
                          <SubmitButton confirmMessage="Delete this test case and its generated output history?" className="bg-guard-red/15 text-guard-red hover:bg-guard-red/25" pendingText="Deleting...">Delete</SubmitButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState title="No test cases">Add a case manually or generate a starter test set.</EmptyState>}
        </div>
      </Card>
    </div>
  );
}
