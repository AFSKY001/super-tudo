-- Separate personal routine rows from legacy cronograma completion flags.
-- pt rows are per-person routine activities and use r:rot.
-- done rows with a third key segment are per-person marks (r:rot).
-- Two-part done keys are legacy global cronograma marks and remain r:cro.
-- routineModels/routineAssignments remain r:cro; ck/runs are untouched.

update public.app_records
   set kind = 'r:rot'
 where module = 'pt'
   and kind = 'r:cro';

update public.app_records
   set kind = 'r:rot'
 where module = 'done'
   and kind = 'r:cro'
   and cardinality(string_to_array(record_id, '|')) >= 3;

-- Enforce owner/team scope for per-person rows. This is separate from the
-- occurrence guard: an r:rot permission must not grant access to every pt/done
-- row in the organization.
create or replace function public.guard_personal_routine_sync_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_person_id text;
  v_allowed boolean := false;
begin
  if new.module = 'pt' then
    v_person_id := coalesce(new.data->>'pid', new.data->'value'->>'pid');

    select exists (
      select 1
      from public.org_members me
      join public.profiles p on p.id = me.user_id
      where me.user_id = auth.uid()
        and me.org_id = new.org_id
        and me.active = true
        and p.active = true
        and public.has_perm_for_org('r:rot', new.org_id)
        and (
          me.role in ('admin', 'gerente')
          or v_person_id = me.team_member_id
          or (
            me.role = 'encarregado'
            and public.has_perm_for_org('r:eqp', new.org_id)
            and exists (
              select 1
              from public.team_lead_members tlm
              where tlm.org_id = new.org_id
                and tlm.leader_team_member_id = me.team_member_id
                and tlm.member_team_member_id = v_person_id
            )
          )
        )
    ) into v_allowed;

    if new.kind is distinct from 'r:rot' or not v_allowed then
      raise exception 'permissão insuficiente para alterar atividade pessoal da Rotina'
        using errcode = '42501';
    end if;

  elsif new.module = 'done' then
    v_person_id := split_part(new.record_id, '|', 3);

    -- Legacy cronograma keys have only date|activity and stay on r:cro.
    if cardinality(string_to_array(new.record_id, '|')) < 3 then
      if new.kind is distinct from 'r:cro'
         or not public.can_write_kind_for_org('r:cro', new.org_id) then
        raise exception 'permissão insuficiente para alterar marcação geral do Cronograma'
          using errcode = '42501';
      end if;
      return new;
    end if;

    select exists (
      select 1
      from public.org_members me
      join public.profiles p on p.id = me.user_id
      where me.user_id = auth.uid()
        and me.org_id = new.org_id
        and me.active = true
        and p.active = true
        and public.has_perm_for_org('r:rot', new.org_id)
        and (
          me.role in ('admin', 'gerente')
          or v_person_id = me.team_member_id
          or (
            me.role = 'encarregado'
            and public.has_perm_for_org('r:eqp', new.org_id)
            and exists (
              select 1
              from public.team_lead_members tlm
              where tlm.org_id = new.org_id
                and tlm.leader_team_member_id = me.team_member_id
                and tlm.member_team_member_id = v_person_id
            )
          )
        )
    ) into v_allowed;

    if new.kind is distinct from 'r:rot' or not v_allowed then
      raise exception 'permissão insuficiente para alterar marcação individual da Rotina'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists app_records_guard_personal_routine_sync_write on public.app_records;
create trigger app_records_guard_personal_routine_sync_write
before insert or update on public.app_records
for each row
when (new.module in ('pt', 'done'))
execute function public.guard_personal_routine_sync_write();

revoke all on function public.guard_personal_routine_sync_write() from public, anon, authenticated;

-- Undo (only BEFORE new r:rot writes are created after this migration):
-- drop trigger if exists app_records_guard_personal_routine_sync_write on public.app_records;
-- drop function if exists public.guard_personal_routine_sync_write();
-- update public.app_records set kind = 'r:cro'
--  where module = 'pt' and kind = 'r:rot';
-- update public.app_records set kind = 'r:cro'
--  where module = 'done' and kind = 'r:rot'
--    and cardinality(string_to_array(record_id, '|')) >= 3;
-- If any new/updated per-person rows were written after this migration,
-- reconcile them individually; do not run the undo blindly.
