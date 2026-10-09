/* ============================================================
   ЗАДАЧИ (для всех). Устроены как Todoist.
   Сверху вкладки (Входящие / Сегодня / Предстоящее), как в других разделах.
   «Предстоящее»: одна неделя Пн–Вс колонками, стрелки листают недели, «Сегодня» возвращает к текущей,
   задачи перетаскиваются между днями и внутри дня (поле order).
   Своя тема (светлая / тёмная) как в Финансах: tasks.theme, на остальное приложение не влияет.
   Данные: tasks.list = [{ id, title, date: 'YYYY-MM-DD' | null, time: 'HH:MM' | null, proj: id | null, done, doneAt, createdAt, order,
                           desc, prio: 1..4, subs: [{ id, title, done }] }]
   Проекты: tasks.projects = [{ id, name, color }], каждый проект своя вкладка. Входящие: без срока и без проекта.
   ============================================================ */
window.Tasks = (function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toArr = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
  const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const MONN = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const DOW = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const PRIO = { 1: '#D1453B', 2: '#EB8909', 3: '#246FE0', 4: '' }; /* цвета приоритетов как в Todoist */
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const parse = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const plural = (n, a, b, c) => { const x = n % 10, y = n % 100; return x === 1 && y !== 11 ? a : x >= 2 && x <= 4 && (y < 12 || y > 14) ? b : c; };

  /* раньше только для владельца, теперь для всех, кто вошёл (имя функции оставлено для совместимости) */
  function isOwner() {
    const u = window.FirebaseSync && FirebaseSync.currentUser ? FirebaseSync.currentUser() : null;
    return !!u;
  }
  function norm(t) { return Object.assign({}, t, { subs: toArr(t.subs).filter(s => s && s.title), prio: [1, 2, 3, 4].includes(+t.prio) ? +t.prio : 4, time: /^\d{2}:\d{2}$/.test(t.time || '') ? t.time : null, proj: t.proj || null }); }
  const PCOL = ['#DB4035', '#FF9933', '#E5B800', '#7ECC49', '#299438', '#14AAF5', '#4073FF', '#884DFF', '#AF38EB', '#EB96EB', '#808080'];
  function projects() { return toArr((Store.get().tasks || {}).projects).filter(p => p && p.id && p.name); }
  function saveProjects(a) { Store.set('tasks.projects', a.length ? a.map(p => ({ id: p.id, name: p.name, color: p.color })) : null); }
  const projOf = (id) => projects().find(p => p.id === id) || null;
  function list() { return toArr((Store.get().tasks || {}).list).filter(t => t && t.id && t.title).map(norm); }
  function save(arr) { Store.set('tasks.list', arr.map(t => JSON.parse(JSON.stringify(t)))); }
  const ord = (t) => (t.order != null && isFinite(+t.order)) ? +t.order : +t.createdAt || 0;
  const byOrd = (x, y) => (x.done - y.done) || (ord(x) - ord(y));
  function add(title, date, desc, proj, time, prio) { title = String(title || '').trim().slice(0, 200); if (!title) return; const a = list();
    const same = a.filter(t => (t.date || null) === (date || null)); const mx = same.length ? Math.max(...same.map(ord)) : 0;
    a.push({ id: uid(), title, date: date || null, done: false, createdAt: Date.now(), order: Math.max(mx + 1, Date.now()), prio: [1, 2, 3].includes(prio) ? prio : 4, desc: String(desc || '').trim().slice(0, 2000) || null, proj: proj || null, time: (date && time) || null }); save(a); }
  function patch(id, p) { save(list().map(t => t.id === id ? Object.assign({}, t, p) : t)); }
  function remove(id) { save(list().filter(t => t.id !== id)); }
  function todayCount() { const t = iso(today()); return list().filter(x => !x.done && x.date === t).length; }

  /* своя тема раздела, как светлые финансы */
  const isLight = () => ((Store.get().tasks || {}).theme || 'light') === 'light';
  const themeCls = () => isLight() ? 'tkl' : 'tkd';

  function dayLabel(ds) {
    const d = parse(ds); if (!d) return ''; const diff = Math.round((d - today()) / 864e5);
    if (diff === 0) return 'Сегодня'; if (diff === 1) return 'Завтра'; if (diff === -1) return 'Вчера';
    if (diff > 1 && diff < 7) return DOW[d.getDay()];
    return d.getDate() + ' ' + MON[d.getMonth()];
  }
  const flag = (p, sz) => `<svg class="tk-flag" width="${sz || 16}" height="${sz || 16}" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4h12.5l-2.2 4.25L17.5 12.5H5" fill="${PRIO[p] || 'none'}" stroke="${PRIO[p] || 'currentColor'}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  const ICO = { inbox: 'ti-inbox', today: 'ti-calendar-event', week: 'ti-calendar-week', done: 'ti-circle-check' };
  const NAME = { inbox: 'Входящие', today: 'Сегодня', week: 'Предстоящее', done: 'Выполнено' };

  let view = 'week', boardX = 0, wk = 0, toastT = null;
  const monday = (d) => addDays(d, -((d.getDay() + 6) % 7));

  /* ── Разметка ── */
  function card(t, opts) {
    const td = iso(today()), late = !t.done && t.date && t.date < td;
    const showDate = t.date && !(opts && opts.inCol) && (!(opts && opts.noDate) || late);
    const subs = t.subs.length ? `<span class="tk-m"><i class="ti ti-subtask"></i>${t.subs.filter(s => s.done).length}/${t.subs.length}<i class="ti ti-chevron-right tk-chev"></i></span>` : '';
    const date = showDate ? `<span class="tk-m ${late ? 'late' : 'ok'}"><i class="ti ti-calendar"></i>${dayLabel(t.date)}${t.time ? ' ' + t.time : ''}</span>` : (t.time && t.date ? `<span class="tk-m ${late ? 'late' : 'ok'}"><i class="ti ti-clock"></i>${t.time}</span>` : '');
    const desc = t.desc ? `<span class="tk-d">${esc(t.desc.split('\n')[0])}</span>` : '';
    const pr = t.proj && !(opts && opts.noProj) ? projOf(t.proj) : null;
    const meta = subs + date + (pr ? `<span class="tk-m tk-proj"><i style="background:${pr.color}"></i>${esc(pr.name)}</span>` : '');
    return `<div class="tk-card${t.done ? ' done' : ''}" data-id="${esc(t.id)}" style="--pc:${PRIO[t.prio] || '#808080'}">
      <button class="tk-ck${t.prio < 4 ? ' p' : ''}" data-ck="${esc(t.id)}" aria-label="${t.done ? 'Вернуть' : 'Готово'}"><i class="ti ti-check"></i></button>
      <div class="tk-c-b" data-ed="${esc(t.id)}"><div class="tk-c-t">${esc(t.title)}</div>${desc}${meta ? `<div class="tk-meta">${meta}</div>` : ''}</div>
    </div>`;
  }
  const addBtn = (date, proj) => `<button class="tk-addb" data-add="${date || ''}"${proj ? ` data-proj="${esc(proj)}"` : ''}><span class="tk-plus"><i class="ti ti-plus"></i></span>Добавить задачу</button>`;
  /* ── Умный ввод как в Todoist: время, дата, приоритет и #проект прямо в названии ── */
  const WD = [[/^(вс|воскресенье)$/, 0], [/^(пн|понедельник)$/, 1], [/^(вт|вторник)$/, 2], [/^(ср|среда|среду)$/, 3], [/^(чт|четверг)$/, 4], [/^(пт|пятница|пятницу)$/, 5], [/^(сб|суббота|субботу)$/, 6]];
  function smart(raw) {
    const out = { date: null, time: null, prio: null, proj: null, chips: [] }; const tk = String(raw || '').split(/\s+/).filter(Boolean); const keep = [];
    const hm = (h, m) => (h >= 0 && h < 24 && m >= 0 && m < 60) ? String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') : null;
    for (let i = 0; i < tk.length; i++) {
      const w = tk[i], lw = w.toLowerCase().replace(/[.,!?;]+$/, ''), nx = (tk[i + 1] || '').toLowerCase(); let m;
      if (!out.time && (m = /^(\d{1,2})[:.](\d{2})$/.exec(lw)) && hm(+m[1], +m[2])) { out.time = hm(+m[1], +m[2]); continue; }
      if (!out.time && (m = /^(\d{3,4})$/.exec(lw)) && !/^(₽|р|руб|рублей|кг|км|шт|%|г|мл|мин)/.test(nx)) { const v = m[1].padStart(4, '0'), t = hm(+v.slice(0, 2), +v.slice(2)); if (t) { out.time = t; continue; } }
      if (!out.time && lw === 'в' && (m = /^(\d{1,2})(?:[:.](\d{2}))?$/.exec(nx)) && hm(+m[1], +(m[2] || 0))) { out.time = hm(+m[1], +(m[2] || 0)); i++; continue; }
      if (!out.date && lw === 'сегодня') { out.date = iso(today()); continue; }
      if (!out.date && lw === 'завтра') { out.date = iso(addDays(today(), 1)); continue; }
      if (!out.date && lw === 'послезавтра') { out.date = iso(addDays(today(), 2)); continue; }
      if (!out.date && lw === 'через' && nx.replace(/[.,]$/, '') === 'неделю') { out.date = iso(addDays(today(), 7)); i++; continue; }
      if (!out.date) { const pre = (lw === 'в' || lw === 'во') ? nx.replace(/[.,]$/, '') : null, cand = pre || lw, f = WD.find(x => x[0].test(cand));
        if (f) { const d0 = today(); out.date = iso(addDays(d0, (f[1] - d0.getDay() + 7) % 7)); if (pre) i++; continue; } }
      if (!out.prio && (lw === 'важно' || lw === 'срочно')) { out.prio = 1; continue; }
      if (!out.prio && (m = /^(?:p|р|!)([1-4])$/.exec(lw))) { out.prio = +m[1]; continue; }
      if (!out.proj && w.startsWith('#') && w.length > 1) { const pn = w.slice(1).toLowerCase(), pr = projects().find(p => p.name.toLowerCase() === pn || p.name.toLowerCase().replace(/\s+/g, '') === pn); if (pr) { out.proj = pr.id; continue; } }
      keep.push(w);
    }
    out.title = keep.join(' ');
    if (out.date) out.chips.push(['ti-calendar', dayLabel(out.date)]);
    if (out.time) out.chips.push(['ti-clock', out.time]);
    if (out.prio) out.chips.push(['flag', 'P' + out.prio]);
    if (out.proj) { const pr = projOf(out.proj); out.chips.push(['dot', pr.name, pr.color]); }
    return out;
  }
  const chipsHtml = (sm) => sm.chips.map(c => `<span class="tk-sm">${c[0] === 'flag' ? flag(sm.prio, 14) : c[0] === 'dot' ? `<i class="tk-pdot" style="background:${c[2]}"></i>` : `<i class="ti ${c[0]}"></i>`}${esc(c[1])}</span>`).join('');
  function bindSmart(inp, box) { const up = () => { box.innerHTML = chipsHtml(smart(inp.value)); }; inp.addEventListener('input', up); up(); }
  /* добавить с разбором названия; явные значения формы идут по умолчанию */
  function addSmart(title, date, desc, proj, time) { const sm = smart(title); const t = sm.title || String(title).trim(), tm = sm.time || time || null;
    add(t, sm.date || date || (tm ? iso(today()) : null), desc, sm.proj || proj || null, tm, sm.prio || 4); }

  const addForm = (date) => `<form class="tk-addf" data-date="${date || ''}"><input class="tk-af-t" maxlength="200" placeholder="Название задачи" autocomplete="off"><div class="tk-sms"></div><input class="tk-af-d" maxlength="2000" placeholder="Описание" autocomplete="off">
      <div class="tk-af-b"><button type="button" class="tk-btn ghost" data-cancel>Отмена</button><button type="submit" class="tk-btn red">Добавить задачу</button></div></form>`;

  function listView(kind) {
    const all = list(), td = iso(today());
    if (kind.startsWith('p:')) {
      const pid = kind.slice(2), pr = projOf(pid) || { name: 'Проект', color: '#808080' };
      const a = all.filter(t => t.proj === pid && !t.done).sort((x, y) => (x.date ? 0 : 1) - (y.date ? 0 : 1) || (x.date || '').localeCompare(y.date || '') || byOrd(x, y));
      return `<div class="tk-page"><div class="tk-ph"><h1><i class="tk-pdot" style="background:${pr.color}"></i>${esc(pr.name)}</h1><span class="tk-cnt">${a.length ? a.length + ' ' + plural(a.length, 'задача', 'задачи', 'задач') : ''}</span></div>
        <div class="tk-list" data-list="" data-keep="1">${a.map(t => card(t, { noProj: true })).join('')}${addBtn('', pid)}</div></div>`;
    }
    if (kind === 'done') {
      const dn = all.filter(t => t.done).sort((x, y) => (y.doneAt || 0) - (x.doneAt || 0)); let last = '';
      return `<div class="tk-page"><div class="tk-ph"><h1>Выполнено</h1><span class="tk-cnt">${dn.length ? dn.length + ' ' + plural(dn.length, 'задача', 'задачи', 'задач') : ''}</span></div>
        ${dn.length ? dn.map(t => { const dd = t.doneAt ? iso(new Date(t.doneAt)) : td, h = dd !== last ? `<div class="tk-sec"><span>${dayLabel(dd)}</span></div>` : ''; last = dd; return h + `<div class="tk-list">${card(t)}</div>`; }).join('') : '<div class="tk-empty">Пока пусто</div>'}</div>`;
    }
    if (kind === 'inbox') {
      const a = all.filter(t => !t.date && !t.proj && !t.done).sort(byOrd);
      return `<div class="tk-page"><div class="tk-ph"><h1>Входящие</h1><span class="tk-cnt">${a.length ? a.length + ' ' + plural(a.length, 'задача', 'задачи', 'задач') : ''}</span></div>
        <div class="tk-list" data-list="">${a.map(t => card(t)).join('')}${addBtn('')}</div></div>`;
    }
    const late = all.filter(t => !t.done && t.date && t.date < td).sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : byOrd(x, y));
    const now = all.filter(t => !t.done && t.date === td).sort(byOrd);
    const n = now.length; /* просроченные живут в «Предстоящем», в «Сегодня» только сегодняшние */
    return `<div class="tk-page"><div class="tk-ph"><h1>Сегодня</h1><span class="tk-cnt">${n ? '<i class="ti ti-circle-check"></i>' + n + ' ' + plural(n, 'задача', 'задачи', 'задач') : ''}</span></div>
      <div class="tk-sec"><span>${today().getDate()} ${MON[today().getMonth()]} · Сегодня · ${DOW[today().getDay()]}</span></div>
      <div class="tk-list" data-list="${td}">${now.map(t => card(t, { noDate: true })).join('')}${addBtn(td)}</div></div>`;
  }

  function weekView() {
    const all = list(), td = iso(today());
    const m0 = addDays(monday(today()), wk * 7);
    /* как в Todoist: у текущей недели дни начинаются с сегодня, всё невыполненное раньше лежит в «Просрочено» */
    const late = wk === 0 ? all.filter(t => !t.done && t.date && t.date < td).sort((x, y) => x.date < y.date ? -1 : 1) : [];
    const days = Array.from({ length: 7 }, (_, i) => addDays(m0, i)).filter(d => iso(d) >= td), d6 = addDays(m0, 6);
    const mn = m0.getMonth() === d6.getMonth() ? MONN[m0.getMonth()] + ' ' + m0.getFullYear() : MONN[m0.getMonth()] + (m0.getFullYear() !== d6.getFullYear() ? ' ' + m0.getFullYear() : '') + ' – ' + MONN[d6.getMonth()] + ' ' + d6.getFullYear();
    const col = (d) => { const ds = iso(d), items = all.filter(t => t.date === ds && !t.done).sort(byOrd), lb = dayLabel(ds), nd = items.filter(t => !t.done).length;
      const name = lb === 'Сегодня' || lb === 'Завтра' || lb === 'Вчера' ? lb : DOW[d.getDay()];
      return `<section class="tk-col${ds === td ? ' now' : ''}${ds < td ? ' past' : ''}" data-day="${ds}"><header>${d.getDate()} ${MON[d.getMonth()]} · ${name}<i>${nd}</i></header>
        <div class="tk-col-l" data-list="${ds}">${items.map(t => card(t, { inCol: true })).join('')}${addBtn(ds)}</div></section>`; };
    return `<div class="tk-page tk-page-w"><div class="tk-ph"><h1>Предстоящее</h1></div>
      <div class="tk-wbar"><b id="tk-month">${mn}</b>
        <div class="tk-nav"><button data-wk="-1" aria-label="Раньше"${wk <= 0 ? ' disabled' : ''}><i class="ti ti-chevron-left"></i></button><button data-wk="0">Сегодня</button><button data-wk="1" aria-label="Позже"><i class="ti ti-chevron-right"></i></button></div></div>
      <div class="tk-board" id="tk-board">
        ${late.length ? `<section class="tk-col late"><header>Просрочено<i>${late.length}</i><button class="tk-move" data-move>Перенести</button></header><div class="tk-col-l">${late.map(t => card(t)).join('')}</div></section>` : ''}
        ${days.map(col).join('')}
      </div></div>`;
  }

  /* ── Карточка задачи: всё сохраняется сразу ── */
  function editModal(id, redraw) {
    const t0 = list().find(x => x.id === id); if (!t0) return;
    const t = JSON.parse(JSON.stringify(t0)); let subsOpen = true;
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay tk-ov ' + themeCls();
    const $ = (q) => ov.querySelector(q);
    const commit = () => { const title = ($('#tk-c-t').value.trim() || t.title).slice(0, 200);
      patch(t.id, { title, desc: $('#tk-c-d').value.trim().slice(0, 2000) || null, date: t.date || null, time: (t.date && t.time) || null, proj: t.proj || null, prio: t.prio, subs: t.subs.length ? t.subs : null, done: !!t.done, doneAt: t.done ? (t0.doneAt || Date.now()) : null }); };
    const where = () => { const pr = t.proj ? projOf(t.proj) : null; return pr ? `<i class="tk-pdot" style="background:${pr.color}"></i>${esc(pr.name)}` : `<i class="ti ti-${t.date ? 'calendar' : 'inbox'}"></i>${t.date ? dayLabel(t.date) : 'Входящие'}`; };
    const projMenu = () => `<button data-pj=""><i class="ti ti-inbox"></i>Входящие<i class="ti ti-check tk-mk"></i></button>${projects().map(p => `<button data-pj="${esc(p.id)}"><i class="tk-pdot" style="background:${p.color}"></i>${esc(p.name)}<i class="ti ti-check tk-mk"></i></button>`).join('')}
      <form class="tk-pj-new" id="tk-pj-new"><i class="ti ti-plus"></i><input maxlength="40" placeholder="Новый проект"></form>`;
    const subsHtml = () => `<button class="tk-subs-h" id="tk-subs-h"><i class="ti ti-chevron-${subsOpen ? 'down' : 'right'}"></i><b>Подзадачи</b><span>${t.subs.filter(x => x.done).length}/${t.subs.length}</span></button>
      ${subsOpen ? t.subs.map((x, i) => `<div class="tk-sub${x.done ? ' done' : ''}"><button class="tk-ck" data-sck="${i}"><i class="ti ti-check"></i></button><input value="${esc(x.title)}" data-st="${i}" maxlength="200"><button class="tk-sub-x" data-sx="${i}" aria-label="Удалить подзадачу"><i class="ti ti-x"></i></button></div>`).join('') : ''}`;
    const dateVal = () => t.date ? `<i class="ti ti-calendar ${t.date < iso(today()) ? 'late' : 'ok'}"></i>${dayLabel(t.date)}${t.time ? ' ' + t.time : ''}` : '<i class="ti ti-calendar-off"></i>Без срока';
    ov.innerHTML = `<div class="tk-modal">
      <div class="tk-modal-top"><span id="tk-where">${where()}</span><div><button class="tk-x" id="tk-c-del" aria-label="Удалить" title="Удалить"><i class="ti ti-trash"></i></button><button class="tk-x" data-close aria-label="Закрыть"><i class="ti ti-x"></i></button></div></div>
      <div class="tk-modal-body">
        <div class="tk-modal-main">
          <div class="tk-mt"><button class="tk-ck" id="tk-c-done"><i class="ti ti-check"></i></button><textarea id="tk-c-t" rows="1" maxlength="200">${esc(t.title)}</textarea></div>
          <div class="tk-desc"><i class="ti ti-align-left"></i><textarea id="tk-c-d" rows="1" maxlength="2000" placeholder="Описание">${esc(t.desc || '')}</textarea></div>
          <div class="tk-subs" id="tk-subs"></div>
          <form class="tk-sub-add" id="tk-sub-add"><span class="tk-plus"><i class="ti ti-plus"></i></span><input type="text" maxlength="200" placeholder="Добавить подзадачу"></form>
        </div>
        <div class="tk-modal-side">
          <div class="tk-side-l">Срок</div>
          <div class="tk-pick"><button class="tk-pick-b" id="tk-date-b"></button>
            <div class="tk-menu" id="tk-date-m" hidden>${[['', 'Без срока', 'ti-calendar-off'], [iso(today()), 'Сегодня', 'ti-calendar-event'], [iso(addDays(today(), 1)), 'Завтра', 'ti-sun'], [iso(addDays(today(), 7)), 'Через неделю', 'ti-calendar-week']].map(([v, l, ic]) => `<button data-d="${v}"><i class="ti ${ic}"></i>${l}</button>`).join('')}<label><i class="ti ti-calendar-search"></i><input type="date" id="tk-c-date" value="${t.date || ''}"></label><label><i class="ti ti-clock"></i><input type="time" id="tk-c-time" value="${t.time || ''}"><button type="button" class="tk-tm-x" id="tk-c-time-x" aria-label="Без времени"><i class="ti ti-x"></i></button></label></div></div>
          <div class="tk-side-l">Проект</div>
          <div class="tk-pick"><button class="tk-pick-b" id="tk-proj-b"></button><div class="tk-menu" id="tk-proj-m" hidden></div></div>
          <div class="tk-side-l">Приоритет</div>
          <div class="tk-pick"><button class="tk-pick-b" id="tk-prio-b"></button>
            <div class="tk-menu" id="tk-prio-m" hidden>${[1, 2, 3, 4].map(p => `<button data-p="${p}">${flag(p, 18)}Приоритет ${p}<i class="ti ti-check tk-mk"></i></button>`).join('')}</div></div>
        </div>
      </div></div>`;
    document.body.appendChild(ov);
    const paint = () => {
      $('.tk-mt').style.setProperty('--pc', PRIO[t.prio] || '#808080'); $('#tk-c-done').className = 'tk-ck' + (t.prio < 4 ? ' p' : '') + (t.done ? ' on' : '');
      $('#tk-prio-b').innerHTML = `${flag(t.prio)}P${t.prio}<i class="ti ti-chevron-down"></i>`;
      ov.querySelectorAll('[data-p]').forEach(x => x.classList.toggle('on', +x.dataset.p === t.prio));
      $('#tk-date-b').innerHTML = dateVal() + '<i class="ti ti-chevron-down"></i>'; $('#tk-where').innerHTML = where();
      ov.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('on', x.dataset.d === (t.date || '')));
      const pr = t.proj ? projOf(t.proj) : null;
      $('#tk-proj-b').innerHTML = (pr ? `<i class="tk-pdot" style="background:${pr.color}"></i>${esc(pr.name)}` : '<i class="ti ti-inbox"></i>Входящие') + '<i class="ti ti-chevron-down"></i>';
      ov.querySelectorAll('[data-pj]').forEach(x => x.classList.toggle('on', x.dataset.pj === (t.proj || '')));
    };
    const bindProj = () => {
      $('#tk-proj-m').innerHTML = projMenu();
      ov.querySelectorAll('[data-pj]').forEach(b => b.onclick = () => { t.proj = b.dataset.pj || null; $('#tk-proj-m').hidden = true; paint(); commit(); });
      $('#tk-pj-new').addEventListener('submit', e => { e.preventDefault(); const v = $('#tk-pj-new input').value.trim().slice(0, 40); if (!v) return;
        const ps = projects(), np = { id: 'p' + uid(), name: v, color: PCOL[ps.length % PCOL.length] }; saveProjects(ps.concat(np)); t.proj = np.id; bindProj(); $('#tk-proj-m').hidden = true; paint(); commit(); });
    };
    const readSubs = () => ov.querySelectorAll('[data-st]').forEach(inp => { const x = t.subs[+inp.dataset.st]; if (x) x.title = inp.value.trim() || x.title; });
    const drawSubs = () => { $('#tk-subs').innerHTML = t.subs.length ? subsHtml() : ''; bindSubs(); };
    function bindSubs() {
      const h = $('#tk-subs-h'); if (h) h.onclick = () => { readSubs(); subsOpen = !subsOpen; drawSubs(); };
      ov.querySelectorAll('[data-sck]').forEach(b => b.onclick = () => { readSubs(); const x = t.subs[+b.dataset.sck]; x.done = !x.done; drawSubs(); commit(); });
      ov.querySelectorAll('[data-sx]').forEach(b => b.onclick = () => { readSubs(); t.subs.splice(+b.dataset.sx, 1); drawSubs(); commit(); });
      ov.querySelectorAll('[data-st]').forEach(inp => inp.addEventListener('change', () => { readSubs(); commit(); }));
    }
    bindProj(); drawSubs(); paint();
    const grow = (ta) => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ['#tk-c-t', '#tk-c-d'].forEach(q => { const ta = $(q); grow(ta); ta.addEventListener('input', () => grow(ta)); ta.addEventListener('change', commit); });
    $('#tk-c-t').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#tk-c-d').focus(); } });
    $('#tk-sub-add').addEventListener('submit', e => { e.preventDefault(); const inp = $('#tk-sub-add input'); const v = inp.value.trim(); if (!v) return; readSubs(); t.subs.push({ id: uid(), title: v.slice(0, 200), done: false }); subsOpen = true; inp.value = ''; drawSubs(); commit(); inp.focus(); });
    const menu = (b, m) => { $(b).onclick = (e) => { e.stopPropagation(); const open = $(m).hidden; ov.querySelectorAll('.tk-menu').forEach(x => { x.hidden = true; }); $(m).hidden = !open; }; };
    menu('#tk-date-b', '#tk-date-m'); menu('#tk-prio-b', '#tk-prio-m'); menu('#tk-proj-b', '#tk-proj-m');
    $('.tk-modal').addEventListener('click', e => { if (!e.target.closest('.tk-pick')) ov.querySelectorAll('.tk-menu').forEach(x => { x.hidden = true; }); });
    ov.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { t.date = b.dataset.d || null; $('#tk-date-m').hidden = true; paint(); commit(); });
    $('#tk-c-date').onchange = (e) => { t.date = e.target.value || null; $('#tk-date-m').hidden = true; paint(); commit(); };
    $('#tk-c-time').onchange = (e) => { t.time = e.target.value || null; if (t.time && !t.date) t.date = iso(today()); paint(); commit(); };
    $('#tk-c-time-x').onclick = () => { t.time = null; $('#tk-c-time').value = ''; paint(); commit(); };
    ov.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { t.prio = +b.dataset.p; $('#tk-prio-m').hidden = true; paint(); commit(); });
    $('#tk-c-done').onclick = () => { t.done = !t.done; paint(); commit(); };
    const onKey = (e) => { if (e.key === 'Escape' && document.body.contains(ov) && !e.defaultPrevented) { e.preventDefault(); close(); } };
    const close = () => { document.removeEventListener('keydown', onKey, true); readSubs(); const pend = $('#tk-sub-add input').value.trim(); if (pend) t.subs.push({ id: uid(), title: pend.slice(0, 200), done: false }); commit(); ov.remove(); redraw(); };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    $('[data-close]').onclick = close;
    $('#tk-c-del').onclick = () => { if (confirm('Удалить задачу?')) { remove(t.id); ov.remove(); redraw(); } };
  }

  /* быстрое добавление из меню слева */
  function quickAdd(redraw) {
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay tk-ov tk-qov ' + themeCls();
    let d = view === 'inbox' || view.startsWith('p:') ? '' : iso(today()), pj = view.startsWith('p:') ? view.slice(2) : '';
    const chips = () => [['', 'Входящие', 'ti-inbox'], [iso(today()), 'Сегодня', 'ti-calendar-event'], [iso(addDays(today(), 1)), 'Завтра', 'ti-sun']].map(([v, l, ic]) => `<button type="button" data-qd="${v}" class="${d === v ? 'on' : ''}"><i class="ti ${ic}"></i>${l}</button>`).join('');
    ov.innerHTML = `<form class="tk-quick"><input class="tk-af-t" maxlength="200" placeholder="Название задачи" autocomplete="off"><div class="tk-sms"></div><input class="tk-af-d" maxlength="2000" placeholder="Описание" autocomplete="off">
      <div class="tk-q-chips">${chips()}</div>
      <div class="tk-q-row"><label><i class="ti ti-clock"></i><input type="time" class="tk-q-time"></label>${projects().length ? `<label><i class="ti ti-folder"></i><select class="tk-q-proj"><option value="">Входящие</option>${projects().map(p => `<option value="${esc(p.id)}"${p.id === pj ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>` : ''}</div>
      <div class="tk-af-b"><button type="button" class="tk-btn ghost" data-cancel>Отмена</button><button type="submit" class="tk-btn red">Добавить задачу</button></div></form>`;
    document.body.appendChild(ov);
    const f = ov.querySelector('form'); f.querySelector('.tk-af-t').focus(); bindSmart(f.querySelector('.tk-af-t'), f.querySelector('.tk-sms'));
    const bindC = () => ov.querySelectorAll('[data-qd]').forEach(b => b.onclick = () => { d = b.dataset.qd; ov.querySelector('.tk-q-chips').innerHTML = chips(); bindC(); });
    bindC();
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    ov.querySelector('[data-cancel]').onclick = () => ov.remove();
    f.addEventListener('submit', e => { e.preventDefault(); const t = f.querySelector('.tk-af-t').value.trim(); if (!t) return; const tm = f.querySelector('.tk-q-time').value || null, sp = f.querySelector('.tk-q-proj');
      addSmart(t, d || null, f.querySelector('.tk-af-d').value, sp ? sp.value || null : pj || null, tm); ov.remove(); redraw(); });
  }

  function toast(text, undo, redraw) {
    document.querySelectorAll('.tk-toast').forEach(x => x.remove()); clearTimeout(toastT);
    const el = document.createElement('div'); el.className = 'tk-toast';
    el.innerHTML = `<span>${esc(text)}</span>${undo ? '<button data-undo>Отменить</button>' : ''}<button class="tk-toast-x" aria-label="Закрыть"><i class="ti ti-x"></i></button>`;
    document.body.appendChild(el);
    if (undo) el.querySelector('[data-undo]').onclick = () => { save(undo); el.remove(); redraw(); };
    el.querySelector('.tk-toast-x').onclick = () => el.remove();
    toastT = setTimeout(() => el.remove(), 5000);
  }

  /* ── Перетаскивание: мышь без задержки, палец после короткого удержания ── */
  let dragOff = null;
  function bindDrag(box, redraw) {
    if (dragOff) dragOff();
    let st = null, raf = 0, auto = 0;
    const block = (e) => { if (st && st.on) e.preventDefault(); };
    const clear = () => { if (!st) return; clearTimeout(st.timer); cancelAnimationFrame(raf); cancelAnimationFrame(auto); if (st.ghost) st.ghost.remove(); if (st.ph) st.ph.remove();
      if (st.card) st.card.classList.remove('tk-dragging'); box.querySelectorAll('.tk-drop').forEach(x => x.classList.remove('tk-drop'));
      document.removeEventListener('touchmove', block, { passive: false }); document.body.classList.remove('tk-drag-on'); st = null; };
    const place = () => {
      const x = st.cx, y = st.cy; st.ghost.style.transform = `translate3d(${x - st.dx}px,${y - st.dy}px,0) rotate(2deg)`;
      const el = document.elementFromPoint(x, y); const lst = el && el.closest('[data-list]');
      box.querySelectorAll('.tk-drop').forEach(d => { if (d !== lst) d.classList.remove('tk-drop'); });
      if (!lst || !box.contains(lst) || (lst.dataset.list && lst.dataset.list < iso(today()))) return; lst.classList.add('tk-drop'); st.over = lst;
      const cards = [...lst.querySelectorAll(':scope > .tk-card:not(.tk-dragging)')];
      const next = cards.find(c => { const rr = c.getBoundingClientRect(); return y < rr.top + rr.height / 2; }) || lst.querySelector(':scope > .tk-addb, :scope > .tk-addf');
      if (next) { if (st.ph.nextSibling !== next) lst.insertBefore(st.ph, next); } else if (st.ph.parentNode !== lst) lst.appendChild(st.ph);
    };
    const start = () => {
      st.on = true; const r = st.card.getBoundingClientRect();
      const g = st.card.cloneNode(true); g.classList.add('tk-ghost'); g.style.width = r.width + 'px'; (box.closest('.tk-app') || document.body).appendChild(g);
      const ph = document.createElement('div'); ph.className = 'tk-ph-drop'; ph.style.height = r.height + 'px';
      st.ghost = g; st.ph = ph; st.dx = st.x - r.left; st.dy = st.y - r.top;
      st.card.after(ph); st.card.classList.add('tk-dragging'); document.body.classList.add('tk-drag-on');
      place();
      (function edge() { if (!st || !st.on) return; const bd = box.querySelector('#tk-board');
        if (bd) { const rr = bd.getBoundingClientRect(); const far = Math.abs(st.cx - st.x) > 40, k = !far ? 0 : st.cx > rr.right - 60 ? 1 : st.cx < rr.left + 40 ? -1 : 0; if (k) { bd.scrollLeft += k * 14; place(); } }
        auto = requestAnimationFrame(edge); })();
      if (navigator.vibrate) try { navigator.vibrate(10); } catch (e) {}
    };
    const down = e => {
      const c = e.target.closest('.tk-card'); if (!c || !box.contains(c) || e.target.closest('.tk-ck') || e.button > 0) return;
      st = { card: c, id: c.dataset.id, x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY, touch: e.pointerType !== 'mouse', on: false };
      if (st.touch) { document.addEventListener('touchmove', block, { passive: false }); st.timer = setTimeout(() => { if (st) start(); }, 200); }
      else e.preventDefault(); /* без выделения текста при перетаскивании мышью */
    };
    const mv = e => {
      if (!st) return; st.cx = e.clientX; st.cy = e.clientY;
      if (!st.on) { const d = Math.hypot(e.clientX - st.x, e.clientY - st.y); if (st.touch) { if (d > 10) clear(); return; } if (d > 3) start(); else return; }
      e.preventDefault(); cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (st && st.on) place(); });
    };
    const end = () => {
      if (!st) return; if (st.on) { cancelAnimationFrame(raf); place(); } /* последняя точка, даже если кадр ещё не отрисован */
      const was = st.on, id = st.id, lst = st.over, ph = st.ph; let ids = null;
      if (was && lst && ph && ph.parentNode === lst) ids = [...lst.children].filter(c => c === ph || (c.classList.contains('tk-card') && !c.classList.contains('tk-dragging'))).map(c => c === ph ? id : c.dataset.id);
      const to = lst ? lst.dataset.list : undefined, keep = !!(lst && lst.dataset.keep); clear();
      if (!was) return;
      box.dataset.justDragged = '1'; setTimeout(() => { delete box.dataset.justDragged; }, 80);
      if (to === undefined || !ids) return;
      const before = list(), t = before.find(x => x.id === id); if (!t) return;
      const pos = {}; ids.forEach((x, i) => { pos[x] = i + 1; });
      const moved = !keep && (t.date || '') !== to;
      save(before.map(x => pos[x.id] ? Object.assign({}, x, { order: pos[x.id] }, x.id === id && !keep ? { date: to || null, time: to ? x.time || null : null } : {}) : x)); redraw();
      toast(moved ? (to ? 'Перенесено: ' + dayLabel(to).toLowerCase() : 'Перенесено во Входящие') : 'Порядок изменён', before, redraw);
    };
    box.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', mv, { passive: false }); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', clear);
    dragOff = () => { box.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', clear); };
  }

  /* ── Вкладки: Входящие, Сегодня, Предстоящее и проекты. Порядок и скрытие в home.tabs.tasks, как у всех разделов ── */
  function tabCfg() { const t = ((Store.get().home || {}).tabs || {}).tasks || {}; const a = (v) => toArr(v).filter(x => typeof x === 'string'); return { order: a(t.order), hidden: a(t.hidden) }; }
  function tabIds() {
    const c = tabCfg(), base = ['inbox', 'today', 'week'].concat(projects().map(p => 'p:' + p.id), ['done']);
    const all = c.order.filter(k => base.includes(k)).concat(base.filter(k => !c.order.includes(k)));
    let vis = all.filter(k => !c.hidden.includes(k)); if (!vis.length) vis = [all[0]];
    return { all, vis };
  }
  function tabsEditor(redraw) {
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay tk-ov ' + themeCls();
    let order = tabIds().all, hidden = tabCfg().hidden.filter(k => order.includes(k)), ps = projects().map(p => Object.assign({}, p));
    const nm = (k) => k.startsWith('p:') ? (ps.find(p => 'p:' + p.id === k) || {}).name || '' : NAME[k];
    const draw = () => {
      ov.innerHTML = `<div class="tk-tabs-m"><div class="tk-tm-h"><b>Вкладки</b><button class="tk-x" data-close aria-label="Закрыть"><i class="ti ti-x"></i></button></div>
        <div class="tk-tm-l">${order.map((k, i) => { const pr = k.startsWith('p:') ? ps.find(p => 'p:' + p.id === k) : null, off = hidden.includes(k);
          return `<div class="tk-tm-r${off ? ' off' : ''}"><button class="tk-ib" data-eye="${esc(k)}" aria-label="${off ? 'Показать' : 'Скрыть'}"><i class="ti ti-${off ? 'eye-off' : 'eye'}"></i></button>
            ${pr ? `<i class="tk-pdot" style="background:${pr.color}"></i><input value="${esc(pr.name)}" data-rn="${esc(pr.id)}" maxlength="40">` : `<span>${esc(nm(k))}</span>`}
            ${pr ? `<button class="tk-ib" data-del="${esc(pr.id)}" aria-label="Удалить проект"><i class="ti ti-trash"></i></button>` : ''}
            <button class="tk-ib" data-up="${i}" ${i ? '' : 'disabled'} aria-label="Выше"><i class="ti ti-chevron-up"></i></button><button class="tk-ib" data-dn="${i}" ${i < order.length - 1 ? '' : 'disabled'} aria-label="Ниже"><i class="ti ti-chevron-down"></i></button></div>`; }).join('')}</div>
        <form class="tk-tm-new"><span class="tk-plus"><i class="ti ti-plus"></i></span><input maxlength="40" placeholder="Новый проект"></form>
        <div class="tk-af-b"><button type="button" class="tk-btn ghost" data-reset>Как было</button><button type="button" class="tk-btn red" data-ok>Готово</button></div></div>`;
      const rd = () => ov.querySelectorAll('[data-rn]').forEach(inp => { const p = ps.find(x => x.id === inp.dataset.rn); if (p && inp.value.trim()) p.name = inp.value.trim().slice(0, 40); });
      ov.querySelectorAll('[data-eye]').forEach(b => b.onclick = () => { rd(); const k = b.dataset.eye; if (hidden.includes(k)) hidden = hidden.filter(x => x !== k); else if (order.filter(x => !hidden.includes(x)).length > 1) hidden.push(k); draw(); });
      ov.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { rd(); const i = +b.dataset.up; [order[i - 1], order[i]] = [order[i], order[i - 1]]; draw(); });
      ov.querySelectorAll('[data-dn]').forEach(b => b.onclick = () => { rd(); const i = +b.dataset.dn; [order[i + 1], order[i]] = [order[i], order[i + 1]]; draw(); });
      ov.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { rd(); const p = ps.find(x => x.id === b.dataset.del); if (!p || !confirm(`Удалить проект «${p.name}»? Задачи останутся, просто без проекта.`)) return;
        ps = ps.filter(x => x !== p); order = order.filter(k => k !== 'p:' + p.id); hidden = hidden.filter(k => k !== 'p:' + p.id); draw(); });
      ov.querySelector('.tk-tm-new').addEventListener('submit', e => { e.preventDefault(); rd(); const v = ov.querySelector('.tk-tm-new input').value.trim().slice(0, 40); if (!v) return;
        const np = { id: 'p' + uid(), name: v, color: PCOL[ps.length % PCOL.length] }; ps.push(np); const di = order.indexOf('done'); if (di >= 0) order.splice(di, 0, 'p:' + np.id); else order.push('p:' + np.id); draw(); ov.querySelector('.tk-tm-new input').focus(); });
      ov.querySelector('[data-close]').onclick = () => ov.remove();
      ov.querySelector('[data-reset]').onclick = () => { order = ['inbox', 'today', 'week'].concat(ps.map(p => 'p:' + p.id), ['done']); hidden = []; draw(); };
      ov.querySelector('[data-ok]').onclick = () => { rd();
        const gone = projects().filter(p => !ps.some(x => x.id === p.id)).map(p => p.id);
        if (gone.length) save(list().map(t => gone.includes(t.proj) ? Object.assign({}, t, { proj: null }) : t));
        saveProjects(ps); Store.set('home.tabs.tasks', { order, hidden: hidden.length ? hidden : null }); ov.remove(); redraw(); };
    };
    draw();
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  }

  /* ── Экран ── */
  function screen(mount) {
    if (!isOwner()) { Router.go('/home'); return; }
    /* выполненные хранятся неделю, потом удаляются сами */
    { const a = list(), now = Date.now(), lim = now - 7 * 864e5; let ch = false;
      const b = a.filter(t => !(t.done && t.doneAt && t.doneAt < lim)).map(t => { if (t.done && !t.doneAt) { ch = true; return Object.assign({}, t, { doneAt: now }); } return t; });
      if (ch || b.length !== a.length) save(b); }
    document.documentElement.classList.add('tk-on');
    const tabsOff = () => !!(Store.get().tasks || {}).tabsOff;
    const vis0 = tabIds().vis; view = vis0.includes('week') ? 'week' : vis0[0]; boardX = -1; wk = 0;
    mount.innerHTML = `<div class="tk-app ${themeCls()}" id="tk-app">
      <header class="tk-hdr"><button class="tk-hb" id="tk-back" aria-label="На главную"><i class="ti ti-arrow-left"></i></button><p>Задачи</p>
        <button class="tk-hb" id="tk-views" aria-label="Разделы задач" title="Разделы"><i class="ti ti-layout-list"></i></button>
        <button class="tk-hb tk-hb-add" id="tk-add-h" aria-label="Добавить задачу" title="Добавить задачу"><i class="ti ti-plus"></i></button>
        <button class="tk-hb" id="tk-theme" aria-label="Светлые или тёмные задачи" title="Светлые / тёмные задачи"><i class="ti"></i></button></header>
      <div class="tk-wrap">
      <aside class="tk-side">
        <button class="tk-new" id="tk-new"><span class="tk-plus"><i class="ti ti-plus"></i></span>Добавить задачу</button>
        <nav class="tk-navl" id="tk-navl"></nav>
      </aside>
      <main class="tk-main" id="tk-main"></main></div></div>`;
    mount.querySelector('#tk-app').classList.toggle('tabs-off', tabsOff());
    const app = mount.querySelector('#tk-app'), main = mount.querySelector('#tk-main');
    const paintTheme = () => { const l = isLight(); app.classList.toggle('tkl', l); app.classList.toggle('tkd', !l); document.documentElement.classList.toggle('tk-on-light', l); mount.querySelector('#tk-theme i').className = 'ti ' + (l ? 'ti-moon' : 'ti-sun'); };
    paintTheme();
    mount.querySelector('#tk-back').onclick = () => Router.go('/home');
    mount.querySelector('#tk-theme').onclick = () => { Store.set('tasks.theme', isLight() ? 'dark' : 'light'); paintTheme(); };
    const draw = () => {
      const all = list(), td = iso(today());
      const n = { inbox: all.filter(t => !t.date && !t.proj && !t.done).length, today: all.filter(t => !t.done && t.date === td).length, week: '' };
      projects().forEach(p => { n['p:' + p.id] = all.filter(t => t.proj === p.id && !t.done).length; });
      const tv = tabIds(); if (!tv.vis.includes(view) && !tv.all.includes(view)) view = tv.vis[0];
      const nm = (k) => k.startsWith('p:') ? (projOf(k.slice(2)) || {}).name || '' : NAME[k];
      mount.querySelector('#tk-navl').innerHTML = tv.vis.map(k => `<button data-v="${esc(k)}" class="${k === view ? 'on' : ''}"><span class="tt-lg">${esc(nm(k))}</span><em>${n[k] || ''}</em></button>`).join('') + '<button class="tc-edit" id="tk-tabs-ed" aria-label="Настроить вкладки" title="Настроить вкладки"><i class="ti ti-adjustments-horizontal"></i></button>';
      mount.querySelectorAll('#tk-navl [data-v]').forEach(x => x.onclick = () => { view = x.dataset.v; wk = 0; boardX = -1; draw(); });
      mount.querySelector('#tk-tabs-ed').onclick = () => tabsEditor(draw);
      const ob = main.querySelector('#tk-board'); if (ob && boardX >= 0) boardX = ob.scrollLeft;
      main.innerHTML = view === 'week' ? weekView() : listView(view);
      const bd = main.querySelector('#tk-board');
      if (bd) { if (boardX < 0) { /* новая неделя: у текущей показываем со вчерашнего дня, как Todoist */
          bd.scrollLeft = 0; boardX = 0; } else bd.scrollLeft = boardX; }
      bindMain();
    };
    function bindMain() {
      main.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { const d = b.dataset.add, pj = b.dataset.proj || null; b.insertAdjacentHTML('beforebegin', addForm(d)); const f = b.previousElementSibling; b.remove();
        const t = f.querySelector('.tk-af-t'); t.focus(); bindSmart(t, f.querySelector('.tk-sms'));
        f.querySelector('[data-cancel]').onclick = () => draw();
        f.addEventListener('submit', e => { e.preventDefault(); if (!t.value.trim()) return; addSmart(t.value, d || null, f.querySelector('.tk-af-d').value, pj); draw(); const nb = main.querySelector(`[data-add="${d}"]`); if (nb) nb.click(); });
        f.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); draw(); } }); });
      main.querySelectorAll('[data-ck]').forEach(x => x.onclick = () => { const t = list().find(y => y.id === x.dataset.ck); if (!t) return; x.closest('.tk-card').classList.add('pop');
        setTimeout(() => { const before = list(); patch(t.id, { done: !t.done, doneAt: !t.done ? Date.now() : null }); draw(); if (!t.done) toast('Задача выполнена', before, draw); }, t.done ? 0 : 280); });
      /* вся плашка открывает задачу, кроме кружка */
      main.querySelectorAll('.tk-card').forEach(x => x.onclick = (e) => { if (main.dataset.justDragged || e.target.closest('.tk-ck')) return; editModal(x.dataset.id, draw); });
      main.querySelectorAll('[data-move]').forEach(x => x.onclick = () => { const before = list(), t = iso(today()); save(before.map(y => !y.done && y.date && y.date < t ? Object.assign({}, y, { date: t }) : y)); draw(); toast('Перенесено на сегодня', before, draw); });
      /* стрелки листают недели целиком (Пн–Вс), «Сегодня» возвращает к текущей */
      main.querySelectorAll('[data-wk]').forEach(x => x.onclick = () => { const k = +x.dataset.wk; wk = k ? Math.max(0, wk + k) : 0; boardX = -1; draw(); });
    }
    mount.querySelector('#tk-new').onclick = () => quickAdd(draw);
    mount.querySelector('#tk-add-h').onclick = () => quickAdd(draw);
    /* кнопка как «Планы» в Тренировках: все разделы и проекты одним списком, вкладки сверху можно спрятать */
    mount.querySelector('#tk-views').onclick = (e) => {
      e.stopPropagation(); const old = document.querySelector('.tk-vmenu'); if (old) { old.remove(); return; }
      const all = list(), td = iso(today()), ic = ICO;
      const cnt = (k) => k === 'inbox' ? all.filter(t => !t.date && !t.proj && !t.done).length : k === 'today' ? all.filter(t => !t.done && t.date === td).length : k.startsWith('p:') ? all.filter(t => t.proj === k.slice(2) && !t.done).length : 0;
      const nm = (k) => k.startsWith('p:') ? (projOf(k.slice(2)) || {}).name || '' : NAME[k];
      const m = document.createElement('div'); m.className = 'tk-vmenu ' + themeCls();
      m.innerHTML = tabIds().all.map(k => { const pr = k.startsWith('p:') ? projOf(k.slice(2)) : null, n = cnt(k);
        return `<button data-go="${esc(k)}" class="${k === view ? 'on' : ''}">${pr ? `<i class="tk-pdot" style="background:${pr.color}"></i>` : `<i class="ti ${ic[k]}"></i>`}<span>${esc(nm(k))}</span><em>${n || ''}</em></button>`; }).join('')
        + `<form class="tk-pj-new"><i class="ti ti-plus"></i><input maxlength="40" placeholder="Новый проект"></form>
        <div class="tk-vm-sep"></div>
        <button data-tg><i class="ti ti-${tabsOff() ? 'eye' : 'eye-off'}"></i><span>${tabsOff() ? 'Показать вкладки' : 'Скрыть вкладки'}</span></button>
        <button data-cfg><i class="ti ti-adjustments-horizontal"></i><span>Настроить вкладки</span></button>`;
      mount.querySelector('#tk-app').appendChild(m);
      const off = (ev) => { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('click', off, true); } };
      setTimeout(() => document.addEventListener('click', off, true), 0);
      const shut = () => { m.remove(); document.removeEventListener('click', off, true); };
      m.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { view = b.dataset.go; wk = 0; boardX = -1; shut(); draw(); });
      m.querySelector('[data-tg]').onclick = () => { Store.set('tasks.tabsOff', tabsOff() ? null : true); mount.querySelector('#tk-app').classList.toggle('tabs-off', tabsOff()); shut(); };
      m.querySelector('[data-cfg]').onclick = () => { shut(); tabsEditor(draw); };
      m.querySelector('.tk-pj-new').addEventListener('submit', ev => { ev.preventDefault(); const v = m.querySelector('.tk-pj-new input').value.trim().slice(0, 40); if (!v) return;
        const ps = projects(), np = { id: 'p' + uid(), name: v, color: PCOL[ps.length % PCOL.length] }; saveProjects(ps.concat(np)); view = 'p:' + np.id; shut(); draw(); });
    };
    bindDrag(main, draw);
    draw();
  }

  return { screen, isOwner, todayCount, list };
})();
window.Screens = window.Screens || {};
window.Screens.tasks = function (mount) { Tasks.screen(mount); };
