"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePromptDraft } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, EmptyState, Label, TextArea } from "@/components/ui";
import { errorAnalysisSchema, type ErrorAnalysisResponse } from "@/lib/ai/schemas";
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
        <h2 className="text-lg font-semibold text-guard-ink">Error Analysis</h2>
        <p className="mt-2 text-sm text-guard-muted">GPT-5 summarizes reviewed failed or average test cases only.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={summarize} disabled={pending} className="focus-ring rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white hover:bg-guard-primaryHover disabled:bg-slate-300">
            {pending ? "Working..." : "Summarize Error Analysis"}
          </button>
          <button onClick={createPrompt} disabled={pending || !latest} className="focus-ring rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-primaryHover hover:bg-guard-primarySoft disabled:text-slate-400">
            Create Prompt vNext
          </button>
        </div>
        {error ? <p className="mt-4 rounded-md border border-guard-red/30 bg-guard-red/10 p-3 text-sm text-guard-red">{error}</p> : null}
        <div className="mt-6">
          {latest ? <ReportBlock report={latest} /> : <EmptyState title="No reports yet">Run error analysis after completing human reviews.</EmptyState>}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-guard-ink">Prompt vNext draft</h2>
        {draft ? (
          <form action={savePromptDraft} className="mt-4 grid gap-4">
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="workspace_slug" value={workspaceSlug} />
            <div><Label>Change summary</Label><TextArea name="change_summary" defaultValue={draft.change_summary} /></div>
            <div><Label>Improved system prompt</Label><TextArea name="system_prompt" className="min-h-96 font-mono" defaultValue={draft.improved_system_prompt} /></div>
            <div className="rounded-lg border border-guard-line bg-guard-surfaceMuted p-4 text-sm text-guard-text">
              <p className="font-medium text-guard-ink">Added rules</p>
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
          <h2 className="text-lg font-semibold text-guard-ink">Previous reports</h2>
          <div className="mt-4 space-y-4">
            {reports.length ? reports.map((report) => <ReportBlock key={report.id} report={report} compact />) : <EmptyState title="No report history">Reports will appear here after generation.</EmptyState>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ReportBlock({ report, compact = false }: { report: ErrorAnalysisReport; compact?: boolean }) {
  const parsedSummary = errorAnalysisSchema.safeParse(report.summary);
  if (parsedSummary.success) {
    return <StructuredReportBlock createdAt={report.created_at} summary={parsedSummary.data} compact={compact} />;
  }
  if (isLegacySummary(report.summary)) {
    return <LegacyReportBlock createdAt={report.created_at} summary={report.summary} compact={compact} />;
  }

  return (
    <div className="rounded-lg border border-guard-line bg-guard-surfaceMuted p-4">
      <p className="text-xs text-slate-500">{new Date(report.created_at).toLocaleString()}</p>
      <div className="mt-3 rounded-lg border border-dashed border-guard-lineStrong bg-white p-4">
        <p className="text-sm font-semibold text-guard-ink">This report uses an unsupported format</p>
        <p className="mt-1 text-sm text-guard-muted">Generate a new Error Analysis report to view structured findings.</p>
      </div>
    </div>
  );
}

type Severity = ErrorAnalysisResponse["failure_patterns"][number]["severity"];
type Priority = ErrorAnalysisResponse["recommended_prompt_changes"][number]["priority"];

function StructuredReportBlock({ createdAt, summary, compact }: { createdAt: string; summary: ErrorAnalysisResponse; compact: boolean }) {
  const patterns = [...summary.failure_patterns].sort((left, right) =>
    severityRank[left.severity] - severityRank[right.severity]
    || right.affected_test_case_count - left.affected_test_case_count
  );
  const patternTitles = new Map(summary.failure_patterns.map((pattern) => [pattern.pattern_id, pattern.title]));

  if (compact) {
    return (
      <div className="rounded-lg border border-guard-line bg-guard-surfaceMuted p-4">
        <p className="text-xs text-slate-500">{new Date(createdAt).toLocaleString()}</p>
        <p className="mt-3 text-sm leading-6 text-guard-text">{summary.executive_summary.overview}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="primary">{summary.executive_summary.analyzed_test_case_count} analyzed</Badge>
          <Badge tone={summary.executive_summary.high_severity_pattern_count ? "bad" : "neutral"}>
            {summary.executive_summary.high_severity_pattern_count} high severity
          </Badge>
        </div>
        <div className="mt-4 space-y-2">
          {patterns.map((pattern, index) => (
            <div key={`${pattern.pattern_id}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-guard-line bg-white px-3 py-2">
              <p className="text-sm font-medium text-guard-ink">{pattern.title}</p>
              <div className="flex items-center gap-2">
                <SeverityBadge severity={pattern.severity} />
                <span className="text-xs text-guard-muted">{pattern.affected_test_case_count} case{pattern.affected_test_case_count === 1 ? "" : "s"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const recommendations = [...summary.recommended_prompt_changes].sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority]);

  return (
    <div className="rounded-lg border border-guard-line bg-guard-surfaceMuted p-4">
      <p className="text-xs text-slate-500">{new Date(createdAt).toLocaleString()}</p>
      <div className="mt-4 space-y-7">
        <ExecutiveSummarySection summary={summary.executive_summary} />

        <section>
          <h3 className="text-base font-semibold text-guard-ink">Failure Patterns</h3>
          <div className="mt-3 space-y-3">
            {patterns.map((pattern, index) => <FailurePatternCard key={`${pattern.pattern_id}-${index}`} pattern={pattern} />)}
          </div>
        </section>

        <section>
          <h3 className="text-base font-semibold text-guard-ink">Recommended Prompt Changes</h3>
          <div className="mt-3 space-y-3">
            {recommendations.map((change, index) => (
              <RecommendedChangeCard key={`${change.change_id}-${index}`} change={change} patternTitles={patternTitles} />
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-base font-semibold text-guard-ink">Evidence Examples</h3>
          <div className="mt-3 space-y-3">
            {summary.evidence_examples.map((example, index) => (
              <EvidenceExampleCard key={`${example.test_case_id}-${index}`} example={example} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function ExecutiveSummarySection({ summary }: { summary: ErrorAnalysisResponse["executive_summary"] }) {
  return (
    <section>
      <h3 className="text-base font-semibold text-guard-ink">Executive Summary</h3>
      <p className="mt-2 text-sm leading-6 text-guard-text">{summary.overview}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SummaryMetric label="Failure cases analyzed" value={String(summary.analyzed_test_case_count)} />
        <SummaryMetric label="High-severity patterns" value={String(summary.high_severity_pattern_count)} tone={summary.high_severity_pattern_count ? "danger" : "neutral"} />
        <SummaryMetric label="Highest-priority pattern" value={summary.highest_priority_pattern_id ? formatIdentifier(summary.highest_priority_pattern_id) : "None"} />
      </div>
    </section>
  );
}

function SummaryMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "danger" }) {
  return (
    <div className={tone === "danger" ? "rounded-lg border border-red-200 bg-guard-redSoft p-3" : "rounded-lg border border-guard-line bg-white p-3"}>
      <p className={tone === "danger" ? "text-xs font-medium text-guard-red" : "text-xs font-medium text-guard-muted"}>{label}</p>
      <p className="mt-1 break-words text-lg font-semibold text-guard-ink">{value}</p>
    </div>
  );
}

function FailurePatternCard({ pattern }: { pattern: ErrorAnalysisResponse["failure_patterns"][number] }) {
  return (
    <article className="rounded-lg border border-guard-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h4 className="font-semibold text-guard-ink">{pattern.title}</h4>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={pattern.severity} />
          <Badge tone="neutral">{pattern.affected_test_case_count} affected case{pattern.affected_test_case_count === 1 ? "" : "s"}</Badge>
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <LabeledText label="What happened">{pattern.what_happened}</LabeledText>
        <LabeledText label="Likely root cause">{pattern.likely_root_cause}</LabeledText>
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-guard-muted">Affected criteria</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {pattern.affected_criteria.map((criterion, index) => <Badge key={`${criterion}-${index}`} tone="primary">{criterion}</Badge>)}
        </div>
      </div>
    </article>
  );
}

function RecommendedChangeCard({ change, patternTitles }: {
  change: ErrorAnalysisResponse["recommended_prompt_changes"][number];
  patternTitles: Map<string, string>;
}) {
  return (
    <article className="rounded-lg border border-guard-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h4 className="font-semibold text-guard-ink">{change.recommendation}</h4>
        <div className="flex gap-2">
          <PriorityBadge priority={change.priority} />
          <Badge tone="neutral">{capitalize(change.change_type)}</Badge>
        </div>
      </div>
      <LabeledText className="mt-4" label="Rationale">{change.rationale}</LabeledText>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-guard-muted">Related patterns</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {change.related_pattern_ids.map((patternId, index) => (
            <Badge key={`${patternId}-${index}`} tone="primary">{patternTitles.get(patternId) || formatIdentifier(patternId)}</Badge>
          ))}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-guard-muted">Exact prompt instruction</p>
        <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-guard-primaryLine bg-guard-primarySoft/50 p-4 font-mono text-xs leading-5 text-guard-ink [overflow-wrap:anywhere]">{change.exact_prompt_instruction}</pre>
      </div>
    </article>
  );
}

function EvidenceExampleCard({ example }: { example: ErrorAnalysisResponse["evidence_examples"][number] }) {
  return (
    <article className="rounded-lg border border-guard-line bg-white p-4">
      <p className="text-xs font-medium text-guard-muted">Test case {compactId(example.test_case_id)}</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <LabeledText label="User input">{example.user_input}</LabeledText>
        <LabeledText label="Relevant AI output">{example.ai_output_excerpt}</LabeledText>
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-guard-muted">Failed criteria</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {example.failed_criteria.map((criterion, index) => (
            <Badge key={`${criterion.criterion_name}-${index}`} tone={criterion.rating === "Bad" ? "bad" : "average"}>
              {criterion.criterion_name} · {criterion.rating}
            </Badge>
          ))}
        </div>
      </div>
      {example.human_notes ? <LabeledText className="mt-4" label="Human notes">{example.human_notes}</LabeledText> : null}
      <LabeledText className="mt-4" label="Why it failed">{example.why_it_failed}</LabeledText>
    </article>
  );
}

function LabeledText({ label, children, className = "" }: { label: string; children: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-guard-muted">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-guard-text">{children}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge tone={severity === "high" ? "bad" : severity === "medium" ? "average" : "neutral"}>{capitalize(severity)} severity</Badge>;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge tone={priority === "high" ? "bad" : priority === "medium" ? "average" : "neutral"}>{capitalize(priority)} priority</Badge>;
}

type LegacyExample = { user_input: string; output_issue: string };
type LegacySummary = {
  top_failure_patterns: string[];
  most_severe_mistakes: string[];
  likely_root_causes: string[];
  suggested_prompt_improvements: string[];
  recommended_rules_to_add: string[];
  problematic_examples: LegacyExample[];
};

const legacySections: Array<{ key: Exclude<keyof LegacySummary, "problematic_examples">; label: string }> = [
  { key: "top_failure_patterns", label: "Top failure patterns" },
  { key: "most_severe_mistakes", label: "Most severe mistakes" },
  { key: "likely_root_causes", label: "Likely root causes" },
  { key: "suggested_prompt_improvements", label: "Suggested prompt improvements" },
  { key: "recommended_rules_to_add", label: "Recommended rules to add" }
];

function LegacyReportBlock({ createdAt, summary, compact }: { createdAt: string; summary: LegacySummary; compact: boolean }) {
  return (
    <div className="rounded-lg border border-guard-line bg-guard-surfaceMuted p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">{new Date(createdAt).toLocaleString()}</p>
        <Badge tone="neutral">Legacy format</Badge>
      </div>
      <div className={`mt-4 grid gap-4 ${compact ? "md:grid-cols-2" : ""}`}>
        {legacySections.map(({ key, label }) => (
          <section key={key}>
            <h3 className="text-sm font-semibold text-guard-ink">{label}</h3>
            {summary[key].length ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-guard-text">
                {summary[key].map((item, index) => <li key={index}>{item}</li>)}
              </ul>
            ) : <p className="mt-2 text-sm text-guard-muted">No findings recorded.</p>}
          </section>
        ))}
      </div>
      {summary.problematic_examples.length ? (
        <section className="mt-4">
          <h3 className="text-sm font-semibold text-guard-ink">Problematic examples</h3>
          <div className={`mt-2 grid gap-3 ${compact ? "md:grid-cols-2" : ""}`}>
            {summary.problematic_examples.map((example, index) => (
              <div key={index} className="rounded-md border border-guard-line bg-white p-3">
                <LabeledText label="User input">{example.user_input}</LabeledText>
                <LabeledText className="mt-3" label="Output issue">{example.output_issue}</LabeledText>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function isLegacySummary(value: unknown): value is LegacySummary {
  if (!isRecord(value)) return false;
  const stringSectionsAreValid = legacySections.every(({ key }) => isStringArray(value[key]));
  return stringSectionsAreValid
    && Array.isArray(value.problematic_examples)
    && value.problematic_examples.every((example) =>
      isRecord(example) && typeof example.user_input === "string" && typeof example.output_issue === "string"
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

const severityRank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatIdentifier(value: string) {
  return value.replaceAll("_", " ");
}

function compactId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}
