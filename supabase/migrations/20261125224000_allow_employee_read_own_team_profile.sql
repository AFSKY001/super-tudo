-- Allow an employee to read only their own team profile.
-- Keeps manager/admin visibility and leader-to-subordinate visibility unchanged.
create or replace function public.can_read_kind_for_org(k text, p_record_id text, p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
select case
 when k in ('r:pdc','r:conf') then public.has_perm_for_org(k,p_org_id) or exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente','subgerente','supervisor','encarregado') and om.active=true and p.active=true)
 when k='cfg:team' then exists (
  select 1 from public.org_members om join public.profiles p on p.id=om.user_id
  where om.user_id=auth.uid() and om.org_id=p_org_id and om.role in ('admin','gerente') and om.active=true and p.active=true)
  or exists (
   select 1 from public.org_members om
   join public.profiles p on p.id=om.user_id
   where om.user_id=auth.uid()
     and om.org_id=p_org_id
     and om.team_member_id=p_record_id
     and p_record_id is not null
     and om.active=true
     and p.active=true)
  or (p_record_id is not null and exists (
   select 1 from public.team_lead_members tlm
   join public.org_members om on om.org_id=tlm.org_id and om.team_member_id=tlm.leader_team_member_id
   join public.profiles p on p.id=om.user_id
   where tlm.org_id=p_org_id and tlm.member_team_member_id=p_record_id and om.user_id=auth.uid() and om.role='encarregado' and public.has_perm_for_org('r:eqp',p_org_id) and om.active=true and p.active=true))
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
