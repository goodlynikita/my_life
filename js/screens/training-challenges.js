/* ============================================================
   ЧЕЛЛЕНДЖИ (вкладка в «Тренировках»)
   Данные: training.challenges.{id} = { id, type, title, start, end (YYYY-MM-DD),
     startVal, goal, unit, perDay, ex (упражнение), key (замер), log: { 'YYYY-MM-DD': число }, done, at }
   Типы: weight (вес к дате), pr (рекорд к дате, из тренировок), sum (объём за период),
         daily (каждый день норма), meas (замер к дате, из замеров), nofx (без чего-то, отметка дня)
   ============================================================ */
window.Challenges = (() => {
  const p2 = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  const fromYmd = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = fromYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
  const diffDays = (a, b) => Math.round((fromYmd(b) - fromYmd(a)) / 864e5);
  const toArr = (o) => !o ? [] : Array.isArray(o) ? o.filter(Boolean) : Object.values(o).filter(Boolean);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pl = (n, a, b, c) => { n = Math.abs(n) % 100; const x = n % 10; return n > 10 && n < 20 ? c : x === 1 ? a : x >= 2 && x <= 4 ? b : c; };
  const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const today = () => ymd(new Date());
  const parseNum = (s) => { const t = String(s == null ? '' : s).replace(/\s/g, '').replace(',', '.'); if (t === '') return null; const n = parseFloat(t); return isFinite(n) ? n : null; };
  /* числа по-русски: запятая, без лишних нулей; dp: сколько знаков */
  const fmt = (n, dp) => { if (n == null || !isFinite(n)) return '–'; const d = dp == null ? (Math.abs(n % 1) > 1e-9 ? 2 : 0) : dp; let s = (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d }); return s.replace(/ /g, ' '); };
  const sgn = (n, dp) => n == null ? '–' : (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n), dp);
  const dShort = (s) => { const d = fromYmd(s); return p2(d.getDate()) + '.' + p2(d.getMonth() + 1); };
  const dLong = (s) => { const d = fromYmd(s); return d.getDate() + ' ' + MON[d.getMonth()]; };

  const TYPES = {
    weight: { n: 'Вес к дате', ico: 'ti-scale', c: '#4A7CFF', ex: 'Похудеть к Новому году или набрать массу' },
    pr: { n: 'Рекорд к дате', ico: 'ti-barbell', c: '#8B5CF6', ex: 'Жим 100 кг, подтянуться 15 раз' },
    sum: { n: 'Объём за период', ico: 'ti-stack-2', c: '#F2A93B', ex: '3000 отжиманий за месяц, 100 км бега' },
    daily: { n: 'Каждый день', ico: 'ti-calendar-check', c: '#22C55E', ex: '10 000 шагов, планка каждый день' },
    meas: { n: 'Замеры', ico: 'ti-ruler-measure', c: '#38BDF8', ex: 'Талия −5 см, бицепс +2 см' },
    nofx: { n: 'Без чего-то', ico: 'ti-ban', c: '#F0645A', ex: '30 дней без сахара или алкоголя' },
  };
  const ny = () => { const d = new Date(); return (d.getMonth() === 11 && d.getDate() > 20 ? d.getFullYear() + 1 : d.getFullYear()) + '-12-31'; };
  /* готовые шаблоны: заполняют форму, всё можно поменять */
  const TPL = [
    { type: 'weight', title: 'Худею к Новому году', end: ny, delta: -5 },
    { type: 'weight', title: 'Набор массы', days: 60, delta: 4 },
    { type: 'pr', title: 'Жим лёжа 100 кг', ex: 'Жим лёжа', goal: 100, days: 60 },
    { type: 'sum', title: '3000 отжиманий за месяц', unit: 'раз', goal: 3000, days: 30 },
    { type: 'sum', title: '100 км бега', unit: 'км', goal: 100, days: 30 },
    { type: 'daily', title: '10 000 шагов каждый день', unit: 'шагов', perDay: 10000, days: 30 },
    { type: 'daily', title: 'Планка каждый день', unit: 'сек', perDay: 120, days: 30 },
    { type: 'meas', title: 'Талия −5 см', key: 'Талия', delta: -5, days: 60 },
    { type: 'nofx', title: '30 дней без сахара', days: 30 },
    { type: 'nofx', title: 'Месяц без алкоголя', days: 30 },
  ];
  const MEAS_KEYS = ['Вес', 'Талия', 'Грудь', 'Плечи', 'Бедро', 'Лев рука', 'Прав рука', 'Лев нога', 'Прав нога', '% жира', 'Мышечная масса'];

  /* ── данные ── */
  const all = () => { const m = ((Store.get() || {}).training || {}).challenges; return m && typeof m === 'object' ? Object.values(m).filter(c => c && c.id && TYPES[c.type]) : []; };
  const get = (id) => all().find(c => c.id === id) || null;
  const save = (c) => Store.set('training.challenges.' + c.id, c);
  const setLog = (c, day, v) => { Store.set('training.challenges.' + c.id + '.log.' + day, v == null ? null : v); };

  /* последний вес из замеров: подставляем как старт */
  function measSeries(key) {
    const out = [];
    toArr(((Store.get() || {}).training || {}).measurements).forEach(m => {
      const mm = String(m.date || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/); if (!mm || !m.values) return;
      let y = +mm[3]; if (y < 100) y += 2000; const v = parseNum(m.values[key]); if (v == null) return;
      out.push({ d: y + '-' + p2(+mm[2]) + '-' + p2(+mm[1]), v });
    });
    return out.sort((a, b) => a.d < b.d ? -1 : 1);
  }
  const lastMeas = (key) => { const s = measSeries(key); return s.length ? s[s.length - 1].v : null; };
  /* лучший рабочий подход по упражнению по дням (семейство названий, как в «Весах») */
  function prSeries(exName) {
    const fam = (n) => typeof trFamKey === 'function' ? trFamKey(n) : String(n || '').toLowerCase().trim();
    const k = fam(exName), by = {};
    toArr(((Store.get() || {}).training || {}).plans).forEach(p => toArr(p && p.weeks).forEach(w => toArr(w && w.days).forEach(d => {
      if (!d) return; const dt = typeof trDayDateOf === 'function' ? trDayDateOf(p, d.date) : null; if (!dt) return; const day = ymd(dt);
      toArr(d.sessions).forEach(s => toArr(s && s.exercises).forEach(e => {
        if (!e || e.kind !== 'strength' || fam(e.name) !== k) return;
        const w2 = typeof trTopSet === 'function' ? trTopSet(e).weight : (+e.weight || 0); if (w2 > 0) by[day] = Math.max(by[day] || 0, w2);
      }));
    })));
    return Object.keys(by).sort().map(d => ({ d, v: by[d] }));
  }
  function exNames() {
    const seen = new Set(), out = [];
    toArr(((Store.get() || {}).training || {}).plans).forEach(p => toArr(p && p.weeks).forEach(w => toArr(w && w.days).forEach(d => toArr(d && d.sessions).forEach(s => toArr(s && s.exercises).forEach(e => {
      if (!e || e.kind !== 'strength' || !e.name) return; const k = typeof trFamKey === 'function' ? trFamKey(e.name) : e.name.toLowerCase(); if (seen.has(k)) return; seen.add(k); out.push(e.name);
    })))));
    return out.sort((a, b) => a.localeCompare(b, 'ru'));
  }

  /* ── расчёт: ряд по дням и итоги ── */
  function calc(c) {
    const t = today(), last = c.end < t ? c.end : t, total = Math.max(1, diffDays(c.start, c.end));
    const log = c.log || {};
    const rows = [];
    const dir = c.type === 'weight' || c.type === 'meas' ? (c.goal < c.startVal ? -1 : 1) : 1;
    let auto = {};
    if (c.type === 'pr') prSeries(c.ex).forEach(x => { auto[x.d] = x.v; });
    if (c.type === 'meas') measSeries(c.key).forEach(x => { auto[x.d] = x.v; });
    const n = c.start > t ? -1 : diffDays(c.start, last);
    for (let i = 0; i <= n; i++) {
      const d = addDays(c.start, i);
      let v = log[d] != null ? +log[d] : (auto[d] != null ? auto[d] : null);
      if (i === 0 && v == null && (c.type === 'weight' || c.type === 'meas')) v = c.startVal;
      rows.push({ i, d, v, dow: DOW[fromYmd(d).getDay()] });
    }
    /* у веса, замеров и рекорда есть нулевой день (точка старта), у остальных счёт с первого дня */
    const z = ['weight', 'meas', 'pr'].includes(c.type) ? 0 : 1;
    rows.forEach(r => { r.n = r.i + z; });
    const R = { c, rows, total: total + z, dayNo: Math.max(0, Math.min(total, diffDays(c.start, t))) + z, left: Math.max(0, diffDays(t, c.end)), dir, started: c.start <= t, over: c.end < t, z };
    R.timePct = Math.max(0, Math.min(1, diffDays(c.start, t) / total));
    if (c.type === 'weight' || c.type === 'meas') {
      let prev = null; const vals = rows.filter(r => r.v != null);
      rows.forEach(r => { if (r.v != null) { r.dd = prev == null ? null : r.v - prev; r.all = r.v - c.startVal; prev = r.v; } });
      R.cur = vals.length ? vals[vals.length - 1].v : c.startVal;
      R.change = R.cur - c.startVal; R.need = c.goal - c.startVal;
      R.pct = R.need ? Math.max(0, Math.min(1, R.change / R.need)) : 0;
      R.reached = dir < 0 ? R.cur <= c.goal : R.cur >= c.goal;
      /* прогноз: линия по последним 14 записям */
      const pts = vals.slice(-14).map(r => [diffDays(c.start, r.d), r.v]);
      if (pts.length >= 3) { const L = linreg(pts); if (L) { R.slope = L.b; R.fc = L.a + L.b * total; const k = L.b ? (c.goal - L.a) / L.b : null; R.fcDay = k != null && isFinite(k) && k >= 0 ? addDays(c.start, Math.ceil(k)) : null; } }
    } else if (c.type === 'pr') {
      const before = prSeries(c.ex).filter(x => x.d < c.start);
      const base = c.startVal != null ? c.startVal : (before.length ? Math.max(...before.map(x => x.v)) : null);
      let best = base;
      rows.forEach(r => { if (r.v != null) { r.dd = best == null ? null : r.v - best; best = Math.max(best || 0, r.v); r.all = base == null ? null : r.v - base; r.rec = r.dd != null && r.dd > 0; } });
      R.base = base; R.cur = best; R.change = best != null && base != null ? best - base : 0; R.need = base != null ? c.goal - base : c.goal;
      R.pct = R.need > 0 ? Math.max(0, Math.min(1, R.change / R.need)) : (best >= c.goal ? 1 : 0);
      R.reached = best != null && best >= c.goal;
      const pts = rows.filter(r => r.v != null).map(r => [r.i, r.v]);
      if (pts.length >= 3) { const L = linreg(pts); if (L && L.b > 0) { R.slope = L.b; R.fc = L.a + L.b * total; const k = (c.goal - L.a) / L.b; R.fcDay = k >= 0 ? addDays(c.start, Math.ceil(k)) : null; } }
    } else if (c.type === 'sum') {
      let cum = 0; const perDay = c.goal / (total + 1);
      rows.forEach(r => { cum += r.v || 0; r.cum = cum; r.ok = (r.v || 0) >= perDay * 0.999; r.bad = r.d < t && !(r.v > 0); });
      R.cur = cum; R.pct = Math.max(0, Math.min(1, cum / (c.goal || 1))); R.reached = cum >= c.goal;
      R.perDay = perDay; const daysLeft = Math.max(1, diffDays(t, c.end) + 1);
      R.needDay = Math.max(0, (c.goal - cum) / daysLeft);
      const passed = Math.max(1, rows.length - (log[t] == null ? 1 : 0)); R.avg = cum / passed;
      R.fc = cum + R.avg * Math.max(0, diffDays(t, c.end) + (log[t] == null ? 1 : 0));
    } else if (c.type === 'daily') {
      let ok = 0, streak = 0;
      rows.forEach(r => { r.ok = r.v != null && r.v >= c.perDay; r.bad = (r.v != null && !r.ok) || (r.v == null && r.d < t); if (r.ok) ok++; });
      for (let i = rows.length - 1; i >= 0; i--) { if (rows[i].ok) streak++; else if (rows[i].d === t) continue; else break; }
      R.ok = ok; R.streak = streak; R.cur = ok; R.pct = Math.max(0, Math.min(1, ok / (total + 1))); R.reached = ok >= total + 1;
    } else if (c.type === 'nofx') {
      let ok = 0, streak = 0, best = 0, run = 0;
      rows.forEach(r => { r.ok = r.v === 1 || (r.v == null && r.d < t); r.bad = r.v === 0; if (r.ok) { ok++; run++; best = Math.max(best, run); } else if (r.bad) run = 0; });
      for (let i = rows.length - 1; i >= 0; i--) { if (rows[i].ok) streak++; else if (rows[i].d === t && rows[i].v == null) continue; else break; }
      R.ok = ok; R.streak = streak; R.best = best; R.cur = ok; R.fails = rows.filter(r => r.bad).length;
      R.pct = Math.max(0, Math.min(1, ok / (total + 1))); R.reached = R.over && R.fails === 0;
    }
    /* темп: впереди или позади графика */
    if (R.started && !R.reached && ['weight', 'meas', 'pr', 'sum'].includes(c.type)) {
      const lead = R.pct - R.timePct;
      R.pace = R.timePct < 0.05 ? 'start' : lead > 0.05 ? 'ahead' : lead < -0.08 ? 'behind' : 'ok';
    }
    return R;
  }
  function linreg(pts) {
    const n = pts.length; if (n < 2) return null; let sx = 0, sy = 0, sxx = 0, sxy = 0;
    pts.forEach(([x, y]) => { sx += x; sy += y; sxx += x * x; sxy += x * y; });
    const den = n * sxx - sx * sx; if (!den) return null; const b = (n * sxy - sx * sy) / den; return { a: (sy - b * sx) / n, b };
  }
  const unitOf = (c) => c.type === 'weight' || c.type === 'pr' ? 'кг' : c.type === 'meas' ? (c.key === '% жира' ? '%' : c.key === 'Вес' || c.key === 'Мышечная масса' ? 'кг' : 'см') : (c.unit || '');
  const dpOf = (c) => c.type === 'weight' ? 2 : c.type === 'meas' || c.type === 'pr' ? 1 : null;

  /* главная цифра карточки: что показать крупно */
  function headline(R) {
    const c = R.c, u = unitOf(c), dp = dpOf(c);
    if (c.type === 'weight' || c.type === 'meas') return { big: sgn(R.change, dp) + ' ' + u, sub: 'из ' + sgn(R.need, dp) + ' ' + u + ' · сейчас ' + fmt(R.cur, dp) };
    if (c.type === 'pr') return { big: R.cur != null ? fmt(R.cur, 1) + ' кг' : 'нет записей', sub: 'цель ' + fmt(c.goal, 1) + ' кг' + (R.base != null ? ' · было ' + fmt(R.base, 1) : '') };
    if (c.type === 'sum') return { big: fmt(R.cur) + ' ' + u, sub: 'из ' + fmt(c.goal) + ' ' + u };
    if (c.type === 'daily') return { big: R.ok + ' из ' + R.total, sub: 'дней выполнено · серия ' + R.streak };
    return { big: R.streak + ' ' + pl(R.streak, 'день', 'дня', 'дней'), sub: 'подряд · всего чистых ' + R.ok + (R.fails ? ' · срывов ' + R.fails : '') };
  }
  function paceChip(R) {
    const c = R.c;
    if (R.reached) return '<span class="cl-chip win"><i class="ti ti-trophy"></i>Цель взята</span>';
    if (!R.started) return `<span class="cl-chip"><i class="ti ti-clock"></i>Старт ${dLong(c.start)}</span>`;
    if (R.over) return '<span class="cl-chip"><i class="ti ti-flag"></i>Завершён</span>';
    if (R.pace === 'ahead') return '<span class="cl-chip good"><i class="ti ti-rocket"></i>Опережаешь</span>';
    if (R.pace === 'behind') return '<span class="cl-chip bad"><i class="ti ti-alert-triangle"></i>Отстаёшь</span>';
    if (R.pace === 'ok') return '<span class="cl-chip good"><i class="ti ti-check"></i>По плану</span>';
    if (c.type === 'nofx' || c.type === 'daily') return R.streak ? `<span class="cl-chip good"><i class="ti ti-flame"></i>${R.streak} подряд</span>` : '';
    return '';
  }
  function forecastLine(R) {
    const c = R.c, u = unitOf(c), dp = dpOf(c);
    if (R.reached || R.over || !R.started) return '';
    if ((c.type === 'weight' || c.type === 'meas' || c.type === 'pr') && R.fc != null) {
      /* темп выводит на цель раньше финиша: говорим дату, а не абсурдное число к финишу */
      const early = R.fcDay ? diffDays(R.fcDay, c.end) : null;
      if (R.fcDay && early >= 0 && R.fcDay >= today()) return `В таком темпе цель возьмёшь <b>${dLong(R.fcDay)}</b>${early > 0 ? ', на ' + early + ' ' + pl(early, 'день', 'дня', 'дней') + ' раньше срока' : ', точно в срок'}`;
      const miss = Math.abs(c.goal - R.fc);
      return `В таком темпе к ${dLong(c.end)} будет <b>${fmt(R.fc, dp)} ${u}</b>, до цели не хватит ${fmt(miss, dp)} ${u}`;
    }
    if (c.type === 'sum') return `Чтобы успеть: <b>${fmt(Math.ceil(R.needDay))} ${u}</b> в день. В таком темпе к ${dLong(c.end)} будет ${fmt(Math.round(R.fc))}`;
    return '';
  }

  /* ── экран ── */
  let _mount = null, _open = null, _openWeeks = {};
  /* крупная цифра: число, единица и «из чего» отдельно, чтобы ровно сверстать */
  function hl(R) {
    const c = R.c, u = unitOf(c), dp = dpOf(c);
    if (c.type === 'weight' || c.type === 'meas') return { num: sgn(R.change, dp), unit: u, of: 'из ' + sgn(R.need, dp) + ' ' + u };
    if (c.type === 'pr') return { num: R.cur != null ? fmt(R.cur, 1) : '–', unit: 'кг', of: 'цель ' + fmt(c.goal, 1) + ' кг' };
    if (c.type === 'sum') return { num: fmt(R.cur), unit: u, of: 'из ' + fmt(c.goal) };
    if (c.type === 'daily') return { num: String(R.ok), unit: 'из ' + R.total, of: 'дней в норме' };
    return { num: String(R.streak), unit: pl(R.streak, 'день', 'дня', 'дней'), of: 'подряд без срывов' };
  }
  /* концы полосы: откуда и куда */
  function ends(R) {
    const c = R.c, u = unitOf(c), dp = dpOf(c);
    if (c.type === 'weight' || c.type === 'meas') return [fmt(c.startVal, dp) + ' ' + u, fmt(c.goal, dp) + ' ' + u];
    if (c.type === 'pr') return [R.base != null ? fmt(R.base, 1) + ' кг' : 'старт', fmt(c.goal, 1) + ' кг'];
    if (c.type === 'sum') return ['0', fmt(c.goal) + ' ' + u];
    return [dLong(c.start), dLong(c.end)];
  }
  const barHtml = (R, lg) => `<div class="cl-bar${lg ? ' lg' : ''}"><i style="width:${(R.pct * 100).toFixed(1)}%"></i>${R.started && !R.over && !R.reached ? `<u style="left:${(R.timePct * 100).toFixed(1)}%"></u>` : ''}</div>`;
  /* записано ли сегодня: строка внизу карточки */
  function todayState(R) {
    const c = R.c, t = today(), v = (c.log || {})[t];
    if (!R.started) return `<span class="cl-ts"><i class="ti ti-clock"></i>старт ${dLong(c.start)}</span>`;
    if (R.over || c.done) return `<span class="cl-ts"><i class="ti ti-flag"></i>${R.reached ? 'цель взята' : 'завершён ' + dLong(c.end)}</span>`;
    if (c.type === 'pr') return '<span class="cl-ts"><i class="ti ti-refresh"></i>из тренировок</span>';
    if (c.type === 'meas' && v == null) return `<span class="cl-ts"><i class="ti ti-ruler-measure"></i>из замеров</span>`;
    if (v != null) return `<span class="cl-ts ok"><i class="ti ti-circle-check-filled"></i>сегодня ${c.type === 'nofx' ? (v === 1 ? 'держусь' : 'сорвался') : 'записано'}</span>`;
    return '<span class="cl-ts wait"><i class="ti ti-point-filled"></i>сегодня ещё не отмечено</span>';
  }
  function render(mount) {
    _mount = mount;
    if (_open && get(_open)) return detail(mount, get(_open));
    _open = null;
    const list = all().sort((a, b) => (b.at || 0) - (a.at || 0)), t = today();
    const act = list.filter(c => !c.done && c.end >= t), fin = list.filter(c => c.done || c.end < t);
    const item = (c) => { const R = calc(c), T = TYPES[c.type], h = hl(R);
      return `<button class="cl-item" data-open="${esc(c.id)}" style="--c:${T.c}">
        <span class="cl-it-top"><span class="cl-ico"><i class="ti ${T.ico}"></i></span><span class="cl-it-t"><b>${esc(c.title)}</b><small>${R.started ? (R.over ? dLong(c.start) + ' → ' + dLong(c.end) : 'до ' + dLong(c.end) + ' · осталось ' + R.left + ' ' + pl(R.left, 'день', 'дня', 'дней')) : 'с ' + dLong(c.start) + ' по ' + dLong(c.end)}</small></span><i class="ti ti-chevron-right cl-go"></i></span>
        <span class="cl-it-mid"><span class="cl-num">${esc(h.num)}<small>${esc(h.unit)}</small></span><span class="cl-of">${esc(h.of)}</span>${paceChip(R)}</span>
        ${barHtml(R)}
        <span class="cl-it-bot">${todayState(R)}<span class="cl-pct">${Math.round(R.pct * 100)}%</span></span></button>`; };
    const empty = !act.length;
    mount.innerHTML = `<div class="cl-wrap">
      ${empty ? `<div class="in-card cl-empty"><span class="cl-eico"><i class="ti ti-trophy"></i></span><b>Челленджи</b><span>Вызов себе на срок: похудеть к дате, взять рекорд, сделать 3000 отжиманий</span></div>
        <div class="tr-group-title cl-gt">Готовые</div>${tplGrid()}` : `
        <div class="cl-gh"><div class="tr-group-title cl-gt">Активные <em class="cl-n">${act.length}</em></div><button class="tr-measure-add-inline" id="cl-new"><i class="ti ti-plus"></i> Новый</button></div>
        <div class="cl-list">${act.map(item).join('')}</div>`}
      ${fin.length ? `<details class="cl-fin"${empty ? ' open' : ''}><summary class="tr-group-title cl-gt">Завершённые <em class="cl-n">${fin.length}</em><i class="ti ti-chevron-down cl-chev"></i></summary><div class="cl-list">${fin.map(item).join('')}</div></details>` : ''}
    </div>`;
    mount.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { _open = b.dataset.open; _openWeeks = {}; render(mount); window.scrollTo({ top: 0 }); });
    const nb = mount.querySelector('#cl-new'); if (nb) nb.onclick = () => form({ type: 'weight' });
    mount.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => form(b.dataset.tpl === 'own' ? { type: 'weight', own: true } : Object.assign({}, TPL[+b.dataset.tpl])));
  }
  function tplGrid() {
    return `<div class="cl-tpls">${TPL.map((t, i) => `<button class="cl-tpl" data-tpl="${i}" style="--c:${TYPES[t.type].c}"><span class="cl-ico"><i class="ti ${TYPES[t.type].ico}"></i></span><b>${esc(t.title)}</b><small>${TYPES[t.type].n}</small></button>`).join('')}
      <button class="cl-tpl own" data-tpl="own"><span class="cl-ico"><i class="ti ti-plus"></i></span><b>Свой челлендж</b><small>любой из 6 видов</small></button></div>`;
  }
  function sheet(html, cls) {
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay cl-ov';
    ov.innerHTML = `<div class="tr-modal cl-sheet ${cls || ''}">${html}</div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelectorAll('[data-x]').forEach(b => b.onclick = close);
    return { ov, close };
  }

  /* ── создание и правка: вид сверху, шаблоны чипами, сроки в одно касание, живая проверка цели ── */
  function form(t, edit) {
    const td = today();
    const st = {};
    const fill = (src, isEdit) => {
      const c = isEdit ? src : {};
      st.type = src.type; st.title = c.title || src.title || '';
      st.start = c.start || td;
      st.end = c.end || (typeof src.end === 'function' ? src.end() : addDays(st.start, (src.days || 30) - 1));
      st.sv = c.startVal; st.g = c.goal; st.unit = c.unit || src.unit || (st.type === 'daily' ? 'шагов' : 'раз'); st.perDay = c.perDay || src.perDay || null;
      st.ex = c.ex || src.ex || ''; st.key = c.key || src.key || 'Талия';
      if (!isEdit) {
        if (st.type === 'weight') { st.sv = lastMeas('Вес'); st.g = st.sv != null && src.delta ? Math.round((st.sv + src.delta) * 10) / 10 : null; }
        if (st.type === 'meas') { st.sv = lastMeas(st.key); st.g = st.sv != null && src.delta ? Math.round((st.sv + src.delta) * 10) / 10 : null; }
        if (st.type === 'pr' || st.type === 'sum') st.g = src.goal || null;
      }
    };
    fill(edit || t, !!edit);
    const s = sheet('<div class="cl-form"></div>', 'cl-formsh');
    const box = s.ov.querySelector('.cl-form');
    const numV = (v) => v != null ? String(v).replace('.', ',') : '';
    const PRE = [['2 недели', 14], ['30 дней', 30], ['60 дней', 60], ['90 дней', 90], ['До НГ', 'ny']];
    const draw = () => {
      const T = TYPES[st.type], tpls = TPL.map((x, i) => [x, i]).filter(([x]) => x.type === st.type);
      const lab = (l, inner, cls) => `<label class="cl-f${cls ? ' ' + cls : ''}"><span>${l}</span>${inner}</label>`;
      const num = (k, ph) => `<input data-k="${k}" type="text" inputmode="decimal" value="${esc(numV(st[k]))}" placeholder="${ph || ''}">`;
      let spec = '';
      if (st.type === 'weight') spec = `<div class="cl-f2">${lab('Сейчас, кг', num('sv', '90,5'))}${lab('Цель, кг', num('g', '80'))}</div>`;
      if (st.type === 'meas') spec = `${lab('Что меряем', `<div class="cl-sel"><select data-k="key">${MEAS_KEYS.map(k => `<option${st.key === k ? ' selected' : ''}>${k}</option>`).join('')}</select><i class="ti ti-chevron-down"></i></div>`)}<div class="cl-f2">${lab('Сейчас', num('sv'))}${lab('Цель', num('g'))}</div>`;
      if (st.type === 'pr') spec = `${lab('Упражнение', `<input data-k="ex" type="text" list="cf-exl" value="${esc(st.ex)}" placeholder="Жим лёжа"><datalist id="cf-exl">${exNames().map(n => `<option value="${esc(n)}">`).join('')}</datalist>`)}${lab('Цель, кг', num('g', '100'))}`;
      if (st.type === 'sum') spec = `<div class="cl-f2">${lab('Всего за срок', num('g', '3000'))}${lab('Единица', `<input data-k="unit" type="text" value="${esc(st.unit)}">`)}</div>`;
      if (st.type === 'daily') spec = `<div class="cl-f2">${lab('Норма в день', num('perDay', '10000'))}${lab('Единица', `<input data-k="unit" type="text" value="${esc(st.unit)}">`)}</div>`;
      box.innerHTML = `<div class="cl-sh-h"><p class="tr-modal-title">${edit ? 'Изменить челлендж' : 'Новый челлендж'}</p><button class="cl-x" data-x aria-label="Закрыть"><i class="ti ti-x"></i></button></div>
        ${edit ? '' : `<div class="cl-tyrow">${Object.entries(TYPES).map(([k, x]) => `<button class="cl-ty${k === st.type ? ' on' : ''}" data-ty="${k}" style="--c:${x.c}"><i class="ti ${x.ico}"></i><span>${x.n}</span></button>`).join('')}</div>
        ${tpls.length ? `<div class="cl-chips">${tpls.map(([x, i]) => `<button class="cl-chipb" data-tp="${i}">${esc(x.title)}</button>`).join('')}</div>` : ''}`}
        ${lab('Название', `<input data-k="title" type="text" maxlength="60" value="${esc(st.title)}" placeholder="${esc((tpls[0] || [{}])[0].title || T.n)}">`)}
        ${spec}
        <div class="cl-f"><span>Срок</span><div class="cl-chips pre">${PRE.map(([l, d]) => `<button class="cl-chipb" data-pre="${d}">${l}</button>`).join('')}</div>
          <div class="cl-f2 dates"><input data-k="start" type="date" value="${st.start}"><i class="ti ti-arrow-right"></i><input data-k="end" type="date" value="${st.end}"></div></div>
        <div class="cl-prev" id="cf-prev"></div>
        <div class="cl-err" id="cf-err"></div>
        <div class="tr-modal-actions">${edit ? '<button class="tr-modal-btn-secondary" id="cf-del">Удалить</button>' : ''}<button class="tr-modal-btn-primary" id="cf-ok">${edit ? 'Сохранить' : 'Начать челлендж'}</button></div>`;
      box.querySelectorAll('[data-x]').forEach(b => b.onclick = s.close);
      box.querySelectorAll('[data-ty]').forEach(b => b.onclick = () => { const tp = TPL.find(x => x.type === b.dataset.ty) || { type: b.dataset.ty }; fill(Object.assign({}, tp, { title: '' }), false); draw(); });
      box.querySelectorAll('[data-tp]').forEach(b => b.onclick = () => { fill(Object.assign({}, TPL[+b.dataset.tp]), false); draw(); });
      box.querySelectorAll('[data-pre]').forEach(b => b.onclick = () => { const d = b.dataset.pre; st.end = d === 'ny' ? ny() : addDays(st.start, +d - 1); box.querySelector('[data-k="end"]').value = st.end; prev(); });
      box.querySelectorAll('[data-k]').forEach(el => { const ev = el.tagName === 'SELECT' ? 'change' : 'input'; el.addEventListener(ev, () => {
        const k = el.dataset.k; st[k] = ['sv', 'g', 'perDay'].includes(k) ? parseNum(el.value) : el.value;
        if (k === 'key') { const v = lastMeas(st.key); if (v != null) { st.sv = v; box.querySelector('[data-k="sv"]').value = numV(v); } }
        prev(); }); });
      const del = box.querySelector('#cf-del');
      if (del) { let sure = false; del.onclick = () => { if (!sure) { sure = true; del.textContent = 'Точно удалить?'; return; } Store.set('training.challenges.' + edit.id, null); _open = null; s.close(); if (_mount) render(_mount); }; }
      box.querySelector('#cf-ok').onclick = submit;
      prev();
    };
    /* живая подсказка: реальна ли цель */
    const prev = () => {
      const el = box.querySelector('#cf-prev'); if (!el) return;
      const days = st.start && st.end && st.end > st.start ? diffDays(st.start, st.end) + 1 : null;
      let h = '', warn = '';
      if (!days) h = 'Выбери срок';
      else if ((st.type === 'weight' || st.type === 'meas') && st.sv != null && st.g != null && st.sv !== st.g) {
        const d = st.g - st.sv, wk = d / days * 7, u = st.type === 'weight' ? 'кг' : unitOf({ type: 'meas', key: st.key });
        h = `<b>${sgn(d, 1)} ${u}</b> за ${days} ${pl(days, 'день', 'дня', 'дней')}, это <b>${sgn(wk, 2)} ${u}</b> в неделю`;
        if (st.type === 'weight' && wk < -1) warn = 'Быстро. Безопасно худеть на 0,5–1 кг в неделю';
        if (st.type === 'weight' && wk > 0.5) warn = 'Быстро. Чистая масса растёт на 0,25–0,5 кг в неделю';
      } else if (st.type === 'pr' && st.g) {
        const ps = st.ex ? prSeries(st.ex) : [], best = ps.length ? Math.max(...ps.map(x => x.v)) : null;
        h = best != null ? `Сейчас лучший подход <b>${fmt(best, 1)} кг</b>, нужно <b>${sgn(st.g - best, 1)} кг</b> за ${days} ${pl(days, 'день', 'дня', 'дней')}` : 'Этого упражнения пока нет в тренировках. Первый подход станет стартом';
      } else if (st.type === 'sum' && st.g) h = `Это <b>${fmt(Math.ceil(st.g / days))} ${esc(st.unit)}</b> в день, ${days} ${pl(days, 'день', 'дня', 'дней')}`;
      else if (st.type === 'daily' && st.perDay) h = `<b>${days} ${pl(days, 'день', 'дня', 'дней')}</b> по ${fmt(st.perDay)} ${esc(st.unit)}`;
      else if (st.type === 'nofx') h = `<b>${days} ${pl(days, 'день', 'дня', 'дней')}</b>. Отмечай только срывы, остальные дни считаются чистыми`;
      else h = 'Заполни цель';
      el.innerHTML = `<i class="ti ti-${warn ? 'alert-triangle' : 'target-arrow'}"></i><span>${h}${warn ? `<em>${warn}</em>` : ''}</span>`;
      el.classList.toggle('warn', !!warn);
    };
    const submit = () => {
      const err = (m) => { box.querySelector('#cf-err').textContent = m; };
      const T = TYPES[st.type], c = edit || {};
      const title = (st.title || '').trim() || (TPL.find(x => x.type === st.type) || {}).title || T.n;
      if (!st.start || !st.end || st.end <= st.start) return err('Финиш должен быть позже старта');
      const o = Object.assign({}, c, { id: c.id || ('c' + Date.now().toString(36)), type: st.type, title, start: st.start, end: st.end, at: c.at || Date.now(), log: c.log || {} });
      if (st.type === 'weight' || st.type === 'meas') {
        if (st.sv == null || st.g == null) return err('Впиши, сколько сейчас и какая цель');
        if (st.sv === st.g) return err('Цель должна отличаться от старта');
        o.startVal = st.sv; o.goal = st.g; if (st.type === 'meas') o.key = st.key;
      }
      if (st.type === 'pr') { o.ex = (st.ex || '').trim(); o.goal = st.g; if (!o.ex || !o.goal) return err('Впиши упражнение и цель'); }
      if (st.type === 'sum') { o.goal = st.g; o.unit = (st.unit || '').trim() || 'раз'; if (!o.goal) return err('Впиши цель'); }
      if (st.type === 'daily') { o.perDay = st.perDay; o.unit = (st.unit || '').trim() || 'раз'; if (!o.perDay) return err('Впиши норму в день'); }
      save(o); s.close(); _open = o.id; _openWeeks = {}; if (_mount) render(_mount); window.scrollTo({ top: 0 });
    };
    draw();
    setTimeout(() => { const f = box.querySelector('input[data-k="sv"], input[data-k="g"], input[data-k="ex"], input[data-k="perDay"]'); if (f && !f.value) f.focus(); }, 120);
  }

  /* цифры под шапкой: самое полезное для каждого вида */
  function kpis(R) {
    const c = R.c, u = unitOf(c), dp = dpOf(c), t = today();
    const k = (v, l, cls) => `<div><b class="${cls || ''}">${v}</b><span>${l}</span></div>`;
    const tone = (x, dir) => x == null || !x ? '' : x * dir > 0 ? 'up' : 'down';
    if (c.type === 'weight' || c.type === 'meas') {
      const vals = R.rows.filter(r => r.v != null), wkAgo = addDays(t, -7);
      const base = vals.filter(r => r.d <= wkAgo).pop() || vals[0];
      const wk = base && vals.length ? R.cur - base.v : null;
      const needWk = R.left > 0 && !R.reached ? (c.goal - R.cur) / R.left * 7 : null;
      return k(fmt(R.cur, dp), 'сейчас, ' + u) + k(wk != null ? sgn(wk, dp) : '–', 'за 7 дней', tone(wk, R.dir)) + k(needWk != null ? sgn(needWk, dp) : '–', 'нужно в неделю');
    }
    if (c.type === 'pr') return k(R.cur != null ? fmt(R.cur, 1) : '–', 'лучший, кг') + k(R.change ? sgn(R.change, 1) : '0', 'прирост, кг', tone(R.change, 1)) + k(String(R.rows.filter(r => r.v != null).length), 'тренировок');
    if (c.type === 'sum') return k(fmt(Math.round(R.avg || 0)), 'в среднем за день') + k(R.reached ? '0' : fmt(Math.ceil(R.needDay)), 'нужно в день') + k(Math.round(R.pct * 100) + '%', 'от цели');
    const passed = R.rows.filter(r => r.d < t || (c.log || {})[r.d] != null).length || 1;
    let best = 0, run = 0; R.rows.forEach(r => { if (r.ok) { run++; best = Math.max(best, run); } else if (r.bad) run = 0; });
    if (c.type === 'daily') return k(String(R.streak), 'подряд') + k(String(best), 'лучшая серия') + k(Math.round(R.ok / passed * 100) + '%', 'дней в норме');
    return k(String(R.streak), 'подряд') + k(String(R.best || best), 'лучшая серия') + k(String(R.fails), 'срывов', R.fails ? 'down' : '');
  }

  /* график: факт, линия «как надо», прогноз, цель */
  function chart(R, cw) {
    const c = R.c; if (!['weight', 'meas', 'pr', 'sum'].includes(c.type) || !R.started) return '';
    /* ширина в реальных пикселях карточки: на компьютере график шире, а подписи остаются мелкими */
    const W = Math.max(280, Math.min(900, Math.round(cw || 320))), H = W > 500 ? 200 : 150, L = 8, Rr = 8, T = 16, B = 22, total = Math.max(1, diffDays(c.start, c.end));
    const pts = c.type === 'sum' ? R.rows.filter(r => r.v != null || r.d < today()).map(r => [r.i, r.cum]) : R.rows.filter(r => r.v != null).map(r => [r.i, r.v]);
    const s0 = c.type === 'sum' ? 0 : c.type === 'pr' ? (R.base != null ? R.base : (pts[0] ? pts[0][1] : c.goal)) : c.startVal;
    if (c.type !== 'sum' && pts.length < 1) return '';
    let fc = null;
    if (c.type === 'sum' && R.avg > 0 && !R.reached) fc = [total, R.fc];
    else if (R.slope != null && pts.length && !R.reached) { const last = pts[pts.length - 1], endX = R.fcDay ? Math.min(total, diffDays(c.start, R.fcDay)) : total; fc = [endX, last[1] + R.slope * (endX - last[0])]; }
    const ys = pts.map(p => p[1]).concat([s0, c.goal]).concat(fc ? [fc[1]] : []);
    let y0 = Math.min(...ys), y1 = Math.max(...ys); const pad = (y1 - y0) * 0.12 || 1; y0 -= pad; y1 += pad;
    const X = (x) => L + (W - L - Rr) * x / total, Y = (y) => T + (H - T - B) * (1 - (y - y0) / (y1 - y0));
    const path = pts.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' ');
    const last = pts[pts.length - 1];
    const area = pts.length > 1 ? `${path} L${X(last[0]).toFixed(1)} ${H - B} L${X(pts[0][0]).toFixed(1)} ${H - B} Z` : '';
    const tx = X(Math.min(total, diffDays(c.start, today())));
    const id = 'clg' + c.id;
    return `<div class="in-card cl-chart"><div class="in-h"><div><b>Динамика</b><span>${c.type === 'sum' ? 'накоплено' : 'по дням'} и линия «как надо»</span></div></div>
      <svg viewBox="0 0 ${W} ${H}" class="cl-svg" role="img" aria-label="График челленджа">
        <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A7CFF" stop-opacity=".35"/><stop offset="1" stop-color="#4A7CFF" stop-opacity="0"/></linearGradient></defs>
        <line x1="${L}" x2="${W - Rr}" y1="${Y(c.goal).toFixed(1)}" y2="${Y(c.goal).toFixed(1)}" class="cl-gl"/>
        <text x="${W - Rr}" y="${(Y(c.goal) - 5).toFixed(1)}" text-anchor="end" class="cl-glt">цель ${fmt(c.goal, dpOf(c))}</text>
        <line x1="${X(0).toFixed(1)}" y1="${Y(s0).toFixed(1)}" x2="${X(total).toFixed(1)}" y2="${Y(c.goal).toFixed(1)}" class="cl-ideal"/>
        <line x1="${tx.toFixed(1)}" x2="${tx.toFixed(1)}" y1="${T}" y2="${H - B}" class="cl-now"/>
        ${area ? `<path d="${area}" fill="url(#${id})"/>` : ''}
        ${pts.length > 1 ? `<path d="${path}" class="cl-line"/>` : ''}
        ${fc && last ? `<line x1="${X(last[0]).toFixed(1)}" y1="${Y(last[1]).toFixed(1)}" x2="${X(fc[0]).toFixed(1)}" y2="${Y(fc[1]).toFixed(1)}" class="cl-fcl"/>` : ''}
        ${pts.length <= 40 ? pts.map(p => `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="2.2" class="cl-dot"/>`).join('') : ''}
        ${last ? `<circle cx="${X(last[0]).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="4.5" class="cl-last"/>` : ''}
        <text x="${L}" y="${H - 6}" class="cl-ax">${dLong(c.start)}</text><text x="${W - Rr}" y="${H - 6}" text-anchor="end" class="cl-ax">${dLong(c.end)}</text>
      </svg>
      ${forecastLine(R) ? `<div class="cl-fc"><i class="ti ti-chart-line"></i><span>${forecastLine(R)}</span></div>` : ''}</div>`;
  }

  /* ввод за сегодня: под каждый вид свой, чтобы в одно-два касания */
  function todayCard(R) {
    const c = R.c, t = today(), v = (c.log || {})[t], u = unitOf(c), dp = dpOf(c);
    if (!R.started || R.over || c.done) return '';
    const head = `<div class="cl-th"><b>Сегодня</b><span>${dLong(t)}, ${DOW[new Date().getDay()]}</span>${v != null ? '<em><i class="ti ti-circle-check-filled"></i>записано</em>' : ''}</div>`;
    if (c.type === 'nofx') return `<div class="in-card cl-today">${head}<div class="cl-yn"><button class="cl-yes${v === 1 ? ' on' : ''}" data-mark="1"><i class="ti ti-check"></i>Держусь</button><button class="cl-no${v === 0 ? ' on' : ''}" data-mark="0"><i class="ti ti-x"></i>Сорвался</button></div></div>`;
    if (c.type === 'pr') return `<div class="in-card cl-today">${head}<div class="cl-auto"><i class="ti ti-refresh"></i><span>Лучший рабочий подход берётся из тренировок по упражнению «${esc(c.ex)}»</span><button class="cl-mini" data-day="${t}">Вручную</button></div></div>`;
    const step = c.type === 'weight' ? 0.1 : c.type === 'meas' ? 0.5 : null;
    const pre = v != null ? v : (c.type === 'weight' || c.type === 'meas') ? R.cur : null;
    let extra = '';
    if (c.type === 'sum') { const pd = c.goal / (R.total || 1), q = u === 'км' ? [1, 3, 5, 10] : pd >= 200 ? [50, 100, 200, 500] : pd >= 40 ? [10, 25, 50, 100] : pd >= 10 ? [5, 10, 20, 50] : [1, 2, 5, 10];
      extra = `<div class="cl-quick">${q.map(n => `<button data-add="${n}">+${fmt(n)}</button>`).join('')}</div>`; }
    if (c.type === 'daily') extra = `<div class="cl-quick"><button data-set="${c.perDay}"><i class="ti ti-check"></i>Норма ${fmt(c.perDay)}</button></div>`;
    return `<div class="in-card cl-today">${head}
      <div class="cl-step">${step ? `<button data-st="-1" aria-label="Меньше"><i class="ti ti-minus"></i></button>` : ''}<input id="cl-v" type="text" inputmode="decimal" value="${pre != null ? esc(fmt(pre, step ? dp : null)) : ''}" placeholder="0"><span>${esc(u)}</span>${step ? `<button data-st="1" aria-label="Больше"><i class="ti ti-plus"></i></button>` : ''}</div>
      ${extra}<button class="tr-modal-btn-primary cl-save" id="cl-save">${v != null ? 'Обновить' : 'Записать'}</button></div>`;
  }

  function detail(mount, c) {
    const R = calc(c), T = TYPES[c.type], h = hl(R), t = today(), e = ends(R);
    const showEnds = ['weight', 'meas', 'pr', 'sum'].includes(c.type);
    mount.innerHTML = `<div class="cl-wrap cl-det" style="--c:${T.c}">
      <div class="cl-top"><button class="cl-btn-i" id="cl-back" aria-label="Назад"><i class="ti ti-arrow-left"></i></button><span class="cl-tt">${T.n}</span>
        <button class="cl-btn-i" id="cl-share" aria-label="Поделиться"><i class="ti ti-share-3"></i></button><button class="cl-btn-i" id="cl-edit" aria-label="Изменить"><i class="ti ti-pencil"></i></button></div>
      <div class="in-card cl-hero">
        <div class="cl-hh"><span class="cl-ico lg"><i class="ti ${T.ico}"></i></span><div><h2>${esc(c.title)}</h2><span>${dLong(c.start)} → ${dLong(c.end)} · ${R.started ? (R.over ? 'завершён' : 'день ' + R.dayNo + ' из ' + R.total) : 'старт через ' + diffDays(t, c.start) + ' ' + pl(diffDays(t, c.start), 'день', 'дня', 'дней')}</span></div></div>
        <div class="cl-hnum"><b>${esc(h.num)}</b><span>${esc(h.unit)}</span><em>${esc(h.of)}</em></div>
        ${barHtml(R, true)}
        <div class="cl-ends">${showEnds ? `<span>${esc(e[0])}</span>` : `<span>${Math.round(R.pct * 100)}%</span>`}${paceChip(R) || (R.started && !R.over ? `<span class="cl-left">осталось ${R.left} ${pl(R.left, 'день', 'дня', 'дней')}</span>` : '')}${showEnds ? `<span>${esc(e[1])}</span>` : `<span>${R.started && !R.over ? 'ещё ' + R.left + ' ' + pl(R.left, 'день', 'дня', 'дней') : ''}</span>`}</div>
        <div class="in-kpis cl-kpis">${kpis(R)}</div>
      </div>
      ${todayCard(R)}
      ${chart(R, (mount.clientWidth || 360) - 64)}
      <div class="cl-gh"><div class="tr-group-title cl-gt">Дневник</div><button class="tr-measure-add-inline" id="cl-share2"><i class="ti ti-share-3"></i> В сторис</button></div>
      ${tableHtml(R)}
    </div>`;
    const $ = (s) => mount.querySelector(s);
    $('#cl-back').onclick = () => { _open = null; render(mount); };
    $('#cl-edit').onclick = () => form({ type: c.type }, c);
    $('#cl-share').onclick = $('#cl-share2').onclick = () => share(c);
    const vi = $('#cl-v'), sv = $('#cl-save');
    const dp = dpOf(c), stepV = c.type === 'weight' ? 0.1 : 0.5;
    mount.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { const cur = parseNum(vi.value) || 0; vi.value = fmt(Math.round((cur + +b.dataset.st * stepV) * 100) / 100, dp); });
    mount.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { vi.value = fmt((parseNum(vi.value) || 0) + +b.dataset.add); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); });
    mount.querySelectorAll('[data-set]').forEach(b => b.onclick = () => { vi.value = fmt(+b.dataset.set); });
    if (sv) { const go = () => { setLog(c, t, parseNum(vi.value)); after(c); }; sv.onclick = go; vi.addEventListener('keydown', e2 => { if (e2.key === 'Enter') go(); }); vi.addEventListener('focus', () => vi.select()); }
    mount.querySelectorAll('[data-mark]').forEach(b => b.onclick = () => { const v = +b.dataset.mark; setLog(c, t, (c.log || {})[t] === v ? null : v); after(c); });
    mount.querySelectorAll('[data-wk]').forEach(b => b.onclick = () => { const k = b.dataset.wk; _openWeeks[k] = !_openWeeks[k]; detail(mount, get(c.id)); });
    mount.querySelectorAll('[data-day]').forEach(r => r.onclick = () => editDay(get(c.id), r.dataset.day));
  }
  /* после записи: перерисовать и отпраздновать, если цель взята впервые */
  function after(c) {
    const fresh = get(c.id), R = calc(fresh);
    if (R.reached && !fresh.done) { Store.set('training.challenges.' + c.id + '.done', today()); win(fresh); }
    if (_mount) detail(_mount, get(c.id));
  }
  function win(c) {
    const s = sheet(`<div class="cl-win"><div class="cl-win-i"><i class="ti ti-trophy"></i></div><b>Цель взята!</b><span>${esc(c.title)}</span>
      <div class="tr-modal-actions"><button class="tr-modal-btn-secondary" data-x>Закрыть</button><button class="tr-modal-btn-primary" id="cw-sh"><i class="ti ti-share-3"></i> Поделиться</button></div></div>`, 'cl-winsh');
    s.ov.querySelector('#cw-sh').onclick = () => { s.close(); share(get(c.id)); };
  }
  function editDay(c, day) {
    if (!c) return;
    const cur = (c.log || {})[day];
    if (c.type === 'nofx') {
      const s = sheet(`<div class="cl-sh-h"><p class="tr-modal-title">${dLong(day)}</p><button class="cl-x" data-x aria-label="Закрыть"><i class="ti ti-x"></i></button></div>
        <div class="cl-in nofx bare"><button class="cl-yes${cur === 1 || cur == null ? ' on' : ''}" data-m="1"><i class="ti ti-check"></i>Держался</button><button class="cl-no${cur === 0 ? ' on' : ''}" data-m="0"><i class="ti ti-x"></i>Сорвался</button></div>`);
      s.ov.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { setLog(c, day, +b.dataset.m === 1 ? 1 : 0); s.close(); after(c); });
      return;
    }
    const u = unitOf(c);
    const s = sheet(`<div class="cl-sh-h"><p class="tr-modal-title">${dLong(day)}, ${DOW[fromYmd(day).getDay()]}</p><button class="cl-x" data-x aria-label="Закрыть"><i class="ti ti-x"></i></button></div>
      <div class="tr-modal-row"><label>${c.type === 'pr' ? 'Лучший подход, кг (поверх данных тренировки)' : 'Значение, ' + esc(u)}<input id="ed-v" type="text" inputmode="decimal" value="${cur != null ? esc(String(cur).replace('.', ',')) : ''}"></label></div>
      <div class="tr-modal-actions">${cur != null ? '<button class="tr-modal-btn-secondary" id="ed-clr">Очистить</button>' : ''}<button class="tr-modal-btn-primary" id="ed-ok">Сохранить</button></div>`);
    const go = () => { setLog(c, day, parseNum(s.ov.querySelector('#ed-v').value)); s.close(); after(c); };
    s.ov.querySelector('#ed-ok').onclick = go;
    s.ov.querySelector('#ed-v').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    const cl = s.ov.querySelector('#ed-clr'); if (cl) cl.onclick = () => { setLog(c, day, null); s.close(); after(c); };
    setTimeout(() => s.ov.querySelector('#ed-v').focus(), 80);
  }

  /* таблица: строки по дням, итоги каждой недели; прошлые недели свёрнуты */
  function tableHtml(R) {
    const c = R.c, u = unitOf(c), dp = dpOf(c), t = today();
    if (!R.rows.length) return '';
    const cols = {
      weight: ['День', 'Дата', 'Вес', 'За день', 'Всего'], meas: ['День', 'Дата', c.key, 'Изм.', 'Всего'], pr: ['День', 'Дата', 'Подход', 'К лучшему', 'Всего'],
      sum: ['День', 'Дата', 'Сделано', 'Всего', 'Цели'], daily: ['День', 'Дата', esc(u), 'Норма', ''], nofx: ['День', 'Дата', 'Итог', '', ''],
    }[c.type];
    const cls = (x, good) => x == null ? '' : x === 0 ? ' z' : (x * good > 0 ? ' g' : ' b');
    const good = R.dir;
    const rowHtml = (r) => {
      const today0 = r.d === t ? ' now' : '';
      const dd = `<td class="cl-dd">${r.n}</td><td class="cl-dt">${dShort(r.d)} <small>${r.dow}</small></td>`;
      if (c.type === 'weight' || c.type === 'meas') return `<tr data-day="${r.d}" class="${today0}">${dd}<td class="cl-v${r.d === t && r.v != null ? ' hl' : ''}">${r.v != null ? fmt(r.v, dp) : '<em>–</em>'}</td><td class="cl-c${cls(r.dd, good)}">${r.dd != null ? sgn(r.dd, dp) : (r.i === 0 ? '~' : '')}</td><td class="cl-t">${r.all != null && r.i ? sgn(r.all, dp) : (r.i === 0 ? '~' : '')}</td></tr>`;
      if (c.type === 'pr') return r.v == null ? '' : `<tr data-day="${r.d}" class="${today0}">${dd}<td class="cl-v${r.rec ? ' hl' : ''}">${fmt(r.v, 1)}</td><td class="cl-c${r.dd == null ? '' : r.dd > 0 ? ' g' : r.dd === 0 ? ' z' : ' b'}">${r.dd != null ? sgn(r.dd, 1) : '~'}</td><td class="cl-t">${r.all != null ? sgn(r.all, 1) : '~'}</td></tr>`;
      if (c.type === 'sum') return `<tr data-day="${r.d}" class="${today0}">${dd}<td class="cl-v${r.ok ? ' g' : r.bad ? ' b' : ''}">${r.v != null ? fmt(r.v) : '<em>–</em>'}</td><td class="cl-t">${fmt(r.cum)}</td><td class="cl-t">${Math.min(100, Math.round(r.cum / c.goal * 100))}%</td></tr>`;
      if (c.type === 'daily') return `<tr data-day="${r.d}" class="${today0}">${dd}<td class="cl-v${r.ok ? ' g' : r.bad ? ' b' : ''}">${r.v != null ? fmt(r.v) : '<em>–</em>'}</td><td class="cl-c${r.ok ? ' g' : r.bad ? ' b' : ''}">${r.ok ? '<i class="ti ti-check"></i>' : r.bad ? '<i class="ti ti-x"></i>' : ''}</td><td></td></tr>`;
      return `<tr data-day="${r.d}" class="${today0}">${dd}<td class="cl-v wide${r.bad ? ' b' : r.v === 1 || r.ok ? ' g' : ''}" colspan="3">${r.bad ? '<i class="ti ti-x"></i> сорвался' : r.v === 1 || r.ok ? '<i class="ti ti-check"></i> держался' : '<em>отметь сегодня</em>'}</td></tr>`;
    };
    /* недели: дни 1–7, 8–14 …; нулевой день идёт в первую */
    const weeks = []; R.rows.forEach(r => { const w = R.z ? Math.floor(r.i / 7) : (r.i === 0 ? 0 : Math.floor((r.i - 1) / 7)); (weeks[w] = weeks[w] || []).push(r); });
    const lastW = weeks.length - 1;
    let prevEnd = c.type === 'pr' ? R.base : c.startVal;
    const body = weeks.map((wr, w) => {
      const open = w === lastW || _openWeeks[w];
      let sum = '';
      if (c.type === 'weight' || c.type === 'meas' || c.type === 'pr') {
        const vs = wr.filter(r => r.v != null); const endV = c.type === 'pr' ? (vs.length ? Math.max(...vs.map(r => r.v)) : null) : (vs.length ? vs[vs.length - 1].v : null);
        const only0 = wr.every(r => r.i === 0);
        const wd = !only0 && endV != null && prevEnd != null ? endV - prevEnd : null, tot = only0 ? null : endV != null && (c.type === 'pr' ? R.base : c.startVal) != null ? endV - (c.type === 'pr' ? R.base : c.startVal) : null;
        sum = `<td class="cl-v hl">${endV != null ? fmt(endV, dp) : '–'}</td><td class="cl-c${cls(wd, c.type === 'pr' ? 1 : good)}">${wd != null ? sgn(wd, dp) : ''}</td><td class="cl-t${cls(tot, c.type === 'pr' ? 1 : good)}">${tot != null ? sgn(tot, dp) : ''}</td>`;
        if (endV != null) prevEnd = c.type === 'pr' ? Math.max(prevEnd || 0, endV) : endV;
      } else if (c.type === 'sum') { const s0 = wr.reduce((a, r) => a + (r.v || 0), 0); sum = `<td class="cl-v hl">${fmt(s0)}</td><td class="cl-t">${fmt(wr[wr.length - 1].cum)}</td><td></td>`; }
      else { const ok = wr.filter(r => r.ok).length; sum = `<td class="cl-v hl" colspan="3">${ok} из ${wr.length}</td>`; }
      return `<tbody class="${open ? 'open' : ''}">${open ? wr.map(rowHtml).join('') : ''}<tr class="cl-wk" data-wk="${w}"><td colspan="2"><i class="ti ti-chevron-${open ? 'up' : 'down'}"></i>Неделя ${w + 1}</td>${sum}</tr></tbody>`;
    }).join('');
    return `<div class="cl-tw"><table class="cl-tab"><thead><tr>${cols.map(x => `<th>${x}</th>`).join('')}</tr></thead>${body}</table></div>`;
  }

  /* ── карточка для сторис: 1080×1920, рисуем на canvas ── */
  async function share(c) {
    const R = calc(c), T = TYPES[c.type], h = headline(R), u = unitOf(c), dp = dpOf(c);
    try { if (document.fonts) await Promise.all(['800 64px Montserrat', '700 40px Montserrat', '600 32px Montserrat'].map(f => document.fonts.load(f))); } catch (e) {}
    const W = 1080, H = 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
    const F = (w, s) => `${w} ${s}px Montserrat, -apple-system, sans-serif`;
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0B1024'); g.addColorStop(.55, '#141B3A'); g.addColorStop(1, '#1E1747'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    const glow = (cx, cy, r, col) => { const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = rg; x.fillRect(0, 0, W, H); };
    glow(160, 220, 700, 'rgba(74,124,255,.35)'); glow(980, 1500, 800, 'rgba(139,92,246,.28)');
    const rr = (X, Y, w, hh, r, fill) => { x.beginPath(); x.roundRect(X, Y, w, hh, r); x.fillStyle = fill; x.fill(); };
    const txt = (s, X, Y, font, col, al) => { x.font = font; x.fillStyle = col; x.textAlign = al || 'left'; x.fillText(s, X, Y); };
    const fit = (s, maxW, size, w) => { let z = size; x.font = F(w, z); while (x.measureText(s).width > maxW && z > 30) { z -= 2; x.font = F(w, z); } return z; };
    /* шапка */
    rr(80, 110, 190, 64, 32, 'rgba(255,255,255,.08)'); txt('YOU', 175, 155, F(800, 34), '#fff', 'center');
    txt('ЧЕЛЛЕНДЖ', W - 80, 155, F(700, 28), '#8EA8FF', 'right');
    const tz = fit(c.title, W - 160, 76, 800); txt(c.title, 80, 300, F(800, tz), '#fff');
    txt((R.started ? (R.over ? 'Итог' : 'День ' + R.dayNo + ' из ' + R.total) : 'Старт ' + dLong(c.start)) + '  ·  ' + dLong(c.start) + ' → ' + dLong(c.end), 80, 365, F(600, 32), '#A9B4D6');
    /* главная цифра */
    const bz = fit(h.big, W - 160, 150, 800);
    const bg = x.createLinearGradient(80, 0, 900, 0); bg.addColorStop(0, '#FFFFFF'); bg.addColorStop(1, '#BFCBFF'); txt(h.big, 80, 540, F(800, bz), bg);
    txt(h.sub, 80, 605, F(600, 34), '#A9B4D6');
    /* полоска */
    rr(80, 650, W - 160, 22, 11, 'rgba(255,255,255,.1)');
    if (R.pct > 0) { const pg = x.createLinearGradient(80, 0, W - 80, 0); pg.addColorStop(0, '#2C4FA8'); pg.addColorStop(1, '#4A7CFF'); rr(80, 650, Math.max(22, (W - 160) * R.pct), 22, 11, pg); }
    txt(Math.round(R.pct * 100) + '%', W - 80, 720, F(700, 30), '#C9D3F5', 'right');
    /* таблица последних дней */
    let rows = R.rows.filter(r => c.type === 'pr' ? r.v != null : true).slice(-7);
    const tx = 80, tw = W - 160, rh = 96; let ty = 790;
    rr(tx, ty, tw, rh * (rows.length + 1) + 20, 36, 'rgba(255,255,255,.05)');
    const cxs = [tx + 70, tx + 250, tx + 460, tx + 670, tx + tw - 40];
    const head = c.type === 'sum' ? ['День', 'Дата', 'Сделано', 'Всего', ''] : c.type === 'daily' ? ['День', 'Дата', u, '', ''] : c.type === 'nofx' ? ['День', 'Дата', 'Итог', '', ''] : ['День', 'Дата', c.type === 'meas' ? c.key : c.type === 'pr' ? 'Подход' : 'Вес', 'За день', 'Всего'];
    head.forEach((s, i) => s && txt(s, cxs[i], ty + 62, F(700, 26), '#7F8AB0', i < 2 ? 'center' : i === 4 ? 'right' : 'center'));
    ty += rh;
    const GOOD = 'rgba(34,197,94,.30)', BAD = 'rgba(240,100,90,.32)', ZERO = 'rgba(242,169,59,.22)';
    rows.forEach(r => {
      txt(String(r.n), cxs[0], ty + 60, F(600, 32), '#C9D3F5', 'center');
      txt(dShort(r.d) + ' ' + r.dow, cxs[1], ty + 60, F(600, 32), '#C9D3F5', 'center');
      const cell = (i, s, fill, col) => { if (fill) rr(cxs[i] - 95, ty + 14, 190, 66, 18, fill); txt(s, cxs[i], ty + 60, F(700, 34), col || '#fff', 'center'); };
      if (c.type === 'weight' || c.type === 'meas' || c.type === 'pr') {
        cell(2, r.v != null ? fmt(r.v, dp) : '–', r.d === today() && r.v != null ? 'rgba(74,124,255,.45)' : null);
        const cl = r.dd == null ? null : r.dd === 0 ? ZERO : (c.type === 'pr' ? r.dd > 0 : r.dd * R.dir > 0) ? GOOD : BAD;
        cell(3, r.dd != null ? sgn(r.dd, dp) : '~', cl);
        txt(r.all != null && r.i ? sgn(r.all, dp) : '~', cxs[4], ty + 60, F(700, 34), '#E6EBFF', 'right');
      } else if (c.type === 'sum') { cell(2, r.v != null ? fmt(r.v) : '–', r.ok ? GOOD : r.bad ? BAD : null); cell(3, fmt(r.cum), null); }
      else if (c.type === 'daily') cell(2, r.v != null ? fmt(r.v) : '–', r.ok ? GOOD : r.bad ? BAD : null);
      else cell(2, r.bad ? 'сорвался' : (r.v === 1 || r.ok) ? 'держался' : '–', r.bad ? BAD : (r.v === 1 || r.ok) ? GOOD : null);
      ty += rh;
    });
    /* итог и подпись */
    const fl = forecastLine(R).replace(/<[^>]+>/g, '');
    let fy = ty + 110;
    if (R.reached) { txt('Цель взята', W / 2, fy, F(800, 56), '#4ADE80', 'center'); fy += 70; }
    else if (fl) { x.font = F(600, 32); const words = fl.split(' '); let line = '', ly = fy; words.forEach(wd => { const t2 = line ? line + ' ' + wd : wd; if (x.measureText(t2).width > W - 160) { txt(line, 80, ly, F(600, 32), '#C9D3F5'); line = wd; ly += 46; } else line = t2; }); txt(line, 80, ly, F(600, 32), '#C9D3F5'); }
    txt('you-app.ru', W / 2, H - 110, F(700, 34), '#8EA8FF', 'center');
    const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
    const url = URL.createObjectURL(blob);
    const s = sheet(`<div class="cl-sh-h"><p class="tr-modal-title">Карточка для сторис</p><button class="cl-x" data-x aria-label="Закрыть"><i class="ti ti-x"></i></button></div>
      <img class="cl-shimg" src="${url}" alt="">
      <div class="tr-modal-actions"><a class="tr-modal-btn-secondary cl-dl" href="${url}" download="challenge.png"><i class="ti ti-download"></i> Сохранить</a><button class="tr-modal-btn-primary" id="sh-go"><i class="ti ti-share-3"></i> Поделиться</button></div>`, 'cl-shs');
    const file = new File([blob], 'challenge.png', { type: 'image/png' });
    const can = navigator.canShare && navigator.canShare({ files: [file] });
    const go = s.ov.querySelector('#sh-go');
    if (!can) go.style.display = 'none';
    go.onclick = async () => { try { await navigator.share({ files: [file], title: c.title }); } catch (e) {} };
  }

  return { render, calc, _all: all };
})();
