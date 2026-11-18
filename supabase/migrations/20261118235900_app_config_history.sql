-- Histórico imutável de versões das configurações do Super Tudo.
-- Não altera nem remove app_records/audit_log existentes.
-- Versões antigas são reconstruídas somente a partir dos snapshots preservados no audit_log.

create table if not exists public.app_config_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  module text not null,
  record_id text not null,
  kind text not null,
  revision bigint not null,
  data jsonb not null,
  deleted_at timestamptz,
  recorded_at timestamptz not null,
  effective_at timestamptz not null,
  recorded_by uuid references auth.users(id) on delete set null,
  source text not null check (source in ('audit_backfill','baseline','live')),
  constraint app_config_history_revision_unique unique (org_id,module,record_id,revision)
);

create index if not exists app_config_history_lookup_idx
  on public.app_config_history (org_id,kind,record_id,effective_at desc);

alter table public.app_config_history enable row level security;
revoke all on table public.app_config_history from anon, authenticated;
grant all on table public.app_config_history to service_role;

comment on table public.app_config_history is
  'Snapshots imutáveis de versões cfg:*; acesso futuro somente por endpoint autorizado.';

-- Reconstrói revisões que já estão guardadas no audit_log.
insert into public.app_config_history
  (org_id,module,record_id,kind,revision,data,deleted_at,recorded_at,effective_at,recorded_by,source)
select
  (a.details->'new'->>'org_id')::uuid,
  a.details->'new'->>'module',
  a.details->'new'->>'record_id',
  a.details->'new'->>'kind',
  (a.details->'new'->>'revision')::bigint,
  coalesce(a.details->'new'->'data','{}'::jsonb),
  nullif(a.details->'new'->>'deleted_at','')::timestamptz,
  a.created_at,a.created_at,
  nullif(a.details->'new'->>'updated_by','')::uuid,
  'audit_backfill'
from public.audit_log a
where a.action in ('INSERT','UPDATE')
  and coalesce(a.details->'new'->>'kind','') like 'cfg:%'
  and a.details->'new' ? 'revision'
on conflict (org_id,module,record_id,revision) do nothing;

-- Ponto de partida para configurações atuais sem snapshot de auditoria.
-- Este baseline marca o início da captura; não presume o histórico de meses anteriores.
insert into public.app_config_history
  (org_id,module,record_id,kind,revision,data,deleted_at,recorded_at,effective_at,recorded_by,source)
select
  r.org_id,r.module,r.record_id,r.kind,r.revision,r.data,r.deleted_at,
  now(),now(),coalesce(r.updated_by,r.created_by),'baseline'
from public.app_records r
where r.kind like 'cfg:%'
on conflict (org_id,module,record_id,revision) do nothing;

create or replace function public.capture_app_config_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.kind like 'cfg:%' then
    insert into public.app_config_history
      (org_id,module,record_id,kind,revision,data,deleted_at,recorded_at,effective_at,recorded_by,source)
    values
      (new.org_id,new.module,new.record_id,new.kind,new.revision,new.data,new.deleted_at,
       coalesce(new.updated_at,now()),coalesce(new.updated_at,now()),
       coalesce(new.updated_by,new.created_by,auth.uid()),'live')
    on conflict (org_id,module,record_id,revision) do nothing;
  end if;
  return new;
end;
$function$;

revoke all on function public.capture_app_config_history() from public, anon, authenticated;

drop trigger if exists app_records_capture_config_history on public.app_records;
create trigger app_records_capture_config_history
after insert or update on public.app_records
for each row
when (new.kind like 'cfg:%')
execute function public.capture_app_config_history();
