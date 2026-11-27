-- Restrict internal SECURITY DEFINER helpers from direct PostgREST RPC calls.
-- These helpers are used internally by SECURITY DEFINER routines; the current
-- client uses the scoped sync_pull/sync_push overloads instead.
-- Keep can_write_routine_photo_path executable because Storage RLS policies call it.
-- Keep the two-argument sync RPCs executable because the application calls them.

REVOKE EXECUTE ON FUNCTION public.can_access_team_member(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.can_read_kind(text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.can_write_kind(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_module_access(uuid, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_perm(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM authenticated;
