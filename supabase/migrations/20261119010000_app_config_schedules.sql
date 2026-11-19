-- Agendamento de mudanças futuras de configuração.
-- A configuração vigente permanece intacta até effective_at.
create table if not exists public.app_config_schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  module text not null,
  record_id text not null,
  kind text not null check (kind like 'cfg:%'),
  base_revision bigint not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  effective_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','applying','applied','conflict','cancelled')),
  scheduled_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  result jsonb,
  constraint app_config_schedules_future_check check (effective_at > created_at)
);

create unique index if not exists app_config_schedules_one_pending_idx
  on public.app_config_schedules (org_id,module,record_id)
  where status = 'pending';

create index if not exists app_config_schedules_due_idx
  on public.app_config_schedules (effective_at)
  where status = 'pending';

alter table public.app_config_schedules enable row level security;
revoke all on table public.app_config_schedules from anon, authenticated;
grant all on table public.app_config_schedules to service_role;

comment on table public.app_config_schedules is
  'Mudanças futuras de configuração. Não alteram a configuração vigente antes de effective_at; acesso via Edge Function autenticada.';
