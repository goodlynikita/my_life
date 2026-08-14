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
      nutrition: {},
      nutritionFoods: [],
      habits: {
        list: [],
        months: {}
      },
      finance: {
        years: {},
        expensesList: [
          { id:'exp1', name:'Зубы', amount:24000, source:'' },
          { id:'exp2', name:'Вибрато', amount:18000, source:'' },
          { id:'exp3', name:'Химчистка', amount:8000, source:'' },
          { id:'exp4', name:'РС', amount:6400, source:'' },
          { id:'exp5', name:'Зал', amount:3500, source:'' },
          { id:'exp6', name:'Карплей', amount:24000, source:'' },
          { id:'exp7', name:'Брекетты', amount:40000, source:'' },
          { id:'exp8', name:'Налог', amount:29000, source:'' },
          { id:'exp9', name:'Остатки по тачке', amount:25000, source:'' },
        ]
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
      FirebaseSync.scheduleSave(path, value);
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
    if (!d.habits.list) d.habits.list = [];
    if (!d.habits.months) d.habits.months = {};
    d.finance = d.finance || base.finance;
    if (!d.finance.years) d.finance.years = {};
    d.goals = d.goals || base.goals;
    /* Firebase может вернуть directions как объект {0:..,1:..} — конвертируем в массив */
    if (d.goals.directions && !Array.isArray(d.goals.directions)) {
      d.goals.directions = toArr(d.goals.directions).filter(Boolean);
    }
    d.nutrition = d.nutrition || base.nutrition;
    d.nutritionFoods = d.nutritionFoods || base.nutritionFoods;
    /* nutritionFoods тоже может прийти как объект */
    if (!Array.isArray(d.nutritionFoods)) d.nutritionFoods = toArr(d.nutritionFoods).filter(Boolean);
    return d;
  }

  function replaceAll(newData) {
    data = ensureShape(newData);
    /* Намеренно НЕ сохраняем в localStorage — Firebase единственное
       постоянное хранилище. Локальный кэш был причиной рассинхрона. */
  }

  return { get, set, replaceAll, load, loadSeedFromRepo, defaultData };
})();
