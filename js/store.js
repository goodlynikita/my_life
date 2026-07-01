/* ============================================================
   STORE — local cache + (later) GitHub-backed persistence
   All app data lives in one in-memory object, mirrored to
   localStorage on every change, and pushed to GitHub on save.
   ============================================================ */

const Store = (() => {
  const LS_KEY = 'nik_data_v1';

  let data = null;

  function defaultData() {
    return {
      meta: { createdAt: new Date().toISOString(), version: 1 },
      training: {
        plans: [],        // [{ id, number, startDate, status: 'active'|'archived', weeks: [{ weekNum, range, days: [{ date, dow, type, group, exercises: [{id,name,sets,reps,weight}] }] }] }]
        measurements: []  // array of { date, weight, chest, waist, ... }
      },
      habits: {
        months: {}       // '2026-06': { habits: [...], targets: {...} }
      },
      finance: {
        years: {}         // '2026': { months: { '01': [{date, amount, isOther}] } }
      },
      goals: {
        directions: [],
        upcoming: [],
        monthlyBase: []
      }
    };
  }

  async function load() {
    // This only loads a local cache synchronously, for the rare case
    // FirebaseSync isn't configured or available. When Firebase IS
    // configured (the normal case), app.js takes full control: it asks
    // Firebase first, and only falls back to this local copy or the
    // seeded data.json if Firebase has nothing or is unreachable.
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        data = JSON.parse(raw);
        return data;
      }
    } catch (e) {
      console.error('Store load failed', e);
    }
    data = null;
    return data;
  }

  async function loadSeedFromRepo() {
    try {
      const res = await fetch('data.json', { cache: 'no-store' });
      if (res.ok) return await res.json();
    } catch (e) {
      console.error('Store seed fetch failed', e);
    }
    return null;
  }

  function persistLocal() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Store persist failed', e);
    }
  }

  function get() {
    if (!data) data = defaultData();
    return data;
  }

  function set(path, value) {
    const obj = get();
    const keys = path.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in cur)) cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
    persistLocal();
    if (window.FirebaseSync && FirebaseSync.isConfigured()) {
      FirebaseSync.scheduleSave();
    }
  }

  function ensureShape(d) {
    const base = defaultData();
    if (!d || typeof d !== 'object') return base;
    d.meta = d.meta || base.meta;
    d.training = d.training || base.training;
    if (!Array.isArray(d.training.plans)) d.training.plans = [];
    if (!Array.isArray(d.training.measurements)) d.training.measurements = [];
    d.habits = d.habits || base.habits;
    d.finance = d.finance || base.finance;
    d.goals = d.goals || base.goals;
    return d;
  }

  function replaceAll(newData) {
    data = ensureShape(newData);
    persistLocal();
  }

  return { get, set, replaceAll, load, loadSeedFromRepo, defaultData };
})();
