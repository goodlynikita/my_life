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
  function render(mount) {
    _mount = mount;
    if (_open && get(_open)) return detail(mount, get(_open));
    _open = null;
    const list = all().sort((a, b) => (b.at || 0) - (a.at || 0)), t = today();
    const act = list.filter(c => !c.done && c.end >= t), fin = list.filter(c => c.done || c.end < t);
    const card = (c) => { const R = calc(c), T = TYPES[c.type], h = headline(R);
      return `<button class="cl-card" data-open="${esc(c.id)}" style="--c:${T.c}">
        <span class="cl-ci"><i class="ti ${T.ico}"></i></span>
        <span class="cl-cm"><span class="cl-ct"><b>${esc(c.title)}</b>${paceChip(R)}</span>
          <span class="cl-big">${esc(h.big)}<small>${esc(h.sub)}</small></span>
          <span class="cl-bar"><i style="width:${(R.pct * 100).toFixed(1)}%"></i>${R.started && !R.over && c.type !== 'nofx' && c.type !== 'daily' ? `<u style="left:${(R.timePct * 100).toFixed(1)}%"></u>` : ''}</span>
          <span class="cl-cs">${R.started ? (R.over ? 'завершён ' + dLong(c.end) : 'день ' + R.dayNo + ' из ' + R.total + ' · осталось ' + R.left + ' ' + pl(R.left, 'день', 'дня', 'дней')) : 'старт ' + dLong(c.start)}</span></span>
        <i class="ti ti-chevron-right cl-go"></i></button>`; };
    mount.innerHTML = `<div class="cl-wrap">
      ${act.length ? `<div class="cl-h"><b>Активные</b><button class="cl-add" id="cl-new"><i class="ti ti-plus"></i>Новый</button></div><div class="cl-list">${act.map(card).join('')}</div>` : ''}
      ${!act.length ? `<div class="cl-hero"><i class="ti ti-trophy"></i><b>Челленджи</b><span>Выбери вызов на месяц или до праздника</span></div>` : ''}
      ${!act.length ? tplHtml() : ''}
      ${fin.length ? `<details class="cl-fin"${act.length ? '' : ' open'}><summary>Завершённые <span>${fin.length}</span><i class="ti ti-chevron-down"></i></summary><div class="cl-list">${fin.map(card).join('')}</div></details>` : ''}
    </div>`;
    mount.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { _open = b.dataset.open; _openWeeks = {}; render(mount); window.scrollTo({ top: 0 }); });
    const nb = mount.querySelector('#cl-new'); if (nb) nb.onclick = () => pickTpl();
    bindTpl(mount);
  }
  function tplHtml() {
    return `<div class="cl-tpls">${TPL.map((t, i) => `<button class="cl-tpl" data-tpl="${i}" style="--c:${TYPES[t.type].c}"><i class="ti ${TYPES[t.type].ico}"></i><b>${esc(t.title)}</b><small>${TYPES[t.type].n}</small></button>`).join('')}
      <button class="cl-tpl own" data-tpl="own"><i class="ti ti-pencil-plus"></i><b>Свой челлендж</b><small>любой из 6 видов</small></button></div>`;
  }
  function bindTpl(root, close) {
    root.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => { if (close) close(); if (b.dataset.tpl === 'own') pickType(); else form(Object.assign({}, TPL[+b.dataset.tpl])); });
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
  function pickTpl() {
    const s = sheet(`<div class="cl-sh-h"><p class="tr-modal-title">Новый челлендж</p><button class="cl-x" data-x aria-label="Закрыть"><i class="ti ti-x"></i></button></div>${tplHtml()}`);
    bindTpl(s.ov, s.close);
  }
  function pickType() {
    const s = sheet(`<div class="cl-sh-h"><p class="tr-modal-title">Какой челлендж?</p><button class="cl-x" data-x aria-label="Закрыть"><i class="ti ti-x"></i></button></div>
      <div class="cl-types">${Object.entries(TYPES).map(([k, T]) => `<button class="cl-type" data-ty="${k}" style="--c:${T.c}"><span class="cl-ci"><i class="ti ${T.ico}"></i></span><span><b>${T.n}</b><small>${T.ex}</small></span></button>`).join('')}</div>`);
    s.ov.querySelectorAll('[data-ty]').forEach(b => b.onclick = () => { s.close(); form({ type: b.dataset.ty, title: '' }); });
  }

  /* форма создания и правки */
  function form(t, edit) {
    const c = edit || {}, type = t.type, T = TYPES[type], td = today();
    const start = c.start || td;
    const end = c.end || (typeof t.end === 'function' ? t.end() : addDays(start, (t.days || 30) - 1));
    let startVal = c.startVal, goal = c.goal;
    if (!edit) {
      if (type === 'weight') { startVal = lastMeas('Вес'); goal = startVal != null && t.delta ? Math.round((startVal + t.delta) * 10) / 10 : null; }
      if (type === 'meas') { startVal = lastMeas(t.key || 'Талия'); goal = startVal != null && t.delta ? Math.round((startVal + t.delta) * 10) / 10 : null; }
      if (type === 'pr') { goal = t.goal || null; }
      if (type === 'sum') goal = t.goal || null;
    }
    const exs = type === 'pr' ? exNames() : [];
    const row = (lbl, inner) => `<div class="tr-modal-row"><label>${lbl}${inner}</label></div>`;
    const two = (a, b) => `<div class="tr-modal-row">${a}${b}</div>`;
    const lab = (lbl, inner) => `<label>${lbl}${inner}</label>`;
    const numIn = (id, v, ph) => `<input id="${id}" type="text" inputmode="decimal" value="${v != null ? esc(String(v).replace('.', ',')) : ''}" placeholder="${ph || ''}">`;
    let spec = '';
    if (type === 'weight') spec = two(lab('Вес на старте, кг', numIn('cf-sv', startVal, '90,5')), lab('Цель, кг', numIn('cf-g', goal, '80')));
    if (type === 'meas') spec = row('Что меряем', `<select id="cf-key" class="tr-color-select">${MEAS_KEYS.map(k => `<option${(c.key || t.key || 'Талия') === k ? ' selected' : ''}>${k}</option>`).join('')}</select>`) + two(lab('На старте', numIn('cf-sv', startVal)), lab('Цель', numIn('cf-g', goal)));
    if (type === 'pr') spec = row('Упражнение', `<input id="cf-ex" type="text" list="cf-exl" value="${esc(c.ex || t.ex || '')}" placeholder="Жим лёжа"><datalist id="cf-exl">${exs.map(n => `<option value="${esc(n)}">`).join('')}</datalist>`) + row('Цель, кг', numIn('cf-g', goal, '100'));
    if (type === 'sum') spec = two(lab('Цель за весь срок', numIn('cf-g', goal, '3000')), lab('Единица', `<input id="cf-u" type="text" value="${esc(c.unit || t.unit || 'раз')}">`));
    if (type === 'daily') spec = two(lab('Норма в день', numIn('cf-pd', c.perDay || t.perDay, '10000')), lab('Единица', `<input id="cf-u" type="text" value="${esc(c.unit || t.unit || 'раз')}">`));
    const s = sheet(`<div class="cl-sh-h"><p class="tr-modal-title"><i class="ti ${T.ico}" style="color:${T.c}"></i> ${edit ? 'Изменить челлендж' : T.n}</p><button class="cl-x" data-x aria-label="Закрыть"><i class="ti ti-x"></i></button></div>
      ${row('Название', `<input id="cf-t" type="text" maxlength="60" value="${esc(c.title || t.title || '')}" placeholder="${esc(TPL.find(x => x.type === type)?.title || '')}">`)}
      ${spec}
      ${two(lab('Старт', `<input id="cf-s" type="date" value="${start}">`), lab('Финиш', `<input id="cf-e" type="date" value="${end}">`))}
      <div class="cl-err" id="cf-err"></div>
      <div class="tr-modal-actions">${edit ? '<button class="tr-modal-btn-secondary" id="cf-del">Удалить</button>' : ''}<button class="tr-modal-btn-primary" id="cf-ok">${edit ? 'Сохранить' : 'Начать'}</button></div>`);
    const $ = (id) => s.ov.querySelector('#' + id);
    if ($('cf-key')) $('cf-key').onchange = () => { const v = lastMeas($('cf-key').value); if (v != null && !$('cf-sv').value) $('cf-sv').value = String(v).replace('.', ','); };
    if ($('cf-del')) { let sure = false; $('cf-del').onclick = () => { if (!sure) { sure = true; $('cf-del').textContent = 'Точно удалить?'; return; } Store.set('training.challenges.' + c.id, null); _open = null; s.close(); if (_mount) render(_mount); }; }
    $('cf-ok').onclick = () => {
      const err = (m) => { $('cf-err').textContent = m; };
      const title = $('cf-t').value.trim() || (TPL.find(x => x.type === type) || {}).title || T.n;
      const st = $('cf-s').value, en = $('cf-e').value;
      if (!st || !en || en <= st) return err('Финиш должен быть позже старта');
      const o = Object.assign({}, c, { id: c.id || ('c' + Date.now().toString(36)), type, title, start: st, end: en, at: c.at || Date.now(), log: c.log || {} });
      if (type === 'weight' || type === 'meas') {
        o.startVal = parseNum($('cf-sv').value); o.goal = parseNum($('cf-g').value);
        if (o.startVal == null || o.goal == null) return err('Впиши старт и цель');
        if (o.startVal === o.goal) return err('Цель должна отличаться от старта');
        if (type === 'meas') o.key = $('cf-key').value;
      }
      if (type === 'pr') { o.ex = $('cf-ex').value.trim(); o.goal = parseNum($('cf-g').value); if (!o.ex || !o.goal) return err('Впиши упражнение и цель'); }
      if (type === 'sum') { o.goal = parseNum($('cf-g').value); o.unit = $('cf-u').value.trim() || 'раз'; if (!o.goal) return err('Впиши цель'); }
      if (type === 'daily') { o.perDay = parseNum($('cf-pd').value); o.unit = $('cf-u').value.trim() || 'раз'; if (!o.perDay) return err('Впиши норму в день'); }
      save(o); s.close(); _open = o.id; _openWeeks = {}; if (_mount) render(_mount);
    };
    setTimeout(() => { const f = s.ov.querySelector('input:not([type=date])'); if (f && !f.value) f.focus(); }, 80);
  }

  /* детальный экран: шапка, ввод за сегодня, таблица по неделям */
  function detail(mount, c) {
    const R = calc(c), T = TYPES[c.type], h = headline(R), u = unitOf(c), dp = dpOf(c), t = today();
    const fl = forecastLine(R);
    const logToday = (c.log || {})[t];
    let input = '';
    if (R.started && !R.over && !c.done) {
      if (c.type === 'nofx') input = `<div class="cl-in nofx"><span>Сегодня</span><button class="cl-yes${logToday === 1 ? ' on' : ''}" data-mark="1"><i class="ti ti-check"></i>Держусь</button><button class="cl-no${logToday === 0 ? ' on' : ''}" data-mark="0"><i class="ti ti-x"></i>Сорвался</button></div>`;
      else if (c.type !== 'pr' && c.type !== 'meas') input = `<div class="cl-in"><span>Сегодня</span><input id="cl-v" type="text" inputmode="decimal" value="${logToday != null ? esc(String(logToday).replace('.', ',')) : ''}" placeholder="${c.type === 'weight' ? fmt(R.cur, 2) : '0'}"><em>${esc(u)}</em><button id="cl-save">${logToday != null ? 'Обновить' : 'Записать'}</button></div>`;
      else if (c.type === 'meas') input = `<div class="cl-in"><span>${esc(c.key)} сегодня</span><input id="cl-v" type="text" inputmode="decimal" value="${logToday != null ? esc(String(logToday).replace('.', ',')) : ''}" placeholder="${fmt(R.cur, 1)}"><em>${esc(u)}</em><button id="cl-save">Записать</button></div>`;
      else input = `<div class="cl-auto"><i class="ti ti-refresh"></i>Берётся из твоих тренировок: «${esc(c.ex)}», лучший рабочий подход</div>`;
    }
    mount.innerHTML = `<div class="cl-wrap cl-det" style="--c:${T.c}">
      <div class="cl-top"><button class="cl-back" id="cl-back" aria-label="Назад"><i class="ti ti-arrow-left"></i></button><span class="cl-tt"><i class="ti ${T.ico}"></i>${T.n}</span>
        <span class="cl-acts"><button class="cl-back" id="cl-share" aria-label="Поделиться"><i class="ti ti-share-3"></i></button><button class="cl-back" id="cl-edit" aria-label="Изменить"><i class="ti ti-pencil"></i></button></span></div>
      <div class="cl-head">
        <h2>${esc(c.title)}</h2>
        <div class="cl-per">${dLong(c.start)} → ${dLong(c.end)} · ${R.started ? (R.over ? 'завершён' : 'день ' + R.dayNo + ' из ' + R.total) : 'старт через ' + diffDays(t, c.start) + ' ' + pl(diffDays(t, c.start), 'день', 'дня', 'дней')}</div>
        <div class="cl-hbig"><b>${esc(h.big)}</b><span>${esc(h.sub)}</span></div>
        <div class="cl-bar lg"><i style="width:${(R.pct * 100).toFixed(1)}%"></i>${R.started && !R.over && c.type !== 'nofx' && c.type !== 'daily' ? `<u style="left:${(R.timePct * 100).toFixed(1)}%"></u>` : ''}</div>
        <div class="cl-hrow">${paceChip(R)}${R.started && !R.over ? `<span class="cl-left">осталось ${R.left} ${pl(R.left, 'день', 'дня', 'дней')}</span>` : ''}</div>
        ${fl ? `<div class="cl-fc"><i class="ti ti-chart-line"></i><span>${fl}</span></div>` : ''}
      </div>
      ${input}
      ${tableHtml(R)}
    </div>`;
    const $ = (s) => mount.querySelector(s);
    $('#cl-back').onclick = () => { _open = null; render(mount); };
    $('#cl-edit').onclick = () => form({ type: c.type }, c);
    $('#cl-share').onclick = () => share(c);
    const sv = $('#cl-save'), vi = $('#cl-v');
    if (sv) { const go = () => { const v = parseNum(vi.value); setLog(c, t, v); after(c); }; sv.onclick = go; vi.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); }
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
        const wd = endV != null && prevEnd != null ? endV - prevEnd : null, tot = endV != null && (c.type === 'pr' ? R.base : c.startVal) != null ? endV - (c.type === 'pr' ? R.base : c.startVal) : null;
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
    if (R.pct > 0) { const pg = x.createLinearGradient(80, 0, W - 80, 0); pg.addColorStop(0, '#4A7CFF'); pg.addColorStop(1, '#8B5CF6'); rr(80, 650, Math.max(22, (W - 160) * R.pct), 22, 11, pg); }
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
