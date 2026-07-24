begin;

alter table public.test_cases
  add column variable_usage jsonb not null default '{}'::jsonb
  constraint test_cases_variable_usage_is_object
  check (jsonb_typeof(variable_usage) = 'object');

alter table public.generated_outputs
  add column variable_usage jsonb not null default '{}'::jsonb
  constraint generated_outputs_variable_usage_is_object
  check (jsonb_typeof(variable_usage) = 'object');

update public.test_cases as test_case
set variable_usage = coalesce(
  (
    select jsonb_object_agg(
      variable.key,
      jsonb_build_object(
        'source',
        case
          when variable.value = 'null'::jsonb
            or (jsonb_typeof(variable.value) = 'string' and btrim(variable.value #>> '{}') = '')
          then 'empty'
          else 'default'
        end,
        'value',
        case
          when variable.value = 'null'::jsonb
            or (jsonb_typeof(variable.value) = 'string' and btrim(variable.value #>> '{}') = '')
          then 'null'::jsonb
          else variable.value
        end
      )
    )
    from jsonb_each(
      case
        when jsonb_typeof(test_case.variable_values) = 'object' then test_case.variable_values
        else '{}'::jsonb
      end
    ) as variable
  ),
  '{}'::jsonb
);

update public.generated_outputs as generated_output
set variable_usage = test_case.variable_usage
from public.test_cases as test_case
where test_case.id = generated_output.test_case_id;

commit;
