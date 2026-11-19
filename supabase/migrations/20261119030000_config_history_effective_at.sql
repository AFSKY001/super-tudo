-- Preserva a data efetiva planejada no histórico, mesmo que o cron execute segundos depois.
create or replace function public.capture_app_config_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_effective_at timestamptz;
begin
  if new.kind like 'cfg:%' then
    v_effective_at := nullif(current_setting('app.config_effective_at', true), '')::timestamptz;
    insert into public.app_config_history
      (org_id,module,record_id,kind,revision,data,deleted_at,recorded_at,effective_at,recorded_by,source)
    values
      (new.org_id,new.module,new.record_id,new.kind,new.revision,new.data,new.deleted_at,
       coalesce(new.updated_at,now()),coalesce(v_effective_at,new.updated_at,now()),
       coalesce(new.updated_by,new.created_by,auth.uid()),'live')
    on conflict (org_id,module,record_id,revision) do nothing;
  end if;
  return new;
end;
$function$;

revoke all on function public.capture_app_config_history() from public, anon, authenticated;

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
      perform set_config('app.config_effective_at', v_schedule.effective_at::text, true);
      update public.app_records
         set data = v_schedule.data,
             updated_by = v_schedule.scheduled_by
       where id = v_current.id
         and revision = v_schedule.base_revision
       returning revision into v_revision;
      perform set_config('app.config_effective_at', '', true);

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
  perform set_config('app.config_effective_at', '', true);
  return jsonb_build_object('processed', jsonb_array_length(v_results), 'results', v_results);
end;
$function$;

revoke all on function public.apply_due_app_config_schedules(uuid,uuid) from public, anon, authenticated;
grant execute on function public.apply_due_app_config_schedules(uuid,uuid) to service_role;
