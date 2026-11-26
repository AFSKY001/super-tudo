-- Ao encerrar uma atribuição, dispense no servidor somente ocorrências
-- ainda pendentes e posteriores à data final. Conclusões históricas são imutáveis.
create or replace function public.guard_routine_app_record_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.module in ('routineModels','routineAssignments') then
    if new.kind is distinct from 'r:cro'
       or not public.can_write_routine_record(new.module, new.record_id, new.data, new.org_id) then
      raise exception 'permissão insuficiente para administrar modelos/atribuições de Rotina'
        using errcode = '42501';
    end if;
  elsif new.module = 'routineOccurrences' then
    -- A única escrita indireta permitida é a dispensa automática feita pelo
    -- trigger de encerramento da atribuição (profundidade > 1).
    if tg_op = 'UPDATE'
       and pg_trigger_depth() > 1
       and old.module = 'routineOccurrences'
       and coalesce(old.data->'value'->>'status', old.data->>'status') = 'pending'
       and coalesce(new.data->'value'->>'status', new.data->>'status') = 'dismissed'
       and coalesce(old.data->'value'->>'assignmentId', old.data->>'assignmentId')
           = coalesce(new.data->'value'->>'assignmentId', new.data->>'assignmentId')
       and coalesce(old.data->'value'->>'date', old.data->>'date')
           = coalesce(new.data->'value'->>'date', new.data->>'date')
       and (new.data->'value' - 'status' - 'updatedAt' - 'note')
           = (old.data->'value' - 'status' - 'updatedAt' - 'note')
       and exists (
         select 1
         from public.app_records a
         where a.org_id = new.org_id
           and a.module = 'routineAssignments'
           and a.record_id = coalesce(new.data->'value'->>'assignmentId', new.data->>'assignmentId')
           and a.deleted_at is null
           and coalesce(a.data->'value'->>'active', a.data->>'active', 'true') = 'false'
           and (
             nullif(coalesce(a.data->'value'->>'until', a.data->>'until'), '') is null
             or coalesce(new.data->'value'->>'date', new.data->>'date')
                > coalesce(a.data->'value'->>'until', a.data->>'until')
           )
       ) then
      return new;
    end if;

    if new.kind is distinct from 'r:rot'
       or not public.can_write_routine_record(new.module, new.record_id, new.data, new.org_id) then
      raise exception 'permissão insuficiente para marcar esta ocorrência de Rotina'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.dismiss_pending_routine_occurrences_on_assignment_end()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_until text;
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if new.module <> 'routineAssignments' or new.deleted_at is not null then
    return new;
  end if;

  if coalesce(new.data->'value'->>'active', new.data->>'active', 'true') <> 'false' then
    return new;
  end if;

  v_until := nullif(coalesce(new.data->'value'->>'until', new.data->>'until'), '');

  update public.app_records o
     set data = jsonb_set(
       jsonb_set(
         jsonb_set(o.data, '{value,status}', to_jsonb('dismissed'::text), true),
         '{value,updatedAt}', to_jsonb(v_now_ms), true
       ),
       '{value,note}', to_jsonb('Atribuição encerrada; ocorrência futura dispensada automaticamente.'::text), true
     )
   where o.org_id = new.org_id
     and o.module = 'routineOccurrences'
     and o.deleted_at is null
     and coalesce(o.data->'value'->>'assignmentId', o.data->>'assignmentId') = new.record_id
     and coalesce(o.data->'value'->>'status', o.data->>'status') = 'pending'
     and (
       v_until is null
       or coalesce(o.data->'value'->>'date', o.data->>'date') > v_until
     );

  return new;
end;
$$;

drop trigger if exists app_records_dismiss_routine_occurrences_on_assignment_end on public.app_records;
create trigger app_records_dismiss_routine_occurrences_on_assignment_end
after update of data on public.app_records
for each row
when (
  new.module = 'routineAssignments'
  and new.deleted_at is null
  and coalesce(new.data->'value'->>'active', new.data->>'active', 'true') = 'false'
  and new.data is distinct from old.data
)
execute function public.dismiss_pending_routine_occurrences_on_assignment_end();

-- Recupera pendências que já ficaram no servidor após encerramentos anteriores.
-- O guard é desabilitado apenas dentro desta transação de migração; o bloqueio
-- de tabela impede escritas concorrentes até o guard ser reativado.
alter table public.app_records disable trigger app_records_guard_routine_write;

with ended as (
  select
    a.org_id,
    a.record_id,
    nullif(coalesce(a.data->'value'->>'until', a.data->>'until'), '') as until_date
  from public.app_records a
  where a.module = 'routineAssignments'
    and a.deleted_at is null
    and coalesce(a.data->'value'->>'active', a.data->>'active', 'true') = 'false'
),
targets as (
  select o.id
  from public.app_records o
  join ended a
    on a.org_id = o.org_id
   and a.record_id = coalesce(o.data->'value'->>'assignmentId', o.data->>'assignmentId')
  where o.module = 'routineOccurrences'
    and o.deleted_at is null
    and coalesce(o.data->'value'->>'status', o.data->>'status') = 'pending'
    and (
      a.until_date is null
      or coalesce(o.data->'value'->>'date', o.data->>'date') > a.until_date
    )
)
update public.app_records o
   set data = jsonb_set(
     jsonb_set(
       jsonb_set(o.data, '{value,status}', to_jsonb('dismissed'::text), true),
       '{value,updatedAt}', to_jsonb(floor(extract(epoch from clock_timestamp()) * 1000)::bigint), true
     ),
     '{value,note}', to_jsonb('Atribuição encerrada; ocorrência futura dispensada automaticamente.'::text), true
   )
 where o.id in (select id from targets);

alter table public.app_records enable trigger app_records_guard_routine_write;

revoke all on function public.dismiss_pending_routine_occurrences_on_assignment_end() from public, anon, authenticated;
