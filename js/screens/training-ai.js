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
    [/румынск|сгибания ног|мостик|сумо/i, 'Ноги', 'hams', 'comp'],
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
        out.push({ date, dow: (date.getDay() + 6) % 7, planId: p.id, planNum: p.number, wi, di, groups: groups.filter(g => GROUPS.includes(g)), exercises: ex });
      });
    })));
    return out.sort((a, b) => a.date - b.date);
  }

  /* ── Анализ ── */
  function analyze(history) {
    const weeks = [...new Set(history.map(h => weekKey(h.date)))];
    const recent = history.filter(h => Date.now() - h.date < 42 * DAY); /* последние 6 недель */
    const base = recent.length >= MIN_WORKOUTS ? recent : history;
    const baseWeeks = Math.max(1, new Set(base.map(h => weekKey(h.date))).size);
    const freq = Math.max(2, Math.min(5, Math.round(base.length / baseWeeks)));

    const dowCnt = new Array(7).fill(0);
    base.forEach(h => dowCnt[h.dow]++);
    const days = dowCnt.map((c, i) => ({ c, i })).sort((a, b) => b.c - a.c || a.i - b.i).slice(0, freq).map(x => x.i).sort((a, b) => a - b);
    /* если данных по дням мало — равномерно */
    const spread = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4] }[freq];
    const trainDays = dowCnt.filter(Boolean).length >= freq ? days : spread;

    const comboCnt = {};
    base.forEach(h => { if (!h.groups.length) return; const k = h.groups.slice().sort((a, b) => GROUPS.indexOf(a) - GROUPS.indexOf(b)).join('+'); comboCnt[k] = (comboCnt[k] || 0) + 1; });
    const combos = Object.entries(comboCnt).sort((a, b) => b[1] - a[1]).map(([k, c]) => ({ groups: k.split('+'), c }));

    /* по упражнениям */
    const ex = {};
    history.forEach(h => h.exercises.forEach(e => {
      const x = ex[e.name] || (ex[e.name] = { name: e.name, cls: classify(e.name), count: 0, last: null, first: null, best1rm: 0 });
      x.count++;
      const rec = { sets: +e.sets || 0, reps: +e.reps || 0, weight: +e.weight || 0, date: h.date };
      if (!x.first) x.first = rec;
      x.last = rec;
      const rm = rec.weight > 0 && rec.reps > 0 ? rec.weight * (1 + rec.reps / 30) : 0;
      if (rm > x.best1rm) x.best1rm = rm;
    }));

    /* объём: подходы на группу/зону в неделю (по последним 2 неделям) */
    const last2 = history.filter(h => Date.now() - h.date < 14 * DAY);
    const volWeeks = Math.max(1, new Set(last2.map(h => weekKey(h.date))).size);
    const vol = {};
    last2.forEach(h => h.exercises.forEach(e => {
      const c = classify(e.name); if (!c) return;
      const g = vol[c.group] || (vol[c.group] = { sets: 0, regions: {} });
      const s = Math.max(1, +e.sets || 3);
      g.sets += s; g.regions[c.region] = (g.regions[c.region] || 0) + s;
    }));
    Object.values(vol).forEach(g => { g.sets = Math.round(g.sets / volWeeks); Object.keys(g.regions).forEach(r => g.regions[r] = Math.round(g.regions[r] / volWeeks)); });

    return { workouts: history.length, weeks: weeks.length, freq, trainDays, combos, ex, vol, enough: weeks.length >= MIN_WEEKS || history.length >= MIN_WORKOUTS };
  }

  /* ── Сплит на неделю ── */
  function buildSplit(an) {
    const n = an.trainDays.length;
    let split = an.combos.slice(0, n).map(c => c.groups.slice());
    const defaults = DEFAULT_SPLITS[n] || DEFAULT_SPLITS[3];
    for (const d of defaults) { if (split.length >= n) break; if (!split.some(s => s.join() === d.join())) split.push(d.slice()); }
    while (split.length < n) split.push(defaults[split.length % defaults.length].slice());
    /* каждая основная группа должна быть хотя бы раз в неделю */
    ['Грудь', 'Спина', 'Ноги', 'Плечи', 'Руки'].forEach(g => {
      if (split.some(s => s.includes(g))) return;
      const target = split.slice().sort((a, b) => a.length - b.length)[0];
      if (target.length < 3) target.push(g);
    });
    return split;
  }

  /* ── Подбор упражнения в слот: сначала твои любимые, потом база ── */
  function pickExercise(slot, group, an, used) {
    const mine = Object.values(an.ex)
      .filter(x => x.cls && x.cls.group === group && x.cls.region === slot.region && (!slot.kind || x.cls.kind === slot.kind) && !used.has(x.name))
      .sort((a, b) => b.count - a.count);
    if (mine.length) return { name: mine[0].name, isNew: false };
    const fb = slot.fb.find(n => !used.has(n));
    return fb ? { name: fb, isNew: !an.ex[fb] } : null;
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
  function stepFor(name, cls) {
    if (/гантел|молотк/i.test(name)) return 2;
    if (cls && cls.group === 'Ноги' && (cls.kind === 'comp' || cls.region === 'calves')) return 5;
    return 2.5;
  }
  /* Округление под реальные блины: гантели шагом 1 кг, штанга/тренажёры 2,5 кг */
  const round = (w, step) => { const u = step === 2 ? 1 : 2.5; return Math.max(0, Math.round(w / u) * u); };

  function progression(name, an, weeksN, deloadLast) {
    const x = an.ex[name];
    const cls = classify(name);
    const step = stepFor(name, cls);
    const isCore = cls && cls.group === 'Кор';
    const baseSets = cls && cls.kind === 'comp' ? 4 : 3;
    const sets = x && x.last && x.last.sets ? Math.max(3, Math.min(4, x.last.sets)) : baseSets;
    const out = [];
    if (isCore) {
      let r = x && x.last && x.last.reps ? x.last.reps : 12;
      for (let k = 0; k < weeksN; k++) { r = Math.min(25, r + (k === 0 ? 0 : 2)); out.push({ sets: 3, reps: r, weight: x && x.last && x.last.weight ? x.last.weight : 0, up: false }); }
      return { rows: out, step };
    }
    let w = x && x.last && x.last.weight ? x.last.weight : 0;
    let r = x && x.last && x.last.reps ? x.last.reps : 9;
    for (let k = 0; k < weeksN; k++) {
      const deload = deloadLast && k === weeksN - 1;
      if (deload) {
        out.push({ sets: Math.max(2, sets - 1), reps: 10, weight: w ? round(w * 0.85, step) : 0, up: false, deload: true });
        continue;
      }
      let up = false;
      if (r >= 12) { if (w) { w = round(w + step, step); up = true; } r = 8; }
      else r = Math.max(8, r + 1);
      out.push({ sets, reps: r, weight: w, up });
    }
    return { rows: out, step };
  }

  /* ── Генерация ── */
  function generate(plans, plan) {
    const history = collect(plans);
    const an = analyze(history);
    if (!an.enough) return { error: 'data', an };
    const cw = Math.max(0, currentWeekIdx(plan));
    const weeksList = toArr(plan.weeks);
    const fromWeek = Math.min(weeksList.length, cw + 1);
    const weeksN = weeksList.length - fromWeek;
    if (weeksN <= 0) return { error: 'ended', an };
    const deloadLast = weeksN >= 4;
    const split = buildSplit(an);

    /* упражнения на каждую тренировку сплита (одинаковые во все недели — для прогрессии) */
    const sessions = split.map(groups => {
      const used = new Set(); const items = [];
      groups.forEach((g, pos) => slotsFor(g, pos, groups.length).forEach(slot => {
        const pick = pickExercise(slot, g, an, used);
        if (!pick) return;
        used.add(pick.name);
        items.push({ name: pick.name, isNew: pick.isNew, group: g, region: slot.region, why: slot.why || '' });
      }));
      return { groups, items };
    });
    const prog = {};
    sessions.forEach(s => s.items.forEach(it => { if (!prog[it.name]) prog[it.name] = progression(it.name, an, weeksN, deloadLast); }));

    const weeks = [];
    for (let k = 0; k < weeksN; k++) {
      const wi = fromWeek + k;
      const wk = weeksList[wi] || {};
      const days = an.trainDays.map((dow, j) => {
        const s = sessions[j % sessions.length];
        const day = toArr(wk.days)[dow] || {};
        return {
          di: dow, date: day.date || '', dow: day.dow || DOW[dow], groups: s.groups,
          exercises: s.items.map(it => ({ name: it.name, group: it.group, region: it.region, isNew: it.isNew, step: prog[it.name].step, ...prog[it.name].rows[k] })),
          transferred: false,
        };
      });
      weeks.push({ wi, deload: deloadLast && k === weeksN - 1, days });
    }

    /* что учтено — человеческим языком */
    const notes = [];
    notes.push(`${an.freq} ${an.freq === 1 ? 'тренировка' : an.freq < 5 ? 'тренировки' : 'тренировок'} в неделю: ${an.trainDays.map(d => DOW[d]).join(', ')}`);
    notes.push('Связки групп: ' + split.map(s => s.join(' + ')).join(' · '));
    const v = an.vol;
    if (v['Спина'] && !(v['Спина'].regions.thickness > 0)) notes.push('Спина: добавил упражнения на толщину, раньше была только ширина');
    else if (v['Спина'] && !(v['Спина'].regions.width > 0)) notes.push('Спина: добавил вертикальные тяги на ширину');
    else notes.push('Спина: ширина и толщина в каждой тренировке спины');
    if (v['Грудь'] && !(v['Грудь'].regions.upper > 0)) notes.push('Грудь: добавил верх груди и поставил его первым');
    else notes.push('Грудь: верх первым, затем середина и низ');
    if (v['Ноги'] && !(v['Ноги'].regions.hams > 0)) notes.push('Ноги: добавил заднюю поверхность бедра, её не было');
    else notes.push('Ноги: квадрицепс, задняя поверхность и икры');
    if (v['Плечи'] && !(v['Плечи'].regions.rear > 0)) notes.push('Плечи: добавил заднюю дельту, её не было');
    notes.push('Прогрессия 8–12: каждую неделю +1 повтор, на 12 повторах вес вверх и снова с 8');
    if (deloadLast) notes.push(`Неделя ${fromWeek + weeksN}: разгрузка, вес −15%, подходов меньше`);

    return {
      planId: plan.id, planNumber: plan.number, generatedAt: new Date().toISOString(),
      fromWeek, basedOn: { workouts: an.workouts, weeks: an.weeks }, notes, weeks,
    };
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

  function render(content, plan, h) {
    const plans = h.getPlans();
    const history = collect(plans);
    const an = analyze(history);
    let ai = load();
    if (ai && ai.planId !== plan.id) ai = null; /* план для другого 8-недельного блока */

    if (!an.enough) {
      const wPct = Math.min(100, Math.round(an.weeks / MIN_WEEKS * 100));
      const tPct = Math.min(100, Math.round(an.workouts / MIN_WORKOUTS * 100));
      content.innerHTML = `<div class="ai-wrap">
        <div class="ai-hero">
          <div class="ai-hero-ico"><i class="ti ti-sparkles"></i></div>
          <div class="ai-hero-t">AI-тренер пока собирает данные</div>
          <div class="ai-hero-d">Потренируйся 1–2 недели и записывай упражнения с весами. Потом я составлю план до конца плана №${plan.number || ''} с прогрессией нагрузок.</div>
          <div class="ai-prog"><span>Недель с тренировками</span><b>${an.weeks} из ${MIN_WEEKS}</b></div>
          <div class="ai-bar"><span style="width:${wPct}%"></span></div>
          <div class="ai-prog"><span>Записанных тренировок</span><b>${an.workouts} из ${MIN_WORKOUTS}</b></div>
          <div class="ai-bar"><span style="width:${tPct}%"></span></div>
          <div class="ai-hint">Хватит любого из двух условий.</div>
        </div></div>`;
      return;
    }

    const favEx = Object.values(an.ex).sort((a, b) => b.count - a.count).slice(0, 5);
    const statsHtml = `
      <div class="ai-stats">
        <div><b>${an.workouts}</b><span>тренировок</span></div>
        <div><b>${an.freq}×</b><span>в неделю</span></div>
        <div><b>${an.trainDays.map(d => DOW[d]).join(' ')}</b><span>твои дни</span></div>
      </div>
      ${an.combos.length ? `<div class="ai-chips">${an.combos.slice(0, 4).map(c => `<span class="ai-chip">${esc(c.groups.join(' + '))} · ${c.c}</span>`).join('')}</div>` : ''}
      ${favEx.length ? `<div class="ai-fav">${favEx.map(x => {
        const d = x.first && x.last && x.first.weight && x.last.weight ? Math.round((x.last.weight - x.first.weight) * 10) / 10 : 0;
        return `<div class="ai-fav-row"><span>${esc(x.name)}</span><b>${x.last && x.last.weight ? String(x.last.weight).replace('.', ',') + ' кг' : '—'}${d > 0 ? ` <em>+${String(d).replace('.', ',')}</em>` : ''}</b></div>`;
      }).join('')}</div>` : ''}`;

    let body;
    if (!ai) {
      body = `<button class="ai-gen" id="ai-gen"><i class="ti ti-sparkles"></i> Создать план до конца плана №${plan.number || ''}</button>
        <div class="ai-hint" style="text-align:center">Учту твои дни, связки групп, рабочие веса и все зоны мышц</div>`;
    } else {
      const doneDays = ai.weeks.reduce((s, w) => s + w.days.filter(d => d.transferred).length, 0);
      const allDays = ai.weeks.reduce((s, w) => s + w.days.length, 0);
      body = `
        <div class="ai-meta">
          <div>Составлен ${new Date(ai.generatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · по ${ai.basedOn.workouts} тренировкам · перенесено ${doneDays} из ${allDays}</div>
          <button class="ai-regen" id="ai-gen"><i class="ti ti-refresh"></i> Перегенерировать</button>
        </div>
        <details class="ai-notes"><summary><i class="ti ti-bulb"></i> Что учтено</summary><ul>${ai.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul></details>
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
                  <div class="ai-day-groups">${d.groups.map(g => `<span>${esc(g)}</span>`).join('')}</div>
                  ${d.transferred ? '<span class="ai-done"><i class="ti ti-check"></i> в плане</span>'
                    : `<button class="ai-move" data-week="${wk}" data-day="${dk}"><i class="ti ti-arrow-bar-to-right"></i> В план</button>`}
                </div>
                <div class="ai-ex">${d.exercises.map(e => `
                  <div class="ai-ex-row">
                    <div class="ai-ex-name">${esc(e.name)}${e.isNew ? '<span class="ai-new">новое</span>' : ''}<small>${esc(REGION_LABEL[e.region] || '')}</small></div>
                    <div class="ai-ex-load">${fmtW(e)}${e.up ? '<i class="ti ti-trending-up ai-up" title="вес вверх"></i>' : ''}</div>
                  </div>`).join('')}</div>
              </div>`).join('')}
          </div>`).join('')}`;
    }

    content.innerHTML = `<div class="ai-wrap">
      <div class="ai-card">
        <div class="ai-card-h"><div class="ai-hero-ico sm"><i class="ti ti-sparkles"></i></div><div><div class="ai-hero-t">AI-тренер</div><div class="ai-hero-d">План №${plan.number || ''} · сейчас неделя ${Math.min(toArr(plan.weeks).length, currentWeekIdx(plan) + 1)} из ${toArr(plan.weeks).length}</div></div></div>
        ${statsHtml}
      </div>
      ${body}
    </div>`;

    const gen = content.querySelector('#ai-gen');
    if (gen) gen.addEventListener('click', () => {
      if (ai && !confirm('Перегенерировать план с учётом новых данных? Уже перенесённые тренировки в основном плане останутся.')) return;
      const res = generate(h.getPlans(), plan);
      if (res.error === 'ended') { alert('В этом плане не осталось будущих недель. Создай новый план, и я заполню его.'); return; }
      if (res.error) return;
      /* уже перенесённые дни помечаем и в новом плане, чтобы не задублировать */
      if (ai) {
        const done = new Set();
        ai.weeks.forEach(w => w.days.forEach(d => { if (d.transferred) done.add(w.wi + ':' + d.di); }));
        res.weeks.forEach(w => w.days.forEach(d => { if (done.has(w.wi + ':' + d.di)) d.transferred = true; }));
      }
      save(res); render(content, plan, h);
    });
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

  return { render, generate, analyze, collect, classify, _progression: progression };
})();
