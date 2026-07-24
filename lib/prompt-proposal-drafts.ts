import { z } from "zod";
import { promptVNextSchema } from "@/lib/ai/schemas";
import type { PromptProposalResponse } from "@/lib/types";

const sourcePromptSnapshotSchema = z.object({
  id: z.string().uuid(),
  version_number: z.number().int().positive(),
  system_prompt: z.string()
}).strict();

const sourceReportSnapshotSchema = z.object({
  id: z.string().uuid(),
  summary: z.record(z.unknown())
}).strict();

export const promptProposalDraftRowSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  source_prompt_version_id: z.string().uuid(),
  source_error_analysis_report_id: z.string().uuid(),
  source_prompt_snapshot: sourcePromptSnapshotSchema,
  source_report_snapshot: sourceReportSnapshotSchema,
  proposal: promptVNextSchema,
  current_proposed_prompt: z.string().trim().min(1),
  failed_test_case_count: z.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string()
}).strict();

export const promptProposalResponseSchema = z.object({
  draft_id: z.string().uuid(),
  source_prompt: sourcePromptSnapshotSchema,
  proposed_version_number: z.number().int().positive(),
  source_report: sourceReportSnapshotSchema,
  failed_test_case_count: z.number().int().nonnegative(),
  proposal: promptVNextSchema,
  current_proposed_prompt: z.string().trim().min(1)
}).strict();

export function toPromptProposalResponse(
  value: unknown,
  proposedVersionNumber: number
): PromptProposalResponse {
  const row = promptProposalDraftRowSchema.parse(value);
  return promptProposalResponseSchema.parse({
    draft_id: row.id,
    source_prompt: row.source_prompt_snapshot,
    proposed_version_number: proposedVersionNumber,
    source_report: row.source_report_snapshot,
    failed_test_case_count: row.failed_test_case_count,
    proposal: row.proposal,
    current_proposed_prompt: row.current_proposed_prompt
  });
}
