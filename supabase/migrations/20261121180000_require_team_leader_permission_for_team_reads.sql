-- Keep the explicit-organization team visibility rule aligned with the legacy
-- can_access_team_member contract: only an active encarregado with r:eqp may
-- read records linked to that leader. Admins and managers retain their own path.
do $migration$
declare
  v_def text;
  v_old text;
begin
  v_def := pg_get_functiondef('public.can_read_kind_for_org(text,text,uuid)'::regprocedure);
  v_old := v_def;

  v_def := replace(
    v_def,
    'where tlm.org_id=p_org_id and tlm.member_team_member_id=p_record_id and om.user_id=auth.uid() and om.active=true and p.active=true))',
    'where tlm.org_id=p_org_id and tlm.member_team_member_id=p_record_id and om.user_id=auth.uid() and om.role=''encarregado'' and public.has_perm_for_org(''r:eqp'',p_org_id) and om.active=true and p.active=true))'
  );

  if v_def = v_old
     or position('om.role = ''encarregado''' in v_def) = 0
     or position('has_perm_for_org(''r:eqp'',p_org_id)' in v_def) = 0 then
    raise exception 'Não foi possível alinhar a leitura da equipe à permissão do encarregado.';
  end if;

  execute v_def;
end;
$migration$;
