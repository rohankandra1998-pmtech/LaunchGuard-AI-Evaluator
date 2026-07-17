-- Add a recoverable project Trash lifecycle with database-native 30-day cleanup.

begin;

create extension if not exists pg_cron;

alter table public.projects
  add column if not exists trashed_at timestamptz;

create index if not exists projects_workspace_active_updated_idx
  on public.projects(workspace_id, updated_at desc)
  where trashed_at is null;

create index if not exists projects_workspace_trashed_at_idx
  on public.projects(workspace_id, trashed_at desc)
  where trashed_at is not null;

create index if not exists projects_trashed_at_idx
  on public.projects(trashed_at)
  where trashed_at is not null;

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

commit;
