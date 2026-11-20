create or replace function public.sync_pull(p_since timestamp with time zone default null::timestamp with time zone)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_uid uuid;
  v_org uuid;
  v_records jsonb;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'Usuário não autenticado';
  end if;

  v_org := public.current_org_id();

  if v_org is null then
    raise exception 'Organização não encontrada';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'module', module,
        'record_id', record_id,
        'kind', kind,
        'data', case when deleted_at is null then data else null end,
        'revision', revision,
        'updated_at', updated_at,
        'deleted_at', deleted_at
      )
      order by updated_at, id
    ),
    '[]'::jsonb
  )
  into v_records
  from public.app_records
  where org_id = v_org
    and (p_since is null or updated_at >= p_since)
    and (
      public.is_admin()
      or (
        kind = 'cfg:team'
        and (
          public.can_access_team_member(record_id)
          or exists (
            select 1
            from public.org_members om
            join public.profiles p on p.id = om.user_id
            where om.user_id = v_uid
              and om.org_id = v_org
              and om.role = 'gerente'
              and om.active = true
              and p.active = true
          )
        )
      )
      or (
        kind is distinct from 'cfg:team'
        and public.can_write_kind(kind)
      )
    );

  return jsonb_build_object('records', v_records);
end;
$function$;

insert into public.app_records
  (org_id, module, record_id, data, kind, updated_by, created_by)
select
  '373fc0dc-2429-4a5c-b07c-e5231b09cd69'::uuid,
  'cfg',
  v.record_id,
  v.data,
  'cfg:team',
  'a5153a5c-565b-4e18-a6ed-75afc7306d12'::uuid,
  'a5153a5c-565b-4e18-a6ed-75afc7306d12'::uuid
from (values
  ('alisson1', '{"id":"alisson1","n":"Alisson","f":"Administrador","s":"","t":"Intermediário","g":[],"l":false,"lead":[],"perm":[],"ent":false,"adm":true,"a":[],"mg":1,"u":"alisson","h":""}'::jsonb),
  ('monaliz', '{"id":"monaliz","n":"Monaliza","f":"Gerente de loja","s":"","t":"Intermediário","g":[],"l":false,"lead":[],"perm":[],"ent":false,"adm":false,"a":[],"mg":1,"u":"monaliza","h":""}'::jsonb)
) as v(record_id, data)
where not exists (
  select 1 from public.app_records ar
  where ar.org_id = '373fc0dc-2429-4a5c-b07c-e5231b09cd69'::uuid
    and ar.kind = 'cfg:team'
    and ar.record_id = v.record_id
);

update public.org_members
set team_member_id = case
  when user_id = 'a5153a5c-565b-4e18-a6ed-75afc7306d12'::uuid then 'alisson1'
  when user_id = 'afe4c3db-2e91-4af1-8f15-a766be68313c'::uuid then 'monaliz'
  else team_member_id
end
where org_id = '373fc0dc-2429-4a5c-b07c-e5231b09cd69'::uuid
  and user_id in (
    'a5153a5c-565b-4e18-a6ed-75afc7306d12'::uuid,
    'afe4c3db-2e91-4af1-8f15-a766be68313c'::uuid
  );
