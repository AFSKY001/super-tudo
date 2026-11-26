-- Keep Master/admin in read-only mode for personal Rotina records.
-- Managers may only write their own records when explicitly granted r:rot.
-- Encarregados may write their own records or records of linked team members
-- when they also hold r:eqp. Legacy two-part Cronograma keys stay unchanged.

create or replace function public.can_write_routine_record(
  p_module text, p_record_id text, p_data jsonb, p_org_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
select case
  when p_module in ('routineModels','routineAssignments') then exists (
    select 1
    from public.org_members me
    join public.profiles p on p.id = me.user_id
    where me.user_id = auth.uid()
      and me.org_id = p_org_id
      and me.active = true
      and p.active = true
      and me.role in ('admin','gerente')
  )
  when p_module = 'routineOccurrences' then exists (
    select 1
    from public.org_members me
    join public.profiles p on p.id = me.user_id
    join public.app_records a
      on a.org_id = p_org_id
     and a.module = 'routineAssignments'
     and a.record_id = coalesce(p_data->'value'->>'assignmentId', p_data->>'assignmentId')
     and a.deleted_at is null
    join public.app_records m
      on m.org_id = p_org_id
     and m.module = 'routineModels'
     and m.record_id = coalesce(a.data->'value'->>'modelId', a.data->>'modelId')
     and m.deleted_at is null
    where me.user_id = auth.uid()
      and me.org_id = p_org_id
      and me.active = true
      and p.active = true
      and me.role <> 'admin'
      and public.has_perm_for_org('r:rot', p_org_id)
      and coalesce(a.data->'value'->>'executorId', a.data->>'executorId')
          = coalesce(p_data->'value'->>'executorId', p_data->>'executorId')
      and p_record_id = concat(
        coalesce(p_data->'value'->>'assignmentId', p_data->>'assignmentId'), '|',
        coalesce(p_data->'value'->>'activityId', p_data->>'activityId'), '|',
        coalesce(p_data->'value'->>'date', p_data->>'date')
      )
      and coalesce(p_data->'value'->'snapshot'->>'modelId', p_data->'snapshot'->>'modelId')
          = coalesce(a.data->'value'->>'modelId', a.data->>'modelId')
      and exists (
        select 1
        from jsonb_array_elements(coalesce(
          m.data->'value'->'activities',
          m.data->'activities',
          '[]'::jsonb
        )) as activity_row(activity)
        where activity_row.activity->>'id' = coalesce(p_data->'value'->>'activityId', p_data->>'activityId')
      )
      and (
        coalesce(a.data->'value'->>'executorId', a.data->>'executorId') = me.team_member_id
        or (
          me.role = 'encarregado'
          and public.has_perm_for_org('r:eqp', p_org_id)
          and exists (
            select 1 from public.team_lead_members tlm
            where tlm.org_id = p_org_id
              and tlm.leader_team_member_id = me.team_member_id
              and tlm.member_team_member_id =
                coalesce(a.data->'value'->>'executorId', a.data->>'executorId')
          )
        )
      )
  )
  else false
end;
$function$;

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
        and me.role <> 'admin'
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
        and me.role <> 'admin'
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

revoke all on function public.can_write_routine_record(text, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.guard_personal_routine_sync_write() from public, anon, authenticated;
