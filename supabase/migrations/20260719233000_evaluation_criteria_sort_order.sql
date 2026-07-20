begin;

alter table public.evaluation_criteria
  add column if not exists sort_order integer;

with ranked_criteria as (
  select
    id,
    row_number() over (
      partition by project_id
      order by created_at asc, id asc
    ) - 1 as position
  from public.evaluation_criteria
)
update public.evaluation_criteria as criterion
set sort_order = ranked_criteria.position::integer
from ranked_criteria
where criterion.id = ranked_criteria.id
  and criterion.sort_order is null;

alter table public.evaluation_criteria
  alter column sort_order set default 0,
  alter column sort_order set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'evaluation_criteria_sort_order_nonnegative'
      and conrelid = 'public.evaluation_criteria'::regclass
  ) then
    alter table public.evaluation_criteria
      add constraint evaluation_criteria_sort_order_nonnegative
      check (sort_order >= 0);
  end if;
end;
$$;

create index if not exists evaluation_criteria_project_sort_order_idx
  on public.evaluation_criteria(project_id, sort_order, created_at, id);

create or replace function public.reorder_evaluation_criteria(
  p_project_id uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submitted_count integer;
  distinct_count integer;
  project_count integer;
begin
  if p_project_id is null then
    raise exception 'Project ID is required.' using errcode = '22023';
  end if;

  if p_ordered_ids is null then
    raise exception 'Ordered criterion IDs are required.' using errcode = '22023';
  end if;

  if array_position(p_ordered_ids, null) is not null then
    raise exception 'Ordered criterion IDs cannot contain null values.' using errcode = '22023';
  end if;

  select count(*), count(distinct criterion_id)
  into submitted_count, distinct_count
  from unnest(p_ordered_ids) as submitted(criterion_id);

  if submitted_count <> distinct_count then
    raise exception 'Ordered criterion IDs cannot contain duplicates.' using errcode = '22023';
  end if;

  select count(*)
  into project_count
  from public.evaluation_criteria
  where project_id = p_project_id;

  if submitted_count <> project_count then
    raise exception 'Ordered criterion IDs must include every criterion in the project.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_ordered_ids) as submitted(criterion_id)
    where not exists (
      select 1
      from public.evaluation_criteria as criterion
      where criterion.id = submitted.criterion_id
        and criterion.project_id = p_project_id
    )
  ) then
    raise exception 'One or more criteria do not belong to this project.' using errcode = '22023';
  end if;

  update public.evaluation_criteria as criterion
  set sort_order = (submitted.position - 1)::integer
  from unnest(p_ordered_ids) with ordinality as submitted(criterion_id, position)
  where criterion.id = submitted.criterion_id
    and criterion.project_id = p_project_id;
end;
$$;

revoke execute on function public.reorder_evaluation_criteria(uuid, uuid[]) from public;
grant execute on function public.reorder_evaluation_criteria(uuid, uuid[]) to anon, authenticated;

commit;
