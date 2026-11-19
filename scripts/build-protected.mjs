import fs from 'node:fs/promises';
import path from 'node:path';
import { minify } from 'terser';

const root = process.cwd();
const dist = path.join(root, 'dist');
const excluded = new Set(['.git', '.github', 'node_modules', 'dist', 'scripts']);
const excludedFiles = new Set(['package.json', 'package-lock.json']);

async function copyTree(source, target) {
  await fs.mkdir(target, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    if (excluded.has(entry.name) || excludedFiles.has(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) await copyTree(from, to);
    else if (entry.isFile()) await fs.copyFile(from, to);
  }
}

await fs.rm(dist, { recursive: true, force: true });
await copyTree(root, dist);

const htmlPath = path.join(dist, 'index.html');
let html = await fs.readFile(htmlPath, 'utf8');
let transformed = 0;
const scriptTag = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;

html = await replaceAsync(html, scriptTag, async (whole, attrs, source) => {
  if (/\bsrc\s*=/i.test(attrs)) return whole;
  const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
  if (type && !['text/javascript', 'application/javascript', 'module'].includes(type)) return whole;
  if (!source.trim()) return whole;

  const result = await minify(source, {
    compress: { passes: 2, drop_debugger: true },
    mangle: { toplevel: false },
    format: { comments: /^!/ },
    ecma: 2022,
    module: type === 'module',
    sourceMap: false
  });
  if (result.error) throw result.error;
  if (!result.code) throw new Error('Terser returned empty code for an inline script.');
  transformed++;
  return `<script${attrs}>\n${result.code}\n</script>`;
});

if (transformed < 1) throw new Error('No inline JavaScript was transformed.');
if (/sourceMappingURL=/.test(html)) throw new Error('Unexpected source map reference in protected HTML.');
await fs.writeFile(htmlPath, html, 'utf8');

const output = await fs.stat(htmlPath);
console.log(JSON.stringify({
  output: 'dist/index.html',
  inlineScriptsMinified: transformed,
  outputBytes: output.size,
  sourceMaps: false
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
