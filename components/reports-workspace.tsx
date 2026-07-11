"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePromptDraft } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Card, EmptyState, Label, TextArea } from "@/components/ui";
import type { ErrorAnalysisReport } from "@/lib/types";

type PromptDraft = {
  improved_system_prompt: string;
  change_summary: string;
  added_rules: string[];
  changed_instructions: string[];
  removed_instructions: string[];
};

export function ReportsWorkspace({ workspaceSlug, projectId, reports }: { workspaceSlug: string; projectId: string; reports: ErrorAnalysisReport[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PromptDraft | null>(null);
  const [pending, startTransition] = useTransition();

  function summarize() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/ai/error-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_slug: workspaceSlug, project_id: projectId })
      });
      const json = await res.json();
      if (!res.ok) setError(json.error || "Could not summarize error analysis.");
      else router.refresh();
    });
  }

  function createPrompt() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/ai/create-prompt-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_slug: workspaceSlug, project_id: projectId })
      });
      const json = await res.json();
      if (!res.ok) setError(json.error || "Could not create prompt vNext.");
      else setDraft(json);
    });
  }

  const latest = reports[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <h2 className="text-lg font-semibold text-white">Error Analysis</h2>
        <p className="mt-2 text-sm text-slate-300">GPT-5 summarizes reviewed failed or average test cases only.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={summarize} disabled={pending} className="focus-ring rounded-md bg-guard-cyan px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
            {pending ? "Working..." : "Summarize Error Analysis"}
          </button>
          <button onClick={createPrompt} disabled={pending || !latest} className="focus-ring rounded-md border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            Create Prompt vNext
          </button>
        </div>
        {error ? <p className="mt-4 rounded-md border border-guard-red/30 bg-guard-red/10 p-3 text-sm text-guard-red">{error}</p> : null}
        <div className="mt-6">
          {latest ? <ReportBlock report={latest} /> : <EmptyState title="No reports yet">Run error analysis after completing human reviews.</EmptyState>}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-white">Prompt vNext draft</h2>
        {draft ? (
          <form action={savePromptDraft} className="mt-4 grid gap-4">
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="workspace_slug" value={workspaceSlug} />
            <div><Label>Change summary</Label><TextArea name="change_summary" defaultValue={draft.change_summary} /></div>
            <div><Label>Improved system prompt</Label><TextArea name="system_prompt" className="min-h-96 font-mono" defaultValue={draft.improved_system_prompt} /></div>
            <div className="rounded-md border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-300">
              <p className="font-medium text-white">Added rules</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">{draft.added_rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
            </div>
            <SubmitButton pendingText="Saving draft...">Save as next prompt version</SubmitButton>
          </form>
        ) : (
          <EmptyState title="No prompt draft">Create Prompt vNext after an error analysis report is available.</EmptyState>
        )}
      </Card>

      <div className="lg:col-span-2">
        <Card>
          <h2 className="text-lg font-semibold text-white">Previous reports</h2>
          <div className="mt-4 space-y-4">
            {reports.length ? reports.map((report) => <ReportBlock key={report.id} report={report} compact />) : <EmptyState title="No report history">Reports will appear here after generation.</EmptyState>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ReportBlock({ report, compact = false }: { report: ErrorAnalysisReport; compact?: boolean }) {
  const summary = report.summary as Record<string, string[] | Array<Record<string, string>>>;
  return (
    <div className="rounded-md border border-white/10 bg-slate-950/35 p-4">
      <p className="text-xs text-slate-500">{new Date(report.created_at).toLocaleString()}</p>
      <div className={`mt-3 grid gap-4 ${compact ? "md:grid-cols-2" : ""}`}>
        {Object.entries(summary).map(([key, value]) => (
          <div key={key}>
            <p className="text-sm font-semibold capitalize text-white">{key.replaceAll("_", " ")}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
              {(Array.isArray(value) ? value : []).map((item, index) => <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
