import fs from 'node:fs/promises';
import path from 'node:path';

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

const html = await fs.readFile(path.join(root, 'index.html'), 'utf8');
if (
  !html.includes("const APP_VERSION='" + version + "'") &&
  !html.includes('const APP_VERSION="' + version + '"')
) {
  throw new Error('index.html version does not match package.json (' + version + ').');
}

const sw = await fs.readFile(path.join(root, 'sw.js'), 'utf8');
if (!sw.includes('super-tudo-v' + version)) {
  throw new Error('Service worker cache version does not match package.json (' + version + ').');
}

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });

for (const file of runtimeFiles) {
  const source = path.join(root, file);
  const target = path.join(dist, file);
  const stat = await fs.stat(source).catch(() => null);
  if (!stat?.isFile()) {
    throw new Error('Required runtime file is missing: ' + file);
  }
  await fs.copyFile(source, target);
}

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
  const content = await fs.readFile(path.join(dist, file), 'utf8');
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) {
      throw new Error('Forbidden content found in dist/' + file + ': ' + pattern);
    }
  }
}

console.log('Prepared Super Tudo v' + version + ' for Cloudflare Workers.');
console.log('Files: ' + actualFiles.join(', '));
