CREATE TABLE IF NOT EXISTS public.app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_team_member_id text,
  title text NOT NULL DEFAULT 'Super Tudo',
  body text NOT NULL,
  ref jsonb,
  cat text NOT NULL DEFAULT 'avi',
  dedupe_key text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CONSTRAINT app_notifications_dedupe_unique UNIQUE (org_id, recipient_user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS app_notifications_recipient_created_idx
  ON public.app_notifications (org_id, recipient_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.app_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  subscription jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_push_subscriptions_user_endpoint_unique UNIQUE (org_id, user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS app_push_subscriptions_user_idx
  ON public.app_push_subscriptions (org_id, user_id);

CREATE TABLE IF NOT EXISTS public.app_push_config (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  public_key text NOT NULL,
  private_key text NOT NULL,
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_push_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_notifications_select_own ON public.app_notifications;
CREATE POLICY app_notifications_select_own
  ON public.app_notifications
  FOR SELECT
  TO authenticated
  USING (org_id = public.current_org_id() AND recipient_user_id = auth.uid());

REVOKE ALL ON public.app_notifications FROM anon, authenticated;
GRANT SELECT ON public.app_notifications TO authenticated;
GRANT ALL ON public.app_notifications TO service_role;

REVOKE ALL ON public.app_push_subscriptions FROM anon, authenticated;
GRANT ALL ON public.app_push_subscriptions TO service_role;

REVOKE ALL ON public.app_push_config FROM anon, authenticated;
GRANT ALL ON public.app_push_config TO service_role;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

COMMENT ON TABLE public.app_notifications IS 'Notificações individuais do Super Tudo, compartilhadas entre dispositivos e usadas pelo Web Push.';
COMMENT ON TABLE public.app_push_subscriptions IS 'Assinaturas Web Push dos dispositivos; acesso exclusivo ao service_role/Edge Function.';
COMMENT ON TABLE public.app_push_config IS 'Chaves VAPID por organização; a chave privada só pode ser lida pelo service_role.';

