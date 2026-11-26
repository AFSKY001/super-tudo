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

create or replace function public.can_read_sync_record_for_org(
  p_module text,
  p_kind text,
  p_record_id text,
  p_data jsonb,
  p_org_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
select case
  when p_module = 'routineOccurrences' then
    p_kind = 'r:rot'
    and (
      exists (
        select 1
        from public.org_members me
        join public.profiles p on p.id = me.user_id
        where me.user_id = auth.uid()
          and me.org_id = p_org_id
          and me.active = true
          and p.active = true
          and me.role in ('admin', 'gerente')
      )
      or exists (
        select 1
        from public.org_members me
        join public.profiles p on p.id = me.user_id
        join public.app_records a
          on a.org_id = p_org_id
         and a.module = 'routineAssignments'
         and a.record_id = coalesce(p_data->'value'->>'assignmentId', p_data->>'assignmentId')
         and a.deleted_at is null
        where me.user_id = auth.uid()
          and me.org_id = p_org_id
          and me.active = true
          and p.active = true
          and me.role = 'encarregado'
          and public.has_perm_for_org('r:rot', p_org_id)
          and public.has_perm_for_org('r:eqp', p_org_id)
          and coalesce(a.data->'value'->>'executorId', a.data->>'executorId')
              = coalesce(p_data->'value'->>'executorId', p_data->>'executorId')
          and (
            coalesce(a.data->'value'->>'executorId', a.data->>'executorId') = me.team_member_id
            or exists (
              select 1
              from public.team_lead_members tlm
              where tlm.org_id = p_org_id
                and tlm.leader_team_member_id = me.team_member_id
                and tlm.member_team_member_id = coalesce(a.data->'value'->>'executorId', a.data->>'executorId')
            )
          )
      )
    )

  when p_module = 'pt' and p_kind = 'r:rot' then
    exists (
      select 1
      from public.org_members me
      join public.profiles p on p.id = me.user_id
      where me.user_id = auth.uid()
        and me.org_id = p_org_id
        and me.active = true
        and p.active = true
        and public.has_perm_for_org('r:rot', p_org_id)
        and (
          me.role in ('admin', 'gerente')
          or coalesce(p_data->>'pid', p_data->'value'->>'pid') = me.team_member_id
          or (
            me.role = 'encarregado'
            and public.has_perm_for_org('r:eqp', p_org_id)
            and exists (
              select 1
              from public.team_lead_members tlm
              where tlm.org_id = p_org_id
                and tlm.leader_team_member_id = me.team_member_id
                and tlm.member_team_member_id = coalesce(p_data->>'pid', p_data->'value'->>'pid')
            )
          )
        )
    )

  when p_module = 'done' and p_kind = 'r:rot'
       and cardinality(string_to_array(p_record_id, '|')) >= 3 then
    exists (
      select 1
      from public.org_members me
      join public.profiles p on p.id = me.user_id
      where me.user_id = auth.uid()
        and me.org_id = p_org_id
        and me.active = true
        and p.active = true
        and public.has_perm_for_org('r:rot', p_org_id)
        and (
          me.role in ('admin', 'gerente')
          or split_part(p_record_id, '|', 3) = me.team_member_id
          or (
            me.role = 'encarregado'
            and public.has_perm_for_org('r:eqp', p_org_id)
            and exists (
              select 1
              from public.team_lead_members tlm
              where tlm.org_id = p_org_id
                and tlm.leader_team_member_id = me.team_member_id
                and tlm.member_team_member_id = split_part(p_record_id, '|', 3)
            )
          )
        )
    )

  when p_module in ('routineModels', 'routineAssignments') then
    p_kind = 'r:cro'
    and public.can_read_kind_for_org(p_kind, p_record_id, p_org_id)

  when p_module = 'done' and p_kind = 'r:cro' then
    public.can_read_kind_for_org(p_kind, p_record_id, p_org_id)

  else
    public.can_read_kind_for_org(p_kind, p_record_id, p_org_id)
end;
$function$;

create or replace function public.sync_pull(
  p_since timestamp with time zone,
  p_org_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid;
  v_org uuid;
  v_records jsonb;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'Usuário não autenticado';
  end if;

  v_org := p_org_id;

  if v_org is null or not exists (
    select 1
    from public.org_members om
    join public.profiles pr on pr.id = om.user_id
    where om.user_id = v_uid
      and om.org_id = v_org
      and om.active = true
      and pr.active = true
  ) then
    raise exception 'Organização não encontrada';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'module', module,
        'record_id', record_id,
        'kind', kind,
        'created_by', created_by,
        'updated_by', updated_by,
        'data', case when deleted_at is null then data else null end,
        'revision', revision,
        'updated_at', updated_at,
        'deleted_at', deleted_at
      )
      order by updated_at, id
    ),
    '[]'::jsonb
  )
  into v_records
  from public.app_records
  where org_id = v_org
    and (p_since is null or updated_at >= p_since)
    and public.can_read_sync_record_for_org(module, kind, record_id, data, v_org);

  return jsonb_build_object('records', v_records);
end;
$function$;

revoke all on function public.can_read_sync_record_for_org(text, text, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.sync_pull(timestamptz, uuid) from public, anon;
grant execute on function public.sync_pull(timestamptz, uuid) to authenticated;

revoke all on function public.guard_personal_routine_sync_write() from public, anon, authenticated;

-- Undo is provided separately at:
-- supabase/rollback/20261126180000_undo_reclassify_personal_routine_sync_kinds.sql
-- It restores sync_pull before removing the scoped-read helper and trigger.
-- Run it only before new per-person pt/done writes have occurred.
