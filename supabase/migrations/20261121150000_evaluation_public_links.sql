create table if not exists public.evaluation_public_links (
 id uuid primary key default gen_random_uuid(),
 org_id uuid not null references public.organizations(id) on delete cascade,
 token text not null unique,
 evaluation_type text not null,
 evaluation_name text not null,
 evaluator_group text not null check (evaluator_group in ('subordinados','outros_encarregados','equipe','anonimo')),
 target jsonb not null default '{}'::jsonb,
 questions jsonb not null default '[]'::jsonb,
 anonymous boolean not null default true,
 active boolean not null default true,
 expires_at timestamptz,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists evaluation_public_links_org_created_idx on public.evaluation_public_links (org_id, created_at desc);
create index if not exists evaluation_public_links_active_expiry_idx on public.evaluation_public_links (token, active, expires_at);
alter table public.evaluation_public_links enable row level security;
revoke all on table public.evaluation_public_links from anon, authenticated;
