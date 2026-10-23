/* ============================================================
   ИГРОВОЙ РЕЖИМ (пока только владелец)
   Очки считаются сами из того, что уже записано во всех разделах:
   тренировки → Сила, привычки → Дисциплина, финансы → Капитал,
   задачи → Фокус, цели → Воля. Штрафов нет.
   Store → game = { on, sex: 'm'|'f', qn: 2|3|5, rest: [0..6], vacs: [{from,to}],
                    quests: { 'YYYY-MM-DD': { ids:[], done:{id:true}, xp:{id:n} } }, seenLvl }
   ============================================================ */
window.Game = (function () {
  const OWNER = () => { try { const u = window.FirebaseSync && FirebaseSync.currentUser && FirebaseSync.currentUser(); const o = (window.AUTH_CONFIG || {}).ownerEmail; return !!(u && o && (u.email || '').toLowerCase() === o.toLowerCase()); } catch (e) { return false; } };
  const toArr = (v) => Array.isArray(v) ? v.filter(x => x != null) : (v && typeof v === 'object' ? Object.values(v).filter(x => x != null) : []);
  const p2 = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  const fromYmd = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const pl = (n, a, b, c) => { const x = Math.abs(n) % 10, y = Math.abs(n) % 100; return x === 1 && y !== 11 ? a : x >= 2 && x <= 4 && (y < 12 || y > 14) ? b : c; };

  const SK = {
    str: { name: 'Сила', src: 'тренировки', color: '#5B8CFF', ico: 'ti-barbell', route: '/training' },
    dis: { name: 'Дисциплина', src: 'привычки', color: '#22C55E', ico: 'ti-checks', route: '/habits' },
    cap: { name: 'Капитал', src: 'финансы', color: '#A78BFA', ico: 'ti-coin', route: '/finance' },
    foc: { name: 'Фокус', src: 'задачи', color: '#F2B544', ico: 'ti-target', route: '/tasks' },
    wil: { name: 'Воля', src: 'цели', color: '#F472B6', ico: 'ti-flag-3', route: '/goals' },
  };
  const SKO = ['str', 'dis', 'cap', 'foc', 'wil'];
  const TITLES = [[1, 'Новичок'], [10, 'Боец'], [20, 'Воин'], [35, 'Чемпион'], [50, 'Легенда']];

  function cfg() { const g = (Store.get() || {}).game || {}; return { on: g.on !== false, sex: g.sex === 'f' ? 'f' : 'm', qn: [2, 3, 5].includes(+g.qn) ? +g.qn : 3, rest: toArr(g.rest).map(Number).filter(n => n >= 0 && n <= 6), vacs: toArr(g.vacs).filter(v => v && v.from), quests: (g.quests && typeof g.quests === 'object') ? g.quests : {}, seenLvl: +g.seenLvl || 0 }; }
  const avail = () => OWNER();
  const on = () => avail() && cfg().on;

  /* ── Уровни ── */
  const cum = (L) => (L - 1) * 100 + 10 * (L - 1) * L; /* XP, нужный для уровня L */
  function levelOf(xp) { let L = 1; while (cum(L + 1) <= xp && L < 200) L++; return { lvl: L, from: cum(L), to: cum(L + 1), into: xp - cum(L), need: cum(L + 1) - cum(L) }; }
  const titleOf = (L) => { let t = TITLES[0]; TITLES.forEach(x => { if (L >= x[0]) t = x; }); return t[1]; };
  const stageOf = (L) => { let s = 0; TITLES.forEach((x, i) => { if (L >= x[0]) s = i; }); return s; };
  const nextStage = (L) => TITLES.find(x => x[0] > L) || null;
  const skillLvl = (xp) => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 40));
  const skillInto = (xp) => { const l = skillLvl(xp), a = 40 * (l - 1) * (l - 1), b = 40 * l * l; return (xp - a) / (b - a); };

  /* ── События из данных: { day, sk, xp, t } ── */
  function events() {
    const S = Store.get() || {}, out = [], today = ymd(new Date());
    const add = (day, sk, xp, t) => { if (day && day <= today && xp > 0) out.push({ day, sk, xp, t }); };
    /* тренировки */
    const plans = toArr((S.training || {}).plans);
    const str = [];
    plans.forEach(p => toArr(p && p.weeks).forEach(w => toArr(w && w.days).forEach(d => {
      if (!d) return; const dt = typeof trDayDateOf === 'function' ? trDayDateOf(p, d.date) : null; if (!dt) return; const day = ymd(dt); if (day > today) return;
      toArr(d.sessions).forEach(s => { const ex = toArr(s && s.exercises);
        const st = ex.filter(e => e.kind === 'strength' && ((+e.weight || 0) > 0 || (+e.reps || 0) > 0));
        const ca = ex.filter(e => (e.kind === 'cardio' && ((+e.distance || 0) > 0 || (+e.duration || 0) > 0)) || (e.kind === 'time_calorie' && ((+e.duration || 0) > 0 || (+e.calories || 0) > 0)));
        const steps = ex.some(e => e.kind === 'steps' && (+e.steps || 0) > 0);
        if (st.length) { add(day, 'str', 60, 'Тренировка'); st.forEach(e => str.push({ day, e })); }
        else if (ca.length) add(day, 'str', 45, ca[0].name || 'Активность');
        else if (steps) add(day, 'str', 10, 'Шаги');
      });
    })));
    /* рекорды: вес выше прежнего максимума по этому упражнению */
    str.sort((a, b) => a.day < b.day ? -1 : a.day > b.day ? 1 : 0);
    const best = {}, prDay = {};
    str.forEach(({ day, e }) => { const k = typeof trFamKey === 'function' ? trFamKey(e.name) : String(e.name).toLowerCase(); const w = +e.weight || 0; if (!w) return;
      if (best[k] && w > best[k] && (prDay[day] || 0) < 2) { add(day, 'str', 40, 'Рекорд: ' + e.name + ' ' + String(w).replace('.', ',') + ' кг'); prDay[day] = (prDay[day] || 0) + 1; }
      best[k] = Math.max(best[k] || 0, w); });
    /* замеры */
    toArr((S.training || {}).measurements).forEach(m => { const [dd, mm, yy] = String(m.date || '').split('.').map(Number); if (yy) add(yy + '-' + p2(mm) + '-' + p2(dd), 'str', 30, 'Замер тела'); });
    /* привычки */
    const H = S.habits || {}, hl = toArr(H.list).length;
    Object.keys(H.months || {}).forEach(ym => { const per = {};
      Object.values(H.months[ym] || {}).forEach(days => Object.keys(days || {}).forEach(d => { if (days[d] === 'done') per[d] = (per[d] || 0) + 1; }));
      Object.keys(per).forEach(d => { const day = ym + '-' + p2(+d); add(day, 'dis', Math.min(80, per[d] * 8), 'Привычки: ' + per[d]); if (hl && per[d] * 2 > hl) add(day, 'dis', 20, 'День привычек засчитан'); }); });
    /* задачи */
    toArr((S.tasks || {}).list).forEach(t => { if (t.done && t.doneAt) add(ymd(new Date(+t.doneAt)), 'foc', t.prio === 1 ? 20 : 10, 'Задача: ' + (t.title || '')); });
    /* финансы: записанные траты, оплаты, копилка */
    const F = S.finance || {};
    Object.keys(F.spend || {}).forEach(ym => { const per = {};
      toArr(F.spend[ym]).forEach(r => { if (!r || !(+r.amt > 0)) return; const day = ymd(new Date(+r.at || fromYmd(ym + '-01'))); if (r.once) add(day, 'cap', 30, 'Оплата: ' + (r.note || '')); else per[day] = (per[day] || 0) + 1; });
      Object.keys(per).forEach(day => add(day, 'cap', Math.min(25, per[day] * 5), 'Учёт денег')); });
    toArr((F.piggy || {}).ops).forEach(o => { if (o && o.type === 'deposit' && o.date) add(o.date, 'cap', 30, 'В копилку'); });
    /* цели */
    toArr((S.goals || {}).directions).forEach(g => { if (g && g.done && g.doneAt) add(ymd(new Date(+g.doneAt)), 'wil', (+g.amount || 0) >= 100000 ? 250 : 100, 'Цель: ' + (g.name || '')); });
    /* квесты дня */
    const Q = cfg().quests;
    Object.keys(Q).forEach(day => { const q = Q[day] || {}, ids = toArr(q.ids), done = q.done || {}, xp = q.xp || {}, sk = q.sk || {};
      ids.forEach(id => { if (done[id]) add(day, sk[id] || 'dis', +xp[id] || 30, 'Квест'); });
      if (ids.length && ids.every(id => done[id])) add(day, 'wil', 50, 'Все квесты дня'); });
    return out;
  }

  /* ── Серия: любое дело за день; щиты копятся (1 за 7 дней подряд, до 3); дни отдыха и отпуск не ломают ── */
  function streak(evs, c) {
    const act = new Set(evs.filter(e => e.t !== 'Квест' && e.t !== 'Все квесты дня').map(e => e.day));
    const days = [...act].sort(); const st = {};
    if (!days.length) return { cur: 0, best: 0, shields: 0, st, act };
    const isRest = (d, k) => c.rest.includes(d.getDay()) || c.vacs.some(v => k >= v.from && (!v.to || k <= v.to));
    let cur = 0, best = 0, run = 0, sh = 0; const today = ymd(new Date());
    for (let d = fromYmd(days[0]); ymd(d) <= today; d.setDate(d.getDate() + 1)) {
      const k = ymd(d);
      if (act.has(k)) { cur++; run++; st[k] = 'ok'; if (run % 7 === 0) sh = Math.min(3, sh + 1); }
      else if (k === today) { st[k] = 'wait'; }
      else if (isRest(d, k)) { st[k] = 'rest'; }
      else if (sh > 0) { sh--; st[k] = 'sh'; run = 0; }
      else { st[k] = 'miss'; cur = 0; run = 0; }
      best = Math.max(best, cur);
    }
    return { cur, best, shields: sh, st, act };
  }

  function state() {
    const c = cfg(), evs = events();
    const total = evs.reduce((a, e) => a + e.xp, 0), sk = {}; SKO.forEach(k => { sk[k] = 0; }); evs.forEach(e => { sk[e.sk] = (sk[e.sk] || 0) + e.xp; });
    const L = levelOf(total), today = ymd(new Date());
    return { c, evs, total, L, title: titleOf(L.lvl), stage: stageOf(L.lvl), next: nextStage(L.lvl), sk, s: streak(evs, c), todayXp: evs.filter(e => e.day === today).reduce((a, e) => a + e.xp, 0), todayEv: evs.filter(e => e.day === today) };
  }

  /* ── Квесты дня: кандидаты из того, что уже стоит в плане ── */
  function candidates() {
    const S = Store.get() || {}, now = new Date(), today = ymd(now), out = [];
    const evToday = events().filter(e => e.day === today);
    /* тренировка из плана на сегодня */
    let sess = null;
    toArr((S.training || {}).plans).forEach(p => toArr(p && p.weeks).forEach(w => toArr(w && w.days).forEach(d => { if (sess || !d) return; const dt = typeof trDayDateOf === 'function' ? trDayDateOf(p, d.date) : null; if (dt && ymd(dt) === today) { const s = toArr(d.sessions).find(x => x && x.type && !/отдых/i.test(x.type)); if (s) sess = s; } })));
    const trained = evToday.some(e => e.sk === 'str' && e.t !== 'Замер тела');
    if (sess) out.push({ id: 'train', sk: 'str', xp: 50, t: 'Тренировка «' + (toArr(sess.groups).filter(g => g && g !== sess.type).slice(0, 3).join(' + ') || sess.type) + '»', s: 'из плана на сегодня', done: trained });
    else out.push({ id: 'move', sk: 'str', xp: 30, t: 'Движение: тренировка, теннис или шаги', s: 'любая запись в «Тренировках»', done: trained });
    /* привычки */
    const hl = toArr((S.habits || {}).list), dow = now.getDay(), wd = dow >= 1 && dow <= 5;
    const sched = hl.filter(h => h.schedule === 'daily' || (h.schedule === 'weekday' && wd) || !h.schedule).length || hl.length;
    if (hl.length) { const mk = today.slice(0, 7), dd = String(now.getDate()); const m = ((S.habits || {}).months || {})[mk] || {}; const dn = Object.values(m).filter(x => x && (x[dd] === 'done' || x[+dd] === 'done')).length;
      out.push({ id: 'habits', sk: 'dis', xp: 30, t: 'Привычки дня: ' + sched, s: 'сделано ' + dn + ' из ' + sched, done: dn >= sched }); }
    /* задачи */
    const tl = toArr((S.tasks || {}).list), tt = tl.filter(t => t.date === today || (t.done && t.doneAt && ymd(new Date(+t.doneAt)) === today));
    if (tt.length) { const need = Math.min(3, tt.length), dn = tl.filter(t => t.done && t.doneAt && ymd(new Date(+t.doneAt)) === today).length;
      out.push({ id: 'tasks', sk: 'foc', xp: 40, t: need + ' ' + pl(need, 'задача', 'задачи', 'задач') + ' на сегодня', s: 'закрыто ' + Math.min(dn, need) + ' из ' + need, done: dn >= need }); }
    /* деньги: платёж на сегодня или просроченный, иначе платёж категории по дню, иначе учёт трат */
    const FS = window.FinSpend;
    if (FS) { try {
      const pp = toArr(FS.planned()).filter(x => x && !x.done && x.date && x.date <= today).sort((a, b) => a.date < b.date ? -1 : 1)[0];
      const ym = FS.ymKey(now), cs = FS.catSpent(ym) || {}, cat = toArr((FS.budget() || {}).cats).find(c => +c.day === now.getDate() && (+c.amt || 0) > (cs[c.id] || 0));
      const doneP = toArr(FS.planned()).find(x => x && x.done && x.date === today);
      if (pp || doneP) { const x = pp || doneP; out.push({ id: 'pay:' + x.id, sk: 'cap', xp: 30, t: 'Оплатить «' + x.name + '»', s: num(x.amt) + ' ₽', done: !!x.done }); }
      else if (cat) out.push({ id: 'cat:' + cat.id, sk: 'cap', xp: 30, t: 'Оплатить «' + cat.name + '»', s: 'платёж ' + cat.day + ' числа · ' + num(cat.amt) + ' ₽', done: (cs[cat.id] || 0) >= +cat.amt });
      else out.push({ id: 'money', sk: 'cap', xp: 20, t: 'Отметить траты или оплату дня', s: 'в «Балансе» или «Расходах»', done: evToday.some(e => e.sk === 'cap') });
    } catch (e) {} }
    /* копилка */
    if ((S.finance || {}).piggy) out.push({ id: 'piggy', sk: 'cap', xp: 30, t: 'Пополнить копилку', s: 'хоть немного', done: toArr(((S.finance || {}).piggy || {}).ops).some(o => o && o.type === 'deposit' && o.date === today) });
    /* замер, если давно не было */
    const ms = toArr((S.training || {}).measurements).map(m => { const [d, mo, y] = String(m.date || '').split('.').map(Number); return y ? new Date(y, mo - 1, d) : null; }).filter(Boolean).sort((a, b) => b - a);
    if (!ms.length || (now - ms[0]) / 864e5 > 14) out.push({ id: 'measure', sk: 'str', xp: 30, t: 'Сделать замер тела', s: ms.length ? 'последний ' + Math.round((now - ms[0]) / 864e5) + ' дн. назад' : 'первый замер', done: !!(ms.length && ymd(ms[0]) === today) });
    return out;
  }
  /* выбранные на сегодня + отметка выполненных (сохраняем, чтобы вчерашние квесты не пересчитывались) */
  function todayQuests() {
    const c = cfg(), today = ymd(new Date()), q = c.quests[today];
    const cands = candidates();
    if (!q || !toArr(q.ids).length) return { picked: false, cands };
    const ids = toArr(q.ids), done = Object.assign({}, q.done || {});
    let ch = false; const list = ids.map(id => { const x = cands.find(k => k.id === id) || { id, t: (q.t || {})[id] || 'Квест', s: '', xp: (q.xp || {})[id] || 30, sk: (q.sk || {})[id] || 'dis', done: !!done[id] };
      if (x.done && !done[id]) { done[id] = true; ch = true; } return Object.assign({}, x, { done: !!done[id] }); });
    if (ch) Store.set('game.quests.' + today + '.done', done);
    return { picked: true, list, cands };
  }
  function pick(ids) {
    const today = ymd(new Date()), cands = candidates(), xp = {}, sk = {}, t = {};
    ids.forEach(id => { const x = cands.find(k => k.id === id); if (x) { xp[id] = x.xp; sk[id] = x.sk; t[id] = x.t; } });
    Store.set('game.quests.' + today, { ids, done: {}, xp, sk, t, at: Date.now() });
    /* старше 60 дней не храним */
    const Q = cfg().quests, lim = ymd(new Date(Date.now() - 60 * 864e5)); Object.keys(Q).forEach(k => { if (k < lim) Store.set('game.quests.' + k, null); });
  }

  /* ── Картинка персонажа: img/hero/{m|f}{1..5}.webp, пока нет файла, аккуратная заглушка ── */
  const HAS_IMG = true; /* картинки img/hero/{m,f}1..5.webp */
  function heroImg(sex, stage, cls) {
    const src = 'img/hero/' + sex + (Math.min(4, stage) + 1) + '.webp';
    return `<div class="gm-hero ${cls || ''}" data-stage="${stage}">${HAS_IMG ? `<img src="${src}" alt="Персонаж" onerror="this.remove()">` : ''}<div class="gm-hero-ph"><i class="ti ti-user"></i></div></div>`;
  }

  /* ── Полоска на главной ── */
  function homeHtml() {
    if (!on()) return '';
    const S = state(), tq = todayQuests(), qd = tq.picked ? tq.list.filter(x => x.done).length : 0, qn = tq.picked ? tq.list.length : 0;
    return `<button class="gm-bar" id="gm-bar" aria-label="Персонаж">
      ${heroImg(S.c.sex, S.stage, 'sm')}
      <div class="gm-bar-m"><div class="gm-bar-t"><b>Ур. ${S.L.lvl}</b><span>${esc(S.title)}</span><em>${S.s.cur ? '<i class="ti ti-flame"></i>' + S.s.cur : ''}</em></div>
        <div class="gm-xp"><i style="width:${Math.round(S.L.into / S.L.need * 100)}%"></i></div>
        <div class="gm-bar-s">${tq.picked ? 'Квесты ' + qd + ' из ' + qn + (qd === qn ? ' · все закрыты' : '') : 'Выбери квесты на сегодня'}${S.todayXp ? ' · <b>+' + num(S.todayXp) + ' XP</b>' : ''}</div></div>
      <i class="ti ti-chevron-right gm-bar-go"></i></button>`;
  }
  function bindHome(root) { const b = root.querySelector('#gm-bar'); if (b) b.onclick = () => Router.go('/hero'); checkLevelUp(); }

  /* ── Вспышка нового уровня ── */
  function checkLevelUp() {
    if (!on()) return; const S = state(), seen = S.c.seenLvl;
    if (!seen) { Store.set('game.seenLvl', S.L.lvl); flash(S, true); return; }
    if (S.L.lvl > seen) { const newStage = stageOf(S.L.lvl) > stageOf(seen); Store.set('game.seenLvl', S.L.lvl); flash(S, false, newStage); }
  }
  function flash(S, first, newStage) {
    if (document.querySelector('.gm-flash')) return;
    const ov = document.createElement('div'); ov.className = 'gm-flash';
    ov.innerHTML = `<div class="gm-flash-box">
      <div class="gm-rays"></div>${heroImg(S.c.sex, S.stage, 'lg')}
      <div class="gm-flash-k">${first ? 'Твой персонаж' : newStage ? 'Новый облик' : 'Новый уровень'}</div>
      <div class="gm-flash-l">Уровень ${S.L.lvl}</div>
      <div class="gm-flash-t">${esc(S.title)}</div>
      <p>${first ? 'Посчитал по всей твоей истории: тренировки, привычки, деньги, задачи и цели. Дальше очки капают сами.' : S.next ? 'До облика «' + esc(S.next[1]) + '» ' + (S.next[0] - S.L.lvl) + ' ' + pl(S.next[0] - S.L.lvl, 'уровень', 'уровня', 'уровней') : 'Высший облик. Легенда.'}</p>
      <button class="gm-btn">${first ? 'Посмотреть' : 'Круто'}</button></div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('in'));
    try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate([20, 40, 30]); } catch (e) {}
    const close = () => { ov.classList.remove('in'); setTimeout(() => ov.remove(), 250); };
    ov.querySelector('.gm-btn').onclick = () => { close(); if (first) Router.go('/hero'); };
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
  }

  /* подсказки к экрану (кнопка «?») */
  const TIPS = [
    { sel: '.gm-stage', t: 'Персонаж', d: 'Растёт вместе с тобой. Облик меняется на 10, 20, 35 и 50 уровне: Новичок, Боец, Воин, Чемпион, Легенда.' },
    { sel: '.gm-xpw', t: 'Опыт', d: 'Очки капают сами из того, что ты записываешь: тренировки, привычки, деньги, задачи, цели. Штрафов нет.' },
    { sel: '.gm-ql', t: 'Квесты дня', d: 'Утром выбираешь, что берёшь. Отмечаются сами, когда делаешь дело в разделе. Нажми на квест, чтобы перейти.' },
    { sel: '.gm-sk', t: 'Навыки', d: 'Сила от тренировок, Дисциплина от привычек, Капитал от финансов, Фокус от задач, Воля от целей.' },
    { sel: '.gm-cal', t: 'Серия', d: 'Засчитывается любое дело в любом разделе. Каждые 7 дней подряд дают щит (до 3), он сам спасёт серию в пропущенный день. Дни отдыха и отпуск в настройках.' },
  ];

  /* ── Экран «Персонаж» ── */
  const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const MON = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  function render(mount) {
    if (!avail()) { Router.go('/home'); return; }
    const S = state(), c = S.c, tq = todayQuests(), now = new Date();
    const pct = Math.round(S.L.into / S.L.need * 100);
    /* календарь месяца */
    const y = now.getFullYear(), m = now.getMonth(), first = new Date(y, m, 1), lead = (first.getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
    let cal = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map(d => `<span class="h">${d}</span>`).join('') + '<span class="e"></span>'.repeat(lead);
    let okN = 0;
    for (let d = 1; d <= dim; d++) { const k = y + '-' + p2(m + 1) + '-' + p2(d), st = S.s.st[k] || '', td = k === ymd(now);
      if (st === 'ok') okN++;
      cal += `<span class="${st}${td ? ' td' : ''}${k > ymd(now) ? ' fu' : ''}">${d}</span>`; }
    const qHtml = !tq.picked
      ? `<div class="gm-card"><div class="gm-h"><b>Что берёшь сегодня?</b><span>отметь до ${c.qn}</span></div>
          <div class="gm-ql">${tq.cands.map((x, i) => `<button class="gm-q pick${i < c.qn ? ' on' : ''}" data-id="${esc(x.id)}"><span class="gm-cb"><i class="ti ti-check"></i></span><span class="gm-qm"><b>${esc(x.t)}</b><small style="color:${SK[x.sk].color}">${esc(SK[x.sk].name)} · ${esc(x.s)}</small></span><em>+${x.xp}</em></button>`).join('')}</div>
          <div class="gm-note">Закроешь все: +50 XP</div>
          <button class="gm-btn" id="gm-take">Беру</button></div>`
      : `<div class="gm-card"><div class="gm-h"><b>Квесты дня</b><span>${tq.list.filter(x => x.done).length} из ${tq.list.length}${tq.list.every(x => x.done) ? ' · +50 бонус' : ''}</span></div>
          <div class="gm-ql">${tq.list.map(x => `<div class="gm-q${x.done ? ' done' : ''}" data-go="${esc(SK[x.sk] ? SK[x.sk].route : '')}"><span class="gm-cb"><i class="ti ti-check"></i></span><span class="gm-qm"><b>${esc(x.t)}</b><small style="color:${(SK[x.sk] || SK.dis).color}">${esc((SK[x.sk] || SK.dis).name)}${x.s ? ' · ' + esc(x.s) : ''}</small></span><em>+${x.xp}</em></div>`).join('')}</div>
</div>`;
    mount.innerHTML = `<div class="gm-screen">
      <div class="gm-top">
        <div class="gm-nav"><button class="gm-back" id="gm-back" aria-label="Назад"><i class="ti ti-arrow-left"></i></button><b>Персонаж</b><span style="display:flex;gap:8px"><button class="gm-back" id="gm-help" aria-label="Подсказки"><i class="ti ti-help"></i></button><button class="gm-back" id="gm-set" aria-label="Настройки"><i class="ti ti-settings"></i></button></span></div>
        <div class="gm-stage">${heroImg(c.sex, S.stage, 'xl')}</div>
        <div class="gm-who"><div class="gm-lvl">Уровень ${S.L.lvl}</div><div class="gm-title">${esc(S.title)}</div></div>
        <div class="gm-xpw"><div class="gm-xp lg"><i style="width:${pct}%"></i></div><div class="gm-xpt"><span>${num(S.L.into)} / ${num(S.L.need)} XP</span><span>${S.next ? 'до «' + esc(S.next[1]) + '» ' + (S.next[0] - S.L.lvl) + ' ур.' : 'максимум'}</span></div></div>
        <div class="gm-pills"><span><i class="ti ti-flame"></i>${S.s.cur} ${pl(S.s.cur, 'день', 'дня', 'дней')}</span><span><i class="ti ti-shield"></i>${S.s.shields} ${pl(S.s.shields, 'щит', 'щита', 'щитов')}</span><span><i class="ti ti-bolt"></i>+${num(S.todayXp)} сегодня</span></div>
      </div>
      <div class="gm-body">
        ${qHtml}
        <div class="gm-card"><div class="gm-h"><b>Навыки</b><span>всего ${num(S.total)} XP</span></div>
          ${SKO.map(k => { const x = S.sk[k] || 0; return `<button class="gm-sk" data-go="${SK[k].route}"><span class="gm-ski" style="--c:${SK[k].color}"><i class="ti ${SK[k].ico}"></i></span><span class="gm-skm"><span class="gm-skt"><b>${SK[k].name}</b><small>${SK[k].src}</small><em>${skillLvl(x)}</em></span><span class="gm-skb"><i style="width:${Math.round(skillInto(x) * 100)}%;background:${SK[k].color}"></i></span></span></button>`; }).join('')}
        </div>
        ${S.next ? `<div class="gm-card gm-next">${heroImg(c.sex, S.stage + 1, 'md')}<div><div class="gm-k">Следующий облик</div><b>${esc(S.next[1])} · ур. ${S.next[0]}</b><p>${['Расправишь плечи, сменишь серое на спортивную форму', 'Майка, руки крепче, рельеф', 'Медаль и форма чемпиона', 'Плащ и золотой венок'][S.stage] || ''}</p></div></div>` : ''}
        <div class="gm-card"><div class="gm-h"><b>Серия · ${MON[m]}</b><span>лучшая ${S.s.best}</span></div>
          <div class="gm-cal">${cal}</div>
          <div class="gm-leg"><span><i class="ok"></i>было дело</span><span><i class="sh"></i>спас щит</span><span><i class="rest"></i>отдых</span></div>
        </div>
        ${S.todayEv.length ? `<div class="gm-card"><div class="gm-h"><b>Сегодня</b><span>+${num(S.todayXp)} XP</span></div>${S.todayEv.slice(-8).reverse().map(e => `<div class="gm-ev"><i style="background:${SK[e.sk].color}"></i><span>${esc(e.t)}</span><b>+${e.xp}</b></div>`).join('')}</div>` : ''}
      </div></div>`;
    const $ = (q) => mount.querySelector(q);
    $('#gm-back').onclick = () => Router.go('/home');
    $('#gm-set').onclick = () => settings(() => render(mount));
    $('#gm-help').onclick = () => { if (window.Tour && Tour.play) Tour.play(TIPS.filter(x => document.querySelector(x.sel)), 'screen:/hero'); };
    mount.querySelectorAll('[data-go]').forEach(b => { if (b.dataset.go) b.onclick = () => Router.go(b.dataset.go); });
    mount.querySelectorAll('.gm-q.pick').forEach(b => b.onclick = () => { const onN = mount.querySelectorAll('.gm-q.pick.on').length; if (!b.classList.contains('on') && onN >= c.qn) return; b.classList.toggle('on'); });
    const tk = $('#gm-take'); if (tk) tk.onclick = () => { const ids = [...mount.querySelectorAll('.gm-q.pick.on')].map(b => b.dataset.id); if (!ids.length) return; pick(ids); render(mount); };
    checkLevelUp();
  }

  /* ── Настройки ── */
  function settings(done) {
    const c = cfg(), ov = document.createElement('div'); ov.className = 'tr-modal-overlay';
    const vacOn = c.vacs.some(v => !v.to);
    ov.innerHTML = `<div class="tr-modal gm-set"><p class="tr-modal-title">Игровой режим</p>
      <div class="gm-row"><span>Персонаж</span><div class="gm-seg" data-k="sex"><button data-v="m" class="${c.sex === 'm' ? 'on' : ''}">Парень</button><button data-v="f" class="${c.sex === 'f' ? 'on' : ''}">Девушка</button></div></div>
      <div class="gm-row"><span>Квестов в день</span><div class="gm-seg" data-k="qn">${[2, 3, 5].map(n => `<button data-v="${n}" class="${c.qn === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      <div class="gm-row col"><span>Дни отдыха <small>серия в эти дни не сгорает</small></span><div class="gm-days">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button data-d="${d}" class="${c.rest.includes(d) ? 'on' : ''}">${DOW[d]}</button>`).join('')}</div></div>
      <div class="gm-row"><span>Отпуск <small>серия заморожена</small></span><button class="gm-sw${vacOn ? ' on' : ''}" id="gm-vac" aria-label="Отпуск"></button></div>
      <div class="gm-row"><span>Показывать на главной</span><button class="gm-sw${c.on ? ' on' : ''}" id="gm-on" aria-label="Игровой режим"></button></div>
      <div class="tr-modal-actions"><button class="tr-modal-btn-primary" id="gm-ok" style="flex:1">Готово</button></div></div>`;
    document.body.appendChild(ov);
    const close = () => { ov.remove(); done && done(); };
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('#gm-ok').onclick = close;
    ov.querySelectorAll('.gm-seg').forEach(sg => sg.querySelectorAll('button').forEach(b => b.onclick = () => { sg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); Store.set('game.' + sg.dataset.k, sg.dataset.k === 'qn' ? +b.dataset.v : b.dataset.v); }));
    ov.querySelectorAll('.gm-days button').forEach(b => b.onclick = () => { b.classList.toggle('on'); Store.set('game.rest', [...ov.querySelectorAll('.gm-days button.on')].map(x => +x.dataset.d)); });
    ov.querySelector('#gm-on').onclick = (e) => { e.currentTarget.classList.toggle('on'); Store.set('game.on', e.currentTarget.classList.contains('on')); };
    ov.querySelector('#gm-vac').onclick = (e) => { const b = e.currentTarget; b.classList.toggle('on'); const t = ymd(new Date()); let v = cfg().vacs;
      if (b.classList.contains('on')) v = v.concat([{ from: t }]); else v = v.map(x => x.to ? x : Object.assign({}, x, { to: ymd(new Date(Date.now() - 864e5)) < x.from ? x.from : ymd(new Date(Date.now() - 864e5)) }));
      Store.set('game.vacs', v); };
  }

  return { avail, on, state, events, candidates, todayQuests, pick, homeHtml, bindHome, render, checkLevelUp, _levelOf: levelOf, _streak: streak };
})();
window.Screens = window.Screens || {};
Screens.hero = (mount) => Game.render(mount);
