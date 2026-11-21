-- Explicit tenant scope for every cloud synchronization request.
-- The selected organization is supplied by the authenticated client and checked
-- against an active org_members row before any data is read or written.

create or replace function public.has_perm_for_org(p text, p_org_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select exists (
    select 1 from public.org_members om join public.profiles pr on pr.id=om.user_id
    where om.user_id=auth.uid() and om.org_id=p_org_id and om.active=true and pr.active=true
      and (om.role='admin' or p=any(om.permissions))
  );
$function$;

create or replace function public.can_read_kind_for_org(k text, p_record_id text, p_org_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$
select case
 when k in ('r:pdc','r:conf') then public.has_perm_for_org(k,p_org_id) or exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente','subgerente','supervisor','encarregado') and om.active=true and p.active=true)
 when k='cfg:team' then exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente') and om.active=true and p.active=true)
  or (p_record_id is not null and exists (
   select 1 from public.team_lead_members tlm
   join public.org_members om on om.org_id=tlm.org_id and om.team_member_id=tlm.leader_team_member_id
   join public.profiles p on p.id=om.user_id
   where tlm.org_id=p_org_id and tlm.member_team_member_id=p_record_id and om.user_id=auth.uid() and om.active=true and p.active=true))
 when k in ('cfg:sectors','cfg:roles') then public.has_perm_for_org('r:set',p_org_id) or exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente') and om.active=true and p.active=true)
 when k='cfg:checklists' then public.has_perm_for_org('r:ck',p_org_id) or exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente') and om.active=true and p.active=true)
 when k='cfg:tasks' then public.has_perm_for_org('r:cro',p_org_id) or exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente') and om.active=true and p.active=true)
 when k in ('cfg:equipment','r:eqp') then public.has_perm_for_org('r:eqp',p_org_id) or public.has_perm_for_org('l:temp',p_org_id) or exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente') and om.active=true and p.active=true)
 when left(coalesce(k,''),4)='cfg:' then exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role='admin' and om.active=true and p.active=true)
 when exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente') and om.active=true and p.active=true) then true
 when left(coalesce(k,''),2)='l:' then public.has_perm_for_org(k,p_org_id) or public.has_perm_for_org('r:'||substring(k from 3),p_org_id)
 else public.has_perm_for_org(k,p_org_id)
end;
$function$;

create or replace function public.can_write_kind_for_org(k text, p_org_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$
select case
 when k in ('r:pdc','r:conf') then public.has_perm_for_org(k,p_org_id) or exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente','subgerente','supervisor','encarregado') and om.active=true and p.active=true)
 when k='cfg:team' then exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente') and om.active=true and p.active=true)
 when left(coalesce(k,''),4)='cfg:' then exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role='admin' and om.active=true and p.active=true)
 when exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente') and om.active=true and p.active=true) then true
 when k='r:eqp' then public.has_perm_for_org('r:eqp',p_org_id) or public.has_perm_for_org('l:temp',p_org_id)
 else public.has_perm_for_org(k,p_org_id)
end;
$function$;

do $migration$
declare v_def text; v_old text;
begin
 v_def:=pg_get_functiondef('public.sync_pull(timestamptz)'::regprocedure); v_old:=v_def;
 v_def:=replace(v_def,
  'CREATE OR REPLACE FUNCTION public.sync_pull(p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)',
  'CREATE OR REPLACE FUNCTION public.sync_pull(p_since timestamp with time zone, p_org_id uuid)');
 v_def:=replace(v_def,'v_org := public.current_org_id();','v_org := p_org_id;');
 v_def:=replace(v_def,'  IF v_org IS NULL THEN',
  '  IF v_org IS NULL OR NOT EXISTS (SELECT 1 FROM public.org_members om JOIN public.profiles pr ON pr.id=om.user_id WHERE om.user_id=v_uid AND om.org_id=v_org AND om.active=true AND pr.active=true) THEN');
 v_def:=replace(v_def,'public.can_read_kind(kind, record_id)','public.can_read_kind_for_org(kind, record_id, v_org)');
 if v_def=v_old or position('p_org_id uuid' in v_def)=0 or position('can_read_kind_for_org' in v_def)=0 then
  raise exception 'Não foi possível preparar a sincronização de leitura por empresa.';
 end if;
 execute v_def;

 v_def:=pg_get_functiondef('public.sync_push(jsonb)'::regprocedure); v_old:=v_def;
 v_def:=replace(v_def,'CREATE OR REPLACE FUNCTION public.sync_push(p_ops jsonb)',
  'CREATE OR REPLACE FUNCTION public.sync_push(p_ops jsonb, p_org_id uuid)');
 v_def:=replace(v_def,'v_org_id := public.current_org_id();','v_org_id := p_org_id;');
 v_def:=replace(v_def,'  IF v_org_id IS NULL THEN',
  '  IF v_org_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.org_members om JOIN public.profiles pr ON pr.id=om.user_id WHERE om.user_id=v_uid AND om.org_id=v_org_id AND om.active=true AND pr.active=true) THEN');
 v_def:=replace(v_def,'public.has_perm(''r:eqp'')','public.has_perm_for_org(''r:eqp'', v_org_id)');
 v_def:=replace(v_def,'public.can_write_kind(v_kind)','public.can_write_kind_for_org(v_kind, v_org_id)');
 v_def:=replace(v_def,'public.can_write_kind(v_auth_kind)','public.can_write_kind_for_org(v_auth_kind, v_org_id)');
 if v_def=v_old or position('p_org_id uuid' in v_def)=0 or position('can_write_kind_for_org' in v_def)=0 then
  raise exception 'Não foi possível preparar a sincronização de gravação por empresa.';
 end if;
 execute v_def;
end;
$migration$;

revoke all on function public.sync_pull(timestamptz) from public, anon, authenticated;
revoke all on function public.sync_push(jsonb) from public, anon, authenticated;
revoke all on function public.sync_pull(timestamptz,uuid) from public, anon;
revoke all on function public.sync_push(jsonb,uuid) from public, anon;
grant execute on function public.sync_pull(timestamptz,uuid) to authenticated;
grant execute on function public.sync_push(jsonb,uuid) to authenticated;
revoke all on function public.has_perm_for_org(text,uuid) from public, anon, authenticated;
revoke all on function public.can_read_kind_for_org(text,text,uuid) from public, anon, authenticated;
revoke all on function public.can_write_kind_for_org(text,uuid) from public, anon, authenticated;
