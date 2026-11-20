create table public.sync_ops (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  client_id uuid not null,
  requested_by uuid,
  module text not null,
  record_id text not null,
  kind text,
  base_revision bigint,
  status text not null check (status in ('applied','conflict','forbidden','invalid')),
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint sync_ops_org_client_key unique (org_id, client_id)
);

alter table public.sync_ops enable row level security;

create policy sync_ops_select on public.sync_ops
for select
to authenticated
using (org_id = public.current_org_id());

grant select on public.sync_ops to authenticated;
