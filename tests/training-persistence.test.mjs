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
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    FIREBASE_CONFIG: { databaseURL: 'https://test.invalid' }, AUTH_CONFIG: {},
    navigator: { onLine: true },
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
    document: { getElementById: () => null, addEventListener() {} },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, CustomEvent: class {},
    setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout: id => timers.delete(id), setInterval: () => ++timerId, clearInterval() {},
    initializeApp: () => ({}), getDatabase: () => ({}), getAuth: () => ({ currentUser: { uid, email: uid + '@test.invalid' } }),
    ref: (_, path = '') => path,
    get: async path => ({ exists: () => read(server, path) != null, val: () => copy(read(server, path)) }),
    set: async (path, v) => write(server, path, v),
    update: async (path, changes) => {
      if (control.failUpdate) throw new Error('network disconnected');
      if (control.beforeUpdate) await control.beforeUpdate();
      for (const [k, v] of Object.entries(changes)) write(server, path + '/' + k, v);
    },
  });
  context.window = context;
  vm.runInContext(readFileSync(new URL('../js/store.js', import.meta.url), 'utf8') + '\nglobalThis.Store = Store;', context);
  let source = readFileSync(new URL('../js/firebase-sync.js', import.meta.url), 'utf8').replace(/^import\s[\s\S]*?from\s+"https:[^"]+";\s*/gm, '');
  source = source.replace('  return {\n    shareTemplate,', '  globalThis.testFlush = _flushQueue;\n  globalThis.testRetry = _retryPull;\n  return {\n    shareTemplate,');
  vm.runInContext(source, context);
  return { context, storage, async load() { await context.FirebaseSync.pullIntoStore(); }, async flush() { await context.testFlush(); } };
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
  const saved = JSON.parse(storage.get('nik_training_pending_client-a_recovery'));
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
