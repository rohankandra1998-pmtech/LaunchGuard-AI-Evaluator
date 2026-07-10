-- LaunchGuard AI Evaluator schema
-- Run this in the Supabase SQL editor for your project, then set the env vars from .env.example.
-- All tables are in public, have RLS enabled, and scope project-owned rows to auth.uid().

create extension if not exists "pgcrypto";

create type public.test_case_status as enum ('draft', 'generated', 'reviewed');
create type public.rating_label as enum ('Good', 'Average', 'Bad');
create type public.review_severity as enum ('Low', 'Medium', 'High');
create type public.case_type as enum ('normal', 'edge', 'ambiguous', 'missing_context', 'adversarial', 'tone_sensitive');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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
  user_id uuid not null references auth.users(id) on delete cascade,
  version_number integer not null,
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
  user_id uuid not null references auth.users(id) on delete cascade,
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
  user_id uuid not null references auth.users(id) on delete cascade,
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
  user_id uuid not null references auth.users(id) on delete cascade,
  model_used text not null check (model_used in ('gpt-4.1', 'gpt-5')),
  test_case_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.generated_outputs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  eval_run_id uuid references public.eval_runs(id) on delete set null,
  test_case_id uuid not null references public.test_cases(id) on delete cascade,
  prompt_version_id uuid references public.prompt_versions(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  model_used text not null check (model_used in ('gpt-4.1', 'gpt-5')),
  output_text text not null,
  created_at timestamptz not null default now()
);

create table public.human_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  test_case_id uuid not null references public.test_cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
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
  user_id uuid not null references auth.users(id) on delete cascade,
  rating_label public.rating_label not null,
  rating_score integer not null check (rating_score between 1 and 3),
  unique(review_id, criterion_id)
);

create table public.error_analysis_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  prompt_version_id uuid references public.prompt_versions(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  summary jsonb not null,
  created_at timestamptz not null default now()
);

create index projects_user_created_idx on public.projects(user_id, created_at desc);
create index prompt_versions_project_created_idx on public.prompt_versions(project_id, created_at desc);
create index evaluation_criteria_project_created_idx on public.evaluation_criteria(project_id, created_at desc);
create index test_cases_project_status_idx on public.test_cases(project_id, status, created_at desc);
create index eval_runs_project_created_idx on public.eval_runs(project_id, created_at desc);
create index generated_outputs_project_created_idx on public.generated_outputs(project_id, created_at desc);
create index human_reviews_project_reviewed_idx on public.human_reviews(project_id, reviewed_at desc);
create index human_review_ratings_review_idx on public.human_review_ratings(review_id);
create index error_reports_project_created_idx on public.error_analysis_reports(project_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_profiles_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
create trigger touch_projects_updated_at before update on public.projects for each row execute function public.touch_updated_at();
create trigger touch_criteria_updated_at before update on public.evaluation_criteria for each row execute function public.touch_updated_at();
create trigger touch_test_cases_updated_at before update on public.test_cases for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.evaluation_criteria enable row level security;
alter table public.test_cases enable row level security;
alter table public.eval_runs enable row level security;
alter table public.generated_outputs enable row level security;
alter table public.human_reviews enable row level security;
alter table public.human_review_ratings enable row level security;
alter table public.error_analysis_reports enable row level security;

create policy "profiles are self readable" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles are self insertable" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles are self updatable" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "projects owner select" on public.projects for select to authenticated using ((select auth.uid()) = user_id);
create policy "projects owner insert" on public.projects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "projects owner update" on public.projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "projects owner delete" on public.projects for delete to authenticated using ((select auth.uid()) = user_id);

create policy "prompt versions owner select" on public.prompt_versions for select to authenticated using ((select auth.uid()) = user_id);
create policy "prompt versions owner insert" on public.prompt_versions for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())));
create policy "prompt versions owner update" on public.prompt_versions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "prompt versions owner delete" on public.prompt_versions for delete to authenticated using ((select auth.uid()) = user_id);

create policy "criteria owner select" on public.evaluation_criteria for select to authenticated using ((select auth.uid()) = user_id);
create policy "criteria owner insert" on public.evaluation_criteria for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())));
create policy "criteria owner update" on public.evaluation_criteria for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "criteria owner delete" on public.evaluation_criteria for delete to authenticated using ((select auth.uid()) = user_id);

create policy "test cases owner select" on public.test_cases for select to authenticated using ((select auth.uid()) = user_id);
create policy "test cases owner insert" on public.test_cases for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())));
create policy "test cases owner update" on public.test_cases for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "test cases owner delete" on public.test_cases for delete to authenticated using ((select auth.uid()) = user_id);

create policy "eval runs owner select" on public.eval_runs for select to authenticated using ((select auth.uid()) = user_id);
create policy "eval runs owner insert" on public.eval_runs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "eval runs owner update" on public.eval_runs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "eval runs owner delete" on public.eval_runs for delete to authenticated using ((select auth.uid()) = user_id);

create policy "generated outputs owner select" on public.generated_outputs for select to authenticated using ((select auth.uid()) = user_id);
create policy "generated outputs owner insert" on public.generated_outputs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "generated outputs owner update" on public.generated_outputs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "generated outputs owner delete" on public.generated_outputs for delete to authenticated using ((select auth.uid()) = user_id);

create policy "human reviews owner select" on public.human_reviews for select to authenticated using ((select auth.uid()) = user_id);
create policy "human reviews owner insert" on public.human_reviews for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "human reviews owner update" on public.human_reviews for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "human reviews owner delete" on public.human_reviews for delete to authenticated using ((select auth.uid()) = user_id);

create policy "review ratings owner select" on public.human_review_ratings for select to authenticated using ((select auth.uid()) = user_id);
create policy "review ratings owner insert" on public.human_review_ratings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "review ratings owner update" on public.human_review_ratings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "review ratings owner delete" on public.human_review_ratings for delete to authenticated using ((select auth.uid()) = user_id);

create policy "error reports owner select" on public.error_analysis_reports for select to authenticated using ((select auth.uid()) = user_id);
create policy "error reports owner insert" on public.error_analysis_reports for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "error reports owner update" on public.error_analysis_reports for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "error reports owner delete" on public.error_analysis_reports for delete to authenticated using ((select auth.uid()) = user_id);
