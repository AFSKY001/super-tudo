-- Super Tudo: acesso compartilhado aos pedidos de compras e conferências.
-- Lideranças com login podem criar, ler e atualizar pedidos e suas conferências.
-- Repositores não recebem acesso ampliado por esta migration.

CREATE OR REPLACE FUNCTION public.can_read_kind(k text, p_record_id text DEFAULT NULL::text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
SELECT CASE
 WHEN k IN ('r:pdc','r:conf') THEN public.is_admin() OR public.has_perm(k) OR EXISTS (
  SELECT 1 FROM public.org_members om JOIN public.profiles p ON p.id=om.user_id
  WHERE om.user_id=auth.uid() AND om.org_id=public.current_org_id()
   AND om.role IN ('admin','gerente','subgerente','supervisor','encarregado')
   AND om.active=true AND p.active=true)
 WHEN k='cfg:team' THEN public.is_admin() OR EXISTS (
  SELECT 1 FROM public.org_members om JOIN public.profiles p ON p.id=om.user_id
  WHERE om.user_id=auth.uid() AND om.org_id=public.current_org_id()
   AND om.role='gerente' AND om.active=true AND p.active=true)
  OR (p_record_id IS NOT NULL AND public.can_access_team_member(p_record_id))
 WHEN k='cfg:sectors' OR k='cfg:roles' THEN public.has_perm('r:set') OR EXISTS (SELECT 1 FROM public.org_members om JOIN public.profiles p ON p.id=om.user_id WHERE om.user_id=auth.uid() AND om.org_id=public.current_org_id() AND om.role='gerente' AND om.active=true AND p.active=true)
 WHEN k='cfg:checklists' THEN public.has_perm('r:ck') OR EXISTS (SELECT 1 FROM public.org_members om JOIN public.profiles p ON p.id=om.user_id WHERE om.user_id=auth.uid() AND om.org_id=public.current_org_id() AND om.role='gerente' AND om.active=true AND p.active=true)
 WHEN k='cfg:tasks' THEN public.has_perm('r:cro') OR EXISTS (SELECT 1 FROM public.org_members om JOIN public.profiles p ON p.id=om.user_id WHERE om.user_id=auth.uid() AND om.org_id=public.current_org_id() AND om.role='gerente' AND om.active=true AND p.active=true)
 WHEN k='cfg:equipment' THEN public.has_perm('r:eqp') OR public.has_perm('l:temp') OR EXISTS (SELECT 1 FROM public.org_members om JOIN public.profiles p ON p.id=om.user_id WHERE om.user_id=auth.uid() AND om.org_id=public.current_org_id() AND om.role='gerente' AND om.active=true AND p.active=true)
 WHEN k='r:eqp' THEN public.has_perm('r:eqp') OR public.has_perm('l:temp') OR EXISTS (SELECT 1 FROM public.org_members om JOIN public.profiles p ON p.id=om.user_id WHERE om.user_id=auth.uid() AND om.org_id=public.current_org_id() AND om.role='gerente' AND om.active=true AND p.active=true)
 WHEN left(coalesce(k,''),4)='cfg:' THEN public.is_admin()
 WHEN EXISTS (SELECT 1 FROM public.org_members om JOIN public.profiles p ON p.id=om.user_id WHERE om.user_id=auth.uid() AND om.org_id=public.current_org_id() AND om.role='gerente' AND om.active=true AND p.active=true) THEN true
 WHEN left(coalesce(k,''),2)='l:' THEN public.has_perm(k) OR public.has_perm('r:'||substring(k from 3))
 ELSE public.has_perm(k)
END;
$function$;
REVOKE ALL ON FUNCTION public.can_read_kind(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_kind(text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_write_kind(k text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
SELECT CASE
 WHEN k IN ('r:pdc','r:conf') THEN public.is_admin() OR public.has_perm(k) OR EXISTS (
  SELECT 1 FROM public.org_members om JOIN public.profiles p ON p.id=om.user_id
  WHERE om.user_id=auth.uid() AND om.org_id=public.current_org_id()
   AND om.role IN ('admin','gerente','subgerente','supervisor','encarregado')
   AND om.active=true AND p.active=true)
 WHEN k='cfg:team' THEN public.is_admin() OR EXISTS (
  SELECT 1 FROM public.org_members om JOIN public.profiles p ON p.id=om.user_id
  WHERE om.user_id=auth.uid() AND om.org_id=public.current_org_id()
   AND om.role='gerente' AND om.active=true AND p.active=true)
 WHEN left(coalesce(k,''),4)='cfg:' THEN public.is_admin()
 WHEN EXISTS (SELECT 1 FROM public.org_members om JOIN public.profiles p ON p.id=om.user_id WHERE om.user_id=auth.uid() AND om.org_id=public.current_org_id() AND om.role='gerente' AND om.active=true AND p.active=true) THEN true
 WHEN k='r:eqp' THEN public.has_perm('r:eqp') OR public.has_perm('l:temp')
 ELSE public.has_perm(k)
END;
$function$;
REVOKE ALL ON FUNCTION public.can_write_kind(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_kind(text) TO authenticated, service_role;
