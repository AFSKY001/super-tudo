-- Normalize flat and wrapped JSON payloads in the routine history guard.
-- The old expression assumed every occurrence had a "value" object. Flat
-- records made PostgreSQL resolve jsonb key-removal against an unknown NULL,
-- aborting otherwise valid sync_push updates before status checks completed.

create or replace function public.guard_routine_occurrence_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old_status text;
  v_new_status text;
  v_assignment_id text;
  v_occurrence_date text;
  v_undo_allowed boolean := false;
begin
  if old.module <> 'routineOccurrences' then
    return new;
  end if;

  v_old_status := coalesce(old.data->'value'->>'status', old.data->>'status');
  v_new_status := coalesce(new.data->'value'->>'status', new.data->>'status');

  if new.module is distinct from old.module then
    raise exception 'não é permitido alterar o módulo de uma ocorrência da Rotina'
      using errcode = '55000';
  end if;

  if v_old_status = 'done' and v_new_status = 'pending'
     and coalesce(old.data->'value'->>'viaSystem', old.data->>'viaSystem', 'false') <> 'true'
     and coalesce(new.data->'value'->>'viaSystem', new.data->>'viaSystem', 'false') <> 'true'
     and new.org_id is not distinct from old.org_id
     and new.record_id is not distinct from old.record_id
     and new.kind is not distinct from old.kind
     and new.deleted_at is not distinct from old.deleted_at
     and (new.data - 'value') is not distinct from (old.data - 'value')
     and (
       coalesce(new.data->'value', new.data)
         - 'status' - 'updatedAt' - 'madeAt' - 'madeBy' - 'madeByName'
         - 'viaSystem' - 'photoId' - 'photoPath'
     ) is not distinct from (
       coalesce(old.data->'value', old.data)
         - 'status' - 'updatedAt' - 'madeAt' - 'madeBy' - 'madeByName'
         - 'viaSystem' - 'photoId' - 'photoPath'
     ) then
    v_assignment_id := coalesce(old.data->'value'->>'assignmentId', old.data->>'assignmentId');
    v_occurrence_date := coalesce(old.data->'value'->>'date', old.data->>'date');

    select exists (
      select 1
      from public.app_records a
      where a.org_id = old.org_id
        and a.module = 'routineAssignments'
        and a.record_id = v_assignment_id
        and a.deleted_at is null
        and coalesce(a.data->'value'->>'active', a.data->>'active', 'true') = 'true'
        and (
          nullif(coalesce(a.data->'value'->>'until', a.data->>'until'), '') is null
          or v_occurrence_date <= coalesce(a.data->'value'->>'until', a.data->>'until')
        )
    ) into v_undo_allowed;

    v_undo_allowed := v_undo_allowed
      and public.can_write_routine_record('routineOccurrences', old.record_id, new.data, old.org_id);
  end if;

  if v_old_status is distinct from 'pending'
     and not v_undo_allowed
     and (
       new.data is distinct from old.data
       or new.deleted_at is distinct from old.deleted_at
     ) then
    raise exception 'ocorrência concluída ou dispensada da Rotina é imutável'
      using errcode = '55000';
  end if;

  return new;
end;
$function$;
