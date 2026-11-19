-- Keep synchronization behind the authenticated, permission-checking RPCs.
-- The browser uses sync_push/sync_pull; it does not read or mutate these tables directly.
-- SECURITY DEFINER RPCs run as their owner and retain the required internal access.

REVOKE ALL PRIVILEGES ON TABLE public.app_records FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public.sync_ops FROM anon, authenticated;
