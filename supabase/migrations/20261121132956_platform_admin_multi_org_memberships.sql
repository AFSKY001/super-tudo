-- Garante que exista apenas um administrador Master ativo e vincula essa conta
-- a cada empresa. O vínculo por organização mantém as políticas RLS e a sincronização
-- isoladas por tenant, sem conceder acesso global aos administradores dos clientes.

create unique index if not exists platform_admins_one_active_idx
  on public.platform_admins ((active))
  where active;

create or replace function public.sync_platform_admin_memberships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin record;
begin
  if tg_table_name = 'organizations' then
    for v_admin in
      select pa.user_id, lower(p.username) as username
      from public.platform_admins pa
      join public.profiles p on p.id = pa.user_id
      where pa.active = true and p.active = true
    loop
      insert into public.org_members
        (org_id, user_id, role, active, permissions, team_member_id, username)
      values
        (new.id, v_admin.user_id, 'admin', true, '{}'::text[], null, v_admin.username)
      on conflict (org_id, lower(username)) where username is not null do nothing;

      update public.org_members
      set role = 'admin', active = true, permissions = '{}'::text[], team_member_id = null
      where org_id = new.id
        and user_id = v_admin.user_id
        and lower(username) = v_admin.username;

      if not exists (
        select 1 from public.org_members
        where org_id = new.id and user_id = v_admin.user_id
          and active = true and lower(username) = v_admin.username
      ) then
        raise exception 'Não foi possível reservar o login do administrador Master na nova empresa.';
      end if;
    end loop;
  elsif tg_table_name = 'platform_admins' then
    if new.active = true then
      -- A versão corrigida da função lê o username por variável escalar.
      select lower(p.username) into v_admin
      from public.profiles p
      where p.id = new.user_id and p.active = true;
    else
      update public.org_members
      set active = false
      where user_id = new.user_id
        and team_member_id is null
        and lower(username) = (
          select lower(p.username) from public.profiles p where p.id = new.user_id
        );
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function public.sync_platform_admin_memberships() from public, anon, authenticated;

drop trigger if exists organizations_attach_platform_admin on public.organizations;
create trigger organizations_attach_platform_admin
after insert on public.organizations
for each row execute function public.sync_platform_admin_memberships();

drop trigger if exists platform_admins_sync_memberships on public.platform_admins;
create trigger platform_admins_sync_memberships
after insert or update of active on public.platform_admins
for each row execute function public.sync_platform_admin_memberships();

do $backfill$
declare
  v_admin record;
  v_org record;
begin
  for v_admin in
    select pa.user_id, lower(p.username) as username
    from public.platform_admins pa
    join public.profiles p on p.id = pa.user_id
    where pa.active = true and p.active = true
  loop
    for v_org in select id from public.organizations
    loop
      insert into public.org_members
        (org_id, user_id, role, active, permissions, team_member_id, username)
      values
        (v_org.id, v_admin.user_id, 'admin', true, '{}'::text[], null, v_admin.username)
      on conflict (org_id, lower(username)) where username is not null do nothing;

      update public.org_members
      set role = 'admin', active = true, permissions = '{}'::text[], team_member_id = null
      where org_id = v_org.id
        and user_id = v_admin.user_id
        and lower(username) = v_admin.username;

      if not exists (
        select 1 from public.org_members
        where org_id = v_org.id and user_id = v_admin.user_id
          and active = true and lower(username) = v_admin.username
      ) then
        raise exception 'Conflito ao vincular o administrador Master à empresa %.', v_org.id;
      end if;
    end loop;
  end loop;
end;
$backfill$;
