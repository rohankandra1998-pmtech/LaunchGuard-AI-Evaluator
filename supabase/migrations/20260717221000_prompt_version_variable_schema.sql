begin;

alter table public.prompt_versions
  add column if not exists variable_schema jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'prompt_versions_variable_schema_is_array'
      and conrelid = 'public.prompt_versions'::regclass
  ) then
    alter table public.prompt_versions
      add constraint prompt_versions_variable_schema_is_array
      check (jsonb_typeof(variable_schema) = 'array');
  end if;
end;
$$;

update public.prompt_versions pv
set variable_schema = coalesce(
  (
    select jsonb_agg(
      jsonb_build_object(
        'key', legacy.key,
        'label', initcap(replace(legacy.key, '_', ' ')),
        'type', 'text',
        'required', false,
        'default_value', null,
        'description', null,
        'options', '[]'::jsonb
      ) order by legacy.first_position
    )
    from (
      select value as key, min(position) as first_position
      from jsonb_array_elements_text(
        case when jsonb_typeof(p.variables) = 'array' then p.variables else '[]'::jsonb end
      ) with ordinality as variable(value, position)
      where btrim(value) <> ''
      group by value
    ) legacy
  ),
  '[]'::jsonb
)
from public.projects p
where p.id = pv.project_id
  and pv.variable_schema = '[]'::jsonb;

commit;
