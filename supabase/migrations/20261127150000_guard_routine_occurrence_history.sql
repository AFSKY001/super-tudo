-- Preserve historical Rotina occurrences after their first terminal transition.
-- Pending rows may still be updated (photo metadata, future-rule cleanup, etc.).
-- Once completed or dismissed, the occurrence payload and tombstone are immutable.
create or replace function public.guard_routine_occurrence_history()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_old_status text;
begin
  if old.module <> 'routineOccurrences' then
    return new;
  end if;

  v_old_status := coalesce(
    old.data->'value'->>'status',
    old.data->>'status'
  );

  if new.module is distinct from old.module then
    raise exception 'não é permitido alterar o módulo de uma ocorrência da Rotina'
      using errcode = '55000';
  end if;

  if v_old_status is distinct from 'pending'
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

revoke all on function public.guard_routine_occurrence_history()
  from public, anon, authenticated;

drop trigger if exists app_records_guard_routine_occurrence_history
  on public.app_records;

create trigger app_records_guard_routine_occurrence_history
before update on public.app_records
for each row
when (old.module = 'routineOccurrences')
execute function public.guard_routine_occurrence_history();
