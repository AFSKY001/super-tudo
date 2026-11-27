import { parse } from 'acorn';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFile(path.join(root, file), 'utf8');
const failures = [];

const [html, rules, agent, sw, packageJson, packageLock, routine] = await Promise.all([
  read('index.html'),
  read('docs/UI-DESIGN-SYSTEM.md'),
  read('AGENTS.md'),
  read('sw.js'),
  read('package.json'),
  read('package-lock.json'),
  read('routine.js')
]);

const pkg = JSON.parse(packageJson);
const lock = JSON.parse(packageLock);
const sourceVersion = html.match(/const APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
const cacheVersion = sw.match(/const CACHE_NAME\s*=\s*['"]super-tudo-v([^'"]+)['"]/);

const localDateStart = html.indexOf('iso=_0x2dac08=>String(_0x2dac08.getFullYear())');
const localDateEnd = html.indexOf(',today=()=>iso(new Date())', localDateStart);
const localDateHelper = localDateStart >= 0 && localDateEnd > localDateStart ? html.slice(localDateStart, localDateEnd) : '';

const requireCheck = (condition, message) => {
  if (!condition) failures.push(message);
};

requireCheck(/^\d+\.\d+\.\d+$/.test(String(pkg.version || '')), 'package.json must contain a semantic application version.');
requireCheck(html.includes("'trf':{'n':'Transformação'") && !html.includes("'trf'!==_0x24d848") && html.includes('Restauração de Transformação de produtos'), 'Transformação must remain available in Registro > Lançamentos with its preserved form and release note.');
requireCheck(html.includes("'trf':'<path d=\"M4 7h15l-3-3m3 3-3 3M20 17H5l3 3m-3-3 3-3\"/>'"), 'Transformação must have a registered vector icon in the shared launch icon map.');
requireCheck(lock.version === pkg.version && lock.packages?.['']?.version === pkg.version, 'package-lock.json root versions must match package.json.');
requireCheck(sourceVersion?.[1] === pkg.version, 'index.html APP_VERSION must match package.json.');
requireCheck(cacheVersion?.[1] === pkg.version, 'sw.js cache version must match package.json.');
requireCheck(html.includes('<script src="/routine.js"></script>') && /'routine.js'/.test((await read('scripts/build-protected.mjs'))), 'Unified routine module must be loaded and included in the protected deployment.');
requireCheck(!routine.includes('toISOString') && routine.includes("indexedDB.open('super-tudo-routine-photos'") && routine.includes("'image/jpeg',.7") && routine.includes('900/Math.max'), 'Routine dates must stay local and proof photos must be compressed into IndexedDB.');
requireCheck(routine.includes('routine-v1') && routine.includes('routineOccurrences') && routine.includes('assignmentId') && routine.includes('updatedAt'), 'Routine migration, occurrence history, and update timestamps must be present.');
const checklistRoute = html.match(/function rRotReg\(\)\{[\s\S]{0,1200}?\}/)?.[0] || '';
requireCheck(checklistRoute.indexOf("V['ce']?rCe()") >= 0 && checklistRoute.indexOf("V['ce']?rCe()") < checklistRoute.indexOf("V['ck']"), 'Checklist model editor must take priority over a previously selected execution checklist.');
requireCheck(/V\.ck=null;V\.ckd=null;V\.rotTask=null;V\.rotTaskContext=null;V\.ce=/.test(html) && /V\.rotCkEdit=true;V\.rotInlineChecklistEdit=false;[\s\S]{0,100}R\(\)/.test(html), 'Opening a checklist model editor must clear stale execution context before rendering the editor.');

requireCheck(routine.includes('const dateValue=') && routine.includes('dayValue=v=>Core.dateValue(v)') && routine.includes('function recordDay(r){const v=r&&(r.data||r.d||r.date||r.createdAt);return Core.dateValue(v);}'), 'Routine timestamps and legacy dates must be normalized to the local calendar day.');
requireCheck(routine.includes('function readPhoto(id)') && routine.includes('function photoSheet()') && routine.includes('root.rtPhoto=viewPhoto') && routine.includes('Ver foto'), 'Routine photo evidence must be viewable from its IndexedDB photo record.');
requireCheck(routine.includes('st-check-ring') && routine.includes('personProgress=Core.progress(rows)') && routine.includes('personProgress.pct==null?\'—\':progress+\'%\''), 'Routine team view must show each person’s progress using the shared progress ring.');
requireCheck(routine.includes('uniqueName=!!name') && routine.includes('owners.some(owner=>owner.trim().toLocaleLowerCase()===name)'), 'Automatic routine completion must not match ambiguous duplicate employee names.');
requireCheck(routine.includes('a=>String(a.executorId)===pid&&Core.activeOn(a,day())') && routine.includes('Core.activeOn(a,day())))return root.stAlert(\'Esse modelo já está atribuído.\')'), 'Routine assignments must respect their from/until validity dates in the person profile and duplicate check.');

try { parse(routine,{ecmaVersion:'latest'}); new Function(routine); console.log('PASS - sintaxe do módulo externo de Rotina'); } catch (error) { failures.push('routine.js must have valid JavaScript syntax: ' + error.message + (error.loc?' at '+error.loc.line+':'+error.loc.column:'')); }
requireCheck(!!localDateHelper && localDateHelper.includes('getFullYear()') && localDateHelper.includes('getMonth()') && localDateHelper.includes('getDate()') && !localDateHelper.includes('toISOString'), 'Date-only calendar helper must use local date fields instead of UTC ISO conversion.');

const deleteAllMatch = html.match(/async function ntDeleteAll\(\)\{[\s\S]*?\}\s*function buy\(/);
requireCheck(!!deleteAllMatch && /await window\.stConfirm\(/.test(deleteAllMatch?.[0] || '') && !/\bconfirm\s*\(/.test(deleteAllMatch?.[0] || ''), 'Notification delete-all must use the internal Super Tudo confirmation dialog.');
requireCheck(/confirmText:'Excluir',cancelText:'Cancelar'/.test(deleteAllMatch?.[0] || ''), 'Notification deletion must show explicit Excluir and Cancelar labels.');
requireCheck([...html.matchAll(/>✕<\/button>/g)].length === 2 && html.includes('cfSet(') && html.includes('pdcPurchaseSet(') && html.includes('Não\\x20comprado'), 'Only the two functional X state controls may retain an X glyph; destructive actions must use text.');
requireCheck(/popup-delete-action\{min-width:88px;min-height:44px;/.test(html), 'Compact destructive actions must share the global popup delete sizing.');
requireCheck(/\.bt\.ibtn\.ibtn-del\{[^}]*width:36px;height:36px;min-width:36px;min-height:36px;max-width:36px;max-height:36px;flex:0 0 36px;padding:0;/.test(html), 'Delete icon buttons must retain a fixed square hit area and zero inherited destructive-button padding.');
requireCheck(html.includes('.st-ripple-host>:not(.st-ripple-layer):not(.sr-only):not(.notification-count){position:relative;z-index:2}'), 'Ripple positioning must not override accessible text or notification badge positioning.');
requireCheck(/#bn\{position:absolute;top:2px;right:2px;z-index:3;/.test(html), 'Notification count must remain absolutely anchored to the bell button.');
requireCheck(!html.includes("addEventListener('controllerchange'") && !html.includes('window.location.reload()') && html.includes("navigator.serviceWorker.register('/sw.js',{scope:'/'});await registration.update();"), 'Service Worker updates must not force-reload the active login or application screen.');
requireCheck(html.includes('<nav id="nav" aria-label="Navegação principal"></nav>') && html.includes('Navegação principal') && html.includes('text-overflow:ellipsis') && html.includes('data-keyboard'), 'Mobile navigation must expose an accessible label, uniform truncated tabs, and keyboard-aware visibility.');
requireCheck(html.includes('function marcarAbaAtiva(tela)') && html.includes("marcarAbaAtiva(V['tab']);"), 'Every navigation render must synchronize the active tab and sliding indicator.');
requireCheck(html.includes('font-size:11px!important;font-weight:600') && html.includes('flex:0 0 13px') && html.includes('white-space:nowrap'), 'All mobile navigation labels must share one fixed font size and weight.');
requireCheck(html.includes('background:rgba(17,24,39,.96)') && html.includes('border:1px solid #35445A') && html.includes('background:linear-gradient(135deg,#2B3A50 0%,#202C3F 100%)'), 'Mobile navigation must use the approved dark navy surface and a single rounded active pill.');
requireCheck(html.includes('sync-status-icon') && html.includes('syncRealtimeFailed') && html.includes('aria-live'), 'Sync status must use the accessible three-state vector indicator and report Realtime failure.');


const authRestoreMatch = html.match(/function watchCloudAuth\(\)[\s\S]*?watchCloudAuth\(\);/);
requireCheck(html.includes("'authChecking':!0x0,'authRestoring':!0x0"), 'Initial authentication restoration must have an explicit state flag.');
requireCheck(!!authRestoreMatch && /const restoring=V\.authRestoring/.test(authRestoreMatch?.[0] || '') && /if\(!restoring\)R\(\)/.test(authRestoreMatch?.[0] || ''), 'A SIGNED_OUT event emitted while restoring an old session must not trigger a duplicate login render.');
requireCheck(/if\(meOf\(V\['wel'\]\)\)\{V\.authRestoring=false;return void enterApp\(\);\}/.test(html) && /V\.authRestoring=false,R\(\);/.test(html), 'Authentication restoration must release its guard on both success and login fallback.');

const logoutMatch = html.match(/async function logout\(\)\{[\s\S]*?\}function rWelcome\(/);
requireCheck(!!logoutMatch && /await window\.stConfirm\('Deseja realmente sair da sua conta\?'/.test(logoutMatch?.[0] || '') && /confirmText:'Sair da conta',cancelText:'Cancelar',intent:'danger'/.test(logoutMatch?.[0] || '') && logoutMatch[0].indexOf('await window.stConfirm') < logoutMatch[0].indexOf('pushStop()'), 'Account logout must require an explicit confirmation before stopping sync or clearing the session.');
requireCheck(!/'✕'/.test(html.slice(html.indexOf('const dw='), html.indexOf('function pdcStatusSymbol'))), 'Inline delete controls must use Excluir instead of the X glyph.');
const temperatureDeleteMatch = html.match(/async function delL\([^)]*\)\{[\s\S]*?\}const ckRuns=/);
requireCheck(!!temperatureDeleteMatch && /await window\.stConfirm\(/.test(temperatureDeleteMatch?.[0] || '') && !/\bconfirm\s*\(/.test(temperatureDeleteMatch?.[0] || ''), 'Temperature and shared record deletion must use the internal Super Tudo confirmation dialog.');
requireCheck(html.includes("document.addEventListener('click',event=>{if(!V.cf)return;const target=event.target instanceof Element?event.target:null;if(target?.closest('button.bt.d'))return;V.cf=null;R();})"), 'Inline delete confirmations must close when clicking outside the delete control.');
requireCheck(html.includes("if(_0x5a8d2f!==V['sg'])V['cf']=null"), 'Inline delete confirmation state must reset whenever the active screen changes.');
requireCheck(html.includes('Navegação — restaurar indicador deslizante'), 'Navigation motion restoration must be present.');
requireCheck(html.includes('st-window-enter') && html.includes('translate3d(0,24px,0)'), 'Application windows must enter with one vertical upward movement and no scaling.');
requireCheck(html.includes('st-window-exit') && html.includes('translate3d(0,24px,0)'), 'Application windows must exit with one vertical downward movement and no scaling.');
requireCheck(html.includes("host.dataset.stWindowMotion==='1'") && html.includes("sheet.classList.add('st-sheet-closing')") && html.includes('host.appendChild(node)'), 'Removed windows must remain mounted briefly so their downward exit animation can finish.');
requireCheck(!html.includes('translateY(0) scale(1)') && !html.includes('translateY(-8px) scale(.97)'), 'Dialogs and floating menus must not use competing scale animations.');

requireCheck(html.includes('transition:transform 340ms cubic-bezier(.22,1,.36,1),width 340ms cubic-bezier(.22,1,.36,1)!important'), 'Mobile navigation indicator must slide smoothly between selected items.');
requireCheck(html.includes('background:linear-gradient(135deg,color-mix(in srgb,var(--pr) 17%,var(--cd)),color-mix(in srgb,var(--pr) 10%,var(--cd)))!important'), 'Mobile navigation indicator must use the active brand color.');
requireCheck(!html.includes('@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}'), 'Reduced-motion preferences must not globally disable all application animations.');
requireCheck(html.includes('--dur-fast:140ms;--dur:180ms;--dur-s:220ms'), 'Reduced-motion mode must shorten global motion instead of removing it.');
requireCheck(html.includes('lastTrigger=target') && html.includes('layer.dataset.position=position'), 'Internal dialogs must anchor vertically to the initiating button.');
requireCheck(html.includes('aria-label="Resposta"') && html.includes("input.setAttribute('aria-label',isInput?'Resposta':'')"), 'Prompt input must expose an accessible name.');
requireCheck(html.includes("document.body.classList.add('st-dialog-open')") && html.includes("document.body.classList.remove('st-dialog-open')") && html.includes('body.st-dialog-open{overflow:hidden;overscroll-behavior:none}'), 'Open dialogs must lock background scrolling and release it on close.');
requireCheck(html.includes(':where(input,select,textarea)[aria-invalid="true"]{') && html.includes('.field-hint{color:var(--mu)}') && html.includes('.field-error{color:var(--no);font-weight:600}'), 'Form validation must use the shared accessible invalid-field, hint and error-message styles.');
requireCheck(html.includes("document.addEventListener('invalid',event=>updateFieldError(event.target),true)") && html.includes("document.addEventListener('input',revalidate,true)") && html.includes("field.setAttribute('aria-describedby',[...described,errorId].join(' '))"), 'Native form validation must expose accessible inline errors and clear them when corrected.');
requireCheck(html.includes('align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;width:100%'), 'Internal dialog action buttons must remain centered and aligned.');

requireCheck(agent.includes('padrão global, nunca solução isolada'), 'AGENTS.md is missing the repository-wide UI rule.');
requireCheck(rules.includes('Design system global'), 'The global design system document is missing or invalid.');
requireCheck(html.includes('class="ch dashboard-edit-icon"'), 'Dashboard edit action must remain icon-only.');
requireCheck(html.includes("'rot':'<rect"), 'Registro routine menu must have its own icon.');
requireCheck(html.includes('M10 2.8h4') && html.includes('cy="11.7" r="3.1"'), 'Configuration icon must remain a recognizable gear.');


const requiredPatterns = [
  ['primary color token', /--cor-primaria\s*:\s*#0066cc/i],
  ['background token', /--fundo\s*:\s*#f5f6f8/i],
  ['dark theme tokens', /:root\[data-theme=["']dark["']\]/i],
  ['reduced-motion support', /prefers-reduced-motion\s*:\s*reduce/i],
  ['visible keyboard focus', /:focus-visible/i],
  ['global control height token', /--ui-control-height\s*:\s*42px/i],
  ['global chip height token', /--ui-chip-height\s*:\s*36px/i],
  ['global field height token', /--ui-field-height\s*:\s*44px/i],
  ['global button sizing contract', /\.bt\s*\{[^}]*min-height:\s*var\(--ui-control-height\)/s],
  ['global chip sizing contract', /\.ch\s*\{[^}]*min-height:\s*var\(--ui-chip-height\)/s],
  ['global card padding token', /--ui-card-padding\s*:\s*16px/i],
  ['global nested card padding token', /--ui-card-nested-padding\s*:\s*12px/i],
  ['global card radius token', /--ui-card-radius\s*:\s*16px/i],
  ['global card margin token', /--ui-card-margin\s*:\s*9px/i],
  ['global card shadow token', /--ui-card-shadow\s*:\s*var\(--sh1\)/i],
  ['global card surface token', /--ui-card-background\s*:\s*var\(--cd\)/i],
  ['global card sizing contract', /\.c,\s*\.page-content \.c,\s*\.dashboard-home \.c\s*\{[^}]*padding:\s*var\(--ui-card-padding\)!important/s],
['global motion feedback token', /--ui-motion-feedback\s*:\s*120ms/i],
  ['global motion state token', /--ui-motion-state\s*:\s*190ms/i],
  ['global motion enter token', /--ui-motion-enter\s*:\s*170ms/i],
  ['global navigation active indicator', /nav button\.on::after\s*\{[^}]*width:\s*18px/s],
  ['global field focus feedback', /input\[type="checkbox"\]:focus-visible[\s\S]*box-shadow:/s],
  ['global reduced-motion contract', /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*nav::before\{transition:transform 180ms ease,width 180ms ease!important\}/s],
  ['navigation compact labels', /'Painel'.*'Rotina'.*'Avaliar'.*'Progresso'.*'Equipe'.*'Registro'.*'Ajustes'/s],
  ['navigation selected pill', /nav button\.on\s*\{[^}]*background:var\(--prs\)!important/s],
  ['navigation current page semantics', /aria-current=/],
  ['gear icon with center', /'config':'<path d="M10 2\.8h4[\s\S]*<circle cx="12" cy="11\.7" r="3\.1"\/>/],
  ['route-aware scroll reset', /_0x5a8d2f=V\['sg'\][\s\S]*_0x5a8d2f!==V\['sg'\][\s\S]*scrollTop.*=0x0/s],
  ['horizontal screen transition', /st-screen-enter-forward[\s\S]*translate3d\(12px,0,0\)/],
  ['global route transition override', /#app\.an>\*\s*\{\s*animation:st-screen-enter-forward[\s\S]*#app\.an\.dl>\*\s*\{\s*animation:st-screen-enter-back/]

];

for (const [label, pattern] of requiredPatterns) {
  requireCheck(pattern.test(html), 'Global UI requirement missing: ' + label + '.');
}

const styleContent = html.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i)?.[1] || '';
const paletteStart = styleContent.indexOf('/* PALETA GLOBAL');
const scriptContent = html.slice(html.indexOf('</style>') + 8);
const semanticColorTokens = [
  '--cor-primaria:', '--cor-primaria-hover:', '--cor-primaria-suave:',
  '--cor-sucesso:', '--cor-sucesso-suave:', '--cor-alerta:', '--cor-alerta-suave:',
  '--cor-erro:', '--cor-erro-suave:', '--cor-info:', '--cor-info-suave:',
  '--fundo:', '--superficie:', '--superficie-2:', '--borda:',
  '--texto:', '--texto-suave:', '--texto-desabilitado:', '--sombra:', '--vidro:'
];
requireCheck(paletteStart >= 0 && semanticColorTokens.every(token => styleContent.slice(paletteStart).includes(token)), 'The complete semantic color-token palette must be defined centrally.');
requireCheck(paletteStart >= 0 && !/#(?:[0-9a-f]{3,8})\b/i.test(styleContent.slice(0, paletteStart)) && !/rgba?\(/i.test(styleContent.slice(0, paletteStart)), 'Component CSS must not introduce hard-coded colors outside the central palette.');
requireCheck(!/#(?:[0-9a-f]{3,8})\b/i.test(scriptContent) && !/rgba?\(/i.test(scriptContent), 'JavaScript must read interface colors from semantic CSS tokens instead of hard-coded color literals.');
requireCheck(scriptContent.includes("getPropertyValue('--cor-alerta')") && scriptContent.includes("getPropertyValue('--cor-sucesso')"), 'Dynamic synchronization status colors must be read from the global semantic tokens.');


// Detect CSS duplication only when it is provably identical in the same cascade context.
function splitCssTopLevel(source, delimiter) {
  const parts = [];
  let start = 0, quote = '', escaped = false, comment = false, parens = 0, brackets = 0;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (comment) {
      if (ch === '*' && next === '/') { comment = false; i++; }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '*') { comment = true; i++; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '(') parens++;
    else if (ch === ')') parens--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
    else if (ch === delimiter && parens === 0 && brackets === 0) {
      parts.push(source.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(source.slice(start));
  return parts;
}

function collectCssQuality(source, context = 'global', output = [], duplicateDeclarations = []) {
  let i = 0;
  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i])) i++;
    if (i >= source.length) break;
    if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2);
      i = end < 0 ? source.length : end + 2;
      continue;
    }
    const start = i;
    let quote = '', escaped = false, parens = 0, brackets = 0;
    while (i < source.length) {
      const ch = source[i], next = source[i + 1];
      if (quote) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === quote) quote = '';
        i++;
        continue;
      }
      if (ch === '/' && next === '*') {
        const end = source.indexOf('*/', i + 2);
        i = end < 0 ? source.length : end + 2;
        continue;
      }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '(') parens++;
      else if (ch === ')') parens--;
      else if (ch === '[') brackets++;
      else if (ch === ']') brackets--;
      if (parens === 0 && brackets === 0 && (ch === '{' || ch === ';')) break;
      i++;
    }
    const header = source.slice(start, i).trim();
    if (source[i] !== '{') { i++; continue; }
    const bodyStart = ++i;
    let depth = 1, innerQuote = '', innerEscaped = false, innerComment = false;
    while (i < source.length && depth > 0) {
      const ch = source[i], next = source[i + 1];
      if (innerComment) {
        if (ch === '*' && next === '/') { innerComment = false; i += 2; continue; }
        i++; continue;
      }
      if (innerQuote) {
        if (innerEscaped) innerEscaped = false;
        else if (ch === '\\') innerEscaped = true;
        else if (ch === innerQuote) innerQuote = '';
        i++; continue;
      }
      if (ch === '/' && next === '*') { innerComment = true; i += 2; continue; }
      if (ch === '"' || ch === "'") innerQuote = ch;
      else if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    const body = source.slice(bodyStart, i - 1);
    if (header.startsWith('@')) {
      collectCssQuality(body, context + ' > ' + header.replace(/\s+/g, ' '), output, duplicateDeclarations);
    } else if (header) {
      const selector = header.replace(/\s+/g, ' ');
      const normalizedBody = body.trim().replace(/\s+/g, ' ');
      output.push({ context, selector, body: normalizedBody });
      const seen = new Set();
      for (const declaration of splitCssTopLevel(body, ';')) {
        const colon = splitCssTopLevel(declaration, ':');
        if (colon.length < 2) continue;
        const property = colon.shift().trim().toLowerCase();
        const value = colon.join(':').trim().replace(/\s+/g, ' ');
        if (!property || !value) continue;
        const key = property + ':' + value;
        if (seen.has(key)) duplicateDeclarations.push(context + ' :: ' + selector + ' :: ' + key);
        seen.add(key);
      }
    }
  }
  return { rules: output, duplicateDeclarations };
}

// Structural checks: catch malformed CSS and JavaScript before packaging.
function balancedCss(source) {
  let braces = 0, parentheses = 0, brackets = 0;
  let quote = '', escaped = false, comment = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (comment) {
      if (ch === '*' && next === '/') { comment = false; i++; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '*') { comment = true; i++; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '{' && ++braces < 0) return false;
    if (ch === '}' && --braces < 0) return false;
    if (ch === '(' && ++parentheses < 0) return false;
    if (ch === ')' && --parentheses < 0) return false;
    if (ch === '[' && ++brackets < 0) return false;
    if (ch === ']' && --brackets < 0) return false;
  }
  return braces === 0 && parentheses === 0 && brackets === 0 && !quote && !comment;
}
const styleBlocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)];
requireCheck(styleBlocks.length === 1, 'Expected exactly one primary application style block.');
if (styleBlocks.length === 1) {
  requireCheck(balancedCss(styleBlocks[0][1]), 'Application CSS has unbalanced braces, brackets, parentheses, strings, or comments.');
  const emptyCssRules = styleBlocks[0][1].match(/(?:^|})\s*([^{}@][^{}]*)\{\s*\}/g) || [];
  requireCheck(emptyCssRules.length === 0, 'Empty CSS rules detected: ' + emptyCssRules.slice(0, 5).join('; ') + '.');
  const cssQuality = collectCssQuality(styleBlocks[0][1]);
  const ruleKeys = new Set();
  let duplicateRules = 0;
  for (const rule of cssQuality.rules) {
    const key = rule.context + '|' + rule.selector + '|' + rule.body;
    if (ruleKeys.has(key)) duplicateRules++;
    ruleKeys.add(key);
  }
  requireCheck(duplicateRules === 0, 'Exact duplicate CSS rules detected in the same media/theme context: ' + duplicateRules + '.');
  requireCheck(cssQuality.duplicateDeclarations.length === 0, 'Exact duplicate declarations detected inside a CSS rule: ' + cssQuality.duplicateDeclarations.slice(0, 5).join('; ') + '.');
}
const inlineScripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
  .filter(([, attrs, source]) => !/\bsrc\s*=/.test(attrs) && source.trim());
for (let i = 0; i < inlineScripts.length; i++) {
  const [, attrs, source] = inlineScripts[i];
  const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
  if (type && !['text/javascript', 'application/javascript'].includes(type)) continue;
  try { new Function(source); }
  catch (error) { failures.push('Inline JavaScript ' + (i + 1) + ' has a syntax error: ' + error.message); }
}
try { new Function(sw); }
catch (error) { failures.push('Service worker JavaScript has a syntax error: ' + error.message); }

const staticIds = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
requireCheck(new Set(staticIds).size === staticIds.length, 'Duplicate static HTML IDs detected.');
requireCheck((html.match(/function editL\s*\(/g) || []).length === 1, 'The editL action must have exactly one declaration.');
requireCheck((html.match(/function editTempRecord\s*\(/g) || []).length === 1, 'The temperature edit action must have exactly one declaration.');
requireCheck(html.includes('editTempRecord(this.dataset.id)'), 'Temperature history must call its dedicated edit action.');
const globalReducedMotionBlocks = (styleBlocks.length === 1 ? (styleBlocks[0][1].match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*:root\s*\{--dur-fast:140ms;--dur:180ms;--dur-s:220ms\}/g) || []).length : 0);
requireCheck(globalReducedMotionBlocks === 1, 'Expected exactly one shared reduced-motion token block that shortens motion without disabling all application animations.');
const cssImportantCount = styleBlocks.length === 1 ? (styleBlocks[0][1].match(/!important/g) || []).length : 0;
requireCheck(cssImportantCount <= 799, 'The global CSS !important count increased above the audited 3.73.33 baseline (799).');

// Legacy native browser dialogs are technical debt, not an approved UI pattern.
// Keep the current audited counts as hard ceilings: new code must use the
// centralized Super Tudo dialog API (stAlert, stConfirm and stPrompt).
// Lower these ceilings only after a migration removes legacy calls safely.
const legacyDialogs = {
  alert: (html.match(/\balert\s*\(/g) || []).length,
  confirm: (html.match(/\bconfirm\s*\(/g) || []).length,
  prompt: (html.match(/\bprompt\s*\(/g) || []).length
};
const ceilings = { alert: 0, confirm: 0, prompt: 0 };
requireCheck(html.includes('id="stDialogLayer"') && html.includes('data-no-protect'), 'The permanent internal dialog element and runtime bootstrap must be present.');
const inlineStyleAttributes = [...html.matchAll(/\sstyle=["'][\s\S]*?["']/g)].length;
requireCheck(inlineStyleAttributes === 0, 'Static HTML must not introduce inline style attributes; use shared CSS classes.');
requireCheck(html.includes('window.stAlert=(value,options={})=>enqueue') && html.includes('window.stConfirm=') && html.includes('window.stPrompt='), 'Internal dialog API must expose alert, confirm and prompt.');
requireCheck(html.includes('window.stAlert(') && !html.includes('window.alert=window.stAlert'), 'Application notices must call the shared dialog API directly without overriding the browser alert function.');
requireCheck(html.includes('function actionPresentation(item)') && html.includes("cancel.textContent=active.cancelText||'Cancelar'"), 'Shared dialogs must use one centralized action-label contract with a consistent Cancelar action.');
requireCheck(html.includes("label:'Cancelar mudança'") && html.includes("label:'Agendar'") && html.includes("label:'Importar'"), 'Shared confirmations must use contextual action labels for cancellation, scheduling and import operations.');
requireCheck(html.includes("['remover','Excluir']") && html.includes("['deletar','Excluir']") && html.includes("['apagar','Excluir']"), 'Destructive delete confirmations must consistently label the primary action Excluir, including remover/apagar/deletar wording.');
requireCheck(html.includes("ok.className='st-alert-ok';const requestedLabel=String(active.confirmText||'').trim()") && html.includes('ok.textContent=primaryLabel') && html.includes('#stDialogLayer .st-alert-actions > button.st-alert-ok{') && html.includes('flex:0 0 auto') && html.includes('font-size:14px'), 'The shared dialog primary action must reset its class, normalize icon-only labels and retain its full-size layout and typography on every opening.');
requireCheck(html.includes('<button type="button" class="dots notification-trigger" id="bl"') && html.includes('<button type="button" class="dots" id="dt"'), 'Static header action buttons must declare type=button and never submit a form accidentally.');
requireCheck(html.includes('#masterPortalRoot .mp-card{background:var(--ui-card-background,var(--superficie))') && html.includes('border-radius:var(--ui-card-radius,16px)'), 'Master Portal cards must reuse the global card design tokens.');
requireCheck(html.includes('#masterPortalRoot .mp-btn{display:inline-flex') && html.includes('min-height:var(--ui-control-height,44px)') && html.includes('#masterPortalRoot .mp-btn:focus-visible'), 'Master Portal buttons must share global control sizing, alignment and keyboard focus states.');
requireCheck(html.includes('#masterPortalRoot input:focus-visible,#masterPortalRoot select:focus-visible') && html.includes('border-radius:var(--ui-radius-control,10px)'), 'Master Portal fields must share global control radius and visible focus treatment.');
requireCheck(html.includes('#masterPortalRoot .mp-btn:disabled{opacity:.55;cursor:not-allowed;transform:none;box-shadow:none}'), 'Master Portal disabled actions must use a consistent non-interactive state.');
requireCheck(html.includes("const requestedLabel=String(active.confirmText||'').trim()") && html.includes("const isSymbolOnly=/^[×✕✖xX]+$/u.test(requestedLabel)") && html.includes("const primaryLabel=active.kind==='alert'?'Entendi'") && html.includes("ok.textContent=primaryLabel") && html.includes("action.intent==='danger'?'danger'"), 'Destructive confirmations must never render an X symbol as the primary action; use the contextual text label.');
requireCheck(html.includes('.st-alert-ok.is-danger{background:var(--no,var(--cor-erro));color:var(--texto-inverso);box-shadow:none}'), 'Destructive confirmation actions must use the shared destructive color token.');
requireCheck(html.includes('.launch-insight{') && html.includes('.launch-insight-grid{') && html.includes('.launch-insight-value{'), 'Contextual launch summaries must use the shared responsive insight component.');
requireCheck(html.includes('/* Contrato global de botões de ação — fonte única de aparência para .bt */'), 'The global action-button contract must remain present as the final .bt style authority.');
requireCheck(html.includes('button.bt.g,.bt.g{') && html.includes('button.bt.d,.bt.d{') && html.includes('button.bt:disabled,.bt:disabled') && html.includes('button.bt:focus-visible,.bt:focus-visible'), 'Primary, secondary, destructive, disabled and keyboard-focus button states must share the global contract.');
requireCheck(html.lastIndexOf('/* Contrato global de botões de ação — fonte única de aparência para .bt */') > html.lastIndexOf('/* Botões físicos: principal sólido, secundário contornado */'), 'The final action-button contract must override historical CSS variants without deleting contextual navigation or control styles.');
requireCheck(html.includes("const primaryLabel=active.kind==='alert'?'Entendi':(requestedLabel&&!isSymbolOnly?requestedLabel:action.label)") && html.includes("confirmText:'Excluir',cancelText:'Cancelar'"), 'Explicit textual confirmation labels must take precedence over inferred destructive labels, including notification deletion.');
requireCheck(html.includes("if(e.key==='Escape'){e.preventDefault();close(false);return;}") && html.includes('if(e.target===layer)close(false)') && html.includes("cancel.addEventListener('click',()=>close(false))"), 'Escape, backdrop and Cancelar must all resolve a confirmation as cancelled.');
requireCheck(html.includes("['danger','save','default'].includes(active.intent)") && html.includes('options.confirmText') && html.includes('options.cancelText'), 'The shared confirmation API must accept explicit intent and action labels without changing existing call sites.');
requireCheck(html.includes("if(e.key==='Tab'){const focusable=[...card.querySelectorAll(") && html.includes("!card.contains(document.activeElement)") && html.includes("last.focus();"), 'Internal dialogs must trap keyboard focus and keep Tab navigation inside the active window.');
requireCheck(html.includes('.st-alert-ok:focus-visible,.st-alert-cancel:focus-visible,.st-alert-input:focus-visible{outline:3px solid var(--ac,var(--cor-alerta));outline-offset:3px}'), 'All shared dialog actions and inputs must expose the same visible keyboard focus treatment.');
requireCheck(!html.includes('#app.an.dr>*{animation:st-screen-enter-forward 220ms var(--ui-motion-ease) both}'), 'Redundant duplicate screen-enter animation rule was reintroduced.');
requireCheck(!html.includes('.c.tap{cursor:pointer}'), 'Redundant standalone .c.tap cursor rule was reintroduced.');
requireCheck(!html.includes('.g2>.c{margin:0!important}') && !html.includes('.g2>.c{margin:0}'), 'Redundant standalone .g2 card margin overrides were reintroduced.');
requireCheck(!html.includes('input[type="checkbox"],input[type="radio"]{accent-color:var(--pr)}'), 'Redundant standalone checkbox/radio accent rule was reintroduced.');
requireCheck(html.includes('textarea{min-height:96px}') && !html.includes('textarea{min-height:96px;resize:vertical}'), 'Textarea resize behavior must remain inherited from its shared base rule.');
requireCheck(!html.includes('.bt.g{color:var(--tx);box-shadow:var(--sh1)}'), 'Redundant secondary-button text color override was reintroduced.');
requireCheck(!html.includes('.bt.d{color:var(--no);box-shadow:none}'), 'Redundant destructive-button text color override was reintroduced.');
requireCheck(!html.includes('font:14px var(--fn);color:var(--tx);box-shadow:none'), 'Redundant form-field text color override was reintroduced.');
requireCheck(!html.includes('.chs{\\n  display:flex;\\n  align-items:center;'), 'Redundant filter-row display declaration was reintroduced.');
requireCheck(!html.includes('.b.ok{color:var(--ok)}') && !html.includes('.b.no{color:var(--no)}') && !html.includes('.b.wa{color:var(--wa)}'), 'Duplicate badge status colors were reintroduced.');
requireCheck(!html.includes('.chs{scrollbar-width:none}'), 'Duplicate filter scrollbar declaration was reintroduced.');
requireCheck(!html.includes('details{padding:10px 12px}'), 'Duplicate details padding rule was reintroduced.');
requireCheck(!html.includes('.ic{flex:0 0 auto}'), 'Duplicate icon flex rule was reintroduced.');
requireCheck(!html.includes('.mu{color:var(--mu);font-size:13px}'), 'Duplicate muted text color declaration was reintroduced.');
requireCheck(!html.includes('.day.on{background:var(--pr);color:var(--on)}'), 'Duplicate selected-day state rule was reintroduced.');
requireCheck(!html.includes('.ch{border:1px solid var(--bd);background:var(--cd);color:var(--tx);border-radius:99px;padding:6px 12px;font:13px system-ui;white-space:nowrap}'), 'Duplicate chip background rule was reintroduced.');





requireCheck(html.includes('function launchFunctionSummary(key,rows)') && html.includes("launchFunctionSummary(V['reg'],_0x99ff35)"), 'Each launch function must render its own data-driven summary below its primary action card.');
requireCheck(html.includes('Resumo das temperaturas') && html.includes('Medições encontradas') && html.includes('Equipamentos medidos'), 'Temperature launch must expose its own filtered summary.');
requireCheck(!html.includes('Painel compacto e contextual para cada tela do menu Registro/Lançamentos') && !html.includes('setInterval(schedule,1800)'), 'The ineffective generic launch summary observer must not be present.');
const sheetControllerStart = html.lastIndexOf('/* Controlador global de janelas: entrada/saída preservadas e arraste físico único. */');
const sheetController = sheetControllerStart >= 0 ? html.slice(sheetControllerStart) : '';
requireCheck((html.match(/Controlador global de janelas: entrada\/saída preservadas e arraste físico único/g) || []).length === 1, 'Exactly one global sheet controller must exist.');
requireCheck(!sheetController.includes("handle.addEventListener('pointerdown'") && !sheetController.includes("handle.addEventListener('pointermove'"), 'Sheet handles must not own duplicated pointer listeners.');
requireCheck(sheetController.includes("document.addEventListener('pointerdown',pointerDown,true)") && sheetController.includes("document.addEventListener('pointermove',pointerMove,{capture:true,passive:false})") && sheetController.includes("document.addEventListener('pointerup',event=>finish(event,false),true)"), 'Sheet gestures must use delegated Pointer Events.');
requireCheck(sheetController.includes('setPointerCapture(event.pointerId)') && sheetController.includes('requestAnimationFrame(tick)') && sheetController.includes('VELOCITY_WINDOW_MS:100'), 'Sheet drag must capture the pointer, sample recent velocity and animate with requestAnimationFrame.');
requireCheck(sheetController.includes('RUBBER_MAX:140') && sheetController.includes('CLOSE_DIST:.30') && sheetController.includes('CLOSE_VEL:600') && sheetController.includes('SPRING_BOUNCE') && sheetController.includes('SPRING_CLOSE'), 'Sheet physics thresholds and spring presets must remain centralized.');
requireCheck(sheetController.includes("setAttribute('data-sheet','')") && sheetController.includes("setAttribute('data-sheet-handle','')") && sheetController.includes("setAttribute('data-sheet-overlay','')"), 'Sheets, handles and overlays must expose shared data attributes.');
requireCheck(html.includes('height:44px;') && html.includes('.sheet{display:flex;flex-direction:column;box-sizing:border-box;height:auto;overflow:hidden;transition:max-height 260ms cubic-bezier(.22,1,.36,1)}') && html.includes('.sheet-body{flex:1 1 auto;min-height:0;overflow-x:hidden;overflow-y:auto;') && html.includes('--extra:var(--sheet-extra,220px)') && html.includes('RUBBER_MAX:140'), 'Sheet handle, scroll body and extra bottom space must preserve layout during upward drag.');
requireCheck(html.includes('max-height:calc(50svh + var(--extra))') && html.includes('.sheet.st-sheet-expanded{max-height:calc(88vh + var(--extra));max-height:calc(88svh + var(--extra))}'), 'Todas as janelas devem abrir com limite de metade da tela e expandir até o limite superior.');
requireCheck(sheetController.includes("state.y< -48") && sheetController.includes("state.sheet.classList.add('st-sheet-expanded')") && sheetController.includes("state.sheet.classList.remove('st-sheet-expanded')"), 'Arrastar a alça para cima expande a janela e arrastar para baixo recolhe sem perder a rolagem.');
const anchoredDrag=sheetController.slice(sheetController.indexOf('if((!drag.expanded&&delta<0)'),sheetController.indexOf('}else if(!drag.expanded&&delta>=0)'));
requireCheck(anchoredDrag.includes("drag.sheet.style.maxHeight=") && anchoredDrag.includes("drag.sheet.style.transform='translate3d(0,0,0)'") && !anchoredDrag.includes('render(') && sheetController.includes("const expand=!cancelled&&!state.expanded&&state.y< -48") && sheetController.includes("const collapse=!cancelled&&state.expanded&&state.y>48"), 'Arrastar para cima deve aumentar a altura mantendo a borda inferior fixa, sem deslocar o painel inteiro.');
requireCheck(html.includes('var(--st-window-exit-from,translate3d(0,0,0))') && html.includes('@property --p{syntax:"<number>";inherits:false;initial-value:0}') && html.includes('backdrop-filter:blur(calc(var(--p) * 12px))'), 'Overlay opacity and blur must share the registered --p progress variable.');
requireCheck(sheetController.includes("matchMedia('(prefers-reduced-motion: reduce)')") && sheetController.includes("document.addEventListener('pointercancel'"), 'Reduced-motion preference and pointer cancellation must be handled.');
requireCheck(sheetController.includes('EXTRA_SPACE:220') && sheetController.includes("sheet.dataset.sheetDismissed='1'") && sheetController.includes("V.sh=0;rMenu()"), 'Dragged sheets must close synchronously after reaching the off-screen position.');
requireCheck(sheetController.includes("sheet.querySelector(':scope > .sheet-body')") && sheetController.includes("body.className='sheet-body'") && sheetController.includes("overlay.classList.add('dragging')"), 'The global controller must create one scroll body and synchronize overlay motion.');
requireCheck(!html.includes('function handleSheet(s)') && !html.includes("handle.addEventListener('pointerdown'") && !html.includes('.st-sheet-underfill{'), 'Legacy per-handle drag listeners and obsolete underfill CSS must be removed.');

const migrationStart=html.indexOf('function migrateCronogramaModelsToChecklists(){');
const migrationEnd=html.indexOf('function rRotChecklistHub(){',migrationStart);
const migrationSource=migrationStart>=0&&migrationEnd>migrationStart?html.slice(migrationStart,migrationEnd):'';
requireCheck(!!migrationSource, 'Cronograma-to-checklist migration must be present before the checklist hub.');
const routinesRouteStart=html.indexOf('function rRotReg(){');
const routinesRouteEnd=html.indexOf('function rCroReg()',routinesRouteStart);
const routinesRoute=routinesRouteStart>=0&&routinesRouteEnd>routinesRouteStart?html.slice(routinesRouteStart,routinesRouteEnd):'';
requireCheck(routinesRoute.includes('migrateCronogramaModelsToChecklists()')&&routinesRoute.includes('rRotChecklistHub()')&&routinesRoute.includes('Modelos de checklist')&&!routinesRoute.includes('tmList()')&&!routinesRoute.includes('tmEditor()'), 'Rotinas must expose checklist models and hide the old cronograma template editor/list.');
requireCheck(html.includes("if(!syncPersist())throw new Error(syncLastError||'Não foi possível persistir os dados recebidos da nuvem.');syncBaseline=syncRows(S);syncReady=!0x0;migrateCronogramaModelsToChecklists();window.__ST_CLOUD_SYNC_READY__=true;window.dispatchEvent(new Event('st:cloud-sync-ready'));return _0x32cd9d;"), 'Cronograma migration must run again after the pulled snapshot is persisted and sync is ready.');
requireCheck(!html.includes('function exportTempRecovery(){')&&!html.includes('Importar JSON')&&!html.includes('Exportar JSON'), 'Obsolete JSON recovery import/export controls must not be present.');
requireCheck(!html.includes('function tmList()')&&!html.includes('function tmOpen(')&&!html.includes('function tmRead(')&&!html.includes('function tmSave(')&&!html.includes('function tmEditor()'), 'Legacy cronograma list and editor code must be removed after conversion.');
requireCheck(!routine.includes('Importar backup JSON')&&!routine.includes('Exportar Rotinas + fotos')&&!routine.includes('super-tudo-routine-backup')&&!routine.includes('function exportBackup()')&&!routine.includes('function importBackup(')&&!routine.includes('root.rtExport=')&&!routine.includes('root.rtImport=')&&!routine.includes('Core.merge'), 'Routine JSON backup import/export UI and dead implementation must be removed without affecting internal JSON serialization.');
requireCheck(routine.includes('Core.legacyWeekdays')&&routine.includes('map(day=>(day+1)%7)'), 'Legacy Monday-first schedule days must be mapped to calendar weekdays correctly.');
try {
  const fixtureModels=[
    {id:'tm-quality',n:'Controle de Qualidade',items:[
      {id:'q1',t:'Conferir temperatura dos equipamentos',days:[1,2,3],time:'07:00',desc:'Não deve ser importada'},
      {id:'q2',t:'Verificar validade dos produtos',days:[1,4],time:'08:00'},
      {id:'q3',t:'Conferir temperatura dos equipamentos',days:[5],time:'09:00'}
    ]},
    {id:'tm-prevention',n:'Prevenção',items:[
      {id:'p1',t:'Auditar pontos de risco',days:[1,2],time:'10:00'},
      {id:'p2',t:'Verificar registros de perdas',days:[3,4],time:'11:00'}
    ]}
  ];
  const fixtureRoutineModels=[
    {id:'tm-leader',name:'Encarregado',activities:[{id:'l1',title:'Acompanhar execução dos setores'},{id:'l2',title:'Conferir pendências do dia'}]}
  ];
  const fixtureCK={
    'c-manual':{n:'Gerente',i:'Conferir abertura|Conferir equipe',l:['Conferir abertura','Conferir equipe']},
    'c-old-generated':{n:'Controle de Qualidade — atividade antiga',i:'Atividade antiga',l:['Atividade antiga'],source:'cronograma-conversion',rm:true,legacyCronogramaId:'tm-quality',legacyCronogramaItemId:'q1'}
  };
  const fixtureState={tmod:fixtureModels,routineModels:fixtureRoutineModels,migrations:['cronogramas-para-checklists-v2']};
  const fixtureSyncMeta={queue:[],revisions:{}};
  const fixtureV={};
  let fixtureSaves=0,fixtureIds=0;
  const fixtureLz=()=>Object.values(fixtureCK).forEach(model=>{if(typeof model.i==='string')model.l=model.i.split('|');});
  const fixtureSave=()=>{fixtureSaves++;return true;};
  const fixtureCreate=(name,parent,items,photo,kind,shifts,available)=>{
    const id='c-fixture-'+(++fixtureIds);
    fixtureCK[id]={n:name,e:'☑️',i:items.join('|'),p:parent,k:kind,ph:false,m:'routine-inline'};
    return id;
  };
  const runMigration=new Function('S','CK','lz','save','createChecklistFromSteps','syncReady','V','syncMeta','syncPersist','syncFlush','syncUuid',migrationSource+';return migrateCronogramaModelsToChecklists;');
  const migrate=runMigration(fixtureState,fixtureCK,fixtureLz,fixtureSave,fixtureCreate,false,fixtureV,fixtureSyncMeta,()=>{},async()=>{},()=> 'fixture-uuid');
  const firstRun=migrate();
  const secondRun=migrate();
  const quality=fixtureCK['c-cronograma-model-tm-quality'];
  const prevention=fixtureCK['c-cronograma-model-tm-prevention'];
  const leader=fixtureCK['c-cronograma-model-tm-leader'];
  requireCheck(firstRun===true&&secondRun===false&&fixtureSaves===1, 'Migration must convert all three target templates once and persist atomically.');
  requireCheck(!!quality&&!!prevention&&!!leader, 'Quality, prevention and supervisor templates must each become one checklist.');
  requireCheck(quality?.n==='Controle de Qualidade'&&prevention?.n==='Prevenção'&&leader?.n==='Encarregado', 'Converted checklist models must retain the exact original template names.');
  requireCheck(JSON.stringify(quality?.l)===JSON.stringify(['Conferir temperatura dos equipamentos','Verificar validade dos produtos']), 'Quality activities must become unique checklist items without schedule metadata.');
  requireCheck(JSON.stringify(prevention?.l)===JSON.stringify(['Auditar pontos de risco','Verificar registros de perdas']), 'Prevention activities must become checklist items.');
  requireCheck(JSON.stringify(leader?.l)===JSON.stringify(['Acompanhar execução dos setores','Conferir pendências do dia']), 'Supervisor activities stored in routineModels must also be converted.');
  requireCheck(quality?.p===''&&quality?.k==='Rotina diária'&&quality?.m==='routine-inline', 'Converted models must use the existing checklist model schema.');
  requireCheck(!!fixtureCK['c-manual']&&fixtureCK['c-manual'].n==='Gerente', 'Existing manual checklist templates must remain unchanged.');
  requireCheck(!fixtureCK['c-old-generated'], 'Obsolete automatic per-activity artifacts must be removed only after consolidated checklists exist.');
  requireCheck(fixtureState.tmod.length===0&&fixtureState.routineModels.length===0&&fixtureState.migrations.includes('cronogramas-para-checklists-v11'), 'All three source schedule templates must be removed only after conversion and migration marker persisted.');
} catch(error) {
  failures.push('Cronograma migration fixture test failed: '+error.message);
}


// Contrato global dos campos: preservar o padrão existente sem depender de tokens de branches antigas.
const fieldStyleStart = html.indexOf('/* Campos maiores, foco suave e leitura confortável */');
const fieldStyleEnd = html.indexOf('/* Janelas, submenus e bottom sheets */', fieldStyleStart);
const fieldStyle = fieldStyleStart >= 0 && fieldStyleEnd > fieldStyleStart ? html.slice(fieldStyleStart, fieldStyleEnd) : '';
requireCheck(fieldStyle.includes('min-height:44px') &&
  fieldStyle.includes('border:1px solid var(--bd)') &&
  fieldStyle.includes('background:var(--cd)') &&
  fieldStyle.includes('color:var(--tx)') &&
  fieldStyle.includes('border-radius:var(--ui-radius-control)'),
  'Text fields, selects and textareas must share the 44px global field contract and semantic theme tokens.');
requireCheck(fieldStyle.includes('border-color:var(--pr)') && fieldStyle.includes('box-shadow:var(--ui-focus)'),
  'Focused editable fields must use the global primary border and focus halo.');
requireCheck(html.includes('button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{') &&
  html.includes('outline:2px solid var(--vi)'),
  'Keyboard focus must remain visible on buttons and form controls.');
requireCheck(html.includes(':where(input,select,textarea)[aria-invalid="true"]{') &&
  html.includes('.field-error{color:var(--no);font-weight:600}'),
  'Invalid fields must retain the shared accessible error state.');
requireCheck(!html.includes('--borda-controle'),
  'Do not reintroduce the obsolete --borda-controle token from the historical branch.');
requireCheck(rules.includes('## 15. Contrato global de campos e foco') &&
  rules.includes('versão 3.74.88'),
  'The design-system document must describe the current field contract and current app baseline.');


const navStart = html.indexOf('/* Navegação inferior — vidro do tema');
const navEnd = html.indexOf('/* Detalhes da Rotina', navStart);
const navStyles = navStart >= 0 && navEnd > navStart ? html.slice(navStart, navEnd) : '';
requireCheck(navStyles.includes('background:rgba(17,24,39,.96)') && navStyles.includes('border:1px solid #35445A'),
  'The mobile bottom navigation must keep its dark navy surface and border in both light and dark app themes.');
requireCheck(navStyles.includes('#nav button.on,#nav button.on:hover{background:transparent!important') &&
  navStyles.includes('#nav::before') && navStyles.includes('background:linear-gradient(135deg,#2B3A50 0%,#202C3F 100%)'),
  'The active navigation item must use the shared rounded navy pill, never an individual square button background.');
requireCheck(navStyles.includes('font-size:11px!important') && navStyles.includes('flex:0 0 13px') &&
  navStyles.includes('white-space:nowrap') && navStyles.includes('text-overflow:clip'),
  'All bottom navigation labels, including Ajustes, must keep the same fixed readable font size without shrinking.');

for (const name of Object.keys(ceilings)) {
  requireCheck(
    legacyDialogs[name] <= ceilings[name],
    'New native ' + name + '() usage detected: ' + legacyDialogs[name] + ' exceeds audited baseline ' + ceilings[name] + '.'
  );
}

if (failures.length) {
  console.error('Super Tudo UI standards check failed:');
  for (const failure of failures) console.error('- ' + failure);
  process.exitCode = 1;
} else {
  console.log('Super Tudo UI standards check passed.');
  console.log('Legacy native dialogs (must not increase): ' + JSON.stringify(legacyDialogs));
}
