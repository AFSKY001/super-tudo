-- Undo for migration 20261126180000_reclassify_personal_routine_sync_kinds.
-- Run ONLY before any new per-person pt/done writes have been created or updated
-- after the forward migration. Otherwise reconcile the affected rows manually.

drop trigger if exists app_records_guard_personal_routine_sync_write on public.app_records;
drop function if exists public.guard_personal_routine_sync_write();

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
    and public.can_read_kind_for_org(kind, record_id, v_org);

  return jsonb_build_object('records', v_records);
end;
$function$;

revoke all on function public.can_read_sync_record_for_org(text, text, text, jsonb, uuid) from public, anon, authenticated;
drop function if exists public.can_read_sync_record_for_org(text, text, text, jsonb, uuid);

revoke all on function public.sync_pull(timestamptz, uuid) from public, anon;
grant execute on function public.sync_pull(timestamptz, uuid) to authenticated;

update public.app_records
   set kind = 'r:cro'
 where module = 'pt'
   and kind = 'r:rot';

update public.app_records r
   set kind = 'r:cro'
 where r.module = 'done'
   and r.kind = 'r:rot'
   and exists (
     select 1 from public.org_members person
     where person.org_id = r.org_id
       and person.team_member_id = split_part(r.record_id, '|', cardinality(string_to_array(r.record_id, '|')))
   );
