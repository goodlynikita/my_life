/* ============================================================
   STORE — in-memory state, Firebase is the only persistent store
   Намеренно убран localStorage как источник данных при старте —
   это был корень проблемы рассинхрона между устройствами.
   Единственный источник данных при старте — Firebase.
   localStorage больше не используется для загрузки данных,
   только Firebase. Как в "Бегу к себе".
   ============================================================ */

const Store = (() => {
  let data = null;

  function defaultData() {
    return {
      meta: { createdAt: new Date().toISOString(), version: 1 },
      training: {
        plans: [],
        measurements: []
      },
      habits: {
        months: {}
      },
      finance: {
        years: {}
      },
      goals: {
        directions: [],
        upcoming: [],
        monthlyBase: []
      }
    };
  }

  async function load() {
    /* Намеренно всегда возвращает null — Firebase единственный источник.
       Функция оставлена для совместимости с app.js. */
    return null;
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
    if (window.FirebaseSync && FirebaseSync.isConfigured()) {
      FirebaseSync.scheduleSave();
    }
  }

  /* Firebase возвращает массивы как объекты вида {0:.., 1:.., 2:..}, если в
     массиве были пропуски. Тогда plan.weeks.map / days.forEach падают.
     Чиним ТОЛЬКО известные массивы тренировок. */
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
    /* Намеренно НЕ сохраняем в localStorage — Firebase единственное
       постоянное хранилище. Локальный кэш был причиной рассинхрона. */
  }

  return { get, set, replaceAll, load, loadSeedFromRepo, defaultData };
})();
