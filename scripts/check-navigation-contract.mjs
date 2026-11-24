import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const checks = [
  ['versões do aplicativo e pacote alinhadas', pkg.version === '3.74.78' && /const APP_VERSION='3\\.74\\.78'/.test(source)],
  ['barra usa superfície e borda do tema com transparência e blur', /#nav\\{[^}]*background:color-mix\\(in srgb,var\\(--cd\\) 84%,transparent\\)[^}]*backdrop-filter:blur\\(22px\\)/.test(source)],
  ['pílula única acompanha largura e posição da aba ativa', /#nav::before\\{[^}]*var\\(--st-nav-pill-width,0px\\)[^}]*var\\(--st-nav-pill-x,0px\\)/.test(source)],
  ['rótulos têm tamanho e peso uniformes', /#nav button \\.nl\\{[^}]*font-size:\\.68rem[^}]*font-weight:600/.test(source) && /#nav button\\.on \\.nl\\{font-weight:600/.test(source)],
  ['rótulos usam reticências sem quebra', /#nav button \\.nl\\{[^}]*text-overflow:ellipsis[^}]*white-space:nowrap/.test(source)],
  ['alvos da barra têm altura mínima de 44 px', /#nav button\\{[^}]*min-height:54px/.test(source)],
  ['marcação da aba usa identificador de rota e aria-current', /function marcarAbaAtiva\\(tela\\)[\\s\\S]*?button\\.dataset\\.tela=route\\[1\\][\\s\\S]*?button\\.setAttribute\\('aria-current','page'\\)[\\s\\S]*?button\\.removeAttribute\\('aria-current'\\)/.test(source)],
  ['navegação comunica com o indicador sem referência fora de escopo', /window\\.scheduleNavIndicator=scheduleIndicator/.test(source) && /window\\.scheduleNavIndicator==='function'/.test(source)],
  ['teclado é detectado pelo visualViewport e alterna estado da barra', /function updateNavigationKeyboard\\(\\)[\\s\\S]*?window\\.innerHeight-viewport\\.height>150[\\s\\S]*?dataset\\.keyboard='open'/.test(source) && /visualViewport\\.addEventListener\\('resize',updateNavigationKeyboard/.test(source)],
  ['conteúdo reserva espaço inferior para barra e safe-area', /body\\{padding-bottom:calc\\(112px \\+ env\\(safe-area-inset-bottom,0px\\)\\)\\}/.test(source)],
  ['estado de sincronização mantém duração mínima e velocidade configuráveis', /SYNC_MIN_VISIBLE_MS=700,SYNC_ROTATION_MS=800/.test(source) && /SYNC_MIN_VISIBLE_MS-elapsed/.test(source) && /--sync-rotation-duration/.test(source)],
  ['pop e tremor possuem tempos configuráveis', /SYNC_POP_MS=420/.test(source) && /SYNC_ERROR_SHAKE_MS=380/.test(source) && /--sync-pop-duration/.test(source) && /--sync-error-shake-duration/.test(source)],
  ['movimento reduzido desativa animações do menu e sincronização', /prefers-reduced-motion:reduce[^}]*#syncStatus/.test(source) && /prefers-reduced-motion:reduce[^}]*#nav/.test(source)],
  ['fila persistente e RPCs Supabase permanecem intactas', source.includes('st_cloud_sync_v1') && source.includes("supa['rpc']('sync_push'") && source.includes("supa['rpc']('sync_pull'")],
  ['ação de revisão de sincronização continua disponível', source.includes('async function runSyncStatusAction()') && source.includes('onclick="runSyncStatusAction()"')],
  ['indicador anuncia os estados por aria-live', source.includes("button.setAttribute('aria-live','polite')") && source.includes("button.setAttribute('aria-atomic','true')")]
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
