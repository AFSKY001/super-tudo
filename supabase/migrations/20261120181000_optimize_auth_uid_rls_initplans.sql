-- Evaluate auth.uid() once per statement instead of once per candidate row.
-- Authorization semantics remain unchanged; only the stable auth lookup is
-- wrapped in a scalar subquery for PostgreSQL's initplan optimization.

ALTER POLICY app_records_insert ON public.app_records
  WITH CHECK (
    org_id = current_org_id()
    AND created_by = (SELECT auth.uid())
    AND kind IS NOT NULL
    AND can_write_kind(kind)
  );

ALTER POLICY app_records_update ON public.app_records
  USING (
    org_id = current_org_id()
    AND can_write_kind(kind)
  )
  WITH CHECK (
    org_id = current_org_id()
    AND can_write_kind(kind)
    AND NOT (updated_by IS DISTINCT FROM (SELECT auth.uid()))
  );

ALTER POLICY app_notifications_select_own ON public.app_notifications
  USING (
    org_id = current_org_id()
    AND recipient_user_id = (SELECT auth.uid())
  );
