CREATE OR REPLACE FUNCTION public.sync_push(p_ops jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid;
  v_org_id uuid;
  v_op jsonb;
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
  v_client_id uuid;
  v_module text;
  v_record_id text;
  v_kind text;
  v_base_revision bigint;
  v_data jsonb;
  v_deleted boolean;
  v_auth_kind text;
  v_existing public.app_records%rowtype;
  v_dup public.sync_ops%rowtype;
  v_new_id uuid;
  v_new_revision bigint;
  v_member_role text;
  v_team_member_id text;
  v_is_team_leader boolean := false;
  v_linked boolean := false;
  v_member text;
  v_invalid_team_data boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;

  v_org_id := public.current_org_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'usuário sem organização ativa';
  END IF;

  SELECT om.role, om.team_member_id
    INTO v_member_role, v_team_member_id
    FROM public.org_members om
    JOIN public.profiles p ON p.id = om.user_id
   WHERE om.user_id = v_uid
     AND om.org_id = v_org_id
     AND om.active = true
     AND p.active = true
   LIMIT 1;

  v_is_team_leader :=
    v_member_role = 'encarregado'
    AND v_team_member_id IS NOT NULL
    AND public.has_perm('r:eqp');

  IF p_ops IS NULL OR jsonb_typeof(p_ops) <> 'array' THEN
    RAISE EXCEPTION 'p_ops deve ser um array jsonb';
  END IF;

  FOR v_op IN SELECT * FROM jsonb_array_elements(p_ops)
  LOOP
    v_client_id     := nullif(v_op->>'client_id','')::uuid;
    v_module        := v_op->>'module';
    v_record_id     := v_op->>'record_id';
    v_kind          := v_op->>'kind';
    v_base_revision := nullif(v_op->>'base_revision','')::bigint;
    v_data          := v_op->'data';
    v_deleted       := coalesce((v_op->>'deleted')::boolean, false);

    IF v_client_id IS NULL OR v_module IS NULL OR v_record_id IS NULL OR v_kind IS NULL THEN
      v_result := jsonb_build_object(
        'client_id', v_op->>'client_id',
        'status', 'invalid',
        'reason', 'client_id, module, record_id e kind são obrigatórios'
      );
      v_results := v_results || jsonb_build_array(v_result);
      CONTINUE;
    END IF;

    SELECT * INTO v_dup
      FROM public.sync_ops
     WHERE org_id = v_org_id AND client_id = v_client_id;

    IF FOUND THEN
      v_results := v_results || jsonb_build_array(v_dup.result || jsonb_build_object('duplicate', true));
      CONTINUE;
    END IF;

    SELECT * INTO v_existing
      FROM public.app_records
     WHERE org_id = v_org_id
       AND module = v_module
       AND record_id = v_record_id
     FOR UPDATE;

    IF NOT FOUND THEN
      IF v_base_revision IS NOT NULL THEN
        v_result := jsonb_build_object(
          'client_id', v_client_id, 'status', 'conflict',
          'reason', 'base_revision informado para registro inexistente'
        );

      ELSIF v_kind = 'cfg:team' AND v_member_role = 'encarregado' THEN
        v_invalid_team_data :=
          NOT v_is_team_leader
          OR v_deleted
          OR jsonb_typeof(coalesce(v_data, '{}'::jsonb)) <> 'object'
          OR (v_data->>'id') IS DISTINCT FROM v_record_id
          OR lower(btrim(coalesce(v_data->>'f',''))) <> 'repositor'
          OR coalesce((v_data->>'adm')::boolean, false)
          OR coalesce((v_data->>'l')::boolean, false)
          OR CASE WHEN jsonb_typeof(v_data->'lead') = 'array'
                  THEN jsonb_array_length(v_data->'lead') > 0
                  ELSE v_data ? 'lead' END
          OR CASE WHEN jsonb_typeof(v_data->'perm') = 'array'
                  THEN jsonb_array_length(v_data->'perm') > 0
                  ELSE v_data ? 'perm' END
          OR nullif(btrim(coalesce(v_data->>'sb_uid','')), '') IS NOT NULL;

        IF v_invalid_team_data THEN
          v_result := jsonb_build_object('client_id', v_client_id, 'status', 'forbidden', 'kind', v_kind);
        ELSE
          v_data := coalesce(v_data, '{}'::jsonb) ||
            jsonb_build_object('created_by', v_uid::text, 'owner_team_member_id', v_team_member_id);

          INSERT INTO public.app_records(org_id, module, record_id, kind, data, client_id)
          VALUES (v_org_id, v_module, v_record_id, v_kind, v_data, v_client_id)
          RETURNING id, revision INTO v_new_id, v_new_revision;

          INSERT INTO public.team_lead_members(org_id, leader_team_member_id, member_team_member_id, created_by)
          SELECT v_org_id, v_team_member_id, v_record_id, v_uid
           WHERE NOT EXISTS (
             SELECT 1 FROM public.team_lead_members tlm
              WHERE tlm.org_id = v_org_id
                AND tlm.leader_team_member_id = v_team_member_id
                AND tlm.member_team_member_id = v_record_id
           );

          v_result := jsonb_build_object(
            'client_id', v_client_id, 'status', 'applied',
            'app_record_id', v_new_id, 'revision', v_new_revision
          );
        END IF;

      ELSIF NOT public.can_write_kind(v_kind) THEN
        v_result := jsonb_build_object('client_id', v_client_id, 'status', 'forbidden', 'kind', v_kind);

      ELSIF v_kind = 'cfg:team'
        AND coalesce(v_member_role,'') <> 'admin'
        AND (
          coalesce((v_data->>'adm')::boolean, false)
          OR coalesce((v_data->>'l')::boolean, false)
          OR CASE WHEN jsonb_typeof(v_data->'lead') = 'array'
                  THEN jsonb_array_length(v_data->'lead') > 0
                  ELSE v_data ? 'lead' END
        ) THEN
        v_result := jsonb_build_object('client_id', v_client_id, 'status', 'forbidden', 'kind', v_kind);

      ELSE
        IF v_kind = 'cfg:team' THEN
          v_data := coalesce(v_data, '{}'::jsonb) ||
            jsonb_build_object('created_by', coalesce(v_data->>'created_by', v_uid::text));
        END IF;

        INSERT INTO public.app_records(org_id, module, record_id, kind, data, client_id)
        VALUES (v_org_id, v_module, v_record_id, v_kind, coalesce(v_data, '{}'::jsonb), v_client_id)
        RETURNING id, revision INTO v_new_id, v_new_revision;

        IF v_kind = 'cfg:team' AND coalesce(v_member_role,'') IN ('admin','gerente') THEN
          IF jsonb_typeof(v_data->'lead') = 'array' THEN
            FOR v_member IN SELECT jsonb_array_elements_text(v_data->'lead')
            LOOP
              INSERT INTO public.team_lead_members(org_id, leader_team_member_id, member_team_member_id, created_by)
              SELECT v_org_id, v_record_id, v_member, v_uid
               WHERE NOT EXISTS (
                 SELECT 1 FROM public.team_lead_members tlm
                  WHERE tlm.org_id = v_org_id
                    AND tlm.leader_team_member_id = v_record_id
                    AND tlm.member_team_member_id = v_member
               );
            END LOOP;
          END IF;
        END IF;

        v_result := jsonb_build_object(
          'client_id', v_client_id, 'status', 'applied',
          'app_record_id', v_new_id, 'revision', v_new_revision
        );
      END IF;

    ELSE
      v_auth_kind := v_existing.kind;

      IF v_kind IS DISTINCT FROM v_auth_kind
         OR v_module IS DISTINCT FROM v_existing.module
         OR v_record_id IS DISTINCT FROM v_existing.record_id THEN
        v_result := jsonb_build_object(
          'client_id', v_client_id, 'status', 'invalid',
          'reason', 'tentativa de alterar module, record_id ou kind de um registro existente'
        );

      ELSIF v_kind = 'cfg:team' AND v_member_role = 'encarregado' THEN
        SELECT EXISTS (
          SELECT 1 FROM public.team_lead_members tlm
           WHERE tlm.org_id = v_org_id
             AND tlm.leader_team_member_id = v_team_member_id
             AND tlm.member_team_member_id = v_record_id
        ) INTO v_linked;

        v_invalid_team_data :=
          NOT v_is_team_leader
          OR NOT v_linked
          OR v_deleted
          OR v_existing.data->>'created_by' IS DISTINCT FROM v_uid::text
          OR v_existing.data->>'owner_team_member_id' IS DISTINCT FROM v_team_member_id
          OR jsonb_typeof(coalesce(v_data, '{}'::jsonb)) <> 'object'
          OR (v_data->>'id') IS DISTINCT FROM v_record_id
          OR lower(btrim(coalesce(v_data->>'f',''))) <> 'repositor'
          OR coalesce((v_data->>'adm')::boolean, false)
          OR coalesce((v_data->>'l')::boolean, false)
          OR CASE WHEN jsonb_typeof(v_data->'lead') = 'array'
                  THEN jsonb_array_length(v_data->'lead') > 0
                  ELSE v_data ? 'lead' END
          OR CASE WHEN jsonb_typeof(v_data->'perm') = 'array'
                  THEN jsonb_array_length(v_data->'perm') > 0
                  ELSE v_data ? 'perm' END
          OR nullif(btrim(coalesce(v_data->>'sb_uid','')), '') IS NOT NULL;

        IF v_invalid_team_data THEN
          v_result := jsonb_build_object('client_id', v_client_id, 'status', 'forbidden', 'kind', v_kind);
        ELSIF v_base_revision IS DISTINCT FROM v_existing.revision THEN
          v_result := jsonb_build_object(
            'client_id', v_client_id, 'status', 'conflict',
            'server_revision', v_existing.revision,
            'server_data', v_existing.data,
            'server_deleted_at', v_existing.deleted_at
          );
        ELSE
          v_data := coalesce(v_data, v_existing.data) ||
            jsonb_build_object('created_by', v_uid::text, 'owner_team_member_id', v_team_member_id);

          UPDATE public.app_records
             SET data = v_data,
                 client_id = v_client_id,
                 deleted_at = NULL
           WHERE id = v_existing.id
           RETURNING revision INTO v_new_revision;

          v_result := jsonb_build_object(
            'client_id', v_client_id, 'status', 'applied',
            'app_record_id', v_existing.id, 'revision', v_new_revision
          );
        END IF;

      ELSIF NOT public.can_write_kind(v_auth_kind) THEN
        v_result := jsonb_build_object('client_id', v_client_id, 'status', 'forbidden', 'kind', v_auth_kind);

      ELSIF v_kind = 'cfg:team'
        AND coalesce(v_member_role,'') <> 'admin'
        AND (
          coalesce((v_data->>'adm')::boolean, false) IS DISTINCT FROM coalesce((v_existing.data->>'adm')::boolean, false)
          OR coalesce((v_data->>'l')::boolean, false) IS DISTINCT FROM coalesce((v_existing.data->>'l')::boolean, false)
          OR coalesce(v_data->'lead', '[]'::jsonb) IS DISTINCT FROM coalesce(v_existing.data->'lead', '[]'::jsonb)
        ) THEN
        v_result := jsonb_build_object('client_id', v_client_id, 'status', 'forbidden', 'kind', v_kind);

      ELSIF v_base_revision IS DISTINCT FROM v_existing.revision THEN
        v_result := jsonb_build_object(
          'client_id', v_client_id, 'status', 'conflict',
          'server_revision', v_existing.revision,
          'server_data', v_existing.data,
          'server_deleted_at', v_existing.deleted_at
        );

      ELSE
        IF v_kind = 'cfg:team' THEN
          v_data := coalesce(v_data, v_existing.data) ||
            jsonb_build_object('created_by', coalesce(v_data->>'created_by', v_existing.data->>'created_by', v_uid::text));
        END IF;

        UPDATE public.app_records
           SET data = coalesce(v_data, data),
               client_id = v_client_id,
               deleted_at = CASE WHEN v_deleted THEN now() ELSE NULL END
         WHERE id = v_existing.id
         RETURNING revision INTO v_new_revision;

        IF v_kind = 'cfg:team' AND coalesce(v_member_role,'') IN ('admin','gerente') THEN
          DELETE FROM public.team_lead_members
           WHERE org_id = v_org_id
             AND leader_team_member_id = v_record_id;

          IF NOT v_deleted AND jsonb_typeof(v_data->'lead') = 'array' THEN
            FOR v_member IN SELECT jsonb_array_elements_text(v_data->'lead')
            LOOP
              INSERT INTO public.team_lead_members(org_id, leader_team_member_id, member_team_member_id, created_by)
              SELECT v_org_id, v_record_id, v_member, v_uid
               WHERE NOT EXISTS (
                 SELECT 1 FROM public.team_lead_members tlm
                  WHERE tlm.org_id = v_org_id
                    AND tlm.leader_team_member_id = v_record_id
                    AND tlm.member_team_member_id = v_member
               );
            END LOOP;
          END IF;

          IF v_deleted THEN
            DELETE FROM public.team_lead_members
             WHERE org_id = v_org_id
               AND member_team_member_id = v_record_id;
          END IF;
        END IF;

        v_result := jsonb_build_object(
          'client_id', v_client_id, 'status', 'applied',
          'app_record_id', v_existing.id, 'revision', v_new_revision
        );
      END IF;
    END IF;

    INSERT INTO public.sync_ops(org_id, client_id, requested_by, module, record_id, kind, base_revision, status, result)
    VALUES (
      v_org_id, v_client_id, v_uid, v_module, v_record_id, v_kind, v_base_revision,
      v_result->>'status', v_result
    );

    v_results := v_results || jsonb_build_array(v_result);
  END LOOP;

  RETURN v_results;
END;
$function$;
