-- Persist one reviewable Prompt Proposal draft per project.

begin;

create table public.prompt_proposal_drafts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_prompt_version_id uuid not null references public.prompt_versions(id) on delete cascade,
  source_error_analysis_report_id uuid not null references public.error_analysis_reports(id) on delete cascade,
  source_prompt_snapshot jsonb not null
    constraint prompt_proposal_drafts_source_prompt_snapshot_is_object
    check (jsonb_typeof(source_prompt_snapshot) = 'object'),
  source_report_snapshot jsonb not null
    constraint prompt_proposal_drafts_source_report_snapshot_is_object
    check (jsonb_typeof(source_report_snapshot) = 'object'),
  proposal jsonb not null
    constraint prompt_proposal_drafts_proposal_is_object
    check (jsonb_typeof(proposal) = 'object'),
  current_proposed_prompt text not null
    constraint prompt_proposal_drafts_current_prompt_not_blank
    check (length(btrim(current_proposed_prompt)) > 0),
  failed_test_case_count integer not null default 0
    constraint prompt_proposal_drafts_failed_count_nonnegative
    check (failed_test_case_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prompt_proposal_drafts_one_per_project unique (project_id)
);

create index prompt_proposal_drafts_source_prompt_idx
  on public.prompt_proposal_drafts(source_prompt_version_id);
create index prompt_proposal_drafts_source_report_idx
  on public.prompt_proposal_drafts(source_error_analysis_report_id);

drop trigger if exists touch_prompt_proposal_drafts_updated_at on public.prompt_proposal_drafts;
create trigger touch_prompt_proposal_drafts_updated_at
before update on public.prompt_proposal_drafts
for each row execute function public.touch_updated_at();

drop trigger if exists touch_project_from_prompt_proposal_drafts_activity on public.prompt_proposal_drafts;
create trigger touch_project_from_prompt_proposal_drafts_activity
after insert or update or delete on public.prompt_proposal_drafts
for each row execute function public.touch_project_from_child_activity();

alter table public.prompt_proposal_drafts enable row level security;

grant select, insert, update, delete on table public.prompt_proposal_drafts to anon, authenticated;

create policy "public collaborative access" on public.prompt_proposal_drafts
for all to anon, authenticated using (true) with check (true);

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
  source_variable_schema jsonb;
  next_version_number integer;
  new_prompt_version_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text, 0));

  select draft.current_proposed_prompt, draft.proposal, source_prompt.variable_schema
  into draft_prompt, draft_proposal, source_variable_schema
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
    variable_schema
  )
  values (
    p_project_id,
    next_version_number,
    draft_prompt,
    p_model_used,
    coalesce(nullif(btrim(draft_proposal ->> 'change_summary'), ''), p_fallback_notes),
    false,
    source_variable_schema
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
