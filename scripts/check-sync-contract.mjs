import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const checks = [
  ['fila local de sincronização persistida', /st_cloud_sync_v1/],
  ['salvamento local aciona a fila', /syncApplying\|\|syncQueueChanges\(\)/],
  ['fila contém identificador idempotente por operação', /'client_id':syncUuid\(\)/],
  ['envio usa RPC sync_push', /supa\['rpc'\]\('sync_push'/],
  ['recebimento usa RPC sync_pull', /supa\['rpc'\]\('sync_pull'/],
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
  ['indicador diferencia conflito de bloqueio de permissão', /some\(item=>item&&item\.status==='conflict'\)syncResolveConflictsUI/],
  ['operações recusadas não são reenviadas automaticamente', /não serão reenviados automaticamente/],
];

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
