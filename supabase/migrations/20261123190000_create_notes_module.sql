-- Bloco de notas do Super Tudo
-- Modelo isolado do sync operacional: usa Supabase Auth, org_id, RLS e Realtime.
-- Permissões no vínculo org_members.permissions:
--   l:notes = criar e gerenciar notas próprias
--   r:notes = ler notas compartilhadas da equipe
--   m:notes = moderar notas de outros membros da mesma organização

begin;

create table if not exists public.notas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  author_name text not null default '',
  title text not null default '' check (char_length(title) <= 120),
  body text not null default '' check (char_length(body) <= 20000),
  color text not null default 'amarelo'
    check (color in ('amarelo','rosa','azul','verde','laranja','lilas','cinza')),
  pinned boolean not null default false,
  archived boolean not null default false,
  shared boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_notas_org_author_updated
  on public.notas (org_id, author_id, updated_at desc);

create index if not exists idx_notas_org_shared_updated
  on public.notas (org_id, updated_at desc)
  where shared = true and archived = false and deleted_at is null;

create or replace function public.notas_has_permission(p text, p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select public.has_perm_for_org(p, p_org_id)
    or exists (
      select 1
      from public.org_members om
      join public.profiles pr on pr.id = om.user_id
      where om.user_id = auth.uid()
        and om.org_id = p_org_id
        and om.role in ('admin','gerente')
        and om.active = true
        and pr.active = true
    );
$function$;

create or replace function public.notas_set_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid;
  v_name text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Usuário não autenticado';
  end if;

  if tg_op = 'INSERT' then
    if not exists (
      select 1
      from public.org_members om
      join public.profiles p on p.id = om.user_id
      where om.org_id = new.org_id
        and om.user_id = v_uid
        and om.active = true
        and p.active = true
    ) then
      raise exception 'Usuário não pertence à organização ativa';
    end if;

    select coalesce(nullif(p.full_name,''), nullif(p.display_name,''), p.username, 'Usuário')
      into v_name
    from public.profiles p
    where p.id = v_uid;

    new.author_id := v_uid;
    new.author_name := coalesce(v_name, 'Usuário');
  else
    new.org_id := old.org_id;
    new.author_id := old.author_id;
    new.author_name := old.author_name;
    new.created_at := old.created_at;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists t_notas_set_author on public.notas;
create trigger t_notas_set_author
before insert or update on public.notas
for each row execute function public.notas_set_author();

alter table public.notas enable row level security;

drop policy if exists notas_select on public.notas;
create policy notas_select on public.notas
for select to authenticated
using (
  (
    author_id = auth.uid()
    and public.has_perm_for_org('l:notes', org_id)
  )
  or (
    shared = true
    and archived = false
    and deleted_at is null
    and public.has_perm_for_org('r:notes', org_id)
  )
  or public.has_perm_for_org('m:notes', org_id)
);

drop policy if exists notas_insert on public.notas;
create policy notas_insert on public.notas
for insert to authenticated
with check (
  author_id = auth.uid()
  and public.has_perm_for_org('l:notes', org_id)
);

drop policy if exists notas_update on public.notas;
create policy notas_update on public.notas
for update to authenticated
using (
  (author_id = auth.uid() and public.has_perm_for_org('l:notes', org_id))
  or public.has_perm_for_org('m:notes', org_id)
)
with check (
  (author_id = auth.uid() and public.has_perm_for_org('l:notes', org_id))
  or public.has_perm_for_org('m:notes', org_id)
);

drop policy if exists notas_delete on public.notas;
create policy notas_delete on public.notas
for delete to authenticated
using (
  (author_id = auth.uid() and deleted_at is not null and public.has_perm_for_org('l:notes', org_id))
  or public.has_perm_for_org('m:notes', org_id)
);

grant select, insert, update, delete on public.notas to authenticated;

do $publication$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notas'
  ) then
    alter publication supabase_realtime add table public.notas;
  end if;
end;
$publication$;

commit;

-- Como desfazer:
-- begin;
-- drop table if exists public.notas cascade;
-- drop function if exists public.notas_set_author();
-- drop function if exists public.notas_has_permission(text, uuid);
-- commit;
