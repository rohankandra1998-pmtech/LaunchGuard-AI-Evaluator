-- Propagate meaningful project activity to project and workspace timestamps.

begin;

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
create trigger touch_workspaces_updated_at before update on public.workspaces
for each row execute function public.touch_updated_at();

drop trigger if exists touch_projects_updated_at on public.projects;
create trigger touch_projects_updated_at before update on public.projects
for each row execute function public.touch_updated_at();

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

drop trigger if exists touch_workspace_from_project_activity on public.projects;
create trigger touch_workspace_from_project_activity
after insert or update or delete on public.projects
for each row execute function public.touch_workspace_from_project_activity();

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

drop trigger if exists touch_project_from_review_rating_activity on public.human_review_ratings;
create trigger touch_project_from_review_rating_activity
after insert or update or delete on public.human_review_ratings
for each row execute function public.touch_project_from_review_rating_activity();

commit;
