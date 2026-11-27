-- Keep Master/admin in read-only mode for personal Rotina records.
-- Managers may only write their own records when explicitly granted r:rot.
-- Encarregados may write their own records or records of linked team members
-- when they also hold r:eqp. Legacy two-part Cronograma keys stay unchanged.

CREATE OR REPLACE FUNCTION public.can_write_routine_record(p_module text, p_record_id text, p_data jsonb, p_org_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select case
when p_module in ('routineModels','routineAssignments') then exists(
 select 1 from public.org_members me join public.profiles p on p.id=me.user_id
 where me.user_id=auth.uid() and me.org_id=p_org_id and me.active=true and p.active=true
 and me.role in ('admin','gerente')
)
when p_module='routineOccurrences' then exists(
 select 1 from public.org_members me
 join public.profiles p on p.id=me.user_id
 join public.app_records a on a.org_id=p_org_id and a.module='routineAssignments'
  and a.record_id=coalesce(p_data->'value'->>'assignmentId',p_data->>'assignmentId') and a.deleted_at is null
 join public.app_records m on m.org_id=p_org_id and m.module='routineModels'
  and m.record_id=coalesce(a.data->'value'->>'modelId',a.data->>'modelId') and m.deleted_at is null
 where me.user_id=auth.uid() and me.org_id=p_org_id and me.active=true and p.active=true
 and me.role not in ('master', 'admin')
 and public.has_perm_for_org('r:rot',p_org_id)
 and coalesce(a.data->'value'->>'executorId',a.data->>'executorId')
     =coalesce(p_data->'value'->>'executorId',p_data->>'executorId')
 and p_record_id=concat(
  coalesce(p_data->'value'->>'assignmentId',p_data->>'assignmentId'),'|',
  coalesce(p_data->'value'->>'activityId',p_data->>'activityId'),'|',
  coalesce(p_data->'value'->>'date',p_data->>'date')
 )
 and coalesce(p_data->'value'->'snapshot'->>'modelId',p_data->'snapshot'->>'modelId')
     =coalesce(a.data->'value'->>'modelId',a.data->>'modelId')
 and (
  -- Normal current activity ID.
  exists(
   select 1
   from jsonb_array_elements(
    case when jsonb_typeof(coalesce(m.data->'value'->'activities',m.data->'activities'))='array'
     then coalesce(m.data->'value'->'activities',m.data->'activities')
     else '[]'::jsonb end
   ) x(activity)
   where x.activity->>'id'=coalesce(p_data->'value'->>'activityId',p_data->>'activityId')
  )
  -- Previous migration used one activity per entire checklist (or per shift).
  -- Match its stable legacy ID only when the entire saved snapshot is identical
  -- to the ordered items still present in this exact assigned model.
  or exists(
   select 1
   from (
    select
     coalesce(m.data->'value'->>'legacySignature',m.data->>'legacySignature') sig,
     coalesce(m.data->'value'->>'name',m.data->>'name') nm,
     coalesce(m.data->'value'->'activities',m.data->'activities','[]'::jsonb) acts
   ) md
   where md.sig is not null
    and coalesce(p_data->'value'->>'activityId',p_data->>'activityId')='legacy-assigned-activity-'||md.sig
    and coalesce(p_data->'value'->'snapshot'->>'title',p_data->'snapshot'->>'title')=md.nm
    and coalesce(p_data->'value'->'snapshot'->'turns',p_data->'snapshot'->'turns','[]'::jsonb)='[]'::jsonb
    and coalesce(p_data->'value'->'snapshot'->'checklistSnapshot',p_data->'snapshot'->'checklistSnapshot')=(
     select jsonb_agg(x.activity->'checklistSnapshot'->0 order by x.ord)
     from jsonb_array_elements(md.acts) with ordinality x(activity,ord)
     where x.activity->'source'->>'type'='legacy-assigned-checklist-item'
      and coalesce(x.activity->'turns','[]'::jsonb)='[]'::jsonb
    )
    and coalesce(p_data->'value'->'snapshot'->'steps',p_data->'snapshot'->'steps')=(
     select jsonb_agg(x.activity->'checklistSnapshot'->0 order by x.ord)
     from jsonb_array_elements(md.acts) with ordinality x(activity,ord)
     where x.activity->'source'->>'type'='legacy-assigned-checklist-item'
      and coalesce(x.activity->'turns','[]'::jsonb)='[]'::jsonb
    )
    and exists(
     select 1 from jsonb_array_elements(md.acts) x(activity)
     where x.activity->'source'->>'type'='legacy-assigned-checklist-item'
      and coalesce(x.activity->'turns','[]'::jsonb)='[]'::jsonb
    )
  )
  or exists(
   select 1
   from (
    select
     coalesce(m.data->'value'->>'legacySignature',m.data->>'legacySignature') sig,
     coalesce(m.data->'value'->>'name',m.data->>'name') nm,
     coalesce(m.data->'value'->'activities',m.data->'activities','[]'::jsonb) acts
   ) md
   cross join lateral (
    select
     split_part(x.activity->>'id','|item|',1) old_id,
     x.activity->'turns'->>0 turn_name,
     jsonb_agg(x.activity->'checklistSnapshot'->0 order by x.ord) expected
    from jsonb_array_elements(md.acts) with ordinality x(activity,ord)
    where x.activity->'source'->>'type'='legacy-assigned-checklist-item'
     and jsonb_typeof(x.activity->'turns')='array'
     and jsonb_array_length(x.activity->'turns')=1
    group by split_part(x.activity->>'id','|item|',1),x.activity->'turns'->>0
   ) legacy_turn
   where md.sig is not null
    and legacy_turn.old_id like 'legacy-assigned-activity-'||md.sig||'|turn|%'
    and coalesce(p_data->'value'->>'activityId',p_data->>'activityId')=legacy_turn.old_id
    and coalesce(p_data->'value'->'snapshot'->>'title',p_data->'snapshot'->>'title')=md.nm||' — '||legacy_turn.turn_name
    and coalesce(p_data->'value'->'snapshot'->'turns',p_data->'snapshot'->'turns')=jsonb_build_array(legacy_turn.turn_name)
    and coalesce(p_data->'value'->'snapshot'->'checklistSnapshot',p_data->'snapshot'->'checklistSnapshot')=legacy_turn.expected
    and coalesce(p_data->'value'->'snapshot'->'steps',p_data->'snapshot'->'steps')=legacy_turn.expected
  )
 )
 and (
  coalesce(a.data->'value'->>'executorId',a.data->>'executorId')=me.team_member_id
  or (
   me.role='encarregado' and public.has_perm_for_org('r:eqp',p_org_id)
   and exists(
    select 1 from public.team_lead_members tlm
    where tlm.org_id=p_org_id and tlm.leader_team_member_id=me.team_member_id
     and tlm.member_team_member_id=coalesce(a.data->'value'->>'executorId',a.data->>'executorId')
   )
  )
 )
)
else false
end;
$function$


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
