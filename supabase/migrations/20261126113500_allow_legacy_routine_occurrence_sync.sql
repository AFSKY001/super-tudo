-- Preserve completed occurrences created by the previous whole-checklist
-- migration. The current client expands those legacy checklist activities into
-- individual rows, but completed local occurrences retain the original IDs.
-- Accept only the exact legacy ID and full snapshot reconstructed from the
-- assigned model; ownership, permission, model, date and composite ID checks
-- remain mandatory.
create or replace function public.can_write_routine_record(p_module text,p_record_id text,p_data jsonb,p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
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
$function$;