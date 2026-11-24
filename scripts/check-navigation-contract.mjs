import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const includes = (value) => source.includes(value);
const sourceVersion = source.match(/const APP_VERSION='([^']+)'/);
const [versionMajor, versionMinor, versionPatch] = String(pkg.version || '').split('.').map(Number);
const previousVersion = `${versionMajor}.${versionMinor}.${Math.max(0, versionPatch - 1)}`;
const syncAction = source.slice(source.indexOf('async function runSyncStatusAction()'), source.indexOf('window.runSyncStatusAction=runSyncStatusAction;'));
const checks = [
  ['versões do aplicativo e pacote alinhadas', pkg.version === sourceVersion?.[1]],
  ['sessões autenticadas da versão anterior continuam aceitas', includes(`_0x4892f1['version']==='${previousVersion}'`)],
  ['barra usa superfície do tema, transparência e blur', includes('#nav{isolation:isolate;') && includes('background:color-mix(in srgb,var(--cd) 84%,transparent)') && includes('backdrop-filter:blur(22px)')],
  ['pílula única acompanha largura e posição da aba ativa', includes('#nav::before{') && includes('var(--st-nav-pill-width,0px)') && includes('var(--st-nav-pill-x,0px)')],
  ['rótulos têm tamanho e peso uniformes', includes('font-size:.68rem;font-weight:600') && includes('#nav button.on .nl{font-weight:600;opacity:1}')],
  ['rótulos usam reticências sem quebra', includes('text-overflow:ellipsis;white-space:nowrap')],
  ['alvos da barra têm altura mínima de 44 px', includes('#nav button{') && includes('min-height:54px')],
  ['marcação da aba usa identificador de rota e aria-current', includes('function marcarAbaAtiva(tela)') && includes('button.dataset.tela=route[1]') && includes("button.setAttribute('aria-current','page')") && includes("button.removeAttribute('aria-current')")],
  ['navegação comunica com o indicador sem referência fora de escopo', includes('window.scheduleNavIndicator=scheduleIndicator') && includes("window.scheduleNavIndicator==='function'")],
  ['teclado é detectado pelo visualViewport e alterna estado da barra', includes('function updateNavigationKeyboard()') && includes('window.innerHeight-viewport.height>150') && includes("document.documentElement.dataset.keyboard='open'") && includes("window.visualViewport.addEventListener('resize',updateNavigationKeyboard")],
  ['conteúdo reserva espaço inferior para barra e safe-area', includes('body{padding-bottom:calc(112px + env(safe-area-inset-bottom,0px))}')],
  ['estado de sincronização mantém duração mínima e velocidade configuráveis', includes('SYNC_MIN_VISIBLE_MS=700,SYNC_ROTATION_MS=800') && includes('SYNC_MIN_VISIBLE_MS-elapsed') && includes('--sync-rotation-duration')],
  ['pop e tremor possuem tempos configuráveis', includes('SYNC_POP_MS=420') && includes('SYNC_ERROR_SHAKE_MS=380') && includes('--sync-pop-duration') && includes('--sync-error-shake-duration')],
  ['movimento reduzido desativa animações do menu e sincronização', includes('@media(prefers-reduced-motion:reduce)') && includes('#syncStatus,#syncStatus .sync-status-icon') && includes('#nav,#nav::before')],
  ['fila persistente e RPCs Supabase permanecem intactas', includes('st_cloud_sync_v1') && includes("supa['rpc']('sync_push'") && includes("supa['rpc']('sync_pull'")],
  ['cliente Supabase monitora chamadas simultâneas das RPCs de sincronização', includes("'global':{'fetch':supaSyncFetch}") && includes('syncHttpInFlight>0')],
  ['ação de revisão de sincronização continua disponível', includes('async function runSyncStatusAction()') && includes('onclick="runSyncStatusAction()"')],
  ['atualização manual redesenha a tela atual após sincronização confirmada', syncAction.includes('    R();') && syncAction.indexOf('    R();') < syncAction.indexOf('Atualização concluída.')],
  ['indicador anuncia os estados por aria-live', includes('sync-status-live') && includes('aria-live="polite"') && includes('aria-atomic="true"')]
];
let failed = 0;
for (const [label, passed] of checks) {
  console.log((passed ? 'PASS' : 'FAIL') + ' - ' + label);
  if (!passed) failed++;
}
if (failed) {
  console.error('Falhas no contrato de navegação/sincronização: ' + failed);
  process.exitCode = 1;
} else {
  console.log('Contrato de navegação/sincronização aprovado: ' + checks.length + ' verificações.');
}
