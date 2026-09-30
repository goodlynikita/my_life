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
  function collect(plans) {
    const today = new Date(); today.setHours(23, 59, 59, 0);
    const out = [];
    plans.filter(Boolean).forEach(p => toArr(p.weeks).forEach((w, wi) => toArr(w && w.days).forEach((d, di) => {
      if (!d) return;
      if (typeof trMigrateDayToSessions === 'function') trMigrateDayToSessions(d);
      const date = planDayDate(p, d.date);
      if (!date || date > today) return;
      toArr(d.sessions).forEach(s => {
        if (!s) return;
        const ex = toArr(s.exercises).filter(e => e && e.kind === 'strength' && e.name && ((+e.weight || 0) > 0 || (+e.reps || 0) > 0));
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
    const G = GOAL;
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
      if (last.reps >= G.hi && w) { w = upTo(last.weight, step); r = repsAt(w, last.weight, last.reps); first = 'up'; why = `добрал ${last.reps} повт., вес вверх`; }
      else if (last.reps < G.lo && prev && prev.reps < G.lo && w && prev.weight >= w) { w = downTo(w * 0.925, step); r = G.lo; first = 'down'; why = 'два раза недобор, вес −7,5%'; }
      else if (last.reps < G.lo) { r = G.lo; first = 'hold'; why = 'недобор, держим вес'; }
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

  function generate(plans, plan, opts) {
    opts = opts || {};
    const prefs = opts.prefs || prefsGet();
    GOAL = GOALS[prefs.goal] || GOALS.mass;
    const history = collect(plans);
    const an = analyze(history, prefs);
    if (!an.enough && prefs.method === 'history') return { error: 'data', an };
    const weeksList = toArr(plan.weeks);
    const fromWeek = Math.min(weeksList.length, opts.fromWeek != null ? opts.fromWeek : autoFromWeek(plan));
    const weeksN = weeksList.length - fromWeek;
    if (weeksN <= 0) return { error: 'ended', an };
    const deloadLast = weeksN >= 4;
    const smart = prefs.method !== 'history';
    const sm = smart ? smartSessions(an, prefs) : null;
    const split = smart ? sm.sessions.map(x => ({ key: x.key, groups: x.groups, sessions: [] })) : buildSplit(an, prefs);
    const sessions = smart ? sm.sessions : split.map(c => sessionFor(c, an));
    /* замены упражнений при плато (выбраны в «Разборе») */
    const swaps = prefs.swaps || {};
    sessions.forEach(ss => ss.items.forEach(it => {
      const to = swaps[it.key]; if (!to) return;
      const k2 = exKey(to); it.swappedFrom = it.name; it.name = to; it.key = k2; it.isNew = !an.ex[k2]; it.why = 'замена при плато: было «' + it.swappedFrom + '»';
    }));

    /* разнообразие: одно и то же упражнение два раза за неделю меняем на другое твоё
       на ту же зону мышц, если такое есть в истории */
    if (!smart && sessions.length > 1) {
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
    if (smart) dayPlan = an.trainDays.map((_, j) => j % sessions.length);
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
    if (!smart) notes.push('Связки: ' + sessions.map(s => s.groups.join(' + ') + (s.from ? ` (по ${s.from} ${pl(s.from, 'тренировке', 'тренировкам', 'тренировкам')})` : ' (шаблон)')).join(' · ') + (sessions.length > an.trainDays.length ? '. Чередуются по очереди' : ''));
    if (!smart) notes.push('Упражнения и их порядок взяты из твоих тренировок с той же связкой, веса из последнего раза');
    if (!smart) sessions.forEach(s => s.added.forEach(a => notes.push('Добавил, чтобы не отставало: ' + a)));
    an.merges.slice(0, 6).forEach(m => notes.push(`Считаю одним упражнением: «${m[0]}» = «${m[1]}»`));
    notes.push(`Цель: ${GOAL.label.toLowerCase()}. Диапазон ${GOAL.lo}–${GOAL.hi} повторов, отдых ${GOAL.rest}`);
    notes.push(`Прогрессия по факту: добрал ${GOAL.hi} повторов, вес вверх, а повторы по оценке твоего максимума. Два раза подряд меньше ${GOAL.lo}, вес −7,5%. Один раз меньше, держим вес`);
    if (deloadLast) notes.push(`Неделя ${fromWeek + weeksN}: разгрузка, вес −15%, подходов меньше`);

    return {
      planId: plan.id, planNumber: plan.number, generatedAt: new Date().toISOString(),
      fromWeek, goal: prefs.goal || 'mass', method: smart ? 'smart' : 'history', split: smart ? sm.name : '', vol: smart ? sm.vol : null, lastWorkout: history.length ? +history[history.length - 1].date : 0, sig: sigOf(history),
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
  function autoAdjust(plan, h) {
    if (!window.__coachMode && window.FirebaseSync && FirebaseSync.myTrainerCached && FirebaseSync.myTrainerCached()) return null;
    const ai = load();
    if (!ai || ai.planId !== plan.id) return null;
    const plans = chosenPlans(h.getPlans()).on.map(x => x.p);
    const history = collect(plans);
    const sig = sigOf(history);
    if (!ai.sig || sig === ai.sig) { if (!ai.sig) { ai.sig = sig; save(ai); } return null; }
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
    return `<div class="ai-views"><button class="ai-view${v === 'plan' ? ' on' : ''}" data-v="plan"><i class="ti ti-calendar-stats"></i> План</button><button class="ai-view${v === 'insights' ? ' on' : ''}" data-v="insights"><i class="ti ti-chart-dots"></i> Разбор${fresh}</button><button class="ai-view${v === 'chat' ? ' on' : ''}" data-v="chat"><i class="ti ti-message-chatbot"></i> Чат</button></div>`;
  }
  function bindViews(content, plan, h) {
    content.querySelectorAll('.ai-view').forEach(b => b.addEventListener('click', () => { window._aiView = b.dataset.v; render(content, plan, h); }));
  }
  /* ── Анкета: всё, что нужно тренеру, в четыре нажатия ── */
  const GOAL_LBL = (k, fem) => fem && k === 'mass' ? 'Форма' : (GOALS[k] || GOALS.mass).label;
  function anketaHtml(an, prefs) {
    const fem = prefs.sex === 'f', lvl = levelOf(an, prefs), g = GOALS[prefs.goal] || GOALS.mass;
    const row = (icon, t, em, inner) => `<div class="ai-pref"><div class="ai-pref-t"><i class="ti ${icon}"></i> ${t}${em ? ` <em>${em}</em>` : ''}</div>${inner}</div>`;
    const seg = (cls, items, cur) => `<div class="ai-goals ai-seg${items.length === 2 ? ' two' : ''}">${items.map(([k, l, sub]) => `<button class="ai-goal ${cls}${cur === k ? ' on' : ''}" data-v="${k}"><b>${l}</b>${sub ? `<span>${sub}</span>` : ''}</button>`).join('')}</div>`;
    return row('ti-user', 'Для кого', '', seg('ai-sex', [['m', 'Мужчина'], ['f', 'Девушка']], fem ? 'f' : 'm'))
      + row('ti-stairs-up', 'Опыт', prefs.level || !an.workouts ? '' : 'определил по истории', seg('ai-lvl', [['new', 'Новичок', 'до года'], ['exp', 'Опытный', 'больше года']], lvl))
      + row('ti-target', 'Цель', `${g.lo}–${g.hi} повторов · отдых ${g.rest}`, seg('ai-gl', Object.keys(GOALS).map(k => [k, GOAL_LBL(k, fem), GOALS[k].lo + '–' + GOALS[k].hi]), prefs.goal || 'mass'))
      + row('ti-calendar-week', 'Дни тренировок', toArr(prefs.days).length ? 'выбраны тобой' : (an.workouts ? 'по истории' : 'можно поменять'), `<div class="ai-days">${DOW.map((d, i) => `<button class="ai-day-chip${an.trainDays.includes(i) ? ' on' : ''}" data-d="${i}"><b>${d}</b><span>${an.dowCnt[i] || ''}</span></button>`).join('')}</div>`);
  }
  function bindAnketa(content, an, prefs, apply) {
    const set = (k, v) => apply({ ...prefs, [k]: v });
    content.querySelectorAll('.ai-sex').forEach(b => b.onclick = () => set('sex', b.dataset.v));
    content.querySelectorAll('.ai-lvl').forEach(b => b.onclick = () => set('level', b.dataset.v));
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

  function render(content, plan, h) {
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
        <div class="ai-card"><div class="ai-card-h"><div class="ai-hero-ico sm"><i class="ti ti-sparkles"></i></div><div><div class="ai-hero-t">AI-тренер</div><div class="ai-hero-d">Ответь на 4 вопроса, и я составлю план на 8 недель</div></div></div>
          ${anketaHtml(an0, pr0)}</div>
        <button class="ai-gen" id="ai-start"><i class="ti ti-sparkles"></i> Составить план</button></div>`;
      bindViews(content, plan, h);
      bindAnketa(content, an0, pr0, (p2) => { Store.set('training.aiPrefs', p2); render(content, plan, h); });
      content.querySelector('#ai-start').onclick = () => {
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
    let adj = null;
    try { adj = autoAdjust(plan, h); } catch (e) { console.error('autoAdjust', e); }
    let ai = load();
    if (ai && ai.planId !== plan.id) ai = null; /* план для другого 8-недельного блока */

    if (!an.enough && prefs.method === 'history') {
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
      ${anketaHtml(an, prefs)}
      <details class="ai-more"${window._aiMoreOpen ? ' open' : ''}><summary><i class="ti ti-adjustments-horizontal"></i> Тонкие настройки <i class="ti ti-chevron-down"></i></summary>
      <div class="ai-pref">
        <div class="ai-pref-t"><i class="ti ti-weight"></i> Шаг веса <em>какие веса есть в твоём зале</em></div>
        <div class="ai-steps">${Object.entries(EQUIP).map(([k, e]) => `<div class="ai-step"><span>${e.label}</span><div class="ai-stp"><button data-eq="${k}" data-d="-1" aria-label="Меньше">−</button><input data-eq="${k}" type="text" inputmode="decimal" value="${String(+(prefs.steps || {})[k] || e.def).replace('.', ',')}"><em>кг</em><button data-eq="${k}" data-d="1" aria-label="Больше">+</button></div></div>`).join('')}</div>
      </div>
      <div class="ai-pref">
        <div class="ai-pref-t"><i class="ti ti-school"></i> Методика</div>
        <div class="ai-goals ai-meth">${[['smart', 'По науке', 'сплит под дни'], ['history', 'Как у меня', 'мои связки']].map(([k, l, sub]) => `<button class="ai-goal ai-mth${(prefs.method || 'smart') === k ? ' on' : ''}" data-m="${k}"><b>${l}</b><span>${sub}</span></button>`).join('')}</div>
        ${(prefs.method || 'smart') !== 'history' ? (() => { const sm = smartSessions(an, prefs); return `<div class="ai-split-info"><b>${esc(sm.name)}</b><span>${sm.sessions.map(x => esc(x.title)).join(' · ')}</span></div><div class="ai-vol">${Object.entries(sm.vol).map(([g, v]) => `<span>${esc(g)} <b>${v}</b></span>`).join('')}<em>подходов в неделю</em></div>`; })() : ''}
      </div>
      <div class="ai-pref"${(prefs.method || 'smart') !== 'history' ? ' style="display:none"' : ''}>
        <div class="ai-pref-t"><i class="ti ti-arrows-shuffle"></i> Связки мышц <em>${prefSplits.length ? 'выбраны тобой' : 'твои частые'}</em></div>
        <div class="ai-chips">${an.combos.slice(0, 8).map(c => `<button class="ai-chip ai-split${splitNow.includes(c.key) ? ' on' : ''}" data-k="${esc(c.key)}">${esc(c.groups.join(' + '))}<span>${c.c}</span></button>`).join('')}</div>
        ${prefDays.length || prefSplits.length ? '<button class="ai-pref-reset" id="ai-pref-reset"><i class="ti ti-refresh"></i> Вернуть как по истории</button>' : ''}
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
      if (ai) { const res = generate(plans, plan, { fromWeek: ai.fromWeek, prefs: p2 });
        if (!res.error) { const done = new Set(); ai.weeks.forEach(w => w.days.forEach(d => { if (d.transferred) done.add(w.wi + ':' + d.di); })); res.weeks.forEach(w => w.days.forEach(d => { if (done.has(w.wi + ':' + d.di)) d.transferred = true; })); save(res); } }
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
      if (ai) { const res = generate(plans, plan, { fromWeek: ai.fromWeek, prefs: p2 });
        if (!res.error) { const done = new Set(); ai.weeks.forEach(w => w.days.forEach(d => { if (d.transferred) done.add(w.wi + ':' + d.di); })); res.weeks.forEach(w => w.days.forEach(d => { if (done.has(w.wi + ':' + d.di)) d.transferred = true; })); save(res); } }
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
      if (ai) { const res = generate(plans, plan, { fromWeek: ai.fromWeek, prefs: p2 });
        if (!res.error) { const done = new Set(); ai.weeks.forEach(w => w.days.forEach(d => { if (d.transferred) done.add(w.wi + ':' + d.di); })); res.weeks.forEach(w => w.days.forEach(d => { if (done.has(w.wi + ':' + d.di)) d.transferred = true; })); save(res); } }
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
      type: TYPE, groups: d.groups.slice(), ai: true,
      exercises: d.exercises.map(e => ({ kind: 'strength', name: e.name, sets: e.sets, reps: e.reps, weight: e.weight || 0 })),
    });
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
  return { render, generate, analyze, collect, classify, buildContext, autoAdjust, chosenPlans, prefsGet, exKey, sigOf, load, save,
    GOALS, EQUIP, equipOf, stepFor, SLOTS, REGION_LABEL, DOW, toArr, esc, currentWeekIdx, planDayDate, weekKey, _progression: progression };
})();
