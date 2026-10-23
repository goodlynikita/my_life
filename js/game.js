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
  const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const GLOW = ['#64748B', '#4A7CFF', '#8B5CF6', '#F59E0B', '#FACC15'];
  const TITLES = [[1, 'Новичок'], [10, 'Боец'], [20, 'Воин'], [35, 'Чемпион'], [50, 'Легенда']];

  function cfg() { const g = (Store.get() || {}).game || {}; return { on: g.on !== false, sex: g.sex === 'f' ? 'f' : 'm', qn: [2, 3, 5].includes(+g.qn) ? +g.qn : 3, rest: toArr(g.rest).map(Number).filter(n => n >= 0 && n <= 6), vacs: toArr(g.vacs).filter(v => v && v.from), quests: (g.quests && typeof g.quests === 'object') ? g.quests : {}, seenLvl: +g.seenLvl || 0,
    repairs: toArr(g.repairs).map(String), seenSt: g.seenSt == null ? null : +g.seenSt || 0, seenWeek: g.seenWeek || null,
    rewards: toArr(g.rewards).filter(r => r && r.id && r.name), bought: toArr(g.bought).filter(b => b && b.at), shopFrom: g.shopFrom || null,
    look: g.look == null || g.look === '' ? null : +g.look, bg: g.bg || 'base', frame: g.frame || 'none', seenItems: toArr(g.seenItems).map(String), gotItems: g.gotItems == null ? null : toArr(g.gotItems).map(String) }; }
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
    const add = (day, sk, xp, t, k) => { if (day && day <= today && xp > 0) out.push({ day, sk, xp, t, k: k || '' }); };
    /* тренировки */
    const plans = toArr((S.training || {}).plans);
    const str = [];
    plans.forEach(p => toArr(p && p.weeks).forEach(w => toArr(w && w.days).forEach(d => {
      if (!d) return; const dt = typeof trDayDateOf === 'function' ? trDayDateOf(p, d.date) : null; if (!dt) return; const day = ymd(dt); if (day > today) return;
      toArr(d.sessions).forEach(s => { const ex = toArr(s && s.exercises);
        const st = ex.filter(e => e.kind === 'strength' && ((+e.weight || 0) > 0 || (+e.reps || 0) > 0));
        const ca = ex.filter(e => (e.kind === 'cardio' && ((+e.distance || 0) > 0 || (+e.duration || 0) > 0)) || (e.kind === 'time_calorie' && ((+e.duration || 0) > 0 || (+e.calories || 0) > 0)));
        const steps = ex.some(e => e.kind === 'steps' && (+e.steps || 0) > 0);
        if (st.length) { add(day, 'str', 60, 'Тренировка', 'train'); st.forEach(e => str.push({ day, e })); }
        else if (ca.length) add(day, 'str', 45, ca[0].name || 'Активность', 'train');
        else if (steps) add(day, 'str', 10, 'Шаги', 'steps');
      });
    })));
    /* рекорды: вес выше прежнего максимума по этому упражнению */
    str.sort((a, b) => a.day < b.day ? -1 : a.day > b.day ? 1 : 0);
    const best = {}, prDay = {};
    str.forEach(({ day, e }) => { const k = typeof trFamKey === 'function' ? trFamKey(e.name) : String(e.name).toLowerCase(); const w = +e.weight || 0; if (!w) return;
      if (best[k] && w > best[k] && (prDay[day] || 0) < 2) { add(day, 'str', 40, 'Рекорд: ' + e.name + ' ' + String(w).replace('.', ',') + ' кг', 'pr'); prDay[day] = (prDay[day] || 0) + 1; }
      best[k] = Math.max(best[k] || 0, w); });
    /* замеры */
    toArr((S.training || {}).measurements).forEach(m => { const [dd, mm, yy] = String(m.date || '').split('.').map(Number); if (yy) add(yy + '-' + p2(mm) + '-' + p2(dd), 'str', 30, 'Замер тела', 'meas'); });
    /* привычки */
    const H = S.habits || {}, hl = toArr(H.list).length;
    Object.keys(H.months || {}).forEach(ym => { const per = {};
      Object.values(H.months[ym] || {}).forEach(days => Object.keys(days || {}).forEach(d => { if (days[d] === 'done') per[d] = (per[d] || 0) + 1; }));
      Object.keys(per).forEach(d => { const day = ym + '-' + p2(+d); add(day, 'dis', Math.min(80, per[d] * 8), 'Привычки: ' + per[d], 'hab'); if (hl && per[d] * 2 > hl) add(day, 'dis', 20, 'День привычек засчитан', 'habday'); }); });
    /* задачи */
    toArr((S.tasks || {}).list).forEach(t => { if (t.done && t.doneAt) add(ymd(new Date(+t.doneAt)), 'foc', t.prio === 1 ? 20 : 10, 'Задача: ' + (t.title || ''), 'task'); });
    /* финансы: записанные траты, оплаты, копилка */
    const F = S.finance || {};
    Object.keys(F.spend || {}).forEach(ym => { const per = {};
      toArr(F.spend[ym]).forEach(r => { if (!r || !(+r.amt > 0)) return; const day = ymd(new Date(+r.at || fromYmd(ym + '-01'))); if (r.once) add(day, 'cap', 30, 'Оплата: ' + (r.note || ''), 'pay'); else per[day] = (per[day] || 0) + 1; });
      Object.keys(per).forEach(day => add(day, 'cap', Math.min(25, per[day] * 5), 'Учёт денег', 'spend')); });
    toArr((F.piggy || {}).ops).forEach(o => { if (o && o.type === 'deposit' && o.date) add(o.date, 'cap', 30, 'В копилку', 'piggy'); });
    /* цели */
    toArr((S.goals || {}).directions).forEach(g => { if (g && g.done && g.doneAt) add(ymd(new Date(+g.doneAt)), 'wil', (+g.amount || 0) >= 100000 ? 250 : 100, 'Цель: ' + (g.name || ''), 'goal'); });
    /* квесты дня */
    const Q = cfg().quests;
    Object.keys(Q).forEach(day => { const q = Q[day] || {}, ids = toArr(q.ids), done = q.done || {}, xp = q.xp || {}, sk = q.sk || {};
      ids.forEach(id => { if (done[id]) add(day, sk[id] || 'dis', +xp[id] || 30, 'Квест: ' + ((q.t || {})[id] || ''), 'quest'); });
      if (ids.length && ids.every(id => done[id])) add(day, 'wil', 50, 'Все квесты дня', 'qall');
      if (q.chest && q.chest.kind === 'xp') add(day, 'wil', +q.chest.xp || 0, q.chest.rare ? 'Редкий сундук' : 'Сундук дня', 'chest'); });
    return out;
  }

  /* ── Серия: любое дело за день; щиты копятся (1 за 7 дней подряд, до 3); дни отдыха и отпуск не ломают ── */
  function streak(evs, c) {
    const act = new Set(evs.filter(e => !['quest', 'qall', 'chest'].includes(e.k)).map(e => e.day));
    const chSh = new Set(Object.keys(c.quests || {}).filter(d => (c.quests[d] || {}).chest && c.quests[d].chest.kind === 'shield')), rep = new Set(c.repairs || []);
    const days = [...act].sort(); const st = {};
    if (!days.length) return { cur: 0, best: 0, shields: 0, st, act };
    const isRest = (d, k) => c.rest.includes(d.getDay()) || c.vacs.some(v => k >= v.from && (!v.to || k <= v.to));
    let cur = 0, best = 0, run = 0, sh = 0; const today = ymd(new Date());
    for (let d = fromYmd(days[0]); ymd(d) <= today; d.setDate(d.getDate() + 1)) {
      const k = ymd(d);
      if (chSh.has(k)) sh = Math.min(3, sh + 1);
      if (act.has(k)) { cur++; run++; st[k] = 'ok'; if (run % 7 === 0) sh = Math.min(3, sh + 1); }
      else if (rep.has(k)) { st[k] = 'rep'; }
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
    let sl = hl.filter(h => h.schedule === 'daily' || (h.schedule === 'weekday' && wd) || !h.schedule); if (!sl.length) sl = hl;
    const sched = sl.length;
    /* считаем только привычки, которые стоят на сегодня */
    if (hl.length) { const mk = today.slice(0, 7), dd = String(now.getDate()); const m = ((S.habits || {}).months || {})[mk] || {}; const dn = sl.filter(h => { const x = m[h.id]; return x && (x[dd] === 'done' || x[+dd] === 'done'); }).length;
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
    let ch = false; const fresh = []; const list = ids.map(id => { const x = cands.find(k => k.id === id) || { id, t: (q.t || {})[id] || 'Квест', s: '', xp: (q.xp || {})[id] || 30, sk: (q.sk || {})[id] || 'dis', done: !!done[id] };
      /* сегодня отметка живая: сняли отметку в разделе, квест тоже снимается */
      const live = cands.some(k => k.id === id);
      if (x.done && !done[id]) { done[id] = true; ch = true; fresh.push(id); }
      else if (live && !x.done && done[id]) { delete done[id]; ch = true; }
      return Object.assign({}, x, { done: !!done[id] }); });
    if (ch) Store.set('game.quests.' + today + '.done', done);
    return { picked: true, list, cands, fresh, chest: q.chest || null };
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
      ${frameWrap(heroImg(S.c.sex, lookOf(S), 'sm'), frOf(S))}
      <div class="gm-bar-m"><div class="gm-bar-t"><b>Ур. ${S.L.lvl}</b><span>${esc(S.title)}</span><em>${S.s.cur ? '<i class="ti ti-flame"></i>' + S.s.cur : ''}</em></div>
        <div class="gm-xp"><i style="width:${Math.round(S.L.into / S.L.need * 100)}%"></i></div>
        <div class="gm-bar-s">${tq.picked ? 'Квесты ' + qd + ' из ' + qn + (qd === qn ? ' · все закрыты' : '') : 'Выбери квесты на сегодня'}${S.todayXp ? ' · <b>+' + num(S.todayXp) + ' XP</b>' : ''}</div></div>
      <i class="ti ti-chevron-right gm-bar-go"></i></button>`;
  }
  function bindHome(root) { const b = root.querySelector('#gm-bar'); if (b) b.onclick = () => Router.go('/hero'); checkLevelUp(); }

  /* ── Вспышки: уровень, серия, итоги недели, сундук. Идут по очереди ── */
  const _q = [];
  function overlay(html, opts) {
    opts = opts || {};
    if (document.querySelector('.gm-flash')) { _q.push([html, opts]); return; }
    const ov = document.createElement('div'); ov.className = 'gm-flash' + (opts.cls ? ' ' + opts.cls : '');
    ov.innerHTML = `<div class="gm-flash-box">${html}</div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('in'));
    try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate([20, 40, 30]); } catch (e) {}
    const close = () => { ov.classList.remove('in'); setTimeout(() => { ov.remove(); if (opts.onClose) opts.onClose(); const n = _q.shift(); if (n) overlay(n[0], n[1]); }, 250); };
    ov.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    if (opts.onOpen) opts.onOpen(ov, close);
    if (opts.confetti !== false) setTimeout(() => confetti(ov.querySelector('.gm-flash-box')), 180);
    return ov;
  }
  /* конфетти: лёгкие div, сами удаляются */
  function confetti(host, n) {
    if (!host || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const cols = ['#4A7CFF', '#8B5CF6', '#22C55E', '#FACC15', '#F472B6', '#FB923C'];
    const box = document.createElement('div'); box.className = 'gm-conf';
    for (let i = 0; i < (n || 46); i++) { const b = document.createElement('i'); const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 170;
      b.style.cssText = `--x:${(Math.cos(a) * d).toFixed(0)}px;--y:${(Math.sin(a) * d - 60).toFixed(0)}px;--r:${(Math.random() * 720 - 360).toFixed(0)}deg;background:${cols[i % cols.length]};animation-delay:${(Math.random() * 120).toFixed(0)}ms;${i % 3 ? '' : 'border-radius:50%;'}`;
      box.appendChild(b); }
    host.appendChild(box); setTimeout(() => box.remove(), 1700);
  }
  const STK = [7, 30, 100, 365];
  const STK_T = { 7: 'Неделя без пропусков', 30: 'Месяц в деле', 100: 'Сотня. Это уже характер', 365: 'Год подряд. Легенда' };
  const monday = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  function weekRecap(S) {
    const m0 = monday(new Date()), from = new Date(m0); from.setDate(from.getDate() - 7);
    const days = [], per = {}, sk = {}; for (let i = 0; i < 7; i++) { const d = new Date(from); d.setDate(d.getDate() + i); days.push(ymd(d)); }
    S.evs.forEach(e => { if (days.includes(e.day)) { per[e.day] = (per[e.day] || 0) + e.xp; sk[e.sk] = (sk[e.sk] || 0) + e.xp; } });
    const xp = Object.values(per).reduce((a, b) => a + b, 0);
    const pf = new Date(from); pf.setDate(pf.getDate() - 7); const pk = ymd(pf), fk = days[0];
    const prev = S.evs.filter(e => e.day >= pk && e.day < fk).reduce((a, e) => a + e.xp, 0);
    const act = days.filter(d => S.s.st[d] === 'ok').length;
    const bd = days.reduce((a, d) => (per[d] || 0) > (per[a] || 0) ? d : a, days[0]);
    const top = SKO.reduce((a, k) => (sk[k] || 0) > (sk[a] || 0) ? k : a, 'str');
    return { key: ymd(m0), xp, prev, act, perfect: act === 7, best: bd, bestXp: per[bd] || 0, top, topXp: sk[top] || 0 };
  }
  function checkLevelUp() {
    if (!on()) return; const S = state(), c = S.c, seen = c.seenLvl;
    if (!seen) { Store.set('game.seenLvl', S.L.lvl); flash(S, true); }
    else if (S.L.lvl > seen) { const newStage = stageOf(S.L.lvl) > stageOf(seen); Store.set('game.seenLvl', S.L.lvl); flash(S, false, newStage); }
    /* праздник серии: первый запуск молча запоминает уже пройденную отметку */
    const ms = STK.filter(x => S.s.cur >= x).pop() || 0;
    if (c.seenSt == null) Store.set('game.seenSt', ms);
    else if (ms > c.seenSt) { Store.set('game.seenSt', ms); streakFlash(ms); }
    else if (ms < c.seenSt && S.s.cur < 7) Store.set('game.seenSt', ms);
    /* итоги прошлой недели: один раз за неделю */
    const R = weekRecap(S);
    checkItems(S);
    if (c.seenWeek !== R.key) { Store.set('game.seenWeek', R.key); if (R.xp > 0 && seen) recapFlash(R); }
  }
  function flash(S, first, newStage) {
    overlay(`<div class="gm-rays"></div>${heroImg(S.c.sex, S.stage, 'lg')}
      <div class="gm-flash-k">${first ? 'Твой персонаж' : newStage ? 'Новый облик' : 'Новый уровень'}</div>
      <div class="gm-flash-l">Уровень ${S.L.lvl}</div>
      <div class="gm-flash-t">${esc(S.title)}</div>
      <p>${first ? 'Посчитал по всей твоей истории: тренировки, привычки, деньги, задачи и цели. Дальше очки капают сами.' : S.next ? 'До облика «' + esc(S.next[1]) + '» ' + (S.next[0] - S.L.lvl) + ' ' + pl(S.next[0] - S.L.lvl, 'уровень', 'уровня', 'уровней') : 'Высший облик. Легенда.'}</p>
      <button class="gm-btn" data-close>${first ? 'Посмотреть' : 'Круто'}</button>`, { cls: 'gm-lvlup', confetti: !first, onClose: () => { if (first) Router.go('/hero'); } });
  }
  function streakFlash(n) {
    overlay(`<div class="gm-rays warm"></div><div class="gm-fire"><i class="ti ti-flame"></i>${'<span></span>'.repeat(10)}</div>
      <div class="gm-flash-l">${n} ${pl(n, 'день', 'дня', 'дней')}</div><div class="gm-flash-k warm">подряд</div>
      <p>${STK_T[n]}${n >= 30 ? '' : '. Держи щиты: каждые 7 дней даю новый.'}</p>
      <button class="gm-btn warm" data-close>Огонь</button>`, { cls: 'gm-streak' });
  }
  function recapFlash(R) {
    const d = fromYmd(R.best), diff = R.prev ? Math.round((R.xp - R.prev) / R.prev * 100) : null;
    overlay(`<div class="gm-flash-k">Итоги недели</div>
      <div class="gm-flash-l" data-count="${R.xp}">+${num(R.xp)} XP</div>
      ${diff != null ? `<div class="gm-rc-d ${diff >= 0 ? 'up' : 'dn'}"><i class="ti ti-trending-${diff >= 0 ? 'up' : 'down'}"></i>${diff >= 0 ? '+' : ''}${diff}% к прошлой</div>` : ''}
      ${R.perfect ? '<div class="gm-perf"><i class="ti ti-crown"></i>Идеальная неделя</div>' : ''}
      <div class="gm-rc">
        <div><b>${R.act}<small>/7</small></b><span>дней с делом</span></div>
        <div><b>${DOW[d.getDay()]}</b><span>лучший день · ${num(R.bestXp)}</span></div>
        <div style="--c:${SK[R.top].color}"><b class="c"><i class="ti ${SK[R.top].ico}"></i></b><span>${SK[R.top].name} · ${num(R.topXp)}</span></div>
      </div>
      <button class="gm-btn" data-close>Погнали дальше</button>`, { cls: 'gm-recap', confetti: R.perfect });
  }
  /* сундук: случайная награда за все квесты дня */
  function openChest(onDone) {
    const today = ymd(new Date()), S = state(), r = Math.random();
    let ch;
    if (r < 0.08) ch = { kind: 'xp', xp: 150, rare: true };
    else if (r < 0.26 && S.s.shields < 3) ch = { kind: 'shield' };
    else ch = { kind: 'xp', xp: [20, 30, 40, 50, 60, 80, 100][Math.floor(Math.random() * 7)] };
    ch.at = Date.now();
    Store.set('game.quests.' + today + '.chest', ch);
    overlay(`<div class="gm-rays${ch.rare ? ' gold' : ''}"></div>
      <div class="gm-chest"><div class="gm-chest-b"><i class="ti ti-gift"></i></div></div>
      <div class="gm-chest-r">
        <div class="gm-flash-k">${ch.rare ? 'Редкая находка' : 'Сундук дня'}</div>
        <div class="gm-flash-l">${ch.kind === 'shield' ? '<i class="ti ti-shield-check"></i> Щит' : '+' + ch.xp + ' XP'}</div>
        <p>${ch.kind === 'shield' ? 'Спасёт серию в пропущенный день.' : ch.rare ? 'Такое выпадает редко.' : 'Завтра будет новый.'}</p>
        <button class="gm-btn" data-close>Забрать</button></div>`, { cls: 'gm-chestfl', confetti: false, onClose: onDone,
      onOpen: (ov) => setTimeout(() => { ov.classList.add('opened'); confetti(ov.querySelector('.gm-flash-box'), ch.rare ? 70 : 46); }, 1100) });
  }

  /* ── Шкафчик: облик, фон, рамка. Открываются за достижения и уровни ── */
  const BGS = [{ id: 'base', n: 'Классика' }, { id: 'dawn', n: 'Рассвет', a: 'hab30' }, { id: 'ice', n: 'Лёд', l: 20 }, { id: 'night', n: 'Звёзды', a: 'tr50' }, { id: 'aurora', n: 'Сияние', a: 'st30' }, { id: 'gold', n: 'Золото', a: 'goal1' }];
  const FRS = [{ id: 'none', n: 'Без рамки' }, { id: 'blue', n: 'Сапфир' }, { id: 'fire', n: 'Огонь', a: 'st7' }, { id: 'neon', n: 'Неон', a: 'pr10' }, { id: 'gold', n: 'Золото', a: 'pw1' }, { id: 'diamond', n: 'Алмаз', a: 'st100' }, { id: 'rainbow', n: 'Радуга', l: 35 }];
  const lookOf = (S) => (S.c.look != null && S.c.look >= 0 && S.c.look <= S.stage) ? S.c.look : S.stage;
  const bgOf = (S) => { const b = BGS.find(x => x.id === S.c.bg); return b && unlockOk(S, b) ? b.id : 'base'; };
  const frOf = (S) => { const f = FRS.find(x => x.id === S.c.frame); return f && unlockOk(S, f) ? f.id : 'none'; };
  let _ach = null, _achS = null;
  function achMap(S) { if (_achS !== S) { _achS = S; _ach = {}; achievements(S).forEach(a => { _ach[a.id] = a; }); } return _ach; }
  function unlockOk(S, it) { if (it.l) return S.L.lvl >= it.l; if (it.a) { const a = achMap(S)[it.a]; return !!(a && a.ok); } return true; }
  function wrItems(S) {
    const out = [], A = achMap(S);
    const cond = (it) => it.l ? { t: 'уровень ' + it.l, v: S.L.lvl, n: it.l } : it.a ? { t: A[it.a].t, v: Math.min(A[it.a].v, A[it.a].n), n: A[it.a].n } : null;
    TITLES.forEach((t, i) => out.push({ key: 'look:' + i, kind: 'look', id: i, name: t[1], ok: i <= S.stage, base: i === 0, cond: { t: 'уровень ' + t[0], v: S.L.lvl, n: t[0] } }));
    BGS.forEach(b => out.push({ key: 'bg:' + b.id, kind: 'bg', id: b.id, name: b.n, ok: unlockOk(S, b), base: b.id === 'base', cond: cond(b) }));
    FRS.forEach(f => out.push({ key: 'fr:' + f.id, kind: 'frame', id: f.id, name: f.n, ok: unlockOk(S, f), base: !f.a && !f.l, cond: cond(f) }));
    return out;
  }
  const frameWrap = (html, fr) => `<span class="gm-fr fr-${fr}">${html}</span>`;
  function fxHtml(bg) {
    if (bg === 'night') return '<div class="gm-fx fx-night"><i></i><i></i></div>';
    if (bg === 'aurora') return '<div class="gm-fx fx-aurora"><i></i><i></i><i></i></div>';
    if (bg === 'gold') return '<div class="gm-fx fx-gold"><i></i></div>';
    if (bg === 'dawn') return '<div class="gm-fx fx-dawn"><i></i></div>';
    if (bg === 'ice') return '<div class="gm-fx fx-ice">' + Array.from({ length: 26 }, (_, i) => `<i style="--l:${(i * 37) % 100}%;--d:${((i * 0.61) % 7).toFixed(2)}s;--t:${6 + (i % 5)}s;--s:${2 + (i % 3)}px;--x:${(i % 2 ? 1 : -1) * (10 + i % 20)}px"></i>`).join('') + '</div>';
    return '';
  }
  function wrPreview(S, lk, bg, fr) {
    return `<div class="gm-prev gm-bgv" data-bg="${bg}" style="--gc:${GLOW[lk]}">${fxHtml(bg)}<div class="gm-stage sm">${heroImg(S.c.sex, lk, 'lg')}<span class="gm-pod fr-${fr}"></span></div></div>`;
  }
  /* окно шкафчика: снизу на телефоне, по центру на компьютере */
  function wardrobe(onDone, tab) {
    const S = state(), items = wrItems(S); let cur = tab || 'look';
    const ov = document.createElement('div'); ov.className = 'gm-sheet';
    const seen = new Set(S.c.seenItems);
    const draw = () => {
      const c = cfg(), sel = { look: lookOf(Object.assign({}, S, { c })), bg: bgOf(Object.assign({}, S, { c })), frame: frOf(Object.assign({}, S, { c })) };
      const tile = (it) => { const on = String(sel[it.kind]) === String(it.id), isNew = it.ok && !it.base && !seen.has(it.key);
        const pv = it.kind === 'look' ? heroImg(c.sex, it.id, 'tn') : it.kind === 'bg' ? `<span class="gm-bgsw gm-bgv" data-bg="${it.id}" style="--gc:${GLOW[sel.look]}">${fxHtml(it.id)}</span>` : frameWrap(heroImg(c.sex, sel.look, 'sm'), it.id);
        return `<button class="gm-it${on ? ' sel' : ''}${it.ok ? '' : ' lock'}" data-k="${it.kind}" data-v="${it.id}"${it.ok ? '' : ' aria-disabled="true"'}>
          <span class="gm-itp" style="--gc:${GLOW[it.kind === 'look' ? it.id : sel.look]}">${pv}${it.ok ? '' : '<span class="gm-itl"><i class="ti ti-lock"></i></span>'}${on ? '<span class="gm-itc"><i class="ti ti-check"></i></span>' : ''}</span>
          <b>${esc(it.name)}</b>${it.ok ? `<small>${on ? 'надето' : isNew ? '<em>новое</em>' : 'открыто'}</small>` : `<small>${esc(it.cond.t)} · ${num(it.cond.v)}/${num(it.cond.n)}</small><span class="gm-ap"><i style="width:${Math.round(it.cond.v / it.cond.n * 100)}%"></i></span>`}</button>`; };
      const cnt = (k) => { const l = items.filter(i => i.kind === k); return l.filter(i => i.ok).length + '/' + l.length; };
      const nw = (k) => items.some(i => i.kind === k && i.ok && !i.base && !seen.has(i.key));
      ov.innerHTML = `<div class="gm-sheet-p">
        <div class="gm-sheet-h"><b>Шкафчик</b><button class="gm-back" data-x aria-label="Закрыть"><i class="ti ti-x"></i></button></div>
        ${wrPreview(S, sel.look, sel.bg, sel.frame)}
        <div class="gm-tabs">${[['look', 'Облик'], ['bg', 'Фон'], ['frame', 'Рамка']].map(([k, n]) => `<button data-t="${k}" class="${cur === k ? 'on' : ''}">${n}<small>${cnt(k)}</small>${nw(k) ? '<i class="gm-dot"></i>' : ''}</button>`).join('')}</div>
        <div class="gm-grid">${items.filter(i => i.kind === cur).map(tile).join('')}</div></div>`;
      ov.querySelector('[data-x]').onclick = close;
      ov.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { items.filter(i => i.kind === cur && i.ok).forEach(i => seen.add(i.key)); cur = b.dataset.t; draw(); });
      ov.querySelectorAll('.gm-it').forEach(b => b.onclick = () => { if (b.classList.contains('lock')) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); return; }
        Store.set('game.' + b.dataset.k, b.dataset.k === 'look' ? +b.dataset.v : b.dataset.v); seen.add(b.dataset.k === 'frame' ? 'fr:' + b.dataset.v : b.dataset.k + ':' + b.dataset.v); draw(); });
    };
    const close = () => { items.filter(i => i.kind === cur && i.ok).forEach(i => seen.add(i.key)); Store.set('game.seenItems', [...seen]); ov.classList.remove('in'); setTimeout(() => { ov.remove(); onDone && onDone(); }, 220); };
    draw(); document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('in'));
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
  }
  /* новое в шкафчике: вспышка с кнопкой «Надеть» */
  function checkItems(S) {
    const keys = wrItems(S).filter(i => i.ok && !i.base && i.kind !== 'look').map(i => i.key);
    const got = S.c.gotItems;
    if (got == null) { Store.set('game.gotItems', keys); return; }
    const fresh = keys.filter(k => !got.includes(k)); if (!fresh.length) return;
    Store.set('game.gotItems', got.concat(fresh));
    fresh.slice(0, 2).forEach(k => { const it = wrItems(S).find(i => i.key === k), lk = lookOf(S);
      overlay(`<div class="gm-rays gold"></div><div class="gm-flash-k">Новое в шкафчике</div>
        ${wrPreview(S, lk, it.kind === 'bg' ? it.id : bgOf(S), it.kind === 'frame' ? it.id : frOf(S))}
        <div class="gm-flash-l sm">${it.kind === 'bg' ? 'Фон' : 'Рамка'} «${esc(it.name)}»</div>
        <p>За «${esc(it.cond.t)}»</p>
        <button class="gm-btn" data-wear>Надеть</button><button class="gm-btn ghost" data-close>Позже</button>`, { cls: 'gm-newit',
        onOpen: (ov, close) => { ov.querySelector('[data-wear]').onclick = () => { Store.set('game.' + it.kind, it.id); close(); if (_mount && _mount.isConnected) render(_mount); }; } }); });
  }
  let _mount = null;

  /* ── Награды за XP: монеты = XP, набранный с момента первой награды, минус потраченное ── */
  function coins(S) { const c = S.c; if (!c.shopFrom) return 0; const got = S.evs.filter(e => e.day >= c.shopFrom).reduce((a, e) => a + e.xp, 0); return Math.max(0, got - c.bought.reduce((a, b) => a + (+b.cost || 0), 0)); }
  function rewardModal(onDone) {
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay';
    ov.innerHTML = `<div class="tr-modal gm-set"><p class="tr-modal-title">Новая награда</p>
      <div class="gm-row col"><span>Что себе даришь</span><input class="gm-in" id="gm-rn" maxlength="60" placeholder="Кино, новые кроссы, массаж"></div>
      <div class="gm-row col"><span>Цена в XP</span><div class="gm-seg gm-costs">${[300, 1000, 3000, 10000].map(n => `<button data-v="${n}">${num(n)}</button>`).join('')}</div><input class="gm-in" id="gm-rc" inputmode="numeric" placeholder="или своя цена"></div>
      <div class="tr-modal-actions"><button class="tr-modal-btn-secondary" id="gm-rx">Отмена</button><button class="tr-modal-btn-primary" id="gm-rok">Добавить</button></div></div>`;
    document.body.appendChild(ov);
    const $ = (q) => ov.querySelector(q), close = () => ov.remove();
    setTimeout(() => $('#gm-rn').focus(), 50);
    ov.querySelectorAll('.gm-costs button').forEach(b => b.onclick = () => { ov.querySelectorAll('.gm-costs button').forEach(x => x.classList.toggle('on', x === b)); $('#gm-rc').value = b.dataset.v; });
    $('#gm-rx').onclick = close; ov.addEventListener('click', e => { if (e.target === ov) close(); });
    $('#gm-rok').onclick = () => { const name = $('#gm-rn').value.trim(), cost = Math.round(+String($('#gm-rc').value).replace(/\s/g, '')) || 0;
      if (!name) { $('#gm-rn').focus(); return; } if (cost < 10) { $('#gm-rc').focus(); return; }
      const c = cfg(); if (!c.shopFrom) Store.set('game.shopFrom', ymd(new Date()));
      Store.set('game.rewards', c.rewards.concat([{ id: 'r' + Date.now().toString(36), name, cost }])); close(); onDone && onDone(); };
  }

  /* подсказки к экрану (кнопка «?») */
  const TIPS = [
    { sel: '.gm-stage', t: 'Персонаж', d: 'Растёт вместе с тобой. Облик меняется на 10, 20, 35 и 50 уровне: Новичок, Боец, Воин, Чемпион, Легенда.' },
    { sel: '.gm-xpw', t: 'Опыт', d: 'Очки капают сами из того, что ты записываешь: тренировки, привычки, деньги, задачи, цели. Штрафов нет. Каждый следующий уровень чуть дороже.' },
    { sel: '.gm-tiles', t: 'Серия и щиты', d: 'Серия: дни подряд, когда было хоть одно дело в любом разделе. Каждые 7 дней подряд дают щит (до 3), он сам спасёт серию в пропущенный день.' },
    { sel: '.gm-path', t: 'Путь', d: 'Все облики персонажа. Следующие откроются на своём уровне.' },
    { sel: '.gm-ql', t: 'Квесты дня', d: 'Утром выбираешь, что берёшь. Отмечаются сами, когда делаешь дело в разделе. Закрыл все: бонус +50. Нажми на квест, чтобы перейти.' },
    { sel: '.gm-radar', t: 'Навыки', d: 'Сила от тренировок, Дисциплина от привычек, Капитал от финансов, Фокус от задач, Воля от целей и квестов. Чем ровнее фигура, тем гармоничнее прокачка.' },
    { sel: '.gm-week', t: 'Неделя', d: 'Сколько опыта набрал за каждый из последних 7 дней и из каких разделов.' },
    { sel: '.gm-cal', t: 'Календарь серии', d: 'Чем ярче день, тем больше сделал. Пунктир: день спас щит. Жёлтый: день отдыха. Дни отдыха и отпуск в настройках.' },
    { sel: '.gm-wr', t: 'Шкафчик', d: 'Облик, фон и рамка персонажа. Новые открываются за достижения и уровни. Пройденный облик можно надеть и прямо в «Пути».' },
    { sel: '.gm-chestrow', t: 'Сундук дня', d: 'Закрыл все квесты: открывай сундук. Внутри случайно опыт или щит, иногда редкая находка.' },
    { sel: '.gm-shop', t: 'Награды', d: 'Назначь себе приз и цену в XP: кино, кроссы, массаж. Опыт копится с момента первой награды. Покупка не снижает уровень.' },
    { sel: '.gm-ach', t: 'Достижения', d: 'Открываются сами по твоим данным. Серые ещё впереди, под ними прогресс.' },
  ];

  /* достижения: считаются из событий, не хранятся */
  function achievements(S) {
    const by = (k) => S.evs.filter(e => k.includes(e.k)), cnt = (...k) => by(k).length, days = (...k) => new Set(by(k).map(e => e.day)).size;
    const tr = cnt('train');
    /* идеальные недели: пн..вс, все 7 дней с делом */
    let pw = 0; const m0 = monday(new Date()), st = S.s.st, ks = Object.keys(st).sort();
    if (ks.length) for (let w = monday(fromYmd(ks[0])); w < m0; w.setDate(w.getDate() + 7)) { let ok = true; for (let i = 0; i < 7; i++) { const d = new Date(w); d.setDate(d.getDate() + i); if (st[ymd(d)] !== 'ok') { ok = false; break; } } if (ok) pw++; }
    return [
      { ico: 'ti-barbell', c: SK.str.color, id: 'tr1', t: 'Первая тренировка', v: tr, n: 1 },
      { ico: 'ti-barbell', c: SK.str.color, id: 'tr50', t: '50 тренировок', v: tr, n: 50 },
      { ico: 'ti-trophy', c: SK.str.color, id: 'tr100', t: '100 тренировок', v: tr, n: 100 },
      { ico: 'ti-arrow-big-up-lines', c: SK.str.color, id: 'pr10', t: '10 рекордов', v: cnt('pr'), n: 10 },
      { ico: 'ti-flame', c: '#FB923C', id: 'st7', t: 'Неделя подряд', v: S.s.best, n: 7 },
      { ico: 'ti-flame', c: '#FB923C', id: 'st30', t: 'Месяц подряд', v: S.s.best, n: 30 },
      { ico: 'ti-crown', c: '#FB923C', id: 'st100', t: '100 дней подряд', v: S.s.best, n: 100 },
      { ico: 'ti-calendar-star', c: '#FB923C', id: 'st365', t: 'Год подряд', v: S.s.best, n: 365 },
      { ico: 'ti-ruler-measure', c: SK.str.color, id: 'meas5', t: '5 замеров тела', v: cnt('meas'), n: 5 },
      { ico: 'ti-crown', c: '#FACC15', id: 'pw1', t: 'Идеальная неделя', v: pw, n: 1 },
      { ico: 'ti-crown', c: '#FACC15', id: 'pw4', t: '4 идеальные недели', v: pw, n: 4 },
      { ico: 'ti-gift', c: SK.wil.color, id: 'chest10', t: '10 сундуков', v: cnt('chest') + Object.values(S.c.quests).filter(q => q && q.chest && q.chest.kind === 'shield').length, n: 10 },
      { ico: 'ti-checks', c: SK.dis.color, id: 'hab30', t: '30 дней привычек', v: cnt('habday'), n: 30 },
      { ico: 'ti-wallet', c: SK.cap.color, id: 'money30', t: '30 дней учёта денег', v: days('spend', 'pay'), n: 30 },
      { ico: 'ti-pig-money', c: SK.cap.color, id: 'piggy10', t: '10 раз в копилку', v: cnt('piggy'), n: 10 },
      { ico: 'ti-target-arrow', c: SK.foc.color, id: 'task100', t: '100 задач', v: cnt('task'), n: 100 },
      { ico: 'ti-flag-3', c: SK.wil.color, id: 'goal1', t: 'Цель достигнута', v: cnt('goal'), n: 1 },
      { ico: 'ti-swords', c: SK.wil.color, id: 'qall10', t: '10 дней все квесты', v: cnt('qall'), n: 10 },
    ].map(a => Object.assign(a, { ok: a.v >= a.n }));
  }

  /* радар навыков (SVG) */
  function radar(lv) {
    const cx = 146, cy = 104, R = 78, ang = (i) => -Math.PI / 2 + i * 2 * Math.PI / 5;
    const pt = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))].map(v => v.toFixed(1)).join(',');
    const mx = Math.max(5, ...lv);
    const grid = [0.25, 0.5, 0.75, 1].map(f => `<polygon points="${SKO.map((_, i) => pt(i, R * f)).join(' ')}" class="g"/>`).join('');
    const axes = SKO.map((_, i) => `<line x1="${cx}" y1="${cy}" x2="${pt(i, R).split(',')[0]}" y2="${pt(i, R).split(',')[1]}" class="g"/>`).join('');
    const shape = SKO.map((_, i) => pt(i, R * Math.max(0.06, lv[i] / mx))).join(' ');
    const dots = SKO.map((k, i) => { const [x, y] = pt(i, R * Math.max(0.06, lv[i] / mx)).split(','); return `<circle cx="${x}" cy="${y}" r="4" fill="${SK[k].color}"/>`; }).join('');
    const lbl = SKO.map((k, i) => { const [x, y] = pt(i, R + 17).split(','); return `<text x="${x}" y="${(+y + 4).toFixed(1)}" text-anchor="middle" fill="${SK[k].color}">${SK[k].name}</text>`; }).join('');
    return `<svg class="gm-radar" viewBox="0 0 292 212" role="img" aria-label="Навыки">${grid}${axes}<g class="gm-rg"><polygon points="${shape}" class="s"/>${dots}</g>${lbl}</svg>`;
  }

  /* ── Экран «Персонаж» ── */
  const MON = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  function render(mount) {
    if (!avail()) { Router.go('/home'); return; }
    _mount = mount;
    let S = state(); const c = S.c, tq = todayQuests(), now = new Date(), today = ymd(now);
    /* вернуть серию: вчера пропуск без щита, серия была от 3 дней, сегодня закрыты все квесты */
    const yd = new Date(now); yd.setDate(yd.getDate() - 1); const yk = ymd(yd);
    let repair = null, repairedNow = false;
    if (S.s.st[yk] === 'miss') { const alt = streak(S.evs, Object.assign({}, c, { repairs: c.repairs.concat([yk]) }));
      if (alt.cur - S.s.cur >= 3) { repair = alt.cur;
        if (tq.picked && tq.list.length && tq.list.every(x => x.done)) { Store.set('game.repairs', c.repairs.concat([yk]).slice(-30)); S = state(); repairedNow = true; repair = null; } } }
    const pct = Math.round(S.L.into / S.L.need * 100);
    /* опыт по дням */
    const dayXp = {}, daySk = {};
    S.evs.forEach(e => { dayXp[e.day] = (dayXp[e.day] || 0) + e.xp; (daySk[e.day] = daySk[e.day] || {})[e.sk] = (daySk[e.day][e.sk] || 0) + e.xp; });
    const heat = (x) => !x ? '' : x >= 300 ? ' x4' : x >= 150 ? ' x3' : x >= 60 ? ' x2' : ' x1';
    /* календарь месяца */
    const y = now.getFullYear(), m = now.getMonth(), first = new Date(y, m, 1), lead = (first.getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
    let cal = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map(d => `<span class="h">${d}</span>`).join('') + '<span class="e"></span>'.repeat(lead);
    let okN = 0;
    for (let d = 1; d <= dim; d++) { const k = y + '-' + p2(m + 1) + '-' + p2(d), st = S.s.st[k] || '';
      if (st === 'ok') okN++;
      cal += `<span class="${st}${st === 'ok' ? heat(dayXp[k]) : ''}${k === today ? ' td' : ''}${k > today ? ' fu' : ''}">${d}</span>`; }
    /* неделя */
    const wk = []; for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); wk.push(d); }
    const wSum = wk.reduce((a, d) => a + (dayXp[ymd(d)] || 0), 0);
    let pSum = 0; for (let i = 7; i <= 13; i++) { const d = new Date(now); d.setDate(d.getDate() - i); pSum += dayXp[ymd(d)] || 0; }
    const wMax = Math.max(100, ...wk.map(d => dayXp[ymd(d)] || 0));
    const wDiff = pSum ? Math.round((wSum - pSum) / pSum * 100) : 0;
    const weekHtml = wk.map(d => { const k = ymd(d), t = dayXp[k] || 0, sk = daySk[k] || {};
      const seg = SKO.filter(x => sk[x]).map(x => `<i style="height:${(sk[x] / wMax * 100).toFixed(1)}%;background:${SK[x].color}"></i>`).join('');
      return `<div class="gm-wd${k === today ? ' td' : ''}"><b>${t ? num(t) : ''}</b><div class="gm-wb">${seg}</div><span>${DOW[d.getDay()]}</span></div>`; }).join('');
    /* навыки */
    const lv = SKO.map(k => skillLvl(S.sk[k] || 0)), weak = SKO[lv.indexOf(Math.min(...lv))];
    const skHtml = SKO.map((k, i) => { const x = S.sk[k] || 0, l = lv[i], toN = 40 * l * l - x;
      return `<button class="gm-sk" data-go="${SK[k].route}"><span class="gm-ski" style="--c:${SK[k].color}"><i class="ti ${SK[k].ico}"></i></span><span class="gm-skm"><span class="gm-skt"><b>${SK[k].name}</b>${k === weak && Math.max(...lv) > l ? '<u>подтянуть</u>' : ''}<em>ур. ${l}</em></span><span class="gm-skb"><i style="width:${Math.round(skillInto(x) * 100)}%;background:${SK[k].color}"></i></span><small>${SK[k].src} · до ${l + 1} ур. ${num(toN)} XP</small></span></button>`; }).join('');
    /* путь обликов */
    const pathHtml = TITLES.map((t, i) => { const st = i < S.stage ? 'past' : i === S.stage ? 'cur' : 'lock';
      return `<div class="gm-pst ${st}${i === lookOf(S) ? ' worn' : ''}" style="--gc:${GLOW[i]}"${st === 'lock' ? '' : ` data-look="${i}"`}>${heroImg(c.sex, i, 'tn')}${st === 'lock' ? '<span class="gm-lk"><i class="ti ti-lock"></i></span>' : ''}<b>${t[1]}</b><small>${st === 'lock' ? 'с ' + t[0] + ' ур.' : st === 'cur' ? 'сейчас' : 'пройден'}</small></div>`; }).join('');
    const pathPct = (() => { const a = TITLES[S.stage][0], b = S.next ? S.next[0] : a; const f = S.next ? Math.min(1, (S.L.lvl - a + S.L.into / S.L.need) / (b - a)) : 0; return ((S.stage + f) / 4 * 100).toFixed(1); })();
    /* достижения */
    const ach = achievements(S), achN = ach.filter(a => a.ok).length;
    const achHtml = ach.map(a => `<div class="gm-a${a.ok ? ' ok' : ''}" style="--c:${a.c}"><span class="gm-am"><i class="ti ${a.ico}"></i></span><b>${a.t}</b>${a.ok ? '<small>получено</small>' : `<span class="gm-ap"><i style="width:${Math.round(Math.min(1, a.v / a.n) * 100)}%"></i></span><small>${num(Math.min(a.v, a.n))} из ${num(a.n)}</small>`}</div>`).join('');
    /* квесты */
    const qDone = tq.picked ? tq.list.filter(x => x.done).length : 0, qAll = tq.picked && tq.list.length && qDone === tq.list.length;
    const ring = (d, n) => { const f = n ? d / n : 0, C = 2 * Math.PI * 15; return `<svg class="gm-ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="b"/><circle cx="18" cy="18" r="15" class="f" stroke-dasharray="${(C * f).toFixed(1)} ${C.toFixed(1)}"/><text x="18" y="22" text-anchor="middle">${d}/${n}</text></svg>`; };
    const fresh = new Set(tq.fresh || []);
    const qRow = (x, pickMode, i) => `<${pickMode ? 'button' : 'div'} class="gm-q${pickMode ? ' pick' + (i < c.qn ? ' on' : '') : x.done ? ' done' + (fresh.has(x.id) ? ' just' : '') : ''}" ${pickMode ? `data-id="${esc(x.id)}"` : `data-go="${esc(SK[x.sk] ? SK[x.sk].route : '')}"`} style="--c:${(SK[x.sk] || SK.dis).color}"><span class="gm-qi"><i class="ti ${(SK[x.sk] || SK.dis).ico}"></i></span><span class="gm-qm"><b>${esc(x.t)}</b><small>${esc((SK[x.sk] || SK.dis).name)}${x.s ? ' · ' + esc(x.s) : ''}</small></span><em>+${x.xp}</em><span class="gm-cb"><i class="ti ti-check"></i></span></${pickMode ? 'button' : 'div'}>`;
    const qHtml = !tq.picked
      ? `<div class="gm-card gm-qc"><div class="gm-h"><b>Что берёшь сегодня?</b><span>до ${c.qn}</span></div>
          <div class="gm-ql">${tq.cands.map((x, i) => qRow(x, true, i)).join('')}</div>
          <button class="gm-btn" id="gm-take"><i class="ti ti-swords"></i> Беру</button></div>`
      : `<div class="gm-card gm-qc"><div class="gm-h gm-hq"><b>Квесты дня</b>${ring(qDone, tq.list.length)}</div>
          <div class="gm-ql">${tq.list.map(x => qRow(x, false)).join('')}</div>
          <div class="gm-bonus${qAll ? ' on' : ''}"><i class="ti ti-star"></i><span>Бонус за все квесты</span><em>+50</em></div>
          ${qAll ? (tq.chest ? `<div class="gm-chestrow got"><i class="ti ti-gift"></i><span>${tq.chest.rare ? 'Редкий сундук' : 'Сундук дня'}</span><em>${tq.chest.kind === 'shield' ? '<i class="ti ti-shield"></i> щит' : '+' + tq.chest.xp + ' XP'}</em></div>` : `<button class="gm-chestrow" id="gm-chest"><i class="ti ti-gift"></i><span>Открыть сундук дня</span><i class="ti ti-chevron-right"></i></button>`)
                 : `<div class="gm-chestrow lock"><i class="ti ti-gift"></i><span>Сундук дня</span><em>после всех квестов</em></div>`}</div>`;
    /* награды */
    const coinsN = coins(S);
    const shopHtml = `<div class="gm-card gm-shop"><div class="gm-h"><b>Награды</b>${c.shopFrom ? `<span class="gm-coins"><i class="ti ti-coin"></i><b data-count="${coinsN}">${num(coinsN)}</b></span>` : ''}</div>
      ${c.rewards.map(r => { const ok = coinsN >= r.cost; return `<div class="gm-rw${ok ? ' ok' : ''}"><span class="gm-rwi"><i class="ti ti-gift"></i></span><span class="gm-rwm"><b>${esc(r.name)}</b><span class="gm-ap"><i style="width:${Math.round(Math.min(1, coinsN / r.cost) * 100)}%"></i></span><small>${ok ? 'можно брать' : 'ещё ' + num(r.cost - coinsN) + ' XP'}</small></span><button class="gm-rwb" data-buy="${esc(r.id)}"${ok ? '' : ' disabled'}><i class="ti ti-coin"></i>${num(r.cost)}</button><button class="gm-rwx" data-del="${esc(r.id)}" aria-label="Удалить"><i class="ti ti-x"></i></button></div>`; }).join('')}
      <button class="gm-add" id="gm-radd"><i class="ti ti-plus"></i>${c.rewards.length ? 'Добавить награду' : 'Назначь себе награду за XP'}</button>
      ${c.bought.length ? `<div class="gm-bought">${c.bought.slice(-3).reverse().map(b => { const d = new Date(+b.at); return `<span><i class="ti ti-check"></i>${esc(b.name)} · ${d.getDate()}.${p2(d.getMonth() + 1)}</span>`; }).join('')}</div>` : ''}</div>`;
    const repairHtml = repair ? `<div class="gm-card gm-repair"><span class="gm-rpi"><i class="ti ti-flame"></i></span><div><b>Верни серию ${repair} ${pl(repair, 'день', 'дня', 'дней')}</b><small>закрой все квесты сегодня</small></div></div>` : '';
    const perfectWk = wk.every(d => S.s.st[ymd(d)] === 'ok');
    const nextLv = S.L.lvl + 1;
    const lk = lookOf(S), bg = bgOf(S), fr = frOf(S), wi = wrItems(S), wNew = wi.filter(i => i.ok && !i.base && !c.seenItems.includes(i.key)).length;
    const wrHtml = `<button class="gm-card gm-wr" id="gm-wr"><div class="gm-h"><b>Шкафчик${wNew ? ` <u class="gm-newn">${wNew} ${pl(wNew, 'новое', 'новых', 'новых')}</u>` : ''}</b><span>${wi.filter(i => i.ok).length} из ${wi.length}</span></div>
      <div class="gm-wr-row"><span class="gm-wr-av">${frameWrap(heroImg(c.sex, lk, 'sm'), fr)}</span>
        <span class="gm-wr-c"><small>Облик</small><b>${TITLES[lk][1]}</b></span><span class="gm-wr-c"><small>Фон</small><b>${BGS.find(x => x.id === bg).n}</b></span><span class="gm-wr-c"><small>Рамка</small><b>${FRS.find(x => x.id === fr).n}</b></span><i class="ti ti-chevron-right"></i></div></button>`;
    mount.innerHTML = `<div class="gm-screen" style="--gc:${GLOW[lk]}">
      <div class="gm-top gm-bgv" data-bg="${bg}">${fxHtml(bg)}
        <div class="gm-nav"><button class="gm-back" id="gm-back" aria-label="Назад"><i class="ti ti-arrow-left"></i></button><b>Персонаж</b><span style="display:flex;gap:8px"><button class="gm-back" id="gm-help" aria-label="Подсказки"><i class="ti ti-help"></i></button><button class="gm-back" id="gm-set" aria-label="Настройки"><i class="ti ti-settings"></i></button></span></div>
        <div class="gm-hero-row">
          <div class="gm-stage"><div class="gm-sparks">${Array.from({ length: 16 }, (_, i) => `<i style="--l:${(8 + (i * 53) % 84)}%;--d:${(i * 0.37) % 5}s;--t:${4 + (i % 4)}s;--s:${3 + (i % 3)}px"></i>`).join('')}</div>${heroImg(c.sex, lk, 'xl')}<span class="gm-pod fr-${fr}"></span></div>
          <div class="gm-info">
            <div class="gm-who"><div class="gm-lvl"><span>${S.L.lvl}</span> уровень</div><div class="gm-title">${esc(S.title)}</div></div>
            <div class="gm-xpw"><div class="gm-xpt"><span>до ${nextLv} ур.</span><b data-count="${S.L.need - S.L.into}">${num(S.L.need - S.L.into)} XP</b></div><div class="gm-xp lg"><i style="width:${pct}%"></i></div><div class="gm-xps"><span>${num(S.L.into)} из ${num(S.L.need)}</span><span>${S.next ? esc(S.next[1]) + ' на ' + S.next[0] + ' ур.' : 'высший облик'}</span></div></div>
            <div class="gm-tiles">
              <div class="gm-tile f"><i class="ti ti-flame"></i><b data-count="${S.s.cur}">${S.s.cur}</b><span>${pl(S.s.cur, 'день', 'дня', 'дней')} подряд</span></div>
              <div class="gm-tile s"><i class="ti ti-shield"></i><b>${S.s.shields}<small>/3</small></b><span>щиты</span></div>
              <div class="gm-tile t"><i class="ti ti-bolt"></i><b data-count="${S.todayXp}" data-pre="+">+${num(S.todayXp)}</b><span>сегодня</span></div>
              <div class="gm-tile a"><i class="ti ti-star"></i><b data-count="${S.total}">${num(S.total)}</b><span>всего XP</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="gm-body">
        <div class="gm-col">
          ${repairHtml}${qHtml}
          <div class="gm-card"><div class="gm-h"><b>Навыки</b><span>лучший: ${SK[SKO[lv.indexOf(Math.max(...lv))]].name}</span></div>
            <div class="gm-skw">${radar(lv)}<div class="gm-skl">${skHtml}</div></div></div>
          ${shopHtml}
        </div>
        <div class="gm-col">
          <div class="gm-card"><div class="gm-h"><b>Путь</b><span>${S.stage + 1} из 5</span></div>
            <div class="gm-path"><div class="gm-pline"><i style="width:${pathPct}%"></i></div>${pathHtml}</div></div>
          ${wrHtml}
          <div class="gm-card"><div class="gm-h"><b>Неделя${perfectWk ? ' <u class="gm-pw"><i class="ti ti-crown"></i>идеальная</u>' : ''}</b><span>+${num(wSum)} XP${pSum ? ` · <em class="${wDiff >= 0 ? 'up' : 'dn'}">${wDiff >= 0 ? '+' : ''}${wDiff}%</em>` : ''}</span></div>
            <div class="gm-week">${weekHtml}</div></div>
          <div class="gm-card"><div class="gm-h"><b>Серия · ${MON[m]}</b><span>${okN} ${pl(okN, 'день', 'дня', 'дней')} · рекорд ${S.s.best}</span></div>
            <div class="gm-cal">${cal}</div>
            <div class="gm-leg"><span><i class="ok x1"></i><i class="ok x4"></i>было дело</span><span><i class="sh"></i>спас щит</span><span><i class="rest"></i>отдых</span>${Object.values(S.s.st).includes('rep') ? '<span><i class="rep"></i>вернул</span>' : ''}</div></div>
          ${S.todayEv.length ? `<div class="gm-card"><div class="gm-h"><b>Сегодня</b><span>+${num(S.todayXp)} XP</span></div>${S.todayEv.slice(-8).reverse().map(e => `<div class="gm-ev" style="--c:${SK[e.sk].color}"><span class="gm-evi"><i class="ti ${SK[e.sk].ico}"></i></span><span>${esc(e.t)}</span><b>+${e.xp}</b></div>`).join('')}</div>` : ''}
        </div>
        <div class="gm-card gm-wide"><div class="gm-h"><b>Достижения</b><span>${achN} из ${ach.length}</span></div>
          <div class="gm-ach">${achHtml}</div></div>
      </div></div>`;
    const $ = (q) => mount.querySelector(q);
    $('#gm-back').onclick = () => Router.go('/home');
    $('#gm-set').onclick = () => settings(() => render(mount));
    $('#gm-help').onclick = () => { if (window.Tour && Tour.play) Tour.play(TIPS.filter(x => document.querySelector(x.sel)), 'screen:/hero'); };
    mount.querySelectorAll('[data-go]').forEach(b => { if (b.dataset.go) b.onclick = () => Router.go(b.dataset.go); });
    mount.querySelectorAll('.gm-q.pick').forEach(b => b.onclick = () => { const onN = mount.querySelectorAll('.gm-q.pick.on').length; if (!b.classList.contains('on') && onN >= c.qn) return; b.classList.toggle('on'); });
    const tk = $('#gm-take'); if (tk) tk.onclick = () => { const ids = [...mount.querySelectorAll('.gm-q.pick.on')].map(b => b.dataset.id); if (!ids.length) return; pick(ids); render(mount); };
    $('#gm-wr').onclick = () => wardrobe(() => render(mount));
    mount.querySelectorAll('[data-look]').forEach(b => b.onclick = () => { Store.set('game.look', +b.dataset.look); render(mount); });
    const ch = $('#gm-chest'); if (ch) ch.onclick = () => openChest(() => render(mount));
    const ra = $('#gm-radd'); if (ra) ra.onclick = () => rewardModal(() => render(mount));
    /* покупка и удаление: второе нажатие подтверждает */
    const twice = (b, label, act) => { if (b.classList.contains('sure')) { act(); return; } b.classList.add('sure'); const old = b.innerHTML; b.innerHTML = label; setTimeout(() => { if (b.isConnected) { b.classList.remove('sure'); b.innerHTML = old; } }, 2600); };
    mount.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => twice(b, 'Беру', () => { const cc = cfg(), r = cc.rewards.find(x => x.id === b.dataset.buy); if (!r || coins(state()) < r.cost) return;
      Store.set('game.bought', cc.bought.concat([{ id: r.id, name: r.name, cost: r.cost, at: Date.now() }]).slice(-100));
      overlay(`<div class="gm-rays gold"></div><div class="gm-chest opened"><div class="gm-chest-b"><i class="ti ti-gift"></i></div></div><div class="gm-flash-k">Награда твоя</div><div class="gm-flash-l sm">${esc(r.name)}</div><p>Заслужил. Минус ${num(r.cost)} XP из копилки наград, уровень не трогаю.</p><button class="gm-btn" data-close>Кайф</button>`, { cls: 'gm-buy', onClose: () => render(mount) }); }));
    mount.querySelectorAll('[data-del]').forEach(b => b.onclick = () => twice(b, '<i class="ti ti-trash"></i>', () => { const cc = cfg(); Store.set('game.rewards', cc.rewards.filter(x => x.id !== b.dataset.del)); render(mount); }));
    if (repairedNow) overlay(`<div class="gm-rays warm"></div><div class="gm-fire"><i class="ti ti-flame"></i>${'<span></span>'.repeat(10)}</div><div class="gm-flash-l">${S.s.cur} ${pl(S.s.cur, 'день', 'дня', 'дней')}</div><div class="gm-flash-k warm">серия вернулась</div><p>Вчерашний пропуск закрыт квестами.</p><button class="gm-btn warm" data-close>Огонь</button>`, { cls: 'gm-streak' });
    countUp(mount);
    checkLevelUp();
  }
  /* цифры набегают от нуля */
  function countUp(root) {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    root.querySelectorAll('[data-count]').forEach(el => { const to = +el.dataset.count || 0, pre = el.dataset.pre || '', suf = el.textContent.replace(/^[^\d]*[\d\s]*\d/, ''); if (to < 2) return;
      const t0 = performance.now(), D = 900; const step = (t) => { const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); el.textContent = pre + num(to * e) + suf; if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); });
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
