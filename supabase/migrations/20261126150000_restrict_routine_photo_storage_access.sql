-- Restrict routine evidence objects to the same routine visibility and marking rules as app records.
-- Object path: <org_id>/rotina/<assignment|activity|date>/<photo_id>.jpg

create or replace function public.can_write_routine_photo_path(
  p_org_id uuid,
  p_record_id text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.org_members me
    join public.profiles profile on profile.id = me.user_id
    join public.app_records assignment
      on assignment.org_id = p_org_id
     and assignment.module = 'routineAssignments'
     and assignment.record_id = split_part(p_record_id, '|', 1)
     and assignment.deleted_at is null
    where me.user_id = (select auth.uid())
      and me.org_id = p_org_id
      and me.active = true
      and profile.active = true
      and public.has_perm_for_org('r:rot', p_org_id)
      and p_record_id like assignment.record_id || '|%'
      and p_record_id ~ '\\|[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      and (
        coalesce(assignment.data->'value'->>'executorId', assignment.data->>'executorId') = me.team_member_id
        or (
          me.role = 'encarregado'
          and public.has_perm_for_org('r:eqp', p_org_id)
          and exists (
            select 1
            from public.team_lead_members lead
            where lead.org_id = p_org_id
              and lead.leader_team_member_id = me.team_member_id
              and lead.member_team_member_id =
                coalesce(assignment.data->'value'->>'executorId', assignment.data->>'executorId')
          )
        )
      )
  );
$function$;

revoke all on function public.can_write_routine_photo_path(uuid, text) from public, anon;
grant execute on function public.can_write_routine_photo_path(uuid, text) to authenticated;

drop policy if exists rotinas_evidencias_select_org on storage.objects;
drop policy if exists rotinas_evidencias_insert_org on storage.objects;
drop policy if exists rotinas_evidencias_update_org on storage.objects;
drop policy if exists rotinas_evidencias_delete_org on storage.objects;

create policy rotinas_evidencias_select_routine_access
on storage.objects
for select
to authenticated
using (
  bucket_id = 'rotinas-evidencias'
  and (storage.foldername(name))[2] = 'rotina'
  and cardinality(storage.foldername(name)) = 3
  and public.can_read_routine_record(
    split_part(name, '/', 3),
    ((storage.foldername(name))[1])::uuid
  )
);

create policy rotinas_evidencias_insert_routine_access
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'rotinas-evidencias'
  and (storage.foldername(name))[2] = 'rotina'
  and cardinality(storage.foldername(name)) = 3
  and public.can_write_routine_photo_path(
    ((storage.foldername(name))[1])::uuid,
    split_part(name, '/', 3)
  )
);

create policy rotinas_evidencias_update_routine_access
on storage.objects
for update
to authenticated
using (
  bucket_id = 'rotinas-evidencias'
  and (storage.foldername(name))[2] = 'rotina'
  and cardinality(storage.foldername(name)) = 3
  and public.can_write_routine_photo_path(
    ((storage.foldername(name))[1])::uuid,
    split_part(name, '/', 3)
  )
)
with check (
  bucket_id = 'rotinas-evidencias'
  and (storage.foldername(name))[2] = 'rotina'
  and cardinality(storage.foldername(name)) = 3
  and public.can_write_routine_photo_path(
    ((storage.foldername(name))[1])::uuid,
    split_part(name, '/', 3)
  )
);

create policy rotinas_evidencias_delete_routine_access
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'rotinas-evidencias'
  and (storage.foldername(name))[2] = 'rotina'
  and cardinality(storage.foldername(name)) = 3
  and public.can_write_routine_photo_path(
    ((storage.foldername(name))[1])::uuid,
    split_part(name, '/', 3)
  )
);
