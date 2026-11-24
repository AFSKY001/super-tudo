import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

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
const syncConcurrencyMigration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20261123165349_serialize_sync_push_per_org.sql'),
  'utf8',
);

const checks = [
  ['fila local de sincronização persistida', /st_cloud_sync_v1/],
  ['modelos de Controle de Qualidade, Prevenção e Encarregado são procurados nas duas fontes legadas', /const sources=\[\['tmod',S\.tmod\],\['routineModels',S\.routineModels\]\][\s\S]{0,500}targets\.has/],
  ['checklists auxiliares antigos ficam ocultos e não aparecem como modelos independentes', /function rotChecklistModels\(\)[\s\S]*?=>!_0x[0-9a-f]+\['p'\]&&!_0x[0-9a-f]+\['rc'\]&&!_0x[0-9a-f]+\['rm'\]/],
  ['modelo antigo só é removido depois de checklist com itens e salvamento confirmado', /if\(!converted\)return false;[\s\S]*?S\[module\]=S\[module\]\.filter[\s\S]*?if\(!save\(\)\)/],
  ['migração processa apenas modelos-alvo com atividades reconhecidas', /targets\.has\(normalize\(model\?\.n[\s\S]*?const titles=extractItems\(model\);[\s\S]*?if\(!name\|\|!titles\.length\)continue/],
  ['migração enfileira exclusão explícita na fonte correta', /syncMeta\.queue\.push\(\{key,module,record_id:modelId,kind:'r:cro',deleted:true/],
  ['migração não sobrescreve conflitos de exclusão pendentes', /if\(pending\?\.status==='conflict'\)continue/],
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
  ['ocorrências da Rotina são sincronizadas como registros idempotentes', /syncAddObject\([^;]{0,180}'routineOccurrences','r:cro'/],
  ['cliente aplica modelos, atribuições e ocorrências recebidos da nuvem', /'routineModels'!==_0x3419a0&&'routineAssignments'!==_0x3419a0[\s\S]{0,1100}'routineOccurrences'===_0x3419a0/],
  ['cliente reconhece o fluxo restrito de encarregado em cfg:team', /'encarregado'===_0xrole&&_0x3c2060\['includes'\]\('r:eqp'\)/],

  ['salvamento local aciona a fila', /syncApplying\|\|syncQueueChanges\(\)/],
  ['fila contém identificador idempotente por operação', /'client_id':syncUuid\(\)/],
  ['envio usa RPC sync_push', /supa\['rpc'\]\('sync_push'/],
  ['cliente Supabase usa fetch customizado somente para RPCs de sincronização', /global':\{'fetch':supaSyncFetch\}/],
  ['fetch customizado conta chamadas simultâneas de sync_push e sync_pull', /let syncHttpInFlight=0;const supaSyncFetch=\(input,init\)=>\{[\s\S]{0,900}syncHttpInFlight\+\+;syncStatusUpdate\(\)[\s\S]{0,500}syncHttpInFlight=Math\.max\(0,syncHttpInFlight-1\);syncStatusUpdate\(\)/],
  ['fetch customizado não intercepta login ou chamadas HTTP fora dos RPCs de sincronização', /if\(!tracked\)return fetch\(input,init\)/],
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
  ['indicador anuncia o estado por região acessível independente', /sync-status-live[\s\S]{0,180}aria-live="polite"[\s\S]{0,120}live\.textContent=label/],
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
