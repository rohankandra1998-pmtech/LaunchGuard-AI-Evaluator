-- LaunchGuard public workspace schema for a fresh Supabase project.
-- All data is intentionally public and collaborative in this prototype.

create extension if not exists "pgcrypto";
create extension if not exists pg_cron;

create type public.test_case_status as enum ('draft', 'generated', 'reviewed');
create type public.rating_label as enum ('Good', 'Average', 'Bad');
create type public.review_severity as enum ('Low', 'Medium', 'High');
create type public.case_type as enum ('normal', 'edge', 'ambiguous', 'missing_context', 'adversarial', 'tone_sensitive');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  product_type text not null default '',
  goal text not null default '',
  target_user text not null default '',
  description text,
  variables jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trashed_at timestamptz
);

create table public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  system_prompt text not null,
  model_used text not null default 'gpt-4.1' check (model_used in ('gpt-4.1', 'gpt-5')),
  notes text,
  is_active boolean not null default false,
  variable_schema jsonb not null default '[]'::jsonb
    constraint prompt_versions_variable_schema_is_array
    check (jsonb_typeof(variable_schema) = 'array'),
  created_at timestamptz not null default now(),
  unique(project_id, version_number)
);

create unique index prompt_versions_one_active_per_project
  on public.prompt_versions(project_id)
  where is_active;

create table public.evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text not null,
  good_definition text not null,
  average_definition text not null,
  bad_definition text not null,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.test_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_input text not null,
  case_type public.case_type,
  variable_values jsonb not null default '{}'::jsonb,
  expected_answer text,
  generated_ai_output text,
  prompt_version_id uuid references public.prompt_versions(id) on delete set null,
  model_used text check (model_used is null or model_used in ('gpt-4.1', 'gpt-5')),
  status public.test_case_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.eval_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  prompt_version_id uuid references public.prompt_versions(id) on delete set null,
  model_used text not null check (model_used in ('gpt-4.1', 'gpt-5')),
  test_case_count integer not null default 0 check (test_case_count >= 0),
  created_at timestamptz not null default now()
);

create table public.generated_outputs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  eval_run_id uuid references public.eval_runs(id) on delete set null,
  test_case_id uuid not null references public.test_cases(id) on delete cascade,
  prompt_version_id uuid references public.prompt_versions(id) on delete set null,
  model_used text not null check (model_used in ('gpt-4.1', 'gpt-5')),
  output_text text not null,
  created_at timestamptz not null default now()
);

create table public.human_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  test_case_id uuid not null references public.test_cases(id) on delete cascade,
  failure_category text,
  severity public.review_severity,
  human_notes text,
  reviewed_at timestamptz not null default now(),
  unique(test_case_id)
);

create table public.human_review_ratings (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.human_reviews(id) on delete cascade,
  criterion_id uuid not null references public.evaluation_criteria(id) on delete cascade,
  rating_label public.rating_label not null,
  rating_score integer not null check (rating_score between 1 and 3),
  unique(review_id, criterion_id)
);

create table public.error_analysis_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  prompt_version_id uuid references public.prompt_versions(id) on delete set null,
  summary jsonb not null,
  created_at timestamptz not null default now()
);

create index projects_workspace_updated_idx on public.projects(workspace_id, updated_at desc);
create index projects_workspace_active_updated_idx on public.projects(workspace_id, updated_at desc) where trashed_at is null;
create index projects_workspace_trashed_at_idx on public.projects(workspace_id, trashed_at desc) where trashed_at is not null;
create index projects_trashed_at_idx on public.projects(trashed_at) where trashed_at is not null;
create index prompt_versions_project_created_idx on public.prompt_versions(project_id, created_at desc);
create index evaluation_criteria_project_created_idx on public.evaluation_criteria(project_id, created_at desc);
create index test_cases_project_status_idx on public.test_cases(project_id, status, created_at desc);
create index test_cases_prompt_version_idx on public.test_cases(prompt_version_id) where prompt_version_id is not null;
create index eval_runs_project_created_idx on public.eval_runs(project_id, created_at desc);
create index eval_runs_prompt_version_idx on public.eval_runs(prompt_version_id) where prompt_version_id is not null;
create index generated_outputs_project_created_idx on public.generated_outputs(project_id, created_at desc);
create index generated_outputs_eval_run_idx on public.generated_outputs(eval_run_id) where eval_run_id is not null;
create index generated_outputs_test_case_idx on public.generated_outputs(test_case_id);
create index generated_outputs_prompt_version_idx on public.generated_outputs(prompt_version_id) where prompt_version_id is not null;
create index human_reviews_project_reviewed_idx on public.human_reviews(project_id, reviewed_at desc);
create index human_review_ratings_review_idx on public.human_review_ratings(review_id);
create index human_review_ratings_criterion_idx on public.human_review_ratings(criterion_id);
create index error_reports_project_created_idx on public.error_analysis_reports(project_id, created_at desc);
create index error_reports_prompt_version_idx on public.error_analysis_reports(prompt_version_id) where prompt_version_id is not null;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.purge_expired_trashed_projects()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count bigint;
begin
  delete from public.projects
  where trashed_at is not null
    and trashed_at <= now() - interval '30 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke execute on function public.purge_expired_trashed_projects() from public;
revoke execute on function public.purge_expired_trashed_projects() from anon;
revoke execute on function public.purge_expired_trashed_projects() from authenticated;

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid from cron.job where jobname = 'launchguard-purge-trashed-projects'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'launchguard-purge-trashed-projects',
    '0 3 * * *',
    'select public.purge_expired_trashed_projects();'
  );
end;
$$;

create or replace function public.touch_workspace_from_project_activity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.workspaces set updated_at = now() where id = new.workspace_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.workspaces set updated_at = now() where id = old.workspace_id;
    return old;
  else
    update public.workspaces
    set updated_at = now()
    where id in (old.workspace_id, new.workspace_id);
    return new;
  end if;
end;
$$;

create or replace function public.touch_project_from_child_activity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.projects set updated_at = now() where id = new.project_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.projects set updated_at = now() where id = old.project_id;
    return old;
  else
    update public.projects
    set updated_at = now()
    where id in (old.project_id, new.project_id);
    return new;
  end if;
end;
$$;

create or replace function public.touch_project_from_review_rating_activity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.projects
    set updated_at = now()
    where id in (
      select project_id from public.human_reviews where id = new.review_id
    );
    return new;
  elsif tg_op = 'DELETE' then
    update public.projects
    set updated_at = now()
    where id in (
      select project_id from public.human_reviews where id = old.review_id
    );
    return old;
  else
    update public.projects
    set updated_at = now()
    where id in (
      select project_id
      from public.human_reviews
      where id in (old.review_id, new.review_id)
    );
    return new;
  end if;
end;
$$;

create or replace function public.set_workspace_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  base_slug text;
begin
  base_slug := btrim(regexp_replace(lower(btrim(new.name)), '[^a-z0-9]+', '-', 'g'), '-');
  if base_slug = '' then
    base_slug := 'workspace';
  end if;

  if new.slug is null or btrim(new.slug) = '' then
    new.slug := base_slug;
    if exists (select 1 from public.workspaces where slug = new.slug and id <> new.id) then
      new.slug := base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    end if;
  else
    new.slug := btrim(regexp_replace(lower(btrim(new.slug)), '[^a-z0-9]+', '-', 'g'), '-');
  end if;

  return new;
end;
$$;

create trigger set_workspace_slug before insert or update of name, slug on public.workspaces
for each row execute function public.set_workspace_slug();

drop trigger if exists touch_workspaces_updated_at on public.workspaces;
create trigger touch_workspaces_updated_at before update on public.workspaces for each row execute function public.touch_updated_at();

drop trigger if exists touch_projects_updated_at on public.projects;
create trigger touch_projects_updated_at before update on public.projects for each row execute function public.touch_updated_at();

drop trigger if exists touch_criteria_updated_at on public.evaluation_criteria;
create trigger touch_criteria_updated_at before update on public.evaluation_criteria for each row execute function public.touch_updated_at();

drop trigger if exists touch_test_cases_updated_at on public.test_cases;
create trigger touch_test_cases_updated_at before update on public.test_cases for each row execute function public.touch_updated_at();

drop trigger if exists touch_workspace_from_project_activity on public.projects;
create trigger touch_workspace_from_project_activity
after insert or update or delete on public.projects
for each row execute function public.touch_workspace_from_project_activity();

drop trigger if exists touch_project_from_prompt_versions_activity on public.prompt_versions;
create trigger touch_project_from_prompt_versions_activity
after insert or update or delete on public.prompt_versions
for each row execute function public.touch_project_from_child_activity();

drop trigger if exists touch_project_from_evaluation_criteria_activity on public.evaluation_criteria;
create trigger touch_project_from_evaluation_criteria_activity
after insert or update or delete on public.evaluation_criteria
for each row execute function public.touch_project_from_child_activity();

drop trigger if exists touch_project_from_test_cases_activity on public.test_cases;
create trigger touch_project_from_test_cases_activity
after insert or update or delete on public.test_cases
for each row execute function public.touch_project_from_child_activity();

drop trigger if exists touch_project_from_eval_runs_activity on public.eval_runs;
create trigger touch_project_from_eval_runs_activity
after insert or update or delete on public.eval_runs
for each row execute function public.touch_project_from_child_activity();

drop trigger if exists touch_project_from_generated_outputs_activity on public.generated_outputs;
create trigger touch_project_from_generated_outputs_activity
after insert or update or delete on public.generated_outputs
for each row execute function public.touch_project_from_child_activity();

drop trigger if exists touch_project_from_human_reviews_activity on public.human_reviews;
create trigger touch_project_from_human_reviews_activity
after insert or update or delete on public.human_reviews
for each row execute function public.touch_project_from_child_activity();

drop trigger if exists touch_project_from_error_analysis_reports_activity on public.error_analysis_reports;
create trigger touch_project_from_error_analysis_reports_activity
after insert or update or delete on public.error_analysis_reports
for each row execute function public.touch_project_from_child_activity();

drop trigger if exists touch_project_from_review_rating_activity on public.human_review_ratings;
create trigger touch_project_from_review_rating_activity
after insert or update or delete on public.human_review_ratings
for each row execute function public.touch_project_from_review_rating_activity();

alter table public.workspaces enable row level security;
alter table public.projects enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.evaluation_criteria enable row level security;
alter table public.test_cases enable row level security;
alter table public.eval_runs enable row level security;
alter table public.generated_outputs enable row level security;
alter table public.human_reviews enable row level security;
alter table public.human_review_ratings enable row level security;
alter table public.error_analysis_reports enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table
  public.workspaces,
  public.projects,
  public.prompt_versions,
  public.evaluation_criteria,
  public.test_cases,
  public.eval_runs,
  public.generated_outputs,
  public.human_reviews,
  public.human_review_ratings,
  public.error_analysis_reports
to anon, authenticated;

create policy "public collaborative access" on public.workspaces for all to anon, authenticated using (true) with check (true);
create policy "public collaborative access" on public.projects for all to anon, authenticated using (true) with check (true);
create policy "public collaborative access" on public.prompt_versions for all to anon, authenticated using (true) with check (true);
create policy "public collaborative access" on public.evaluation_criteria for all to anon, authenticated using (true) with check (true);
create policy "public collaborative access" on public.test_cases for all to anon, authenticated using (true) with check (true);
create policy "public collaborative access" on public.eval_runs for all to anon, authenticated using (true) with check (true);
create policy "public collaborative access" on public.generated_outputs for all to anon, authenticated using (true) with check (true);
create policy "public collaborative access" on public.human_reviews for all to anon, authenticated using (true) with check (true);
create policy "public collaborative access" on public.human_review_ratings for all to anon, authenticated using (true) with check (true);
create policy "public collaborative access" on public.error_analysis_reports for all to anon, authenticated using (true) with check (true);
