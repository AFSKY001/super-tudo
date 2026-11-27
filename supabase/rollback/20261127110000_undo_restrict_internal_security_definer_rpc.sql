-- Rollback for 20261127110000_restrict_internal_security_definer_rpc.sql.
-- Restore the previous authenticated RPC grants.

GRANT EXECUTE ON FUNCTION public.can_access_team_member(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_kind(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_kind(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_module_access(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_perm(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
