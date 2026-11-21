-- SaaS tenant identity foundation.
-- Reconstructed from the already-applied production migration 20261121110507.
-- This file keeps fresh environments aligned with the production schema.

alter table public.organizations
  add column if not exists slug text,
  add column if not exists brand_name text,
  add column if not exists logo_url text,
  add column if not exists primary_color text not null default '#14532d',
  add column if not exists secondary_color text not null default '#166534',
  add column if not exists accent_color text not null default '#f59e0b',
  add column if not exists status text not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

with normalized as (
  select id,
         trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) as base_slug
  from public.organizations
  where slug is null
)
update public.organizations o
set slug = case
  when n.base_slug = '' then 'empresa-' || left(o.id::text, 8)
  when exists (
    select 1 from public.organizations other
    where other.id <> o.id and lower(other.slug) = n.base_slug
  ) then n.base_slug || '-' || left(o.id::text, 8)
  else n.base_slug
end
from normalized n
where o.id = n.id;

alter table public.organizations alter column slug set not null;
create unique index if not exists organizations_slug_key
  on public.organizations (lower(slug));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizations'::regclass
      and conname = 'organizations_status_check'
  ) then
    alter table public.organizations
      add constraint organizations_status_check
      check (status in ('active', 'suspended', 'trial', 'cancelled'));
  end if;
end
$$;

alter table public.org_members add column if not exists username text;

update public.org_members m
set username = lower(p.username)
from public.profiles p
where p.id = m.user_id
  and m.username is null
  and p.username is not null;

create unique index if not exists org_members_org_username_key
  on public.org_members (org_id, lower(username))
  where username is not null;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  notes text
);

create table if not exists public.platform_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_org_id uuid references public.organizations(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create index if not exists platform_admin_audit_created_at_idx
  on public.platform_admin_audit (created_at desc);
create index if not exists platform_admin_audit_target_org_idx
  on public.platform_admin_audit (target_org_id, created_at desc);

alter table public.platform_admins enable row level security;
alter table public.platform_admin_audit enable row level security;
revoke all on table public.platform_admins from anon, authenticated;
revoke all on table public.platform_admin_audit from anon, authenticated;
grant all on table public.platform_admins to service_role;
grant all on table public.platform_admin_audit to service_role;
