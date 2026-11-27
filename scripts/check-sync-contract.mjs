import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const routineSource = fs.readFileSync(path.join(root, 'routine.js'), 'utf8');

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
const syncConcurrencyMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261123165349_serialize_sync_push_per_org.sql'),
  'utf8',
);
const routinePermissionMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261126000100_routine_scoped_permissions.sql'),
  'utf8',
);
const legacyTombstoneReadMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261126123000_allow_owner_read_legacy_checklist_tombstone.sql'),
  'utf8',
);

const personalRoutineClassificationMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261126180000_reclassify_personal_routine_sync_kinds.sql'),
  'utf8',
);
const personalRoutineClassificationRollback = fs.readFileSync(
  path.join(root, 'supabase/rollback/20261126180000_undo_reclassify_personal_routine_sync_kinds.sql'),
  'utf8',
);
const personalRoutineWriteScopeMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261126193000_enforce_personal_routine_write_scope.sql'),
  'utf8',
);
const personalRoutineWriteScopeRollback = fs.readFileSync(
  path.join(root, 'supabase/rollback/20261126193000_undo_enforce_personal_routine_write_scope.sql'),
  'utf8',
);
const internalDefinerRpcMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261127110000_restrict_internal_security_definer_rpc.sql'),
  'utf8',
);
const internalDefinerRpcRollback = fs.readFileSync(
  path.join(root, 'supabase/rollback/20261127110000_undo_restrict_internal_security_definer_rpc.sql'),
  'utf8',
);

const checks = [
  ['fila local de sincronização persistida', /st_cloud_sync_v1/],
  ['modelos de Controle de Qualidade, Prevenção e Encarregado são procurados nas duas fontes legadas', /const sources=\[\['tmod',S\.tmod\],\['routineModels',S\.routineModels\]\][\s\S]{0,500}targets\.has/],
  ['checklists auxiliares antigos ficam ocultos e não aparecem como modelos independentes', /function rotChecklistModels\(\)[\s\S]*?=>!_0x[0-9a-f]+\['p'\]&&!_0x[0-9a-f]+\['rc'\]&&!_0x[0-9a-f]+\['rm'\]/],
  ['modelo antigo só é removido depois de checklist com itens e salvamento confirmado', /if\(!converted\)return false;[\s\S]*?S\[module\]=S\[module\]\.filter[\s\S]*?if\(!save\(\)\)/],
  ['migração processa apenas modelos-alvo com atividades reconhecidas', /targets\.has\(normalize\(model\?\.n[\s\S]*?const titles=extractItems\(model\);[\s\S]*?if\(!name\|\|!titles\.length\)continue/],
  ['migração não converte nem remove modelos legítimos de checklist atribuído', /const assignedChecklistModel=module==='routineModels'&&\([\s\S]{0,450}legacy-assigned-checklist-item[\s\S]{0,250}return !assignedChecklistModel&&targets\.has/],
  ['exclusão legada recusada é descartada somente quando uma exclusão autorizada mais recente existe na nuvem', /const isLegacyAssignedChecklist=op\.module==='routineModels'[\s\S]{0,700}serverConfirmsAuthorizedDeletion[\s\S]{0,400}Number\(server\.revision\)>Number\(op\.base_revision\|\|0\)[\s\S]{0,350}syncMeta\.queue=syncMeta\.queue\.filter\(item=>item!==op\)/],
  ['migração enfileira exclusão explícita na fonte correta', /syncMeta\.queue\.push\(\{key,module,record_id:modelId,kind:'r:cro',deleted:true/],
  ['migração não sobrescreve conflitos de exclusão pendentes', /if\(pending\?\.status==='conflict'\)continue/],
  ['migração legada não envia exclusão de modelos de Rotina por perfis sem gestão', /const canManageRoutineModels=\['master','admin','gerente'\]\.includes\(V\.cloudIdentity\.role\)[\s\S]{0,650}op\.deleted&&op\.status==='forbidden'[\s\S]{0,250}syncBaseline=syncRows\(S\)/],
  ['migração mantém exclusões remotas somente para Master e Gerência', /\}else\{\s*let queued=false;[\s\S]{0,1400}syncFlush\(\)\.catch/],

  ['migração transmite exclusões enfileiradas', /if\(queued\)\{syncPersist\(\);syncFlush\(\)\.catch/],
  ['migração extrai e deduplica títulos das atividades', /const extractItems=model=>[\s\S]*?const titles=extractItems\(model\);[\s\S]*?if\(!name\|\|!titles\.length\)continue/],
  ['gerador antigo não recria modelos de cronograma', /function migFix\(\)[\s\S]{0,300}fixmodels-2026[\s\S]{0,100}save\(\)/],
  ['ficha da rotina não oferece adicionar modelo antigo e mantém adicionar checklist', /function ptHTML\([\s\S]*?Nenhuma\\x20atividade\\x20nesta\\x20Rotina[\s\S]*?Adicionar\\x20checklist\\x20completo/],
  ['área de Rotinas informa que modelos antigos já foram convertidos e removidos', /modelos antigos de cronograma já foram convertidos em checklists e removidos desta área/],
  ['ficha da rotina mantém adicionar checklist completo', /function ptHTML\([\s\S]*Adicionar\\x20checklist\\x20completo/],
  ['revisão atualiza o snapshot da nuvem antes de oferecer escolhas', /async function syncResolveConflictsUI\(\)[\s\S]*?const latestRecords=await Promise\.race\([\s\S]*?keys=Object\.keys\(syncMeta\.conflicts/],
  ['falha ao atualizar a nuvem impede resolver com snapshot antigo', /catch\(error\)\{[\s\S]{0,900}nenhuma resolução foi aplicada/],
  ['RPC de sincronização exige sessão autenticada da mesma conta', /async function syncRequireSession\(\)[\s\S]{0,650}getSession\(\)[\s\S]{0,500}session\?\.user\?\.id/],
  ['envio valida sessão antes de transmitir a fila', /async function syncFlushRun\(\)[\s\S]{0,600}await syncRequireSession\(\)/],
  ['recebimento valida sessão antes de consultar a nuvem', /async function pullCloudTeamRun\(\)[\s\S]{0,350}await syncRequireSession\(\)/],
  ['logout em outra aba interrompe o canal e o temporizador de sync', /onAuthStateChange\([\s\S]{0,600}SIGNED_OUT[\s\S]{0,400}stopCloudSync\(\)/],
  ['envio e recebimento usam fila serial única sem espera circular', /function enqueueSyncOperation\([\s\S]{0,900}syncOperationQueue=run\.catch\(\(\)=>\{\}\)[\s\S]{0,1200}async function pullCloudTeam\(\)[\s\S]{0,250}enqueueSyncOperation\(\(\)=>pullCloudTeamRun\(\)\)/],
  ['revisão aguarda promessas de sincronização já iniciadas', /while\(syncBusy\|\|syncPullBusy\|\|syncFlushPromise\|\|syncPullPromise\)/],
  ['erro de envio é preservado para não anunciar sucesso falso', /syncLastError=String\(_0x2f91dd&&_0x2f91dd\.message/],
  ['falha ao atualizar a nuvem atualiza o indicador para erro', /async function runSyncStatusAction\(\)[\s\S]*?catch\(error\)\{[\s\S]{0,180}syncLastError=String\(error\?\.message/],
  ['diálogo de sincronização fica acima das camadas globais', /zIndex:'2147483001'/],
  ['revisão só confirma após fila pendente zerar', /const pending=\(syncMeta\.queue\|\|\[\]\)\.filter\(op=>!op\.status\)[\s\S]{0,700}não serão apresentadas como sincronizadas/],
  ['modelos e atribuições de Rotina entram na sincronização multiempresa', /\['routineModels','r:cro'\],\['routineAssignments','r:cro'\]/],
  ['ocorrências da Rotina são sincronizadas como registros idempotentes', /syncAddObject\([^;]{0,180}'routineOccurrences','r:rot'/],
  ['marcações pessoais usam r:rot e marcas legadas de Cronograma continuam r:cro', /function syncAddDone\(map,values\)[\s\S]{0,350}id\.split\('\|'\)\.length>=3\?'r:rot':'r:cro'[\s\S]{0,1800}syncAddDone\(_0x15b650,_0x4ebf0e\['done'\]\)/],
  ['criação repetida de ocorrência idêntica é reconhecida sem descartar diferenças de conteúdo', /function syncRoutineCreateEquivalent\(op,record,result,baseRevision\)[\s\S]{0,1000}syncCanon\(normalize\(local\)\)===syncCanon\(normalize\(server\)\)/],
  ['conflito idempotente só é resolvido automaticamente quando a base não tinha revisão e a nuvem já tem o mesmo registro', /syncRoutineCreateEquivalent\(_0x2b4c27,_0x19c7ed,_0x1134c5,_0x335e74\)[\s\S]{0,500}server_revision/],
  ['cliente aplica modelos, atribuições e ocorrências recebidos da nuvem', /'routineModels'!==_0x3419a0&&'routineAssignments'!==_0x3419a0[\s\S]{0,1100}'routineOccurrences'===_0x3419a0/],
  ['cliente reconhece o fluxo restrito de encarregado em cfg:team', /'encarregado'===_0xrole&&_0x3c2060\['includes'\]\('r:eqp'\)/],

  ['salvamento local aciona a fila', /syncApplying\|\|syncQueueChanges\(\)/],
  ['fila contém identificador idempotente por operação', /'client_id':syncUuid\(\)/],
  ['painel geral usa o núcleo de desempenho da Rotina e separa dispensadas', /function perfRoutineStats\([\s\S]{0,1800}core\.performance\(rows\)[\s\S]{0,2500}routineDismissed[\s\S]{0,1800}dispensadas \(fora do percentual\)/],
  ['envio usa RPC sync_push', /supa\['rpc'\]\('sync_push'/],
  ['cliente Supabase usa fetch customizado somente para RPCs de sincronização', /global':\{'fetch':supaSyncFetch\}/],
  ['fetch customizado conta chamadas simultâneas de sync_push e sync_pull', /let syncHttpInFlight=0;const supaSyncFetch=\(input,init\)=>\{[\s\S]{0,900}syncHttpInFlight\+\+;syncStatusUpdate\(\)[\s\S]{0,500}syncHttpInFlight=Math\.max\(0,syncHttpInFlight-1\);syncStatusUpdate\(\)/],
  ['fetch customizado não intercepta login ou chamadas HTTP fora dos RPCs de sincronização', /if\(!tracked\)return fetch\(input,init\)/],
  ['fetch customizado filtra somente as rotas RPC sync_push e sync_pull', /syncPrefix=SUPA_URL[\s\S]{0,400}sync_\(\?:push\|pull\)[\s\S]{0,100}if\(!tracked\)return fetch\(input,init\)/],
  ['recebimento usa RPC sync_pull', /supa\['rpc'\]\('sync_pull'/],
  ['sync_push usa a empresa ativa da sessão', /supa\['rpc'\]\('sync_push',\{'p_ops':\[_0x14313\],'p_org_id':V\['cloudIdentity'\]\['org_id'\]\}\)/],
  ['sync_pull usa a empresa ativa da sessão', /supa\['rpc'\]\('sync_pull',\{'p_since':null,'p_org_id':V\['cloudIdentity'\]\['org_id'\]\}\)/],
  ['controle de revisão base', /base_revision/],
  ['estado de conflito é persistido', /syncMeta\['conflicts'\]/],
  ['conflitos preservam aviso local', /syncLocalNotice\(/],
  ['retomada após evento online', /\('online',function/],
  ['estado offline é monitorado', /\('offline',syncStatusUpdate\)/],
  ['Realtime observa alterações em app_records', /postgres_changes/],
  ['evento Realtime agenda recebimento rápido sem esperar polling', /function requestRealtimeRefresh\(\)[\s\S]{0,700}setTimeout\([\s\S]{0,400},150\)/],
  ['evento recebido durante pull ativo solicita novo recebimento após a conclusão', /if\(syncPullPromise\)\{syncRealtimeRefreshAgain=true;return;\}/],
  ['pull em andamento é seguido por nova leitura quando chega evento Realtime', /if\(syncRealtimeRefreshAgain\)\{syncRealtimeRefreshAgain=false;requestRealtimeRefresh\(\);\}/],
  ['reconexão do canal Realtime consulta atualizações que possam ter sido perdidas', /if\(status==='SUBSCRIBED'\)[\s\S]{0,180}requestRealtimeRefresh\(\)/],
  ['polling de segurança está presente', /setInterval\(function[\s\S]{0,700}0x7530/],
  ['fila é impedida de enviar sem conexão', /navigator\['onLine'\]/],
  ['conflito vindo do envio guarda snapshot da nuvem', /'server_record':_0x1134c5&&null!=_0x1134c5\['server_revision'\]/],
  ['conflito vindo do recebimento guarda snapshot da nuvem', /'server_record':_0x3e9d29/],
  ['existe resolução manual de conflitos', /async function syncResolveConflictsUI\(\)/],
  ['revisão usa o retorno completo mais recente da nuvem para atualizar snapshots', /const latestRecords=await Promise\.race\([\s\S]{0,900}const latestByKey=new Map\(/],
  ['revisão não reutiliza snapshot antigo quando registro não vem na consulta', /conflict\.server_record=null;[\s\S]{0,180}refresh_error/],
  ['revisão atualiza o snapshot antes de exibir as escolhas', /syncPersist\(\);[\s\S]{0,2200}const server=conflict\?\.server_record/],
  ['leitura e envio compartilham fila serial sem dependência circular', /function enqueueSyncOperation\(operation\)[\s\S]{0,300}syncOperationQueue=run\.catch\(\(\)=>\{\}\)/],
  ['pull compartilha a promessa ativa e entra na fila serial', /async function pullCloudTeam\(\)[\s\S]{0,220}enqueueSyncOperation\(\(\)=>pullCloudTeamRun\(\)\)/],
  ['flush compartilha a promessa ativa e reenvia quando solicitado durante execução', /async function syncFlush\(\)[\s\S]{0,400}enqueueSyncOperation\(async\(\)=>[\s\S]{0,260}while\(syncFlushAgain\)/],
  ['checklists reconstroem itens da propriedade persistida i', /function ckModelItems\(model\)[\s\S]{0,220}String\(model\?\.i\|\|''\)\.split\('\|'\)/],
  ['lista de modelos não depende de l, removida do snapshot persistido', /ckModelItems\(_0x45a3e8\)\.filter\(_0x10d873=>'#'!==_0x10d873\[0x0\]\)\.length/],
  ['editor de checklist não falha quando l não foi persistida', /ckModelItems\(_0x2f793f\)\.join\('\\x0a'\)/],
  ['diálogo de conflito usa interface do aplicativo', /function syncConflictDialog\(/],
  ['diálogo de conflito dinâmico nasce visível e interativo', /function syncConflictDialog\([\s\S]{0,300}overlay\.className='ov dim open'/],
  ['progresso de sincronização dinâmico nasce visível', /function syncConflictProgress\([\s\S]{0,300}overlay\.className='ov dim open'/],
  ['comparação de versões locais e nuvem é exibida', /Comparação dos dados[\s\S]{0,1800}Neste aparelho[\s\S]{0,500}Na nuvem/],
  ['valores de conflito são renderizados como texto seguro', /textContent=syncConflictValue\(/],
  ['campos comparados são limitados para proteger a interface', /fields\.slice\(0,12\)/],
  ['manter local gera novo identificador idempotente', /pending\.client_id=syncUuid\(\)/],
  ['usar nuvem aplica a versão remota', /syncApplyRecord\(server\)/],
  ['Realtime informa o estado da inscrição', /\['subscribe'\]\(function\(status\)/],
  ['falha e recuperação do canal Realtime atualizam o estado visual', /syncRealtimeFailed=false[\s\S]{0,1000}syncRealtimeFailed=true[\s\S]{0,180}syncStatusUpdate\(\)/],
  ['sincronização rápida mantém o estado visual por pelo menos 700 ms e termina o ciclo', /const SYNC_MIN_VISIBLE_MS=700,SYNC_ROTATION_MS=800[\s\S]{0,3000}const cycleElapsed=elapsed%SYNC_ROTATION_MS,cycleWait=elapsed===0\?SYNC_ROTATION_MS:cycleElapsed===0\?0:SYNC_ROTATION_MS-cycleElapsed;[\s\S]{0,100}Math\.max\(SYNC_MIN_VISIBLE_MS-elapsed,reduced\?0:cycleWait/],
  ['indicador usa estados semânticos sincronizando, sincronizado e não sincronizado', /let state='error'[\s\S]{0,900}state='syncing'[\s\S]{0,500}state='synced'[\s\S]{0,1500}button\.dataset\.syncState=state/],
  ['estado amarelo acompanha somente operações efetivamente em execução', /const active=!!\(syncBusy\|\|syncPullBusy\|\|syncHttpInFlight>0\)/],
  ['fila pendente sem operação ativa não fica amarela', /else if\(active\)\{state='syncing'[\s\S]{0,180}else if\(syncLastError\)[\s\S]{0,120}else if\(pending\)\{label='Envio pendente/],
  ['indicador usa SVG vetorial com anel, confirmação e erro desenhados', /sync-status-icon[\s\S]{0,700}sync-ring-wrap[\s\S]{0,300}sync-check[\s\S]{0,220}sync-error-line/],
  ['confirmação e erro são desenhados por traços SVG', /sync-check[\s\S]{0,250}stroke-dashoffset:0[\s\S]{0,450}sync-error-line[\s\S]{0,180}stroke-dashoffset:0/],
  ['recebimento atualiza o indicador ao iniciar e terminar', /syncPullBusy=!0x0;syncStatusUpdate\(\);try\{[\s\S]{0,8000}finally\{syncPullBusy=!0x1;syncStatusUpdate\(\)/],
  ['falha no recebimento automático mantém o indicador em erro', /catch\(error\)\{syncLastError=String\(error&&error\.message\|\|'Falha ao receber dados da nuvem\.'\);throw error;\}finally\{syncPullBusy=!0x1;syncStatusUpdate\(\)/],
  ['indicador anuncia o estado por região acessível independente', /sync-status-live[\s\S]{0,180}aria-live="polite"[\s\S]{0,600}live\.textContent=label/],
  ['onda de sucesso mantém contorno visível sem animar sombra', /#syncStatus\.sync-complete::after\{[^}]*border:2px solid color-mix\(in srgb,var\(--sync-success-color,var\(--cor-sucesso\)\) 42%,transparent\)/],
  ['onda de sucesso usa somente escala e opacidade', /@keyframes syncStatusWave\{0%\{opacity:\.52;transform:scale\(\.72\)\}100%\{opacity:0;transform:scale\(1\.5\)\}\}/],
  ['controle de sincronização é um botão nativo acessível por teclado', /<button type="button" id="syncStatus" class="sync-status-label"[^>]*aria-label="Revisar conflitos ou atualizar sincronização"[^>]*onclick="runSyncStatusAction\(\)"/],
  ['ação direta do indicador de sincronização', /onclick="runSyncStatusAction\(\)"/],
  ['indicador de sincronização aceita toque', /#syncStatus\{[\s\S]{0,500}touch-action:manipulation/],
  ['indicador mantém formato quadrado de 44px alinhado ao botão de notificações', /#syncStatus\{[^}]*width:44px;height:44px;min-width:44px;min-height:44px;flex:0 0 44px;[^}]*border-radius:12px;/],
  ['proteção de toque preserva as dimensões de 44px do indicador', /\['width','44px'\][\s\S]{0,120}\['min-width','44px'\][\s\S]{0,120}\['height','44px'\][\s\S]{0,120}\['min-height','44px'\]/],
  ['fila bloqueada não é apresentada como envio ativo', /let state='error'[\s\S]{0,900}else if\(blocked\)\{label='Revisar envio/],
  ['há revisão específica de operações recusadas', /async function syncBlockedQueueUI\(\)/],
  ['indicador diferencia conflito de bloqueio de permissão', /some\(item=>item&&item\.status==='conflict'\)\)\s*\{\s*await syncResolveConflictsUI\(\)/],
  ['operações recusadas não são reenviadas automaticamente', /não serão reenviados automaticamente/],
  ['modelo convertido fornece a lista de itens exigida pelo renderizador', /CK\[key\]=\{\.\.\.CK\[temporary\][\s\S]{0,180}l:\[\.\.\.titles\]/],
  ['migração atualiza nome e itens dos modelos já convertidos', /if\(existing\.n!==name\)[\s\S]*?if\(existing\.i!==titles\.join\('\|'\)\)[\s\S]*?if\(!Array\.isArray\(existing\.l\)/],

  ['modelos e atribuições de Rotina são somente leitura para encarregados e funcionários', /\['routineModels','routineAssignments'\]\.includes\(_0x552b7f\.module\)&&!\['master','admin','gerente'\]\.includes\(\(V\.cloudIdentity\|\|\{\}\)\.role\)/],
  ['operações recusadas de modelos de Rotina são reconciliadas com o snapshot da nuvem antes de limpar a fila', /async function syncBlockedQueueUI\(\)[\s\S]{0,5000}supa\.rpc\('sync_pull'[\s\S]{0,3000}syncCanon\(local\.data\)!==syncCanon\(serverData\)/],
  ['aviso de envio bloqueado reaparece após consulta à nuvem', /syncBlockedNoticeShown[\s\S]{0,600}syncBlockedQueueUI\(\)/],
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

const concurrencyChecks = [
  ['migração serializa envios concorrentes por organização', syncConcurrencyMigration.includes('pg_advisory_xact_lock')],
  ['bloqueio usa chave estável derivada da organização', syncConcurrencyMigration.includes("hashtextextended(''sync_push:'' || v_org_id::text, 0)")],
  ['migração preserva a assinatura multiempresa da RPC', syncConcurrencyMigration.includes("public.sync_push(jsonb,uuid)")],
  ['migração falha se não reconhecer a estrutura ativa', syncConcurrencyMigration.includes('Não foi possível localizar o início do processamento da fila')],
  ['migração verifica o bloqueio após a substituição', syncConcurrencyMigration.includes('O bloqueio transacional de sync_push não foi instalado')],
];
const failedConcurrency = [];
for (const [label, passed] of concurrencyChecks) {
  console.log((passed ? 'PASS' : 'FAIL') + ' - ' + label);
  if (!passed) failedConcurrency.push(label);
}
if (failedConcurrency.length) {
  console.error('Falhas na proteção de concorrência: ' + failedConcurrency.join('; '));
  process.exitCode = 1;
}

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

const tombstoneMigrationChecks = [
  ['Supabase permite leitura do tombstone somente para o encarregado dono do checklist legado', /when k='r:cro'[\s\S]*?r\.module='routineModels'[\s\S]*?r\.deleted_at is not null[\s\S]*?om\.role='encarregado'[\s\S]*?substring\(p_record_id from[\s\S]*?has_perm_for_org\('r:rot',p_org_id\)[\s\S]*?has_perm_for_org\('r:eqp',p_org_id\)/i.test(legacyTombstoneReadMigration)],
  ['migration de tombstone não altera funções nem gatilhos de escrita', !/create or replace function public\.(can_write_kind_for_org|can_write_routine_record)|create trigger|update public\.app_records|insert into public\.app_records/i.test(legacyTombstoneReadMigration)],
  ['tombstone só libera confirmação sem conteúdo e mantém a regra de exclusão por revisão', /and r\.deleted_at is not null[\s\S]*?then true/i.test(legacyTombstoneReadMigration)],
];
const failedTombstoneMigration = [];
for (const [label, passed] of tombstoneMigrationChecks) {
  console.log((passed ? 'PASS' : 'FAIL') + ' - ' + label);
  if (!passed) failedTombstoneMigration.push(label);
}
if (failedTombstoneMigration.length) {
  console.error('Falhas na leitura restrita de tombstones: ' + failedTombstoneMigration.join('; '));
  process.exitCode = 1;
}

const routinePermissionChecks = [
  ['leitura da Rotina limita executor/liderança', /can_read_routine_record[\s\S]*?team_lead_members[\s\S]*?has_perm_for_org\('r:eqp'/i],
  ['gravação valida atribuição, atividade e identidade determinística', /can_write_routine_record[\s\S]*?routineAssignments[\s\S]*?routineModels[\s\S]*?p_record_id = concat/i],
  ['trigger protege gravações feitas por RPC SECURITY DEFINER', /guard_routine_app_record_write[\s\S]*?before insert or update on public\.app_records/i],
  ['leitura por tipo não chama a si própria', /create or replace function public\.can_read_kind_for_org[\s\S]*?else public\.has_perm_for_org\(k,p_org_id\)/i],
  ['tipo r:rot exige permissão específica', /when k='r:rot' then public\.has_perm_for_org\('r:rot',p_org_id\)/i],
  ['funções auxiliares não são RPC públicas', /revoke all on function public\.can_read_routine_record[\s\S]*?from public, anon, authenticated[\s\S]*?revoke all on function public\.can_write_routine_record[\s\S]*?from public, anon, authenticated[\s\S]*?revoke all on function public\.guard_routine_app_record_write[\s\S]*?from public, anon, authenticated/i],
];
const routineMigrationChecks = [
  ['migração de checklists atribuídos roda mesmo após routine-v1', routineSource.indexOf('routine-assigned-checklists-v2') >= 0 && routineSource.indexOf('routine-assigned-checklists-v2') < routineSource.indexOf("S.migrations.includes('routine-v1')")],
  ['migração de checklists atribuídos só cria ou altera modelos e atribuições com acesso de gestão', /const assignedChecklistMigration='routine-assigned-checklists-v2';[\s\S]{0,180}if\(typeof isFullAccess==='function'&&isFullAccess\(\)\)\{[\s\S]{0,700}Object\.entries\(CK\|\|\{\}\)\.forEach/.test(routineSource)],
  ['migração de checklists é reexecutável após a hidratação da nuvem', routineSource.indexOf('Object.entries(CK||{})', routineSource.indexOf('routine-assigned-checklists-v2')) < routineSource.indexOf("if(S.migrations.includes('routine-v1'))return") && source.includes("window.dispatchEvent(new Event('st:cloud-sync-ready'))")],
  ['checklists legados leem itens separados por pipe', /typeof c\?\.i==='string'\?c\.i\.split\('\|'\)/.test(routineSource)],
  ['checklists duplicados usam assinatura estável', /legacySignature:suffix/.test(routineSource)],
  ['pessoa com rotina recebe permissão de menu r:rot', /grantRoutinePermission\(pid\)/.test(routineSource)],
  ['atribuição manual também habilita o menu de Rotina', /function assign\(pid\)[\s\S]*?person\.perm\.includes\('r:rot'\)/.test(routineSource)],
  ['atividades removidas são ocultadas da lista diária sem apagar o histórico', /function list\(ids\)\{[\s\S]{0,900}o\.status==='dismissed'[\s\S]{0,500}Core\.activeOn\(assignment,day\(\)\)/.test(routineSource)],
];
const performanceFormatChecks = [
  ['pontuação de checklist aceita campo i legado', /const _0xitems=Array\.isArray\(_0x494c5c\?\.l\)&&_0x494c5c\.l\.length\?_0x494c5c\.l:String\(_0x494c5c\?\.i\|\|''\)\.split\('\|'\)/.test(source)],
  ['percentual de conclusão conta itens do campo i', /String\(model\.i \|\| ''\)\.split\('\|'\)/.test(source)],
  ['análise de falhas por setor aceita checklist legado', /_0xlegacyChecklistItems=Array\.isArray\(_0x4390cf\['l'\]\)&&_0x4390cf\['l'\]\.length\?_0x4390cf\['l'\]:String\(_0x4390cf\['i'\]\|\|''\)\.split\('\|'\)/.test(source)],
  ['conclusão do checklist é atribuída apenas ao responsável', /if \(assignedToPerson\) \{\s*total\+\+/.test(source)],
  ['qualidade do checklist é atribuída separadamente ao avaliado', /if \(evaluatedPerson && typeof sc === 'function'\)/.test(source)],
  ['flag de foto false é normalizada ao carregar checklist da nuvem', /function normalizeCkPhoto\([\s\S]*?String\(raw\)\.trim\(\)\.toLowerCase\(\)/.test(source)],
  ['checklist legado false não exige foto na pontuação', /photoFlag === true \|\| photoFlag === 1 \|\| \['true','1','sim','required','obrigatoria'\]/.test(source)],
];
const performanceIndexChecks = [
  ['qualidade dos checklists é apresentada separadamente', /function perfExtraMetricsHTML[\s\S]*?Qualidade dos checklists[\s\S]*?Rotinas atribuídas/i.test(source)],
  ['ocorrências obrigatórias da Rotina são medidas por executor e data', /function perfRoutineStats[\s\S]*?occurrence\.executorId[\s\S]*?occurrence\.date[\s\S]*?occurrence\.status !== 'dismissed'/i.test(source)],
  ['painel Desempenho apresenta métricas adicionais sem alterar perfIndex', /perfActivityHTML\([^;]+perfExtraMetricsHTML\(/.test(source) && /function perfIndex\([^}]+\}/.test(source)],
  ['índice síntese informa dimensões e escala de avaliação', /média simples das dimensões disponíveis: cronogramas, checklists completos e avaliações/.test(source)],
];
const failedPerformanceIndex = [];
for (const [label, passed] of performanceIndexChecks) {
  console.log((passed ? 'PASS' : 'FAIL') + ' - ' + label);
  if (!passed) failedPerformanceIndex.push(label);
}
if (failedPerformanceIndex.length) {
  console.error('Falhas na apresentação do Desempenho: ' + failedPerformanceIndex.join('; '));
  process.exitCode = 1;
}
const failedPerformanceFormats = [];
for (const [label, passed] of performanceFormatChecks) {
  console.log((passed ? 'PASS' : 'FAIL') + ' - ' + label);
  if (!passed) failedPerformanceFormats.push(label);
}
if (failedPerformanceFormats.length) {
  console.error('Falhas na normalização dos checklists no Desempenho: ' + failedPerformanceFormats.join('; '));
  process.exitCode = 1;
}
const failedRoutineMigration = [];
for (const [label, passed] of routineMigrationChecks) {
  console.log((passed ? 'PASS' : 'FAIL') + ' - ' + label);
  if (!passed) failedRoutineMigration.push(label);
}
if (failedRoutineMigration.length) {
  console.error('Falhas na migração de checklists atribuídos: ' + failedRoutineMigration.join('; '));
  process.exitCode = 1;
}
const failedRoutinePermissions = [];
for (const [label, pattern] of routinePermissionChecks) {
  const passed = pattern.test(routinePermissionMigration);
  console.log((passed ? 'PASS' : 'FAIL') + ' - ' + label);
  if (!passed) failedRoutinePermissions.push(label);
}
if (failedRoutinePermissions.length) {
  console.error('Falhas nas permissões específicas da Rotina: ' + failedRoutinePermissions.join('; '));
  process.exitCode = 1;
}
const personalRoutineSqlChecks = [
  ['migration reclassifica pt e done pelo identificador final de pessoa da organização', /where module = 'pt'[\s\S]{0,100}kind = 'r:cro'[\s\S]{0,350}where r\.module = 'done'[\s\S]{0,250}person\.team_member_id = split_part\(r\.record_id/, personalRoutineClassificationMigration],
  ['migration inicial já bloqueia Master/admin e limita gerente ao próprio vínculo', /me\.role not in \('master', 'admin'\)[\s\S]{0,180}public\.has_perm_for_org\('r:rot'[\s\S]{0,220}v_person_id = me\.team_member_id/, personalRoutineClassificationMigration],
  ['migration de permissões mantém Master/admin bloqueados e encarregado restrito à equipe', /me\.role not in \('master', 'admin'\)[\s\S]{0,180}public\.has_perm_for_org\('r:rot'[\s\S]{0,350}me\.role = 'encarregado'[\s\S]{0,200}public\.has_perm_for_org\('r:eqp'/, personalRoutineWriteScopeMigration],
  ['rollback da segunda migration mantém a restrição de escrita pessoal da primeira', /me\.role not in \('master', 'admin'\)[\s\S]{0,180}public\.has_perm_for_org\('r:rot'[\s\S]{0,220}v_person_id = me\.team_member_id/, personalRoutineWriteScopeRollback],
  ['rollback da classificação alerta sobre novas gravações antes de reverter os kinds', /ONLY before any new per-person pt\/done writes[\s\S]*drop trigger[\s\S]*update public\.app_records[\s\S]*kind = 'r:cro'/, personalRoutineClassificationRollback],
  ['migração de RPCs não revoga helper usado pelo Storage e rollback restaura os grants', /REVOKE EXECUTE[\s\S]{0,1800}is_org_member[\s\S]{0,300}/, internalDefinerRpcMigration],
  ['rollback de RPCs restaura execução autenticada dos helpers', /GRANT EXECUTE[\s\S]{0,1200}is_org_member/, internalDefinerRpcRollback],
];
for (const [label, pattern, target] of personalRoutineSqlChecks) {
  const passed = pattern.test(target);
  console.log((passed ? 'PASS' : 'FAIL') + ' - ' + label);
  if (!passed) process.exitCode = 1;
}



const inlineScripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
  .filter(([, attrs, body]) => !/\bsrc\s*=/.test(attrs) && body.trim());
for (let index = 0; index < inlineScripts.length; index++) {
  try {
    new Function(inlineScripts[index][2]);
    console.log('PASS - sintaxe JavaScript do script inline ' + (index + 1));
  } catch (error) {
    let location = '';
    try { parse(inlineScripts[index][2], { ecmaVersion: 'latest', sourceType: 'script' }); }
    catch (parseError) { location = parseError.loc ? ' em ' + parseError.loc.line + ':' + parseError.loc.column : ''; }
    console.error('FAIL - sintaxe JavaScript do script inline ' + (index + 1) + location + ': ' + error.message);
    process.exitCode = 1;
  }
}


const routineTaskDetailLayoutChecks = [
  ['detalhes da Rotina usam contêiner próprio de rolagem vertical', source.includes('class="rot-task-detail-scroll"') && source.includes(`return '<section class="rot-task-detail-scroll">'+_0x23fb43`)],
  ['rolagem dos detalhes respeita viewport e área segura inferior', source.includes('.rot-task-detail-scroll{') && source.includes('max-height:calc(100dvh - 176px)') && source.includes('overflow-y:auto') && source.includes('env(safe-area-inset-bottom,0px)')],
  ['blocos e etapas dos detalhes mantêm espaçamento confortável', source.includes('.rot-task-detail-scroll > .c{') && source.includes('padding:16px') && source.includes('.rot-task-detail-scroll .it{') && source.includes('margin:10px 0') && source.includes('padding:12px')],
  ['detalhes fecham o contêiner de rolagem sem alterar a conclusão da atividade', source.includes("+_0x427603(0x59a)+'</section>';}function addRotTaskPhoto")],
];
for (const [label, passed] of routineTaskDetailLayoutChecks) {
  console.log((passed ? 'PASS' : 'FAIL') + ' - ' + label);
  if (!passed) process.exitCode = 1;
}


const employeeRoutineModelChecks = [
  ['cadastro de pessoa oferece seletor de modelo e ação Adicionar', /employeeRoutineModelSelect[\s\S]{0,1200}addEmployeeRoutineModel/],
  ['seletor mantém lista removível e valores ocultos para o salvamento', /function addEmployeeRoutineModel\(\)[\s\S]{0,1800}function removeEmployeeRoutineModel[\s\S]{0,1300}input\.remove\(\)/],
  ['excluir atribuição individual desmarca o modelo e arquiva sem apagar histórico', /employee-profile-model[\s\S]{0,700}archivedAt/],
  ['salvar cadastro arquiva modelos removidos da seleção', /selectedModels=new Set\(_0x40cc98\['ckModels'\]\)[\s\S]{0,700}row\['archivedAt'\]=today\(\)/],
  ['reatribuir modelo arquivado cria novo registro e preserva o histórico anterior', /row\.mid===mid&&!row\.archivedAt[\s\S]{0,300}hadArchived[\s\S]{0,500}hadArchived\?'-'\+uid\(\)/],
];
for (const [label, pattern] of employeeRoutineModelChecks) {
  const passed = pattern.test(source);
  console.log((passed ? 'PASS' : 'FAIL') + ' - ' + label);
  if (!passed) process.exitCode = 1;
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
