-- Agendamento de mudanças futuras de configuração.
-- A configuração vigente permanece intacta até effective_at.
create table if not exists public.app_config_schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  module text not null,
  record_id text not null,
  kind text not null check (kind like 'cfg:%'),
  base_revision bigint not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  effective_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','applying','applied','conflict','cancelled')),
  scheduled_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  result jsonb,
  constraint app_config_schedules_future_check check (effective_at > created_at)
);

create unique index if not exists app_config_schedules_one_pending_idx
  on public.app_config_schedules (org_id,module,record_id)
  where status = 'pending';

create index if not exists app_config_schedules_due_idx
  on public.app_config_schedules (effective_at)
  where status = 'pending';

alter table public.app_config_schedules enable row level security;
revoke all on table public.app_config_schedules from anon, authenticated;
grant all on table public.app_config_schedules to service_role;

comment on table public.app_config_schedules is
  'Mudanças futuras de configuração. Não alteram a configuração vigente antes de effective_at; acesso via Edge Function autenticada.';


-- Aplica em uma única transação para evitar configuração alterada com agendamento preso.
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
             updated_by = p_requested_by
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

