import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const DAY = 86400000, MINUTE = 60000;
const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const read = (o, p) => p.split('/').filter(Boolean).reduce((v, k) => v?.[k], o);
function write(o, p, v) {
  const keys = p.split('/').filter(Boolean); let at = o;
  for (const k of keys.slice(0, -1)) at = at[k] ??= {};
  at[keys.at(-1)] = clone(v);
}
const initial = () => ({
  userIndex: { 'user-a': { lastSeen: '2026-11-09T10:00:00.000Z', blocked: false, tag: 'VIP', m: { d: { 20261113: 1 } } } },
  users: { 'user-a': { training: { plans: [{ id: 'p1', weight: 50 }] }, habits: { done: true }, finance: { balance: 9000 }, goals: { text: 'Цель' } } },
  'nik-data': { training: { plans: [{ id: 'owner-plan' }] } },
  trainerClients: { trainer: { 'user-a': { note: 'Сохранить' } } },
});
const user = uid => ({ uid, email: uid + '@test.invalid', displayName: 'Тест', metadata: { creationTime: '2026-09-14T00:00:00.000Z' } });
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(r => setImmediate(r)); };
function page(server = initial(), options = {}) {
  let now = Date.parse(options.at || '2026-11-13T10:00:00Z');
  const handlers = new Map(), intervals = [], calls = [], storage = new Map([['nik_training_pending_user-a', '{"local":"unsent workout"}']]);
  const auth = { currentUser: options.user === undefined ? user('user-a') : options.user };
  const on = (target, name, fn) => { const key = target + ':' + name; if (!handlers.has(key)) handlers.set(key, []); handlers.get(key).push(fn); };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const document = { visibilityState: options.hidden ? 'hidden' : 'visible', getElementById: () => null, addEventListener: (n, f) => on('document', n, f) };
  const context = vm.createContext({ Date: Clock, console: { log() {}, warn() {}, error() {} }, document,
    navigator: { userAgent: 'test browser', onLine: true }, FIREBASE_CONFIG: {}, AUTH_CONFIG: {},
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k), get length() { return storage.size; }, key: i => [...storage.keys()][i] },
    setTimeout: () => 1, clearTimeout() {}, setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; }, clearInterval() {},
    addEventListener: (n, f) => on('window', n, f), removeEventListener() {},
    initializeApp: () => ({}), getDatabase: () => ({}), getAuth: () => auth, ref: (_, p = '') => p,
    get: async p => ({ exists: () => read(server, p) != null, val: () => clone(read(server, p)) }),
    update: async (p, changes) => { if (options.gate) await options.gate; if (options.fail) throw Error('offline'); calls.push({ kind: 'update', path: p, changes: clone(changes) }); for (const [k, v] of Object.entries(changes)) write(server, p + '/' + k, v); },
    runTransaction: async (p, fn) => { calls.push({ kind: 'transaction', path: p }); if (options.gate) await options.gate; if (options.fail) throw Error('offline'); const v = fn(clone(read(server, p) ?? null)); if (v === undefined) return { committed: false }; write(server, p, v); return { committed: true }; },
  });
  context.window = context;
  const source = readFileSync(new URL('../js/firebase-sync.js', import.meta.url), 'utf8').replace(/^import\s[\s\S]*?from\s+"https:[^"]+";\s*/gm, '');
  vm.runInContext(source, context);
  return { context, auth, calls, storage, intervals, server, options, advance: n => { now += n; }, now: () => now,
    async emit(target, name) { for (const fn of handlers.get(target + ':' + name) || []) fn({ type: name }); await settle(); },
    async visible(value) { document.visibilityState = value ? 'visible' : 'hidden'; await this.emit('document', 'visibilitychange'); },
    async tick() { for (const t of intervals) if (t.ms === MINUTE) t.fn(); await settle(); },
    async boot() { await context.FirebaseSync.touchUserIndex(auth.currentUser); await settle(); },
  };
}

test('returning to a PWA four days after startup refreshes lastSeen without signing in again', async () => {
  const p = page(initial(), { at: '2026-11-09T10:00:00Z' }); await p.boot();
  await p.visible(false); p.advance(4 * DAY); await p.visible(true);
  assert.equal(p.server.userIndex['user-a'].lastSeen, '2026-11-13T10:00:00.000Z');
});

test('a visible long session refreshes activity with a throttled heartbeat', async () => {
  const p = page(); await p.boot(); p.advance(5 * MINUTE); await p.tick();
  assert.equal(p.server.userIndex['user-a'].lastSeen, '2026-11-13T10:05:00.000Z');
});

test('hidden pages never claim fresh activity on timers, focus or reconnection', async () => {
  const p = page(); await p.boot(); const before = p.server.userIndex['user-a'].lastSeen;
  await p.visible(false); p.advance(DAY); await p.tick(); await p.emit('window', 'online'); await p.emit('window', 'focus');
  assert.equal(p.server.userIndex['user-a'].lastSeen, before);
});

for (const event of ['pageshow', 'online', 'focus']) test(event + ' observes a real return without a full document reload', async () => {
  const p = page(); await p.boot(); p.advance(DAY); await p.emit('window', event);
  assert.equal(p.server.userIndex['user-a'].lastSeen, '2026-11-14T10:00:00.000Z');
});

test('repeated foreground events do not cause a write for every event', async () => {
  const p = page(); await p.boot(); const count = p.calls.length;
  for (let i = 0; i < 12; i++) { p.advance(1000); await p.emit('window', 'focus'); await p.visible(true); }
  assert.equal(p.calls.length, count);
});

test('a failed activity write can be retried when the connection returns', async () => {
  const p = page(); await p.boot(); p.advance(DAY); p.options.fail = true; await p.visible(true);
  p.options.fail = false; await p.emit('window', 'online');
  assert.equal(p.server.userIndex['user-a'].lastSeen, '2026-11-14T10:00:00.000Z');
});

test('delayed activity from an older device cannot overwrite newer activity', async () => {
  const server = initial(); let release; const gate = new Promise(r => { release = r; });
  const older = page(server, { at: '2026-11-12T10:00:00Z', gate }); const pending = older.boot(); await settle();
  const newer = page(server); await newer.boot(); release(); await pending;
  assert.equal(server.userIndex['user-a'].lastSeen, '2026-11-13T10:00:00.000Z');
});

test('an outstanding offline sample is serialized and followed by the latest real foreground sample', async () => {
  let release; const gate = new Promise(r => { release = r; });
  const p = page(initial(), { at: '2026-11-09T10:00:00Z', gate }); const pending = p.boot(); await settle();
  p.advance(2 * DAY); await p.visible(true); await p.visible(false); p.advance(2 * DAY); release(); await pending; await settle();
  assert.equal(p.server.userIndex['user-a'].lastSeen, '2026-11-11T10:00:00.000Z');
  assert.ok(p.calls.filter(x => x.kind === 'transaction').length <= 2);
});

test('activity writes keep user data, other accounts, admin fields and unsent workouts unchanged', async () => {
  const server = initial(), before = clone(server), p = page(server); const pendingBefore = [...p.storage];
  await p.boot(); p.advance(DAY); await p.visible(true);
  assert.deepEqual(server.users, before.users); assert.deepEqual(server['nik-data'], before['nik-data']);
  assert.deepEqual(server.trainerClients, before.trainerClients); assert.deepEqual([...p.storage], pendingBefore);
  assert.equal(server.userIndex['user-a'].blocked, false); assert.equal(server.userIndex['user-a'].tag, 'VIP');
  assert.deepEqual(server.userIndex['user-a'].m, before.userIndex['user-a'].m);
  assert.ok(p.calls.every(x => x.kind === 'transaction' ? x.path === 'userIndex/user-a/lastSeen' : Object.keys(x.changes).every(k => k.startsWith('userIndex/user-a/'))));
});

for (const account of [null, { uid: 'legacy', email: 'legacy@coach.you-app' }]) test('activity excludes signed-out and technical coach accounts: ' + account?.uid, async () => {
  const p = page(initial(), { user: account }); await p.visible(true); await p.tick(); await p.emit('window', 'pageshow');
  assert.equal(p.calls.length, 0);
});

test('an auth switch cannot retry an outstanding sample into the new account', async () => {
  let release; const gate = new Promise(r => { release = r; }); const p = page(initial(), { gate });
  const pending = p.boot(); await settle(); p.auth.currentUser = user('user-b'); p.advance(DAY);
  await p.visible(true); release(); await pending; await settle();
  assert.equal(p.server.userIndex['user-b'].lastSeen, '2026-11-14T10:00:00.000Z');
  assert.equal(p.server.userIndex['user-a'].lastSeen, '2026-11-09T10:00:00.000Z');
});

test('an auth-aborted sample does not throttle the next sign-in of its account', async () => {
  let release; const gate = new Promise(r => { release = r; }); const p = page(initial(), { gate });
  const pending = p.boot(); await settle(); p.auth.currentUser = user('user-b'); release(); await pending;
  p.auth.currentUser = user('user-a'); p.advance(MINUTE); await p.visible(true);
  assert.equal(p.server.userIndex['user-a'].lastSeen, '2026-11-13T10:01:00.000Z');
});

test('a background document load is not recorded as foreground activity', async () => {
  const p = page(initial(), { hidden: true }); await p.boot();
  assert.equal(p.server.userIndex['user-a'].lastSeen, '2026-11-09T10:00:00.000Z');
});
