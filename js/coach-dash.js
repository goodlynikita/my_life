/* ============================================================
   КАБИНЕТ ТРЕНЕРА: расчёты и отрисовка сводок
   Чистые функции: получают training клиента, отдают данные и HTML.
   Чтение и запись в базу остаются в coach.html.
   ============================================================ */
window.CoachDash = (function () {
  const DAY = 864e5, WEEK = 7 * DAY;
  const A = () => window.TrainingAI;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toArr = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map(k => v[k]) : []);
  const e1 = (r) => (+r.weight || 0) * (1 + (+r.reps || 0) / 30);
  const kg = (w) => String(Math.round(w * 10) / 10).replace('.', ',');
  const monday = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const fmtD = (d) => String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0');
  const t0 = () => { const x = new Date(); x.setHours(0, 0, 0, 0); return x; };

  /* Все дни всех планов с датами */
  function days(training) {
    const out = [];
    toArr(training && training.plans).filter(Boolean).forEach((p, pi) => toArr(p.weeks).forEach((w, wi) => toArr(w && w.days).forEach((d, di) => {
      if (!d) return; if (typeof trMigrateDayToSessions === 'function') trMigrateDayToSessions(d);
      const date = A().planDayDate(p, d.date); if (!date) return;
      const ss = toArr(d.sessions).filter(s => s && s.type !== 'Отдых' && s.type !== 'Шаги'); /* шаги не тренировка */
      out.push({ date, day: d, plan: p, pi, wi, di, work: ss.length > 0, sessions: ss });
    })));
    return out.sort((a, b) => a.date - b.date);
  }
  function hasData(x) { return x.sessions.some(sData); }
  function sData(s) {
    return (toArr(s.exercises).some(e => e && ((+e.weight || 0) > 0 || (+e.reps || 0) > 0 || (+e.distance || 0) > 0 || (+e.duration || 0) > 0 || (+e.steps || 0) > 0)));
  }
  /* Сделано: галочка (клиент или тренер) или своя запись клиента.
     Тренировки, которые заранее вписал тренер, без галочки не считаем. */
  /* Сделано, если:
     • стоит галочка (клиент или тренер);
     • своя тренировка клиента с заполненными данными;
     • тренировка из плана тренера, но клиент поменял в ней веса, повторы или добавил упражнение.
     Старые записи без снимка плана считаем по заполненным данным. */
  const sig = (e) => [e.sets, e.reps, e.weight, e.distance, e.duration, e.steps].map(v => v == null ? '' : String(v)).join('|');
  const exVal = (e) => e && ((+e.weight || 0) > 0 || (+e.reps || 0) > 0 || (+e.distance || 0) > 0 || (+e.duration || 0) > 0 || (+e.steps || 0) > 0);
  function sessionDone(s) {
    if (!s.byCoach) return sData(s);
    const ex = toArr(s.exercises).filter(Boolean);
    if (!ex.some(e => e.pv != null)) return sData(s);
    return ex.some(e => exVal(e) && (e.pv == null || sig(e) !== e.pv));
  }
  const doneDay = (x) => x.work && (!!x.day.done || x.sessions.some(sessionDone));
  function parseMDate(s) {
    const m = String(s || '').match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/); if (!m) return null;
    let y = m[3] ? +m[3] : new Date().getFullYear(); if (y < 100) y += 2000;
    const d = new Date(y, +m[2] - 1, +m[1]); if (!m[3] && d > new Date()) d.setFullYear(y - 1); return d;
  }

  /* ═══ Всё по одному клиенту ═══ */
  function analyze(training) {
    const today = t0(), all = days(training);
    const past = all.filter(x => x.date <= today);
    const isDone = doneDay;
    const plans = toArr(training && training.plans).filter(Boolean);
    const hist = A().collect(plans);
    const an = A().analyze(hist, {});
    /* недели: последние 8 */
    const m0 = monday(today), weeks = [];
    for (let i = 7; i >= 0; i--) {
      const from = new Date(+m0 - i * WEEK), to = new Date(+from + WEEK);
      const inW = past.filter(x => x.date >= from && x.date < to && x.work);
      const tons = hist.filter(h => h.date >= from && h.date < to).reduce((s, h) => s + h.exercises.reduce((a, e) => a + (+e.sets || 0) * (+e.reps || 0) * (+e.weight || 0), 0), 0) / 1000;
      weeks.push({ from, label: fmtD(from), planned: inW.length, done: inW.filter(isDone).length, tons: Math.round(tons * 10) / 10 });
    }
    const last4 = weeks.slice(-4), pl4 = last4.reduce((s, w) => s + w.planned, 0), dn4 = last4.reduce((s, w) => s + w.done, 0);
    const comments = past.filter(x => x.day.comment).map(x => ({ date: x.date, text: x.day.comment })).reverse().slice(0, 5);
    /* серия подряд выполненных тренировок */
    let streak = 0; const workPast = past.filter(x => x.work && +x.date !== +today).reverse();
    for (const x of workPast) { if (isDone(x)) streak++; else break; }
    /* 1RM по ключевым упражнениям */
    const lifts = Object.values(an.ex).filter(x => x.cls && x.cls.kind === 'comp').map(x => {
      const h = toArr(x.hist).filter(r => r.weight > 0 && r.reps > 0).map(r => ({ t: +r.date, v: Math.round(e1(r) * 10) / 10, w: r.weight, reps: r.reps }));
      return { key: x.key, name: x.name, pts: h, best: h.length ? Math.max(...h.map(p => p.v)) : 0 };
    }).filter(x => x.pts.length >= 2).sort((a, b) => b.pts.length - a.pts.length || b.best - a.best).slice(0, 4);
    /* замеры */
    const ms = toArr(training && training.measurements).filter(m => m && m.values).map(m => ({ ...m, d: parseMDate(m.date) })).sort((a, b) => (a.d || 0) - (b.d || 0));
    const lastM = ms[ms.length - 1] || null, firstM = ms[0] || null;
    const weight = (m) => m && m.values && parseFloat(String(m.values['Вес'] || '').replace(',', '.'));
    return { all, past, isDone, hist, an, weeks, att: pl4 ? Math.round(dn4 / pl4 * 100) : null, pl4, dn4, comments, streak, lifts, ms, lastM, firstM,
      wNow: weight(lastM), wStart: weight(firstM) };
  }
  function groupsOf(x) { return [...new Set(x.sessions.flatMap(s => toArr(s.groups).length ? toArr(s.groups) : [s.type]))].join(' + '); }

  /* ═══ Лента событий по всем клиентам ═══ */
  function feed(clients, nameOf) {
    const ev = [], today = t0(), from = new Date(+today - 14 * DAY);
    clients.forEach(c => {
      if (!c.ok || !c.d) return; const d = c.d, who = nameOf(c);
      d.past.filter(x => x.date >= from && x.work).forEach(x => {
        if (d.isDone(x)) {
          const hs = d.hist.filter(h => +h.date === +x.date).flatMap(h => h.exercises);
          const top = hs.sort((a, b) => e1(b) - e1(a))[0];
          ev.push({ t: +x.date, k: 'done', c, html: `<b>${esc(who)}</b>: ${x.day.done && x.day.done.by === 'coach' ? 'тренировка с вами' : 'тренировка сделана'}, ${esc(groupsOf(x))}${top && top.weight > 0 ? `, ${esc(top.name)} ${kg(top.weight)}×${top.reps}` : ''}` });
        } else if (+x.date < +today) ev.push({ t: +x.date, k: 'miss', c, html: `<b>${esc(who)}</b>: тренировка не отмечена (${esc(groupsOf(x))})` });
        if (x.day.comment) ev.push({ t: +x.date + 1, k: 'comment', c, html: `<b>${esc(who)}</b>, заметка: «${esc(x.day.comment)}»` });
      });
      /* рекорды */
      Object.values(d.an.ex).forEach(x => {
        const h = toArr(x.hist).filter(r => r.weight > 0 && r.reps > 0); if (h.length < 3 || !x.cls || x.cls.kind !== 'comp') return;
        let best = 0; h.forEach((r, i) => { const v = e1(r); if (i >= 2 && v > best + 0.01 && r.date >= from) ev.push({ t: +r.date + 2, k: 'pr', c, html: `<b>${esc(who)}</b> рекорд: ${esc(x.name)} ${kg(r.weight)}×${esc(r.reps)} (1ПМ ≈ ${kg(Math.round(v))} кг)` }); best = Math.max(best, v); });
      });
      d.ms.filter(m => m.d && m.d >= from).forEach(m => { const w = parseFloat(String(m.values['Вес'] || '').replace(',', '.'));
        ev.push({ t: +m.d, k: 'measure', c, html: `<b>${esc(who)}</b> внёс замеры${w ? ': вес ' + kg(w) + ' кг' : ''}` }); });
    });
    return ev.sort((a, b) => b.t - a.t);
  }
  const EV_ICON = { done: 'ti-circle-check', miss: 'ti-clock-exclamation', comment: 'ti-message-circle', pr: 'ti-trophy', measure: 'ti-ruler-2' };
  function whenLabel(t) { const d = Math.round((+t0() - +new Date(new Date(t).setHours(0, 0, 0, 0))) / DAY); return d <= 0 ? 'сегодня' : d === 1 ? 'вчера' : fmtD(new Date(t)); }
  function feedHtml(list, limit) {
    if (!list.length) return '<div class="fd-empty">Пока тихо. Здесь появятся тренировки, рекорды, пропуски и комментарии клиентов.</div>';
    let last = '';
    return list.slice(0, limit || 40).map(e => { const w = whenLabel(e.t); const h = w !== last ? `<div class="fd-day">${w}</div>` : ''; last = w;
      return h + `<div class="fd fd-${e.k}" data-ck="${esc(e.c.k)}"><i class="ti ${EV_ICON[e.k]}"></i><span>${e.html}</span></div>`; }).join('');
  }

  /* ═══ Графики (SVG, без библиотек) ═══ */
  /* Посещаемость: неделя = строка, тренировка = кружок */
  function attHtml(weeks) {
    const ws = weeks.slice(-6).reverse();
    if (!ws.some(w => w.planned)) return '<div class="fd-empty">Тренировок в плане за последние недели нет.</div>';
    return `<div class="att">${ws.map((w, i) => { const to = new Date(+w.from + 6 * DAY);
      const pct = w.planned ? Math.round(w.done / w.planned * 100) : null;
      return `<div class="att-r${i === 0 ? ' cur' : ''}"><span class="att-d">${i === 0 ? 'эта неделя' : fmtD(w.from) + ' – ' + fmtD(to)}</span>
        <span class="att-dots">${w.planned ? Array.from({ length: Math.max(w.planned, w.done) }, (_, k) => `<i class="${k < w.done ? 'on' : ''}"></i>`).join('') : '<em>нет в плане</em>'}</span>
        <span class="att-v${pct == null ? '' : pct >= 80 ? ' g' : pct >= 50 ? ' w' : ' b'}">${w.planned ? `${w.done} из ${w.planned}` : ''}</span></div>`; }).join('')}</div>`;
  }
  /* Тоннаж: обычные столбики с подписями в тоннах */
  function tonsHtml(weeks) {
    const ws = weeks.slice(-8), max = Math.max(0.1, ...ws.map(w => w.tons));
    if (!ws.some(w => w.tons)) return '<div class="fd-empty">Силовых тренировок с весами пока нет.</div>';
    return `<div class="tn">${ws.map((w, i) => `<div class="tn-c${i === ws.length - 1 ? ' cur' : ''}" title="Неделя с ${w.label}: ${Math.round(w.tons * 1000).toLocaleString('ru-RU')} кг">
      <span class="tn-v">${w.tons ? String(w.tons).replace('.', ',') + ' т' : ''}</span><div class="tn-b"><i style="height:${w.tons ? Math.max(4, w.tons / max * 100) : 0}%"></i></div><span class="tn-l">${w.label}</span></div>`).join('')}</div>`;
  }
  function barsSvg(weeks, key, opt) {
    const W = 320, H = 120, pad = 18, n = weeks.length, bw = (W - 8) / n;
    const max = Math.max(1, ...weeks.map(w => opt.track ? Math.max(w[opt.track], w[key]) : w[key]));
    const y = (v) => H - pad - (v / max) * (H - pad - 14);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="cd-svg" role="img" aria-label="${esc(opt.label)}">`;
    s += `<line x1="0" x2="${W}" y1="${H - pad}" y2="${H - pad}" class="cd-base"/>`;
    weeks.forEach((w, i) => {
      const x = 4 + i * bw + bw * 0.2, bwi = bw * 0.6, cur = i === n - 1;
      const tip = opt.tip(w);
      s += `<g class="cd-bar${cur ? ' cur' : ''}"><title>${esc(tip)}</title><rect x="${4 + i * bw}" y="0" width="${bw}" height="${H}" fill="transparent"/>`;
      if (opt.track && w[opt.track]) s += `<rect x="${x}" y="${y(w[opt.track])}" width="${bwi}" height="${H - pad - y(w[opt.track])}" rx="4" class="cd-track"/>`;
      if (w[key]) s += `<rect x="${x}" y="${y(w[key])}" width="${bwi}" height="${Math.max(2, H - pad - y(w[key]))}" rx="4" class="cd-fill"/>`;
      if (w[key] || (opt.track && w[opt.track])) s += `<text x="${x + bwi / 2}" y="${y(Math.max(w[key], opt.track ? w[opt.track] : 0)) - 4}" class="cd-val">${opt.fmt(w)}</text>`;
      s += `<text x="${x + bwi / 2}" y="${H - 4}" class="cd-lbl">${w.label}</text></g>`;
    });
    return s + '</svg>';
  }
  function lineSvg(pts) {
    const W = 300, H = 64, p = 6;
    const t0_ = pts[0].t, t1 = pts[pts.length - 1].t || t0_ + 1, vs = pts.map(x => x.v), mn = Math.min(...vs), mx = Math.max(...vs);
    const X = (t) => p + (t - t0_) / Math.max(1, t1 - t0_) * (W - 2 * p), Y = (v) => H - p - (mx === mn ? 0.5 : (v - mn) / (mx - mn)) * (H - 2 * p);
    const d = pts.map((x, i) => (i ? 'L' : 'M') + X(x.t).toFixed(1) + ' ' + Y(x.v).toFixed(1)).join(' ');
    const l = pts[pts.length - 1];
    return `<svg viewBox="0 0 ${W} ${H}" class="cd-spark"><path d="${d}" class="cd-line"/><circle cx="${X(l.t)}" cy="${Y(l.v)}" r="3.5" class="cd-dot"/></svg>`;
  }

  /* ═══ Оценка эффективности: 4 опоры, которыми тренеры оценивают прогресс ═══
     1) регулярность, 2) прогрессия силы, 3) объём нагрузки, 4) изменения тела.
     Плюс подходы на мышцу в неделю (рабочая зона 10–20) и конкретные советы. */
  const NORM = { 'Грудь': [10, 20], 'Спина': [10, 20], 'Ноги': [10, 20], 'Плечи': [8, 16], 'Руки': [6, 14], 'Кор': [4, 12] };
  function setsPerWeek(d) {
    const from = new Date(+t0() - 14 * DAY), v = {};
    d.hist.filter(h => h.date >= from).forEach(h => h.exercises.forEach(e => { const g = ((d.an.ex[e.key] || {}).cls || {}).group; if (g) v[g] = (v[g] || 0) + Math.max(1, +e.sets || 3); }));
    Object.keys(v).forEach(k => { v[k] = Math.round(v[k] / 2); });
    return v;
  }
  function report(d, c) {
    const P = [], todo = [];
    /* регулярность */
    const att = d.att;
    P.push({ k: 'att', i: 'ti-calendar-check', t: 'Регулярность', v: att == null ? '–' : att + '%', s: att == null ? 'нет тренировок в плане' : `${d.dn4} из ${d.pl4} за 4 недели`,
      st: att == null ? 'none' : att >= 80 ? 'good' : att >= 60 ? 'ok' : 'bad', w: att == null ? '' : att >= 80 ? 'отлично' : att >= 60 ? 'норма' : 'мало' });
    /* сила: лучший результат за 4 недели против лучшего раньше */
    const now = Date.now(), g = [];
    d.lifts.forEach(l => { const rec = l.pts.filter(p => now - p.t <= 28 * DAY), old = l.pts.filter(p => now - p.t > 28 * DAY && now - p.t <= 84 * DAY);
      if (rec.length && old.length) g.push((Math.max(...rec.map(p => p.v)) - Math.max(...old.map(p => p.v))) / Math.max(...old.map(p => p.v)) * 100); });
    const sg_ = g.length ? Math.round(g.reduce((a, b) => a + b, 0) / g.length * 10) / 10 : null;
    P.push({ k: 'str', i: 'ti-barbell', t: 'Сила', v: sg_ == null ? '–' : (sg_ > 0 ? '+' : '') + String(sg_).replace('.', ',') + '%', s: sg_ == null ? 'мало данных для сравнения' : 'максимум в базе за 4 недели',
      st: sg_ == null ? 'none' : sg_ > 2 ? 'good' : sg_ >= -2 ? 'ok' : 'bad', w: sg_ == null ? '' : sg_ > 2 ? 'растёт' : sg_ >= -2 ? 'держится' : 'падает' });
    /* объём: средний тоннаж последних 3 полных недель против 3 до них */
    const W = d.weeks, avg = (a) => a.reduce((s, w) => s + w.tons, 0) / a.length;
    const r3 = avg(W.slice(4, 7)), p3 = avg(W.slice(1, 4));
    const vd = p3 > 0 ? Math.round((r3 - p3) / p3 * 100) : null;
    P.push({ k: 'vol', i: 'ti-stack-2', t: 'Нагрузка', v: vd == null ? (r3 ? String(Math.round(r3 * 10) / 10).replace('.', ',') + ' т' : '–') : (vd > 0 ? '+' : '') + vd + '%', s: vd == null ? 'тонн в неделю' : `${String(Math.round(r3 * 10) / 10).replace('.', ',')} т в неделю`,
      st: vd == null ? 'none' : vd > 5 ? 'good' : vd >= -10 ? 'ok' : 'bad', w: vd == null ? '' : vd > 5 ? 'растёт' : vd >= -10 ? 'стабильно' : 'снизилась' });
    /* тело */
    const bs = window.BodyProgress ? BodyProgress.summary(c.training.measurements, 56, d.hist) : null;
    P.push({ k: 'body', i: 'ti-ruler-measure', t: 'Тело', v: bs ? (bs.waist != null ? 'талия ' + (bs.waist > 0 ? '+' : bs.waist < 0 ? '−' : '') + String(Math.abs(bs.waist)).replace('.', ',') + ' см' : bs.weight != null ? (bs.weight > 0 ? '+' : bs.weight < 0 ? '−' : '') + String(Math.abs(bs.weight)).replace('.', ',') + ' кг' : 'есть') : '–', s: bs ? (bs.main ? bs.main.t : 'без заметных изменений') : 'замеров нет',
      st: !bs ? 'none' : bs.main ? (bs.main.k === 'good' ? 'good' : 'bad') : 'ok', w: !bs ? '' : bs.main ? (bs.main.k === 'good' ? 'прогресс' : 'внимание') : 'стабильно' });
    /* советы */
    const lastDone = d.past.filter(d.isDone).pop(), idle = lastDone ? Math.floor((now - lastDone.date) / DAY) : null;
    if (idle != null && idle >= 7) todo.push({ st: 'bad', t: `Не тренировался ${idle} дней`, s: 'Напишите клиенту: чем раньше, тем проще вернуть в ритм' });
    if (att != null && att < 60 && !(idle != null && idle >= 7)) todo.push({ st: 'bad', t: 'Много пропусков', s: 'Обсудите график: реалистичный план на 3 тренировки лучше сорванного на 4' });
    if (sg_ != null && sg_ < -2) todo.push({ st: 'bad', t: 'Сила падает', s: 'Проверьте сон и питание. Возможно, пора разгрузочная неделя: −40% объёма' });
    const pl = window.TrainingInsights ? TrainingInsights._plateaus(d.an) : [];
    if (pl.length) todo.push({ st: 'ok', t: `Плато: ${pl.slice(0, 2).map(x => x.name).join(', ')}`, s: pl[0].alts && pl[0].alts.length ? `Замена на 3–4 недели: ${pl[0].alts[0]}` : 'Смените вариацию или диапазон повторов' });
    const spw = setsPerWeek(d);
    const low = Object.entries(spw).filter(([g, n]) => NORM[g] && n > 0 && n < NORM[g][0]), high = Object.entries(spw).filter(([g, n]) => NORM[g] && n > NORM[g][1] + 2);
    if (low.length) todo.push({ st: 'ok', t: `Добавить подходов: ${low.map(([g]) => g.toLowerCase()).join(', ')}`, s: 'Меньше рабочей зоны для роста, по 2–4 подхода в неделю' });
    if (high.length) todo.push({ st: 'ok', t: `Снизить объём: ${high.map(([g]) => g.toLowerCase()).join(', ')}`, s: 'Больше рабочей зоны, восстановление страдает' });
    if (bs && bs.main && bs.main.k === 'warn') todo.push({ st: 'bad', t: bs.main.t, s: bs.main.s });
    if (!bs) todo.push({ st: 'ok', t: 'Сделать замеры', s: 'Талия, грудь, руки, ноги' });
    else if (bs.since > 28) todo.push({ st: 'ok', t: 'Обновить замеры', s: `последние ${bs.since} дн. назад` });
    const good = P.filter(x => x.st === 'good').length, bad = P.filter(x => x.st === 'bad').length;
    const verdict = bad >= 2 ? { st: 'bad', t: 'Нужно вмешаться', s: 'Несколько показателей просели. Начните с первого пункта ниже' }
      : bad === 1 ? { st: 'ok', t: 'В целом хорошо, есть что подтянуть', s: 'Один показатель просел, остальное в порядке' }
      : good >= 3 ? { st: 'good', t: 'Отличный прогресс', s: 'Клиент регулярен и растёт. Самое время похвалить' }
      : { st: 'ok', t: 'Стабильно', s: 'Всё держится. Можно добавить нагрузку, чтобы был рост' };
    return { P, todo: todo.slice(0, 4), verdict, spw };
  }
  function reportHtml(r) {
    const icon = { good: 'ti-circle-check', ok: 'ti-point', bad: 'ti-alert-triangle', none: 'ti-minus' };
    return `<div class="rp rp-${r.verdict.st}"><div class="rp-v"><i class="ti ${r.verdict.st === 'good' ? 'ti-rosette-discount-check' : r.verdict.st === 'bad' ? 'ti-alert-octagon' : 'ti-activity'}"></i><div><b>${esc(r.verdict.t)}</b><span>${esc(r.verdict.s)}</span></div></div>
      <div class="rp-p">${r.P.map(x => `<div class="rp-c ${x.st}"><div class="rp-t"><i class="ti ${x.i}"></i>${esc(x.t)}</div><b class="${String(x.v).length > 7 ? 'sm' : ''}">${esc(x.v)}</b>${x.w ? `<em><i class="ti ${icon[x.st]}"></i>${esc(x.w)}</em>` : ''}<small>${esc(x.s)}</small></div>`).join('')}</div></div>
      ${r.todo.length ? `<div class="card"><div class="card-h"><div><b>Что сделать</b></div></div>
        <div class="todo">${r.todo.map((x, i) => `<div class="td ${x.st}"><span>${i + 1}</span><div><b>${esc(x.t)}</b><small>${esc(x.s)}</small></div></div>`).join('')}</div></div>` : ''}`;
  }
  function setsHtml(spw) {
    const gs = Object.keys(NORM).filter(g => spw[g]);
    if (!gs.length) return '';
    const max = Math.max(24, ...gs.map(g => spw[g]));
    return `<div class="more-b"><div class="more-t">Подходы на мышцу в неделю <span>зелёная зона: рабочий объём</span></div>
      <div class="sets">${gs.map(g => { const n = spw[g], nr = NORM[g], st = n < nr[0] ? 'low' : n > nr[1] ? 'high' : 'ok';
        return `<div class="st-r"><span class="st-n">${g}</span><div class="st-bar"><i class="st-zone" style="left:${nr[0] / max * 100}%;width:${(nr[1] - nr[0]) / max * 100}%"></i><i class="st-val ${st}" style="width:${Math.min(100, n / max * 100)}%"></i></div><b class="${st}">${n}</b></div>`; }).join('')}</div></div>`;
  }

  /* ═══ Обзор клиента ═══ */
  function dashHtml(c, d, weekly) {
    const att = d.att;
    if (!d.past.some(x => x.work) && !d.lastM) return `<div class="empty"><i class="ti ti-chart-bar"></i>Данных пока нет.<br>Составьте план во вкладке «План»: как только пройдут первые тренировки, здесь появятся посещаемость, объём и сила.</div>
      <div class="card" id="bp-card">${window.BodyProgress ? BodyProgress.html(c.training.measurements, { coach: true }) : ''}<button class="add-ex" id="bp-add" style="margin-top:10px"><i class="ti ti-plus"></i> Добавить замер</button></div>`;
    const r = report(d, c);
    const lifts = d.lifts.length ? `<div class="card"><div class="card-h"><div><b>Сила</b><span>максимум на 1 повтор</span></div></div>
      <div class="cd-lifts">${d.lifts.map(l => { const f = l.pts[0].v, la = l.pts[l.pts.length - 1].v, dl = Math.round((la - f) * 10) / 10;
        return `<div class="cd-lift"><div class="cd-lift-t"><b>${esc(l.name)}</b><span>${kg(la)} кг <em class="${dl >= 0 ? 'up' : 'down'}">${dl >= 0 ? '+' : ''}${kg(dl)}</em></span></div>${lineSvg(l.pts)}</div>`; }).join('')}</div></div>` : '';
    const comments = d.comments.length ? `<div class="more-b"><div class="more-t">Комментарии клиента</div>
      <div class="cd-feels">${d.comments.map(x => `<div class="cd-feel"><span class="cd-feel-d">${fmtD(x.date)}</span><span class="cd-feel-t">${esc(x.text)}</span></div>`).join('')}</div></div>` : '';
    return `
    ${reportHtml(r)}
    ${weekly}
    <div class="card"><div class="card-h"><div><b>Тренировки</b></div></div>
      ${attHtml(d.weeks)}</div>
    ${lifts}
    <div class="card" id="bp-card">${window.BodyProgress ? BodyProgress.html(c.training.measurements, { hist: d.hist, coach: true, compact: true, period: c._bp, main: c._bpm }) : ''}
      <button class="add-ex" id="bp-add" style="margin-top:10px"><i class="ti ti-plus"></i> Добавить замер</button></div>
    <details class="card more"><summary><b>Подробнее</b><i class="ti ti-chevron-down"></i></summary>
      <div class="more-b"><div class="more-t">Сколько поднято за неделю <span>в тоннах</span></div>${tonsHtml(d.weeks)}</div>
      ${setsHtml(r.spw)}
      ${comments}
    </details>`;
  }

  /* ═══ Итоги недели ═══ */
  function weekSummary(d) {
    const wc = window.TrainingInsights._weekCard(d.hist, d.an);
    const mon = monday(new Date()), from = new Date(+mon - WEEK);
    const wk = d.weeks.find(w => +w.from === +from) || { planned: 0, done: 0 };
    const body = window.BodyProgress ? BodyProgress.weekDelta(d.ms, from, mon) : [];
    return { body, range: fmtD(wc.from) + ' – ' + fmtD(wc.to), count: wk.done || wc.count, planned: wk.planned, tons: Math.round(wc.tL / 100) / 10, delta: wc.delta, grew: wc.grew.slice(0, 4), lag: wc.lag};
  }
  function weeklyFormHtml(s, sent) {
    return `<details class="card more" id="cw-card"${sent ? '' : ' open'}><summary><b>Итоги недели для клиента</b><span>${esc(s.range)}${sent ? ' · отправлено ' + fmtD(new Date(sent.at)) : ' · ещё не отправлено'}</span><i class="ti ti-chevron-down"></i></summary>
      <div class="cd-kpis three"><div class="cd-kpi"><b>${s.count}${s.planned ? '<small>/' + s.planned + '</small>' : ''}</b><span>${(() => { const n = s.planned || s.count, x = n % 10, y = n % 100; return x === 1 && y !== 11 ? 'тренировка' : x >= 2 && x <= 4 && (y < 12 || y > 14) ? 'тренировки' : 'тренировок'; })()}</span></div>
        <div class="cd-kpi"><b>${String(s.tons).replace('.', ',')}</b><span>тонн</span></div>
        <div class="cd-kpi"><b style="color:${s.delta == null ? 'inherit' : s.delta >= 0 ? '#4ADE80' : '#F87171'}">${s.delta == null ? '0%' : (s.delta > 0 ? '+' : s.delta < 0 ? '−' : '') + Math.abs(s.delta) + '%'}</b><span>к прошлой</span></div></div>
      ${s.grew.length ? `<div class="cd-grew">${s.grew.map(g => `<div><i class="ti ti-trending-up"></i>${esc(g)}</div>`).join('')}</div>` : ''}
      ${s.body && s.body.length ? `<div class="cd-grew body">${s.body.map(g => `<div><i class="ti ti-ruler-measure"></i>${esc(g)}</div>`).join('')}</div>` : ''}
      <textarea class="field" id="cw-text" placeholder="Ваш комментарий: что получилось, на что обратить внимание на следующей неделе">${esc(sent && sent.text || '')}</textarea>
      <div class="inv-btns" style="margin-top:4px"><button class="btn btn-main btn-sm" id="cw-send"><i class="ti ti-send"></i> Отправить в приложение</button>
        <button class="btn btn-ghost btn-sm" id="cw-img"><i class="ti ti-photo"></i> Картинкой</button></div>
      <div class="faint" style="font-size:11.5px;margin-top:8px">Клиент увидит карточку в «Тренировках». Картинку можно переслать в мессенджер.</div></details>`;
  }
  async function weeklyImage(s, text, trainer, client) {
    const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    try { await Promise.all(['900', '800', '600', '500'].map(w => document.fonts.load(`${w} 40px Montserrat`, 'Итоги недели АБВ'))); } catch (e) {}
    const F = (w, sz) => `${w} ${sz}px Montserrat, sans-serif`;
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#101830'); bg.addColorStop(1, '#0A0D18'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W * .85, 80, 10, W * .85, 80, 700); glow.addColorStop(0, 'rgba(74,124,255,.45)'); glow.addColorStop(1, 'rgba(74,124,255,0)'); g.fillStyle = glow; g.fillRect(0, 0, W, H);
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    g.fillStyle = '#A5B4FC'; g.font = F(700, 34); g.fillText('ИТОГИ НЕДЕЛИ · ' + s.range, 80, 130);
    g.fillStyle = '#fff'; g.font = F(900, 76); g.fillText(client.slice(0, 22), 80, 230);
    g.fillStyle = '#8B93AD'; g.font = F(500, 34); g.fillText('Тренер: ' + trainer.slice(0, 30), 80, 290);
    const k = [[s.count + (s.planned ? '/' + s.planned : ''), 'тренировок'], [String(s.tons).replace('.', ','), 'тонн'], [s.delta == null ? '–' : (s.delta > 0 ? '+' : '') + s.delta + '%', 'к прошлой']];
    k.forEach((x, i) => { const bx = 80 + i * 314; g.fillStyle = 'rgba(110,148,255,.13)'; rr(bx, 350, 290, 190, 32); g.fill();
      g.fillStyle = '#fff'; g.font = F(900, 70); g.fillText(x[0], bx + 32, 460); g.fillStyle = '#A5B4FC'; g.font = F(600, 30); g.fillText(x[1], bx + 32, 510); });
    let y = 620;
    if (s.grew.length) { g.fillStyle = '#86EFAC'; g.font = F(800, 34); g.fillText('Выросло', 80, y); y += 56;
      g.font = F(600, 32); s.grew.slice(0, 4).forEach(t => { g.fillStyle = '#E5E7EB'; g.fillText('↑ ' + t.slice(0, 44), 80, y); y += 50; }); y += 20; }
    if (s.body && s.body.length) { g.fillStyle = '#67E8F9'; g.font = F(800, 34); g.fillText('Тело', 80, y); y += 56;
      g.font = F(600, 32); s.body.slice(0, 3).forEach(t => { g.fillStyle = '#E5E7EB'; g.fillText(t.replace('−', '-'), 80, y); y += 50; }); y += 20; }
    if (text) { g.fillStyle = 'rgba(255,255,255,.06)'; const lines = wrap(g, text, W - 220, F(500, 34)); const bh = Math.min(8, lines.length) * 50 + 70; rr(80, y, W - 160, bh, 30); g.fill();
      g.fillStyle = '#E0E7FF'; g.font = F(500, 34); lines.slice(0, 8).forEach((l, i) => g.fillText(l, 118, y + 64 + i * 50)); }
    g.fillStyle = '#6F7C9E'; g.font = F(700, 30); g.fillText('YOU · приложение для тренировок', 80, H - 70);
    return new Promise(r => cv.toBlob(r, 'image/png'));
  }
  function wrap(g, text, maxW, font) {
    g.font = font; const out = [];
    String(text).split(/\n/).forEach(par => { let line = ''; par.split(/\s+/).forEach(w => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }); out.push(line); });
    return out;
  }

  /* ═══ Шаблоны программ ═══ */
  function templateFrom(plan, name) {
    const weeks = toArr(plan.weeks).map(w => ({ days: toArr(w && w.days).map(d => { if (typeof trMigrateDayToSessions === 'function') trMigrateDayToSessions(d);
      return { dow: d.dow, note: d.coachNote || null, sessions: toArr(d.sessions).filter(Boolean).map(s => ({ type: s.type, groups: toArr(s.groups), exercises: toArr(s.exercises).filter(Boolean).map(e => {
        const x = { kind: e.kind || 'strength', name: e.name }; ['sets', 'reps', 'weight', 'distance', 'duration', 'steps'].forEach(k => { if (e[k] != null && e[k] !== '') x[k] = e[k]; }); return x; }) })) }; }) }));
    /* обрезаем пустые недели в конце */
    while (weeks.length && !weeks[weeks.length - 1].days.some(d => d.sessions.length)) weeks.pop();
    const sess = weeks.reduce((s, w) => s + w.days.reduce((a, d) => a + d.sessions.filter(x => x.type !== 'Отдых').length, 0), 0);
    return { name: String(name).slice(0, 60), weeks, weeksCount: weeks.length, sessions: sess, createdAt: Date.now() };
  }
  /* Веса клиента: последний рабочий вес по упражнению (ключ названия) */
  function clientWeights(d) {
    const out = {}; Object.values(d.an.ex).forEach(x => { const h = toArr(x.hist).filter(r => r.weight > 0); if (h.length) out[x.key] = h[h.length - 1].weight; }); return out;
  }
  /* «Жим штанга» и «Жим штанги лёжа» — одно упражнение: ищем единственный ключ, где есть все слова */
  function weightFor(weights, k) {
    if (weights[k]) return weights[k];
    const t = k.split(' '); const sup = Object.keys(weights).filter(o => t.every(x => o.split(' ').includes(x)));
    return sup.length === 1 ? weights[sup[0]] : null;
  }
  function applyTemplate(tpl, start, weights, keepTplWeights) {
    const DOWS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
    const T = toArr(tpl.weeks);
    /* первый вес каждого упражнения в шаблоне: база для пропорции */
    const base = {}; T.forEach(w => toArr(w.days).forEach(d => toArr(d.sessions).forEach(s => toArr(s.exercises).forEach(e => { const k = A().exKey(e.name); if (e.weight > 0 && base[k] == null) base[k] = +e.weight; }))));
    let fromClient = 0, empty = 0;
    const nWeeks = Math.max(8, T.length), weeks = [];
    for (let wi = 0; wi < nWeeks; wi++) {
      const tw = T[wi], days = [];
      for (let di = 0; di < 7; di++) {
        const dt = new Date(start); dt.setDate(start.getDate() + wi * 7 + di);
        const td = tw ? toArr(tw.days).find(x => String(x.dow || '').slice(0, 2) === DOWS[di]) || toArr(tw.days)[di] : null;
        const day = { date: fmtD(dt), dow: DOWS[di], sessions: [] };
        if (td) {
          if (td.note) day.coachNote = td.note;
          day.sessions = toArr(td.sessions).map(s => ({ type: s.type, groups: toArr(s.groups), byCoach: true, exercises: toArr(s.exercises).map(e => {
            const x = JSON.parse(JSON.stringify(e)); if (!(x.kind === 'strength' || !x.kind) || !(+e.weight > 0)) return x;
            const k = A().exKey(e.name), cw = weightFor(weights, k);
            if (cw) { const step = A().stepFor(e.name), ratio = base[k] ? +e.weight / base[k] : 1; x.weight = Math.max(step, Math.round(cw * ratio / step) * step); fromClient++; }
            else if (!keepTplWeights) { x.weight = 0; empty++; }
            return x; }) }));
        }
        days.push(day);
      }
      const b = new Date(start); b.setDate(start.getDate() + wi * 7 + 6);
      weeks.push({ weekNum: wi + 1, range: fmtD(new Date(+start + wi * WEEK)) + ' – ' + fmtD(b), days });
    }
    return { weeks, fromClient, empty };
  }

  return { sig, analyze, feed, feedHtml, dashHtml, weekSummary, weeklyFormHtml, weeklyImage, templateFrom, applyTemplate, clientWeights, monday, fmtD, esc, toArr };
})();
