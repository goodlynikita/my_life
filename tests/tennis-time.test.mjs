import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/screens/training.js', import.meta.url), 'utf8');
const start = source.indexOf('function trPlayLabel(');
const end = source.indexOf('/* место на экране', start);
const context = vm.createContext({});
vm.runInContext(source.match(/^function trNum\(.*$/m)[0] + '\n' + source.match(/^function trEsc\(.*$/m)[0] + '\n' + source.slice(start, end), context);
const minutes = ex => context.trPlayMinutes(ex);
const values = (time, calories, previous, name = 'Теннис') => JSON.parse(JSON.stringify(context.trReadTimeCalorieFields({ querySelector: id => ({ value: id === '#m-duration' ? time : calories }) }, name, previous)));

test('playing time is primary, old duration-only records still read', () => {
  assert.equal(minutes({ name: 'Теннис', duration: 90, play: 60 }), 60);
  assert.equal(minutes({ name: 'Теннис', duration: 90 }), 90);
  assert.equal(minutes({ name: 'Теннис', duration: 90, play: 0 }), 90);
  assert.equal(minutes({ name: 'Теннис', duration: 0, play: 45 }), 45);
});

test('time-only tennis can be created with no calories', () => {
  assert.deepEqual(values('45', ''), { duration: 45, play: 45, calories: 0 });
});

test('editing optional calories preserves historical total and playing time', () => {
  const previous = { name: 'Теннис', duration: 90, play: 60, calories: 0, note: 'Заметка' };
  assert.deepEqual(values('60', '250', previous), { duration: 90, play: 60, calories: 250 });
  assert.equal(previous.duration, 90);
  assert.equal(previous.note, 'Заметка');
});

test('changing primary time keeps compatibility fields consistent', () => {
  assert.deepEqual(values('75', '', { name: 'Теннис', duration: 90, play: 60 }), { duration: 75, play: 75, calories: 0 });
});

test('clearing primary time does not restore the old hidden duration', () => {
  const next = values('', '', { name: 'Теннис', duration: 90, play: 60 });
  assert.equal(minutes({ ...next, name: 'Теннис' }), 0);
});

test('saving duration-only and play-only legacy records remains compatible', () => {
  assert.deepEqual(values('90', '', { name: 'Теннис', duration: 90 }), { duration: 90, play: 90, calories: 0 });
  assert.deepEqual(values('45', '', { name: 'Теннис', duration: 0, play: 45 }), { duration: 45, play: 45, calories: 0 });
});

test('other timed activities keep the duration and calories schema', () => {
  assert.deepEqual(values('30', '', undefined, 'Бокс'), { duration: 30, calories: 0 });
});
