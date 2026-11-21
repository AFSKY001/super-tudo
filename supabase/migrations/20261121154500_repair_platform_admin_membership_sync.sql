-- Repair Master membership synchronization for both existing and newly created tenants.
-- Re-activating the platform Master must restore its organization-scoped admin links.
create or replace function public.sync_platform_admin_memberships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin record;
  v_org record;
  v_username text;
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
      on conflict (org_id, user_id) do update
        set role = 'admin',
            active = true,
            permissions = '{}'::text[],
            team_member_id = null,
            username = excluded.username;

      if not exists (
        select 1 from public.org_members
        where org_id = new.id
          and user_id = v_admin.user_id
          and active = true
          and role = 'admin'
          and lower(username) = v_admin.username
      ) then
        raise exception 'Não foi possível vincular o administrador Master à nova empresa.';
      end if;
    end loop;

  elsif tg_table_name = 'platform_admins' then
    if new.active = true then
      select lower(p.username)
        into v_username
        from public.profiles p
       where p.id = new.user_id and p.active = true;

      if v_username is null then
        raise exception 'O perfil do administrador Master está ausente ou inativo.';
      end if;

      for v_org in select id from public.organizations
      loop
        insert into public.org_members
          (org_id, user_id, role, active, permissions, team_member_id, username)
        values
          (v_org.id, new.user_id, 'admin', true, '{}'::text[], null, v_username)
        on conflict (org_id, user_id) do update
          set role = 'admin',
              active = true,
              permissions = '{}'::text[],
              team_member_id = null,
              username = excluded.username;

        if not exists (
          select 1 from public.org_members
          where org_id = v_org.id
            and user_id = new.user_id
            and active = true
            and role = 'admin'
            and lower(username) = v_username
        ) then
          raise exception 'Não foi possível restaurar o vínculo Master na empresa %.', v_org.id;
        end if;
      end loop;
    else
      update public.org_members
         set active = false
       where user_id = new.user_id
         and team_member_id is null
         and lower(username) = (
           select lower(p.username)
             from public.profiles p
            where p.id = new.user_id
         );
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.sync_platform_admin_memberships() from public, anon, authenticated;
