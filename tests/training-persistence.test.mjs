import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const copy = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const read = (o, path) => path.split('/').filter(Boolean).reduce((v, k) => v?.[k], o);
function write(o, path, value) {
  const keys = path.split('/').filter(Boolean);
  let at = o;
  for (const k of keys.slice(0, -1)) at = at[k] ??= {};
  if (value == null) delete at[keys.at(-1)]; else at[keys.at(-1)] = copy(value);
}
const initial = () => ({
  training: { plans: [{ id: 'plan-1', weeks: [{ days: [{ date: '08.11', sessions: [{ type: 'Силовая', exercises: [] }] }] }] }] },
  habits: { list: [] }, _rev: { training: 1 },
});
const workout = () => ({ date: '08.11', done: true, sessions: [{ type: 'Силовая', exercises: [{ name: 'Жим', weight: 50, reps: 10, setDetails: [{ weight: 50, reps: 10 }] }] }] });
function client(server, storage = new Map(), uid = 'client-a', control = {}) {
  let timerId = 0;
  const timers = new Map();
  const auth = { currentUser: { uid, email: control.email || uid + '@test.invalid' } };
  control.auth = auth;
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    FIREBASE_CONFIG: { databaseURL: 'https://test.invalid' }, AUTH_CONFIG: {},
    navigator: { onLine: true },
    localStorage: { get length() { return storage.size; }, key: i => [...storage.keys()][i], getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
    document: { getElementById: () => null, addEventListener() {} },
    addEventListener() {}, removeEventListener() {}, dispatchEvent: e => { (control.events ??= []).push(e); }, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout: id => timers.delete(id), setInterval: () => ++timerId, clearInterval() {},
    initializeApp: () => ({}), getDatabase: () => ({}), getAuth: () => auth, signOut: async () => { auth.currentUser = null; },
    ref: (_, path = '') => path,
    get: async path => ({ exists: () => read(server, path) != null, val: () => copy(read(server, path)) }),
    set: async (path, v) => write(server, path, v),
    update: async (path, changes) => {
      if (control.failUpdate) throw new Error('network disconnected');
      if (control.beforeUpdate) await control.beforeUpdate();
      for (const [k, v] of Object.entries(changes)) write(server, path + '/' + k, v);
    },
    runTransaction: async (path, fn) => {
      if (control.failUpdate) throw new Error('network disconnected');
      for (let attempt = 0; attempt < 25; attempt++) {
        const before = copy(read(server, path) ?? null), after = fn(copy(before));
        if (after === undefined) return { committed: false };
        if (control.beforeUpdate) await control.beforeUpdate();
        if (JSON.stringify(read(server, path) ?? null) !== JSON.stringify(before)) continue;
        write(server, path, after);
        const value = copy(read(server, path));
        return { committed: true, snapshot: { val: () => copy(value) } };
      }
      throw new Error('transaction retry limit');
    },
  });
  context.window = context;
  vm.runInContext(readFileSync(new URL('../js/store.js', import.meta.url), 'utf8') + '\nglobalThis.Store = Store;', context);
  let source = readFileSync(new URL('../js/firebase-sync.js', import.meta.url), 'utf8').replace(/^import\s[\s\S]*?from\s+"https:[^"]+";\s*/gm, '');
  source = source.replace('  return {\n    shareTemplate,', '  globalThis.testFlush = _flushQueue;\n  globalThis.testRetry = _retryPull;\n  globalThis.testTrainer = v => { _myTrainer = v; };\n  return {\n    shareTemplate,');
  vm.runInContext(source, context);
  return { context, storage, async load() { await context.FirebaseSync.pullIntoStore(); }, async flush() { await context.testFlush(); }, async advance(ms) { for (const [id, t] of timers) if (t.ms === ms) { timers.delete(id); t.fn(); } await new Promise(r => setImmediate(r)); } };
}

test('a workout survives closing before the debounce and reloads over the old server copy', async () => {
  const server = { users: { 'client-a': initial() } }, storage = new Map();
  const first = client(server, storage); await first.load();
  first.context.Store.set('training.plans.0.weeks.0.days.0', workout());
  // No flush: the page is closed immediately, so all in-memory state is discarded.
  const reopened = client(server, storage); await reopened.load();
  assert.equal(reopened.context.Store.get().training.plans[0].weeks[0].days[0].sessions[0].exercises[0]?.weight, 50);
  await reopened.flush();
  assert.equal(server.users['client-a'].training.plans[0].weeks[0].days[0].sessions[0].exercises[0].weight, 50);
});

test('recovery preserves unrelated server updates and never crosses accounts', async () => {
  const server = { users: { 'client-a': initial(), 'client-b': initial() } }, storage = new Map();
  const first = client(server, storage); await first.load();
  first.context.Store.set('training.plans.0.weeks.0.days.0', workout());
  server.users['client-a'].training.coachNote = 'Новое от тренера';
  const other = client(server, storage, 'client-b'); await other.load();
  assert.equal(other.context.Store.get().training.plans[0].weeks[0].days[0].sessions[0].exercises.length, 0);
  const reopened = client(server, storage); await reopened.load();
  assert.equal(reopened.context.Store.get().training.coachNote, 'Новое от тренера');
  assert.equal(reopened.context.Store.get().training.plans[0].weeks[0].days[0].sessions[0].exercises[0]?.weight, 50);
});

test('acknowledged training is not replayed after a later server change', async () => {
  const server = { users: { 'client-a': initial() } }, storage = new Map();
  const first = client(server, storage); await first.load();
  first.context.Store.set('training.plans.0.weeks.0.days.0', workout());
  await first.flush();
  server.users['client-a'].training.plans[0].weeks[0].days[0].sessions[0].exercises[0].weight = 60;
  const reopened = client(server, storage); await reopened.load();
  assert.equal(reopened.context.Store.get().training.plans[0].weeks[0].days[0].sessions[0].exercises[0].weight, 60);
});

test('a failed upload keeps the journal until a successful retry', async () => {
  const server = { users: { 'client-a': initial() } }, storage = new Map(), control = { failUpdate: true };
  const page = client(server, storage, 'client-a', control); await page.load();
  page.context.Store.set('training.plans.0.weeks.0.days.0', workout()); await page.flush();
  assert.ok(storage.get('nik_training_pending_client-a'));
  control.failUpdate = false; await page.flush();
  assert.equal(storage.get('nik_training_pending_client-a'), undefined);
  assert.equal(server.users['client-a'].training.plans[0].weeks[0].days[0].done, true);
});

test('acknowledging an in-flight write never deletes a later edit', async () => {
  const server = { users: { 'client-a': initial() } }, storage = new Map();
  let release, started;
  const atWrite = new Promise(r => { started = r; });
  const wait = new Promise(r => { release = r; });
  const control = { beforeUpdate: async () => { started(); await wait; } };
  const page = client(server, storage, 'client-a', control); await page.load();
  page.context.Store.set('training.plans.0.weeks.0.days.0', workout());
  const first = page.flush(); await atWrite;
  page.context.Store.set('training.plans.0.weeks.0.days.0.comment', 'После тренировки');
  await page.flush(); // Serialization: must not start a second update while the first is pending.
  release(); await first;
  assert.ok(storage.get('nik_training_pending_client-a'));
  control.beforeUpdate = null; await page.flush();
  assert.equal(storage.get('nik_training_pending_client-a'), undefined);
  assert.equal(server.users['client-a'].training.plans[0].weeks[0].days[0].comment, 'После тренировки');
});

test('an offline reopen recovers a pending workout when the network returns', async () => {
  const server = { users: { 'client-a': initial() } }, storage = new Map();
  const first = client(server, storage); await first.load();
  first.context.Store.set('training.plans.0.weeks.0.days.0', workout());
  const offline = client(server, storage); offline.context.navigator.onLine = false;
  await offline.load(); offline.context.Store.loadFromLocalBackup(); offline.context.FirebaseSync.markBase();
  offline.context.navigator.onLine = true; await offline.context.testRetry();
  assert.equal(offline.context.Store.get().training.plans[0].weeks[0].days[0].sessions[0].exercises[0].weight, 50);
  await offline.flush();
  assert.equal(server.users['client-a'].training.plans[0].weeks[0].days[0].sessions[0].exercises[0].weight, 50);
});

test('a true field conflict keeps the unsent client copy available for recovery', async () => {
  const server = { users: { 'client-a': initial() } }, storage = new Map();
  server.users['client-a'].training.plans[0].weeks[0].days[0] = workout();
  const page = client(server, storage); await page.load();
  page.context.Store.set('training.plans.0.weeks.0.days.0.sessions.0.exercises.0.weight', 55);
  server.users['client-a'].training.plans[0].weeks[0].days[0].sessions[0].exercises[0].weight = 60;
  const reopened = client(server, storage); await reopened.load();
  assert.equal(reopened.context.Store.get().training.plans[0].weeks[0].days[0].sessions[0].exercises[0].weight, 60);
  const conflictKey = [...storage.keys()].find(k => k.startsWith('nik_sync_conflict_client-a_'));
  assert.ok(conflictKey);
  const saved = JSON.parse(storage.get(conflictKey));
  assert.equal(saved.local.plans[0].weeks[0].days[0].sessions[0].exercises[0].weight, 55);
});

function coachContext(server) {
  const html = readFileSync(new URL('../coach.html', import.meta.url), 'utf8');
  const start = html.indexOf('const stableStr =');
  const end = html.indexOf('/* пока открыт клиент', start);
  const toArr = v => Array.isArray(v) ? v : Object.keys(v || {}).sort((a, b) => a - b).map(k => v[k]);
  const context = vm.createContext({
    toArr, clean: copy, db: {}, ref: (_, p) => p, stats: () => ({}),
    update: async (path, changes) => { for (const [k, v] of Object.entries(changes)) write(server, path + '/' + k, v); },
    window: { TrainingAI: { planDayDate: () => new Date('2020-01-01') }, CoachDash: { sig: () => 'planned' } },
    alert: message => { throw new Error(message); },
  });
  vm.runInContext(html.slice(start, end), context);
  return context;
}

test('editing a coach note keeps client results saved from a newer device', async () => {
  const baseline = initial().training;
  const server = { users: { 'client-a': { training: copy(baseline) } } };
  server.users['client-a'].training.plans[0].weeks[0].days[0] = workout();
  const c = { root: 'users/client-a', training: copy(baseline), _synced: copy(baseline.plans), _planKeys: [0] };
  c.training.plans[0].weeks[0].days[0].coachNote = 'Добавь разминку';
  await coachContext(server).savePlans(c, c.training.plans);
  const day = server.users['client-a'].training.plans[0].weeks[0].days[0];
  assert.equal(day.coachNote, 'Добавь разминку');
  assert.equal(day.done, true);
  assert.equal(day.sessions[0].exercises[0]?.weight, 50);
});

test('appending an exercise preserves results of existing exercises', async () => {
  const baseline = initial().training;
  baseline.plans[0].weeks[0].days[0] = workout();
  baseline.plans[0].weeks[0].days[0].sessions[0].exercises[0].weight = 40;
  const server = { users: { 'client-a': { training: copy(baseline) } } };
  server.users['client-a'].training.plans[0].weeks[0].days[0].sessions[0].exercises[0].weight = 55;
  const c = { root: 'users/client-a', training: copy(baseline), _synced: copy(baseline.plans), _planKeys: [0] };
  c.training.plans[0].weeks[0].days[0].sessions[0].exercises.push({ name: 'Присед', weight: 30, reps: 10 });
  await coachContext(server).savePlans(c, c.training.plans);
  const exercises = server.users['client-a'].training.plans[0].weeks[0].days[0].sessions[0].exercises;
  assert.equal(exercises[0].weight, 55);
  assert.equal(exercises[1].name, 'Присед');
});

test('replacing an exercise does not attach old results to the new exercise', async () => {
  const baseline = initial().training;
  baseline.plans[0].weeks[0].days[0] = workout();
  const server = { users: { 'client-a': { training: copy(baseline) } } };
  server.users['client-a'].training.plans[0].weeks[0].days[0].sessions[0].exercises[0].weight = 55;
  const c = { root: 'users/client-a', training: copy(baseline), _synced: copy(baseline.plans), _planKeys: [0] };
  c.training.plans[0].weeks[0].days[0].sessions[0].exercises[0] = { name: 'Присед', weight: 30, reps: 10 };
  await coachContext(server).savePlans(c, c.training.plans);
  const exercise = server.users['client-a'].training.plans[0].weeks[0].days[0].sessions[0].exercises[0];
  assert.equal(exercise.name, 'Присед');
  assert.equal(exercise.weight, 30);
  assert.equal(exercise.setDetails, undefined);
});

test('recovery page exposes only the signed-in account training journals', () => {
  const html = readFileSync(new URL('../recover.html', import.meta.url), 'utf8');
  const storage = new Map([
    ['nik_training_pending_client-a_recovery', JSON.stringify({ root: 'users/client-a', id: '1794211200000:1', local: initial().training })],
    ['nik_training_pending_client-b', JSON.stringify({ root: 'users/client-b', id: '1794211200000:2', local: initial().training })],
  ]);
  const context = vm.createContext({ rootOf: u => 'users/' + u.uid, localStorage: { length: storage.size, key: i => [...storage.keys()][i], getItem: k => storage.get(k) ?? null } });
  vm.runInContext(html.slice(html.indexOf('function localCopies('), html.indexOf('onAuthStateChanged(auth')), context);
  assert.equal(context.localCopies(null).length, 0);
  const copies = context.localCopies({ uid: 'client-a' });
  assert.equal(copies.length, 1);
  assert.equal(copies[0].k, 'nik_training_pending_client-a_recovery');
  assert.equal(copies[0].label, 'Несохранённые тренировки');
  assert.deepEqual(Object.keys(copies[0].d), ['training']);
});

test('recovery page keeps both conflict versions downloadable and filters other accounts', () => {
  const html = readFileSync(new URL('../recover.html', import.meta.url), 'utf8');
  const conflict = { root: 'users/client-a', section: 'tasks', id: '1794211200000:1', base: { list: [] }, local: { list: [{ id: 't1', title: 'Локально' }] }, server: { list: [{ id: 't1', title: 'Сервер' }] }, conflicts: [{ path: 'list.t1.title' }] };
  const storage = new Map([
    ['nik_sync_conflict_client-a_1_tasks', JSON.stringify(conflict)],
    ['nik_section_pending_client-a_finance', JSON.stringify({ root: 'users/client-a', section: 'finance', local: { years: {} } })],
    ['nik_section_pending_client-a_wrong', JSON.stringify({ root: 'users/client-b', section: 'tasks', local: {} })],
    ['nik_sync_conflict_client-b_1_tasks', JSON.stringify({ ...conflict, root: 'users/client-b' })],
  ]);
  const context = vm.createContext({ rootOf: u => 'users/' + u.uid, localStorage: { length: storage.size, key: i => [...storage.keys()][i], getItem: k => storage.get(k) ?? null } });
  vm.runInContext(html.slice(html.indexOf('function localCopies('), html.indexOf('onAuthStateChanged(auth')), context);
  const copies = context.localCopies({ uid: 'client-a' }); assert.equal(copies.length, 2);
  assert.equal(JSON.stringify(copies[0].downloadData), JSON.stringify(conflict));
  assert.deepEqual(Object.keys(copies[1].d), ['finance']); assert.equal(context.localCopies(null).length, 0);
});

for (const linked of [false, true]) test('simultaneous device writes preserve independent training changes; trainer=' + linked, async () => {
  const server = { users: { 'client-a': initial() } };
  let arrivals = 0, release;
  const barrier = new Promise(r => { release = r; });
  const beforeUpdate = async () => { if (++arrivals >= 2) release(); await barrier; };
  const a = client(server, new Map(), 'client-a', { beforeUpdate }), b = client(server, new Map(), 'client-a', { beforeUpdate });
  await a.load(); await b.load();
  if (linked) { a.context.testTrainer({ trainerUid: 'trainer' }); b.context.testTrainer({ trainerUid: 'trainer' }); }
  a.context.Store.set('training.plans.0.weeks.0.days.0', workout());
  b.context.Store.set('training.catalog', { types: [{ name: 'Свой тип' }] });
  await Promise.all([a.flush(), b.flush()]);
  assert.equal(server.users['client-a'].training.plans[0].weeks[0].days[0].sessions[0].exercises[0]?.weight, 50);
  assert.equal(server.users['client-a'].training.catalog.types[0].name, 'Свой тип');
});

for (const [section, path, value] of [
  ['habits', 'habits.months.2026-11.h1.9', 'done'],
  ['finance', 'finance.years.2026.11.entries', [{ id: 'e1', amount: 100 }]],
  ['goals', 'goals.directions', [{ id: 'g1', name: 'Цель' }]],
  ['tasks', 'tasks.list', [{ id: 't1', title: 'Задача' }]],
]) test(section + ': offline edit survives closing, offline reopen, and reconnect', async () => {
  const server = { users: { 'client-a': initial() } }, storage = new Map();
  const first = client(server, storage); await first.load();
  first.context.Store.set(path, value);
  const offline = client(server, storage); offline.context.navigator.onLine = false; await offline.load();
  offline.context.Store.loadFromLocalBackup(); offline.context.FirebaseSync.markBase();
  offline.context.navigator.onLine = true; await offline.context.testRetry(); await offline.flush();
  assert.equal(JSON.stringify(read(server.users['client-a'], path.replaceAll('.', '/'))), JSON.stringify(value));
});

for (const linked of [false, true]) test('two devices update different fields of the same day; trainer=' + linked, async () => {
  const data = initial(); data.training.plans[0].weeks[0].days[0] = workout();
  const server = { users: { 'client-a': data } };
  let count = 0, release; const barrier = new Promise(r => { release = r; });
  const beforeUpdate = async () => { if (++count >= 2) release(); await barrier; };
  const a = client(server, new Map(), 'client-a', { beforeUpdate }), b = client(server, new Map(), 'client-a', { beforeUpdate }); await a.load(); await b.load();
  if (linked) { a.context.testTrainer({ trainerUid: 'trainer' }); b.context.testTrainer({ trainerUid: 'trainer' }); }
  const first = workout(); first.sessions[0].exercises[0].weight = 55;
  const second = workout(); second.comment = 'Запись со второго устройства';
  a.context.Store.set('training.plans.0.weeks.0.days.0', first); b.context.Store.set('training.plans.0.weeks.0.days.0', second);
  await Promise.all([a.flush(), b.flush()]);
  const day = server.users['client-a'].training.plans[0].weeks[0].days[0];
  assert.equal(day.sessions[0].exercises[0].weight, 55); assert.equal(day.comment, second.comment);
});

test('simultaneous writes to separate sections keep both revisions and all data', async () => {
  const server = { users: { 'client-a': initial() } };
  let count = 0, release; const barrier = new Promise(r => { release = r; });
  const beforeUpdate = async () => { if (++count >= 2) release(); await barrier; };
  const a = client(server, new Map(), 'client-a', { beforeUpdate }), b = client(server, new Map(), 'client-a', { beforeUpdate }); await a.load(); await b.load();
  a.context.Store.set('habits.months.2026-11.h1.9', 'done'); b.context.Store.set('tasks.list', [{ id: 't1', title: 'Дело' }]);
  await Promise.all([a.flush(), b.flush()]);
  assert.equal(server.users['client-a'].habits.months['2026-11'].h1[9], 'done'); assert.equal(server.users['client-a'].tasks.list[0].title, 'Дело');
  assert.ok(server.users['client-a']._rev.tasks); assert.ok(server.users['client-a']._rev.habits);
});

test('simultaneous different values of one field retain both copies, not an unnoticed overwrite', async () => {
  const data = initial(); data.training.plans[0].weeks[0].days[0] = workout(); const server = { users: { 'client-a': data } };
  let count = 0, release; const barrier = new Promise(r => { release = r; });
  const beforeUpdate = async () => { if (++count >= 2) release(); await barrier; };
  const sa = new Map(), sb = new Map(), a = client(server, sa, 'client-a', { beforeUpdate }), b = client(server, sb, 'client-a', { beforeUpdate }); await a.load(); await b.load();
  const p = 'training.plans.0.weeks.0.days.0.sessions.0.exercises.0.weight'; a.context.Store.set(p, 55); b.context.Store.set(p, 60);
  await Promise.all([a.flush(), b.flush()]);
  const kept = new Set([read(server.users['client-a'], p.replaceAll('.', '/'))]);
  const conflicts = [...sa, ...sb].filter(([k]) => k.startsWith('nik_sync_conflict_')).map(([,v]) => JSON.parse(v));
  assert.equal(conflicts.length, 1);
  for (const c of conflicts) kept.add(c.local.plans[0].weeks[0].days[0].sessions[0].exercises[0].weight);
  assert.deepEqual([...kept].sort(), [55, 60]); assert.equal(conflicts[0].conflicts[0].path, 'plans.plan-1.weeks.0.days.0.sessions.0.exercises.0.weight');
});

test('sparse Firebase plan indices are normalized without losing either plan during concurrent saves', async () => {
  const data = initial(), other = copy(data.training.plans[0]); other.id = 'plan-2'; data.training.plans = { 0: data.training.plans[0], 2: other };
  const server = { users: { 'client-a': data } };
  let count = 0, release; const barrier = new Promise(r => { release = r; });
  const beforeUpdate = async () => { if (++count >= 2) release(); await barrier; };
  const a = client(server, new Map(), 'client-a', { beforeUpdate }), b = client(server, new Map(), 'client-a', { beforeUpdate }); await a.load(); await b.load();
  a.context.Store.set('training.plans.0.weeks.0.days.0', workout()); b.context.Store.set('training.plans.1.weeks.0.days.0.comment', 'Второй план');
  await Promise.all([a.flush(), b.flush()]);
  const plans = server.users['client-a'].training.plans; assert.equal(plans.length, 2);
  assert.equal(plans.find(p => p.id === 'plan-1').weeks[0].days[0].sessions[0].exercises[0].weight, 50);
  assert.equal(plans.find(p => p.id === 'plan-2').weeks[0].days[0].comment, 'Второй план');
});

test('an appended record keeps its id when the server changed it before an unacknowledged replay', async () => {
  const server = { users: { 'client-a': initial() } }, storage = new Map();
  const a = client(server, storage); await a.load(); a.context.Store.set('tasks.list', [{ id: 't1', title: 'Локальная версия' }]);
  server.users['client-a'].tasks = { list: [{ id: 't1', title: 'Серверная версия' }] };
  const reopened = client(server, storage); await reopened.load();
  assert.equal(reopened.context.Store.get().tasks.list.length, 1);
  const c = JSON.parse([...storage].find(([k]) => k.startsWith('nik_sync_conflict_'))[1]); assert.equal(c.local.list[0].title, 'Локальная версия');
});

test('a long offline write stays the only in-flight transaction while later edits remain durable', async () => {
  const server = { users: { 'client-a': initial() } }, storage = new Map(); let started, release;
  const atWrite = new Promise(r => { started = r; }), barrier = new Promise(r => { release = r; });
  const control = { beforeUpdate: async () => { started(); await barrier; } }, page = client(server, storage, 'client-a', control); await page.load();
  page.context.Store.set('tasks.list', [{ id: 't1', title: 'Первая версия' }]); let settled = false;
  const sending = page.flush().then(() => { settled = true; }); await atWrite;
  await page.advance(15000); assert.equal(settled, false);
  page.context.Store.set('tasks.list', [{ id: 't1', title: 'Новая версия' }]); await page.flush();
  assert.ok(storage.get('nik_section_pending_client-a_tasks'));
  release(); await sending; control.beforeUpdate = null; await page.flush();
  assert.equal(server.users['client-a'].tasks.list.length, 1); assert.equal(server.users['client-a'].tasks.list[0].title, 'Новая версия');
});

test('a later edit conflicting with a transaction result also keeps its own recovery copy', async () => {
  const data = initial(); data.training.plans[0].weeks[0].days[0] = workout();
  const server = { users: { 'client-a': data } }, storage = new Map(); let started, release;
  const atWrite = new Promise(r => { started = r; }), barrier = new Promise(r => { release = r; });
  const page = client(server, storage, 'client-a', { beforeUpdate: async () => { started(); await barrier; } }); await page.load();
  const path = 'training.plans.0.weeks.0.days.0.sessions.0.exercises.0.weight';
  page.context.Store.set(path, 55); const sending = page.flush(); await atWrite;
  write(server.users['client-a'], path.replaceAll('.', '/'), 60);
  page.context.Store.set(path, 65); release(); await sending;
  const values = new Set([read(server.users['client-a'], path.replaceAll('.', '/'))]);
  for (const [key, value] of storage) if (key.startsWith('nik_sync_conflict_')) values.add(JSON.parse(value).local.plans[0].weeks[0].days[0].sessions[0].exercises[0].weight);
  assert.deepEqual([...values].sort(), [55, 60, 65]);
});

test('fresh trainer data keeps the existing coach-plan-update notification', async () => {
  const server = { users: { 'client-a': initial() } }, control = {}, a = client(server, new Map(), 'client-a', control); await a.load(); a.context.testTrainer({ trainerUid: 'trainer' });
  server.users['client-a'].training.coachRev = 42; server.users['client-a'].training.plans[0].weeks[0].days[0].coachNote = 'Новая заметка';
  a.context.Store.set('training.plans.0.weeks.0.days.0', workout()); await a.flush();
  assert.equal(server.users['client-a'].training.plans[0].weeks[0].days[0].coachNote, 'Новая заметка');
  assert.ok(control.events.some(e => e.type === 'coach-plan-update'));
});

test('the legacy coach writes only training and never journals client data on the device', async () => {
  const server = { users: { 'client-a': initial() }, coachLinks: { legacy: 'client-a' } }, storage = new Map();
  const page = client(server, storage, 'legacy', { email: 'legacy@coach.you-app' }); await page.load();
  page.context.Store.set('training.plans.0.weeks.0.days.0', workout()); await page.flush();
  assert.equal(server.users['client-a'].training.plans[0].weeks[0].days[0].done, true);
  assert.equal(storage.size, 0);
});

test('logout keeps the first account journal and never sends its queue to the next account', async () => {
  const server = { users: { 'client-a': initial(), 'client-b': initial() } }, storage = new Map(), control = {}, page = client(server, storage, 'client-a', control); await page.load();
  page.context.Store.set('tasks.list', [{ id: 'a', title: 'Первый аккаунт' }]); await page.context.FirebaseSync.logout();
  control.auth.currentUser = { uid: 'client-b', email: 'client-b@test.invalid' }; await page.load();
  page.context.Store.set('tasks.list', [{ id: 'b', title: 'Второй аккаунт' }]); await page.flush();
  assert.equal(server.users['client-a'].tasks, undefined); assert.equal(server.users['client-b'].tasks.list[0].id, 'b');
  assert.ok(storage.get('nik_section_pending_client-a_tasks')); assert.equal(storage.get('nik_section_pending_client-b_tasks'), undefined);
});

test('an offline account switch never uses the previous account as the new journal base', async () => {
  const data = initial(); data.tasks = { list: [{ id: 'private-a', title: 'Первый аккаунт' }] };
  const server = { users: { 'client-a': data } }, storage = new Map(), control = {}, page = client(server, storage, 'client-a', control); await page.load();
  page.context.navigator.onLine = false; await page.load(); page.context.FirebaseSync.markBase();
  await page.context.FirebaseSync.logout(); control.auth.currentUser = { uid: 'client-b', email: 'client-b@test.invalid' };
  await page.load(); page.context.FirebaseSync.markBase(); page.context.Store.set('tasks.list', [{ id: 'b', title: 'Второй аккаунт' }]);
  assert.ok(!JSON.stringify(JSON.parse(storage.get('nik_section_pending_client-b_tasks')).base ?? null).includes('private-a'));
});

test('v306 training journal without a section field stays compatible', async () => {
  const data = initial(), local = copy(data.training); local.plans[0].weeks[0].days[0] = workout();
  const server = { users: { 'client-a': data } }, storage = new Map([['nik_training_pending_client-a', JSON.stringify({ root: 'users/client-a', id: 'old', base: data.training, local })]]);
  const page = client(server, storage); await page.load(); await page.flush();
  assert.equal(server.users['client-a'].training.plans[0].weeks[0].days[0].done, true); assert.equal(storage.get('nik_training_pending_client-a'), undefined);
});

test('opening training without plans never creates or saves an empty plan', () => {
  const source = readFileSync(new URL('../js/screens/training.js', import.meta.url), 'utf8');
  const context = vm.createContext({ trGetPlans: () => [], trActivePlan: () => null, Store: { set: () => { throw new Error('unexpected write'); } } });
  vm.runInContext(source.slice(source.indexOf('function trEnsureSeedPlan()'), source.indexOf('function trCreateNextPlan()')), context);
  assert.equal(context.trEnsureSeedPlan(), null);
});
