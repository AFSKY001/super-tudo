-- Aplicação automática das mudanças programadas, mesmo sem usuário conectado.
create extension if not exists pg_cron;

alter table public.app_config_schedules
  add column if not exists applied_by uuid references auth.users(id);

create or replace function public.apply_due_app_config_schedules(p_org_id uuid, p_requested_by uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_schedule record;
  v_current public.app_records%rowtype;
  v_revision bigint;
  v_results jsonb := '[]'::jsonb;
  v_status text;
  v_reason text;
begin
  for v_schedule in
    select *
      from public.app_config_schedules
     where org_id = p_org_id
       and status = 'pending'
       and effective_at <= now()
     order by effective_at, created_at
     for update skip locked
     limit 50
  loop
    select *
      into v_current
      from public.app_records
     where org_id = p_org_id
       and module = v_schedule.module
       and record_id = v_schedule.record_id
     for update;

    if not found then
      v_status := 'conflict';
      v_reason := 'Registro não encontrado';
    elsif v_current.kind is distinct from v_schedule.kind
       or v_current.revision is distinct from v_schedule.base_revision then
      v_status := 'conflict';
      v_reason := 'Configuração mudou após o agendamento';
    else
      update public.app_records
         set data = v_schedule.data,
             updated_by = v_schedule.scheduled_by
       where id = v_current.id
         and revision = v_schedule.base_revision
       returning revision into v_revision;

      if not found then
        v_status := 'conflict';
        v_reason := 'Conflito de revisão durante a aplicação';
      else
        v_status := 'applied';
        v_reason := null;
      end if;
    end if;

    update public.app_config_schedules
       set status = v_status,
           applied_at = case when v_status = 'applied' then now() else null end,
           applied_by = case when v_status = 'applied' then p_requested_by else null end,
           result = case
             when v_status = 'applied' then jsonb_build_object('applied_revision', v_revision)
             else jsonb_build_object('reason', v_reason, 'expected_revision', v_schedule.base_revision,
               'actual_revision', case when v_current.id is not null then v_current.revision else null end)
           end
     where id = v_schedule.id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'id', v_schedule.id, 'status', v_status,
      'revision', case when v_status = 'applied' then v_revision else null end,
      'reason', v_reason
    ));
  end loop;
  return jsonb_build_object('processed', jsonb_array_length(v_results), 'results', v_results);
end;
$function$;

revoke all on function public.apply_due_app_config_schedules(uuid,uuid) from public, anon, authenticated;
grant execute on function public.apply_due_app_config_schedules(uuid,uuid) to service_role;

create or replace function public.apply_all_due_app_config_schedules()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org uuid;
  v_result jsonb;
  v_all jsonb := '[]'::jsonb;
  v_total integer := 0;
begin
  for v_org in
    select distinct org_id
      from public.app_config_schedules
     where status = 'pending'
       and effective_at <= now()
     order by org_id
  loop
    v_result := public.apply_due_app_config_schedules(v_org, null);
    v_total := v_total + coalesce((v_result->>'processed')::integer, 0);
    v_all := v_all || jsonb_build_array(jsonb_build_object('org_id', v_org, 'result', v_result));
  end loop;
  return jsonb_build_object('processed', v_total, 'organizations', v_all);
end;
$function$;

revoke all on function public.apply_all_due_app_config_schedules() from public, anon, authenticated;
grant execute on function public.apply_all_due_app_config_schedules() to service_role;

select cron.schedule(
  'super-tudo-apply-due-config-schedules',
  '* * * * *',
  'select public.apply_all_due_app_config_schedules();'
);

