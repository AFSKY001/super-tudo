-- Add indexes for foreign-key columns that are not the leading column
-- of an existing index. This improves FK checks and joins without changing
-- row-level access rules or application data.
--
-- Deliberately keep this migration additive: do not drop or rewrite indexes
-- based only on low-traffic advisor statistics.

CREATE INDEX IF NOT EXISTS app_config_history_recorded_by_idx
  ON public.app_config_history (recorded_by);

CREATE INDEX IF NOT EXISTS app_config_schedules_applied_by_idx
  ON public.app_config_schedules (applied_by);

CREATE INDEX IF NOT EXISTS app_config_schedules_scheduled_by_idx
  ON public.app_config_schedules (scheduled_by);

CREATE INDEX IF NOT EXISTS app_notifications_created_by_idx
  ON public.app_notifications (created_by);

CREATE INDEX IF NOT EXISTS app_notifications_recipient_user_id_idx
  ON public.app_notifications (recipient_user_id);

CREATE INDEX IF NOT EXISTS app_push_subscriptions_user_id_fk_idx
  ON public.app_push_subscriptions (user_id);

CREATE INDEX IF NOT EXISTS app_records_created_by_idx
  ON public.app_records (created_by);

CREATE INDEX IF NOT EXISTS app_records_updated_by_idx
  ON public.app_records (updated_by);

CREATE INDEX IF NOT EXISTS audit_log_actor_id_idx
  ON public.audit_log (actor_id);

CREATE INDEX IF NOT EXISTS org_members_user_id_fk_idx
  ON public.org_members (user_id);
