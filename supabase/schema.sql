-- LaunchGuard public workspace schema for a fresh Supabase project.
-- All data is intentionally public and collaborative in this prototype.

create extension if not exists "pgcrypto";

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
  updated_at timestamptz not null default now()
);

create table public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  system_prompt text not null,
  model_used text not null default 'gpt-4.1' check (model_used in ('gpt-4.1', 'gpt-5')),
  notes text,
  is_active boolean not null default false,
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
create trigger touch_workspaces_updated_at before update on public.workspaces for each row execute function public.touch_updated_at();
create trigger touch_projects_updated_at before update on public.projects for each row execute function public.touch_updated_at();
create trigger touch_criteria_updated_at before update on public.evaluation_criteria for each row execute function public.touch_updated_at();
create trigger touch_test_cases_updated_at before update on public.test_cases for each row execute function public.touch_updated_at();

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
