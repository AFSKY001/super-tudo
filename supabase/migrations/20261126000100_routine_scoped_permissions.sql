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
    when p_kind = 'r:cro' and exists (
      select 1 from public.app_records r
      where r.org_id = p_org_id and r.record_id = p_record_id
        and r.module in ('routineModels','routineAssignments')
        and r.deleted_at is null
    ) then public.can_read_routine_record(p_record_id, p_org_id)
    else public.can_read_kind_for_org(p_kind, p_record_id, p_org_id)
  end;
$$;

-- sync_push é SECURITY DEFINER e não aplica diretamente as políticas RLS.
-- O wrapper valida o par módulo/tipo antes de encaminhar ao mecanismo transacional existente.
alter function public.sync_push(jsonb, uuid) rename to sync_push_internal;
revoke all on function public.sync_push_internal(jsonb, uuid) from public, anon, authenticated;

create or replace function public.sync_push(p_ops jsonb, p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op jsonb;
  v_module text;
  v_kind text;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if p_ops is null or jsonb_typeof(p_ops) <> 'array' then
    raise exception 'p_ops deve ser um array jsonb';
  end if;
  for v_op in select * from jsonb_array_elements(p_ops)
  loop
    v_module := v_op->>'module';
    v_kind := v_op->>'kind';
    if v_module in ('routineModels','routineAssignments') then
      if v_kind <> 'r:cro' or not public.can_write_routine_record(v_module, v_op->>'record_id', v_op->'data', p_org_id) then
        raise exception 'permissão insuficiente para administrar modelos/atribuições de Rotina';
      end if;
    elsif v_module = 'routineOccurrences' then
      if v_kind <> 'r:rot' or not public.can_write_routine_record(v_module, v_op->>'record_id', v_op->'data', p_org_id) then
        raise exception 'permissão insuficiente para marcar esta ocorrência de Rotina';
      end if;
    elsif v_kind = 'r:rot' then
      raise exception 'tipo r:rot reservado aos registros da Rotina';
    end if;
  end loop;
  return public.sync_push_internal(p_ops, p_org_id);
end;
$$;

grant execute on function public.sync_push(jsonb, uuid) to authenticated;

drop policy if exists app_records_insert on public.app_records;
create policy app_records_insert on public.app_records
for insert to authenticated
with check (
  private.is_active_org_member(org_id)
  and created_by = (select auth.uid())
  and kind is not null
  and (
    (kind = 'r:rot'
      and module = 'routineOccurrences'
      and public.can_write_routine_record(module, record_id, data, org_id))
    or
    (not (kind = 'r:rot' and module = 'routineOccurrences')
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
      and module = 'routineOccurrences'
      and public.can_write_routine_record(module, record_id, data, org_id))
    or
    (not (kind = 'r:rot' and module = 'routineOccurrences')
      and private.can_write_kind_for_org(kind, org_id))
  )
)
with check (
  private.is_active_org_member(org_id)
  and updated_by = (select auth.uid())
  and (
    (kind = 'r:rot'
      and module = 'routineOccurrences'
      and public.can_write_routine_record(module, record_id, data, org_id))
    or
    (not (kind = 'r:rot' and module = 'routineOccurrences')
      and private.can_write_kind_for_org(kind, org_id))
  )
);
