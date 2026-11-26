-- Reconstitui atribuições legadas de Rotina que foram migradas como modelos,
-- mas não chegaram à tabela de sincronização routineAssignments.
-- A associação é inferida apenas quando o ID do modelo contém exatamente o ID
-- de um funcionário existente na configuração da mesma organização.
alter table public.app_records disable trigger app_records_guard_routine_write;

with candidates as (
  select
    m.org_id,
    m.record_id as model_id,
    t.record_id as executor_id,
    replace(m.record_id, 'legacy-assigned-checklist-', 'legacy-assigned-checklist-assignment-') as assignment_id,
    floor(extract(epoch from clock_timestamp()) * 1000)::bigint as now_ms
  from public.app_records m
  join public.app_records t
    on t.org_id = m.org_id
   and t.module = 'cfg'
   and t.deleted_at is null
   and m.record_id like 'legacy-assigned-checklist-' || t.record_id || '-%'
  where m.module = 'routineModels'
    and m.deleted_at is null
    and m.record_id like 'legacy-assigned-checklist-%'
    and jsonb_typeof(m.data->'activities') = 'array'
    and jsonb_array_length(m.data->'activities') > 0
)
insert into public.app_records (org_id, module, record_id, kind, data)
select
  c.org_id,
  'routineAssignments',
  c.assignment_id,
  'r:cro',
  jsonb_build_object(
    'id', c.assignment_id,
    'modelId', c.model_id,
    'executorId', c.executor_id,
    'from', (now() at time zone 'America/Sao_Paulo')::date::text,
    'until', null,
    'active', true,
    'source', 'legacy-assigned-checklist',
    'createdAt', c.now_ms,
    'updatedAt', c.now_ms
  )
from candidates c
where not exists (
  select 1 from public.app_records a
  where a.org_id = c.org_id
    and a.module = 'routineAssignments'
    and a.record_id = c.assignment_id
);

alter table public.app_records enable trigger app_records_guard_routine_write;
