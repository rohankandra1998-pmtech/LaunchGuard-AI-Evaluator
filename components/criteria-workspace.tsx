"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCriterion, saveCriterion } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, EmptyState, Label, TextArea, TextInput } from "@/components/ui";
import type { EvaluationCriterion, Project, PromptVersion } from "@/lib/types";

type Suggested = {
  name: string;
  description: string;
  good_definition: string;
  average_definition: string;
  bad_definition: string;
  category: string;
};

export function CriteriaWorkspace({
  workspaceSlug,
  project,
  activePrompt,
  criteria
}: {
  workspaceSlug: string;
  project: Project;
  activePrompt: PromptVersion | null;
  criteria: EvaluationCriterion[];
}) {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<Suggested[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function suggestCriteria() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/ai/suggest-criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_slug: workspaceSlug, project_id: project.id })
      });
      const json = await res.json();
      if (!res.ok) setError(json.error || "Could not suggest criteria.");
      else setSuggestions(json.criteria);
    });
  }

  async function accept(item: Suggested) {
    const form = new FormData();
    form.set("workspace_slug", workspaceSlug);
    form.set("project_id", project.id);
    Object.entries(item).forEach(([key, value]) => form.set(key, value));
    await saveCriterion(form);
    setSuggestions((current) => current.filter((candidate) => candidate !== item));
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-guard-ink">Suggest Criteria</h2>
          <button onClick={suggestCriteria} disabled={pending || !activePrompt} className="focus-ring rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white hover:bg-guard-primaryHover disabled:bg-slate-300">
            {pending ? "Thinking..." : "Suggest Criteria"}
          </button>
        </div>
        <p className="mt-2 text-sm text-guard-muted">GPT-5 uses project context, variables, and the active prompt to suggest 5-7 human review criteria.</p>
        {error ? <p className="mt-4 rounded-md border border-guard-red/30 bg-guard-red/10 p-3 text-sm text-guard-red">{error}</p> : null}
        <div className="mt-5 space-y-3">
          {suggestions.map((item) => (
            <div key={item.name} className="rounded-lg border border-guard-line bg-guard-surfaceMuted p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-guard-ink">{item.name}</p>
                  <p className="mt-1 text-sm text-slate-400">{item.description}</p>
                </div>
                <button onClick={() => accept(item)} className="focus-ring rounded-lg border border-guard-primaryLine bg-white px-3 py-2 text-sm font-medium text-guard-primaryHover hover:bg-guard-primarySoft">Accept</button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-guard-ink">Manual criterion</h2>
        <form action={saveCriterion} className="mt-4 grid gap-4">
          <input type="hidden" name="project_id" value={project.id} />
          <input type="hidden" name="workspace_slug" value={workspaceSlug} />
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>Name</Label><TextInput required name="name" placeholder="Factual accuracy" /></div>
            <div><Label>Category</Label><TextInput name="category" placeholder="Correctness" /></div>
          </div>
          <div><Label>Description</Label><TextArea required name="description" /></div>
          <div className="grid gap-4 md:grid-cols-3">
            <div><Label>Good definition</Label><TextArea required name="good_definition" /></div>
            <div><Label>Average definition</Label><TextArea required name="average_definition" /></div>
            <div><Label>Bad definition</Label><TextArea required name="bad_definition" /></div>
          </div>
          <SubmitButton>Add criterion</SubmitButton>
        </form>
      </Card>

      <div className="lg:col-span-2">
        <Card>
          <h2 className="text-lg font-semibold text-guard-ink">Saved Evaluation Criteria</h2>
          <div className="mt-4 grid gap-3">
            {criteria.length ? criteria.map((criterion) => (
              <div key={criterion.id} className="rounded-lg border border-guard-line bg-guard-surfaceMuted p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2"><p className="font-medium text-guard-ink">{criterion.name}</p>{criterion.category ? <Badge>{criterion.category}</Badge> : null}</div>
                    <p className="mt-2 text-sm text-guard-text">{criterion.description}</p>
                    <p className="mt-2 text-xs text-slate-400">Good: {criterion.good_definition}</p>
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-medium text-guard-primary">Edit criterion</summary>
                      <form action={saveCriterion} className="mt-4 grid gap-4 rounded-lg border border-guard-line bg-white p-4">
                        <input type="hidden" name="id" value={criterion.id} />
                        <input type="hidden" name="project_id" value={project.id} />
                        <input type="hidden" name="workspace_slug" value={workspaceSlug} />
                        <div className="grid gap-4 md:grid-cols-2">
                          <div><Label>Name</Label><TextInput required name="name" defaultValue={criterion.name} /></div>
                          <div><Label>Category</Label><TextInput name="category" defaultValue={criterion.category || ""} /></div>
                        </div>
                        <div><Label>Description</Label><TextArea required name="description" defaultValue={criterion.description} /></div>
                        <div className="grid gap-4 md:grid-cols-3">
                          <div><Label>Good definition</Label><TextArea required name="good_definition" defaultValue={criterion.good_definition} /></div>
                          <div><Label>Average definition</Label><TextArea required name="average_definition" defaultValue={criterion.average_definition} /></div>
                          <div><Label>Bad definition</Label><TextArea required name="bad_definition" defaultValue={criterion.bad_definition} /></div>
                        </div>
                        <SubmitButton pendingText="Updating criterion...">Update criterion</SubmitButton>
                      </form>
                    </details>
                  </div>
                  <form action={deleteCriterion}>
                    <input type="hidden" name="id" value={criterion.id} />
                    <input type="hidden" name="project_id" value={project.id} />
                    <input type="hidden" name="workspace_slug" value={workspaceSlug} />
                    <SubmitButton confirmMessage={`Delete the ${criterion.name} criterion?`} className="bg-guard-red/15 text-guard-red hover:bg-guard-red/25" pendingText="Deleting...">Delete</SubmitButton>
                  </form>
                </div>
              </div>
            )) : <EmptyState title="No criteria yet">Add criteria manually or let GPT-5 suggest a review rubric.</EmptyState>}
          </div>
        </Card>
      </div>
    </div>
  );
}
