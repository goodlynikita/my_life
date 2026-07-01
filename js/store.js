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

  /* Firebase возвращает массивы как объекты вида {0:.., 1:.., 2:..}, если в
     массиве были пропуски (а они появляются из-за выкидывания пустых элементов).
     Тогда plan.weeks.map / days.forEach падают, потому что это уже не массив.
     Здесь чиним ТОЛЬКО известные массивы тренировок — finance.years и
     habits.months специально не трогаем (там ключи — годы/месяцы, это норм). */
  function toArr(v) {
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') {
      return Object.keys(v).sort((a, b) => Number(a) - Number(b)).map(k => v[k]);
    }
    return [];
  }

  function fixExercise(ex) {
    if (ex && typeof ex === 'object' && ('setDetails' in ex)) ex.setDetails = toArr(ex.setDetails);
    return ex;
  }

  function normalizeTraining(t, base) {
    if (!t || typeof t !== 'object') return base.training;
    t.plans = toArr(t.plans).map(p => {
      if (!p || typeof p !== 'object') return p;
      p.weeks = toArr(p.weeks).map(w => {
        if (!w || typeof w !== 'object') return w;
        w.days = toArr(w.days).map(d => {
          if (!d || typeof d !== 'object') return d;
          if ('sessions' in d) d.sessions = toArr(d.sessions).map(s => {
            if (!s || typeof s !== 'object') return s;
            s.exercises = toArr(s.exercises).map(fixExercise);
            s.groups = toArr(s.groups);
            return s;
          });
          if ('exercises' in d) d.exercises = toArr(d.exercises).map(fixExercise);
          if ('groups' in d) d.groups = toArr(d.groups);
          return d;
        });
        return w;
      });
      return p;
    });
    t.measurements = toArr(t.measurements);
    return t;
  }

  function ensureShape(d) {
    const base = defaultData();
    if (!d || typeof d !== 'object') return base;
    d.meta = d.meta || base.meta;
    d.training = normalizeTraining(d.training, base);
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
