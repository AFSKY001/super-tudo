-- Cover the two platform-admin foreign keys for efficient joins and deletes.
create index if not exists platform_admin_audit_actor_user_id_idx
  on public.platform_admin_audit (actor_user_id);
create index if not exists platform_admins_created_by_idx
  on public.platform_admins (created_by);
