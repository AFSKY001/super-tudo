import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFile(path.join(root, file), 'utf8');
const failures = [];

const [html, rules, agent, sw] = await Promise.all([
  read('index.html'),
  read('docs/UI-DESIGN-SYSTEM.md'),
  read('AGENTS.md'),
  read('sw.js')
]);

const requireCheck = (condition, message) => {
  if (!condition) failures.push(message);
};

requireCheck(agent.includes('padrão global, nunca solução isolada'), 'AGENTS.md is missing the repository-wide UI rule.');
requireCheck(rules.includes('Design system global'), 'The global design system document is missing or invalid.');
requireCheck(html.includes('class="ch dashboard-edit-icon"'), 'Dashboard edit action must remain icon-only.');
requireCheck(html.includes("'rot':'<rect"), 'Registro routine menu must have its own icon.');
requireCheck(html.includes('M10 2.8h4') && html.includes('cy="11.7" r="3.1"'), 'Configuration icon must remain a recognizable gear.');


const requiredPatterns = [
  ['primary color token', /--pr\s*:\s*#2457e6/i],
  ['background token', /--bg\s*:\s*#f5f6f9/i],
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
  ['global motion enter token', /--ui-motion-enter\s*:\s*250ms/i],
  ['global navigation active indicator', /nav button\.on::after\s*\{[^}]*width:\s*18px/s],
  ['global field focus feedback', /input\[type="checkbox"\]:focus-visible[\s\S]*box-shadow:/s],
  ['global reduced-motion contract', /prefers-reduced-motion\s*:\s*reduce[\s\S]*nav button::after\{display:none!important\}/s],
  ['navigation compact labels', /'Painel'.*'Rotina'.*'Avaliar'.*'Progresso'.*'Equipe'.*'Registro'.*'Ajustes'/s],
  ['navigation selected pill', /nav button\.on\s*\{[^}]*background:var\(--prs\)!important/s],
  ['navigation current page semantics', /aria-current=/],
  ['gear icon with center', /'config':'<path d="M10 2\.8h4[\s\S]*<circle cx="12" cy="11\.7" r="3\.1"\/>/],
  ['route-aware scroll reset', /_0x5a8d2f=V\['sg'\][\s\S]*_0x5a8d2f!==V\['sg'\][\s\S]*scrollTop.*=0x0/s],
  ['horizontal screen transition', /st-screen-enter-forward[\s\S]*translate3d\(12px,0,0\)/],
  ['global route transition override', /#app\.an>\*\s*\{\s*animation:st-screen-enter-forward[\s\S]*#app\.an\.dr>\*\s*\{\s*animation:st-screen-enter-forward[\s\S]*#app\.an\.dl>\*\s*\{\s*animation:st-screen-enter-back/]

];

for (const [label, pattern] of requiredPatterns) {
  requireCheck(pattern.test(html), 'Global UI requirement missing: ' + label + '.');
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
const globalReducedMotionBlocks = (styleBlocks.length === 1 ? (styleBlocks[0][1].match(/@media\s*\(?prefers-reduced-motion:reduce\)?\s*\{\*\{animation:none!important;transition:none!important\}\}/g) || []).length : 0);
requireCheck(globalReducedMotionBlocks === 1, 'Expected exactly one global reduced-motion fallback; duplicate or missing fallback detected.');
const cssImportantCount = styleBlocks.length === 1 ? (styleBlocks[0][1].match(/!important/g) || []).length : 0;
requireCheck(cssImportantCount <= 872, 'The global CSS !important count increased above the audited baseline (872).');

// Legacy native browser dialogs are being migrated in controlled groups.
// These ceilings match the audited 3.73.3 baseline and prevent new usages
// from silently spreading while preserving existing flows until migration.
const legacyDialogs = {
  alert: (html.match(/\balert\s*\(/g) || []).length,
  confirm: (html.match(/\bconfirm\s*\(/g) || []).length,
  prompt: (html.match(/\bprompt\s*\(/g) || []).length
};
const ceilings = { alert: 96, confirm: 31, prompt: 1 };

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
