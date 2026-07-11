-- Run once against an existing account-based LaunchGuard database.
-- Existing projects and all dependent evaluation records are preserved.

begin;

create extension if not exists "pgcrypto";

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

drop trigger if exists set_workspace_slug on public.workspaces;
create trigger set_workspace_slug before insert or update of name, slug on public.workspaces
for each row execute function public.set_workspace_slug();

alter table public.projects add column if not exists workspace_id uuid;

do $$
declare
  default_workspace_id uuid;
begin
  if exists (select 1 from public.projects where workspace_id is null) then
    insert into public.workspaces (name, slug, description)
    values (
      'LaunchGuard Community',
      'launchguard-community',
      'Migrated public projects from the original LaunchGuard prototype.'
    )
    on conflict (slug) do update set name = excluded.name
    returning id into default_workspace_id;

    update public.projects
    set workspace_id = default_workspace_id
    where workspace_id is null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_workspace_id_fkey'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_workspace_id_fkey
      foreign key (workspace_id) references public.workspaces(id) on delete cascade;
  end if;
end $$;

alter table public.projects alter column workspace_id set not null;

-- Ownership policies depend on user_id, so remove policies before dropping those columns.
do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'projects', 'prompt_versions', 'evaluation_criteria', 'test_cases',
    'eval_runs', 'generated_outputs', 'human_reviews', 'human_review_ratings', 'error_analysis_reports'
  ]
  loop
    for policy_name in
      select policyname from pg_policies where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy %I on public.%I', policy_name, table_name);
    end loop;
  end loop;
end $$;

alter table public.projects drop column if exists user_id;
alter table public.prompt_versions drop column if exists user_id;
alter table public.evaluation_criteria drop column if exists user_id;
alter table public.test_cases drop column if exists user_id;
alter table public.eval_runs drop column if exists user_id;
alter table public.generated_outputs drop column if exists user_id;
alter table public.human_reviews drop column if exists user_id;
alter table public.human_review_ratings drop column if exists user_id;
alter table public.error_analysis_reports drop column if exists user_id;

drop index if exists public.projects_user_created_idx;
create index if not exists projects_workspace_updated_idx on public.projects(workspace_id, updated_at desc);
create index if not exists test_cases_prompt_version_idx on public.test_cases(prompt_version_id) where prompt_version_id is not null;
create index if not exists eval_runs_prompt_version_idx on public.eval_runs(prompt_version_id) where prompt_version_id is not null;
create index if not exists generated_outputs_eval_run_idx on public.generated_outputs(eval_run_id) where eval_run_id is not null;
create index if not exists generated_outputs_test_case_idx on public.generated_outputs(test_case_id);
create index if not exists generated_outputs_prompt_version_idx on public.generated_outputs(prompt_version_id) where prompt_version_id is not null;
create index if not exists human_review_ratings_criterion_idx on public.human_review_ratings(criterion_id);
create index if not exists error_reports_prompt_version_idx on public.error_analysis_reports(prompt_version_id) where prompt_version_id is not null;

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

drop trigger if exists touch_workspaces_updated_at on public.workspaces;
create trigger touch_workspaces_updated_at before update on public.workspaces for each row execute function public.touch_updated_at();

do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'workspaces', 'projects', 'prompt_versions', 'evaluation_criteria', 'test_cases',
    'eval_runs', 'generated_outputs', 'human_reviews', 'human_review_ratings', 'error_analysis_reports'
  ]
  loop
    for policy_name in
      select policyname from pg_policies where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy %I on public.%I', policy_name, table_name);
    end loop;

    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
      'public collaborative access',
      table_name
    );
  end loop;
end $$;

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

commit;
