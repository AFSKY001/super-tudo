import fs from 'node:fs/promises';
import path from 'node:path';
import { minify } from 'terser';
import { parse } from 'acorn';
import JavaScriptObfuscator from 'javascript-obfuscator';

const root = process.cwd();
const dist = path.join(root, 'dist');
const runtimeFiles = [
  'index.html',
  'sw.js',
  'manifest.webmanifest',
  'logo.webp',
  'icon.svg',
  'LICENSE'
];

const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const version = String(pkg.version || '');
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error('Invalid application version in package.json.');
}

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });

for (const file of runtimeFiles) {
  const source = path.join(root, file);
  const target = path.join(dist, file);
  const stat = await fs.stat(source).catch(() => null);
  if (!stat?.isFile()) throw new Error('Required runtime file is missing: ' + file);
  await fs.copyFile(source, target);
}

const obfuscationOptions = {
  compact: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  renameProperties: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.25,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  selfDefending: false,
  sourceMap: false,
  target: 'browser',
  unicodeEscapeSequence: false
};


function migrateNativeDialogs(source) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script', allowAwaitOutsideFunction: false });
  const edits = [];
  const asyncOwners = new Set();
  const calls = { alert: 0, confirm: 0, prompt: 0 };
  function walk(node, ancestors = []) {
    if (!node || typeof node !== 'object') return;
    const isFunction = ['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(node.type);
    const stack = isFunction ? [...ancestors, node] : ancestors;
    if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && ['alert','confirm','prompt'].includes(node.callee.name)) {
      const kind = node.callee.name;
      const owner = stack[stack.length - 1];
      if (!owner) throw new Error('Native ' + kind + ' call has no enclosing function; migration aborted.');
      calls[kind]++;
      if (kind === 'alert') edits.push({ at: node.start, value: 'window.stAlert' });
      else {
        edits.push({ at: node.start, value: 'await window.st' + (kind === 'confirm' ? 'Confirm' : 'Prompt') });
        if (!owner.async && !asyncOwners.has(owner.start)) { asyncOwners.add(owner.start); edits.push({ at: owner.start, value: 'async ' }); }
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'start' || key === 'end' || key === 'loc') continue;
      const value = node[key];
      if (Array.isArray(value)) value.forEach(child => child && typeof child.type === 'string' && walk(child, stack));
      else if (value && typeof value.type === 'string') walk(value, stack);
    }
  }
  walk(ast);
  edits.sort((a,b) => b.at - a.at);
  let output = source;
  for (const edit of edits) output = output.slice(0, edit.at) + edit.value + output.slice(edit.at);
  return { source: output, calls };
}

function protectJavaScript(source, label) {
  const result = JavaScriptObfuscator.obfuscate(source, obfuscationOptions);
  const code = result.getObfuscatedCode();
  if (!code || !code.trim()) throw new Error('Obfuscator returned empty output for ' + label + '.');
  return code;
}

const htmlPath = path.join(dist, 'index.html');
let html = await fs.readFile(htmlPath, 'utf8');
const versionPattern = /const APP_VERSION\s*=\s*['"][^'"]+['"]/;
if (!versionPattern.test(html)) throw new Error('APP_VERSION declaration was not found.');
html = html.replace(versionPattern, "const APP_VERSION='" + version + "'");

let transformed = 0;
const scriptTag = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
html = await replaceAsync(html, scriptTag, async (whole, attrs, source) => {
  if (/\bsrc\s*=/.test(attrs) || /\bdata-no-protect\b/.test(attrs)) return whole;
  const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
  if (type && !['text/javascript', 'application/javascript', 'module'].includes(type)) return whole;
  if (!source.trim()) return whole;

  const migrated = migrateNativeDialogs(source);
  const minified = await minify(migrated.source, {
    compress: { passes: 2, drop_debugger: true },
    mangle: { toplevel: false },
    format: { comments: /^!/ },
    ecma: 2022,
    module: type === 'module',
    sourceMap: false
  });
  if (minified.error) throw minified.error;
  if (!minified.code) throw new Error('Terser returned empty output for an inline script.');

  const code = protectJavaScript(minified.code, 'index.html inline script');
  if (type !== 'module') new Function(code);
  transformed++;
  if (migrated.calls.alert || migrated.calls.confirm || migrated.calls.prompt) console.log('Migrated internal dialogs:', JSON.stringify(migrated.calls));
  return '<script' + attrs + '>\n' + code + '\n</script>';
});

if (transformed < 1) throw new Error('No inline JavaScript was protected.');
await fs.writeFile(htmlPath, html, 'utf8');

const swPath = path.join(dist, 'sw.js');
const swSource = await fs.readFile(swPath, 'utf8');
const cachePattern = /const CACHE_NAME\s*=\s*['"]super-tudo-v[^'"]+['"]/;
if (!cachePattern.test(swSource)) throw new Error('Service worker cache version was not found.');
const versionedSw = swSource.replace(cachePattern, "const CACHE_NAME='super-tudo-v" + version + "'");
const swMinified = await minify(versionedSw, {
  compress: { passes: 2, drop_debugger: true },
  mangle: { toplevel: false },
  format: { comments: false },
  ecma: 2022,
  sourceMap: false
});
if (swMinified.error || !swMinified.code) {
  throw swMinified.error || new Error('Terser returned empty service worker output.');
}
const protectedSw = protectJavaScript(swMinified.code, 'sw.js');
new Function(protectedSw);
await fs.writeFile(swPath, protectedSw, 'utf8');

const actualFiles = (await fs.readdir(dist)).sort();
const expectedFiles = [...runtimeFiles].sort();
if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
  throw new Error('Unexpected distribution contents: ' + actualFiles.join(', '));
}

const forbiddenPatterns = [
  /sourceMappingURL=/i,
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /sb_secret_[A-Za-z0-9_-]+/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/
];
for (const file of runtimeFiles) {
  const filePath = path.join(dist, file);
  const content = await fs.readFile(filePath);
  if (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.webmanifest') || file.endsWith('.svg') || file === 'LICENSE') {
    const text = content.toString('utf8');
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(text)) throw new Error('Forbidden content matched ' + pattern + ' in ' + file + '.');
    }
  }
}

const htmlStat = await fs.stat(htmlPath);
const swStat = await fs.stat(swPath);
console.log(JSON.stringify({
  version,
  outputFiles: actualFiles,
  inlineScriptsProtected: transformed,
  serviceWorkerProtected: true,
  indexBytes: htmlStat.size,
  serviceWorkerBytes: swStat.size,
  sourceMaps: false,
  supabaseProjectFilesIncluded: false
}, null, 2));

async function replaceAsync(input, regex, replacer) {
  const matches = [...input.matchAll(regex)];
  let output = '';
  let cursor = 0;
  for (const match of matches) {
    output += input.slice(cursor, match.index);
    output += await replacer(...match);
    cursor = match.index + match[0].length;
  }
  return output + input.slice(cursor);
}
