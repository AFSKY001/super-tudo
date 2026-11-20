create or replace function public.sync_push(p_ops jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
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
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'não autenticado';
  end if;

  v_org_id := public.current_org_id();
  if v_org_id is null then
    raise exception 'usuário sem organização ativa';
  end if;

  if p_ops is null or jsonb_typeof(p_ops) <> 'array' then
    raise exception 'p_ops deve ser um array jsonb';
  end if;

  for v_op in select * from jsonb_array_elements(p_ops)
  loop
    v_client_id     := nullif(v_op->>'client_id','')::uuid;
    v_module        := v_op->>'module';
    v_record_id     := v_op->>'record_id';
    v_kind          := v_op->>'kind';
    v_base_revision := nullif(v_op->>'base_revision','')::bigint;
    v_data          := v_op->'data';
    v_deleted       := coalesce((v_op->>'deleted')::boolean, false);

    if v_client_id is null or v_module is null or v_record_id is null or v_kind is null then
      v_result := jsonb_build_object(
        'client_id', v_op->>'client_id',
        'status', 'invalid',
        'reason', 'client_id, module, record_id e kind são obrigatórios'
      );
      v_results := v_results || jsonb_build_array(v_result);
      continue;
    end if;

    select * into v_dup from public.sync_ops
      where org_id = v_org_id and client_id = v_client_id;
    if found then
      v_results := v_results || jsonb_build_array(v_dup.result || jsonb_build_object('duplicate', true));
      continue;
    end if;

    select * into v_existing
      from public.app_records
      where org_id = v_org_id and module = v_module and record_id = v_record_id
      for update;

    if not found then
      if v_base_revision is not null then
        v_result := jsonb_build_object(
          'client_id', v_client_id, 'status', 'conflict',
          'reason', 'base_revision informado para registro inexistente'
        );
      elsif not public.can_write_kind(v_kind) then
        v_result := jsonb_build_object('client_id', v_client_id, 'status', 'forbidden', 'kind', v_kind);
      else
        insert into public.app_records(org_id, module, record_id, kind, data, client_id)
        values (v_org_id, v_module, v_record_id, v_kind, coalesce(v_data, '{}'::jsonb), v_client_id)
        returning id, revision into v_new_id, v_new_revision;

        v_result := jsonb_build_object(
          'client_id', v_client_id, 'status', 'applied',
          'app_record_id', v_new_id, 'revision', v_new_revision
        );
      end if;
    else
      v_auth_kind := v_existing.kind;

      if v_kind is distinct from v_auth_kind
         or v_module is distinct from v_existing.module
         or v_record_id is distinct from v_existing.record_id then
        v_result := jsonb_build_object(
          'client_id', v_client_id, 'status', 'invalid',
          'reason', 'tentativa de alterar module, record_id ou kind de um registro existente'
        );
      elsif not public.can_write_kind(v_auth_kind) then
        v_result := jsonb_build_object('client_id', v_client_id, 'status', 'forbidden', 'kind', v_auth_kind);
      elsif v_base_revision is distinct from v_existing.revision then
        v_result := jsonb_build_object(
          'client_id', v_client_id, 'status', 'conflict',
          'server_revision', v_existing.revision,
          'server_data', v_existing.data,
          'server_deleted_at', v_existing.deleted_at
        );
      else
        update public.app_records
          set data = coalesce(v_data, data),
              client_id = v_client_id,
              deleted_at = case when v_deleted then now() else null end
          where id = v_existing.id
          returning revision into v_new_revision;

        v_result := jsonb_build_object(
          'client_id', v_client_id, 'status', 'applied',
          'app_record_id', v_existing.id, 'revision', v_new_revision
        );
      end if;
    end if;

    insert into public.sync_ops(org_id, client_id, requested_by, module, record_id, kind, base_revision, status, result)
    values (
      v_org_id, v_client_id, v_uid, v_module, v_record_id, v_kind, v_base_revision,
      v_result->>'status', v_result
    );

    v_results := v_results || jsonb_build_array(v_result);
  end loop;

  return v_results;
end;
$function$;

revoke all on function public.sync_push(jsonb) from public, anon;
grant execute on function public.sync_push(jsonb) to authenticated;
