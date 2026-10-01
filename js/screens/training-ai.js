/* ============================================================
   AI-ТРЕНЕР — вкладка «AI» в тренировках
   Анализирует записанные тренировки и строит план до конца
   текущего 8-недельного плана:
   • частота, любимые дни и связки групп — из твоих данных
   • в каждой группе закрыты все зоны (спина: ширина + толщина,
     грудь: верх первым + середина + низ, ноги: квадрицепс +
     задняя поверхность + икры, плечи: 3 пучка)
   • двойная прогрессия 8–12: повторы растут, на 12 → вес вверх
   • последняя неделя длинного плана — разгрузка
   Результат: Store → training.ai (сохраняется в Firebase)
   ============================================================ */
window.TrainingAI = (function () {
  const DAY = 864e5;
  const GROUPS = ['Грудь', 'Спина', 'Ноги', 'Плечи', 'Руки', 'Кор'];
  const DOW = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  const MIN_WEEKS = 2, MIN_WORKOUTS = 4;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toArr = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map(k => v[k]) : []);
  const pl = (n, a, b, c) => { const x = n % 10, y = n % 100; return x === 1 && y !== 11 ? a : x >= 2 && x <= 4 && (y < 12 || y > 14) ? b : c; };

  /* ── Классификация упражнений: группа, зона, базовое/изоляция ──
     Порядок важен: более конкретные правила выше */
  const RULES = [
    [/кор|скручив|планк|подъём ног|подъем ног|подъём колен|твист|вакуум|ab wheel|дровосек|^велосипед/i, 'Кор', 'core', 'iso'],
    [/отжимания на брусьях \(трицепс\)|француз|разгибан.*(блок|голов)|кикбэк|кикбек|трицепс/i, 'Руки', 'triceps', 'iso'],
    [/бицепс|молотк|скотта|концентрир|подъём на нижнем блоке|подъем на нижнем блоке|обратным хватом/i, 'Руки', 'biceps', 'iso'],
    [/разведения в наклоне|задн.*дельт|обратная бабочка/i, 'Плечи', 'rear', 'iso'],
    [/махи|к подбородку/i, 'Плечи', 'side', 'iso'],
    [/армейск|арнольд|жим .*(сидя|стоя)|жим штанги из-за головы/i, 'Плечи', 'front', 'comp'],
    [/шраги/i, 'Спина', 'traps', 'iso'],
    [/подтягиван|верхнего блока|пуловер на верхнем/i, 'Спина', 'width', 'comp'],
    [/тяга (штанги|гантели|т-грифа|нижнего блока)|тяга т-/i, 'Спина', 'thickness', 'comp'],
    [/гиперэкстенз/i, 'Спина', 'lower', 'iso'],
    [/сгибания ног/i, 'Ноги', 'hams', 'iso'],
    [/ягодичн.*мост|хип-?траст|мостик/i, 'Ноги', 'glutes', 'comp'],
    [/разгибание бедра|отведение ноги|ягодиц/i, 'Ноги', 'glutes', 'iso'],
    [/румынск|сумо/i, 'Ноги', 'hams', 'comp'],
    [/становая/i, 'Спина', 'lower', 'comp'],
    [/носки/i, 'Ноги', 'calves', 'iso'],
    [/отведение ног|приведение ног/i, 'Ноги', 'glutes', 'iso'],
    [/разгибания ног/i, 'Ноги', 'quads', 'iso'],
    [/присед|жим ногами|гакк|выпад|болгарск|сплит/i, 'Ноги', 'quads', 'comp'],
    [/обратн.*наклон/i, 'Грудь', 'lower', 'comp'],
    [/брусь/i, 'Грудь', 'lower', 'comp'],
    [/кроссовер сверху/i, 'Грудь', 'lower', 'iso'],
    [/кроссовер снизу|разведения на наклонной/i, 'Грудь', 'upper', 'iso'],
    [/наклон/i, 'Грудь', 'upper', 'comp'],
    [/бабочк|разведени|кроссовер|пуловер/i, 'Грудь', 'middle', 'iso'],
    [/жим|отжиман/i, 'Грудь', 'middle', 'comp'],
  ];
  function classify(name) {
    for (const [re, group, region, kind] of RULES) if (re.test(name || '')) return { group, region, kind };
    return null;
  }
  /* зона простыми словами: «верх груди», «задние дельты» */
  function zonePlain(g, r) {
    const M = { 'Грудь': { upper: 'верх груди', middle: 'середину груди', lower: 'низ груди' }, 'Спина': { width: 'ширину спины', thickness: 'толщину спины', traps: 'трапеции' },
      'Плечи': { front: 'передние дельты', side: 'средние дельты', rear: 'задние дельты' }, 'Ноги': { quads: 'переднюю часть бедра', hams: 'заднюю часть бедра', calves: 'икры', glutes: 'ягодицы' } };
    return (M[g] && M[g][r]) || (REGION_LABEL[r] || '');
  }
  const REGION_LABEL = {
    upper: 'верх', middle: 'середина', lower: 'низ', width: 'ширина', thickness: 'толщина', traps: 'трапеции',
    quads: 'квадрицепс', hams: 'задняя поверхность', calves: 'икры', glutes: 'ягодицы', front: 'передняя дельта',
    side: 'средняя дельта', rear: 'задняя дельта', biceps: 'бицепс', triceps: 'трицепс', core: 'пресс',
  };

  /* ── Шаблоны групп: слоты по зонам (в порядке выполнения) ── */
  const SLOTS = {
    'Грудь': [
      { region: 'upper',  kind: 'comp', fb: ['Жим штанги наклон', 'Жим гантелей наклон'], why: 'верх груди первым, он обычно отстаёт' },
      { region: 'middle', kind: 'comp', fb: ['Жим штанги лёжа', 'Жим гантелей лёжа'] },
      { region: 'lower',  kind: null,   fb: ['Отжимания на брусьях', 'Кроссовер сверху'] },
      { region: 'upper',  kind: 'iso',  fb: ['Кроссовер снизу', 'Разведения на наклонной'] },
    ],
    'Спина': [
      { region: 'width',     kind: 'comp', fb: ['Подтягивания широкий хват', 'Тяга верхнего блока широкий'], why: 'ширина' },
      { region: 'thickness', kind: 'comp', fb: ['Тяга штанги в наклоне', 'Тяга Т-грифа'], why: 'толщина' },
      { region: 'thickness', kind: null,   fb: ['Тяга гантели одной рукой', 'Тяга нижнего блока'] },
      { region: 'width',     kind: null,   fb: ['Тяга верхнего блока узкий', 'Пуловер на верхнем блоке'] },
      { region: 'lower',     kind: null,   fb: ['Гиперэкстензия'] },
    ],
    'Ноги': [
      { region: 'quads',  kind: 'comp', fb: ['Приседания со штангой', 'Приседания гакк-машина', 'Жим ногами'] },
      { region: 'hams',   kind: null,   fb: ['Румынская тяга'] },
      { region: 'quads',  kind: 'comp', fb: ['Жим ногами', 'Болгарские сплит-приседания', 'Выпады гантели'] },
      { region: 'quads',  kind: 'iso',  fb: ['Разгибания ног'] },
      { region: 'hams',   kind: 'iso',  fb: ['Сгибания ног лёжа', 'Сгибания ног сидя'] },
      { region: 'calves', kind: null,   fb: ['Подъём на носки стоя', 'Подъём на носки сидя'] },
    ],
    'Плечи': [
      { region: 'front', kind: 'comp', fb: ['Жим гантелей сидя', 'Армейский жим'] },
      { region: 'side',  kind: null,   fb: ['Махи гантелей в стороны', 'Махи на нижнем блоке'] },
      { region: 'rear',  kind: null,   fb: ['Разведения в наклоне', 'Обратная бабочка (задняя дельта)'] },
    ],
    'Руки': [
      { region: 'biceps',  kind: null, fb: ['Подъём штанги на бицепс', 'Подъём гантелей на бицепс'] },
      { region: 'triceps', kind: null, fb: ['Французский жим EZ-гриф', 'Разгибания на верхнем блоке канат'] },
      { region: 'biceps',  kind: null, fb: ['Молотки гантели', 'Подъём на скамье Скотта'] },
      { region: 'triceps', kind: null, fb: ['Разгибания на верхнем блоке прямой', 'Разгибания из-за головы канат'] },
    ],
    'Кор': [
      { region: 'core', kind: null, fb: ['Подъём ног в висе', 'Скручивания на верхнем блоке'] },
      { region: 'core', kind: null, fb: ['Планка', 'Русский твист'] },
    ],
  };
  const DEFAULT_SPLITS = {
    2: [['Грудь', 'Спина', 'Плечи'], ['Ноги', 'Руки', 'Кор']],
    3: [['Грудь', 'Руки'], ['Спина', 'Плечи'], ['Ноги', 'Кор']],
    4: [['Грудь', 'Руки'], ['Спина', 'Плечи'], ['Ноги', 'Кор'], ['Грудь', 'Спина']],
    5: [['Грудь', 'Руки'], ['Спина', 'Плечи'], ['Ноги', 'Кор'], ['Грудь', 'Плечи'], ['Спина', 'Руки']],
  };

  /* ── Даты плана ── */
  function planDayDate(plan, dateStr) {
    const [dd, mm] = String(dateStr || '').split('.').map(Number);
    if (!dd || !mm) return null;
    const start = plan.startDate ? new Date(plan.startDate) : new Date();
    let d = new Date(start.getFullYear(), mm - 1, dd);
    if (d < new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7)) d = new Date(start.getFullYear() + 1, mm - 1, dd);
    return d;
  }
  function currentWeekIdx(plan) {
    const start = plan.startDate ? new Date(plan.startDate) : null;
    if (!start) return 0;
    start.setHours(0, 0, 0, 0);
    return Math.floor((Date.now() - start) / (7 * DAY));
  }
  const weekKey = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return x.toISOString().slice(0, 10); };

  /* ── День недели: берём подпись дня («пн»…), планы могли начинаться не с понедельника ── */
  const DOW_IDX = { 'пн': 0, 'вт': 1, 'ср': 2, 'чт': 3, 'пт': 4, 'сб': 5, 'вс': 6 };
  function dayDow(d, date) {
    const s = String((d && d.dow) || '').toLowerCase().slice(0, 2);
    if (s in DOW_IDX) return DOW_IDX[s];
    return date ? (date.getDay() + 6) % 7 : null;
  }
  function findDayIdx(week, dow) { return toArr(week && week.days).findIndex(x => x && dayDow(x, planDayDate({}, x.date)) === dow); }

  /* ── Одно упражнение под разными названиями ──
     «Жим штанга», «Жим штанги лёжа», «жим штанги лежа» → один ключ */
  const STOP = new Set(['на', 'с', 'со', 'в', 'из', 'за', 'для', 'к', 'по', 'и', 'от', 'до']);
  function stem(w) {
    w = w.replace(/ё/g, 'е');
    if (w.length > 4) w = w.replace(/(ами|ями|ого|его|ому|ему|ыми|ими|ой|ей|ий|ый|ая|яя|ое|ее|ые|ие|ам|ям|ах|ях|ом|ем|ую|юю|а|я|ы|и|у|ю|е|о|ь)$/, '');
    return w.slice(0, 7);
  }
  function exKey(name) {
    return String(name || '').toLowerCase().replace(/ё/g, 'е').replace(/\(.*?\)/g, ' ').replace(/[^a-zа-я0-9 ]+/g, ' ')
      .split(/\s+/).filter(t => t && !STOP.has(t)).map(stem).join(' ');
  }
  /* Склеиваем «короткое» название с единственным «длинным», которое его содержит */
  function mergeKeys(stats) {
    const keys = Object.keys(stats), alias = {}, merges = [];
    keys.forEach(k => {
      const tk = k.split(' ');
      const sup = keys.filter(o => o !== k && tk.every(t => o.split(' ').includes(t)));
      if (sup.length !== 1) return;
      const g1 = (classify(stats[k].name) || {}).group, g2 = (classify(stats[sup[0]].name) || {}).group;
      if (g1 && g2 && g1 !== g2) return;
      alias[k] = sup[0]; merges.push([stats[k].name, stats[sup[0]].name]);
    });
    const res = k => { let x = k, n = 0; while (alias[x] && n++ < 5) x = alias[x]; return x; };
    return { res, merges };
  }

  /* ── Сбор истории: все силовые тренировки до сегодня ── */
  /* упражнения со своим весом: у них 0 кг это нормально */
  const BODYW = /подтяг|отжим|брусь|планк|скруч|подъём ног|подъем ног|гиперэкст|пресс|вакуум/i;
  const aiSigOf = (s) => toArr(s.exercises).map(e => e ? (e.name + '|' + (+e.weight || 0) + '|' + e.reps + '|' + e.sets) : '').join(';');
  function collect(plans) {
    const today = new Date(); today.setHours(23, 59, 59, 0);
    const out = [];
    plans.filter(Boolean).forEach(p => toArr(p.weeks).forEach((w, wi) => toArr(w && w.days).forEach((d, di) => {
      if (!d) return;
      if (typeof trMigrateDayToSessions === 'function') trMigrateDayToSessions(d);
      const date = planDayDate(p, d.date);
      if (!date || date > today) return;
      const fresh = date >= new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
      toArr(d.sessions).forEach(s => {
        if (!s) return;
        /* AI-тренировка, которую поставили, но ещё не подтвердили и не меняли, не считается сделанной */
        if (s.ai && s.aiSig && !s.aiOk && fresh && s.aiSig === aiSigOf(s)) return;
        const ex = toArr(s.exercises).filter(e => e && e.kind === 'strength' && e.name && ((+e.weight || 0) > 0 || ((+e.reps || 0) > 0 && (!s.ai || BODYW.test(e.name)))));
        if (!ex.length) return;
        let groups = toArr(s.groups).filter(Boolean);
        if (groups.includes('FULL BODY')) groups = ['Грудь', 'Спина', 'Ноги'];
        if (!groups.length) groups = [...new Set(ex.map(e => (classify(e.name) || {}).group).filter(Boolean))];
        groups = [...new Set(groups.filter(g => GROUPS.includes(g)))].sort((a, b) => GROUPS.indexOf(a) - GROUPS.indexOf(b));
        out.push({ date, dow: dayDow(d, date), planId: p.id, planNum: p.number, wi, di, groups,
          exercises: ex.map((e, i) => ({ ...e, key: exKey(e.name), pos: i })) });
      });
    })));
    return out.sort((a, b) => a.date - b.date);
  }

  /* ── Анализ ── */
  function median(arr) { if (!arr.length) return 0; const s = arr.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; }
  function analyze(history, prefs) {
    prefs = prefs || {};
    /* названия → общие ключи */
    const raw = {};
    history.forEach(h => h.exercises.forEach(e => { const x = raw[e.key] || (raw[e.key] = { name: e.name, n: 0 }); x.n++; }));
    const { res, merges } = mergeKeys(raw);
    history.forEach(h => h.exercises.forEach(e => { e.key = res(e.key); }));

    const weekMap = {};
    history.forEach(h => { const k = weekKey(h.date); weekMap[k] = (weekMap[k] || 0) + 1; });
    const weeks = Object.keys(weekMap);
    let freq = Math.max(1, Math.min(6, median(Object.values(weekMap)) || 3));

    const dowCnt = new Array(7).fill(0);
    history.forEach(h => { if (h.dow != null) dowCnt[h.dow]++; });
    let trainDays = dowCnt.map((c, i) => ({ c, i })).filter(x => x.c > 0).sort((a, b) => b.c - a.c || a.i - b.i).slice(0, freq).map(x => x.i).sort((a, b) => a - b);
    const spread = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] }[freq];
    if (trainDays.length < freq) trainDays = spread;
    const prefDays = toArr(prefs.days).map(Number).filter(n => n >= 0 && n < 7);
    if (prefDays.length) { trainDays = prefDays.slice().sort((a, b) => a - b); freq = trainDays.length; }

    /* связки групп и их тренировки */
    const comboMap = {};
    history.forEach(h => {
      if (!h.groups.length) return;
      const k = h.groups.join('+');
      const c = comboMap[k] || (comboMap[k] = { key: k, groups: h.groups.slice(), c: 0, sessions: [], last: 0 });
      c.c++; c.sessions.push(h); c.last = Math.max(c.last, +h.date);
    });
    const combos = Object.values(comboMap).sort((a, b) => b.c - a.c || b.last - a.last);

    /* по упражнениям */
    const ex = {};
    history.forEach(h => h.exercises.forEach(e => {
      const x = ex[e.key] || (ex[e.key] = { key: e.key, name: e.name, names: {}, cls: null, count: 0, last: null, first: null, best1rm: 0 });
      x.count++; x.names[e.name] = (x.names[e.name] || 0) + 1;
      const rec = { sets: +e.sets || 0, reps: +e.reps || 0, weight: +e.weight || 0, date: h.date, planNum: h.planNum };
      if (!x.first) x.first = rec;
      (x.hist || (x.hist = [])).push(rec); if (x.hist.length > 16) x.hist.shift();
      x.last = rec; x.name = e.name; /* последнее использованное название */
      const rm = rec.weight > 0 && rec.reps > 0 ? rec.weight * (1 + rec.reps / 30) : 0;
      if (rm > x.best1rm) x.best1rm = rm;
    }));
    Object.values(ex).forEach(x => { x.cls = classify(x.name) || Object.keys(x.names).map(classify).find(Boolean) || null; });

    return { workouts: history.length, weeks: weeks.length, weekMap, freq, trainDays, dowCnt, combos, ex, merges,
      enough: weeks.length >= MIN_WEEKS || history.length >= MIN_WORKOUTS };
  }

  /* ── Сплит: только твои реальные связки ── */
  function buildSplit(an, prefs) {
    const want = toArr((prefs || {}).splits);
    if (want.length) {
      const sel = want.map(k => an.combos.find(c => c.key === k) || { key: k, groups: k.split('+'), c: 0, sessions: [] });
      if (sel.length) return sel;
    }
    const n = an.trainDays.length;
    const real = an.combos.filter(c => c.c >= 2);
    const pick = (real.length ? real : an.combos).slice(0, Math.max(n, Math.min(4, real.length)));
    if (pick.length) return pick;
    return (DEFAULT_SPLITS[n] || DEFAULT_SPLITS[3]).map(g => ({ key: g.join('+'), groups: g.slice(), c: 0, sessions: [] }));
  }

  /* Зоны, которые должны быть в тренировке группы */
  const MUST = { 'Спина': ['width', 'thickness'], 'Грудь': ['upper', 'middle'], 'Ноги': ['quads', 'hams'], 'Плечи': ['side', 'rear'], 'Руки': ['biceps', 'triceps'] };

  /* ── Тренировка для связки: из твоих тренировок с этой связкой ── */
  function sessionFor(combo, an) {
    const S = combo.sessions || [], n = S.length, items = [], added = [];
    if (n >= 2) {
      const agg = {};
      S.forEach(s => s.exercises.forEach(e => {
        const a = agg[e.key] || (agg[e.key] = { key: e.key, cnt: 0, pos: 0, lastDate: 0 });
        a.cnt++; a.pos += e.pos / Math.max(1, s.exercises.length - 1); a.lastDate = Math.max(a.lastDate, +s.date);
      }));
      const typical = Math.round(median(S.map(s => s.exercises.length))) || 5;
      const list = Object.values(agg)
        .map(a => ({ ...a, share: a.cnt / n, avgPos: a.pos / a.cnt }))
        .filter(a => a.share >= 0.3 || a.lastDate >= Math.max(...S.map(s => +s.date)))
        .sort((a, b) => b.share - a.share || b.lastDate - a.lastDate)
        .slice(0, Math.max(4, Math.min(8, typical)))
        .sort((a, b) => a.avgPos - b.avgPos);
      list.forEach(a => { const x = an.ex[a.key]; if (!x) return;
        items.push({ key: a.key, name: x.name, group: (x.cls && x.cls.group) || combo.groups[0], region: x.cls ? x.cls.region : '', isNew: false, share: Math.round(a.share * 100) }); });
    } else {
      const used = new Set();
      combo.groups.forEach((g, pos) => slotsFor(g, pos, combo.groups.length).forEach(slot => {
        const pick = pickExercise(slot, g, an, used); if (!pick) return;
        used.add(pick.key || pick.name);
        items.push({ key: pick.key || exKey(pick.name), name: pick.name, isNew: pick.isNew, group: g, region: slot.region });
      }));
    }
    /* закрываем пропущенные зоны: максимум одно новое упражнение на группу */
    if (n >= 2) combo.groups.forEach(g => {
      const need = (MUST[g] || []).filter(r => !items.some(it => it.group === g && it.region === r));
      if (!need.length || items.length >= 8) return;
      const slot = (SLOTS[g] || []).find(sl => sl.region === need[0]); if (!slot) return;
      const pick = pickExercise(slot, g, an, new Set(items.map(i => i.key)));
      if (!pick) return;
      const it = { key: pick.key || exKey(pick.name), name: pick.name, isNew: pick.isNew, group: g, region: need[0], why: 'не хватало: ' + (REGION_LABEL[need[0]] || need[0]) };
      /* базовое упражнение на «первую» зону группы (верх груди, ширина спины) ставим в начало группы */
      const first = slot.kind === 'comp' && (SLOTS[g] || [])[0] && SLOTS[g][0].region === need[0];
      const at = first ? items.map(i => i.group).indexOf(g) : items.map(i => i.group).lastIndexOf(g) + 1;
      items.splice(at >= 0 ? at : items.length, 0, it);
      added.push(g + ': ' + (REGION_LABEL[need[0]] || need[0]) + ' («' + pick.name + '»)');
    });
    return { key: combo.key, groups: combo.groups, items, from: n, added };
  }

  /* ── Подбор упражнения в слот: сначала твои любимые, потом база ── */
  function pickExercise(slot, group, an, used) {
    const mine = Object.values(an.ex)
      .filter(x => x.cls && x.cls.group === group && x.cls.region === slot.region && (!slot.kind || x.cls.kind === slot.kind) && !used.has(x.key) && !used.has(x.name))
      .sort((a, b) => b.count - a.count);
    if (mine.length) return { name: mine[0].name, key: mine[0].key, isNew: false };
    const fb = slot.fb.find(n => !used.has(n) && !used.has(exKey(n)));
    return fb ? { name: fb, key: exKey(fb), isNew: !an.ex[exKey(fb)] } : null;
  }

  /* Сколько упражнений на группу: одна группа за день — все слоты,
     две — основная побольше, три — по 2–3 */
  const COUNT = {
    main:   { 'Грудь': 4, 'Спина': 4, 'Ноги': 5, 'Плечи': 3, 'Руки': 3, 'Кор': 2 },
    second: { 'Грудь': 3, 'Спина': 3, 'Ноги': 4, 'Плечи': 3, 'Руки': 2, 'Кор': 2 },
    third:  { 'Грудь': 2, 'Спина': 2, 'Ноги': 3, 'Плечи': 2, 'Руки': 2, 'Кор': 2 },
  };
  function slotsFor(group, pos, groupsCount) {
    const all = SLOTS[group] || [];
    if (groupsCount === 1) return all.slice(0, 6);
    const table = groupsCount === 2 ? (pos === 0 ? COUNT.main : COUNT.second) : COUNT.third;
    return all.slice(0, table[group] || 2);
  }

  /* ── Прогрессия ── */
  /* ── Шаг веса: какие веса реально можно поставить ──
     Штанга: 2 блина на гриф, шаг = 2 × самый маленький блин в твоём зале.
     Гантели: шаг ряда гантелей. Блоки и тренажёры: шаг плиток стека.
     Настраивается в «Плане» → «Шаг веса». */
  const EQUIP = {
    bar:   { label: 'Штанга',             opts: [2.5, 5, 10],   def: 5 },
    db:    { label: 'Гантели',            opts: [1, 2, 2.5, 5], def: 2 },
    block: { label: 'Блоки и тренажёры',  opts: [1, 2.5, 5],    def: 5 },
  };
  function equipOf(name) {
    const n = String(name || '').toLowerCase();
    if (/гантел|молотк/.test(n)) return 'db';
    if (/блок|кроссовер|канат|бабочк|тренаж|машин|гакк|смит|жим ногами|разгибания ног|сгибания ног|пуловер|рычаж|хаммер|отведение ног|приведение ног|пек/.test(n)) return 'block';
    if (/штанг|гриф|ez|присед|станов|румынск|армейск|шраги|тяга т/.test(n)) return 'bar';
    return 'block';
  }
  function stepFor(name) {
    const e = equipOf(name), st = (prefsGet().steps || {})[e];
    return +st > 0 ? +st : EQUIP[e].def;
  }
  /* Ставим только достижимые веса: кратно шагу */
  const snap = (w, step) => Math.max(0, Math.round(w / step) * step);
  const upTo = (w, step) => Math.ceil((w + 0.001) / step) * step;          /* следующий вес выше текущего */
  const downTo = (w, step) => Math.max(step, Math.floor(w / step) * step); /* ближайший вес не выше */

  /* ── Цель тренировок: диапазон повторов и отдых ── */
  const GOALS = {
    mass:     { label: 'Масса',  lo: 8,  hi: 12, rest: '1,5–2 мин', compSets: 4, isoSets: 3 },
    strength: { label: 'Сила',   lo: 4,  hi: 6,  rest: '2–3 мин',   compSets: 5, isoSets: 3 },
    cut:      { label: 'Рельеф', lo: 12, hi: 15, rest: '45–60 с',   compSets: 3, isoSets: 3 },
  };
  let GOAL = GOALS.mass;

  /* ── Прогрессия по реальным результатам ──
     Смотрим два последних раза:
     • добрал верх диапазона → вес вверх, повторы с низа диапазона
     • два раза подряд не добрал низ диапазона → вес −7,5%
     • один раз не добрал → держим вес
     • иначе +1 повтор в неделю */
  function progression(key, name, an, weeksN, deloadLast) {
    const x = an.ex[key];
    const cls = (x && x.cls) || classify(name);
    const step = stepFor(name);
    const isCore = cls && cls.group === 'Кор';
    let G = GOAL;
    /* изоляция в силовом режиме не идёт на 4 повтора; отведения и махи в многоповторном диапазоне */
    if (cls && cls.kind === 'iso' && G.hi <= 6) G = { ...G, lo: 8, hi: 12 };
    if (/отведени/i.test(name)) G = { ...G, lo: Math.max(G.lo, 12), hi: Math.max(G.hi, 20) };
    const sets = cls && cls.kind === 'comp' ? G.compSets : G.isoSets;
    const out = [];
    const h = toArr(x && x.hist), last = h[h.length - 1], prev = h[h.length - 2];
    if (isCore) {
      let r = last && last.reps ? last.reps : 12;
      for (let k = 0; k < weeksN; k++) { r = Math.min(25, r + (k === 0 ? 0 : 2)); out.push({ sets: 3, reps: r, weight: last && last.weight ? last.weight : 0, up: false }); }
      return { rows: out, step, why: '' };
    }
    let w = last && last.weight ? last.weight : 0;
    let r = last && last.reps ? last.reps : G.lo;
    let why = '', first = null;
    /* прошлый вес берём как есть: раз ты его поднимал, такой вес в зале есть.
       Шаг нужен только чтобы понять, куда расти дальше */
    const e1 = (ww, rr) => ww * (1 + rr / 30);
    /* сколько повторов реально сделать с новым весом по оценке максимума, в пределах цели */
    const repsAt = (nw, ow, orr) => Math.max(G.lo, Math.min(G.hi, Math.floor(30 * (e1(ow, orr) / nw - 1))));
    if (last) {
      if (last.reps >= G.hi && w) { w = upTo(last.weight, step); r = repsAt(w, last.weight, last.reps); first = 'up'; why = `в прошлый раз ${last.reps} повторов, прибавляем вес`; }
      else if (last.reps < G.lo && prev && prev.reps < G.lo && w && prev.weight >= w) { w = downTo(w * 0.925, step); r = G.lo; first = 'down'; why = 'два раза не хватило повторов, вес чуть ниже'; }
      else if (last.reps < G.lo) { r = G.lo; first = 'hold'; why = 'не хватило повторов, вес тот же'; }
      else { r = Math.min(G.hi, last.reps + 1); first = 'rep'; }
    }
    for (let k = 0; k < weeksN; k++) {
      const deload = deloadLast && k === weeksN - 1;
      if (deload) { out.push({ sets: Math.max(2, sets - 1), reps: G.lo + 2, weight: w ? downTo(w * 0.85, step) : 0, up: false, deload: true }); continue; }
      let up = false, down = false;
      if (k === 0) { up = first === 'up'; down = first === 'down'; }
      else if (r >= G.hi) { if (w) { const ow = w; w = upTo(w, step); up = true; r = repsAt(w, ow, G.hi); } else r = G.lo; }
      else r = Math.max(G.lo, r + 1);
      out.push({ sets, reps: r, weight: w, up, down });
    }
    return { rows: out, step, why };
  }

  /* ── С какой недели заполнять: текущая, если на ней ещё нет записанных тренировок ── */
  function autoFromWeek(plan) {
    const cw = currentWeekIdx(plan);
    if (cw < 0) return 0;
    const wk = toArr(plan.weeks)[cw];
    const busy = wk && collect([plan]).some(h => h.wi === cw);
    return busy ? cw + 1 : cw;
  }
  /* ── Из каких планов брать данные ── */
  function planSources(plans) {
    return plans.filter(Boolean).map(p => ({ p, n: collect([p]).length })).filter(x => x.n > 0);
  }
  function chosenPlans(plans) {
    const src = planSources(plans);
    const saved = toArr((Store.get().training || {}).aiSources);
    const on = src.filter(x => !saved.length || saved.includes(x.p.id));
    return { src, on: on.length ? on : src };
  }
  function sourcesHtml(src, on, plan) {
    if (!src.length || (src.length === 1 && plan && src[0].p.id === plan.id)) return '';
    const ids = new Set(on.map(x => x.p.id));
    return `<div class="ai-src"><div class="ai-src-t"><i class="ti ti-database"></i> Беру данные из планов</div><div class="ai-src-chips">${src.map(x => `<button class="ai-src-chip${ids.has(x.p.id) ? ' on' : ''}" data-id="${esc(x.p.id)}"><i class="ti ${ids.has(x.p.id) ? 'ti-circle-check' : 'ti-circle'}"></i>План №${esc(x.p.number || '')}<span>${x.n} трен.${plan && x.p.id === plan.id ? ' · текущий' : ''}</span></button>`).join('')}</div></div>`;
  }
  function bindSources(content, plan, h, src, on) {
    content.querySelectorAll('.ai-src-chip').forEach(b => b.addEventListener('click', () => {
      const ids = new Set(on.map(x => x.p.id));
      if (ids.has(b.dataset.id)) { if (ids.size === 1) return; ids.delete(b.dataset.id); } else ids.add(b.dataset.id);
      Store.set('training.aiSources', [...ids]);
      render(content, plan, h);
    }));
  }

  /* подпись истории: меняется, когда появилась/изменилась тренировка */
  function sigOf(history) {
    let n = 0; history.forEach(h => h.exercises.forEach(e => { n = (n * 31 + ((+e.weight || 0) * 100 + (+e.reps || 0) * 7 + (+e.sets || 0))) % 1e9; }));
    return history.length + ':' + n;
  }

  /* ── Генерация ── */
  function prefsGet() { return (Store.get().training || {}).aiPrefs || {}; }
  /* ══ Научная методика ══
     Принципы из исследований и программ топовых тренеров:
     • каждая мышца 2 раза в неделю (Schoenfeld, мета-анализ 2016);
     • 10–20 рабочих подходов на мышцу в неделю, начинаем ближе к нижней границе
       и добавляем к концу блока, потом разгрузка (Israetel, Renaissance Periodization);
     • сплит под число дней: всё тело, верх/низ, тяни/толкай/ноги (Nippard, Helms);
     • базовые движения первыми, затем изоляция; в разные дни разные вариации;
     • двойная прогрессия и 1–3 повтора в запасе (RIR). */
  const LIB = {
    'Грудь|middle|comp': ['Жим штанги лёжа', 'Жим гантелей лёжа', 'Отжимания на брусьях'],
    'Грудь|upper|comp': ['Жим штанги наклон', 'Жим гантелей наклон'],
    'Грудь|middle|iso': ['Бабочка', 'Кроссовер', 'Разведения гантелей лёжа'],
    'Грудь|upper|iso': ['Кроссовер снизу', 'Разведения на наклонной'],
    'Спина|width|comp': ['Подтягивания широкий хват', 'Тяга верхнего блока широкий', 'Тяга верхнего блока узкий'],
    'Спина|thickness|comp': ['Тяга штанги в наклоне', 'Тяга гантели одной рукой', 'Тяга нижнего блока', 'Тяга Т-грифа'],
    'Ноги|quads|comp': ['Приседания со штангой', 'Жим ногами', 'Приседания гакк-машина', 'Болгарские сплит-приседания'],
    'Ноги|quads|iso': ['Разгибания ног'],
    'Ноги|hams|comp': ['Румынская тяга', 'Становая тяга сумо'],
    'Ноги|hams|iso': ['Сгибания ног лёжа', 'Сгибания ног сидя'],
    'Ноги|calves|iso': ['Подъём на носки стоя', 'Подъём на носки сидя'],
    'Плечи|front|comp': ['Жим гантелей сидя', 'Армейский жим'],
    'Плечи|side|iso': ['Махи гантелей в стороны', 'Махи на нижнем блоке'],
    'Плечи|rear|iso': ['Разведения в наклоне', 'Обратная бабочка (задняя дельта)'],
    'Руки|biceps|iso': ['Подъём штанги на бицепс', 'Молотки гантели', 'Подъём на скамье Скотта'],
    'Руки|triceps|iso': ['Разгибания на верхнем блоке канат', 'Французский жим EZ-гриф', 'Разгибания из-за головы канат'],
    'Кор|core|iso': ['Подъём ног в висе', 'Скручивания на верхнем блоке', 'Планка'],
    'Ноги|glutes|comp': ['Ягодичный мост со штангой', 'Хип-траст в тренажёре', 'Ягодичный мост в Смите'],
    'Ноги|glutes|iso': ['Отведение ног в тренажёре', 'Отведение ноги в кроссовере', 'Разгибание бедра в кроссовере'],
  };
  /* для новичков и девушек сначала тренажёры и гантели: проще освоить технику */
  const LIB_EASY = {
    'Грудь|middle|comp': ['Жим гантелей лёжа', 'Жим от груди в тренажёре', 'Жим штанги лёжа'],
    'Грудь|upper|comp': ['Жим гантелей наклон', 'Жим штанги наклон'],
    'Спина|width|comp': ['Тяга верхнего блока широкий', 'Тяга верхнего блока узкий', 'Подтягивания в гравитроне'],
    'Спина|thickness|comp': ['Тяга нижнего блока', 'Тяга гантели одной рукой', 'Тяга штанги в наклоне'],
    'Ноги|quads|comp': ['Жим ногами', 'Гоблет-присед', 'Выпады с гантелями', 'Приседания со штангой'],
    'Ноги|hams|comp': ['Румынская тяга с гантелями', 'Румынская тяга'],
    'Плечи|front|comp': ['Жим гантелей сидя', 'Жим сидя в тренажёре'],
  };
  const T = (g, r, k, v) => ({ g, r, k, v: v || 0 });
  const DAYS = {
    fbA: { t: 'Всё тело A', s: [T('Ноги', 'quads', 'comp'), T('Грудь', 'middle', 'comp'), T('Спина', 'width', 'comp'), T('Ноги', 'hams', 'iso'), T('Плечи', 'side', 'iso'), T('Руки', 'biceps', 'iso')] },
    fbB: { t: 'Всё тело B', s: [T('Ноги', 'hams', 'comp'), T('Грудь', 'upper', 'comp'), T('Спина', 'thickness', 'comp'), T('Ноги', 'quads', 'comp', 1), T('Плечи', 'rear', 'iso'), T('Руки', 'triceps', 'iso')] },
    fbC: { t: 'Всё тело C', s: [T('Ноги', 'quads', 'comp', 1), T('Грудь', 'middle', 'comp', 1), T('Спина', 'width', 'comp', 1), T('Плечи', 'front', 'comp'), T('Руки', 'biceps', 'iso', 1), T('Кор', 'core', 'iso')] },
    upA: { t: 'Верх A', s: [T('Грудь', 'middle', 'comp'), T('Спина', 'thickness', 'comp'), T('Плечи', 'front', 'comp'), T('Спина', 'width', 'comp'), T('Плечи', 'side', 'iso'), T('Руки', 'triceps', 'iso'), T('Руки', 'biceps', 'iso')] },
    upB: { t: 'Верх B', s: [T('Грудь', 'upper', 'comp'), T('Спина', 'width', 'comp', 1), T('Спина', 'thickness', 'comp', 1), T('Грудь', 'middle', 'iso'), T('Плечи', 'side', 'iso', 1), T('Руки', 'biceps', 'iso', 1), T('Руки', 'triceps', 'iso', 1)] },
    loA: { t: 'Низ A', s: [T('Ноги', 'quads', 'comp'), T('Ноги', 'hams', 'comp'), T('Ноги', 'quads', 'iso'), T('Ноги', 'hams', 'iso'), T('Ноги', 'calves', 'iso'), T('Кор', 'core', 'iso')] },
    loB: { t: 'Низ B', s: [T('Ноги', 'hams', 'comp', 1), T('Ноги', 'quads', 'comp', 1), T('Ноги', 'quads', 'comp', 2), T('Ноги', 'hams', 'iso', 1), T('Ноги', 'calves', 'iso', 1), T('Кор', 'core', 'iso', 1)] },
    push: { t: 'Толкай', s: [T('Грудь', 'middle', 'comp'), T('Грудь', 'upper', 'comp'), T('Плечи', 'front', 'comp'), T('Плечи', 'side', 'iso'), T('Грудь', 'upper', 'iso'), T('Руки', 'triceps', 'iso')] },
    pull: { t: 'Тяни', s: [T('Спина', 'width', 'comp'), T('Спина', 'thickness', 'comp'), T('Спина', 'thickness', 'comp', 1), T('Плечи', 'rear', 'iso'), T('Руки', 'biceps', 'iso'), T('Руки', 'biceps', 'iso', 1)] },
    legs: { t: 'Ноги', s: [T('Ноги', 'quads', 'comp'), T('Ноги', 'hams', 'comp'), T('Ноги', 'quads', 'iso'), T('Ноги', 'hams', 'iso'), T('Ноги', 'calves', 'iso'), T('Кор', 'core', 'iso')] },
    push2: { t: 'Толкай B', s: [T('Грудь', 'upper', 'comp'), T('Плечи', 'front', 'comp'), T('Грудь', 'middle', 'comp', 1), T('Плечи', 'side', 'iso', 1), T('Грудь', 'middle', 'iso'), T('Руки', 'triceps', 'iso', 1)] },
    pull2: { t: 'Тяни B', s: [T('Спина', 'thickness', 'comp', 1), T('Спина', 'width', 'comp', 1), T('Спина', 'thickness', 'comp', 2), T('Плечи', 'rear', 'iso', 1), T('Руки', 'biceps', 'iso', 2), T('Руки', 'biceps', 'iso', 1)] },
    legs2: { t: 'Ноги B', s: [T('Ноги', 'hams', 'comp', 1), T('Ноги', 'quads', 'comp', 1), T('Ноги', 'quads', 'comp', 2), T('Ноги', 'hams', 'iso', 1), T('Ноги', 'calves', 'iso', 1), T('Кор', 'core', 'iso', 1)] },
  };
  /* девушкам: больше ног и ягодиц (2–3 раза в неделю), верх поддерживающим объёмом */
  const FDAYS = {
    ffA: { t: 'Всё тело A', s: [T('Ноги', 'glutes', 'comp'), T('Ноги', 'quads', 'comp'), T('Спина', 'width', 'comp'), T('Грудь', 'middle', 'comp'), T('Ноги', 'glutes', 'iso'), T('Плечи', 'side', 'iso')] },
    ffB: { t: 'Всё тело B', s: [T('Ноги', 'hams', 'comp'), T('Ноги', 'quads', 'comp', 1), T('Спина', 'thickness', 'comp'), T('Плечи', 'front', 'comp'), T('Ноги', 'glutes', 'iso', 1), T('Кор', 'core', 'iso')] },
    ffC: { t: 'Всё тело C', s: [T('Ноги', 'glutes', 'comp', 1), T('Ноги', 'hams', 'iso'), T('Спина', 'width', 'comp', 1), T('Плечи', 'rear', 'iso'), T('Руки', 'triceps', 'iso'), T('Руки', 'biceps', 'iso')] },
    flA: { t: 'Ноги и ягодицы A', s: [T('Ноги', 'glutes', 'comp'), T('Ноги', 'quads', 'comp'), T('Ноги', 'hams', 'comp'), T('Ноги', 'glutes', 'iso'), T('Ноги', 'quads', 'iso'), T('Кор', 'core', 'iso')] },
    flB: { t: 'Ноги и ягодицы B', s: [T('Ноги', 'hams', 'comp', 1), T('Ноги', 'glutes', 'comp', 1), T('Ноги', 'quads', 'comp', 1), T('Ноги', 'hams', 'iso'), T('Ноги', 'glutes', 'iso', 1), T('Ноги', 'calves', 'iso')] },
    fuA: { t: 'Верх A', s: [T('Спина', 'width', 'comp'), T('Грудь', 'middle', 'comp'), T('Спина', 'thickness', 'comp'), T('Плечи', 'side', 'iso'), T('Руки', 'triceps', 'iso'), T('Кор', 'core', 'iso')] },
    fuB: { t: 'Верх B', s: [T('Плечи', 'front', 'comp'), T('Спина', 'width', 'comp', 1), T('Грудь', 'upper', 'comp'), T('Плечи', 'rear', 'iso'), T('Руки', 'biceps', 'iso'), T('Плечи', 'side', 'iso', 1)] },
    fgl: { t: 'Ягодицы', s: [T('Ноги', 'glutes', 'comp', 2), T('Ноги', 'hams', 'comp'), T('Ноги', 'glutes', 'iso', 2), T('Ноги', 'quads', 'comp', 2), T('Кор', 'core', 'iso', 1)] },
  };
  Object.assign(DAYS, FDAYS);
  const SMART_SPLIT_F = {
    1: { name: 'Всё тело', d: ['ffA'] },
    2: { name: 'Всё тело A/B', d: ['ffA', 'ffB'] },
    3: { name: 'Всё тело A/B/C', d: ['ffA', 'ffB', 'ffC'] },
    4: { name: 'Низ / Верх ×2', d: ['flA', 'fuA', 'flB', 'fuB'] },
    5: { name: 'Низ / Верх ×2 + Ягодицы', d: ['flA', 'fuA', 'flB', 'fuB', 'fgl'] },
    6: { name: 'Низ / Верх ×2 + Ягодицы + Верх', d: ['flA', 'fuA', 'flB', 'fuB', 'fgl', 'fuA'] },
    7: { name: 'Низ / Верх ×2 + Ягодицы + Верх', d: ['flA', 'fuA', 'flB', 'fuB', 'fgl', 'fuA'] },
  };
  const SMART_SPLIT = {
    1: { name: 'Всё тело', d: ['fbA'] },
    2: { name: 'Всё тело A/B', d: ['fbA', 'fbB'] },
    3: { name: 'Всё тело A/B/C', d: ['fbA', 'fbB', 'fbC'] },
    4: { name: 'Верх / Низ ×2', d: ['upA', 'loA', 'upB', 'loB'] },
    5: { name: 'Верх / Низ + Толкай / Тяни / Ноги', d: ['upA', 'loA', 'push', 'pull', 'legs'] },
    6: { name: 'Толкай / Тяни / Ноги ×2', d: ['push', 'pull', 'legs', 'push2', 'pull2', 'legs2'] },
    7: { name: 'Толкай / Тяни / Ноги ×2', d: ['push', 'pull', 'legs', 'push2', 'pull2', 'legs2'] },
  };
  /* подходов в неделю на зону: старт блока (ближе к нижней границе), к концу +20–30% */
  const VOL = { glutes: 8, middle: 7, upper: 5, width: 7, thickness: 7, quads: 9, hams: 7, calves: 6, front: 4, side: 8, rear: 6, biceps: 8, triceps: 8, core: 6 };
  const VOL_K = { mass: 1, strength: 0.8, cut: 0.85 };
  const GROUP_OF_REGION = { glutes: 'Ноги', middle: 'Грудь', upper: 'Грудь', width: 'Спина', thickness: 'Спина', quads: 'Ноги', hams: 'Ноги', calves: 'Ноги', front: 'Плечи', side: 'Плечи', rear: 'Плечи', biceps: 'Руки', triceps: 'Руки', core: 'Кор' };

  /* варианты упражнения на слот: сначала твои по частоте, потом база */
  function poolFor(slot, an) {
    const mine = Object.values(an.ex).filter(x => x.cls && x.cls.group === slot.g && x.cls.region === slot.r && (slot.k === 'iso' ? true : x.cls.kind === 'comp'))
      .sort((a, b) => b.count - a.count).map(x => ({ key: x.key, name: x.name, isNew: false }));
    const lk = slot.g + '|' + slot.r + '|' + slot.k, easy = poolFor.easy && LIB_EASY[lk];
    const lib = (easy || LIB[lk] || LIB[slot.g + '|' + slot.r + '|iso'] || []).map(n => ({ key: exKey(n), name: n, isNew: !an.ex[exKey(n)] }));
    const out = []; mine.concat(lib).forEach(x => { if (!out.some(y => y.key === x.key)) out.push(x); });
    return out;
  }
  /* опыт: выбран вручную или по истории (меньше 8 недель записей — новичок) */
  function levelOf(an, prefs) { return prefs.level === 'new' || prefs.level === 'exp' ? prefs.level : (an.weeks >= 4 || an.workouts >= 12 ? 'exp' : 'new'); }
  function smartSessions(an, prefs) {
    const n = Math.max(1, Math.min(7, an.trainDays.length));
    const fem = prefs.sex === 'f', lvl = levelOf(an, prefs);
    poolFor.easy = fem || lvl === 'new';
    const sp = (fem ? SMART_SPLIT_F : SMART_SPLIT)[n];
    const keys = sp.d.slice(0, n);
    const weekUsed = {}; /* зона → уже взятые упражнения, чтобы в разные дни были разные вариации */
    const sessions = keys.map(k => {
      const D = DAYS[k], dayUsed = new Set(), items = [];
      /* новичку 5 упражнений за тренировку, чтобы освоить технику и не выдохнуться */
      (lvl === 'new' ? D.s.slice(0, 5) : D.s).forEach(slot => {
        const pool = poolFor(slot, an).filter(p => !dayUsed.has(p.key)); if (!pool.length) return;
        const zk = slot.g + '|' + slot.r, used = weekUsed[zk] || (weekUsed[zk] = []);
        /* вариация v: v-я по счёту из ещё не взятых на неделе, иначе самое частое */
        const fresh = pool.filter(p => !used.includes(p.key));
        const pick = fresh[Math.min(slot.v, Math.max(0, fresh.length - 1))] || pool[0];
        used.push(pick.key); dayUsed.add(pick.key);
        items.push({ key: pick.key, name: pick.name, isNew: pick.isNew, group: slot.g, region: slot.r, kind: slot.k });
      });
      return { key: k, title: D.t, groups: [...new Set(items.map(i => i.group))], items };
    });
    /* подходы: главное базовое дня 4, остальное 3. Если на зону за неделю выходит
       больше разумного потолка (верх диапазона 10–20 на мышцу), срезаем изоляцию до 2 */
    const CAP = fem ? { glutes: 16, quads: 12, hams: 12, calves: 6, middle: 6, upper: 4, width: 10, thickness: 8, front: 4, side: 10, rear: 6, biceps: 6, triceps: 6, core: 8 } : { glutes: 8, middle: 12, upper: 10, width: 12, thickness: 12, quads: 16, hams: 12, calves: 8, front: 6, side: 14, rear: 10, biceps: 12, triceps: 12, core: 8 };
    const K = VOL_K[prefs.goal] || 1;
    sessions.forEach(s => { let main = true; s.items.forEach(it => {
      if (it.kind === 'comp' && main) { it.sets = lvl === 'new' ? 3 : 4; main = false; } else it.sets = 3;
      if (K < 1 && it.kind !== 'comp') it.sets = Math.max(2, it.sets - 1);
    }); });
    const tot = () => { const t = {}; sessions.forEach(s => s.items.forEach(it => { t[it.region] = (t[it.region] || 0) + it.sets; })); return t; };
    for (let guard = 0; guard < 40; guard++) {
      const t = tot(), over = Object.keys(t).find(r => t[r] > (CAP[r] || 12)); if (!over) break;
      const it = sessions.flatMap(s => s.items).filter(x => x.region === over && x.sets > 2).sort((a, b) => (a.kind === 'comp') - (b.kind === 'comp') || b.sets - a.sets)[0];
      if (!it) break; it.sets--;
    }
    const vol = {};
    sessions.forEach(s => s.items.forEach(it => { vol[it.group] = (vol[it.group] || 0) + it.sets; }));
    return { name: sp.name, sessions, vol };
  }

  /* ══ Автоплан по твоим тренировкам ══
     Берём твои упражнения по группам мышц, закрываем пропущенные зоны,
     расставляем группы по дням с отдыхом между ними и ведём прогрессию.
     Основа: грудь, спина, ноги. К ним руки, плечи и пресс там, где они не мешают:
     трицепс после груди, бицепс после спины. */
  const P = (g, r, n, t) => ({ g, r, n, t });
  const ADAY = {
    full:  { t: 'Всё тело', parts: [P('Ноги', null, 2), P('Грудь', null, 2), P('Спина', null, 2), P('Плечи', 'side', 1), P('Руки', null, 1)] },
    upper: { t: 'Верх', parts: [P('Грудь', null, 3), P('Спина', null, 3), P('Плечи', null, 1), P('Руки', 'biceps', 1), P('Руки', 'triceps', 1)] },
    chest: { t: 'Грудь + трицепс', parts: [P('Грудь', null, 4), P('Руки', 'triceps', 2)] },
    back:  { t: 'Спина + бицепс', parts: [P('Спина', null, 4), P('Руки', 'biceps', 2)] },
    backS: { t: 'Спина + плечи + бицепс', parts: [P('Спина', null, 4), P('Плечи', null, 2), P('Руки', 'biceps', 1)] },
    legs:  { t: 'Ноги + пресс', parts: [P('Ноги', null, 5), P('Кор', null, 1)] },
    shArm: { t: 'Плечи + руки', parts: [P('Плечи', null, 3), P('Руки', 'biceps', 2), P('Руки', 'triceps', 2)] },
    shCor: { t: 'Плечи + пресс', parts: [P('Плечи', null, 3), P('Кор', null, 2)] },
    arms:  { t: 'Руки', parts: [P('Руки', 'biceps', 3), P('Руки', 'triceps', 3)] },
  };
  /* порядок дней подобран так, чтобы одни и те же мышцы не шли подряд */
  const ASPLIT = { 1: ['full'], 2: ['upper', 'legs'], 3: ['chest', 'legs', 'backS'], 4: ['chest', 'back', 'legs', 'shArm'], 5: ['chest', 'back', 'legs', 'shCor', 'arms'], 6: ['chest', 'back', 'legs', 'shCor', 'arms', 'upper'], 7: ['chest', 'back', 'legs', 'shCor', 'arms', 'upper'] };
  function autoSessions(an) {
    const n = Math.max(1, Math.min(7, an.trainDays.length));
    const keys = ASPLIT[n];
    /* средняя позиция упражнения в твоих тренировках: чтобы порядок был привычный */
    return keys.map(k => {
      const D = ADAY[k], items = [], added = [], used = new Set();
      D.parts.forEach(pt => {
        const mine = Object.values(an.ex).filter(x => x.cls && x.cls.group === pt.g && (!pt.r || x.cls.region === pt.r) && !used.has(x.key))
          .sort((a, b) => b.count - a.count);
        const take = [], mustFill = new Set();
        /* сначала по одному на каждую важную зону группы: твоё, а если зоны не было, одно новое */
        const must = pt.r ? [pt.r] : (MUST[pt.g] || []);
        must.forEach(r => { if (take.length >= pt.n) return;
          const m = mine.find(x => x.cls.region === r && !take.includes(x));
          if (m) take.push(m);
          else { const slot = (SLOTS[pt.g] || []).find(sl => sl.region === r); const fb = slot && slot.fb.find(nm => !used.has(exKey(nm)));
            if (fb) { const x = { key: exKey(fb), name: fb, cls: classify(fb) || { group: pt.g, region: r, kind: slot.kind }, fresh: true }; take.push(x); if (mine.length) { mustFill.add(x.key); added.push(pt.g + ': ' + (REGION_LABEL[r] || r) + ' («' + fb + '»)'); } } }
        });
        /* дальше твои самые частые упражнения этой группы */
        mine.forEach(x => { if (take.length < pt.n && !take.includes(x)) take.push(x); });
        /* свои не заменяем: добираем базой только до трёх четвертей нормы (или всю норму, если группу ещё не делал) */
        const want = mine.length ? Math.min(pt.n, Math.max(take.length, Math.ceil(pt.n * 0.75))) : pt.n;
        (SLOTS[pt.g] || []).forEach(sl => { if (take.length >= want || (pt.r && sl.region !== pt.r)) return;
          const fb = sl.fb.find(nm => !used.has(exKey(nm)) && !take.some(t => t.key === exKey(nm))); if (fb) take.push({ key: exKey(fb), name: fb, cls: classify(fb) || { group: pt.g, region: sl.region, kind: sl.kind }, fresh: true }); });
        /* базовые первыми */
        take.sort((a, b) => ((b.cls && b.cls.kind === 'comp') - (a.cls && a.cls.kind === 'comp')));
        take.forEach(x => { used.add(x.key);
          items.push({ key: x.key, name: x.name, group: pt.g, region: x.cls ? x.cls.region : '', isNew: !an.ex[x.key],
            why: mustFill.has(x.key) ? 'не хватало: ' + (REGION_LABEL[x.cls && x.cls.region] || '') : '' }); });
      });
      return { key: k, title: D.t, groups: [...new Set(items.map(i => i.group))], items, added, from: 0 };
    });
  }

  /* ══════════ Очередь тренировок ══════════
     План не привязан к дням недели: это круг тренировок Т1 → Т2 → Т3 → снова Т1.
     Пришёл в зал в любой день, берёшь следующую. Состав тренировок из твоей истории:
     какие группы ты делаешь вместе, столько раз в неделю, сколько обычно.
     Крупные группы (грудь, спина, ноги) разводятся по разным тренировкам,
     одна и та же группа не стоит в соседних тренировках круга. */
  const UNITS = ['Грудь', 'Спина', 'Ноги', 'Ягодицы', 'Плечи', 'Бицепс', 'Трицепс', 'Кор'];
  const BIG = new Set(['Грудь', 'Спина', 'Ноги', 'Ягодицы']);
  const UNIT_G = { 'Бицепс': ['Руки', 'biceps'], 'Трицепс': ['Руки', 'triceps'], 'Ягодицы': ['Ноги', 'glutes'] };
  const unitOf = (g, region) => g === 'Руки' ? (region === 'triceps' ? 'Трицепс' : 'Бицепс') : (g === 'Ноги' && region === 'glutes') ? 'Ягодицы' : g;
  const GLUTE_SLOTS = [{ region: 'glutes', kind: 'comp', fb: ['Ягодичный мост со штангой', 'Хип-траст в тренажёре', 'Гиперэкстензия на ягодицы'] }, { region: 'glutes', kind: 'iso', fb: ['Отведение ног в тренажёре', 'Разгибание бедра в кроссовере', 'Отведение ноги в кроссовере'] }];
  const slotsOf = (u) => u === 'Ягодицы' ? GLUTE_SLOTS : (SLOTS[unitGroup(u)] || []).filter(sl => u !== 'Ноги' || sl.region !== 'glutes');
  const unitGroup = (u) => (UNIT_G[u] || [u])[0];
  const unitRegion = (u) => (UNIT_G[u] || [])[1] || null;
  const titleOf = (units) => units.map((u, i) => i ? u.toLowerCase() : u).join(' + ');
  /* без истории: нейтральные связки, их легко поправить нажатием */
  const Q_DEFAULT = {
    1: [['Грудь', 'Спина', 'Ноги', 'Плечи']],
    2: [['Грудь', 'Спина', 'Плечи', 'Бицепс', 'Трицепс'], ['Ноги', 'Кор']],
    3: [['Грудь', 'Трицепс'], ['Спина', 'Бицепс'], ['Ноги', 'Плечи', 'Кор']],
    4: [['Грудь', 'Трицепс'], ['Спина', 'Бицепс'], ['Ноги', 'Кор'], ['Плечи', 'Бицепс', 'Трицепс']],
    5: [['Грудь', 'Трицепс'], ['Спина', 'Бицепс'], ['Ноги', 'Кор'], ['Плечи', 'Трицепс'], ['Ноги', 'Бицепс']],
    6: [['Грудь', 'Трицепс'], ['Спина', 'Бицепс'], ['Ноги', 'Кор'], ['Грудь', 'Плечи'], ['Спина', 'Трицепс'], ['Ноги', 'Бицепс']],
  };
  /* без истории, акцент на ноги и ягодицы: низ дважды за круг, верх тела отдельным днём */
  const Q_LOWER = {
    1: [['Ягодицы', 'Ноги', 'Спина', 'Плечи']],
    2: [['Ягодицы', 'Ноги', 'Кор'], ['Спина', 'Плечи', 'Грудь', 'Трицепс']],
    3: [['Ягодицы', 'Ноги'], ['Спина', 'Плечи', 'Трицепс'], ['Ягодицы', 'Ноги', 'Кор']],
    4: [['Ягодицы', 'Ноги'], ['Спина', 'Плечи', 'Бицепс'], ['Ягодицы', 'Ноги', 'Кор'], ['Плечи', 'Грудь', 'Трицепс']],
    5: [['Ягодицы', 'Ноги'], ['Спина', 'Плечи', 'Бицепс'], ['Ягодицы', 'Кор'], ['Плечи', 'Грудь', 'Трицепс'], ['Ноги', 'Ягодицы']],
    6: [['Ягодицы', 'Ноги'], ['Спина', 'Бицепс'], ['Ягодицы', 'Кор'], ['Плечи', 'Грудь', 'Трицепс'], ['Ноги', 'Ягодицы'], ['Спина', 'Плечи']],
  };
  function sessionUnits(h) {
    const u = new Set();
    h.exercises.forEach(e => { const c = classify(e.name); if (c) u.add(unitOf(c.group, c.region)); });
    if (!u.size) h.groups.forEach(g => { if (g === 'Руки') { u.add('Бицепс'); u.add('Трицепс'); } else u.add(g); });
    return [...u].filter(x => UNITS.includes(x));
  }
  /* сколько тренировок в круге и какие группы в каждой */
  function buildLayout(history, an, prefs) {
    const N = Math.max(1, Math.min(6, +prefs.n || an.freq || 3));
    const notes = [];
    /* ручная раскладка: пользователь сам переставил группы */
    const manual = toArr(prefs.layout).map(t => toArr(t).filter(u => UNITS.includes(u)));
    if (manual.length === N && manual.every(t => t.length)) return { N, trainings: manual, manual: true, notes, added: [] };
    const recent = history.slice(-40);
    if (recent.length < 3) return { N, trainings: (prefs.focus === 'lower' ? Q_LOWER : Q_DEFAULT)[N].map(t => t.slice()), manual: false, notes: [prefs.focus === 'lower' ? 'Тренировок пока мало, поэтому раскладка с акцентом на ноги и ягодицы: низ два раза за круг, упражнения в эти дни разные' : 'Тренировок пока мало, поэтому раскладка стандартная. Поменять можно нажатием на мышцу'], added: [] };
    const cnt = {}, C = {};
    const sess = recent.map(sessionUnits);
    sess.forEach(us => us.forEach(a => { cnt[a] = (cnt[a] || 0) + 1; us.forEach(b => { if (a !== b) { C[a] = C[a] || {}; C[a][b] = (C[a][b] || 0) + 1; } }); }));
    const weeks = Math.max(1, new Set(recent.map(x => weekKey(x.date))).size);
    const aff = (a, b) => (C[a] && C[a][b]) || 0;
    /* сколько раз в круге: как часто ты её делаешь в неделю */
    const k = {};
    UNITS.forEach(u => { if ((cnt[u] || 0) >= 2 || (cnt[u] && recent.length < 8)) k[u] = Math.max(1, Math.min(N, Math.round(cnt[u] / weeks))); });
    /* закрываем пропуски: крупная группа, которую ты вообще не тренировал */
    const added = [];
    ['Грудь', 'Спина', 'Ноги', 'Плечи', 'Бицепс', 'Трицепс'].forEach(u => { if (!k[u]) { k[u] = 1; added.push(u); } });
    if (added.length) notes.push('Добавил, чего не было в истории: ' + added.join(', ').toLowerCase());
    const T = Array.from({ length: N }, () => []);
    const order = Object.keys(k).sort((a, b) => (BIG.has(b) - BIG.has(a)) || k[b] - k[a] || (cnt[b] || 0) - (cnt[a] || 0));
    order.forEach(u => {
      for (let i = 0; i < k[u]; i++) {
        let best = -1, bs = -1e9;
        T.forEach((t, ti) => {
          if (t.includes(u)) return;
          let sc = 0;
          t.forEach(v => { sc += aff(u, v) * 3; if (BIG.has(u) && BIG.has(v) && !aff(u, v)) sc -= 8; });
          sc -= t.length * 1.5;
          if (!t.length) sc += BIG.has(u) ? 3 : -4;
          if (sc > bs) { bs = sc; best = ti; }
        });
        if (best >= 0) T[best].push(u);
      }
    });
    /* пустые тренировки: первая собирает мелкие группы (плечи, руки) у тех, где есть крупная,
       следующие получают повтор самой частой крупной группы */
    let smallDay = false;
    T.forEach((t, ti) => { if (t.length) return;
      if (!smallDay) {
        T.forEach(o => { if (o === t) return; o.slice().forEach(v => { if (t.length < 3 && !BIG.has(v) && v !== 'Кор' && o.some(x => BIG.has(x)) && o.length >= 2) { o.splice(o.indexOf(v), 1); t.push(v); } }); });
        if (t.length >= 2) { smallDay = true; return; }
        T.forEach(o => { if (o !== t) t.slice().forEach(v => { if (!o.length) return; }); });
        t.splice(0).forEach(v => { const home = T.find(o => o !== t && o.some(x => BIG.has(x))); if (home) home.push(v); });
      }
      const u = [...BIG].sort((a, b) => (cnt[b] || 0) - (cnt[a] || 0)).find(x => !T[(ti + 1) % N].includes(x) && !T[(ti + N - 1) % N].includes(x)) || [...BIG].sort((a, b) => (cnt[b] || 0) - (cnt[a] || 0))[0];
      t.push(u);
    });
    /* порядок круга: соседние тренировки с минимумом общих групп */
    const perm = (arr) => arr.length <= 1 ? [arr] : arr.flatMap((x, i) => perm(arr.slice(0, i).concat(arr.slice(i + 1))).map(p => [x].concat(p)));
    const cost = (p) => p.reduce((s, ti, i) => { const a = T[ti], b = T[p[(i + 1) % p.length]]; return s + (N > 1 ? a.filter(x => b.includes(x)).length : 0); }, 0);
    const idx = T.map((_, i) => i);
    const first = idx.slice().sort((a, b) => (T[b].includes('Грудь') - T[a].includes('Грудь')))[0];
    const perms = perm(idx.filter(i => i !== first)).map(p => [first].concat(p));
    const bestP = perms.sort((a, b) => cost(a) - cost(b))[0] || idx;
    /* внутри тренировки: крупные первыми, затем как ты обычно делаешь */
    const trainings = bestP.map(ti => T[ti].slice().sort((a, b) => (BIG.has(b) - BIG.has(a)) || (cnt[b] || 0) - (cnt[a] || 0) || UNITS.indexOf(a) - UNITS.indexOf(b)));
    return { N, trainings, manual: false, notes, added };
  }
  /* упражнения для каждой тренировки круга */
  function queueSessions(history, an, prefs) {
    const L = buildLayout(history, an, prefs);
    const occ = {}; L.trainings.forEach((t, ti) => t.forEach(u => (occ[u] = occ[u] || []).push(ti)));
    const swaps = prefs.swaps || {};
    const addedZones = [];
    const pools = {};
    Object.keys(occ).forEach(u => {
      const g = unitGroup(u), r = unitRegion(u);
      const mine = Object.values(an.ex).filter(x => x.cls && x.cls.group === g && (!r || x.cls.region === r) && !(u === 'Ноги' && x.cls.region === 'glutes')).sort((a, b) => b.count - a.count).map(x => ({ key: x.key, name: x.name, region: x.cls.region, kind: x.cls.kind, mine: true }));
      /* важные зоны группы, которых не было: одно упражнение на круг */
      const must = r ? [] : (MUST[g] || []);
      must.forEach(z => { if (mine.some(x => x.region === z)) return; const slot = slotsOf(u).find(sl => sl.region === z); const fb = slot && slot.fb.filter(x => !(history.length < 3 && /подтягиван|на брусьях|в висе/i.test(x)))[0];
        if (fb) { mine.push({ key: exKey(fb), name: fb, region: z, kind: slot.kind || (classify(fb) || {}).kind || 'iso', fill: true }); if (mine.length > 1) addedZones.push(zonePlain(g, z) + ' («' + fb + '»)'); } });
      /* своих мало: добираем базой, чтобы было из чего выбрать */
      /* по кругу слотов: первое из каждого, потом второе, чтобы не было двух одинаковых движений подряд */
      const sls = slotsOf(u).filter(sl => !r || sl.region === r);
      for (let round = 0; round < 3 && mine.length < 6; round++) sls.forEach(sl => { const nm = sl.fb.filter(x => !(history.length < 3 && /подтягиван|на брусьях|в висе/i.test(x)))[round]; if (nm && !mine.some(x => x.key === exKey(nm)) && mine.length < 6) mine.push({ key: exKey(nm), name: nm, region: sl.region, kind: sl.kind || (classify(nm) || {}).kind || 'iso', base: true, rnd: round }); });
      pools[u] = mine;
    });
    const weekUsed = {};
    /* сколько упражнений в тренировке: как ты обычно делаешь, плюс одно */
    /* обычное число упражнений на группу за тренировку, по твоей истории */
    const per = {};
    history.slice(-30).forEach(hh => { const c = {}; hh.exercises.forEach(e => { const k2 = classify(e.name); if (k2) { const u = unitOf(k2.group, k2.region); c[u] = (c[u] || 0) + 1; } }); Object.entries(c).forEach(([u, v]) => (per[u] = per[u] || []).push(v)); });
    const typ = {}; Object.entries(per).forEach(([u, arr]) => { arr.sort((a, b) => a - b); typ[u] = Math.max(1, Math.min(6, arr[Math.floor(arr.length / 2)])); });
    const addedSet = new Set(L.added || []);
    const sessions = L.trainings.map((units, ti) => {
      /* сколько упражнений на группу: сколько ты обычно на неё делаешь за тренировку.
         Новой группе 2 (крупной) или 1. Всего в тренировке не больше 8 */
      const quota = {};
      const nBig = units.filter(u => BIG.has(u)).length;
      units.forEach(u => { quota[u] = addedSet.has(u) ? (BIG.has(u) ? 2 : 1) : (typ[u] || (BIG.has(u) ? (nBig > 1 ? 3 : 4) : 2)); });
      const fresh = history.length < 3;
      if (fresh) units.forEach(u => { if (!typ[u] && !addedSet.has(u)) quota[u] = BIG.has(u) ? 3 : 2; });
      if (!fresh && units.length === 1 && BIG.has(units[0])) quota[units[0]] = Math.max(quota[units[0]], 4);
      let tot = units.reduce((s2, u) => s2 + quota[u], 0);
      /* новичку без истории: не больше 6 упражнений за тренировку */
      while (fresh && tot > 6) { const u = units.slice().sort((a, b) => quota[b] - quota[a])[0]; if (quota[u] <= 1) break; quota[u]--; tot--; }
      /* короткая тренировка (например, одни руки) добирается до 4 упражнений */
      for (let k = 0; tot < 4 && k < 8; k++) { const u = units[k % units.length]; quota[u]++; tot++; }
      while (tot > 8) { const u = units.slice().sort((a, b) => quota[b] - quota[a])[0]; if (quota[u] <= 1) break; quota[u]--; tot--; }
      const items = [], used = new Set();
      units.forEach(u => {
        const pool = pools[u] || [], nOcc = occ[u].length, j = occ[u].indexOf(ti);
        let want = quota[u];
        /* сначала твои, заполнение зон, база в конце */
        const ordered = pool.filter(x => !x.base).concat(pool.filter(x => x.base));
        /* если группа в круге 2+ раза, разные тренировки получают разные упражнения */
        const prev = weekUsed[u] || (weekUsed[u] = new Set());
        const rk = (x, i) => (x.rnd != null ? x.rnd : i) % nOcc;
        let rot = nOcc > 1 ? ordered.filter((x, i) => rk(x, i) === j).concat(ordered.filter((x, i) => rk(x, i) !== j)) : ordered;
        rot = rot.filter(x => !prev.has(x.key)).concat(rot.filter(x => prev.has(x.key)));
        const pick = [];
        /* в первом появлении группы закрываем важные зоны */
        const must = (!unitRegion(u) && j === 0) ? (MUST[unitGroup(u)] || []) : [];
        /* добор пропущенной зоны идёт сверху твоих упражнений, а не вместо них */
        if (!addedSet.has(u) && pool.some(x => x.mine)) want += must.filter(z => !pool.some(x => x.mine && x.region === z)).length;
        must.forEach(z => { const x = rot.find(e => e.region === z && !pick.includes(e) && !used.has(e.key)); if (x && pick.length < want) pick.push(x); });
        rot.forEach(x => { if (pick.length < want && !pick.includes(x) && !used.has(x.key) && !(units.length > 1 && x.base && pick.length >= Math.max(2, Math.ceil(want * 0.6)) && pool.some(p => p.mine))) pick.push(x); });
        pick.sort((a, b) => (b.kind === 'comp') - (a.kind === 'comp') || (b.mine ? 1 : 0) - (a.mine ? 1 : 0));
        pick.forEach(x => { used.add(x.key); prev.add(x.key);
          let it = { kind: x.kind, mine: !!x.mine, key: x.key, name: x.name, group: unitGroup(u), region: x.region, isNew: !an.ex[x.key], why: addedSet.has(u) ? 'новая группа, чтобы тело росло ровно' : x.fill && j === 0 ? 'подтягиваем ' + zonePlain(unitGroup(u), x.region) : '' };
          const to = swaps[it.key]; if (to) { const k2 = exKey(to); it = { ...it, swappedFrom: it.name, name: to, key: k2, isNew: !an.ex[k2], why: 'замена при плато: было «' + it.name + '»' }; }
          items.push(it); });
      });
      /* по всей тренировке: сначала тяжёлая база, потом изоляция; внутри порядок групп сохраняется */
      const ord = items.map((it, i) => ({ it, i })).sort((a, b) => ((b.it.kind === 'comp') - (a.it.kind === 'comp')) || (a.i - b.i)).map(x => x.it);
      return { key: 't' + (ti + 1), title: titleOf(units), units, groups: [...new Set(units.map(unitGroup))], items: ord };
    });
    return { L, sessions, addedZones };
  }
  /* день плана на конкретную дату */
  function planDayAt(plan, date) {
    const t = +new Date(date.getFullYear(), date.getMonth(), date.getDate()); let out = null;
    toArr(plan.weeks).forEach((w, wi) => toArr(w && w.days).forEach((d, di) => { if (!out && d) { const dt = planDayDate(plan, d.date); if (dt && +dt === t) out = { wi, di, day: d }; } }));
    return out;
  }
  function generateQueue(plans, plan, prefs, history, an) {
    const weeksList = toArr(plan.weeks);
    const cw = Math.max(0, currentWeekIdx(plan));
    const R = Math.max(1, weeksList.length - Math.min(cw, weeksList.length - 1));
    const deloadLast = R >= 4;
    const Q = queueSessions(history, an, prefs);
    const prog = {};
    Q.sessions.forEach(s => s.items.forEach(it => { if (!prog[it.key]) prog[it.key] = progression(it.key, it.name, an, R, deloadLast); }));
    const queue = [];
    for (let r = 0; r < R; r++) Q.sessions.forEach((s, ti) => queue.push({
      r, t: ti, key: s.key, title: s.title, units: s.units, groups: s.groups, deload: deloadLast && r === R - 1,
      exercises: s.items.map(it => { const x = an.ex[it.key], last = x && x.last;
        return { name: it.name, group: it.group, region: it.region, isNew: it.isNew, why: it.why || (r === 0 ? prog[it.key].why : '') || '', step: prog[it.key].step,
          base: last && (last.weight || last.reps) ? (last.weight ? String(last.weight).replace('.', ',') + '×' : '') + last.reps : '', ...prog[it.key].rows[r] }; }),
      transferred: false, date: null }));
    const notes = [];
    notes.push(`${Q.L.N} ${pl(Q.L.N, 'тренировка', 'тренировки', 'тренировок')} по очереди: ` + Q.sessions.map((s, i) => (i + 1) + ') ' + s.title.toLowerCase()).join(', ') + '. Дни недели не важны: в зале делаешь следующую по очереди');
    notes.push(Q.L.manual ? 'Какие мышцы в какой тренировке, выбрано тобой' : 'Мышцы разложены как ты обычно тренируешь: что делаешь вместе и сколько раз в неделю. Грудь, спина и ноги в разных тренировках, одна мышца не идёт два раза подряд');
    Q.L.notes.forEach(n => notes.push(n));
    Q.addedZones.forEach(a => notes.push('Добавил, чтобы не отставало: ' + a));
    notes.push('Пропуск ничего не ломает: в следующий раз делаешь ту же тренировку');
    if (Q.L.trainings.some((t, i) => t.some(u => Q.L.trainings.some((t2, j) => j !== i && t2.includes(u))))) notes.push('Если мышца в круге дважды, упражнения в эти дни разные');
    notes.push(`Цель: ${GOAL.label.toLowerCase()}, ${GOAL.lo}–${GOAL.hi} повторов. Дошёл до ${GOAL.hi} повторов, вес растёт. Два раза не хватило повторов, вес чуть ниже`);
    if (deloadLast) notes.push('Последние тренировки плана облегчённые: вес ниже, подходов меньше. Так мышцы восстановятся перед новым планом');
    return { mode: 'queue', planId: plan.id, planNumber: plan.number, generatedAt: new Date().toISOString(), goal: prefs.goal || 'mass',
      lastWorkout: history.length ? +history[history.length - 1].date : 0, sig: sigOf(history),
      basedOn: { workouts: an.workouts, weeks: an.weeks, plans: [...new Set(history.map(x => x.planNum))].filter(Boolean) },
      layout: Q.L.trainings, manual: Q.L.manual, N: Q.L.N, notes, queue, weeks: [] };
  }
  /* пересобрать, сохранив то, что уже стоит в плане */
  function regenKeep(plans, plan, p2, relayout) {
    const old = load();
    const keep = !relayout && old && old.mode === 'queue' && old.planId === plan.id && Array.isArray(old.layout) && old.layout.length;
    /* раскладка мышц не плывёт сама: меняется только когда человек сам её меняет */
    const res = generate(plans, plan, { prefs: keep ? { ...p2, layout: old.layout, n: old.layout.length } : p2 }); if (res.error) return res;
    if (keep && !old.manual) { res.manual = false; res.notes = res.notes.map(n => n === 'Какие мышцы в какой тренировке, выбрано тобой' ? 'Мышцы разложены как ты обычно тренируешь: что делаешь вместе и сколько раз в неделю. Грудь, спина и ноги в разных тренировках, одна мышца не идёт два раза подряд' : n); }
    if (old && old.mode === 'queue' && old.planId === plan.id) {
      const done = old.queue.filter(q => q.transferred);
      /* стоящие в плане остаются; остальные идут по кругу заново, без тех, что убрал сам человек.
         Тренировку можно поставить не по порядку, поэтому пропускаем именно занятые пары «круг:тренировка» */
      const taken = new Set(done.map(q => q.r + ':' + q.t)), removed = new Set(toArr(old.removed));
      const maxR = Math.max(...res.queue.map(q => q.r)) + 1, topR = (done.length ? Math.max(...done.map(q => q.r)) : 0) + maxR + 1;
      const fresh = [], occ = {};
      for (let rr = 0; rr < topR; rr++) for (let t = 0; t < res.N; t++) {
        const k = rr + ':' + t; if (taken.has(k)) continue;
        if (done.some(q => q.t === t && q.r > rr)) continue; /* круги до уже пройденных не возвращаем */
        const o = occ[t] || 0; const src = res.queue.find(q => q.r === o && q.t === t); if (!src) continue;
        occ[t] = o + 1;
        if (removed.has(k)) continue;
        fresh.push({ ...src, r: rr, exercises: src.exercises.map(e => ({ ...e })) });
      }
      res.queue = done.concat(fresh);
      res.removed = [...removed];
    }
    save(res); return res;
  }

  function generate(plans, plan, opts) {
    opts = opts || {};
    const prefs = opts.prefs || prefsGet();
    GOAL = GOALS[prefs.goal] || GOALS.mass;
    const history = collect(plans);
    const an = analyze(history, prefs);
    if (!an.enough && prefs.method === 'history') return { error: 'data', an };
    /* основной режим: очередь тренировок */
    if (prefs.method !== 'weeks') return generateQueue(plans, plan, prefs, history, an);
    const weeksList = toArr(plan.weeks);
    const fromWeek = Math.min(weeksList.length, opts.fromWeek != null ? opts.fromWeek : autoFromWeek(plan));
    const weeksN = weeksList.length - fromWeek;
    if (weeksN <= 0) return { error: 'ended', an };
    const deloadLast = weeksN >= 4;
    /* по умолчанию автоплан по твоим тренировкам; «history» оставлен как старый режим «мои связки как есть» */
    const auto = true;
    const smart = false, sm = null;
    const autoS = auto ? autoSessions(an) : null;
    const split = auto ? autoS.map(x => ({ key: x.key, groups: x.groups, sessions: [] })) : buildSplit(an, prefs);
    const sessions = auto ? autoS : split.map(c => sessionFor(c, an));
    /* замены упражнений при плато (выбраны в «Разборе») */
    const swaps = prefs.swaps || {};
    sessions.forEach(ss => ss.items.forEach(it => {
      const to = swaps[it.key]; if (!to) return;
      const k2 = exKey(to); it.swappedFrom = it.name; it.name = to; it.key = k2; it.isNew = !an.ex[k2]; it.why = 'замена при плато: было «' + it.swappedFrom + '»';
    }));

    /* разнообразие: одно и то же упражнение два раза за неделю меняем на другое твоё
       на ту же зону мышц, если такое есть в истории */
    if (!auto && sessions.length > 1) {
      const seen = new Map();
      sessions.forEach((ss, si) => ss.items.forEach((it, ii) => {
        if (!seen.has(it.key)) { seen.set(it.key, si); return; }
        const used = new Set(sessions.flatMap(x => x.items.map(y => y.key)));
        const alt = Object.values(an.ex).filter(x => x.cls && x.cls.group === it.group && x.cls.region === it.region && !used.has(x.key) && x.count >= 2).sort((a, b) => b.count - a.count)[0];
        if (alt) { ss.items[ii] = { ...it, key: alt.key, name: alt.name, isNew: false, why: 'для разнообразия, «' + it.name + '» уже есть на неделе' }; }
      }));
    }
    const prog = {};
    sessions.forEach(s => s.items.forEach(it => { if (!prog[it.key]) prog[it.key] = progression(it.key, it.name, an, weeksN, deloadLast); }));

    /* связку ставим в тот день, в который ты её обычно делаешь */
    const nd = an.trainDays.length;
    let dayPlan = null;
    if (auto) dayPlan = an.trainDays.map((_, j) => j % sessions.length);
    else if (sessions.length <= nd) {
      const score = (ss, dow) => (split.find(c => c.key === ss.key) || { sessions: [] }).sessions.filter(x => x.dow === dow).length;
      const pairs = [];
      sessions.forEach((ss, si) => an.trainDays.forEach((dow, di) => pairs.push({ si, di, v: score(ss, dow) })));
      pairs.sort((a, b) => b.v - a.v);
      const bySlot = new Array(nd).fill(-1), used = new Set();
      pairs.forEach(p => { if (p.v > 0 && bySlot[p.di] < 0 && !used.has(p.si)) { bySlot[p.di] = p.si; used.add(p.si); } });
      let rest = sessions.map((_, i) => i).filter(i => !used.has(i));
      for (let i = 0; i < nd; i++) if (bySlot[i] < 0) bySlot[i] = rest.length ? rest.shift() : i % sessions.length;
      dayPlan = bySlot;
    }
    const weeks = [];
    let seq = 0;
    for (let k = 0; k < weeksN; k++) {
      const wi = fromWeek + k;
      const wk = weeksList[wi] || {};
      const days = an.trainDays.map((dow, j) => {
        const s = dayPlan ? sessions[dayPlan[j]] : sessions[seq++ % sessions.length];
        const idx = findDayIdx(wk, dow);
        const day = idx >= 0 ? toArr(wk.days)[idx] : {};
        /* объём растёт к концу блока: во второй половине +1 подход на базовые */
        const ramp = smart && !(deloadLast && k === weeksN - 1) && k >= Math.ceil((weeksN - (deloadLast ? 1 : 0)) / 2) ? 1 : 0;
        return {
          di: idx >= 0 ? idx : dow, date: day.date || '', dow: day.dow || DOW[dow], groups: s.groups, title: s.title || '',
          exercises: s.items.map(it => {
            const x = an.ex[it.key], last = x && x.last, row = { ...prog[it.key].rows[k] };
            if (smart && it.sets) row.sets = row.deload ? Math.max(1, it.sets - 1) : Math.min(it.kind === 'comp' ? 5 : 4, it.sets + (it.kind === 'comp' && it.sets < 4 ? ramp : 0));
            return { name: it.name, group: it.group, region: it.region, isNew: it.isNew, why: it.why || (k === 0 ? prog[it.key].why : '') || '', step: prog[it.key].step,
              base: last && (last.weight || last.reps) ? (last.weight ? String(last.weight).replace('.', ',') + '×' : '') + last.reps + (last.planNum ? ' · план №' + last.planNum : '') : '',
              ...row };
          }),
          transferred: false,
        };
      });
      /* прошедшие дни недели не заполняем */
      const t0 = new Date(); t0.setHours(0, 0, 0, 0);
      const fut = days.filter(d => { const dt = d.date ? planDayDate(plan, d.date) : null; return !dt || dt >= t0; });
      if (fut.length) weeks.push({ wi, deload: deloadLast && k === weeksN - 1, days: fut });
    }

    /* как считал — простым языком */
    const pl = (n, a, b, c) => { const x = n % 10, y = n % 100; return x === 1 && y !== 11 ? a : x >= 2 && x <= 4 && (y < 12 || y > 14) ? b : c; };
    const notes = [];
    const wc = Object.values(an.weekMap);
    if (auto) {
      notes.push('Расстановка: ' + an.trainDays.map((d, j) => DOW[d] + ' ' + sessions[j % sessions.length].title.toLowerCase()).join(', ') + '. Каждая группа в свой день, между одинаковыми мышцами есть отдых');
      notes.push('Трицепс после груди, бицепс после спины: они и так работают в жимах и тягах, так руки получают нагрузку без лишнего дня');
      notes.push('Упражнения твои: беру самые частые по каждой группе и зоне мышц. Если зоны не хватало, добавляю одно упражнение');
      notes.push('Оставляй 1–2 повтора в запасе, последняя неделя блока облегчённая');
    }
    if (smart) {
      notes.push(`Методика: сплит «${sm.name}» под ${an.trainDays.length} ${pl(an.trainDays.length, 'день', 'дня', 'дней')} в неделю. Каждая мышца получает нагрузку 2 раза в неделю, так растут лучше всего`);
      notes.push('Подходов в неделю: ' + Object.entries(sm.vol).map(([g, v]) => g + ' ' + v).join(', ') + '. Старт ближе к нижней границе (10–20 на мышцу), во второй половине блока +1 подход на базовые');
      notes.push('В разные дни разные вариации: жим лёжа в один день, на наклонной в другой. Одинаковых тяжёлых повторов за неделю нет');
      notes.push('Упражнения сначала из твоих любимых на ту же зону мышц, новые только если твоих не хватает');
      notes.push('Оставляй 1–3 повтора в запасе: в начале блока 3, к концу 1');
      if (prefs.sex === 'f') notes.push('Для девушек: ноги и ягодицы 2–3 раза в неделю, верх поддерживающим объёмом');
      if (levelOf(an, prefs) === 'new') notes.push('Новичку: 5 упражнений за тренировку, сначала тренажёры и гантели. Где написано «подбери вес», возьми такой, чтобы последние 2–3 повтора давались тяжело, но техника не ломалась');
    }
    notes.push(`Частота: обычно ${an.freq} ${pl(an.freq, 'тренировка', 'тренировки', 'тренировок')} в неделю (смотрел ${an.weeks} ${pl(an.weeks, 'неделю', 'недели', 'недель')}: ${wc.join(', ')})${toArr(prefs.days).length ? '. Дни выбраны вручную' : ''}`);
    notes.push('Дни: ' + an.trainDays.map(d => DOW[d] + (an.dowCnt[d] ? ` (${an.dowCnt[d]} раз)` : '')).join(', '));
    if (!auto) notes.push('Связки: ' + sessions.map(s => s.groups.join(' + ') + (s.from ? ` (по ${s.from} ${pl(s.from, 'тренировке', 'тренировкам', 'тренировкам')})` : ' (шаблон)')).join(' · ') + (sessions.length > an.trainDays.length ? '. Чередуются по очереди' : ''));
    if (!auto) notes.push('Упражнения и их порядок взяты из твоих тренировок с той же связкой, веса из последнего раза');
    if (!auto) sessions.forEach(s => s.added.forEach(a => notes.push('Добавил, чтобы не отставало: ' + a)));
    an.merges.slice(0, 6).forEach(m => notes.push(`Считаю одним упражнением: «${m[0]}» = «${m[1]}»`));
    notes.push(`Цель: ${GOAL.label.toLowerCase()}. Диапазон ${GOAL.lo}–${GOAL.hi} повторов, отдых ${GOAL.rest}`);
    notes.push(`Прогрессия по факту: добрал ${GOAL.hi} повторов, вес вверх, а повторы по оценке твоего максимума. Два раза подряд меньше ${GOAL.lo}, вес −7,5%. Один раз меньше, держим вес`);
    if (deloadLast) notes.push(`Неделя ${fromWeek + weeksN}: разгрузка, вес −15%, подходов меньше`);

    return {
      planId: plan.id, planNumber: plan.number, generatedAt: new Date().toISOString(),
      fromWeek, goal: prefs.goal || 'mass', method: auto ? 'auto' : 'history', lastWorkout: history.length ? +history[history.length - 1].date : 0, sig: sigOf(history),
      basedOn: { workouts: an.workouts, weeks: an.weeks, plans: [...new Set(history.map(x => x.planNum))].filter(Boolean) }, notes, weeks,
    };
  }

  /* ── Сводка для чата с тренером (текстом, коротко) ── */
  function buildContext(plans, plan) {
    const cp = chosenPlans(plans);
    const history = collect(cp.on.map(x => x.p));
    const an = analyze(history, prefsGet());
    const L = [];
    const cw = currentWeekIdx(plan);
    L.push(`Текущий план №${plan.number || '?'}, неделя ${Math.min(toArr(plan.weeks).length, cw + 1)} из ${toArr(plan.weeks).length}.`);
    L.push(`Тренировок в истории: ${an.workouts} за ${an.weeks} нед. Обычно ${an.freq} в неделю, дни: ${an.trainDays.map(d => DOW[d]).join(', ')}.`);
    if (an.combos.length) L.push('Связки мышц: ' + an.combos.slice(0, 6).map(c => `${c.groups.join('+')} (${c.c})`).join(', ') + '.');
    /* объём за последние 2 недели по группам */
    const vol = {}; const since = Date.now() - 14 * DAY;
    history.filter(h => h.date >= since).forEach(h => h.exercises.forEach(e => { const g = ((an.ex[e.key] || {}).cls || {}).group; if (g) vol[g] = (vol[g] || 0) + (+e.sets || 3); }));
    if (Object.keys(vol).length) L.push('Подходов за 2 недели: ' + Object.entries(vol).map(([g, v]) => `${g} ${v}`).join(', ') + '.');
    L.push('Упражнения (последний раз; история весов×повторов):');
    Object.values(an.ex).sort((a, b) => b.count - a.count).slice(0, 25).forEach(x => {
      const h = toArr(x.hist).slice(-6).map(r => (r.weight ? r.weight + '×' : '') + r.reps).join(', ');
      const last = x.last || {};
      const flat = toArr(x.hist).length >= 3 && x.hist.slice(-3).every(r => r.weight === last.weight && r.reps <= (x.hist[x.hist.length - 3].reps || 0));
      const rm = x.best1rm ? `, 1ПМ ~${Math.round(x.best1rm)} кг` : '';
      L.push(`- ${x.name}${x.cls ? ' [' + x.cls.group + ', ' + (REGION_LABEL[x.cls.region] || '') + ']' : ''}: ${last.sets || '?'}×${last.reps || '?'}${last.weight ? '×' + last.weight + 'кг' : ''}; ${h}${rm}${flat ? '; ПЛАТО' : ''}`);
    });
    const ai = load();
    if (ai && ai.planId === plan.id) L.push('AI-план уже составлен с недели ' + (ai.fromWeek + 1) + '.');
    return L.join('\n');
  }

  /* ── Автоподстройка: появилась новая тренировка → пересчитываем AI-план
     и ещё не наступившие AI-тренировки в основном плане ── */
  /* очередь: после новой тренировки пересчитываем веса ещё не пройденных тренировок */
  function autoAdjustQueue(ai, plans, plan, h, history, sig) {
    const full = generate(plans, plan, { prefs: ai.layout && ai.layout.length ? { ...prefsGet(), layout: ai.layout, n: ai.layout.length } : prefsGet() });
    if (full.error) { ai.sig = sig; save(ai); return null; }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const byRT = {}; full.queue.forEach(q => { byRT[q.r + ':' + q.t] = q; });
    const oldFirst = {}; ai.queue.forEach(q => { if (!q.transferred) q.exercises.forEach(e => { if (!(e.name in oldFirst)) oldFirst[e.name] = e; }); });
    const res = regenKeep(plans, plan, prefsGet());
    if (res.error) { ai.sig = sig; save(ai); return null; }
    const all = h.getPlans(); const p = all.find(x => x && x.id === plan.id);
    let touched = false;
    res.queue.forEach(q => {
      if (!q.transferred || !q.date) return;
      const [y, m, d] = q.date.split('-').map(Number); if (new Date(y, m - 1, d) <= today) return;
      const n = byRT[q.r + ':' + q.t]; if (!n || n.title !== q.title) return;
      q.exercises = n.exercises.map(e => ({ ...e }));
      const day = p && toArr(p.weeks)[q.wi] && toArr(p.weeks[q.wi].days)[q.di]; if (!day) return;
      toArr(day.sessions).forEach(sess => {
        if (!sess || !sess.ai) return;
        const exs = toArr(sess.exercises);
        exs.forEach(ex => { const z = q.exercises.find(e => e.name === ex.name); if (z && ex.kind === 'strength') { ex.sets = z.sets; ex.reps = z.reps; ex.weight = z.weight || 0; touched = true; } });
        sess.exercises = exs;
        if (sess.aiSig) sess.aiSig = aiSigOf(sess);
      });
    });
    if (touched) h.savePlans(all);
    const changes = [], seen = new Set();
    res.queue.filter(q => !q.transferred).slice(0, res.N).forEach(q => q.exercises.forEach(e => {
      if (seen.has(e.name)) return; seen.add(e.name);
      const o = oldFirst[e.name]; if (o && (o.weight || 0) !== (e.weight || 0)) changes.push(o.weight ? `${e.name}: ${o.weight} → ${e.weight || 0} кг` : `${e.name}: ${e.weight} кг`);
    }));
    res.sig = sig; res.adjusted = { at: Date.now(), changes };
    save(res);
    return res.adjusted;
  }

  function autoAdjust(plan, h) {
    if (!window.__coachMode && window.FirebaseSync && FirebaseSync.myTrainerCached && FirebaseSync.myTrainerCached()) return null;
    const ai = load();
    if (!ai || ai.planId !== plan.id) return null;
    if (ai.mode !== 'queue' && prefsGet().method !== 'weeks') return null;
    const plans = chosenPlans(h.getPlans()).on.map(x => x.p);
    const history = collect(plans);
    const sig = sigOf(history);
    if (!ai.sig || sig === ai.sig) { if (!ai.sig) { ai.sig = sig; save(ai); } return null; }
    if (ai.mode === 'queue') return autoAdjustQueue(ai, plans, plan, h, history, sig);
    const fw = Math.max(ai.fromWeek || 0, autoFromWeek(plan));
    const res = generate(plans, plan, { fromWeek: fw });
    if (res.error) { ai.sig = sig; save(ai); return null; }
    /* что поменялось в ближайших тренировках */
    const oldFirst = {}; ai.weeks.forEach(w => w.days.forEach(d => d.exercises.forEach(e => { if (!(e.name in oldFirst) && w.wi >= fw) oldFirst[e.name] = e; })));
    const changes = [];
    const seen = new Set();
    const fresh = new Set(history.filter(x => +x.date > (ai.lastWorkout || 0)).flatMap(x => x.exercises.map(e => e.name)));
    res.weeks.slice(0, 1).forEach(w => w.days.forEach(d => d.exercises.forEach(e => {
      if (seen.has(e.name) || (fresh.size && !fresh.has(e.name))) return; seen.add(e.name);
      const o = oldFirst[e.name]; if (!o) return;
      if ((o.weight || 0) !== (e.weight || 0)) changes.push(`${e.name}: ${o.weight || 0} → ${e.weight || 0} кг`);
    })));
    /* сохраняем отметки «в плане» и обновляем будущие AI-тренировки основного плана */
    const done = new Set(); ai.weeks.forEach(w => w.days.forEach(d => { if (d.transferred) done.add(w.wi + ':' + d.di); }));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const all = h.getPlans(); const p = all.find(x => x && x.id === plan.id);
    let touched = false;
    res.weeks.forEach(w => w.days.forEach(d => {
      if (!done.has(w.wi + ':' + d.di)) return;
      d.transferred = true;
      const day = p && toArr(p.weeks)[w.wi] && toArr(p.weeks[w.wi].days)[d.di];
      if (!day) return;
      const dt = planDayDate(p, day.date); if (!dt || dt <= today) return;
      toArr(day.sessions).forEach(sess => {
        if (!sess || !sess.ai) return;
        const exs = toArr(sess.exercises);
        exs.forEach(ex => { const n = d.exercises.find(z => z.name === ex.name); if (n && ex.kind === 'strength') { ex.sets = n.sets; ex.reps = n.reps; ex.weight = n.weight || 0; touched = true; } });
        sess.exercises = exs;
      });
    }));
    if (touched) h.savePlans(all);
    res.adjusted = { at: Date.now(), changes };
    save(res);
    return res.adjusted;
  }

  function toast(content, text) {
    const t = document.createElement('div'); t.className = 'ai-toast'; t.innerHTML = '<i class="ti ti-circle-check"></i> ' + esc(text);
    document.body.appendChild(t); setTimeout(() => t.classList.add('out'), 2200); setTimeout(() => t.remove(), 2600);
    const top = content.querySelector('.ai-meta, .ai-gen'); if (top) top.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ── Хранилище ── */
  function load() {
    const a = (Store.get().training || {}).ai;
    if (!a || !a.weeks) return null;
    a.weeks = toArr(a.weeks).map(w => ({ ...w, days: toArr(w.days).map(d => ({ ...d, groups: toArr(d.groups), exercises: toArr(d.exercises) })) }));
    a.notes = toArr(a.notes);
    return a;
  }
  function save(a) { Store.set('training.ai', a); }

  /* ── Интерфейс ── */
  function fmtW(e) {
    if (e.weight) return `${e.sets} × ${e.reps} × <b>${String(e.weight).replace('.', ',')} кг</b>`;
    return `${e.sets} × ${e.reps}${e.group === 'Кор' ? '' : ' · <span class="ai-pick">подбери вес</span>'}`;
  }
  const TYPE = 'Тренажерный зал';

  function viewTabs() {
    const v = window._aiView || 'plan';
    const fresh = new Date().getDay() === 1 ? '<i class="ai-view-dot"></i>' : '';
    /* вкладка чата появляется, когда подключена облачная функция (адрес в config.js) */
    const chatOn = !!(window.APP_CONFIG && APP_CONFIG.aiChatUrl);
    return `<div class="ai-views"><button class="ai-view${v === 'plan' ? ' on' : ''}" data-v="plan"><i class="ti ti-calendar-stats"></i> Программа</button><button class="ai-view${v === 'insights' ? ' on' : ''}" data-v="insights"><i class="ti ti-chart-dots"></i> Разбор${fresh}</button>${chatOn ? `<button class="ai-view${v === 'chat' ? ' on' : ''}" data-v="chat"><i class="ti ti-message-chatbot"></i> Чат</button>` : ''}</div>`;
  }
  function bindViews(content, plan, h) {
    content.querySelectorAll('.ai-view').forEach(b => b.addEventListener('click', () => { window._aiView = b.dataset.v; render(content, plan, h); }));
  }
  /* ── Как будет расставлено: дни и группы ── */
  function previewHtml(an) {
    const ss = autoSessions(an);
    return `<div class="ai-plan-pv">${an.trainDays.map((d, j) => `<div><b>${DOW[d]}</b><span>${esc(ss[j % ss.length].title)}</span></div>`).join('')}</div>`;
  }
  /* цель и дни: по умолчанию из истории, менять не обязательно */
  function basicsHtml(an, prefs) {
    const g = GOALS[prefs.goal] || GOALS.mass;
    return `<div class="ai-pref"><div class="ai-pref-t"><i class="ti ti-calendar-week"></i> Дни тренировок <em>${toArr(prefs.days).length ? 'выбраны тобой' : (an.workouts ? 'как ты обычно ходишь' : 'можно поменять')}</em></div>
        <div class="ai-days">${DOW.map((d, i) => `<button class="ai-day-chip${an.trainDays.includes(i) ? ' on' : ''}" data-d="${i}"><b>${d}</b><span>${an.dowCnt[i] || ''}</span></button>`).join('')}</div></div>
      <div class="ai-pref"><div class="ai-pref-t"><i class="ti ti-target"></i> Цель <em>${g.lo}–${g.hi} повторов · отдых ${g.rest}</em></div>
        <div class="ai-goals">${Object.entries(GOALS).map(([k, x]) => `<button class="ai-goal ai-gl${(prefs.goal || 'mass') === k ? ' on' : ''}" data-v="${k}"><b>${x.label}</b><span>${x.lo}–${x.hi}</span></button>`).join('')}</div></div>`;
  }
  function bindAnketa(content, an, prefs, apply) {
    const set = (k, v) => apply({ ...prefs, [k]: v });
    content.querySelectorAll('.ai-gl').forEach(b => b.onclick = () => set('goal', b.dataset.v));
    content.querySelectorAll('.ai-day-chip').forEach(b => b.onclick = () => {
      const cur = new Set(an.trainDays), d = +b.dataset.d;
      if (cur.has(d)) { if (cur.size === 1) return; cur.delete(d); } else cur.add(d);
      set('days', [...cur].sort((x, y) => x - y));
    });
  }
  /* перенос всего плана в основной план одним нажатием */
  function transferAll(content, plan, h) {
    const a = load(); if (!a) return;
    let n = 0; a.weeks.forEach(w => w.days.forEach(d => { if (!d.transferred) { if (transfer(plan, h, w.wi, d.di, d)) n++; d.transferred = true; } }));
    save(a); h.afterTransfer && h.afterTransfer(); render(content, plan, h); toast(content, n ? `В план добавлено тренировок: ${n}` : 'Всё уже в плане');
  }

  /* ══ Экран очереди: тренировки идут по кругу, дни выбирает человек ══ */
  const ymdQ = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const fromYmdQ = (s2) => { const [y, m, d] = String(s2).split('-').map(Number); return new Date(y, m - 1, d); };
  const DOWF = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const MONF = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const fmtDay = (d) => DOWF[d.getDay()] + ', ' + d.getDate() + '.' + String(d.getMonth() + 1).padStart(2, '0');
  const fmtDayL = (d) => d.getDate() + ' ' + MONF[d.getMonth()] + ', ' + DOWF[d.getDay()];
  const numW = (v) => String(v).replace('.', ',');
  const qid = (q) => q.r + ':' + q.t;
  function qToast(text) {
    const t = document.createElement('div'); t.className = 'ai-toast'; t.innerHTML = '<i class="ti ti-circle-check"></i> ' + esc(text);
    document.body.appendChild(t); setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3000);
  }
  function circleHtml(layout, editable) {
    return `<div class="q-circle">${layout.map((units, ti) => `<div class="q-t"><b class="q-num">${ti + 1}</b><div>${units.map(u => `<button class="q-u${editable ? '' : ' ro'}" data-t="${ti}" data-u="${esc(u)}">${esc(u)}</button>`).join('')}</div></div>`).join('')}</div>`;
  }
  function focusHtml(prefs) {
    const f = prefs.focus || 'even';
    return `<div class="q-focus"><div class="ai-pref-t"><i class="ti ti-target"></i> На что упор</div><div class="q-focus-b">
      <button data-f="even" class="${f === 'even' ? 'on' : ''}"><b>Всё тело ровно</b><span>грудь, спина, ноги, плечи, руки</span></button>
      <button data-f="lower" class="${f === 'lower' ? 'on' : ''}"><b>Ноги и ягодицы</b><span>низ два раза за круг, верх одним днём</span></button></div></div>`;
  }
  function qSettingsHtml(prefs, N, manual) {
    const g = GOALS[prefs.goal] || GOALS.mass;
    return `<div class="ai-pref"><div class="ai-pref-t"><i class="ti ti-repeat"></i> Сколько разных тренировок <em>${prefs.n ? 'выбрано тобой' : 'как ты обычно ходишь в неделю'}</em></div>
        <div class="ai-days q-n">${[1, 2, 3, 4, 5, 6].map(n => `<button class="ai-day-chip${N === n ? ' on' : ''}" data-n="${n}"><b>${n}</b></button>`).join('')}</div>
        ${manual ? '<button class="ai-pref-reset" id="q-auto"><i class="ti ti-refresh"></i> Разложить мышцы заново, как по истории</button>' : ''}</div>
      <div class="ai-pref"><div class="ai-pref-t"><i class="ti ti-target"></i> Цель <em>${g.lo}–${g.hi} повторов · отдых ${g.rest}</em></div>
        <div class="ai-goals">${Object.entries(GOALS).map(([k, x]) => `<button class="ai-goal ai-gl${(prefs.goal || 'mass') === k ? ' on' : ''}" data-v="${k}"><b>${x.label}</b><span>${x.lo}–${x.hi}</span></button>`).join('')}</div></div>
      <div class="ai-pref"><div class="ai-pref-t"><i class="ti ti-weight"></i> На сколько прибавлять вес <em>какие блины и гантели есть в зале</em></div>
        <div class="ai-steps">${Object.entries(EQUIP).map(([k, e]) => `<div class="ai-step"><span>${e.label}</span><div class="ai-stp"><button data-eq="${k}" data-d="-1" aria-label="Меньше">−</button><input data-eq="${k}" type="text" inputmode="decimal" value="${numW(+(prefs.steps || {})[k] || e.def)}"><em>кг</em><button data-eq="${k}" data-d="1" aria-label="Больше">+</button></div></div>`).join('')}</div></div>`;
  }
  function exLoad(e) {
    const sets = `${e.sets} ${pl(e.sets, 'подход', 'подхода', 'подходов')} × ${/планк|вакуум/i.test(e.name) ? '40 сек' : e.reps + ' раз'}`;
    if (e.weight) return `${sets}<b>${numW(e.weight)} кг</b>`;
    return `${sets}${e.group === 'Кор' ? '' : '<b class="ai-pick">вес подбери</b>'}`;
  }
  function exListHtml(q) {
    const pick = q.exercises.some(e => !e.weight && e.group !== 'Кор');
    return `<div class="q-ex">${q.exercises.map((e, i) => `<div class="q-ex-row"><span class="q-ex-i">${i + 1}</span><div class="q-ex-m"><div class="q-ex-n">${esc(e.name)}${e.isNew ? '<span class="ai-new">новое</span>' : ''}</div>
        <div class="q-ex-l">${exLoad(e)}${e.up ? '<i class="ti ti-trending-up ai-up"></i>' : ''}${e.down ? '<i class="ti ti-trending-down ai-down"></i>' : ''}</div>
        ${e.base || e.why ? `<div class="q-ex-w">${esc([e.base ? 'в прошлый раз ' + (e.base.includes('×') ? e.base.replace('×', ' кг × ') : e.base + ' раз') : '', e.why || ''].filter(Boolean).join(' · '))}</div>` : ''}</div></div>`).join('')}</div>
      ${pick ? '<div class="q-tip"><i class="ti ti-info-circle"></i> Вес подбери так, чтобы последние 2 повтора давались тяжело, и запиши его во вкладке План. Дальше я буду вести его сам</div>' : ''}
      ${q.deload ? '<div class="q-tip"><i class="ti ti-feather"></i> Облегчённая тренировка: мышцы отдыхают перед новым планом</div>' : ''}`;
  }
  /* AI-тренировка в плане: изменил ли человек её (записал свои веса и повторы) */
  function qSession(plan, h, q) {
    if (q.wi == null) return null;
    const p = toArr(h.getPlans()).find(x => x && x.id === plan.id); const day = p && toArr(p.weeks)[q.wi] && toArr(p.weeks[q.wi].days)[q.di];
    return day ? toArr(day.sessions).find(s2 => s2 && s2.ai && s2.aiQ === qid(q)) || null : null;
  }
  const qEdited = (plan, h, q) => { const s2 = qSession(plan, h, q); return !!(s2 && s2.aiSig && s2.aiSig !== aiSigOf(s2)); };
  /* будущие AI-тренировки, которые ещё можно двигать: снять с дней и вернуть в очередь */
  function liftFuture(plan, h) {
    const a = load(); if (!a || a.mode !== 'queue') return [];
    const t0 = new Date(); t0.setHours(0, 0, 0, 0); const tk = ymdQ(t0);
    const dates = [];
    a.queue.forEach(q => { if (q.transferred && q.date && q.date > tk && !qEdited(plan, h, q)) { dates.push(q.date); untransfer(plan, h, q); Object.assign(q, { transferred: false, date: null, wi: null, di: null, ok: false }); } });
    save(a); return dates.sort();
  }
  function placeOn(plan, h, dates) {
    let n = 0;
    dates.forEach(k => { const a = load(); const i = a.queue.findIndex(q => !q.transferred); if (i < 0) return; const q = a.queue[i];
      const [y, m, d] = k.split('-').map(Number); const pd = planDayAt(plan, new Date(y, m - 1, d)); if (!pd) return;
      if (!transfer(plan, h, pd.wi, pd.di, { ...q, qid: qid(q) })) return;
      Object.assign(q, { transferred: true, date: k, wi: pd.wi, di: pd.di, ok: false }); save(a); n++; });
    return n;
  }
  function renderQueue(content, plan, h, plans, history, an, prefs, ai, cp, legacy) {
    /* записанная тренировка считается сделанной, без вопроса «получилось сходить?» */
    if (ai) { let ch = false; const t0 = new Date(); t0.setHours(0, 0, 0, 0); const tk = ymdQ(t0);
      ai.queue.forEach(q => { if (q.transferred && q.date && q.date <= tk && !q.ok && qEdited(plan, h, q)) { q.ok = true; markOk(plan, h, q); ch = true; } });
      if (ch) save(ai); }
    const L = ai ? { trainings: ai.layout, N: ai.N, manual: ai.manual } : buildLayout(history, an, prefs);
    /* смена настроек: уже расставленные будущие дни пересобираются с новыми упражнениями на те же даты */
    const apply = (p2, msg, relayout) => { Store.set('training.aiPrefs', p2);
      if (ai) { const dates = liftFuture(plan, h); regenKeep(plans, plan, p2, relayout); if (dates.length) placeOn(plan, h, dates); h.afterTransfer && h.afterTransfer(); }
      render(content, plan, h); if (msg) qToast(msg); };
    const today = new Date(); today.setHours(0, 0, 0, 0); const todayK = ymdQ(today);
    const Q = ai ? ai.queue : [];
    const freeIdx = Q.map((q, i) => i).filter(i => !Q[i].transferred);
    const next = freeIdx.length ? freeIdx[0] : -1, nq = next >= 0 ? Q[next] : null;
    const todayIdx = Q.findIndex(q => q.transferred && q.date === todayK);
    const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);
    const askIdx = Q.findIndex(q => q.transferred && q.date && !q.ok && fromYmdQ(q.date) < today && fromYmdQ(q.date) >= weekAgo);
    const futureIdx = Q.map((q, i) => i).filter(i => Q[i].transferred && Q[i].date && Q[i].date > todayK);
    const nameT = (q) => `Тренировка ${q.t + 1} · ${q.title}`;
    const inPlan = Q.filter(q => q.transferred).length;
    const soonIdx = todayIdx < 0 && futureIdx.length ? futureIdx.slice().sort((a, b) => Q[a].date < Q[b].date ? -1 : 1)[0] : -1;
    const headIdx = todayIdx >= 0 ? todayIdx : soonIdx >= 0 ? soonIdx : next;
    const placed = futureIdx.slice().sort((a, b) => Q[a].date < Q[b].date ? -1 : 1);
    const showN = window._aiShowAll ? freeIdx.length : 6;

    /* AI-тренировки в будущих днях Плана без живого AI-плана (план удалили, а тренировки остались) */
    const orphans = () => { const out = []; const p = toArr(h.getPlans()).find(x => x && x.id === plan.id); if (!p) return out;
      toArr(p.weeks).forEach((w, wi) => toArr(w && w.days).forEach((d, di) => { if (!d) return; const dt = planDayDate(p, d.date); if (!dt || dt < today) return;
        toArr(d.sessions).forEach((x, si) => { if (x && x.ai && !x.aiOk && (!x.aiSig || x.aiSig === aiSigOf(x))) out.push({ wi, di, si }); }); })); return out; };
    content.innerHTML = `<div class="ai-wrap">${viewTabs()}
      <div class="ai-card">
        <div class="ai-card-h"><div class="ai-hero-ico sm"><i class="ti ti-sparkles"></i></div><div><div class="ai-hero-t">AI-тренер</div>
          <div class="ai-hero-d">Тренировки идут по очереди: ${L.trainings.map((_, i) => i + 1).join(' → ')}${L.N > 1 ? ' → снова 1' : ''}. В какой день идти, выбираешь ты</div></div></div>
        ${circleHtml(L.trainings, true)}
        <div class="q-hint"><i class="ti ti-hand-finger"></i> Нажми на мышцу, чтобы перенести её в другую тренировку</div>
        <details class="ai-more"${window._aiMoreOpen ? ' open' : ''}><summary><i class="ti ti-adjustments-horizontal"></i> Настройки <i class="ti ti-chevron-down"></i></summary>
          ${an.workouts < 3 ? focusHtml(prefs) : ''}${qSettingsHtml(prefs, L.N, L.manual)}${sourcesHtml(cp.src, cp.on, plan)}</details>
      </div>
      ${!ai && legacy ? '<div class="q-tip"><i class="ti ti-info-circle"></i> AI-план стал проще: тренировки идут по очереди, без привязки к дням недели. Нажми «Составить план». То, что ты уже добавил во вкладку План, останется</div>' : ''}
      ${!ai && orphans().length ? `<div class="q-tip"><i class="ti ti-info-circle"></i><span>В Плане остались будущие тренировки от прошлого AI-плана: ${orphans().length}. <button class="q-back" id="q-orph">Убрать их</button></span></div>` : ''}
      ${!ai ? `<button class="ai-gen" id="q-gen"><i class="ti ti-sparkles"></i> Составить план</button><div class="ai-hint" style="text-align:center">Подставлю упражнения и веса до конца плана №${plan.number || ''} и буду прибавлять вес сам</div>`
      : `${askIdx >= 0 ? `<div class="q-ask"><div class="q-ask-t">${esc(fmtDayL(fromYmdQ(Q[askIdx].date)))} стояла ${esc(nameT(Q[askIdx]))}. Получилось сходить?</div>
          <div class="q-btns"><button class="ai-gen" id="q-yes">Да</button><button class="ai-regen" id="q-no">Нет, был пропуск</button></div>
          <div class="q-ask-d">При пропуске она вернётся в список AI, остальные дни не тронутся</div></div>` : ''}
        ${ai.adjusted && ai.adjusted.changes && ai.adjusted.changes.length && Date.now() - ai.adjusted.at < 864e5 ? `<div class="q-adj"><i class="ti ti-refresh"></i> Обновил веса по последним записям: ${esc(ai.adjusted.changes.slice(0, 3).map(numW).join(', '))}</div>` : ''}
        ${todayIdx >= 0 ? `<div class="q-next">
          <div class="q-next-h"><span>Сегодня</span><b>${esc(nameT(Q[todayIdx]))}</b></div>
          ${exListHtml(Q[todayIdx])}
          <div class="q-btns"><button class="ai-gen" id="q-open"><i class="ti ti-calendar-event"></i> Открыть во вкладке План</button></div></div>` : ''}
        ${placed.length ? `<div class="q-sec"><div class="q-sec-h"><div class="ai-pref-t"><i class="ti ti-calendar-event"></i> Уже в плане</div><button class="q-all bad" id="q-unall"><i class="ti ti-calendar-minus"></i> Убрать все</button></div>
          ${placed.map(i => `<details class="q-up q-in"><summary><span class="q-date">${esc(fmtDay(fromYmdQ(Q[i].date)))}</span><span>${esc(nameT(Q[i]))}</span><i class="ti ti-chevron-down"></i></summary>${exListHtml(Q[i])}
            <div class="q-acts"><button class="q-act" data-mv="${i}"><i class="ti ti-calendar"></i> Другой день</button><button class="q-act bad" data-un="${i}"><i class="ti ti-calendar-minus"></i> Убрать из плана</button></div></details>`).join('')}</div>` : ''}
        ${freeIdx.length ? `<div class="q-sec"><div class="q-sec-h"><div class="ai-pref-t"><i class="ti ti-sparkles"></i> План от AI <em>${freeIdx.length}</em></div>
            <button class="q-all" id="q-week"><i class="ti ti-calendar-plus"></i> Всё в план</button></div>
          ${freeIdx.slice(0, showN).map((i, k) => `<details class="q-up q-free"${k === 0 && !placed.length && todayIdx < 0 ? ' open' : ''}><summary><b>${Q[i].t + 1}</b><span>${esc(Q[i].title)}<em>${Q[i].exercises.length} ${pl(Q[i].exercises.length, 'упражнение', 'упражнения', 'упражнений')}</em></span><button class="q-plus" data-add="${i}" aria-label="В план"><i class="ti ti-calendar-plus"></i></button><i class="ti ti-chevron-down"></i></summary>${exListHtml(Q[i])}
            <div class="q-acts"><button class="q-act main" data-today="${i}"><i class="ti ti-calendar-check"></i> На сегодня</button><button class="q-act" data-add="${i}"><i class="ti ti-calendar"></i> Выбрать день</button><button class="q-act bad ico" data-del="${i}" aria-label="Убрать"><i class="ti ti-trash"></i></button></div></details>`).join('')}
          ${freeIdx.length > showN ? `<button class="q-more" id="q-more">Показать ещё ${freeIdx.length - showN}</button>` : ''}</div>`
          : '<div class="ai-hint" style="text-align:center;margin-top:14px">Все тренировки AI уже в плане</div>'}
        <details class="ai-notes"><summary><i class="ti ti-bulb"></i> Как это работает</summary><ul>${ai.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></details>
        <div class="ai-meta"><div class="ai-meta-t">В плане: ${placed.length + (todayIdx >= 0 ? 1 : 0)} · в списке AI: ${freeIdx.length}${toArr(ai.removed).length ? ` · <button class="q-back" id="q-restore">вернуть убранные (${toArr(ai.removed).length})</button>` : ''}</div>
          <div class="ai-meta-r"><button class="ai-regen" id="q-regen"><i class="ti ti-refresh"></i> Пересобрать</button><button class="ai-reset" id="q-reset" title="Удалить AI-план"><i class="ti ti-trash"></i></button></div></div>`}
    </div>`;
    bindViews(content, plan, h);
    bindSources(content, plan, h, cp.src, cp.on);
    const more = content.querySelector('details.ai-more'); if (more) more.addEventListener('toggle', () => { window._aiMoreOpen = more.open; });
    const $ = (sel) => content.querySelector(sel);
    if ($('.q-ask')) setTimeout(() => { const el = $('.q-ask'); if (el) el.scrollIntoView({ block: 'center' }); }, 60);
    const modal = (html) => { const ov = document.createElement('div'); ov.className = 'tr-modal-overlay'; ov.innerHTML = `<div class="tr-modal ai-modal">${html}</div>`; document.body.appendChild(ov); ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); }); return ov; };

    /* настройки */
    content.querySelectorAll('.q-n [data-n]').forEach(b => b.onclick = () => apply({ ...prefs, n: +b.dataset.n, layout: null }, 'Разных тренировок: ' + b.dataset.n, true));
    content.querySelectorAll('.q-focus [data-f]').forEach(b => b.onclick = () => apply({ ...prefs, focus: b.dataset.f, layout: null }, b.dataset.f === 'lower' ? 'Упор на ноги и ягодицы' : 'Всё тело ровно', true));
    if ($('#q-auto')) $('#q-auto').onclick = () => apply({ ...prefs, layout: null }, 'Мышцы разложены как по истории', true);
    content.querySelectorAll('.ai-gl').forEach(b => b.onclick = () => apply({ ...prefs, goal: b.dataset.v }, 'Цель обновлена'));
    const STEPS = [0.25, 0.5, 1, 1.25, 2, 2.5, 3, 4, 5, 7.5, 10, 15, 20];
    const applyStep = (eq, val) => { val = Math.round(Math.min(50, Math.max(0.25, +String(val).replace(',', '.') || 0)) * 100) / 100; if (val) apply({ ...prefs, steps: { ...(prefs.steps || {}), [eq]: val } }, 'Шаг веса учтён'); };
    content.querySelectorAll('.ai-stp input').forEach(inp => inp.addEventListener('change', () => applyStep(inp.dataset.eq, inp.value)));
    content.querySelectorAll('.ai-stp button').forEach(b => b.addEventListener('click', () => {
      const cur = +String(content.querySelector(`.ai-stp input[data-eq="${b.dataset.eq}"]`).value).replace(',', '.') || 1, d = +b.dataset.d;
      const nx = d > 0 ? (STEPS.find(x => x > cur + 1e-9) || cur) : ([...STEPS].reverse().find(x => x < cur - 1e-9) || cur);
      if (nx !== cur) applyStep(b.dataset.eq, nx);
    }));

    /* мышца в другую тренировку */
    content.querySelectorAll('.q-u').forEach(b => b.onclick = () => {
      const ti = +b.dataset.t, u = b.dataset.u, lay = L.trainings.map(t => t.slice());
      const ov = modal(`<p class="tr-modal-title">${esc(u)} в тренировке ${ti + 1}</p>
        <div class="q-mv">${lay.map((t, i) => i === ti ? '' : `<button data-a="move" data-i="${i}"><i class="ti ti-arrow-right"></i><span>Перенести в тренировку ${i + 1}</span><small>${esc(titleOf(t))}</small></button>`).join('')}
        ${lay.map((t, i) => i === ti || t.includes(u) ? '' : `<button data-a="copy" data-i="${i}"><i class="ti ti-plus"></i><span>Добавить ещё и в тренировку ${i + 1}</span><small>${esc(titleOf(t))}</small></button>`).join('')}
        ${lay[ti].length > 1 ? `<button data-a="del" class="bad"><i class="ti ti-x"></i><span>Убрать из тренировки ${ti + 1}</span></button>` : ''}</div>
        <div class="tr-modal-actions"><button class="tr-modal-btn-secondary" data-x>Отмена</button></div>`);
      ov.querySelector('[data-x]').onclick = () => ov.remove();
      ov.querySelectorAll('[data-a]').forEach(x => x.onclick = () => {
        const a = x.dataset.a, i = +x.dataset.i;
        if (a !== 'copy') lay[ti].splice(lay[ti].indexOf(u), 1);
        if (a !== 'del' && !lay[i].includes(u)) lay[i].push(u);
        if (lay.some(t => !t.length)) { alert('В тренировке должна остаться хотя бы одна мышца'); return; }
        ov.remove(); apply({ ...prefs, n: lay.length, layout: lay }, 'Готово, упражнения пересобраны', true);
      });
    });

    /* составить, пересобрать, удалить */
    if ($('#q-orph')) $('#q-orph').onclick = () => { const list = orphans(); if (!confirm(`Убрать из Плана ${list.length} ${pl(list.length, 'тренировку', 'тренировки', 'тренировок')} от прошлого AI-плана? Сделанные и изменённые тобой останутся.`)) return;
      const plans = h.getPlans(); const p = plans.find(x => x && x.id === plan.id);
      list.slice().reverse().forEach(o => { const d = toArr(p.weeks)[o.wi].days[o.di]; const ss = toArr(d.sessions); ss.splice(o.si, 1); d.sessions = ss; });
      h.savePlans(plans); h.afterTransfer && h.afterTransfer(); render(content, plan, h); qToast('Убрал ' + list.length); };
    if ($('#q-gen')) $('#q-gen').onclick = () => { window.Analytics && Analytics.ev('ai'); const res = generate(plans, plan, {}); if (res.error) { alert('Не получилось составить план'); return; } save(res); render(content, plan, h); qToast('План готов'); };
    if ($('#q-regen')) $('#q-regen').onclick = () => { if (!confirm('Пересобрать с учётом последних тренировок? То, что уже стоит в плане, не тронется.')) return; regenKeep(plans, plan, prefs); render(content, plan, h); qToast('План пересобран'); };
    /* будущие AI-тренировки, которые ты ещё не менял: их можно снять из Плана */
    const removable = () => { const a = load(); const tk = todayK; return a ? a.queue.map((q, i) => i).filter(i => { const q = a.queue[i]; return q.transferred && q.date && q.date >= tk && !q.ok && !qEdited(plan, h, q); }) : []; };
    const unplace = (idxs) => { const a = load(); idxs.forEach(i => { const q = a.queue[i]; untransfer(plan, h, q); Object.assign(q, { transferred: false, date: null, wi: null, di: null, ok: false }); }); save(a); h.afterTransfer && h.afterTransfer(); return idxs.length; };
    if ($('#q-unall')) $('#q-unall').onclick = () => { const ids = removable(); if (!ids.length) { qToast('Убирать нечего: в будущих днях AI-тренировок нет'); return; }
      if (!confirm(`Убрать из Плана ${ids.length} ${pl(ids.length, 'тренировку', 'тренировки', 'тренировок')} от AI? Сделанные и те, где ты менял веса, останутся.`)) return;
      const n = unplace(ids); render(content, plan, h); qToast(`Убрал ${n} ${pl(n, 'тренировку', 'тренировки', 'тренировок')}, они снова в списке AI`); };
    if ($('#q-reset')) $('#q-reset').onclick = () => { const ids = removable();
      if (!confirm('Удалить AI-план?' + (ids.length ? ` Будущие AI-тренировки (${ids.length}) уберу из Плана.` : '') + ' Сделанные тренировки останутся.')) return;
      if (ids.length) unplace(ids); Store.set('training.ai', null); render(content, plan, h); qToast('AI-план удалён'); };
    if ($('#q-open')) $('#q-open').onclick = () => { if (h.openPlan) h.openPlan(); };

    /* поставить тренировку очереди на дату */
    const dayBusy = (date) => { const pd = planDayAt(plan, date); return pd && toArr(pd.day.sessions).some(x => x && x.type !== 'Отдых'); };
    const putOn = (i, date, quiet) => {
      const a = load(), q = a.queue[i]; const pd = planDayAt(plan, date);
      if (!pd) { if (!quiet) alert('Этот день уже за пределами плана. Создай следующий план, и я продолжу'); return false; }
      if (!quiet && dayBusy(date) && !confirm('На этот день уже есть тренировка. Добавить ещё одну?')) return false;
      if (!transfer(plan, h, pd.wi, pd.di, { ...q, qid: qid(q) })) return false;
      Object.assign(q, { transferred: true, date: ymdQ(date), wi: pd.wi, di: pd.di, ok: false }); save(a); return true;
    };
    const done = (msg) => { h.afterTransfer && h.afterTransfer(); render(content, plan, h); qToast(msg); };
    const daysAhead = (k) => Array.from({ length: k }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() + i); return d; });
    /* выбрать день для конкретной тренировки (новой из списка AI или уже стоящей в плане) */
    const pickDay = (i, move) => {
      const q = Q[i];
      const ov = modal(`<p class="tr-modal-title">В какой день ${esc(nameT(q))}?</p><div class="q-days">${daysAhead(14).map(d => `<button data-d="${ymdQ(d)}" class="${q.date === ymdQ(d) ? 'on' : ''}">${esc(fmtDay(d))}${ymdQ(d) === todayK ? '<em>сегодня</em>' : dayBusy(d) ? '<em>есть тренировка</em>' : ''}</button>`).join('')}</div>
        <div class="tr-modal-actions"><button class="tr-modal-btn-secondary" data-x>Отмена</button></div>`);
      ov.querySelector('[data-x]').onclick = () => ov.remove();
      ov.querySelectorAll('[data-d]').forEach(x => x.onclick = () => { const d = fromYmdQ(x.dataset.d);
        if (move) { const a = load(); untransfer(plan, h, a.queue[i]); Object.assign(a.queue[i], { transferred: false, date: null, wi: null, di: null, ok: false }); save(a); }
        if (putOn(i, d)) { ov.remove(); done('В Плане на ' + fmtDay(d)); } else if (move) { ov.remove(); render(content, plan, h); } });
    };
    content.querySelectorAll('[data-today]').forEach(b => b.onclick = () => { if (putOn(+b.dataset.today, today)) done('Добавил во вкладку План на сегодня'); });
    content.querySelectorAll('[data-add]').forEach(b => b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); pickDay(+b.dataset.add); });
    content.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => pickDay(+b.dataset.mv, true));
    content.querySelectorAll('[data-un]').forEach(b => b.onclick = () => { const a = load(), q = a.queue[+b.dataset.un];
      untransfer(plan, h, q); Object.assign(q, { transferred: false, date: null, wi: null, di: null, ok: false }); save(a); done('Убрал из Плана, тренировка снова в списке AI'); });
    content.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const a = load(), q = a.queue[+b.dataset.del];
      a.removed = [...new Set([...toArr(a.removed), q.r + ':' + q.t])]; a.queue.splice(+b.dataset.del, 1); save(a); render(content, plan, h); qToast('Убрал из списка'); });
    if ($('#q-more')) $('#q-more').onclick = () => { window._aiShowAll = true; render(content, plan, h); };
    if ($('#q-restore')) $('#q-restore').onclick = () => { const a = load(); a.removed = []; save(a); regenKeep(plans, plan, prefs); render(content, plan, h); qToast('Убранные тренировки вернулись'); };
    /* расписать наперёд: отмечаешь дни, тренировки встают по очереди */
    if ($('#q-week')) $('#q-week').onclick = () => {
      /* твои записанные и сегодняшняя остаются на месте, остальные будущие можно переставить */
      /* уже стоящие в плане не трогаем, новые встают на отмеченные дни по очереди списка */
      const fixed = {};
      Q.forEach(q => { if (q.transferred && q.date) fixed[q.date] = q.t + 1; });
      const days = daysAhead(14);
      const sel = [];
      const order = freeIdx.slice();
      const ov = modal('');
      const box = ov.querySelector('.tr-modal');
      const draw = () => {
        box.innerHTML = `<p class="tr-modal-title">Всё в план</p>
          <div class="q-ask-d" style="text-align:left;margin-top:0">Отметь дни на 2 недели, тренировки из списка встанут по очереди</div>
          <div class="q-quick">${[['Пн Ср Пт', [1, 3, 5]], ['Вт Чт Сб', [2, 4, 6]], ['Пн Чт', [1, 4]]].map(([t, dw], k) => `<button data-q="${k}" data-dw="${dw.join(',')}">${t}</button>`).join('')}</div>
          <div class="q-days">${days.map(d => { const k = ymdQ(d), i = sel.indexOf(k); return fixed[k]
            ? `<button disabled class="busy">${esc(fmtDay(d))}<em>уже тренировка ${fixed[k]}</em></button>`
            : `<button data-d="${k}" class="${i >= 0 ? 'on' : ''}">${esc(fmtDay(d))}${i >= 0 && order[i] != null ? `<em>тренировка ${Q[order[i]].t + 1}</em>` : k === todayK ? '<em>сегодня</em>' : ''}</button>`; }).join('')}</div>
          <div class="tr-modal-actions"><button class="tr-modal-btn-secondary" data-x>Отмена</button><button class="tr-modal-btn-primary" id="q-ok"${sel.length ? '' : ' disabled'}>${sel.length ? 'Поставить на ' + sel.length + ' ' + pl(sel.length, 'день', 'дня', 'дней') : 'Отметь дни'}</button></div>`;
        box.querySelector('[data-x]').onclick = () => ov.remove();
        box.querySelectorAll('[data-d]').forEach(x => x.onclick = () => { const i = sel.indexOf(x.dataset.d); if (i >= 0) sel.splice(i, 1); else if (sel.length < order.length) sel.push(x.dataset.d); sel.sort(); draw(); });
        box.querySelectorAll('[data-q]').forEach(x => x.onclick = () => { const dw = x.dataset.dw.split(',').map(Number); sel.length = 0; days.forEach(d => { const k = ymdQ(d); if (!fixed[k] && k >= todayK && dw.includes(d.getDay()) && sel.length < order.length) sel.push(k); }); sel.sort(); draw(); });
        box.querySelector('#q-ok').onclick = () => {
          if (!sel.length) { ov.remove(); return; }
          const n = placeOn(plan, h, sel.slice());
          ov.remove(); done(`В Плане ${n} ${pl(n, 'новая тренировка', 'новые тренировки', 'новых тренировок')}`); };
      };
      draw();
    };

    /* сходил или пропустил */
    if ($('#q-yes')) $('#q-yes').onclick = () => { const a = load(); a.queue[askIdx].ok = true; save(a); markOk(plan, h, a.queue[askIdx]); render(content, plan, h); qToast('Отлично, веса подстрою по записи'); };
    if ($('#q-no')) $('#q-no').onclick = () => {
      const a = load(); const sk = a.queue[askIdx];
      untransfer(plan, h, sk); Object.assign(sk, { transferred: false, date: null, wi: null, di: null, ok: false });
      save(a); h.afterTransfer && h.afterTransfer(); render(content, plan, h);
      qToast(`Тренировка ${sk.t + 1} снова в списке AI, поставь её на удобный день`);
    };
  }
  function markOk(plan, h, q) {
    const plans = h.getPlans(); const p = plans.find(x => x && x.id === plan.id); if (!p || q.wi == null) return;
    const day = toArr(p.weeks)[q.wi] && toArr(p.weeks[q.wi].days)[q.di]; if (!day) return;
    toArr(day.sessions).forEach(s => { if (s && s.ai && s.aiQ === qid(q)) s.aiOk = true; });
    h.savePlans(plans);
  }
  /* убрать AI-тренировку из дня плана */
  function untransfer(plan, h, q) {
    if (q.wi == null || q.di == null) return;
    const plans = h.getPlans(); const p = plans.find(x => x && x.id === plan.id); if (!p) return;
    const day = toArr(p.weeks)[q.wi] && toArr(p.weeks[q.wi].days)[q.di]; if (!day) return;
    const ss = toArr(day.sessions);
    let k = ss.findIndex(s => s && s.ai && s.aiQ === qid(q));
    if (k < 0) k = ss.findIndex(s => s && s.ai);
    if (k < 0) return;
    ss.splice(k, 1); day.sessions = ss;
    h.savePlans(plans);
  }

  function render(content, plan, h) {
    if (window._aiView === 'chat' && !(window.APP_CONFIG && APP_CONFIG.aiChatUrl)) window._aiView = 'plan';
    if (window._aiView === 'chat' && window.TrainingChat) {
      TrainingChat.render(content, plan, h, viewTabs(), () => bindViews(content, plan, h));
      return;
    }
    if (window._aiView === 'insights' && window.TrainingInsights) {
      try { autoAdjust(plan, h); } catch (e) {}
      TrainingInsights.render(content, plan, h, viewTabs(), () => bindViews(content, plan, h));
      return;
    }
    /* Клиента ведёт тренер: план составляет тренер, AI помогает ему в кабинете тренера */
    const myT = !window.__coachMode && window.FirebaseSync && FirebaseSync.myTrainerCached ? FirebaseSync.myTrainerCached() : null;
    if (myT) {
      content.innerHTML = `<div class="ai-wrap">${viewTabs()}
        <div class="ai-hero">
          <div class="ai-hero-ico"><i class="ti ti-user-star"></i></div>
          <div class="ai-hero-t">План ведёт тренер: ${esc(myT.name || 'тренер')}</div>
          <div class="ai-hero-d">Чтобы не было двух разных планов, AI-план выключен. AI-тренер работает на твоего тренера: подсказывает ему, где плато и что подтянуть, а тренер решает, что поменять. «Разбор» с твоим прогрессом остаётся у тебя.</div>
          <button class="ai-regen" id="ai-go-ins" style="margin-top:14px"><i class="ti ti-chart-dots"></i> Открыть разбор</button>
        </div></div>`;
      bindViews(content, plan, h);
      const gi = content.querySelector('#ai-go-ins'); if (gi) gi.onclick = () => { window._aiView = 'insights'; render(content, plan, h); };
      return;
    }
    /* плана ещё нет: анкета и одна кнопка, план создастся сам */
    if (!plan || !plan.weeks) {
      const pr0 = prefsGet(), an0 = analyze(collect(toArr(h.getPlans())), pr0);
      content.innerHTML = `<div class="ai-wrap">${viewTabs()}
        <div class="ai-card"><div class="ai-card-h"><div class="ai-hero-ico sm"><i class="ti ti-sparkles"></i></div><div><div class="ai-hero-t">AI-тренер</div><div class="ai-hero-d">${an0.workouts ? 'Составлю план на 8 недель по твоим тренировкам' : 'Составлю план на 8 недель. Веса подстрою по твоим первым тренировкам'}</div></div></div>
          ${an0.workouts < 3 ? focusHtml(pr0) : ''}
          ${circleHtml(buildLayout(collect(toArr(h.getPlans())), an0, pr0).trainings, false)}
          <div class="q-hint">Тренировки идут по очереди, в какой день идти, выбираешь ты. Какие мышцы в какой тренировке, поменяешь потом</div></div>
        <button class="ai-gen" id="ai-start"><i class="ti ti-sparkles"></i> Составить план</button></div>`;
      bindViews(content, plan, h);
      bindAnketa(content, an0, pr0, (p2) => { Store.set('training.aiPrefs', p2); render(content, plan, h); });
      content.querySelectorAll('.q-focus [data-f]').forEach(b => b.onclick = () => { Store.set('training.aiPrefs', { ...pr0, focus: b.dataset.f, layout: null }); render(content, plan, h); });
      content.querySelector('#ai-start').onclick = () => { window.Analytics && Analytics.ev('ai');
        const np = h.createPlan ? h.createPlan() : null; if (!np) return;
        const res = generate(toArr(h.getPlans()), np, { fromWeek: 0 });
        if (res.error) { alert('Не получилось составить план'); return; }
        save(res); h.rerender ? h.rerender() : render(content, np, h);
      };
      return;
    }
    const cp = chosenPlans(h.getPlans());
    const plans = cp.on.map(x => x.p);
    const history = collect(plans);
    const prefs = prefsGet();
    const an = analyze(history, prefs);
    { const ai0 = load();
      /* AI-план привязан к своему 8-недельному плану. Если в списке выбран другой план,
         а AI-план ещё идёт (сегодня внутри его плана), показываем его, а не «Составить план» */
      if (ai0 && ai0.planId && ai0.planId !== plan.id) {
        const own = toArr(h.getPlans()).find(p => p && p.id === ai0.planId);
        const t0 = new Date(); t0.setHours(0, 0, 0, 0);
        if (own && own.weeks && planDayAt(own, t0) && !planDayAt(plan, t0)) plan = own;
      } }
    let adj = null;
    try { adj = autoAdjust(plan, h); } catch (e) { console.error('autoAdjust', e); }
    let ai = load();
    if (ai && ai.planId !== plan.id) ai = null;
    /* старый план по неделям после обновления показываем в новом виде: составляется заново по очереди */
    if (prefs.method !== 'weeks') { const legacy = !!(ai && ai.mode !== 'queue'); return renderQueue(content, plan, h, plans, history, an, prefs, legacy ? null : ai, cp, legacy); }

    if (false) {
      const wPct = Math.min(100, Math.round(an.weeks / MIN_WEEKS * 100));
      const tPct = Math.min(100, Math.round(an.workouts / MIN_WORKOUTS * 100));
      content.innerHTML = `<div class="ai-wrap">${viewTabs()}
        <div class="ai-hero">
          <div class="ai-hero-ico"><i class="ti ti-sparkles"></i></div>
          <div class="ai-hero-t">AI-тренер пока собирает данные</div>
          <div class="ai-hero-d">Потренируйся 1–2 недели и записывай упражнения с весами. Потом я составлю план до конца плана №${plan.number || ''} с прогрессией нагрузок.</div>
          <div class="ai-prog"><span>Недель с тренировками</span><b>${an.weeks} из ${MIN_WEEKS}</b></div>
          <div class="ai-bar"><span style="width:${wPct}%"></span></div>
          <div class="ai-prog"><span>Записанных тренировок</span><b>${an.workouts} из ${MIN_WORKOUTS}</b></div>
          <div class="ai-bar"><span style="width:${tPct}%"></span></div>
          <div class="ai-hint">Хватит любого из двух условий.</div>
        </div>${sourcesHtml(cp.src, cp.on, plan)}</div>`;
      bindSources(content, plan, h, cp.src, cp.on);
      bindViews(content, plan, h);
      return;
    }

    const favEx = Object.values(an.ex).sort((a, b) => b.count - a.count).slice(0, 5);
    const prefDays = toArr(prefs.days), prefSplits = toArr(prefs.splits);
    const splitNow = buildSplit(an, prefs).map(c => c.key);
    const statsHtml = `
      <div class="ai-stats"${an.workouts ? '' : ' style="display:none"'}>
        <div><b>${an.workouts}</b><span>тренировок</span></div>
        <div><b>${an.freq}×</b><span>в неделю</span></div>
        <div><b>${an.weeks}</b><span>недель</span></div>
      </div>
      ${previewHtml(an)}
      <details class="ai-more"${window._aiMoreOpen ? ' open' : ''}><summary><i class="ti ti-adjustments-horizontal"></i> Дни, цель и шаг веса <i class="ti ti-chevron-down"></i></summary>
      ${basicsHtml(an, prefs)}
      <div class="ai-pref">
        <div class="ai-pref-t"><i class="ti ti-weight"></i> Шаг веса <em>какие веса есть в твоём зале</em></div>
        <div class="ai-steps">${Object.entries(EQUIP).map(([k, e]) => `<div class="ai-step"><span>${e.label}</span><div class="ai-stp"><button data-eq="${k}" data-d="-1" aria-label="Меньше">−</button><input data-eq="${k}" type="text" inputmode="decimal" value="${String(+(prefs.steps || {})[k] || e.def).replace('.', ',')}"><em>кг</em><button data-eq="${k}" data-d="1" aria-label="Больше">+</button></div></div>`).join('')}</div>
      </div>
      ${favEx.length ? `<div class="ai-fav"><div class="ai-pref-t"><i class="ti ti-trending-up"></i> Частые упражнения</div>${favEx.map(x => {
        const d = x.first && x.last && x.first.weight && x.last.weight ? Math.round((x.last.weight - x.first.weight) * 10) / 10 : 0;
        return `<div class="ai-fav-row"><span>${esc(x.name)}<small>${x.count} раз</small></span><b>${x.last && x.last.weight ? String(x.last.weight).replace('.', ',') + ' кг' : 'без веса'}${d > 0 ? ` <em>+${String(d).replace('.', ',')}</em>` : ''}</b></div>`;
      }).join('')}</div>` : ''}
      </details>`;

    let body;
    const weeksAll = toArr(plan.weeks).length, autoW = autoFromWeek(plan);
    const weekSel = `<label class="ai-from">Заполнить с недели <select id="ai-from">${Array.from({ length: weeksAll }, (_, i) => `<option value="${i}"${i === Math.min(ai && ai.fromWeek != null ? ai.fromWeek : autoW, weeksAll - 1) ? ' selected' : ''}>${i + 1}</option>`).join('')}</select></label>`;
    if (!ai) {
      body = `<button class="ai-gen" id="ai-gen"><i class="ti ti-sparkles"></i> Составить план</button>
        <div class="ai-hint" style="text-align:center">До конца плана №${plan.number || ''}, с твоими весами и прогрессией</div>
        <details class="ai-more ai-more-s"><summary>С какой недели <i class="ti ti-chevron-down"></i></summary>${weekSel}</details>`;
    } else {
      const doneDays = ai.weeks.reduce((s, w) => s + w.days.filter(d => d.transferred).length, 0);
      const allDays = ai.weeks.reduce((s, w) => s + w.days.length, 0);
      body = `
        <div class="ai-meta">
          <div class="ai-meta-t">Составлен ${new Date(ai.generatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · ${ai.basedOn.workouts} трен.${toArr(ai.basedOn.plans).length ? ' из плана №' + toArr(ai.basedOn.plans).join(', №') : ''} · в плане ${doneDays} из ${allDays}</div>
          <div class="ai-meta-r">${weekSel}<button class="ai-regen" id="ai-gen"><i class="ti ti-refresh"></i> Пересобрать</button><button class="ai-reset" id="ai-reset" title="Сбросить"><i class="ti ti-trash"></i></button></div>
        </div>
        ${doneDays < allDays ? `<button class="ai-gen ai-all" id="ai-all"><i class="ti ti-calendar-plus"></i> Перенести всё в мой план · ${allDays - doneDays} ${(n => { const x = n % 10, y = n % 100; return x === 1 && y !== 11 ? 'тренировка' : x >= 2 && x <= 4 && (y < 12 || y > 14) ? 'тренировки' : 'тренировок'; })(allDays - doneDays)}</button>` : ''}
        ${ai.adjusted && Date.now() - ai.adjusted.at < 3 * 864e5 ? `<div class="ai-adjusted"><i class="ti ti-wand"></i><div><b>План подстроен под последнюю тренировку</b>${toArr(ai.adjusted.changes).length ? '<span>' + toArr(ai.adjusted.changes).slice(0, 4).map(esc).join('<br>') + '</span>' : '<span>Веса и повторы пересчитаны по твоим результатам</span>'}</div></div>` : ''}
        <details class="ai-notes"><summary><i class="ti ti-bulb"></i> Как я считал</summary><ul>${ai.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></details>
        ${ai.weeks.map((w, wk) => `
          <div class="ai-week">
            <div class="ai-week-h">
              <div><b>Неделя ${w.wi + 1}</b>${w.deload ? '<span class="ai-deload">разгрузка</span>' : ''}</div>
              <button class="ai-week-btn" data-week="${wk}"><i class="ti ti-calendar-plus"></i> Всю неделю в план</button>
            </div>
            ${w.days.map((d, dk) => `
              <div class="ai-day${d.transferred ? ' is-done' : ''}">
                <div class="ai-day-h">
                  <div class="ai-day-date"><b>${esc(d.dow)}</b><span>${esc(d.date)}</span></div>
                  <div class="ai-day-groups">${d.title ? `<span class="ai-day-title">${esc(d.title)}</span>` : d.groups.map(g => `<span>${esc(g)}</span>`).join('')}</div>
                  ${d.transferred ? '<span class="ai-done"><i class="ti ti-check"></i> в плане</span>'
                    : `<button class="ai-move" data-week="${wk}" data-day="${dk}"><i class="ti ti-arrow-bar-to-right"></i> В план</button>`}
                </div>
                <div class="ai-ex">${d.exercises.map(e => `
                  <div class="ai-ex-row">
                    <div class="ai-ex-name">${esc(e.name)}${e.isNew ? '<span class="ai-new">новое</span>' : ''}<small>${esc([e.why ? '' : (REGION_LABEL[e.region] || ''), e.base ? 'было ' + e.base : '', e.why || ''].filter(Boolean).join(' · '))}</small></div>
                    <div class="ai-ex-load">${fmtW(e)}${e.up ? '<i class="ti ti-trending-up ai-up" title="вес вверх"></i>' : ''}${e.down ? '<i class="ti ti-trending-down ai-down" title="вес ниже"></i>' : ''}</div>
                  </div>`).join('')}</div>
              </div>`).join('')}
          </div>`).join('')}`;
    }

    content.innerHTML = `<div class="ai-wrap">${viewTabs()}
      <div class="ai-card">
        <div class="ai-card-h"><div class="ai-hero-ico sm"><i class="ti ti-sparkles"></i></div><div><div class="ai-hero-t">AI-тренер</div><div class="ai-hero-d">План №${plan.number || ''} · сейчас неделя ${Math.min(toArr(plan.weeks).length, currentWeekIdx(plan) + 1)} из ${toArr(plan.weeks).length}</div></div></div>
        ${statsHtml}
        ${sourcesHtml(cp.src, cp.on, plan)}
        <button class="ai-export" id="ai-export"><i class="ti ti-download"></i> Выгрузить историю тренировок</button>
      </div>
      ${body}
    </div>`;

    const gen = content.querySelector('#ai-gen');
    if (gen) gen.addEventListener('click', () => {
      if (ai && !confirm('Пересобрать план заново с учётом всех новых данных? Уже перенесённые тренировки в основном плане останутся.')) return;
      const fw = content.querySelector('#ai-from');
      gen.disabled = true; gen.innerHTML = '<i class="ti ti-loader-2 ai-spin"></i> Собираю…';
      const res = generate(plans, plan, { fromWeek: fw ? +fw.value : undefined });
      if (res.error === 'ended') { alert('В этом плане не осталось будущих недель. Создай новый план, и я заполню его.'); render(content, plan, h); return; }
      if (res.error) { alert('Мало данных в выбранных планах. Включи ещё планы-источники или потренируйся 1–2 недели.'); render(content, plan, h); return; }
      /* уже перенесённые дни помечаем и в новом плане, чтобы не задублировать */
      if (ai) {
        const done = new Set();
        ai.weeks.forEach(w => w.days.forEach(d => { if (d.transferred) done.add(w.wi + ':' + d.di); }));
        res.weeks.forEach(w => w.days.forEach(d => { if (done.has(w.wi + ':' + d.di)) d.transferred = true; }));
      }
      save(res);
      setTimeout(() => { render(content, plan, h); toast(content, ai ? 'План пересобран с недели ' + (res.fromWeek + 1) : 'План готов'); }, 350);
    });
    const rst = content.querySelector('#ai-reset');
    if (rst) rst.addEventListener('click', () => {
      if (!confirm('Сбросить AI-план полностью? Тренировки, уже перенесённые в основной план, останутся. Потом можно собрать заново.')) return;
      Store.set('training.ai', null); render(content, plan, h); toast(content, 'AI-план сброшен');
    });
    bindSources(content, plan, h, cp.src, cp.on);
    bindViews(content, plan, h);
    const setPrefs = (p2) => { Store.set('training.aiPrefs', p2); render(content, plan, h); };
    /* анкета: поменял ответ, план сразу пересобирается, уже перенесённые дни не трогаем */
    bindAnketa(content, an, prefs, (p2) => {
      Store.set('training.aiPrefs', p2);
      if (ai) regenKeep(plans, plan, p2);
      render(content, plan, h);
    });
    content.querySelectorAll('.ai-split').forEach(b => b.addEventListener('click', () => {
      const cur = splitNow.slice(); const k = b.dataset.k; const i = cur.indexOf(k);
      if (i >= 0) { if (cur.length === 1) return; cur.splice(i, 1); } else cur.push(k);
      setPrefs({ ...prefs, splits: cur });
    }));
    const pr = content.querySelector('#ai-pref-reset'); if (pr) pr.addEventListener('click', () => setPrefs({ goal: prefs.goal, swaps: prefs.swaps }));
    /* шаг веса: любое значение с клавиатуры или кнопками −/+ по привычным шагам */
    const STEPS = [0.25, 0.5, 1, 1.25, 2, 2.5, 3, 4, 5, 7.5, 10, 15, 20];
    const applyStep = (eq, val) => {
      val = Math.round(Math.min(50, Math.max(0.25, +String(val).replace(',', '.') || 0)) * 100) / 100; if (!val) return;
      const p2 = { ...prefs, steps: { ...(prefs.steps || {}), [eq]: val } }; Store.set('training.aiPrefs', p2);
      if (ai) regenKeep(plans, plan, p2);
      render(content, plan, h); toast(content, 'Шаг веса учтён' + (ai ? ', план пересчитан' : ''));
    };
    content.querySelectorAll('.ai-stp input').forEach(inp => inp.addEventListener('change', () => applyStep(inp.dataset.eq, inp.value)));
    content.querySelectorAll('.ai-stp button').forEach(b => b.addEventListener('click', () => {
      const cur = +String(content.querySelector(`.ai-stp input[data-eq="${b.dataset.eq}"]`).value).replace(',', '.') || 1, d = +b.dataset.d;
      const next = d > 0 ? (STEPS.find(x => x > cur + 1e-9) || cur) : ([...STEPS].reverse().find(x => x < cur - 1e-9) || cur);
      if (next !== cur) applyStep(b.dataset.eq, next);
    }));
    content.querySelectorAll('.ai-mth').forEach(b => b.addEventListener('click', (ev) => {
      ev.stopImmediatePropagation();
      const p2 = { ...prefs, method: b.dataset.m }; Store.set('training.aiPrefs', p2);
      if (ai) regenKeep(plans, plan, p2);
      render(content, plan, h); toast(content, b.dataset.m === 'smart' ? 'Научная методика' + (ai ? ', план пересобран' : '') : 'По твоим связкам' + (ai ? ', план пересобран' : ''));
    }));
    const exb = content.querySelector('#ai-export'); if (exb) exb.addEventListener('click', () => {
      const data = { exportedAt: new Date().toISOString(), plans: h.getPlans() };
      const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'you-trainings-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      toast(content, 'Файл с историей скачан');
    });
    const more = content.querySelector('details.ai-more:not(.ai-more-s)'); if (more) more.addEventListener('toggle', () => { window._aiMoreOpen = more.open; });
    const allb = content.querySelector('#ai-all'); if (allb) allb.onclick = () => { if (confirm('Перенести все тренировки AI-плана в твой план по дням?')) transferAll(content, plan, h); };
    content.querySelectorAll('.ai-move').forEach(b => b.addEventListener('click', () => openMove(content, plan, h, +b.dataset.week, +b.dataset.day)));
    content.querySelectorAll('.ai-week-btn').forEach(b => b.addEventListener('click', () => {
      const a = load(); const w = a.weeks[+b.dataset.week];
      const left = w.days.filter(d => !d.transferred);
      if (!left.length) { alert('Эта неделя уже в плане'); return; }
      if (!confirm(`Перенести ${left.length} тренир. недели ${w.wi + 1} в основной план по своим дням?`)) return;
      w.days.forEach((d, dk) => { if (!d.transferred) transfer(plan, h, w.wi, d.di, d); d.transferred = true; });
      save(a); h.afterTransfer(); render(content, plan, h);
    }));
  }

  function transfer(plan, h, wi, di, d) {
    const plans = h.getPlans();
    const p = plans.find(x => x && x.id === plan.id) || plan;
    const day = toArr(p.weeks)[wi] && toArr(p.weeks[wi].days)[di];
    if (!day) return false;
    if (typeof trSnapshotBeforeChange === 'function') trSnapshotBeforeChange();
    if (typeof trMigrateDayToSessions === 'function') trMigrateDayToSessions(day);
    day.sessions = toArr(day.sessions);
    day.sessions.push({
      type: TYPE, groups: d.groups.slice(), ai: true, ...(d.qid ? { aiQ: d.qid } : {}),
      exercises: d.exercises.map(e => ({ kind: 'strength', name: e.name, sets: e.sets, reps: e.reps, weight: e.weight || 0 })),
    });
    const ns = day.sessions[day.sessions.length - 1]; if (d.qid) ns.aiSig = aiSigOf(ns);
    h.savePlans(plans.map(x => x && x.id === p.id ? p : x));
    return true;
  }

  function openMove(content, plan, h, wk, dk) {
    const a = load(); const d = a.weeks[wk].days[dk];
    const weeks = toArr(plan.weeks);
    const ov = document.createElement('div');
    ov.className = 'tr-modal-overlay';
    const weekOpts = weeks.map((w, i) => `<option value="${i}" ${i === a.weeks[wk].wi ? 'selected' : ''}>Неделя ${i + 1}${w && w.range ? ' · ' + w.range : ''}</option>`).join('');
    const dayOpts = (wi) => toArr(weeks[wi] && weeks[wi].days).map((x, i) => {
      const busy = x && toArr(x.sessions).some(s => s && s.type !== 'Отдых');
      return `<option value="${i}" ${i === d.di ? 'selected' : ''}>${x ? x.dow + ' ' + x.date : DOW[i]}${busy ? ' · уже есть тренировка' : ''}</option>`;
    }).join('');
    ov.innerHTML = `<div class="tr-modal ai-modal">
      <p class="tr-modal-title">Перенести в план</p>
      <div class="ai-modal-sum">${esc(d.groups.join(' + '))} · ${d.exercises.length} упражнений</div>
      <div class="tr-modal-row"><label style="flex:1 1 100%">Неделя<select id="ai-w" class="tr-color-select">${weekOpts}</select></label></div>
      <div class="tr-modal-row"><label style="flex:1 1 100%">День<select id="ai-d" class="tr-color-select">${dayOpts(a.weeks[wk].wi)}</select></label></div>
      <div class="tr-modal-actions">
        <button class="tr-modal-btn-secondary" id="ai-c">Отмена</button>
        <button class="tr-modal-btn-primary" id="ai-ok">Перенести</button>
      </div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    ov.querySelector('#ai-c').onclick = () => ov.remove();
    ov.querySelector('#ai-w').onchange = (e) => { ov.querySelector('#ai-d').innerHTML = dayOpts(+e.target.value); };
    ov.querySelector('#ai-ok').onclick = () => {
      const wi = +ov.querySelector('#ai-w').value, di = +ov.querySelector('#ai-d').value;
      if (!transfer(plan, h, wi, di, d)) { alert('Не нашёл такой день в плане'); return; }
      const a2 = load(); a2.weeks[wk].days[dk].transferred = true; save(a2);
      ov.remove(); h.afterTransfer(); render(content, plan, h);
    };
  }

  function rerender(content, plan, h) { render(content, plan, h); }
  return { render, generate, regenKeep, analyze, collect, classify, buildContext, autoAdjust, chosenPlans, prefsGet, exKey, sigOf, load, save,
    GOALS, EQUIP, equipOf, stepFor, SLOTS, REGION_LABEL, DOW, toArr, esc, currentWeekIdx, planDayDate, weekKey, _progression: progression };
})();
