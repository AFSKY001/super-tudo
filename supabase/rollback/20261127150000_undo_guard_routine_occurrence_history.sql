-- Undo the immutable-history guard for Rotina occurrences.
drop trigger if exists app_records_guard_routine_occurrence_history
  on public.app_records;

drop function if exists public.guard_routine_occurrence_history();
