-- Super Tudo: separar permissão de leitura da permissão de gravação.
-- Esta migration é uma etapa de fundação; não envia dados locais para a nuvem.

CREATE OR REPLACE FUNCTION public.can_read_kind(k text, p_record_id text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN k = 'cfg:team' THEN
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.org_members om
        JOIN public.profiles p ON p.id = om.user_id
        WHERE om.user_id = auth.uid()
          AND om.org_id = public.current_org_id()
          AND om.role = 'gerente'
          AND om.active = true
          AND p.active = true
      )
      OR (p_record_id IS NOT NULL AND public.can_access_team_member(p_record_id))
    WHEN k = 'cfg:sectors' OR k = 'cfg:roles' THEN
      public.has_perm('r:set')
    WHEN k = 'cfg:checklists' THEN
      public.has_perm('r:ck')
    WHEN k = 'cfg:tasks' THEN
      public.has_perm('r:cro')
    WHEN k = 'cfg:equipment' THEN
      public.has_perm('r:eqp') OR public.has_perm('l:temp')
    WHEN left(coalesce(k, ''), 2) = 'l:' THEN
      public.has_perm(k)
      OR public.has_perm('r:' || substring(k from 3))
    ELSE
      public.has_perm(k)
  END;
$function$;

REVOKE ALL ON FUNCTION public.can_read_kind(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_kind(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_read_kind(text, text) TO authenticated, service_role;

-- A leitura direta e os eventos Realtime precisam respeitar o módulo autorizado.
DROP POLICY IF EXISTS app_records_select ON public.app_records;
CREATE POLICY app_records_select
ON public.app_records
FOR SELECT
TO authenticated
USING (
  org_id = public.current_org_id()
  AND public.can_read_kind(kind, record_id)
);

-- A sincronização incremental também entrega registros apenas a quem pode lê-los.
CREATE OR REPLACE FUNCTION public.sync_pull(p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid;
  v_org uuid;
  v_records jsonb;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  v_org := public.current_org_id();

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Organização não encontrada';
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'module', module,
        'record_id', record_id,
        'kind', kind,
        'data', CASE WHEN deleted_at IS NULL THEN data ELSE NULL END,
        'revision', revision,
        'updated_at', updated_at,
        'deleted_at', deleted_at
      )
      ORDER BY updated_at, id
    ),
    '[]'::jsonb
  )
  INTO v_records
  FROM public.app_records
  WHERE org_id = v_org
    AND (p_since IS NULL OR updated_at >= p_since)
    AND public.can_read_kind(kind, record_id);

  RETURN jsonb_build_object('records', v_records);
END;
$function$;

-- Realtime só é habilitado depois de corrigir a política de leitura acima.
DO $publication$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'app_records'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.app_records';
  END IF;
END;
$publication$;
