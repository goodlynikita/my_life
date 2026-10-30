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
    str: { name: 'Сила', src: 'тренировки', color: '#60A5FA', ico: 'ti-barbell', route: '/training' },
    dis: { name: 'Дисциплина', src: 'привычки', color: '#4ADE80', ico: 'ti-checks', route: '/habits' },
    cap: { name: 'Капитал', src: 'финансы', color: '#A78BFA', ico: 'ti-coin', route: '/finance' },
    foc: { name: 'Фокус', src: 'задачи', color: '#F0645A', ico: 'ti-target', route: '/tasks' },
    wil: { name: 'Воля', src: 'цели', color: '#F2A93B', ico: 'ti-flag-3', route: '/goals' },
  };
  const SKO = ['str', 'dis', 'cap', 'foc', 'wil'];
  const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const GLOW = ['#64748B', '#4A7CFF', '#8B5CF6', '#F59E0B', '#FACC15'];
  const TITLES = [[1, 'Новичок'], [10, 'Боец'], [20, 'Воин'], [35, 'Чемпион'], [50, 'Легенда']];

  function cfg() { const g = (Store.get() || {}).game || {}; return { on: g.on !== false, sex: g.sex === 'f' ? 'f' : 'm', qn: [2, 3, 5].includes(+g.qn) ? +g.qn : 3, rest: toArr(g.rest).map(Number).filter(n => n >= 0 && n <= 6), vacs: toArr(g.vacs).filter(v => v && v.from), quests: (g.quests && typeof g.quests === 'object') ? g.quests : {}, seenLvl: +g.seenLvl || 0,
    repairs: toArr(g.repairs).map(String), seenSt: g.seenSt == null ? null : +g.seenSt || 0, seenWeek: g.seenWeek || null,
    rewards: toArr(g.rewards).filter(r => r && r.id && r.name), bought: toArr(g.bought).filter(b => b && b.at), shopFrom: g.shopFrom || null,
    look: g.look == null || g.look === '' ? null : +g.look, bg: g.bg || 'base', frame: g.frame || 'none', seenItems: toArr(g.seenItems).map(String), mode: g.mode === 'min' ? 'min' : 'hero', news: toArr(g.news).filter(n => n && n.kind), gotItems: g.gotItems == null ? null : toArr(g.gotItems).map(String), needsOff: toArr(g.needsOff).map(String), seenNeed: (g.seenNeed && typeof g.seenNeed === 'object') ? g.seenNeed : {}, seenTraits: g.seenTraits == null ? null : toArr(g.seenTraits).map(String) }; }
  /* открыт всем, кто вошёл; скрыть с главной: меню «···» → Персонаж */
  const avail = () => { try { return !!(window.FirebaseSync && FirebaseSync.currentUser && FirebaseSync.currentUser()); } catch (e) { return false; } };
  const on = () => avail() && cfg().on;

  /* ── Уровни ── */
  const cum = (L) => (L - 1) * 100 + 10 * (L - 1) * L; /* XP, нужный для уровня L */
  function levelOf(xp) { let L = 1; while (cum(L + 1) <= xp && L < 200) L++; return { lvl: L, from: cum(L), to: cum(L + 1), into: xp - cum(L), need: cum(L + 1) - cum(L) }; }
  const titleOf = (L) => { let t = TITLES[0]; TITLES.forEach(x => { if (L >= x[0]) t = x; }); return t[1]; };
  const stageOf = (L) => { let s = 0; TITLES.forEach((x, i) => { if (L >= x[0]) s = i; }); return s; };
  const nextStage = (L) => TITLES.find(x => x[0] > L) || null;
  /* рост внутри облика: каждый уровень чуть крупнее, ярче контур и аура, новый знак ранга */
  function grow(L) {
    const s = stageOf(L), a = TITLES[s][0], b = TITLES[s + 1] ? TITLES[s + 1][0] : a + 10;
    const n = b - a, k = s === 4 ? ((L - a) % 10) + 1 : L - a + 1;
    return { s, n, k, g: s === 4 ? 1 : (n > 1 ? (k - 1) / (n - 1) : 1), stars: s === 4 ? Math.floor((L - a) / 10) : 0 };
  }
  const SKG = { str: 'силы', dis: 'дисциплины', cap: 'капитала', foc: 'фокуса', wil: 'воли' };
  const TRAIT = { str: ['плечи шире', 'хват крепче', 'спина ровнее', 'руки сильнее'], dis: ['осанка ровнее', 'ритм устойчивее', 'режим крепче'], cap: ['опора надёжнее', 'взгляд спокойнее', 'запас прочнее'], foc: ['взгляд острее', 'голова яснее', 'шаг увереннее'], wil: ['шаг твёрже', 'характер крепче', 'цель ближе'] };
  /* цвет ауры: навык, который качаешь больше всего за 2 недели */
  function auraSk(S) {
    const lim = ymd(new Date(Date.now() - 14 * 864e5)), m = {};
    S.evs.forEach(e => { if (e.sk && e.day >= lim) m[e.sk] = (m[e.sk] || 0) + (e.xp || 0); });
    if (!Object.keys(m).length) S.evs.forEach(e => { if (e.sk) m[e.sk] = (m[e.sk] || 0) + (e.xp || 0); });
    return SKO.reduce((b, k) => (m[k] || 0) > (m[b] || 0) ? k : b, 'str');
  }
  const growVars = (L, ak) => { const g = grow(L).g, c = SK[ak].color; return `--hs:${(0.93 + 0.07 * g).toFixed(3)};--gs:${(0.82 + 0.26 * g).toFixed(2)};--ac:${c};--ap:${Math.round(30 + 35 * g)}%;--gz:${Math.round(260 + 100 * g)}px;--rim:${c}${Math.round(30 + 120 * g).toString(16).padStart(2, '0')};--rb:${(3 + 11 * g).toFixed(1)}px`; };
  function pipsHtml(L, ak) {
    const r = grow(L);
    return `<div class="gm-pips"><span class="gm-pipr">${Array.from({ length: r.n }, (_, i) => `<i class="${i < r.k ? 'on' : ''}${i === r.k - 1 ? ' cur' : ''}"></i>`).join('')}</span><small>${r.stars ? '<b>★' + r.stars + '</b> ' : ''}ранг ${r.k} из ${r.n} · <em style="color:${SK[ak].color}">аура ${SKG[ak]}</em></small></div>`;
  }
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

  /* ── Состояние персонажа: 5 потребностей от сфер. Каждый стартует с 70 («в форме»), с первого своего дела.
     Каждый прожитый день без дел убывает, дела пополняют (до 100). Отпуск замораживает, дни отдыха щадят Силу.
     Сфера без единой записи или выключенная в настройках на настроение не влияет ── */
  const NEED = {
    str: { decay: 9, rest: 3, st: ['заряжен', 'в тонусе', 'засиделся', 'тело просит движения'], fix: 'тренировка, теннис или шаги' },
    dis: { decay: 14, st: ['железный режим', 'режим держится', 'режим поплыл', 'всё вразнос'], fix: 'отметь привычки дня' },
    cap: { decay: 6, st: ['спокоен за деньги', 'деньги под контролем', 'траты без учёта', 'тревожно за деньги'], fix: 'запиши траты или оплату' },
    foc: { decay: 10, st: ['ясная голова', 'в фокусе', 'дела копятся', 'голова в тумане'], fix: 'закрой пару задач' },
    wil: { decay: 6, st: ['горит целью', 'держит курс', 'теряет запал', 'потерял цель'], fix: 'закрой все квесты дня' },
  };
  const NGAIN = { train: 35, steps: 10, pr: 15, meas: 10, habday: 20, pay: 25, piggy: 25, goal: 60, qall: 25, quest: 8, chest: 0 };
  const gainOf = (e) => e.k === 'hab' ? Math.round(e.xp * 0.6) : e.k === 'spend' ? Math.round(e.xp * 1.2) : e.k === 'task' ? (e.xp >= 20 ? 18 : 12) : (NGAIN[e.k] != null ? NGAIN[e.k] : 10);
  const needSt = (k, v) => NEED[k].st[v >= 80 ? 0 : v >= 55 ? 1 : v >= 30 ? 2 : 3];
  const MOODS = [['Выдохся', '#F0645A', 'ti-mood-sad'], ['Устал', '#F2A93B', 'ti-mood-empty'], ['Норм', '#94A3B8', 'ti-mood-smile'], ['В форме', '#4A7CFF', 'ti-mood-happy'], ['В ударе', '#4ADE80', 'ti-bolt']];
  const TR_DAYS = 30;
  const TRT = { str: ['Спортсмен', 'Спортсменка', 'ti-run'], dis: ['Человек режима', 'Человек режима', 'ti-clock-check'], cap: ['Бережливый', 'Бережливая', 'ti-pig-money'], foc: ['Собранный', 'Собранная', 'ti-target-arrow'], wil: ['Целеустремлённый', 'Целеустремлённая', 'ti-mountain'] };
  const trName = (k) => TRT[k][cfg().sex === 'f' ? 1 : 0];
  const sx = (t) => String(t).replace(/\{([^|}]*)\|([^}]*)\}/g, (_, m, f) => cfg().sex === 'f' ? f : m);
  function needs(S) {
    const c = S.c, today = ymd(new Date()), per = {}, first = {};
    const put = (d, k, g) => { (per[d] = per[d] || {})[k] = (per[d][k] || 0) + g; if (!first[k] || d < first[k]) first[k] = d; };
    S.evs.forEach(e => { const g = gainOf(e); if (g > 0 && SK[e.sk]) put(e.day, e.sk, g); });
    S.s.act.forEach(d => put(d, 'wil', 8)); /* любой день с делом держит Волю */
    const isVac = (k) => c.vacs.some(v => k >= v.from && (!v.to || k <= v.to));
    const lim = ymd(new Date(Date.now() - 400 * 864e5)), n = {};
    SKO.forEach(k => {
      if (!first[k]) { n[k] = { on: false, why: 'new', v: 70, d: 0, tr: false, hi: 0 }; return; }
      /* черта: 30 дней подряд выше 80, сфера тает на 30% медленнее; 14 дней ниже 30 и черта уходит */
      let v = 70, y = 70, hi = 0, lo = 0, tr = false;
      for (let d = fromYmd(first[k] < lim ? lim : first[k]); ymd(d) <= today; d.setDate(d.getDate() + 1)) {
        const key = ymd(d), g = Math.min(k === 'wil' ? 90 : 60, (per[key] || {})[k] || 0);
        if (key === today) { y = v; v = Math.min(100, v + g); break; }
        v = Math.min(100, v + g);
        if (!isVac(key)) {
          if (v >= 80) { hi++; if (hi >= TR_DAYS) tr = true; } else hi = 0;
          if (v < 30) { lo++; if (lo >= 14) tr = false; } else lo = 0;
          v -= ((k === 'str' && c.rest.includes(d.getDay())) ? NEED.str.rest : NEED[k].decay) * (tr ? 0.7 : 1);
        }
        v = Math.max(5, v);
      }
      n[k] = { on: !c.needsOff.includes(k), why: c.needsOff.includes(k) ? 'off' : '', v: Math.round(v), d: Math.round(v - y), tr, hi };
    });
    const on = SKO.filter(k => n[k].on), vals = on.map(k => n[k].v);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 70, mn = vals.length ? Math.min(...vals) : 70;
    /* мудлеты: свежие события дают плюс к настроению, провалы видно отдельно */
    const y1 = ymd(new Date(Date.now() - 864e5)), rec = S.evs.filter(e => e.day >= y1), ml = [];
    if (rec.some(e => e.k === 'pr')) ml.push({ t: 'Гордится рекордом', ico: 'ti-trophy', c: '#60A5FA', p: 1 });
    if (rec.some(e => e.k === 'goal')) ml.push({ t: 'Цель взята', ico: 'ti-flag-3', c: '#F2A93B', p: 1 });
    if (rec.some(e => e.k === 'qall')) ml.push({ t: 'Всё закрыл', ico: 'ti-star', c: '#8B5CF6', p: 1 });
    if (S.s.cur >= 7) ml.push({ t: S.s.cur + ' ' + pl(S.s.cur, 'день', 'дня', 'дней') + ' подряд', ico: 'ti-flame', c: '#FB923C', p: 1 });
    if (isVac(today)) ml.push({ t: 'В отпуске', ico: 'ti-beach', c: '#38BDF8', p: 1 });
    const score = Math.min(100, Math.round(avg * 0.6 + mn * 0.4 + ml.filter(m => m.p).length * 4));
    const m = score >= 85 ? 4 : score >= 65 ? 3 : score >= 45 ? 2 : score >= 25 ? 1 : 0;
    const worst = on.slice().sort((a, b) => n[a].v - n[b].v)[0] || null;
    return { n, on, score, m, mood: MOODS[m], ml, worst };
  }
  /* как состояние меняет персонажа: краски, дыхание, аура */
  const moodVars = (N) => `--ms:${[0.5, 0.72, 0.9, 1, 1.12][N.m]};--mb:${[0.8, 0.9, 0.97, 1, 1.04][N.m]};--mt:${[7, 6, 5, 4.6, 3.4][N.m]}s;--mk:${[0.35, 0.6, 0.85, 1, 1.25][N.m]}${N.m < 2 ? ';--rim:rgba(120,130,150,.25)' : ''}`;
  /* эффекты над головой: мысль о самой просевшей потребности, сонные «z», туман, тучка */
  function moodFx(N) {
    const w = N.worst, low = w && N.n[w].v < 45, o = [];
    if (low) o.push(`<span class="gm-think" style="--c:${SK[w].color}"><i class="ti ${SK[w].ico}"></i></span>`);
    else if (N.m === 4) o.push(`<span class="gm-think happy" style="--c:#4ADE80"><i class="ti ti-bolt"></i></span>`);
    if (N.n.str.on && N.n.str.v < 30) o.push('<span class="gm-zz"><b>z</b><b>z</b><b>z</b></span>');
    if (N.n.foc.on && N.n.foc.v < 30) o.push('<span class="gm-fog"><i></i><i></i></span>');
    if (N.m === 0) o.push('<span class="gm-rain"><i class="ti ti-cloud-filled"></i><u></u><u></u><u></u><u></u></span>');
    return o.length ? `<div class="gm-mfx">${o.join('')}</div>` : '';
  }
  /* ── Реплики: персонаж говорит по состоянию. Сам всплывает только когда поменялся повод, раз в день на повод ── */
  const SAY = {
    'low:str': ['Я засидел{ся|ась}. Может, хоть пройдёмся?', 'Мышцы скучают по железу', 'Кости хрустят. Пора размяться', 'Давно не потели вместе', 'Тело просит движения, я серьёзно', 'Шаги тоже считаются, если что'],
    'low:dis': ['Режим поплыл. Давай хоть одну привычку', 'Привычки сами себя не отметят', 'Без режима я как без будильника', 'Одна галочка, и мне уже легче', 'Чуть-чуть порядка, и я снова в строю'],
    'low:cap': ['Куда ушли деньги? Я не знаю, и это тревожно', 'Запиши траты, мне так спокойнее', 'Без учёта денег я нервничаю', 'Пара строк в расходах, и я выдохну'],
    'low:foc': ['В голове туман. Закроем пару задач?', 'Дела копятся, я это чувствую', 'Одна закрытая задача, и уже яснее', 'Теряю фокус. Помоги'],
    'low:wil': ['Куда мы вообще идём? Напомни цель', 'Запал гаснет. Закроем все квесты дня?', 'Мне нужна маленькая победа', 'Вернём ритм, по одному делу в день'],
    m4: ['Я в ударе. Не сбавляем', 'Чувствую себя легендой', 'Вот это форма. Так держать', 'Энергии через край', 'Сегодня мы непобедимы', 'Красота. Всё под контролем'],
    m3: ['Всё ровно. Держим темп', 'Хороший день, чтобы стать сильнее', 'Я готов{|а}. Что сегодня берём?', 'Чувствую себя хорошо', 'Шаг за шагом, и всё получается'],
    m2: ['Норм, но можно лучше', 'Средненько. Подтянем что-нибудь?', 'Я в порядке. Пока что', 'Есть куда расти, и это хорошо'],
    m1: ['Что-то я подустал{|а}', 'Давай одно маленькое дело, и станет легче', 'Не лучший период, но мы вытащим'],
    m0: ['Я выдохся. Помоги мне', 'Всё навалилось. Начнём с малого?', 'Одно дело сегодня, и я оживу'],
    'r:pr': ['Новый рекорд! Я горжусь нами', 'Видел{|а}, сколько подняли? Это мы'],
    'r:goal': ['Цель взята! Это было мощно', 'Мы это сделали. Следующая?'],
    'r:qall': ['Все квесты закрыты. Я доволен{|ьна}', 'День закрыт полностью. Уважаю'],
    'r:train': ['Вот это тренировка. Чувствую силу', 'После зала я другой человек', 'Пампануло. Кайф', 'Мышцы гудят, и это приятно'],
    'r:task': ['Минус задача. Голова легче', 'Люблю закрывать дела', 'Список тает, а я расту'],
    'r:cap': ['Деньги посчитаны, спится лучше', 'Копилка растёт, и я вместе с ней', 'Всё по полочкам. Спокойно'],
    'r:hab': ['Галочки радуют глаз', 'Режим держим. Уважаю', 'Ещё один день по плану'],
    vac: ['Отпуск. Я заслужил{|а}', 'Отдыхаем, всё заморожено', 'Перезаряжаюсь. Потом вернусь сильнее'],
  };
  function sayCat(S, N) {
    const today = ymd(new Date()), ks = new Set(S.evs.filter(e => e.day === today).map(e => e.k));
    if (c_isVac(S, today)) return 'vac';
    const r = ['pr', 'goal', 'qall', 'train', 'task'].find(k => ks.has(k)) || (['pay', 'piggy', 'spend'].some(k => ks.has(k)) ? 'cap' : '') || (['hab', 'habday'].some(k => ks.has(k)) ? 'hab' : '');
    if (r) return 'r:' + r;
    if (N.worst && N.n[N.worst].v < 45) return 'low:' + N.worst;
    return 'm' + N.m;
  }
  const c_isVac = (S, k) => S.c.vacs.some(v => k >= v.from && (!v.to || k <= v.to));
  const dayNo = () => Math.floor((Date.now() + 3 * 36e5) / 864e5);
  let _sayTap = 0, _sayTm = null;
  function sayText(cat, shift) { const L = SAY[cat] || SAY.m3; return sx(L[(dayNo() + (shift || 0)) % L.length]); }
  function bindSay(mount, S, N) {
    if (!mount.querySelector('#gm-say')) return;
    const cat = sayCat(S, N);
    const show = (t) => { const st = mount.querySelector('.gm-stage'), box = mount.querySelector('#gm-say'); if (!st || !box) return; box.textContent = t; st.classList.add('saying'); box.classList.remove('in'); void box.offsetWidth; box.classList.add('in'); clearTimeout(_sayTm); _sayTm = setTimeout(() => { box.classList.remove('in'); st.classList.remove('saying'); }, 6500); };
    let shown = []; try { const x = JSON.parse(localStorage.getItem('you_gm_say') || '{}'); shown = x.d === ymd(new Date()) ? (x.c || []) : []; } catch (e) {}
    if (!shown.includes(cat)) { setTimeout(() => { if (mount.isConnected) show(sayText(cat)); }, 900); try { localStorage.setItem('you_gm_say', JSON.stringify({ d: ymd(new Date()), c: shown.concat([cat]) })); } catch (e) {} }
    const st = mount.querySelector('.gm-stage'), hero = st.querySelector('.gm-hero') || st; hero.style.cursor = 'pointer';
    hero.onclick = () => { _sayTap++; show(sayText(cat, _sayTap)); };
  }
  /* ── Вещи у ног: появляются, пока сфера выше 80 ── */
  /* 3D-рендеры (three.js, свет как у персонажа), img/hero/props/{сфера}.webp */
  const PROPS = Object.fromEntries(SKO.map(k => [k, `<img src="img/hero/props/${k}.webp" alt="" draggable="false">`]));
  const propsOf = (N) => SKO.filter(k => N.n[k].on && N.n[k].v >= 80);
  function propsHtml(N, fresh) {
    const ps = propsOf(N); if (!ps.length || isMin()) return '';
    return `<div class="gm-props">${['wil', 'str', 'cap', 'foc', 'dis'].filter(k => ps.includes(k)).map(k => `<span class="gm-prop p-${k}${fresh.includes(k) ? ' new' : ''}" title="${SK[k].name} выше 80">${PROPS[k]}</span>`).join('')}</div>`;
  }
  /* прошлый заход: чтобы шкалы доливались на глазах, а новые вещи появлялись с эффектом */
  function lastSeen() { try { return JSON.parse(localStorage.getItem('you_gm_nv') || 'null'); } catch (e) { return null; } }
  function reactNeeds(mount, N, old) {
    try { localStorage.setItem('you_gm_nv', JSON.stringify({ v: Object.fromEntries(SKO.map(k => [k, N.n[k].on ? N.n[k].v : null])), p: propsOf(N) })); } catch (e) {}
    if (!old || !old.v) return;
    const pops = [];
    SKO.forEach((k, i) => { const o = old.v[k], v = N.n[k].v; if (o == null || !N.n[k].on || o === v) return;
      const row = mount.querySelectorAll('.gm-nd')[i]; if (row) { row.style.setProperty('--v', o + '%'); setTimeout(() => row.style.setProperty('--v', v + '%'), 450); }
      if (v > o) pops.push(`<span style="--c:${SK[k].color};--i:${pops.length}">+${v - o} ${SK[k].name}</span>`); });
    const st = mount.querySelector('.gm-stage');
    if (pops.length && st) { const box = document.createElement('div'); box.className = 'gm-pops'; box.innerHTML = pops.join(''); st.appendChild(box); st.classList.add('joy'); setTimeout(() => { st.classList.remove('joy'); }, 1300); setTimeout(() => box.remove(), 2600 + pops.length * 250); }
  }
  /* черты: новая вспышкой (одна за заход, остальное в «Новое»), потерянная тихо */
  function traitFlash(k, manual) {
    overlay(`<div class="gm-rays"></div><div class="gm-trbig" style="--c:${SK[k].color}"><i class="ti ${TRT[k][2]}"></i></div>
      <div class="gm-flash-k">Новая черта</div><div class="gm-flash-l">${trName(k)}</div><div class="gm-flash-t">${SK[k].name} тает медленнее</div>
      <p>${sx('Ты месяц держал{|а} ' + SK[k].name.toLowerCase().replace(/а$/, 'у').replace(/я$/, 'ю') + ' выше 80. Черта с тобой, пока не запустишь сферу на 2 недели.')}</p>
      <button class="gm-btn" data-close>Круто</button>`, { cls: 'gm-lvlup', news: manual ? null : { kind: 'trait', key: 'trait:' + k, k } });
  }
  function checkTraits(S, N) {
    const cur = SKO.filter(k => N.n[k].tr), seen = S.c.seenTraits || [];
    const got = cur.filter(k => !seen.includes(k)), lost = seen.filter(k => !cur.includes(k));
    if (!got.length && !lost.length) return;
    Store.set('game.seenTraits', cur);
    got.forEach(k => traitFlash(k));
    lost.forEach(k => addNews({ kind: 'trlost', key: 'trlost:' + k, k }));
  }
  function needsHtml(S, N) {
    const rows = SKO.map(k => { const x = N.n[k], sk = SK[k];
      const st = x.on ? needSt(k, x.v) : x.why === 'off' ? 'не учитывается' : 'ещё нет записей';
      return `<button class="gm-nd${x.on ? '' : ' off'}${x.on && x.v < 30 ? ' low' : ''}" data-go="${sk.route}" style="--c:${sk.color};--v:${x.on ? x.v : 0}%">
        <span class="gm-ndi"><i class="ti ${sk.ico}"></i></span>
        <span class="gm-ndm"><span class="gm-ndt"><b>${sk.name}${x.tr ? `<i class="ti ${TRT[k][2]} gm-ndtr" title="${trName(k)}"></i>` : ''}</b><small>${st}</small></span><span class="gm-ndb"><i></i></span>${x.on && x.v < 45 ? `<small class="gm-ndf">${NEED[k].fix}</small>` : x.on && !x.tr && x.hi >= 3 && x.v >= 80 ? `<small class="gm-ndf p">черта «${trName(k)}»: ${x.hi} из ${TR_DAYS} дней</small>` : ''}</span>
        <em>${x.on && x.d > 0 ? '+' + x.d : ''}</em></button>`; }).join('');
    const trs = SKO.filter(k => N.n[k].tr).map(k => ({ t: trName(k), ico: TRT[k][2], c: SK[k].color, p: 1, tr: 1 }));
    N = Object.assign({}, N, { ml: trs.concat(N.ml) });
    const ml = N.ml.length ? `<div class="gm-ml">${N.ml.map(m => `<span style="--c:${m.c}"${m.tr ? ' class="tr"' : ''}><i class="ti ${m.ico}"></i>${esc(m.t)}</span>`).join('')}</div>` : '';
    return `<div class="gm-card gm-needs"><div class="gm-h"><b>Состояние</b><span class="gm-mood" style="--c:${N.mood[1]}"><i class="ti ${N.mood[2]}"></i>${N.mood[0]}</span></div>${ml}<div class="gm-ndl">${rows}</div></div>`;
  }
  /* просела потребность: тихая строка в «Новом», не чаще раза в 3 дня на сферу */
  function checkNeeds(S, N) {
    const c = S.c, today = ymd(new Date()), lim = ymd(new Date(Date.now() - 3 * 864e5)), seen = Object.assign({}, c.seenNeed); let ch = false;
    /* одна строка на всё: самая просевшая сфера */
    const w = N.worst;
    if (w && N.n[w].v < 30 && !(seen.all && seen.all > lim)) { seen.all = today; ch = true; addNews({ kind: 'need', key: 'need', k: w }); }
    const rm = c.news.filter(x => x.kind === 'need' && (!w || N.n[w].v >= 30));
    if (rm.length) Store.set('game.news', cfg().news.filter(x => !rm.some(r => r.key === x.key)));
    if (ch) Store.set('game.seenNeed', seen);
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
  const EMB = ['ti-seedling', 'ti-shield', 'ti-sword', 'ti-trophy', 'ti-crown'];
  const isMin = () => cfg().mode === 'min';
  function heroImg(sex, stage, cls) {
    if (isMin()) return `<div class="gm-hero gm-emb ${cls || ''}" data-stage="${stage}" style="--ec:${GLOW[Math.min(4, stage)]}"><i class="ti ${EMB[Math.min(4, stage)]}"></i></div>`;
    const src = 'img/hero/' + sex + (Math.min(4, stage) + 1) + '.webp';
    return `<div class="gm-hero ${cls || ''}" data-stage="${stage}">${HAS_IMG ? `<img src="${src}" alt="Персонаж" onerror="this.remove()">` : ''}<div class="gm-hero-ph"><i class="ti ti-user"></i></div></div>`;
  }

  /* ── Полоска на главной ── */
  function homeHtml() {
    if (!on()) return '';
    const S = state(), tq = todayQuests(), qd = tq.picked ? tq.list.filter(x => x.done).length : 0, qn = tq.picked ? tq.list.length : 0;
    const pct = Math.round(S.L.into / S.L.need * 100), N = needs(S);
    return `<button class="gm-bar" id="gm-bar" aria-label="Персонаж">
      <span class="gm-bar-av" style="${moodVars(N)}">${frameWrap(S.c.mode === 'min' ? `<div class="gm-hero sm gm-mini" style="--ec:${GLOW[lookOf(S)]};--p:${pct}"><b>${S.L.lvl}</b></div>` : heroImg(S.c.sex, lookOf(S), 'sm'), frOf(S))}${S.c.news.length ? '<span class="gm-bar-dot"></span>' : ''}</span>
      <span class="gm-bar-m"><span class="gm-bar-t"><b>${esc(S.title)}</b><span>${S.L.lvl} уровень</span><span class="gm-bar-md" style="--c:${N.mood[1]}">${N.mood[0]}</span></span>
        <span class="gm-bar-s">${tq.picked ? 'Квесты ' + qd + ' из ' + qn + (qd === qn ? ', все закрыты' : '') : 'Выбери квесты на сегодня'}${S.todayXp ? ' · <b>+' + num(S.todayXp) + ' XP</b>' : ''}</span></span>
      ${S.s.cur ? `<span class="gm-bar-r"><b><i class="ti ti-flame"></i>${S.s.cur}</b><small>${pl(S.s.cur, 'день', 'дня', 'дней')}</small></span>` : ''}
      <span class="gm-bar-line"><i style="width:${pct}%"></i></span></button>`;
  }
  function bindHome(root) { const b = root.querySelector('#gm-bar'); if (b) b.onclick = () => Router.go('/hero'); setTimeout(() => { if (b && b.isConnected) checkLevelUp(); }, 1200); }

  /* ── Вспышки: уровень, серия, итоги недели, сундук. Идут по очереди ── */
  const _q = []; let _autoShown = false, _newsTimer = null;
  function addNews(n) {
    const list = cfg().news.filter(x => x.key !== n.key).concat([Object.assign({ at: Date.now() }, n)]).slice(-12);
    Store.set('game.news', list);
    clearTimeout(_newsTimer); _newsTimer = setTimeout(() => { if (_mount && _mount.isConnected && !document.querySelector('.gm-flash')) render(_mount, true); }, 60);
  }
  function overlay(html, opts) {
    opts = opts || {};
    if (opts.news) { if (_autoShown || document.querySelector('.gm-flash')) { addNews(opts.news); return; } _autoShown = true; }
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
    if (!on()) return;
    /* идут подсказки для новичка: вспышки подождут следующего захода на экран */
    if (document.querySelector('.tour-root')) return;
    const S = state(), c = S.c, seen = c.seenLvl;
    /* новичок без записей: знакомство с персонажем покажем, когда появится первый опыт */
    if (!seen && !S.total) return;
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
    try { const N = needs(S); checkNeeds(S, N); checkTraits(S, N); } catch (e) {}
    if (c.seenWeek !== R.key) { Store.set('game.seenWeek', R.key); if (R.xp > 0 && seen) recapFlash(R); }
  }
  function flash(S, first, newStage, manual) {
    if (first) _autoShown = true;
    const ak = auraSk(S), r = grow(S.L.lvl), tr = TRAIT[ak][S.L.lvl % TRAIT[ak].length];
    const anim = !first && !newStage && S.L.lvl > 1;
    const chg = anim ? `<div class="gm-chg"><span><i class="ti ti-arrow-up"></i>крупнее</span><span><i class="ti ti-sun"></i>ярче контур</span><span><i class="ti ti-chevrons-up"></i>ранг ${r.k} из ${r.n}</span><span style="--c:${SK[ak].color}"><i class="ti ${SK[ak].ico}"></i>${tr}</span></div>` : '';
    overlay(`<div class="gm-rays"></div><div class="gm-grow" style="${growVars(anim ? S.L.lvl - 1 : S.L.lvl, ak)}">${heroImg(S.c.sex, S.stage, 'lg')}</div>
      <div class="gm-flash-k">${first ? 'Твой персонаж' : newStage ? 'Новый облик' : 'Новый уровень'}</div>
      <div class="gm-flash-l">Уровень ${S.L.lvl}</div>
      <div class="gm-flash-t">${esc(S.title)}</div>${chg}
      <p>${first ? 'Посчитал по всей твоей истории: тренировки, привычки, деньги, задачи и цели. Дальше очки капают сами.' : S.next ? 'До облика «' + esc(S.next[1]) + '» ' + (S.next[0] - S.L.lvl) + ' ' + pl(S.next[0] - S.L.lvl, 'уровень', 'уровня', 'уровней') : 'Высший облик. Легенда.'}</p>
      <button class="gm-btn" data-close>${first ? 'Посмотреть' : 'Круто'}</button>`, { cls: 'gm-lvlup', confetti: !first, news: first || manual ? null : { kind: 'lvl', key: 'lvl' + S.L.lvl, lvl: S.L.lvl, title: S.title, newStage: !!newStage }, onOpen: (ov) => { if (anim) setTimeout(() => { const g = ov.querySelector('.gm-grow'); if (g) g.setAttribute('style', growVars(S.L.lvl, ak)); }, 650); }, onClose: () => { if (first) Router.go('/hero'); } });
  }
  function streakFlash(n, manual) {
    overlay(`<div class="gm-rays warm"></div><div class="gm-fire"><i class="ti ti-flame"></i>${'<span></span>'.repeat(10)}</div>
      <div class="gm-flash-l">${n} ${pl(n, 'день', 'дня', 'дней')}</div><div class="gm-flash-k warm">подряд</div>
      <p>${STK_T[n]}${n >= 30 ? '' : '. Держи щиты: каждые 7 дней даю новый.'}</p>
      <button class="gm-btn warm" data-close>Огонь</button>`, { cls: 'gm-streak', news: manual ? null : { kind: 'streak', key: 'st' + n, n } });
  }
  function recapFlash(R, manual) {
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
      <button class="gm-btn" data-close>Погнали дальше</button>`, { cls: 'gm-recap', confetti: R.perfect, news: manual ? null : { kind: 'recap', key: 'w' + R.key, R } });
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
  /* постамент: векторный овал с обводкой, толщина одинаковая по всему кругу в любом браузере */
  const POD = { blue: ['#4A7CFF', '#7C9CFF'], fire: ['#F97316', '#FACC15'], neon: ['#22D3EE', '#E879F9'], gold: ['#B45309', '#FACC15'], diamond: ['#7DD3FC', '#F0F9FF'], rainbow: ['#EF4444', '#8B5CF6'] };
  let _pid = 0;
  function podHtml(fr) { return ''; /* постамент убран по просьбе Ника, рамка остаётся на аватарке */ const c = POD[fr]; if (!c) return ''; const id = 'gpod' + (++_pid);
    return `<svg class="gm-pod2" viewBox="0 0 160 32" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c[0]}"/><stop offset=".5" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[0]}"/></linearGradient></defs><ellipse cx="80" cy="16" rx="76" ry="12" fill="none" stroke="url(#${id})" stroke-width="3"/></svg>`; }
  const frameWrap = (html, fr) => `<span class="gm-fr fr-${fr}">${html}</span>`;
  function fxHtml(bg) {
    if (bg === 'night') return '<div class="gm-fx fx-night"><i></i><i></i></div>';
    if (bg === 'aurora') return '<div class="gm-fx fx-aurora"><i></i><i></i><i></i></div>';
    if (bg === 'gold') return '<div class="gm-fx fx-gold"><i></i><i></i></div>';
    if (bg === 'dawn') return '<div class="gm-fx fx-dawn"><i></i></div>';
    if (bg === 'ice') return '<div class="gm-fx fx-ice">' + Array.from({ length: 26 }, (_, i) => `<i style="--l:${(i * 37) % 100}%;--d:${((i * 0.61) % 7).toFixed(2)}s;--t:${6 + (i % 5)}s;--s:${2 + (i % 3)}px;--x:${(i % 2 ? 1 : -1) * (10 + i % 20)}px"></i>`).join('') + '</div>';
    return '';
  }
  function wrPreview(S, lk, bg, fr) {
    return `<div class="gm-prev gm-bgv" data-bg="${bg}" style="--gc:${GLOW[lk]}">${fxHtml(bg)}<div class="gm-stage sm">${heroImg(S.c.sex, lk, 'lg')}${podHtml(fr)}</div></div>`;
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
    fresh.forEach(k => itemFlash(S, k));
  }
  function itemFlash(S, k, manual) {
    { const it = wrItems(S).find(i => i.key === k), lk = lookOf(S); if (!it) return;
      overlay(`<div class="gm-rays gold"></div><div class="gm-flash-k">Новое в шкафчике</div>
        ${wrPreview(S, lk, it.kind === 'bg' ? it.id : bgOf(S), it.kind === 'frame' ? it.id : frOf(S))}
        <div class="gm-flash-l sm">${it.kind === 'bg' ? 'Фон' : 'Рамка'} «${esc(it.name)}»</div>
        <p>За «${esc(it.cond.t)}»</p>
        <button class="gm-btn" data-wear>Надеть</button><button class="gm-btn ghost" data-close>Позже</button>`, { cls: 'gm-newit',
        news: manual ? null : { kind: 'item', key: 'it' + k, item: k },
        onOpen: (ov, close) => { ov.querySelector('[data-wear]').onclick = () => { Store.set('game.' + it.kind, it.id); close(); if (_mount && _mount.isConnected) render(_mount, true); }; } }); }
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
    { sel: '.gm-stage', t: 'Персонаж', d: 'Это ты. Растёт с каждым уровнем, а облик меняется на 10, 20, 35 и 50 уровне. Нажми на него, он что-нибудь скажет.' },
    { sel: '.gm-needs', t: 'Состояние', d: 'Пять шкал по сферам жизни. Делаешь дела: шкала растёт. Забросил сферу: тает, и персонаж грустнеет. Шкала выше 80: у ног появляется её вещь.' },
    { sel: '.gm-xpw', t: 'Опыт', d: 'Очки за всё, что записываешь в приложении. Набрал нужное: новый уровень. Штрафов нет.' },
    { sel: '.gm-tiles', t: 'Серия и щиты', d: 'Серия: сколько дней подряд ты что-то делал. Неделя подряд даёт щит, он спасёт серию, если пропустишь день.' },
    { sel: '.gm-path', t: 'Путь', d: 'Все облики от Новичка до Легенды и на каком уровне откроется следующий.' },
    { sel: '.gm-ql', t: 'Квесты дня', d: 'Мини-задания на сегодня. Выбираешь утром, отмечаются сами, когда делаешь дело. Закрыл все: +50 опыта и сундук.' },
    { sel: '.gm-radar', t: 'Навыки', d: 'Какие сферы ты качаешь больше. Ровная фигура: развиваешься гармонично. Провал: туда стоит добавить.' },
    { sel: '.gm-week', t: 'Неделя', d: 'Сколько опыта за каждый день недели и из каких разделов.' },
    { sel: '.gm-cal', t: 'Календарь', d: 'Чем ярче день, тем больше сделал. Пунктир: день спас щит. Жёлтый: день отдыха.' },
    { sel: '.gm-news', t: 'Новое', d: 'Уровни, черты и находки, которые пришли без тебя. Нажми, чтобы посмотреть.' },
    { sel: '.gm-wr', t: 'Шкафчик', d: 'Наряди персонажа: облик, фон и рамка. Новое открывается за достижения и уровни.' },
    { sel: '.gm-chestrow', t: 'Сундук дня', d: 'Награда за все квесты дня. Внутри опыт или щит, иногда редкая находка.' },
    { sel: '.gm-shop', t: 'Свои награды', d: 'Придумай себе приз (кино, кроссы, массаж) и цену в опыте. Накопил: забрал. Уровень от покупки не падает.' },
    { sel: '.gm-ach', t: 'Достижения', d: 'Медали за большие дела: 100 тренировок, месяц привычек и другие. Серые ещё впереди.' },
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
  function render(mount, quiet) {
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
    const N = needs(S), old0 = quiet ? null : lastSeen();
    const qRow = (x, pickMode, i) => `<${pickMode ? 'button' : 'div'} class="gm-q${pickMode ? ' pick' + (i < c.qn ? ' on' : '') : x.done ? ' done' + (fresh.has(x.id) ? ' just' : '') : ''}" ${pickMode ? `data-id="${esc(x.id)}"` : `data-go="${esc(SK[x.sk] ? SK[x.sk].route : '')}"`} style="--c:${(SK[x.sk] || SK.dis).color}"><span class="gm-qi"><i class="ti ${(SK[x.sk] || SK.dis).ico}"></i></span><span class="gm-qm"><b>${esc(x.t)}</b><small>${pickMode && N.n[x.sk] && N.n[x.sk].on && N.n[x.sk].v < 45 ? '<u class="gm-qneed">нужно</u>' : ''}${esc((SK[x.sk] || SK.dis).name)}${x.s ? ' · ' + esc(x.s) : ''}</small></span><em>+${x.xp}</em><span class="gm-cb"><i class="ti ti-check"></i></span></${pickMode ? 'button' : 'div'}>`;
    const qHtml = !tq.picked
      ? `<div class="gm-card gm-qc"><div class="gm-h"><b>Что берёшь сегодня?</b><span>до ${c.qn}</span></div>
          <div class="gm-ql">${tq.cands.map((x, i) => [x, i]).sort((a, b) => { const va = N.n[a[0].sk] && N.n[a[0].sk].on ? N.n[a[0].sk].v : 70, vb = N.n[b[0].sk] && N.n[b[0].sk].on ? N.n[b[0].sk].v : 70; return (va < 45) === (vb < 45) ? a[1] - b[1] : va < 45 ? -1 : 1; }).map((p, i) => qRow(p[0], true, i)).join('')}</div>
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
    /* вещи шкафчика одной строкой */
    const nItems = c.news.filter(n => n.kind === 'item'), nRest = c.news.filter(n => n.kind !== 'item');
    const newsHtml = c.news.length ? `<div class="gm-card gm-news"><div class="gm-h"><b>Новое <u class="gm-newn">${nRest.length + (nItems.length ? 1 : 0)}</u></b><button class="gm-clr" id="gm-nclr">Скрыть</button></div>
      ${nItems.length ? `<button class="gm-nw" id="gm-nitems" style="--c:#EAB308"><span class="gm-nwi"><i class="ti ti-hanger"></i></span><span class="gm-nwm"><b>Новое в шкафчике: ${nItems.length}</b><small>${esc(nItems.slice(-3).reverse().map(n => { const it = wrItems(S).find(i => i.key === n.item); return it ? it.name : ''; }).filter(Boolean).join(', '))}</small></span><i class="ti ti-chevron-right"></i></button>` : ''}
      ${nRest.slice().reverse().map(n => { const v = (NEWS[n.kind] || (() => null))(n); return v ? `<button class="gm-nw" data-news="${esc(n.key)}" style="--c:${v.c}"><span class="gm-nwi"><i class="ti ${v.ico}"></i></span><span class="gm-nwm"><b>${esc(v.t)}</b><small>${esc(v.s)}</small></span><i class="ti ti-chevron-right"></i></button>` : ''; }).join('')}</div>` : '';
    const repairHtml = repair ? `<div class="gm-card gm-repair"><span class="gm-rpi"><i class="ti ti-flame"></i></span><div><b>Верни серию ${repair} ${pl(repair, 'день', 'дня', 'дней')}</b><small>закрой все квесты сегодня</small></div></div>` : '';
    const perfectWk = wk.every(d => S.s.st[ymd(d)] === 'ok');
    const nextLv = S.L.lvl + 1;
    const ak = auraSk(S);
    const lk = lookOf(S), bg = bgOf(S), fr = frOf(S), wi = wrItems(S), wNew = wi.filter(i => i.ok && !i.base && !c.seenItems.includes(i.key)).length;
    const wrHtml = `<button class="gm-card gm-wr" id="gm-wr"><div class="gm-h"><b>Шкафчик${wNew ? ` <u class="gm-newn">${wNew} ${pl(wNew, 'новое', 'новых', 'новых')}</u>` : ''}</b><span>${wi.filter(i => i.ok).length} из ${wi.length}</span></div>
      <div class="gm-wr-row"><span class="gm-wr-av">${frameWrap(heroImg(c.sex, lk, 'sm'), fr)}</span>
        <span class="gm-wr-c"><small>Облик</small><b>${TITLES[lk][1]}</b></span><span class="gm-wr-c"><small>Фон</small><b>${BGS.find(x => x.id === bg).n}</b></span><span class="gm-wr-c"><small>Рамка</small><b>${FRS.find(x => x.id === fr).n}</b></span><i class="ti ti-chevron-right"></i></div></button>`;
    mount.innerHTML = `<div class="gm-screen" style="--gc:${GLOW[lk]}">
      <div class="gm-top gm-bgv" data-bg="${bg}">${fxHtml(bg)}
        <div class="gm-nav"><button class="gm-back" id="gm-back" aria-label="Назад"><i class="ti ti-arrow-left"></i></button><b>Персонаж</b><span style="display:flex;gap:8px"><button class="gm-back" id="gm-help" aria-label="Подсказки"><i class="ti ti-help"></i></button><button class="gm-back" id="gm-set" aria-label="Настройки"><i class="ti ti-settings"></i></button></span></div>
        <div class="gm-hero-row">
          <div class="gm-stage" data-mood="${N.m}" style="${growVars(S.L.lvl, ak)};${moodVars(N)}">${moodFx(N)}<div class="gm-say" id="gm-say"></div>${propsHtml(N, old0 ? propsOf(N).filter(k => !toArr(old0.p).includes(k)) : [])}<div class="gm-sparks">${Array.from({ length: Math.min(20, 3 + Math.round(13 * grow(S.L.lvl).g) + (N.m === 4 ? 4 : 0) - (N.m < 2 ? 3 : 0)) }, (_, i) => `<i style="--l:${(8 + (i * 53) % 84)}%;--d:${(i * 0.37) % 5}s;--t:${4 + (i % 4)}s;--s:${3 + (i % 3)}px"></i>`).join('')}</div>${c.mode === 'min' ? bigRing(S, lk, pct) : heroImg(c.sex, lk, 'xl') + `${podHtml(fr)}`}</div>
          <div class="gm-info">
            <div class="gm-who">${c.mode === 'min' ? '' : `<div class="gm-lvl"><span>${S.L.lvl}</span> уровень</div>`}<div class="gm-title">${esc(S.title)}</div>${pipsHtml(S.L.lvl, ak)}<button class="gm-moodc" id="gm-moodc" style="--c:${N.mood[1]}"><i class="ti ${N.mood[2]}"></i>${N.mood[0]}${N.worst && N.n[N.worst].v < 45 ? ' · ' + needSt(N.worst, N.n[N.worst].v) : ''}</button></div>
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
          ${newsHtml}${repairHtml}${needsHtml(S, N)}${qHtml}
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
    const mc = mount.querySelector('#gm-moodc'); if (mc) mc.onclick = () => { const t = mount.querySelector('.gm-needs'); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
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
    if (repairedNow) repFlash(S.s.cur);
    countUp(mount);
    if (!quiet) reactNeeds(mount, N, old0);
    bindSay(mount, S, N);
    mount.querySelectorAll('[data-news]').forEach(b => b.onclick = () => { const n = cfg().news.find(x => x.key === b.dataset.news); if (n) openNews(n); });
    const ni = $('#gm-nitems'); if (ni) ni.onclick = () => { Store.set('game.news', cfg().news.filter(x => x.kind !== 'item')); wardrobe(() => render(mount, true)); };
    const nc = $('#gm-nclr'); if (nc) nc.onclick = () => { Store.set('game.news', []); render(mount, true); };
    if (!quiet) checkLevelUp();
  }
  function bigRing(S, lk, pct) {
    const C = 2 * Math.PI * 96;
    return `<div class="gm-bring" style="--ec:${GLOW[lk]}"><svg viewBox="0 0 220 220"><defs><linearGradient id="gmRg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4A7CFF"/><stop offset="1" stop-color="#8B5CF6"/></linearGradient></defs>
      <circle cx="110" cy="110" r="96" class="b"/><circle cx="110" cy="110" r="96" class="f" stroke-dasharray="${(C * pct / 100).toFixed(1)} ${C.toFixed(1)}"/></svg>
      <div class="gm-bring-c"><i class="ti ${EMB[lk]}"></i><b>${S.L.lvl}</b><small>уровень</small></div></div>`;
  }
  function repFlash(n, manual) {
    overlay(`<div class="gm-rays warm"></div><div class="gm-fire"><i class="ti ti-flame"></i>${'<span></span>'.repeat(10)}</div><div class="gm-flash-l">${n} ${pl(n, 'день', 'дня', 'дней')}</div><div class="gm-flash-k warm">серия вернулась</div><p>Вчерашний пропуск закрыт квестами.</p><button class="gm-btn warm" data-close>Огонь</button>`, { cls: 'gm-streak', news: manual ? null : { kind: 'rep', key: 'rep' + ymd(new Date()), n } });
  }
  /* карточка «Новое»: то, что не показали вспышкой */
  const NEWS = {
    lvl: (n) => ({ ico: 'ti-arrow-big-up-lines', c: '#8B5CF6', t: 'Уровень ' + n.lvl, s: n.newStage ? 'новый облик: ' + n.title : n.title }),
    streak: (n) => ({ ico: 'ti-flame', c: '#FB923C', t: n.n + ' ' + pl(n.n, 'день', 'дня', 'дней') + ' подряд', s: STK_T[n.n] || '' }),
    recap: (n) => ({ ico: 'ti-chart-bar', c: '#4A7CFF', t: 'Итоги недели', s: '+' + num(n.R.xp) + ' XP' + (n.R.perfect ? ' · идеальная' : '') }),
    item: (n) => { const it = wrItems(state()).find(i => i.key === n.item); return { ico: 'ti-hanger', c: '#EAB308', t: 'Новое в шкафчике', s: it ? (it.kind === 'bg' ? 'Фон' : 'Рамка') + ' «' + it.name + '»' : '' }; },
    rep: (n) => ({ ico: 'ti-flame', c: '#FB923C', t: 'Серия вернулась', s: n.n + ' ' + pl(n.n, 'день', 'дня', 'дней') }),
    trait: (n) => SK[n.k] ? ({ ico: TRT[n.k][2], c: SK[n.k].color, t: 'Черта: ' + trName(n.k), s: SK[n.k].name + ' тает медленнее' }) : null,
    trlost: (n) => SK[n.k] ? ({ ico: TRT[n.k][2], c: '#94A3B8', t: 'Черта ушла: ' + trName(n.k), s: 'вернётся за месяц выше 80' }) : null,
    need: (n) => SK[n.k] ? ({ ico: SK[n.k].ico, c: '#F0645A', t: 'Персонаж: ' + NEED[n.k].st[3], s: NEED[n.k].fix }) : null,
  };
  function openNews(n) {
    Store.set('game.news', cfg().news.filter(x => x.key !== n.key));
    const S = state();
    if (n.kind === 'lvl') flash(S, false, n.newStage, true);
    else if (n.kind === 'streak') streakFlash(n.n, true);
    else if (n.kind === 'recap') recapFlash(n.R, true);
    else if (n.kind === 'item') itemFlash(S, n.item, true);
    else if (n.kind === 'rep') repFlash(n.n, true);
    else if (n.kind === 'need' && SK[n.k]) { Router.go(SK[n.k].route); return; }
    else if (n.kind === 'trait' && SK[n.k]) traitFlash(n.k, true);
    else if (n.kind === 'trlost' && SK[n.k]) { Router.go(SK[n.k].route); return; }
    if (_mount && _mount.isConnected) render(_mount, true);
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
      <div class="gm-row"><span>Вид</span><div class="gm-seg" data-k="mode"><button data-v="hero" class="${c.mode !== 'min' ? 'on' : ''}">Персонаж</button><button data-v="min" class="${c.mode === 'min' ? 'on' : ''}">Минимал</button></div></div>
      <div class="gm-row"><span>Персонаж</span><div class="gm-seg" data-k="sex"><button data-v="m" class="${c.sex === 'm' ? 'on' : ''}">Парень</button><button data-v="f" class="${c.sex === 'f' ? 'on' : ''}">Девушка</button></div></div>
      <div class="gm-row"><span>Квестов в день</span><div class="gm-seg" data-k="qn">${[2, 3, 5].map(n => `<button data-v="${n}" class="${c.qn === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      <div class="gm-row col"><span>Дни отдыха <small>серия в эти дни не сгорает</small></span><div class="gm-days">${[1, 2, 3, 4, 5, 6, 0].map(d => `<button data-d="${d}" class="${c.rest.includes(d) ? 'on' : ''}">${DOW[d]}</button>`).join('')}</div></div>
      <div class="gm-row"><span>Отпуск <small>серия заморожена</small></span><button class="gm-sw${vacOn ? ' on' : ''}" id="gm-vac" aria-label="Отпуск"></button></div>
      <div class="gm-row col"><span>Состояние <small>какие сферы влияют на настроение</small></span><div class="gm-days gm-nset">${SKO.map(k => `<button data-k="${k}" class="${c.needsOff.includes(k) ? '' : 'on'}">${SK[k].name}</button>`).join('')}</div></div>
      <div class="gm-row"><span>Показывать на главной</span><button class="gm-sw${c.on ? ' on' : ''}" id="gm-on" aria-label="Игровой режим"></button></div>
      <div class="tr-modal-actions"><button class="tr-modal-btn-primary" id="gm-ok" style="flex:1">Готово</button></div></div>`;
    document.body.appendChild(ov);
    const close = () => { ov.remove(); done && done(); };
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('#gm-ok').onclick = close;
    ov.querySelectorAll('.gm-seg').forEach(sg => sg.querySelectorAll('button').forEach(b => b.onclick = () => { sg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); Store.set('game.' + sg.dataset.k, sg.dataset.k === 'qn' ? +b.dataset.v : b.dataset.v); }));
    ov.querySelectorAll('.gm-days:not(.gm-nset) button').forEach(b => b.onclick = () => { b.classList.toggle('on'); Store.set('game.rest', [...ov.querySelectorAll('.gm-days:not(.gm-nset) button.on')].map(x => +x.dataset.d)); });
    ov.querySelectorAll('.gm-nset button').forEach(b => b.onclick = () => { b.classList.toggle('on'); Store.set('game.needsOff', [...ov.querySelectorAll('.gm-nset button:not(.on)')].map(x => x.dataset.k)); });
    ov.querySelector('#gm-on').onclick = (e) => { e.currentTarget.classList.toggle('on'); Store.set('game.on', e.currentTarget.classList.contains('on')); };
    ov.querySelector('#gm-vac').onclick = (e) => { const b = e.currentTarget; b.classList.toggle('on'); const t = ymd(new Date()); let v = cfg().vacs;
      if (b.classList.contains('on')) v = v.concat([{ from: t }]); else v = v.map(x => x.to ? x : Object.assign({}, x, { to: ymd(new Date(Date.now() - 864e5)) < x.from ? x.from : ymd(new Date(Date.now() - 864e5)) }));
      Store.set('game.vacs', v); };
  }

  return { avail, on, state, events, candidates, todayQuests, pick, homeHtml, bindHome, render, checkLevelUp, _levelOf: levelOf, _streak: streak };
})();
window.Screens = window.Screens || {};
Screens.hero = (mount) => Game.render(mount);
