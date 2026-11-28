-- Fix the JSON payload comparison used by the trusted assignment-end update.
-- Routine occurrence records may be stored as a flat JSON object or wrapped in
-- a "value" object. Coalesce both shapes before applying jsonb key removal;
-- otherwise flat records can raise "operator is not unique: unknown - unknown"
-- while the sync_push update trigger evaluates the dismissal exception.

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
        and me.role not in ('master', 'admin')
        and public.has_perm_for_org('r:rot', new.org_id)
        and (
          v_person_id = me.team_member_id
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
    if cardinality(string_to_array(new.record_id, '|')) < 3 then
      if new.kind is distinct from 'r:cro'
         or not public.can_write_kind_for_org('r:cro', new.org_id) then
        raise exception 'permissão insuficiente para alterar marcação geral do Cronograma'
          using errcode = '42501';
      end if;
      return new;
    end if;

    v_person_id := split_part(new.record_id, '|', cardinality(string_to_array(new.record_id, '|')));

    select exists (
      select 1
      from public.org_members me
      join public.profiles p on p.id = me.user_id
      where me.user_id = auth.uid()
        and me.org_id = new.org_id
        and me.active = true
        and p.active = true
        and me.role not in ('master', 'admin')
        and public.has_perm_for_org('r:rot', new.org_id)
        and (
          v_person_id = me.team_member_id
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

  elsif new.module = 'routineOccurrences' then
    -- Preserve the trusted nested update that dismisses pending occurrences
    -- after an assignment is ended. The existing routine guard has the same
    -- narrow exception; this guard must not block it earlier in trigger order.
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
       or not public.can_write_routine_record(
         'routineOccurrences', new.record_id, new.data, new.org_id
       ) then
      raise exception 'permissão insuficiente para alterar ocorrência da Rotina'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_personal_routine_sync_write()
  from public, anon, authenticated;
