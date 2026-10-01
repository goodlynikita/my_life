/* ============================================================
   РАЗБОР — вкладка «AI» → «Разбор»
   • Карточка недели: тренировки, тоннаж, что выросло, что отстаёт, фокус
   • Баланс нагрузки: подходы на мышцу в неделю против нормы
   • Рекорды и прогноз: 1ПМ базовых упражнений, личные рекорды, когда цель
   • Плато: 3 раза без роста → замена на родственное упражнение
   • Шеринг: картинка «мой прогресс за 8 недель» для сторис
   ============================================================ */
window.TrainingInsights = (function () {
  const T = () => window.TrainingAI;
  const DAY = 864e5, WEEK = 7 * DAY;
  const NORM = { 'Грудь': [10, 20], 'Спина': [10, 20], 'Ноги': [10, 20], 'Плечи': [8, 16], 'Руки': [6, 14], 'Кор': [4, 12] };
  const GCOL = { 'Грудь': '#7FB36E', 'Спина': '#6C95C8', 'Ноги': '#CF9A5E', 'Плечи': '#C47FA0', 'Руки': '#9D8AD8', 'Кор': '#5FB8B0' };
  const e1 = (r) => r && r.weight > 0 && r.reps > 0 ? r.weight * (1 + r.reps / 30) : 0;
  const kg = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');
  const ton = (n) => n >= 1000 ? (Math.round(n / 100) / 10).toString().replace('.', ',') + ' т' : Math.round(n) + ' кг';
  const pl = (n, a, b, c) => { const x = n % 10, y = n % 100; return x === 1 && y !== 11 ? a : x >= 2 && x <= 4 && (y < 12 || y > 14) ? b : c; };
  function monday(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }

  function data(plan, h) {
    const A = T();
    const plans = A.chosenPlans(h.getPlans()).on.map(x => x.p);
    const history = A.collect(plans);
    const an = A.analyze(history, A.prefsGet());
    return { history, an };
  }
  const tonnage = (list) => list.reduce((s, x) => s + x.exercises.reduce((t, e) => t + (+e.sets || 0) * (+e.reps || 0) * (+e.weight || 0), 0), 0);
  function setsByGroup(list, an) {
    const v = {};
    list.forEach(x => x.exercises.forEach(e => { const g = ((an.ex[e.key] || {}).cls || {}).group; if (g) v[g] = (v[g] || 0) + Math.max(1, +e.sets || 3); }));
    return v;
  }

  /* ── Плато ── */
  function plateaus(an) {
    const A = T(), out = [];
    Object.values(an.ex).forEach(x => {
      const h = A.toArr(x.hist).filter(r => r.weight > 0);
      if (h.length < 3 || !x.cls || x.cls.group === 'Кор') return;
      const last3 = h.slice(-3), before = h.slice(0, -3);
      if (Date.now() - last3[0].date > 8 * WEEK) return; /* давно не делал */
      if (last3[2].date - last3[0].date < 10 * DAY) return;
      const b3 = Math.max(...last3.map(e1)), bb = before.length ? Math.max(...before.map(e1)) : 0;
      const flat = before.length ? b3 <= bb * 1.005 : (e1(last3[2]) <= e1(last3[0]) * 1.005);
      if (!flat || e1(last3[2]) > e1(last3[0]) * 1.005) return;
      /* замены: сначала твои упражнения на ту же зону, потом база */
      /* упражнения, которые уже делаешь вместе с этим, в замену не предлагаем */
      const together = new Set(an.combos.flatMap(c => c.sessions).filter(ss => ss.exercises.some(e => e.key === x.key)).flatMap(ss => ss.exercises.map(e => e.key)));
      const mine = Object.values(an.ex).filter(o => !together.has(o.key) && o.cls && o.cls.group === x.cls.group && o.cls.region === x.cls.region).map(o => o.name);
      const base = (A.SLOTS[x.cls.group] || []).filter(sl => sl.region === x.cls.region).flatMap(sl => sl.fb).filter(n => !together.has(A.exKey(n)));
      const alts = [...new Set([...mine, ...base])].slice(0, 2);
      out.push({ key: x.key, name: x.name, group: x.cls.group, region: x.cls.region, seq: last3.map(r => kg(r.weight) + '×' + r.reps).join(' → '), alts });
    });
    return out;
  }

  /* ── Рекорды и прогноз ── */
  function records(an, prefs) {
    const A = T(), out = [];
    Object.values(an.ex).forEach(x => {
      const h = A.toArr(x.hist).filter(r => r.weight > 0 && r.reps > 0);
      if (!x.cls || x.cls.kind !== 'comp' || h.length < 2) return;
      const pts = h.map(r => ({ t: (r.date - h[0].date) / WEEK, y: e1(r) }));
      const n = pts.length, mt = pts.reduce((s, p) => s + p.t, 0) / n, my = pts.reduce((s, p) => s + p.y, 0) / n;
      const den = pts.reduce((s, p) => s + (p.t - mt) ** 2, 0);
      const slope = den > 0 ? pts.reduce((s, p) => s + (p.t - mt) * (p.y - my), 0) / den : 0;
      const best = Math.max(...pts.map(p => p.y)), last = pts[n - 1].y;
      const prevBest = Math.max(...pts.slice(0, -1).map(p => p.y));
      const pr = last >= best - 0.01 && last > prevBest + 0.01;
      const target = (prefs.targets || {})[x.key] || Math.ceil((best + 0.5) / 10) * 10;
      const weeks = slope > 0.15 ? Math.ceil((target - best) / slope) : null;
      out.push({ key: x.key, name: x.name, group: x.cls.group, best, last, pr, slope, target, weeks, first: pts[0].y });
    });
    return out.sort((a, b) => b.best - a.best).slice(0, 8);
  }

  /* ── Карточка недели ── */
  function weekCard(history, an) {
    let mon = monday(new Date()), lastStart = +mon - WEEK, prevStart = +mon - 2 * WEEK, cur = false;
    /* прошлая неделя пустая, а на этой уже тренировки: показываем эту */
    if (!history.some(x => +x.date >= lastStart && +x.date < +mon) && history.some(x => +x.date >= +mon)) { cur = true; prevStart = lastStart; lastStart = +mon; mon = new Date(+mon + WEEK); }
    const L = history.filter(x => +x.date >= lastStart && +x.date < +mon), P = history.filter(x => +x.date >= prevStart && +x.date < lastStart);
    const before = history.filter(x => +x.date < lastStart);
    const tL = tonnage(L), tP = tonnage(P);
    const grew = [];
    const maxW = (list, key) => Math.max(0, ...list.flatMap(x => x.exercises.filter(e => e.key === key).map(e => +e.weight || 0)));
    [...new Set(L.flatMap(x => x.exercises.map(e => e.key)))].forEach(k => {
      const a = maxW(L, k), b = maxW(before, k);
      if (a > 0 && b > 0 && a > b) grew.push(`${(an.ex[k] || {}).name || k}: ${kg(b)} → ${kg(a)} кг`);
    });
    const sets = setsByGroup(L, an);
    const trained = new Set(Object.values(an.ex).map(x => x.cls && x.cls.group).filter(Boolean));
    const lag = [...trained].filter(g => NORM[g] && (sets[g] || 0) < NORM[g][0]).map(g => `${g}: ${sets[g] || 0} подх.`);
    return { cur, from: new Date(lastStart), to: new Date(+mon - DAY), count: L.length, tL, tP, delta: tP ? Math.round((tL - tP) / tP * 100) : null, grew, lag };
  }

  /* ── Экран ── */
  function render(content, plan, h, tabsHtml, bindTabs) {
    const A = T(), esc = A.esc;
    const { history, an } = data(plan, h);
    const prefs = A.prefsGet();
    if (!history.length) {
      content.innerHTML = `<div class="ai-wrap">${tabsHtml}<div class="ai-hero"><div class="ai-hero-ico"><i class="ti ti-chart-dots"></i></div><div class="ai-hero-t">Разбор появится после первых тренировок</div><div class="ai-hero-d">Записывай упражнения с весами, и здесь будут итоги недели, рекорды, баланс нагрузки и советы.</div></div></div>`;
      bindTabs && bindTabs(); return;
    }
    const wc = weekCard(history, an);
    const pls = plateaus(an);
    const recs = records(an, prefs);
    /* баланс за последние 14 дней */
    const since = Date.now() - 14 * DAY;
    const recent = history.filter(x => +x.date >= since);
    const wks = Math.max(1, new Set(recent.map(x => A.weekKey(x.date))).size);
    const sets = setsByGroup(recent, an);
    const groups = Object.keys(NORM).filter(g => sets[g] || Object.values(an.ex).some(x => x.cls && x.cls.group === g));
    const isMon = new Date().getDay() === 1;
    const fmtD = d => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const few = history.length < 3;
    wc.lag = few ? [] : Object.keys(NORM).filter(g => groups.includes(g) && Math.round((sets[g] || 0) / wks) < NORM[g][0]).map(g => `${g}: ${Math.round((sets[g] || 0) / wks)} подх. в неделю`);
    const focus = few ? 'Записать 2–3 тренировки, и я покажу, что подтянуть' : pls[0] ? `Сменить стимул в «${pls[0].name}»: оно стоит на месте` : wc.lag[0] ? `Добавить подходов на ${wc.lag[0].split(':')[0].toLowerCase()}: пока меньше нормы` : wc.count ? 'Держать темп и добирать повторы до верха диапазона' : 'Вернуться в режим: хотя бы 2 тренировки';

    content.innerHTML = `<div class="ai-wrap">${tabsHtml}
      <div class="in-card in-week">
        <div class="in-h"><div><b>${wc.cur ? 'Эта неделя' : 'Итоги недели'}</b><span>${fmtD(wc.from)} – ${fmtD(wc.to)}</span></div>${isMon ? '<em class="in-new">новый отчёт</em>' : ''}</div>
        <div class="in-kpis">
          <div><b>${wc.count}</b><span>${pl(wc.count, 'тренировка', 'тренировки', 'тренировок')}</span></div>
          <div><b>${ton(wc.tL)}</b><span>тоннаж</span></div>
          <div><b class="${wc.delta > 0 ? 'up' : wc.delta < 0 ? 'down' : ''}">${wc.delta == null ? '–' : (wc.delta > 0 ? '+' : '') + wc.delta + '%'}</b><span>к прошлой</span></div>
        </div>
        ${wc.grew.length ? `<div class="in-row"><i class="ti ti-trending-up up"></i><div><b>Выросло</b><span>${wc.grew.slice(0, 4).map(esc).join('<br>')}</span></div></div>` : ''}
        ${wc.lag.length ? `<div class="in-row"><i class="ti ti-alert-triangle warn"></i><div><b>Отстаёт</b><span>${wc.lag.slice(0, 3).map(esc).join(' · ')}</span></div></div>` : ''}
        <div class="in-row in-focus"><i class="ti ti-target-arrow"></i><div><b>Фокус на неделю</b><span>${esc(focus)}</span></div></div>
      </div>

      <div class="in-card">
        <div class="in-h"><div><b>Баланс нагрузки</b><span>подходов на мышцу в неделю, за 2 недели</span></div></div>
        ${groups.map(g => {
          const v = Math.round((sets[g] || 0) / wks), [lo, hi] = NORM[g], max = hi * 1.4;
          const st = v < lo ? 'low' : v > hi ? 'high' : 'ok';
          const msg = st === 'low' ? `мало, нужно ${lo}–${hi}` : st === 'high' ? `перебор, норма ${lo}–${hi}` : 'в норме';
          return `<div class="in-bal"><div class="in-bal-t"><span><i style="background:${GCOL[g]}"></i>${g}</span><b class="${st}">${v} · ${msg}</b></div>
            <div class="in-bar"><div class="in-zone" style="left:${lo / max * 100}%;width:${(hi - lo) / max * 100}%"></div><div class="in-fill ${st}" style="width:${Math.min(100, v / max * 100)}%"></div></div></div>`;
        }).join('')}
      </div>

      ${recs.length ? `<div class="in-card">
        <div class="in-h"><div><b>Рекорды и прогноз</b><span>1ПМ, расчётный максимум на один раз</span></div></div>
        ${recs.map(r => `<div class="in-rec" data-k="${esc(r.key)}">
          <div class="in-rec-l"><b>${esc(r.name)}${r.pr ? '<em class="in-pr">рекорд</em>' : ''}</b><span>${r.slope > 0.15 ? `+${kg(r.slope)} кг в неделю` : r.slope < -0.15 ? 'снижается' : 'без роста'}${r.weeks ? ` · до ${r.target} кг ≈ ${r.weeks} ${pl(r.weeks, 'неделя', 'недели', 'недель')}` : r.best >= r.target ? ` · цель ${r.target} кг взята` : ` · цель ${r.target} кг`}</span></div>
          <div class="in-rec-r"><b>${kg(r.best)}</b><span>кг</span></div>
          <button class="in-goal" data-k="${esc(r.key)}" data-t="${r.target}" title="Своя цель"><i class="ti ti-flag"></i></button>
        </div>`).join('')}
      </div>` : ''}

      <div class="in-card">
        <div class="in-h"><div><b>Плато</b><span>3 тренировки подряд без роста</span></div></div>
        ${pls.length ? pls.slice(0, 3).map(p => {
          const sw = (prefs.swaps || {})[p.key];
          return `<div class="in-pl">
            <div class="in-pl-t"><b>${esc(p.name)}</b><span>${esc(p.seq)}</span></div>
            <div class="in-pl-why">Мышца привыкла к нагрузке. Смени снаряд или угол на 3–4 недели, потом вернись: вес снова пойдёт.</div>
            ${sw ? `<div class="in-pl-done"><i class="ti ti-check"></i> В AI-плане заменено на «${esc(sw)}» <button class="in-undo" data-k="${esc(p.key)}">вернуть</button></div>`
              : `<div class="in-alts">${p.alts.map(a => `<button class="in-alt" data-k="${esc(p.key)}" data-to="${esc(a)}"><i class="ti ti-arrows-exchange"></i> ${esc(a)}</button>`).join('')}</div>`}
          </div>`;
        }).join('') : few ? '<div class="in-ok"><i class="ti ti-info-circle"></i> Пока мало тренировок, чтобы судить</div>' : '<div class="in-ok"><i class="ti ti-circle-check"></i> Плато нет, всё растёт</div>'}
      </div>

      <button class="in-share" id="in-share"><i class="ti ti-share"></i> Поделиться прогрессом за 8 недель</button>
    </div>`;
    bindTabs && bindTabs();

    const again = () => render(content, plan, h, tabsHtml, bindTabs);
    const regen = (p2) => {
      Store.set('training.aiPrefs', p2);
      const ai = A.load();
      if (ai && ai.planId === plan.id) {
        A.regenKeep(A.chosenPlans(h.getPlans()).on.map(x => x.p), plan, p2);
      }
    };
    content.querySelectorAll('.in-alt').forEach(b => b.addEventListener('click', () => {
      const p2 = { ...prefs, swaps: { ...(prefs.swaps || {}), [b.dataset.k]: b.dataset.to } };
      regen(p2); again();
    }));
    content.querySelectorAll('.in-undo').forEach(b => b.addEventListener('click', () => {
      const sw = { ...(prefs.swaps || {}) }; delete sw[b.dataset.k]; regen({ ...prefs, swaps: sw }); again();
    }));
    content.querySelectorAll('.in-goal').forEach(b => b.addEventListener('click', () => {
      const v = prompt('Цель по 1ПМ, кг', b.dataset.t); const n = parseFloat(String(v || '').replace(',', '.'));
      if (!n || n <= 0) return;
      Store.set('training.aiPrefs', { ...prefs, targets: { ...(prefs.targets || {}), [b.dataset.k]: n } }); again();
    }));
    content.querySelector('#in-share').addEventListener('click', () => share(history, an, plan));
  }

  /* ── Картинка для сторис 1080×1920 ── */
  async function share(history, an, plan) {
    const A = T();
    const now = Date.now(), from = now - 8 * WEEK;
    const win = history.filter(x => +x.date >= from);
    if (!win.length) { alert('За последние 8 недель нет тренировок'); return; }
    const mon = monday(new Date());
    const weeks = Array.from({ length: 8 }, (_, i) => { const s = +mon - (7 - i) * WEEK; return tonnage(win.filter(x => +x.date >= s && +x.date < s + WEEK)); });
    const growth = [];
    [...new Set(win.flatMap(x => x.exercises.map(e => e.key)))].forEach(k => {
      const recs = win.flatMap(x => x.exercises.filter(e => e.key === k && +e.weight > 0).map(e => +e.weight));
      if (recs.length < 2) return;
      const a = recs[0], b = Math.max(...recs.slice(1));
      if (b > a) growth.push({ name: (an.ex[k] || {}).name || k, a, b, pct: Math.round((b - a) / a * 100) });
    });
    growth.sort((x, y) => y.pct - x.pct);
    let prs = 0;
    Object.values(an.ex).forEach(x => { const hh = A.toArr(x.hist).filter(r => r.weight > 0); if (hh.length < 2) return;
      const best = Math.max(...hh.map(e1)); const bestBefore = Math.max(0, ...hh.filter(r => +r.date < from).map(e1));
      if (bestBefore && best > bestBefore && hh.some(r => +r.date >= from && e1(r) === best)) prs++; });

    const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    try { const tx = 'Мой прогресс за 8 недель тренировок YOU 0123456789'; await Promise.all(['900 80px', '800 40px', '700 34px', '600 30px'].map(f => document.fonts.load(f + ' Montserrat', tx))); } catch (e) {}
    const F = (w, s) => `${w} ${s}px Montserrat, -apple-system, sans-serif`;
    /* фон */
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0B1024'); bg.addColorStop(.55, '#1A1440'); bg.addColorStop(1, '#2A0F3A'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const glow = (x, y, r, col) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
    glow(160, 220, 620, 'rgba(74,124,255,0.35)'); glow(980, 900, 700, 'rgba(139,92,246,0.30)'); glow(300, 1800, 600, 'rgba(236,72,153,0.20)');
    /* логотип */
    const icon = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'icon.png'; });
    if (icon) { g.save(); rr(g, 80, 110, 96, 96, 26); g.clip(); g.drawImage(icon, 80, 110, 96, 96); g.restore(); }
    g.fillStyle = '#fff'; g.font = F(900, 50); g.fillText('YOU', 200, 175);
    /* заголовок */
    g.font = F(900, 108); g.fillText('Мой прогресс', 80, 390);
    const tg = g.createLinearGradient(80, 0, 900, 0); tg.addColorStop(0, '#6E94FF'); tg.addColorStop(.6, '#A78BFA'); tg.addColorStop(1, '#F472B6');
    g.fillStyle = tg; g.fillText('за 8 недель', 80, 515);
    /* показатели */
    const kp = [[String(win.length), pl(win.length, 'тренировка', 'тренировки', 'тренировок')], [ton(tonnage(win)), 'поднято'], [String(prs), pl(prs, 'рекорд', 'рекорда', 'рекордов')]];
    kp.forEach((k, i) => { const x = 80 + i * 315; g.fillStyle = 'rgba(255,255,255,0.07)'; rr(g, x, 590, 290, 190, 32); g.fill();
      g.fillStyle = '#fff'; g.font = F(900, k[0].length > 6 ? 58 : 72); g.fillText(k[0], x + 30, 690); g.fillStyle = '#AEB6D4'; g.font = F(600, 32); g.fillText(k[1], x + 30, 745); });
    /* график тоннажа */
    g.fillStyle = '#fff'; g.font = F(800, 40); g.fillText('Тоннаж по неделям', 80, 880);
    const mx = Math.max(1, ...weeks), bx = 80, bw = 920, bh = 300, by = 920;
    weeks.forEach((v, i) => { const w = bw / 8 - 22, x = bx + i * (bw / 8), hh = Math.max(8, v / mx * bh);
      const gr = g.createLinearGradient(0, by + bh - hh, 0, by + bh); gr.addColorStop(0, '#8B7BFF'); gr.addColorStop(1, '#4A7CFF');
      g.fillStyle = v ? gr : 'rgba(255,255,255,0.08)'; rr(g, x, by + bh - hh, w, hh, 16); g.fill();
      g.fillStyle = '#7E88A8'; g.font = F(600, 26); g.fillText('н' + (i + 1), x + w / 2 - 18, by + bh + 42); });
    /* рост */
    g.fillStyle = '#fff'; g.font = F(800, 40); g.fillText('Рост в упражнениях', 80, 1335);
    (growth.length ? growth.slice(0, 4) : [{ name: 'Стабильная работа', a: 0, b: 0, pct: 0 }]).forEach((r, i) => {
      const y = 1370 + i * 100; g.fillStyle = 'rgba(255,255,255,0.06)'; rr(g, 80, y, 920, 84, 24); g.fill();
      g.fillStyle = '#E8ECF8'; g.font = F(700, 34); g.fillText(clip(g, r.name, 470), 112, y + 54);
      if (r.b) { g.fillStyle = '#AEB6D4'; g.font = F(600, 30); const t = `${kg(r.a)} → ${kg(r.b)} кг`; g.fillText(t, 850 - g.measureText(t).width, y + 54);
        g.fillStyle = '#4ADE80'; g.font = F(900, 36); const p = '+' + r.pct + '%'; g.fillText(p, 968 - g.measureText(p).width, y + 54); }
    });
    g.fillStyle = '#8A93B3'; g.font = F(600, 28); g.fillText('Тренировки, привычки и деньги в одном месте', 80, 1868);
    g.fillStyle = '#A5B4FF'; g.font = F(800, 30); const url = 'you-app.ru'; g.fillText(url, 80, 1822);

    c.toBlob(blob => showShare(blob), 'image/png');
  }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function clip(g, t, w) { if (g.measureText(t).width <= w) return t; while (t.length > 3 && g.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; }

  function showShare(blob) {
    const url = URL.createObjectURL(blob);
    const file = new File([blob], 'you-progress.png', { type: 'image/png' });
    const canShare = navigator.canShare && navigator.canShare({ files: [file] });
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay in-share-ov';
    ov.innerHTML = `<div class="in-share-box"><img src="${url}" alt="Мой прогресс"><div class="in-share-btns">
      ${canShare ? '<button class="in-sb main" id="sh-go"><i class="ti ti-share"></i> Поделиться</button>' : ''}
      <a class="in-sb ${canShare ? '' : 'main'}" href="${url}" download="you-progress.png"><i class="ti ti-download"></i> Скачать</a>
      <button class="in-sb" id="sh-x">Закрыть</button></div></div>`;
    document.body.appendChild(ov);
    const close = () => { ov.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('#sh-x').onclick = close;
    const go = ov.querySelector('#sh-go');
    if (go) go.onclick = () => navigator.share({ files: [file], title: 'Мой прогресс в YOU' }).catch(() => {});
  }

  return { render, _weekCard: weekCard, _plateaus: plateaus, _records: records };
})();
