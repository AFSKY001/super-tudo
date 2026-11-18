create table if not exists public.app_notification_settings (
  org_id uuid primary key,
  distribution_mode text not null default 'all'
    check (distribution_mode in ('all', 'role')),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.app_notification_settings enable row level security;
revoke all on table public.app_notification_settings from anon, authenticated;
grant all on table public.app_notification_settings to service_role;
