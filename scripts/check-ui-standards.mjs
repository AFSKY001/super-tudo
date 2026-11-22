import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFile(path.join(root, file), 'utf8');
const failures = [];

const [html, rules, agent, sw, packageJson, packageLock] = await Promise.all([
  read('index.html'),
  read('docs/UI-DESIGN-SYSTEM.md'),
  read('AGENTS.md'),
  read('sw.js'),
  read('package.json'),
  read('package-lock.json')
]);

const pkg = JSON.parse(packageJson);
const lock = JSON.parse(packageLock);
const sourceVersion = html.match(/const APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
const cacheVersion = sw.match(/const CACHE_NAME\s*=\s*['"]super-tudo-v([^'"]+)['"]/);

const requireCheck = (condition, message) => {
  if (!condition) failures.push(message);
};

requireCheck(/^\d+\.\d+\.\d+$/.test(String(pkg.version || '')), 'package.json must contain a semantic application version.');
requireCheck(lock.version === pkg.version && lock.packages?.['']?.version === pkg.version, 'package-lock.json root versions must match package.json.');
requireCheck(sourceVersion?.[1] === pkg.version, 'index.html APP_VERSION must match package.json.');
requireCheck(cacheVersion?.[1] === pkg.version, 'sw.js cache version must match package.json.');

const deleteAllMatch = html.match(/async function ntDeleteAll\(\)\{[\s\S]*?\}\s*function buy\(/);
requireCheck(!!deleteAllMatch && /await window\.stConfirm\(/.test(deleteAllMatch?.[0] || '') && !/\bconfirm\s*\(/.test(deleteAllMatch?.[0] || ''), 'Notification delete-all must use the internal Super Tudo confirmation dialog.');
requireCheck(/confirmText:'Excluir',cancelText:'Cancelar'/.test(deleteAllMatch?.[0] || ''), 'Notification deletion must show explicit Excluir and Cancelar labels.');
requireCheck([...html.matchAll(/>✕<\/button>/g)].length === 2 && html.includes('cfSet(') && html.includes('pdcPurchaseSet(') && html.includes('Não\\x20comprado'), 'Only the two functional X state controls may retain an X glyph; destructive actions must use text.');
requireCheck(/popup-delete-action\{min-width:88px;min-height:44px;/.test(html), 'Compact destructive actions must share the global popup delete sizing.');
requireCheck(!/'✕'/.test(html.slice(html.indexOf('const dw='), html.indexOf('function pdcStatusSymbol'))), 'Inline delete controls must use Excluir instead of the X glyph.');
const temperatureDeleteMatch = html.match(/async function delL\([^)]*\)\{[\s\S]*?\}const ckRuns=/);
requireCheck(!!temperatureDeleteMatch && /await window\.stConfirm\(/.test(temperatureDeleteMatch?.[0] || '') && !/\bconfirm\s*\(/.test(temperatureDeleteMatch?.[0] || ''), 'Temperature and shared record deletion must use the internal Super Tudo confirmation dialog.');
requireCheck(html.includes("document.addEventListener('click',event=>{if(!V.cf)return;const target=event.target instanceof Element?event.target:null;if(target?.closest('button.bt.d'))return;V.cf=null;R();})"), 'Inline delete confirmations must close when clicking outside the delete control.');
requireCheck(html.includes("if(_0x5a8d2f!==V['sg'])V['cf']=null"), 'Inline delete confirmation state must reset whenever the active screen changes.');
requireCheck(html.includes('Navegação — restaurar indicador deslizante'), 'Navigation motion restoration must be present.');
requireCheck(html.includes('st-sheet-slide-up') && html.includes('translate3d(0,100%,0)'), 'Draggable sheets must enter vertically from below without scaling.');
requireCheck(html.includes('st-sheet-slide-down') && html.includes('translate3d(0,105%,0)'), 'Draggable sheets must exit vertically downward without scaling.');
requireCheck(html.includes("host.dataset.stSheetExitMotion==='1'") && html.includes("sheet.classList.add('st-sheet-closing')"), 'Removed sheets must remain mounted briefly so their downward exit animation can finish.');

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
