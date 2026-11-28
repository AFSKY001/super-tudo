CREATE TABLE IF NOT EXISTS public.app_notification_user_state (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notifications_cleared_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

ALTER TABLE public.app_notification_user_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_notification_user_state FROM anon, authenticated;
GRANT ALL ON public.app_notification_user_state TO service_role;

COMMENT ON TABLE public.app_notification_user_state IS
  'Estado individual de notificações; mantém o marco de exclusão entre dispositivos e impede a restauração de cópias antigas.';
