"use client";

import { useMemo, useState } from "react";
import { saveHumanReview } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, EmptyState, Label, Select, TextArea, TextInput } from "@/components/ui";
import type { EvaluationCriterion, HumanReview, HumanReviewRating, PromptVersion, TestCase } from "@/lib/types";

export function ReviewWorkspace({
  workspaceSlug,
  projectId,
  testCases,
  criteria,
  reviews,
  ratings,
  promptVersions
}: {
  workspaceSlug: string;
  projectId: string;
  testCases: TestCase[];
  criteria: EvaluationCriterion[];
  reviews: HumanReview[];
  ratings: HumanReviewRating[];
  promptVersions: PromptVersion[];
}) {
  const [statusFilter, setStatusFilter] = useState("generated");
  const visibleCases = useMemo(() => testCases.filter((testCase) => statusFilter === "all" || testCase.status === statusFilter), [statusFilter, testCases]);
  const [selectedId, setSelectedId] = useState(visibleCases[0]?.id || testCases[0]?.id || "");
  const selected = testCases.find((testCase) => testCase.id === selectedId) || visibleCases[0] || testCases[0];
  const existingReview = reviews.find((review) => review.test_case_id === selected?.id);
  const prompt = promptVersions.find((version) => version.id === selected?.prompt_version_id);
  const existingRatings = new Map(
    ratings
      .filter((rating) => rating.review_id === existingReview?.id)
      .map((rating) => [rating.criterion_id, rating.rating_label])
  );

  if (!testCases.length) return <EmptyState title="No generated outputs">Run AI outputs from the Golden Dataset page before human review.</EmptyState>;

  return (
    <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Review queue</h2>
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="max-w-44">
            <option value="all">All statuses</option>
            <option value="generated">Generated</option>
            <option value="reviewed">Reviewed</option>
          </Select>
        </div>
        <div className="space-y-3">
          {visibleCases.map((testCase) => (
            <button
              key={testCase.id}
              onClick={() => setSelectedId(testCase.id)}
              className={`w-full rounded-md border p-4 text-left text-sm ${selected?.id === testCase.id ? "border-guard-cyan bg-guard-cyan/10" : "border-white/10 bg-slate-950/35 hover:bg-white/5"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="line-clamp-2 text-white">{testCase.user_input}</span>
                <Badge tone={testCase.status === "reviewed" ? "good" : "cyan"}>{testCase.status}</Badge>
              </div>
              <p className="mt-2 text-xs text-slate-400">{testCase.model_used || "No model"} · {testCase.case_type}</p>
            </button>
          ))}
        </div>
      </Card>

      {selected ? (
        <Card>
          <div className="grid gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">User input</p>
              <p className="mt-2 rounded-md border border-white/10 bg-slate-950/35 p-4 text-sm leading-6 text-white">{selected.user_input}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Variables</p>
                <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-white/10 bg-slate-950/35 p-4 text-xs text-slate-300">{JSON.stringify(selected.variable_values, null, 2)}</pre>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Run metadata</p>
                <div className="mt-2 rounded-md border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-300">
                  <p>Prompt version: {prompt ? `v${prompt.version_number}` : "Unknown"}</p>
                  <p>Model used: {selected.model_used || "Unknown"}</p>
                  <p>Expected: {selected.expected_answer || "Not provided"}</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">AI output</p>
              <p className="mt-2 whitespace-pre-wrap rounded-md border border-white/10 bg-slate-950/35 p-4 text-sm leading-6 text-slate-100">{selected.generated_ai_output}</p>
            </div>
            <form action={saveHumanReview} className="grid gap-4">
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="workspace_slug" value={workspaceSlug} />
              <input type="hidden" name="test_case_id" value={selected.id} />
              <div className="grid gap-3">
                {criteria.map((criterion) => (
                  <div key={criterion.id} className="rounded-md border border-white/10 bg-white/[0.03] p-4">
                    <p className="font-medium text-white">{criterion.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{criterion.description}</p>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm">
                      {["Good", "Average", "Bad"].map((rating) => (
                        <label key={rating} className="flex items-center gap-2 text-slate-200">
                          <input required type="radio" name={`rating_${criterion.id}`} value={rating} defaultChecked={existingRatings.get(criterion.id) === rating} />
                          {rating}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Failure category</Label><TextInput name="failure_category" defaultValue={existingReview?.failure_category || ""} placeholder="Policy miss, hallucination, tone, refusal" /></div>
                <div><Label>Severity</Label><Select name="severity" defaultValue={existingReview?.severity || ""}><option value="">None</option><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option></Select></div>
              </div>
              <div><Label>Human notes</Label><TextArea name="human_notes" defaultValue={existingReview?.human_notes || ""} placeholder="What failed, why it matters, and what the prompt should clarify." /></div>
              <SubmitButton pendingText="Saving review...">Mark as reviewed</SubmitButton>
            </form>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
