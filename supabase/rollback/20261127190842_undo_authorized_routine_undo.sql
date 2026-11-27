-- Restore the strict immutable-history guard for Rotina occurrences.
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
