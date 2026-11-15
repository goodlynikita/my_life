import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPrecache } from '../server/build-precache.mjs';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const scope = 'https://you.test/app/';
const CURRENT = /const CACHE = '([^']+)'/.exec(source)[1];
const PREVIOUS = CURRENT.replace(/\d+$/, value => String(+value - 1));
const sum = body => createHash('sha256').update(body).digest('hex');
const absolute = value => new URL(typeof value === 'string' ? value : value.url, scope).href;
const cdn = ['https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js', 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js', 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js', 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.48.0/dist/tabler-icons.min.css'];

function install({ old = {}, current = {}, network = {}, expected = {}, reject = [], hashes = true } = {}) {
  const db = new Map(), listeners = {}, requests = [];
  let activated = false, claimed = false, active = 0, maxActive = 0;
  function cache(name) {
    if (!db.has(name)) db.set(name, new Map());
    const entries = db.get(name);
    return {
      async match(request) { const response = entries.get(absolute(request)); return response?.clone(); },
      async put(request, response) { entries.set(absolute(request), response.clone()); },
      async add(request) { await this.put(request, await context.fetch(request)); },
    };
  }
  for (const [name, data] of [[PREVIOUS, old], [CURRENT, current], ['nik-cdn-v1', Object.fromEntries(cdn.map(path => [path, 'cdn']))]]) {
    cache(name); for (const [path, body] of Object.entries(data)) db.get(name).set(absolute(path), new Response(body));
  }
  const paths = Object.keys(expected);
  const code = source.replace(/const STATIC = \[[\s\S]*?\];/, 'const STATIC = ' + JSON.stringify(paths) + ';').replace('const STATIC_HASHES = null;', 'const STATIC_HASHES = ' + (hashes ? JSON.stringify(Object.fromEntries(paths.map(path => [path, sum(expected[path])]))) : 'null') + ';');
  const context = vm.createContext({ URL, Request, Response, Uint8Array, crypto: webcrypto, setTimeout, clearTimeout,
    self: { location: { href: scope + 'sw.js' }, addEventListener: (type, fn) => { listeners[type] = fn; }, skipWaiting: async () => { activated = true; }, clients: { claim: async () => { claimed = true; } } },
    caches: { open: async name => cache(name), keys: async () => [...db.keys()], delete: async name => db.delete(name) },
    fetch: async request => {
      const path = absolute(request); requests.push(path); active++; maxActive = Math.max(active, maxActive);
      try { await new Promise(resolve => setTimeout(resolve, 5)); if (reject.some(value => absolute(value) === path)) throw new Error('offline');
        return Object.prototype.hasOwnProperty.call(network, path) ? new Response(network[path]) : Object.prototype.hasOwnProperty.call(network, new URL(path).pathname.slice(5)) ? new Response(network[new URL(path).pathname.slice(5)]) : new Response('missing', { status: 404 });
      } finally { active--; }
    },
  });
  vm.runInContext(code, context);
  return { db, requests, get activated() { return activated; }, get claimed() { return claimed; }, get maxActive() { return maxActive; },
    async run() { let result; listeners.install({ waitUntil: promise => { result = promise; } }); await result; },
    async activate() { let result; listeners.activate({ waitUntil: promise => { result = promise; } }); await result; },
  };
}

test('an update reuses every unchanged file, including images and the cached SDK, without network requests', async () => {
  const files = { './index.html': '<html>app</html>', './app.js': 'boot()', './picture.webp': new Uint8Array(512 * 1024).fill(73) };
  const sw = install({ old: files, expected: files });
  await sw.run(); assert.equal(sw.activated, true); assert.equal(sw.claimed, false); assert.deepEqual(sw.requests, []);
  assert.equal(sw.db.get(CURRENT).size, 3); assert.equal(sw.db.has(PREVIOUS), true);
  await sw.activate(); assert.equal(sw.claimed, true); assert.equal(sw.db.has(PREVIOUS), false); assert.equal(sw.db.has('nik-cdn-v1'), true);
});

test('only changed or missing files are fetched, so current HTML and scripts stay in one complete cache', async () => {
  const expected = { './index.html': 'new html', './app.js': 'new code', './picture.webp': 'same image', './new.css': 'new style' };
  const network = Object.fromEntries(Object.entries(expected).map(([key, value]) => [absolute(key), value]));
  const sw = install({ old: { './index.html': 'old html', './app.js': 'old code', './picture.webp': 'same image' }, network, expected });
  await sw.run(); assert.equal(sw.activated, true); assert.equal(sw.requests.length, 3); assert.equal(sw.requests.includes(absolute('./picture.webp')), false);
  for (const [path, body] of Object.entries(expected)) assert.equal(await sw.db.get(CURRENT).get(absolute(path)).text(), body);
});

test('a wrong cached body is replaced even when it has the same URL', async () => {
  const sw = install({ old: { './app.js': 'stale data' }, expected: { './app.js': 'correct code' }, network: { [absolute('./app.js')]: 'correct code' } });
  await sw.run(); assert.deepEqual(sw.requests, [absolute('./app.js')]); assert.equal(sw.activated, true);
});

test('a failed update leaves the installed version intact and never activates an incomplete cache', async () => {
  const sw = install({ old: { './index.html': 'installed' }, expected: { './index.html': 'new html', './app.js': 'new code' }, reject: ['./index.html', './app.js'] });
  await assert.rejects(sw.run(), /offline/); assert.equal(sw.activated, false); assert.equal(sw.claimed, false);
  assert.equal(await sw.db.get(PREVIOUS).get(absolute('./index.html')).text(), 'installed');
});

test('a response from a different deployment is rejected until all new files match their build hashes', async () => {
  const sw = install({ old: { './app.js': 'installed' }, expected: { './app.js': 'expected build' }, network: { [absolute('./app.js')]: 'other build' } });
  await assert.rejects(sw.run(), /Incomplete app update/); assert.equal(sw.activated, false); assert.equal(sw.db.get(CURRENT).size, 0);
});

test('a retry reuses verified files from its partial cache and downloads only the remainder', async () => {
  const sw = install({ current: { './app.js': 'verified' }, expected: { './app.js': 'verified', './app.css': 'remaining' }, network: { [absolute('./app.css')]: 'remaining' } });
  await sw.run(); assert.deepEqual(sw.requests, [absolute('./app.css')]); assert.equal(sw.activated, true);
});

test('a first installation still caches everything with at most four concurrent downloads', async () => {
  const files = Object.fromEntries(Array.from({ length: 12 }, (_, i) => ['./file' + i + '.js', 'code' + i]));
  const sw = install({ expected: files, network: Object.fromEntries(Object.entries(files).map(([path, body]) => [absolute(path), body])) });
  await sw.run(); assert.equal(sw.activated, true); assert.equal(sw.requests.length, 12); assert.equal(sw.maxActive, 4);
});

test('an unbuilt development worker fetches fresh files instead of mixing unchecked versions', async () => {
  const sw = install({ hashes: false, old: { './app.js': 'old' }, expected: { './app.js': 'new' }, network: { [absolute('./app.js')]: 'new' } });
  await sw.run(); assert.deepEqual(sw.requests, [absolute('./app.js')]); assert.equal(sw.activated, true);
});

test('the build hashes final JS/CSS and both app entry URLs; missing files fail the build', () => {
  const folder = mkdtempSync(join(tmpdir(), 'you-precache-'));
  try {
    const template = "const STATIC = ['./','./index.html','./js/app.js'];\nconst STATIC_HASHES = null;\n";
    writeFileSync(join(folder, 'sw.js'), template); writeFileSync(join(folder, 'index.html'), 'final html'); mkdirSync(join(folder, 'js')); writeFileSync(join(folder, 'js/app.js'), 'minified()');
    const hashes = buildPrecache(folder); assert.equal(hashes['./'], sum('final html')); assert.equal(hashes['./index.html'], hashes['./']); assert.equal(hashes['./js/app.js'], sum('minified()'));
    assert.equal(readFileSync(join(folder, 'sw.js'), 'utf8').includes('STATIC_HASHES = null'), false);
    writeFileSync(join(folder, 'sw.js'), template); rmSync(join(folder, 'js/app.js')); assert.throws(() => buildPrecache(folder), /ENOENT/);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
