-- Link Prompt Versions saved from Error Analysis back to their source workflow.

begin;

alter table public.prompt_versions
  add column source_prompt_version_id uuid
    references public.prompt_versions(id) on delete set null,
  add column source_error_analysis_report_id uuid
    references public.error_analysis_reports(id) on delete set null;

create index prompt_versions_source_prompt_idx
  on public.prompt_versions(source_prompt_version_id)
  where source_prompt_version_id is not null;
create index prompt_versions_source_error_report_idx
  on public.prompt_versions(source_error_analysis_report_id)
  where source_error_analysis_report_id is not null;

create or replace function public.save_prompt_proposal_as_version(
  p_project_id uuid,
  p_draft_id uuid,
  p_model_used text,
  p_fallback_notes text
)
returns table(saved_prompt_version_id uuid, saved_version_number integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  draft_prompt text;
  draft_proposal jsonb;
  draft_source_prompt_version_id uuid;
  draft_source_error_analysis_report_id uuid;
  source_variable_schema jsonb;
  next_version_number integer;
  new_prompt_version_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text, 0));

  select
    draft.current_proposed_prompt,
    draft.proposal,
    draft.source_prompt_version_id,
    draft.source_error_analysis_report_id,
    source_prompt.variable_schema
  into
    draft_prompt,
    draft_proposal,
    draft_source_prompt_version_id,
    draft_source_error_analysis_report_id,
    source_variable_schema
  from public.prompt_proposal_drafts as draft
  join public.prompt_versions as source_prompt
    on source_prompt.id = draft.source_prompt_version_id
   and source_prompt.project_id = draft.project_id
  where draft.id = p_draft_id
    and draft.project_id = p_project_id;

  if not found then
    raise exception 'Prompt Proposal draft does not belong to this project.' using errcode = 'P0002';
  end if;

  select coalesce(max(prompt_version.version_number), 0) + 1
  into next_version_number
  from public.prompt_versions as prompt_version
  where prompt_version.project_id = p_project_id;

  insert into public.prompt_versions (
    project_id,
    version_number,
    system_prompt,
    model_used,
    notes,
    is_active,
    variable_schema,
    source_prompt_version_id,
    source_error_analysis_report_id
  )
  values (
    p_project_id,
    next_version_number,
    draft_prompt,
    p_model_used,
    coalesce(nullif(btrim(draft_proposal ->> 'change_summary'), ''), p_fallback_notes),
    false,
    source_variable_schema,
    draft_source_prompt_version_id,
    draft_source_error_analysis_report_id
  )
  returning id into new_prompt_version_id;

  delete from public.prompt_proposal_drafts
  where id = p_draft_id
    and project_id = p_project_id;

  return query select new_prompt_version_id, next_version_number;
end;
$$;

revoke execute on function public.save_prompt_proposal_as_version(uuid, uuid, text, text) from public;
grant execute on function public.save_prompt_proposal_as_version(uuid, uuid, text, text) to anon, authenticated;

commit;
