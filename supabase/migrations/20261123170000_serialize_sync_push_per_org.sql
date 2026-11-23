-- Serialize sync_push transactions within one organization.
-- This closes the check-then-insert race on sync_ops(org_id, client_id)
-- and prevents concurrent first writes from racing on app_records' unique key.
-- Different organizations continue to synchronize independently.

do $migration$
declare
  v_def text;
  v_anchor text := E'  FOR v_op IN SELECT * FROM jsonb_array_elements(p_ops)\n  LOOP';
  v_replacement text;
begin
  v_def := pg_get_functiondef('public.sync_push(jsonb,uuid)'::regprocedure);

  -- Make the migration safe to re-run without stacking duplicate locks.
  if position('pg_advisory_xact_lock' in v_def) > 0 then
    return;
  end if;

  if position(v_anchor in v_def) = 0 then
    raise exception 'Não foi possível localizar o início do processamento da fila em sync_push(jsonb,uuid).';
  end if;

  v_replacement :=
    E'  PERFORM pg_catalog.pg_advisory_xact_lock(\n' ||
    E'    pg_catalog.hashtextextended(''sync_push:'' || v_org_id::text, 0)\n' ||
    E'  );\n\n' ||
    v_anchor;

  v_def := replace(v_def, v_anchor, v_replacement);
  execute v_def;

  if position(
    'pg_advisory_xact_lock' in
    pg_get_functiondef('public.sync_push(jsonb,uuid)'::regprocedure)
  ) = 0 then
    raise exception 'O bloqueio transacional de sync_push não foi instalado.';
  end if;
end;
$migration$;
