-- Super Tudo: permissões segregadas para Rotina
-- Modelos/atribuições: somente administração. Ocorrências: próprio executor ou líder autorizado.
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
  select t.data->>'executorId' as executor_id
  from target t where t.module = 'routineAssignments'
  union all
  select coalesce(t.data->'value'->>'executorId', t.data->>'executorId')
  from target t where t.module = 'routineOccurrences'
  union all
  select a.data->>'executorId'
  from target t
  join public.app_records a
    on a.org_id = p_org_id
   and a.module = 'routineAssignments'
   and a.deleted_at is null
   and a.data->>'modelId' = t.record_id
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
      or (public.has_perm_for_org('r:rot', p_org_id) and exists (
        select 1 from executors e
        where e.executor_id = me.team_member_id
           or exists (
             select 1 from public.team_lead_members tlm
             where tlm.org_id = p_org_id
               and tlm.leader_team_member_id = me.team_member_id
               and tlm.member_team_member_id = e.executor_id
               and me.role = 'encarregado'
               and public.has_perm_for_org('r:eqp', p_org_id)
           )
      ))
    )
);
$;

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
    where me.user_id = auth.uid()
      and me.org_id = p_org_id
      and me.active = true and p.active = true
      and public.has_perm_for_org('r:rot', p_org_id)
      and exists (
        select 1 from public.app_records a
        where a.org_id = p_org_id
          and a.module = 'routineAssignments'
          and a.record_id = coalesce(p_data->'value'->>'assignmentId', p_data->>'assignmentId')
          and a.deleted_at is null
          and a.data->>'executorId' = coalesce(p_data->'value'->>'executorId', p_data->>'executorId')
          and (
            a.data->>'executorId' = me.team_member_id
            or exists (
              select 1 from public.team_lead_members tlm
              where tlm.org_id = p_org_id
                and tlm.leader_team_member_id = me.team_member_id
                and tlm.member_team_member_id = a.data->>'executorId'
                and me.role = 'encarregado'
                and public.has_perm_for_org('r:eqp', p_org_id)
            )
          )
      )
  )
  else false
end;
$$;

create or replace function private.can_read_kind_for_org(p_kind text, p_record_id text, p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_kind = 'r:rot' then public.can_read_routine_record(p_record_id, p_org_id)
    else public.can_read_kind_for_org(p_kind, p_record_id, p_org_id)
  end;
$$;

drop policy if exists app_records_insert on public.app_records;
create policy app_records_insert on public.app_records
for insert to authenticated
with check (
  private.is_active_org_member(org_id)
  and created_by = (select auth.uid())
  and kind is not null
  and (
    (kind = 'r:rot'
      and module in ('routineModels','routineAssignments','routineOccurrences')
      and public.can_write_routine_record(module, record_id, data, org_id))
    or
    (not (kind = 'r:rot' and module in ('routineModels','routineAssignments','routineOccurrences'))
      and private.can_write_kind_for_org(kind, org_id))
  )
);

drop policy if exists app_records_update on public.app_records;
create policy app_records_update on public.app_records
for update to authenticated
using (
  private.is_active_org_member(org_id)
  and (
    (kind = 'r:rot'
      and module in ('routineModels','routineAssignments','routineOccurrences')
      and public.can_write_routine_record(module, record_id, data, org_id))
    or
    (not (kind = 'r:rot' and module in ('routineModels','routineAssignments','routineOccurrences'))
      and private.can_write_kind_for_org(kind, org_id))
  )
)
with check (
  private.is_active_org_member(org_id)
  and updated_by = (select auth.uid())
  and (
    (kind = 'r:rot'
      and module in ('routineModels','routineAssignments','routineOccurrences')
      and public.can_write_routine_record(module, record_id, data, org_id))
    or
    (not (kind = 'r:rot' and module in ('routineModels','routineAssignments','routineOccurrences'))
      and private.can_write_kind_for_org(kind, org_id))
  )
);
