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
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        data = JSON.parse(raw);
        return data;
      }
    } catch (e) {
      console.error('Store load failed', e);
    }
    // No local data yet — try to seed from data.json shipped in the repo.
    try {
      const res = await fetch('data.json', { cache: 'no-store' });
      if (res.ok) {
        data = await res.json();
        persistLocal();
        return data;
      }
    } catch (e) {
      console.error('Store seed fetch failed', e);
    }
    data = defaultData();
    return data;
  }

  function persistLocal() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Store persist failed', e);
    }
  }

  function get() {
    if (!data) load();
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

  function replaceAll(newData) {
    data = newData;
    persistLocal();
  }

  return { get, set, replaceAll, load, defaultData };
})();
