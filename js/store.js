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
      FirebaseSync.scheduleSave(path, value);
    }
    /* Локальный бекап — данные не потеряются если закроешь до синка (у тренера не пишем) */
    if (!(window.FirebaseSync && FirebaseSync.isCoach && FirebaseSync.isCoach())) {
      try { localStorage.setItem('nik_local_backup', JSON.stringify(obj)); } catch(e) {}
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

  /* пустые элементы (null) Firebase оставляет, когда из середины массива пропала запись.
     Экраны на них падают, поэтому выкидываем; если что-то выкинули, индексы сдвинулись,
     и раздел тренировок при следующем сохранении пишется целиком (см. firebase-sync) */
  let _trCompacted = false;
  const isObj = (x) => !!x && typeof x === 'object';
  function objs(v) { const a = toArr(v); const out = a.filter(isObj); if (out.length !== a.length) _trCompacted = true; return out; }
  function fixExercise(ex) {
    if (ex && typeof ex === 'object' && ('setDetails' in ex)) ex.setDetails = toArr(ex.setDetails).filter(isObj);
    return ex;
  }

  function normalizeTraining(t, base) {
    if (!t || typeof t !== 'object') return base.training;
    t.plans = objs(t.plans).map(p => {
      p.weeks = objs(p.weeks).map(w => {
        /* пустой день не выкидываем (в неделе должно остаться 7 дней), а восстанавливаем по соседнему */
        const rawDays = toArr(w.days);
        const ref = rawDays.findIndex(isObj);
        if (ref >= 0 && rawDays.some(d => !isObj(d))) {
          const [rd, rm] = String(rawDays[ref].date || '').split('.').map(Number);
          const yr = p.startDate ? new Date(p.startDate).getFullYear() : new Date().getFullYear();
          const DW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
          w.days = rawDays.map((d, i) => { if (isObj(d)) return d; if (!rd || !rm) return d;
            const dt = new Date(yr, rm - 1, rd + (i - ref));
            return { date: String(dt.getDate()).padStart(2, '0') + '.' + String(dt.getMonth() + 1).padStart(2, '0'), dow: DW[dt.getDay()], sessions: [] }; });
        }
        w.days = objs(w.days).map(d => {
          if ('sessions' in d) d.sessions = objs(d.sessions).map(s => {
            s.exercises = objs(s.exercises).map(fixExercise);
            s.groups = toArr(s.groups);
            return s;
          });
          if ('exercises' in d) d.exercises = objs(d.exercises).map(fixExercise);
          if ('groups' in d) d.groups = toArr(d.groups);
          return d;
        });
        return w;
      });
      return p;
    });
    t.measurements = objs(t.measurements).map(m => { if (!isObj(m.values)) m.values = {}; return m; });
    return t;
  }

  function ensureShape(d) {
    const base = defaultData();
    if (!d || typeof d !== 'object') return base;
    d.meta = d.meta || base.meta;
    d.training = normalizeTraining(d.training, base);
    d.habits = isObj(d.habits) ? d.habits : base.habits;
    d.habits.list = toArr(d.habits.list).filter(isObj).map(h => { if ('customDays' in h) h.customDays = toArr(h.customDays).map(Number).filter(n => n >= 1 && n <= 7); return h; });
    if (!isObj(d.habits.months)) d.habits.months = {};
    d.finance = isObj(d.finance) ? d.finance : base.finance;
    if (!isObj(d.finance.years)) d.finance.years = {};
    /* доходы месяца: массив без пустых элементов */
    Object.values(d.finance.years).forEach(y => { if (isObj(y)) Object.values(y).forEach(m => { if (isObj(m) && 'entries' in m) m.entries = toArr(m.entries).filter(isObj); }); });
    d.goals = isObj(d.goals) ? d.goals : base.goals;
    /* Normalize goals.directions — Firebase может вернуть объект {0:..} вместо массива */
    if (d.goals.directions && !Array.isArray(d.goals.directions)) {
      d.goals.directions = toArr(d.goals.directions);
    }
    if (!Array.isArray(d.goals.directions)) d.goals.directions = [];
    d.goals.directions = d.goals.directions.filter(isObj);
    d.nutrition = d.nutrition || base.nutrition;
    d.nutritionFoods = d.nutritionFoods || base.nutritionFoods;
    return d;
  }

  function replaceAll(newData) {
    data = ensureShape(newData);
    /* Сохраняем в localStorage как резервную копию (у тренера не пишем) */
    if (!(window.FirebaseSync && FirebaseSync.isCoach && FirebaseSync.isCoach())) {
      try { localStorage.setItem('nik_local_backup', JSON.stringify(data)); } catch(e) {}
    }
  }

  function loadFromLocalBackup() {
    try {
      const raw = localStorage.getItem('nik_local_backup');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 1) {
        data = ensureShape(parsed);
        return true;
      }
    } catch(e) {}
    return false;
  }

  var _listeners = [];
  function subscribe(fn) {
    _listeners.push(fn);
    return function() { _listeners = _listeners.filter(function(f){return f!==fn;}); };
  }
  var _origSet = set;
  var _origReplaceAll = replaceAll;
  function setAndNotify(path, val) {
    _origSet(path, val);
    _listeners.forEach(function(fn){try{fn();}catch(e){}});
  }
  function replaceAllAndNotify(incoming) {
    _origReplaceAll(incoming);
    _listeners.forEach(function(fn){try{fn();}catch(e){}});
  }
  /* были ли выкинуты пустые элементы в тренировках при последней загрузке (один раз) */
  function takeTrainingCompacted() { const v = _trCompacted; _trCompacted = false; return v; }
  return { takeTrainingCompacted, get, set: setAndNotify, replaceAll: replaceAllAndNotify, load, loadSeedFromRepo, defaultData, loadFromLocalBackup, subscribe };
})();
