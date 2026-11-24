-- Resolve tenant access from the row's organization membership, never an arbitrary LIMIT 1.
-- The application already passes org_id explicitly to sync_pull/sync_push.
-- This migration aligns read-only RLS policies, sync-record policies and storage paths.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_active_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.org_members om
    join public.profiles pr on pr.id = om.user_id
    where om.org_id = p_org_id
      and om.user_id = (select auth.uid())
      and om.active = true
      and pr.active = true
  );
$function$;

create or replace function private.is_active_org_member_path(p_org_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.org_members om
    join public.profiles pr on pr.id = om.user_id
    where om.org_id::text = p_org_id
      and om.user_id = (select auth.uid())
      and om.active = true
      and pr.active = true
  );
$function$;

create or replace function private.can_view_profile(p_target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.org_members target
    join public.profiles target_profile on target_profile.id = target.user_id
    where target.user_id = p_target_user_id
      and target.active = true
      and target_profile.active = true
      and exists (
        select 1
        from public.org_members viewer
        join public.profiles viewer_profile on viewer_profile.id = viewer.user_id
        where viewer.user_id = (select auth.uid())
          and viewer.org_id = target.org_id
          and viewer.active = true
          and viewer_profile.active = true
      )
  );
$function$;

create or replace function private.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.org_members om
    join public.profiles pr on pr.id = om.user_id
    where om.org_id = p_org_id
      and om.user_id = (select auth.uid())
      and om.role = 'admin'
      and om.active = true
      and pr.active = true
  );
$function$;

-- Private wrappers allow row-scoped policies to reuse the explicit-tenant
-- permission checks without exposing SECURITY DEFINER RPCs in the public API.
create or replace function private.can_read_kind_for_org(p_kind text, p_record_id text, p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select public.can_read_kind_for_org(p_kind, p_record_id, p_org_id);
$function$;

create or replace function private.can_write_kind_for_org(p_kind text, p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select public.can_write_kind_for_org(p_kind, p_org_id);
$function$;

revoke all on function private.is_active_org_member(uuid) from public, anon;
revoke all on function private.is_active_org_member_path(text) from public, anon;
revoke all on function private.can_view_profile(uuid) from public, anon;
revoke all on function private.is_org_admin(uuid) from public, anon;
revoke all on function private.can_read_kind_for_org(text,text,uuid) from public, anon;
revoke all on function private.can_write_kind_for_org(text,uuid) from public, anon;

grant execute on function private.is_active_org_member(uuid) to authenticated;
grant execute on function private.is_active_org_member_path(text) to authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;
grant execute on function private.is_org_admin(uuid) to authenticated;
grant execute on function private.can_read_kind_for_org(text,text,uuid) to authenticated;
grant execute on function private.can_write_kind_for_org(text,uuid) to authenticated;

-- Legacy single-tenant helper: return an organization only when there is exactly one
-- active membership. Multi-org users must use explicit org_id-scoped functions.
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select (array_agg(distinct om.org_id))[1]
  from public.org_members om
  join public.profiles pr on pr.id = om.user_id
  where om.user_id = (select auth.uid())
    and om.active = true
    and pr.active = true
  having count(distinct om.org_id) = 1;
$function$;

comment on function public.current_org_id() is
  'Legacy single-tenant helper. Returns an org only when exactly one active membership exists; multi-org access must pass an explicit org_id.';

-- This helper is internal to legacy SECURITY DEFINER functions, not a public RPC.
revoke all on function public.current_org_id() from public, anon, authenticated;
grant execute on function public.current_org_id() to service_role;

-- Notifications: recipient ownership plus active membership in the row's tenant.
drop policy if exists app_notifications_select_own on public.app_notifications;
create policy app_notifications_select_own
on public.app_notifications
for select
to authenticated
using (
  recipient_user_id = (select auth.uid())
  and private.is_active_org_member(org_id)
);

-- Audit history remains admin-only, with the role checked against the row's tenant.
drop policy if exists audit_select on public.audit_log;
create policy audit_select
on public.audit_log
for select
to authenticated
using (private.is_org_admin(org_id));

-- Organization metadata and membership rows are scoped to each active membership.
drop policy if exists org_members_select on public.org_members;
create policy org_members_select
on public.org_members
for select
to authenticated
using (private.is_active_org_member(org_id));

drop policy if exists org_select on public.organizations;
create policy org_select
on public.organizations
for select
to authenticated
using (private.is_active_org_member(id));

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select
on public.role_permissions
for select
to authenticated
using (private.is_active_org_member(org_id));

drop policy if exists sync_ops_select on public.sync_ops;
create policy sync_ops_select
on public.sync_ops
for select
to authenticated
using (private.is_active_org_member(org_id));

-- A profile is visible only when its owner and the viewer share an active organization.
-- The private SECURITY DEFINER helper avoids recursive RLS on public.profiles.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select
on public.profiles
for select
to authenticated
using (private.can_view_profile(id));

-- Sync storage remains isolated by the organization id in the first path segment.
-- Text comparison avoids UUID cast errors for malformed or unrelated object names.
drop policy if exists rotinas_evidencias_select_org on storage.objects;
create policy rotinas_evidencias_select_org
on storage.objects
for select
to authenticated
using (
  bucket_id = 'rotinas-evidencias'
  and private.is_active_org_member_path((storage.foldername(name))[1])
);

drop policy if exists rotinas_evidencias_insert_org on storage.objects;
create policy rotinas_evidencias_insert_org
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'rotinas-evidencias'
  and private.is_active_org_member_path((storage.foldername(name))[1])
);

drop policy if exists rotinas_evidencias_update_org on storage.objects;
create policy rotinas_evidencias_update_org
on storage.objects
for update
to authenticated
using (
  bucket_id = 'rotinas-evidencias'
  and private.is_active_org_member_path((storage.foldername(name))[1])
)
with check (
  bucket_id = 'rotinas-evidencias'
  and private.is_active_org_member_path((storage.foldername(name))[1])
);

drop policy if exists rotinas_evidencias_delete_org on storage.objects;
create policy rotinas_evidencias_delete_org
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'rotinas-evidencias'
  and private.is_active_org_member_path((storage.foldername(name))[1])
);

-- app_records has no direct table grants for authenticated clients, but keep its
-- RLS contract tenant-aware as defense in depth if grants are ever adjusted.
alter policy app_records_insert on public.app_records
with check (
  private.is_active_org_member(org_id)
  and created_by = (select auth.uid())
  and kind is not null
  and private.can_write_kind_for_org(kind, org_id)
);

alter policy app_records_select on public.app_records
using (
  private.is_active_org_member(org_id)
  and private.can_read_kind_for_org(kind, record_id, org_id)
);

alter policy app_records_update on public.app_records
using (
  private.is_active_org_member(org_id)
  and private.can_write_kind_for_org(kind, org_id)
)
with check (
  private.is_active_org_member(org_id)
  and private.can_write_kind_for_org(kind, org_id)
  and updated_by = (select auth.uid())
);

commit;
