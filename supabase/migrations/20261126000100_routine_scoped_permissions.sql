-- Super Tudo: permissões segregadas para Rotina.
-- Mantém as RPCs de sincronização existentes e protege app_records mesmo quando
-- a gravação vem de sync_push (SECURITY DEFINER).

create or replace function public.can_read_routine_record(p_record_id text, p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
with target as (
  select r.module, r.record_id, r.data
  from public.app_records r
  where r.org_id = p_org_id
    and r.record_id = p_record_id
    and r.module in ('routineModels','routineAssignments','routineOccurrences')
    and r.deleted_at is null
),
executors as (
  select coalesce(t.data->'value'->>'executorId', t.data->>'executorId') as executor_id
  from target t where t.module = 'routineAssignments'
  union all
  select coalesce(t.data->'value'->>'executorId', t.data->>'executorId')
  from target t where t.module = 'routineOccurrences'
  union all
  select coalesce(a.data->'value'->>'executorId', a.data->>'executorId')
  from target t
  join public.app_records a
    on a.org_id = p_org_id
   and a.module = 'routineAssignments'
   and a.deleted_at is null
   and coalesce(a.data->'value'->>'modelId', a.data->>'modelId') = t.record_id
  where t.module = 'routineModels'
)
select exists (
  select 1
  from public.org_members me
  join public.profiles p on p.id = me.user_id
  where me.user_id = auth.uid()
    and me.org_id = p_org_id
    and me.active = true
    and p.active = true
    and (
      me.role in ('admin','gerente')
      or (
        public.has_perm_for_org('r:rot', p_org_id)
        and exists (
          select 1 from executors e
          where e.executor_id = me.team_member_id
             or (
               me.role = 'encarregado'
               and public.has_perm_for_org('r:eqp', p_org_id)
               and exists (
                 select 1 from public.team_lead_members tlm
                 where tlm.org_id = p_org_id
                   and tlm.leader_team_member_id = me.team_member_id
                   and tlm.member_team_member_id = e.executor_id
               )
             )
        )
      )
    )
);
$$;

create or replace function public.can_write_routine_record(
  p_module text, p_record_id text, p_data jsonb, p_org_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
select case
  when p_module in ('routineModels','routineAssignments') then exists (
    select 1
    from public.org_members me
    join public.profiles p on p.id = me.user_id
    where me.user_id = auth.uid()
      and me.org_id = p_org_id
      and me.active = true and p.active = true
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
      and me.active = true and p.active = true
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
$$;

create or replace function public.guard_routine_app_record_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.module in ('routineModels','routineAssignments') then
    if new.kind is distinct from 'r:cro'
       or not public.can_write_routine_record(new.module, new.record_id, new.data, new.org_id) then
      raise exception 'permissão insuficiente para administrar modelos/atribuições de Rotina'
        using errcode = '42501';
    end if;
  elsif new.module = 'routineOccurrences' then
    if new.kind is distinct from 'r:rot'
       or not public.can_write_routine_record(new.module, new.record_id, new.data, new.org_id) then
      raise exception 'permissão insuficiente para marcar esta ocorrência de Rotina'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists app_records_guard_routine_write on public.app_records;
create trigger app_records_guard_routine_write
before insert or update on public.app_records
for each row execute function public.guard_routine_app_record_write();

create or replace function public.can_read_kind_for_org(k text, p_record_id text, p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
select case
 when k='r:rot' then public.can_read_routine_record(p_record_id,p_org_id)
 when k='r:cro' and exists (
   select 1 from public.app_records r
   where r.org_id=p_org_id and r.record_id=p_record_id
     and r.module in ('routineModels','routineAssignments')
     and r.deleted_at is null
 ) then public.can_read_routine_record(p_record_id,p_org_id)
 when k in ('r:pdc','r:conf') then public.has_perm_for_org(k,p_org_id) or exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente','subgerente','supervisor','encarregado') and om.active=true and p.active=true)
 when k='cfg:team' then exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente') and om.active=true and p.active=true)
  or exists (
   select 1 from public.org_members om
   join public.profiles p on p.id=om.user_id
   where om.user_id=auth.uid() and om.org_id=p_org_id and om.team_member_id=p_record_id
     and p_record_id is not null and om.active=true and p.active=true)
  or (p_record_id is not null and exists (
   select 1 from public.team_lead_members tlm
   join public.org_members om on om.org_id=tlm.org_id and om.team_member_id=tlm.leader_team_member_id
   join public.profiles p on p.id=om.user_id
   where tlm.org_id=p_org_id and tlm.member_team_member_id=p_record_id and om.user_id=auth.uid()
     and om.role='encarregado' and public.has_perm_for_org('r:eqp',p_org_id) and om.active=true and p.active=true))
 when k in ('cfg:sectors','cfg:roles') then public.has_perm_for_org('r:set',p_org_id) or exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente') and om.active=true and p.active=true)
 when k='cfg:checklists' then public.has_perm_for_org('r:ck',p_org_id) or exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente') and om.active=true and p.active=true)
 when k='cfg:tasks' then public.has_perm_for_org('r:cro',p_org_id) or exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente') and om.active=true and p.active=true)
 when k in ('cfg:equipment','r:eqp') then public.has_perm_for_org('r:eqp',p_org_id) or public.has_perm_for_org('l:temp',p_org_id) or exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente') and om.active=true and p.active=true)
 when left(coalesce(k,''),4)='cfg:' then exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role='admin' and om.active=true and p.active=true)
 when exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente') and om.active=true and p.active=true) then true
 when left(coalesce(k,''),2)='l:' then public.has_perm_for_org(k,p_org_id) or public.has_perm_for_org('r:'||substring(k from 3),p_org_id)
 else public.has_perm_for_org(k,p_org_id)
end;
$$;

create or replace function public.can_write_kind_for_org(k text, p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
select case
 when k='r:rot' then public.has_perm_for_org('r:rot',p_org_id)
 when k in ('r:pdc','r:conf') then public.has_perm_for_org(k,p_org_id) or exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente','subgerente','supervisor','encarregado') and om.active=true and p.active=true)
 when k='cfg:team' then exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente') and om.active=true and p.active=true)
 when left(coalesce(k,''),4)='cfg:' then exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role='admin' and om.active=true and p.active=true)
 when exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente') and om.active=true and p.active=true) then true
 when k='r:eqp' then public.has_perm_for_org('r:eqp',p_org_id) or public.has_perm_for_org('l:temp',p_org_id)
 else public.has_perm_for_org(k,p_org_id)
end;
$$;
