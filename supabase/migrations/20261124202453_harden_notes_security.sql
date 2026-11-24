-- Hardening do Bloco de notas: remove helpers SECURITY DEFINER da API pública.
-- Mantém a autorização das políticas RLS, sem expor RPCs privilegiadas no schema public.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.notas_has_permission(p text, p_org_id uuid)
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
      where om.user_id = (select auth.uid())
        and om.org_id = p_org_id
        and om.role in ('admin','gerente')
        and om.active = true
        and pr.active = true
    );
$function$;

-- A função interna só pode ser chamada pelo contexto autenticado das políticas RLS.
revoke all on function private.notas_has_permission(text, uuid) from public, anon;
grant execute on function private.notas_has_permission(text, uuid) to authenticated;

drop policy if exists notas_select on public.notas;
create policy notas_select on public.notas
for select to authenticated
using (
  (
    author_id = (select auth.uid())
    and private.notas_has_permission('l:notes', org_id)
  )
  or (
    shared = true
    and archived = false
    and deleted_at is null
    and private.notas_has_permission('r:notes', org_id)
  )
  or (
    shared = true
    and private.notas_has_permission('m:notes', org_id)
  )
);

drop policy if exists notas_insert on public.notas;
create policy notas_insert on public.notas
for insert to authenticated
with check (
  author_id = (select auth.uid())
  and private.notas_has_permission('l:notes', org_id)
);

drop policy if exists notas_update on public.notas;
create policy notas_update on public.notas
for update to authenticated
using (
  (author_id = (select auth.uid()) and private.notas_has_permission('l:notes', org_id))
  or (
    shared = true
    and private.notas_has_permission('m:notes', org_id)
  )
)
with check (
  (author_id = (select auth.uid()) and private.notas_has_permission('l:notes', org_id))
  or (
    shared = true
    and private.notas_has_permission('m:notes', org_id)
  )
);

drop policy if exists notas_delete on public.notas;
create policy notas_delete on public.notas
for delete to authenticated
using (
  (author_id = (select auth.uid()) and deleted_at is not null and private.notas_has_permission('l:notes', org_id))
  or (
    shared = true
    and private.notas_has_permission('m:notes', org_id)
  )
);

-- O helper antigo deixa de existir no schema exposto pela Data API.
drop function if exists public.notas_has_permission(text, uuid);

-- Trigger já existente: EXECUTE é verificado ao criar o trigger, não a cada disparo.
-- A função continua SECURITY DEFINER para validar a organização e fixar a autoria.
revoke all on function public.notas_set_author() from public, anon, authenticated;

-- Índice específico para a FK author_id; o índice composto existente começa por org_id.
create index if not exists idx_notas_author_id
  on public.notas(author_id);

commit;
