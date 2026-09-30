/* ============================================================
   ПРОГРЕСС ТЕЛА: сводка по замерам
   Вес с графиком и темпом, все замеры с динамикой, выводы
   (жир уходит / чистый набор / слишком быстро), симметрия,
   связь с силой. Используется в «Тренировки → Итоги» и в кабинете тренера.
   BodyProgress.html(measurements, { hist, period, coach }) → HTML
   BodyProgress.bind(root, rerender) — переключатель периода
   ============================================================ */
window.BodyProgress = (function () {
  const DAY = 864e5;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toArr = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map(k => v[k]) : []);
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.').replace(/[^\d.\-]/g, '')); return isNaN(n) ? null : n; };
  const f1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
  const sg = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + f1(Math.abs(n));
  const fmtD = (d) => String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0');
  const pl = (n, a, b, c) => { const x = n % 10, y = n % 100; return x === 1 && y !== 11 ? a : x >= 2 && x <= 4 && (y < 12 || y > 14) ? b : c; };

  /* Что считается «хорошо»: +1 рост хорошо, −1 снижение хорошо, 0 зависит от цели */
  const FIELDS = {
    'Вес': { u: 'кг', dir: 0 }, 'Талия': { u: 'см', dir: -1 }, 'Плечи': { u: 'см', dir: 1 }, 'Грудь': { u: 'см', dir: 1 },
    'Лев рука': { u: 'см', dir: 1 }, 'Прав рука': { u: 'см', dir: 1 }, 'Лев нога': { u: 'см', dir: 1 }, 'Прав нога': { u: 'см', dir: 1 },
    'Бедро': { u: 'см', dir: 0 }, 'Мышечная масса': { u: 'кг', dir: 1 }, '% жира': { u: '%', dir: -1 }, 'Оценка InBody': { u: '', dir: 1 },
  };
  const ORDER = Object.keys(FIELDS);
  const SHORT = { 'Мышечная масса': 'Мышцы', 'Оценка InBody': 'InBody', 'Лев рука': 'Рука лев.', 'Прав рука': 'Рука прав.', 'Лев нога': 'Нога лев.', 'Прав нога': 'Нога прав.' };

  function parseDate(s) {
    const m = String(s || '').match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/); if (!m) return null;
    let y = m[3] ? +m[3] : new Date().getFullYear(); if (y < 100) y += 2000;
    const d = new Date(y, +m[2] - 1, +m[1]); if (!m[3] && d > new Date()) d.setFullYear(y - 1); return d;
  }
  function series(ms) {
    const list = toArr(ms).filter(m => m && m.values).map(m => ({ d: parseDate(m.date), v: m.values, raw: m })).filter(m => m.d).sort((a, b) => a.d - b.d);
    const by = {};
    list.forEach(m => Object.entries(m.v).forEach(([k, v]) => { const n = num(v); if (n == null) return; (by[k] = by[k] || []).push({ d: m.d, v: n }); }));
    return { list, by };
  }

  /* Точки периода + последняя точка до него как база: так видно изменение даже при одном замере в периоде */
  function win(pts, from) { const inP = pts.filter(p => p.d >= from), before = pts.filter(p => p.d < from); return before.length ? [before[before.length - 1], ...inP] : inP; }

  /* ── Выводы ── */
  function insights(by, from, hist) {
    const out = [];
    const ch = (k) => { const s = win(by[k] || [], from); return s.length >= 2 ? { a: s[0].v, b: s[s.length - 1].v, d: s[s.length - 1].v - s[0].v, days: (s[s.length - 1].d - s[0].d) / DAY } : null; };
    const w = ch('Вес'), wa = ch('Талия'), fat = ch('% жира'), mm = ch('Мышечная масса');
    const vol = ['Грудь', 'Плечи', 'Лев рука', 'Прав рука', 'Лев нога', 'Прав нога'].map(ch).filter(Boolean);
    const volUp = vol.length ? vol.reduce((s, x) => s + x.d, 0) / vol.length : null;
    if (w && wa) {
      if (w.d < -0.3 && wa.d <= -0.5 && (volUp == null || volUp > -0.5)) out.push({ k: 'good', i: 'ti-flame', t: 'Жир уходит, объёмы мышц на месте', s: `вес ${sg(w.d)} кг, талия ${sg(wa.d)} см` });
      else if (w.d > 0.3 && wa.d <= 0.5 && volUp != null && volUp > 0.3) out.push({ k: 'good', i: 'ti-barbell', t: 'Чистый набор: растут объёмы, талия держится', s: `вес ${sg(w.d)} кг, объёмы в среднем ${sg(volUp)} см` });
      else if (w.d > 0.5 && wa.d > 1) out.push({ k: 'warn', i: 'ti-alert-triangle', t: 'Вес растёт вместе с талией', s: `талия ${sg(wa.d)} см. Стоит проверить питание` });
      else if (w.d < -0.5 && volUp != null && volUp < -0.7) out.push({ k: 'warn', i: 'ti-alert-triangle', t: 'Вместе с весом уходят объёмы', s: `объёмы в среднем ${sg(volUp)} см. Возможно, мало белка или слишком резкий дефицит` });
    }
    if (w && w.days >= 10) {
      const perW = w.d / w.days * 7, pct = Math.abs(perW) / w.a * 100;
      if (perW < 0 && pct > 1) out.push({ k: 'warn', i: 'ti-trending-down', t: 'Вес уходит слишком быстро', s: `${f1(Math.abs(perW))} кг в неделю, это больше 1% веса. Растёт риск потерять мышцы` });
      else if (perW > 0 && pct > 0.5) out.push({ k: 'warn', i: 'ti-trending-up', t: 'Вес растёт быстро', s: `+${f1(perW)} кг в неделю. Для набора без лишнего жира обычно хватает 0,25–0,5%` });
    }
    if (fat && Math.abs(fat.d) >= 0.5) out.push({ k: fat.d < 0 ? 'good' : 'warn', i: 'ti-droplet', t: `Процент жира ${sg(fat.d)}%`, s: `было ${f1(fat.a)}%, сейчас ${f1(fat.b)}%` });
    if (mm && Math.abs(mm.d) >= 0.3) out.push({ k: mm.d > 0 ? 'good' : 'warn', i: 'ti-stretching', t: `Мышечная масса ${sg(mm.d)} кг`, s: `было ${f1(mm.a)} кг, сейчас ${f1(mm.b)} кг` });
    /* симметрия по последнему замеру */
    [['Лев рука', 'Прав рука', 'рука'], ['Лев нога', 'Прав нога', 'нога']].forEach(([l, r, n]) => {
      const L = by[l] && by[l][by[l].length - 1], R = by[r] && by[r][by[r].length - 1];
      if (L && R && Math.abs(L.v - R.v) >= 1) out.push({ k: 'info', i: 'ti-scale', t: `${L.v < R.v ? 'Левая' : 'Правая'} ${n} меньше на ${f1(Math.abs(L.v - R.v))} см`, s: 'Добавь односторонние упражнения, начиная со слабой стороны' });
    });
    /* сила против веса */
    if (hist && hist.length && w) {
      const e1 = (r) => (+r.weight || 0) * (1 + (+r.reps || 0) / 30);
      const byEx = {}; hist.filter(h => h.date >= from).forEach(h => h.exercises.forEach(e => { if (+e.weight > 0) (byEx[e.key] = byEx[e.key] || []).push(e1(e)); }));
      const gains = Object.values(byEx).filter(a => a.length >= 3).map(a => (Math.max(...a.slice(-2)) - Math.max(...a.slice(0, 2))) / Math.max(...a.slice(0, 2)) * 100);
      if (gains.length >= 2) {
        const g = gains.reduce((s, x) => s + x, 0) / gains.length, wp = w.d / w.a * 100;
        if (g > 2 && wp <= 0.5) out.push({ k: 'good', i: 'ti-bolt', t: 'Относительная сила растёт', s: `сила в среднем ${sg(g)}% при весе ${sg(wp)}%` });
        else if (g < -2 && wp < -1) out.push({ k: 'warn', i: 'ti-bolt', t: 'Сила падает вместе с весом', s: `сила ${sg(g)}%, вес ${sg(wp)}%. Проверь восстановление и питание` });
      }
    }
    return out;
  }

  /* ── Графики ── */
  function weightChart(pts) {
    const W = 340, H = 130, pl_ = 30, pr = 12, pt = 16, pb = 20;
    const t0 = +pts[0].d, t1 = +pts[pts.length - 1].d || t0 + 1;
    const vs = pts.map(p => p.v); let mn = Math.min(...vs), mx = Math.max(...vs);
    if (mx - mn < 1) { const c = (mx + mn) / 2; mn = c - 0.5; mx = c + 0.5; }
    const pad = (mx - mn) * 0.15; mn -= pad; mx += pad;
    const X = (t) => pl_ + (t - t0) / Math.max(1, t1 - t0) * (W - pl_ - pr), Y = (v) => pt + (1 - (v - mn) / (mx - mn)) * (H - pt - pb);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + X(+p.d).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' ');
    const area = line + ` L${X(+pts[pts.length - 1].d).toFixed(1)} ${H - pb} L${X(t0).toFixed(1)} ${H - pb} Z`;
    const ticks = [mx - pad, (mx + mn) / 2, mn + pad];
    return `<svg viewBox="0 0 ${W} ${H}" class="bp-chart" role="img" aria-label="График веса">
      <defs><linearGradient id="bpg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#4A7CFF" stop-opacity=".28"/><stop offset="1" stop-color="#4A7CFF" stop-opacity="0"/></linearGradient></defs>
      ${ticks.map(v => `<line x1="${pl_}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" class="bp-grid"/><text x="${pl_ - 5}" y="${Y(v) + 3}" class="bp-ax" text-anchor="end">${f1(v)}</text>`).join('')}
      <path d="${area}" fill="url(#bpg)"/><path d="${line}" class="bp-line"/>
      ${pts.map((p, i) => `<g class="bp-pt"><title>${fmtD(p.d)}: ${f1(p.v)} кг</title><circle cx="${X(+p.d)}" cy="${Y(p.v)}" r="10" fill="transparent"/><circle cx="${X(+p.d)}" cy="${Y(p.v)}" r="${i === pts.length - 1 ? 4.5 : 3.2}" class="bp-dot${i === pts.length - 1 ? ' last' : ''}"/></g>`).join('')}
      <text x="${pl_}" y="${H - 5}" class="bp-ax">${fmtD(pts[0].d)}</text><text x="${W - pr}" y="${H - 5}" class="bp-ax" text-anchor="end">${fmtD(pts[pts.length - 1].d)}</text>
    </svg>`;
  }
  function spark(pts) {
    if (pts.length < 2) return '';
    const W = 70, H = 22, p = 3, vs = pts.map(x => x.v), mn = Math.min(...vs), mx = Math.max(...vs);
    const X = (i) => p + i / (pts.length - 1) * (W - 2 * p), Y = (v) => H - p - (mx === mn ? 0.5 : (v - mn) / (mx - mn)) * (H - 2 * p);
    return `<svg viewBox="0 0 ${W} ${H}" class="bp-spark"><path d="${pts.map((x, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(x.v).toFixed(1)).join(' ')}"/></svg>`;
  }

  /* ── Главное ── */
  const PERIODS = [['all', 'С начала'], ['90', '3 месяца'], ['30', 'Месяц']];
  function html(measurements, opts) {
    opts = opts || {};
    const { list, by } = series(measurements);
    if (!list.length) return `<div class="bp bp-empty"><i class="ti ti-ruler-measure"></i><div><b>Прогресс тела</b><span>${opts.coach ? 'Клиент ещё не вносил замеры. Их можно добавить самому, например после встречи в зале.' : 'Добавь первый замер: вес, талию, объёмы. Здесь появится динамика и выводы, что меняется в теле.'}</span></div></div>`;
    const period = opts.period || 'all';
    const last = list[list.length - 1].d;
    const from = period === 'all' ? list[0].d : new Date(+last - (+period) * DAY);
    const inP = list.filter(m => m.d >= from);
    const since = Math.round((Date.now() - +last) / DAY);
    const w = win(by['Вес'] || [], from);
    const wd = w.length >= 2 ? w[w.length - 1].v - w[0].v : null;
    const wdays = w.length >= 2 ? (w[w.length - 1].d - w[0].d) / DAY : 0;
    const perW = wd != null && wdays >= 7 ? wd / wdays * 7 : null;
    const ins = insights(by, from, opts.hist);
    const keys = ORDER.filter(k => by[k] && by[k].length).concat(Object.keys(by).filter(k => !FIELDS[k]));
    return `<div class="bp">
      <div class="bp-h"><div><b>Прогресс тела</b><span>${inP.length} ${pl(inP.length, 'замер', 'замера', 'замеров')} · ${fmtD(inP[0] ? inP[0].d : from)} – ${fmtD(last)}</span></div>
        ${list.length > 2 ? `<div class="bp-per">${PERIODS.map(p => `<button data-bp="${p[0]}" class="${period === p[0] ? 'on' : ''}">${p[1]}</button>`).join('')}</div>` : ''}</div>
      ${since > 21 ? `<div class="bp-remind"><i class="ti ti-calendar-time"></i><span>Последний замер ${since} ${pl(since, 'день', 'дня', 'дней')} назад. ${opts.coach ? 'Попросите клиента обновить или внесите сами.' : 'Пора обновить: лучше раз в 2–4 недели, утром натощак.'}</span></div>` : ''}
      ${w.length ? `<div class="bp-w">
        <div class="bp-w-top"><div><span>Вес</span><b>${f1(w[w.length - 1].v)}<small> кг</small></b></div>
          ${wd != null ? `<div class="bp-w-d"><b class="${Math.abs(wd) < 0.3 ? '' : wd < 0 ? 'wdown' : 'wup'}">${sg(wd)} кг</b><span>за период</span></div>` : ''}
          ${perW != null ? `<div class="bp-w-d"><b>${sg(perW)} кг</b><span>в неделю</span></div>` : ''}</div>
        ${w.length >= 2 ? weightChart(w) : ''}</div>` : ''}
      ${ins.length ? `<div class="bp-ins">${ins.map(x => `<div class="bp-in ${x.k}"><i class="ti ${x.i}"></i><div><b>${esc(x.t)}</b><span>${esc(x.s)}</span></div></div>`).join('')}</div>` : ''}
      <div class="bp-grid-l">${keys.filter(k => k !== 'Вес').map(k => {
        const s = win(by[k], from), all = by[k], cur = all[all.length - 1];
        const d = s.length >= 2 ? s[s.length - 1].v - s[0].v : null, prev = all.length >= 2 ? cur.v - all[all.length - 2].v : null;
        const dir = (FIELDS[k] || {}).dir || 0, u = (FIELDS[k] || {}).u || '';
        const cls = d == null || Math.abs(d) < 0.2 || !dir ? '' : d * dir > 0 ? 'good' : 'bad';
        return `<div class="bp-m"><div class="bp-m-t"><span>${esc(SHORT[k] || k)}</span>${spark(s)}</div>
          <div class="bp-m-v"><b>${f1(cur.v)}<small> ${u}</small></b>${d != null ? `<em class="${cls}">${sg(d)}</em>` : ''}</div>
          ${prev != null && all.length > 2 ? `<div class="bp-m-p">с прошлого ${sg(prev)}</div>` : ''}</div>`; }).join('')}</div>
    </div>`;
  }
  function bind(root, rerender) {
    root.querySelectorAll('[data-bp]').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); rerender(b.dataset.bp); }));
  }
  /* Изменение за неделю для итогов недели */
  function weekDelta(measurements, from, to) {
    const { by } = series(measurements); const out = [];
    ['Вес', 'Талия', '% жира'].forEach(k => { const s = by[k] || []; const inW = s.filter(p => p.d >= from && p.d < to); if (!inW.length) return;
      const before = s.filter(p => p.d < from); const base = before.length ? before[before.length - 1] : null; const cur = inW[inW.length - 1];
      out.push(`${k}: ${f1(cur.v)}${base ? ` (${sg(cur.v - base.v)})` : ''}`); });
    return out;
  }
  return { html, bind, weekDelta, series, FIELDS };
})();
