/* Хеши именно тех байтов, которые браузер получит после распаковки gzip. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function buildPrecache(root) {
  const base = resolve(root), worker = resolve(base, 'sw.js');
  const source = readFileSync(worker, 'utf8');
  const list = source.match(/const STATIC = \[([\s\S]*?)\];/);
  if (!list || !source.includes('const STATIC_HASHES = null;')) throw new Error('Precache template not found');
  const paths = [...list[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  if (!paths.length) throw new Error('Empty precache list');
  const hashes = Object.fromEntries(paths.map(path => {
    if (!path.startsWith('./') || path.includes('?') || path.includes('#')) throw new Error('Invalid precache path: ' + path);
    const file = resolve(base, path === './' ? 'index.html' : path.slice(2));
    if (!file.startsWith(base + sep)) throw new Error('Precache path outside build: ' + path);
    return [path, createHash('sha256').update(readFileSync(file)).digest('hex')];
  }));
  writeFileSync(worker, source.replace('const STATIC_HASHES = null;', 'const STATIC_HASHES = ' + JSON.stringify(hashes) + ';'));
  return hashes;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildPrecache(process.argv[2] || '.');
}
