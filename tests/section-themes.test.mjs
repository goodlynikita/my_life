import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const storeSource = readFileSync(new URL('../js/store.js', import.meta.url), 'utf8');
const themeSource = readFileSync(new URL('../js/theme.js', import.meta.url), 'utf8');
const sections = ['training', 'habits', 'finance', 'goals', 'tasks', 'hero'];
function app({ data = {}, winter = true, local = 'dark' } = {}) {
  const storage = new Map([['nik_theme', local]]), writes = [], classes = new Set();
  const html = { dataset: { sec: 'home' }, setAttribute(key, value) { this.dataset[key.slice(5)] = value; }, classList: { remove(...keys) { keys.forEach(k => classes.delete(k)); }, toggle(key, on) { on ? classes.add(key) : classes.delete(key); } } };
  const context = vm.createContext({ console, document: { documentElement: html, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    FirebaseSync: { isConfigured: () => true, scheduleSave: (path, value) => writes.push({ path, value }) },
    WinterArc: { isOn: () => winter }
  }); context.window = context;
  vm.runInContext(storeSource + ';globalThis.Store=Store;', context);
  context.Store.replaceAll(JSON.parse(JSON.stringify(data)));
  vm.runInContext(themeSource, context); context.Theme.syncFromStore();
  return { ...context, html, storage, writes, classes, visit(sec) { html.dataset.sec = sec; context.Theme.mountControls({ querySelector: () => null }); }, design(on) { winter = on; context.Theme.mountControls({ querySelector: () => null }); } };
}
for (const target of sections) test('Winter Arc remembers ' + target + ' without changing any other section or Minimal', () => {
  const data = { home: { theme: 'light', tileOrder: [0, 1, 4, 2, 3] }, tasks: { theme: 'light', list: [{ id: 'keep', title: 'Запись' }] }, finance: { lightScreen: true } };
  const a = app({ data, local: 'light' });
  a.visit(target); assert.equal(a.Theme.get(), 'dark'); a.Theme.set('light');
  assert.equal(a.html.dataset.theme, 'light');
  for (const sec of sections) { a.visit(sec); assert.equal(a.Theme.get(), sec === target ? 'light' : 'dark'); assert.equal(a.html.dataset.theme, a.Theme.get()); }
  a.visit('home'); assert.equal(a.html.dataset.theme, 'dark');
  assert.deepEqual(a.writes, [{ path: 'home.waThemes.' + target, value: 'light' }]);
  assert.equal(a.Store.get().home.theme, 'light'); assert.equal(a.storage.get('nik_theme'), 'light');
  assert.equal(a.Store.get().tasks.theme, 'light'); assert.equal(a.Store.get().tasks.list[0].id, 'keep'); assert.equal(a.Store.get().finance.lightScreen, true);
  const reopened = app({ data: JSON.parse(a.storage.get('nik_local_backup')) }); reopened.visit(target); assert.equal(reopened.Theme.get(), 'light');
  reopened.design(false); assert.equal(reopened.Theme.get(), 'light');
});
test('home Winter Arc default applies only where no section choice was saved', () => {
  const a = app(); a.visit('tasks'); a.Theme.set('light'); a.Theme.set('dark');
  a.visit('home'); a.Theme.set('light'); assert.equal(a.html.dataset.theme, 'dark');
  a.visit('tasks'); assert.equal(a.Theme.get(), 'dark'); a.visit('habits'); assert.equal(a.Theme.get(), 'light');
  a.Theme.set('dark'); a.visit('training'); assert.equal(a.Theme.get(), 'light');
  assert.equal(a.Store.get().home.theme, undefined);
});
test('sync and account changes read section choices without creating preference writes', () => {
  const a = app({ data: { home: { waThemes: { tasks: 'light' } } } }); a.visit('tasks'); assert.equal(a.Theme.get(), 'light');
  a.Store.replaceAll({ home: { theme: 'light', waThemes: { tasks: 'dark', goals: 'light' } } }); a.Theme.syncFromStore();
  assert.equal(a.html.dataset.theme, 'dark'); a.visit('goals'); assert.equal(a.Theme.get(), 'light');
  a.Store.replaceAll({ home: {} }); a.Theme.syncFromStore(); assert.equal(a.Theme.get(), 'dark');
  assert.deepEqual(a.writes, []);
});
test('Minimal keeps its existing global preference and leaves Winter Arc choices intact', () => {
  const a = app({ winter: false, data: { home: { waThemes: { tasks: 'light' } } } });
  a.visit('training'); a.Theme.set('light'); a.visit('habits'); assert.equal(a.Theme.get(), 'light');
  a.Theme.set('dark'); assert.equal(a.storage.get('nik_theme'), 'dark'); assert.equal(a.Store.get().home.theme, 'dark');
  a.design(true); a.visit('tasks'); assert.equal(a.Theme.get(), 'light');
  assert.deepEqual(a.writes.map(e => e.path), ['home.theme', 'home.theme']);
});
test('invalid or missing preferences fall back to a valid Winter Arc default', () => {
  const a = app({ data: { home: { waThemes: { default: 'light', tasks: 'invalid' } } } }); a.visit('tasks'); assert.equal(a.Theme.get(), 'light');
  a.Store.replaceAll({ home: { waThemes: { default: 'invalid' } } }); a.Theme.syncFromStore(); assert.equal(a.Theme.get(), 'dark'); assert.deepEqual(a.writes, []);
});
