import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const syncPushMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261118164535_restrict_team_member_management_to_owner.sql'),
  'utf8',
);
const tenantSyncMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261121134333_explicit_org_scoped_sync_rpcs.sql'),
  'utf8',
);
const teamReadMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261121192522_require_team_leader_permission_for_team_reads.sql'),
  'utf8',
);

const checks = [
  ['fila local de sincronização persistida', /st_cloud_sync_v1/],
  ['modelos e atribuições de Rotina entram na sincronização multiempresa', /\['routineModels','r:cro'\],\['routineAssignments','r:cro'\]/],
  ['ocorrências da Rotina são sincronizadas como registros idempotentes', /syncAddObject\([^;]{0,180}'routineOccurrences','r:cro'/],
  ['cliente aplica modelos, atribuições e ocorrências recebidos da nuvem', /'routineModels'!==_0x3419a0&&'routineAssignments'!==_0x3419a0[\s\S]{0,700}'routineOccurrences'===_0x3419a0/],
  ['cliente reconhece o fluxo restrito de encarregado em cfg:team', /'encarregado'===_0xrole&&_0x3c2060\['includes'\]\('r:eqp'\)/],

  ['salvamento local aciona a fila', /syncApplying\|\|syncQueueChanges\(\)/],
  ['fila contém identificador idempotente por operação', /'client_id':syncUuid\(\)/],
  ['envio usa RPC sync_push', /supa\['rpc'\]\('sync_push'/],
  ['recebimento usa RPC sync_pull', /supa\['rpc'\]\('sync_pull'/],
  ['sync_push usa a empresa ativa da sessão', /supa\['rpc'\]\('sync_push',\{'p_ops':\[_0x14313\],'p_org_id':V\['cloudIdentity'\]\['org_id'\]\}\)/],
  ['sync_pull usa a empresa ativa da sessão', /supa\['rpc'\]\('sync_pull',\{'p_since':null,'p_org_id':V\['cloudIdentity'\]\['org_id'\]\}\)/],
  ['controle de revisão base', /base_revision/],
  ['estado de conflito é persistido', /syncMeta\['conflicts'\]/],
  ['conflitos preservam aviso local', /syncLocalNotice\(/],
  ['retomada após evento online', /\('online',function/],
  ['estado offline é monitorado', /\('offline',syncStatusUpdate\)/],
  ['Realtime observa alterações em app_records', /postgres_changes/],
  ['polling de segurança está presente', /setInterval\(function[\s\S]{0,700}0x7530/],
  ['fila é impedida de enviar sem conexão', /navigator\['onLine'\]/],
  ['conflito vindo do envio guarda snapshot da nuvem', /'server_record':_0x1134c5&&null!=_0x1134c5\['server_revision'\]/],
  ['conflito vindo do recebimento guarda snapshot da nuvem', /'server_record':_0x3e9d29/],
  ['existe resolução manual de conflitos', /async function syncResolveConflictsUI\(\)/],
  ['atualiza snapshot remoto antes de apresentar escolha', /try\{await pullCloudTeam\(\);\}/],
  ['diálogo de conflito usa interface do aplicativo', /function syncConflictDialog\(/],
  ['comparação de versões locais e nuvem é exibida', /Comparação dos dados[\s\S]{0,1800}Neste aparelho[\s\S]{0,500}Na nuvem/],
  ['valores de conflito são renderizados como texto seguro', /textContent=syncConflictValue\(/],
  ['campos comparados são limitados para proteger a interface', /fields\.slice\(0,12\)/],
  ['manter local gera novo identificador idempotente', /pending\.client_id=syncUuid\(\)/],
  ['usar nuvem aplica a versão remota', /syncApplyRecord\(server\)/],
  ['Realtime informa o estado da inscrição', /\['subscribe'\]\(function\(status\)/],
  ['controle de sincronização é acessível por teclado', /syncStatusControl\.addEventListener\('keydown'/],
  ['fila bloqueada não é apresentada como envio ativo', /_0xblocked=\(syncMeta\['queue'\]\|\|\[\]\)\.filter/],
  ['há revisão específica de operações recusadas', /async function syncBlockedQueueUI\(\)/],
  ['indicador diferencia conflito de bloqueio de permissão', /some\(item=>item&&item\.status==='conflict'\)\)syncResolveConflictsUI/],
  ['operações recusadas não são reenviadas automaticamente', /não serão reenviados automaticamente/],
];

const permissionChecks = [
  ['RPC base exige papel encarregado e permissão r:eqp', /v_member_role\s*=\s*'encarregado'[\s\S]{0,180}public\.has_perm\('r:eqp'\)/i],
  ['criação de equipe pelo encarregado é limitada a repositor', /lower\(btrim\(coalesce\(v_data->>'f',''\)\)\)\s*<>\s*'repositor'/i],
  ['criação bloqueia elevação de administrador e líder', /coalesce\(\(v_data->>'adm'\)::boolean,\s*false\)[\s\S]{0,180}coalesce\(\(v_data->>'l'\)::boolean,\s*false\)/i],
  ['criação bloqueia permissões, liderança e vínculo de login', /v_data->'perm'[\s\S]{0,240}v_data->>'sb_uid'/i],
  ['atualização exige vínculo do encarregado com o membro', /NOT v_linked[\s\S]{0,180}owner_team_member_id/i],
  ['atualização exige autoria do encarregado e bloqueia exclusão', /NOT v_linked[\s\S]{0,260}v_deleted[\s\S]{0,260}v_existing\.data->>'created_by' IS DISTINCT FROM v_uid::text/i],
  ['RPC multiempresa recebe p_org_id explícito', /CREATE OR REPLACE FUNCTION public\.sync_push\(p_ops jsonb, p_org_id uuid\)/i],
  ['RPC multiempresa valida associação ativa na organização indicada', /om\.user_id=v_uid and om\.org_id=v_org_id and om\.active=true and pr\.active=true/i],
  ['RPC multiempresa usa autorização de escrita escopada por organização', /public\.can_write_kind_for_org\(v_kind, v_org_id\)/i],
  ['RPC multiempresa troca verificação legada de r:eqp por verificação escopada', /public\.has_perm_for_org\(''r:eqp'', v_org_id\)/i],
  ['migração de leitura exige papel encarregado e permissão r:eqp', /om\.role=''encarregado''[\s\S]{0,100}has_perm_for_org\(''r:eqp'',p_org_id\)/i],
];

const failedPermissions = [];
for (const [label, pattern] of permissionChecks) {
  const target = label.includes('migração de leitura') ? teamReadMigration : label.includes('RPC multiempresa') ? tenantSyncMigration : syncPushMigration;
  const passed = pattern.test(target);
  console.log((passed ? 'PASS' : 'FAIL') + ' - ' + label);
  if (!passed) failedPermissions.push(label);
}
if (failedPermissions.length) {
  console.error('Falhas nas proteções de permissão da sincronização: ' + failedPermissions.join('; '));
  process.exitCode = 1;
}

const inlineScripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
  .filter(([, attrs, body]) => !/\bsrc\s*=/.test(attrs) && body.trim());
for (let index = 0; index < inlineScripts.length; index++) {
  try {
    new Function(inlineScripts[index][2]);
    console.log('PASS - sintaxe JavaScript do script inline ' + (index + 1));
  } catch (error) {
    console.error('FAIL - sintaxe JavaScript do script inline ' + (index + 1) + ': ' + error.message);
    process.exitCode = 1;
  }
}

const failed = [];
for (const [label, pattern] of checks) {
  const passed = pattern.test(source);
  console.log((passed ? 'PASS' : 'FAIL') + ' - ' + label);
  if (!passed) failed.push(label);
}

if (/sync_pull',\{'p_since':null\}/.test(source)) {
  console.warn('INFO - sync_pull ainda solicita snapshot completo; sincronização incremental não foi ativada.');
}

if (failed.length) {
  console.error('Falhas no contrato de sincronização: ' + failed.join('; '));
  process.exitCode = 1;
} else {
  console.log('Contrato estático de sincronização aprovado: ' + checks.length + ' verificações, além da sintaxe dos scripts inline.');
}
