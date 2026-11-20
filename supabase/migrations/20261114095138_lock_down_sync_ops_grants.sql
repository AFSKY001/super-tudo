revoke all on public.sync_ops from anon;
revoke all on public.sync_ops from authenticated;
grant select on public.sync_ops to authenticated;
