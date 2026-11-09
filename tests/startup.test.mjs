import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const snapshot = { training: { plans: [{ id: 'saved-plan', weeks: [] }] }, tasks: { list: [{ id: 'saved-task', title: 'Запись без сети' }] } };
function localStore(uid = 'same-user', raw = JSON.stringify(snapshot)) {
  const items = new Map([['nik_local_backup', raw]]);
  if (uid) items.set('nik_backup_uid', uid);
  const context = vm.createContext({ localStorage: { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) } });
  context.window = context;
  vm.runInContext(readFileSync(new URL('../js/store.js', import.meta.url), 'utf8') + ';globalThis.Store=Store;', context);
  return context.Store;
}

test('the signed-in account can open its valid backup without writing it to the server', () => {
  const store = localStore(); assert.equal(store.hasLocalBackup('same-user'), true);
  assert.equal(store.loadFromLocalBackup('same-user'), true);
  assert.equal(store.get().training.plans[0].id, 'saved-plan');
  assert.equal(store.get().tasks.list[0].id, 'saved-task');
});
for (const owner of ['different-user', null]) test('a backup with owner ' + owner + ' cannot become another account startup data', () => {
  const store = localStore(owner); assert.equal(store.hasLocalBackup('same-user'), false);
  assert.equal(store.loadFromLocalBackup('same-user'), false);
  assert.equal(store.get().training.plans.length, 0);
});
for (const raw of ['{broken', '[1,2]']) test('an invalid backup is not eligible for the short startup fallback: ' + raw, () => {
  const store = localStore('same-user', raw); assert.equal(store.hasLocalBackup('same-user'), false);
  assert.equal(store.loadFromLocalBackup('same-user'), false);
});

async function boot({ owner = 'same-user', result = 'error', blocked = false, coach = false } = {}) {
  const events = {}, items = new Map([['nik_backup_uid', owner], ['nik_local_backup', JSON.stringify(snapshot)]]);
  let authCallback, reads = 0, offlineBase = null;
  const user = { uid: 'same-user', email: coach ? 'legacy@coach.you-app' : 'same@test.invalid' };
  const context = vm.createContext({ console, setTimeout, clearTimeout, URLSearchParams, navigator: { onLine: true },
    location: { search: '', pathname: '/', hash: '#/training' },
    document: { addEventListener: (name, fn) => { events[name] = fn; } }, addEventListener() {},
    localStorage: { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value) },
    Router: { render() {}, currentPath: () => '/training' },
  }); context.window = context;
  vm.runInContext(readFileSync(new URL('../js/store.js', import.meta.url), 'utf8') + ';globalThis.Store=Store;', context);
  context.FirebaseSync = { isCoach: () => coach, onAuth: callback => { authCallback = callback; return () => {}; },
    isBlocked: async () => blocked, pullIntoStore: async () => { reads++; return result; },
    markBase: () => { offlineBase = JSON.parse(JSON.stringify(context.Store.get())); }, logout: async () => {},
  };
  vm.runInContext(readFileSync(new URL('../js/app.js', import.meta.url), 'utf8'), context);
  const starting = events.DOMContentLoaded(); await new Promise(resolve => setImmediate(resolve));
  await authCallback(user); await starting;
  return { data: context.Store.get(), reads, offlineBase, blocked: context._accountBlocked, ready: context._appReady };
}
test('a failed network startup opens its own backup and marks that exact copy as the offline merge base', async () => {
  const app = await boot(); assert.equal(app.ready, true); assert.equal(app.data.training.plans[0].id, 'saved-plan');
  assert.equal(app.offlineBase.tasks.list[0].id, 'saved-task');
});
test('a confirmed empty server does not revive deleted records from an old local backup', async () => {
  const app = await boot({ result: false }); assert.equal(app.data.training.plans.length, 0); assert.equal(app.offlineBase, null);
});
test('startup never falls back to another account data after a failed network request', async () => {
  const app = await boot({ owner: 'other-user' }); assert.equal(app.data.training.plans.length, 0); assert.equal(app.offlineBase, null);
});
test('a blocked account does not load its backup or start pulling user data', async () => {
  const app = await boot({ blocked: true }); assert.equal(app.blocked, true); assert.equal(app.reads, 0); assert.equal(app.data.training.plans.length, 0);
});
test('the technical coach never opens a local client backup', async () => {
  const app = await boot({ coach: true }); assert.equal(app.data.training.plans.length, 0); assert.equal(app.offlineBase, null);
});

function worker(cacheEntries = {}) {
  const listeners = {}, opened = [], fetched = [], scope = 'https://you.test/app/';
  const cache = { async match(request, options) {
    const url = new URL(typeof request === 'string' ? request : request.url, scope);
    if (options?.ignoreSearch) url.search = '';
    return cacheEntries[url.href];
  } };
  const context = vm.createContext({
    self: { location: { href: scope + 'sw.js' }, addEventListener: (name, fn) => { listeners[name] = fn; } },
    caches: { open: async name => { opened.push(name); return cache; } }, URL, Response, setTimeout, clearTimeout,
    fetch: async request => { fetched.push(request.url); return new Response('network page'); },
  });
  vm.runInContext(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), context);
  return { opened, fetched, async request(url, mode = 'navigate') {
    let response;
    listeners.fetch({ request: { url, mode, method: 'GET' }, respondWith: value => { response = value; } });
    return response && await response;
  } };
}
for (const path of ['?r=/training', 'index.html?add=1']) test('cached app navigation opens without any network request: ' + path, async () => {
  const sw = worker({ 'https://you.test/app/index.html': new Response('installed app version') });
  const response = await sw.request('https://you.test/app/' + path);
  assert.equal(await response.text(), 'installed app version'); assert.equal(sw.fetched.length, 0);
  assert.match(sw.opened[0], /^nik-system-v\d+$/);
});
test('an uncached app navigation still loads from the network', async () => {
  const sw = worker(); const response = await sw.request('https://you.test/app/');
  assert.equal(await response.text(), 'network page'); assert.equal(sw.fetched.length, 1);
});
test('other HTML pages continue to load the current network page', async () => {
  const sw = worker({ 'https://you.test/app/index.html': new Response('app only') });
  const response = await sw.request('https://you.test/app/recover.html');
  assert.equal(await response.text(), 'network page'); assert.equal(sw.fetched[0], 'https://you.test/app/recover.html');
});
test('database and authentication requests are never served from the application cache', async () => {
  const sw = worker();
  assert.equal(await sw.request('https://demo.firebaseio.com/users/test.json', 'cors'), undefined);
  assert.equal(await sw.request('https://identitytoolkit.googleapis.com/v1/accounts:lookup', 'cors'), undefined);
  assert.equal(sw.opened.length, 0);
});
