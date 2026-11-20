-- Cache auth.uid() as an initplan in RLS policies instead of
-- re-evaluating it for every row. The authorization predicates remain
-- semantically identical; org and kind checks are intentionally unchanged.

ALTER POLICY app_notifications_select_own
  ON public.app_notifications
  USING (
    org_id = public.current_org_id()
    AND recipient_user_id = (SELECT auth.uid())
  );

ALTER POLICY app_records_insert
  ON public.app_records
  WITH CHECK (
    org_id = public.current_org_id()
    AND created_by = (SELECT auth.uid())
    AND kind IS NOT NULL
    AND public.can_write_kind(kind)
  );

ALTER POLICY app_records_update
  ON public.app_records
  WITH CHECK (
    org_id = public.current_org_id()
    AND public.can_write_kind(kind)
    AND NOT (updated_by IS DISTINCT FROM (SELECT auth.uid()))
  );
