-- Normalize JSON payloads in the routine app-record write guard.
-- This trigger has a trusted assignment-end exception. Flat occurrence JSON
-- has no "value" member, so compare the fallback object instead of subtracting
-- keys from SQL NULL (which raises an ambiguous-operator error).

create or replace function public.guard_routine_app_record_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
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
       and (
         coalesce(new.data->'value', new.data) - 'status' - 'updatedAt' - 'note'
       ) = (
         coalesce(old.data->'value', old.data) - 'status' - 'updatedAt' - 'note'
       )
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
$function$;

revoke all on function public.guard_routine_app_record_write()
  from public, anon, authenticated;
