/* ============================================================
   ЗАДАЧИ (пока только для владельца, по ownerEmail). Устроены как Todoist.
   На компьютере слева меню (Входящие / Сегодня / Предстоящее), справа экран.
   «Предстоящее»: дни колонками с сегодняшнего, лента листается неделями Пн–Вс,
   задачи перетаскиваются между днями и внутри дня (поле order).
   Своя тема (светлая / тёмная) как в Финансах: tasks.theme, на остальное приложение не влияет.
   Данные: tasks.list = [{ id, title, date: 'YYYY-MM-DD' | null, done, doneAt, createdAt, order,
                           desc, prio: 1..4, subs: [{ id, title, done }] }]
   ============================================================ */
window.Tasks = (function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toArr = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
  const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const MONN = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const DOW = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const PRIO = { 1: '#D1453B', 2: '#EB8909', 3: '#246FE0', 4: '' }; /* цвета приоритетов как в Todoist */
  const DAYS = 56; /* сколько дней вперёд в «Предстоящем» */
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const parse = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const plural = (n, a, b, c) => { const x = n % 10, y = n % 100; return x === 1 && y !== 11 ? a : x >= 2 && x <= 4 && (y < 12 || y > 14) ? b : c; };

  function isOwner() {
    const u = window.FirebaseSync && FirebaseSync.currentUser ? FirebaseSync.currentUser() : null;
    const owner = (window.AUTH_CONFIG && AUTH_CONFIG.ownerEmail || '').toLowerCase();
    return !!(u && u.email && owner && u.email.toLowerCase() === owner);
  }
  function norm(t) { return Object.assign({}, t, { subs: toArr(t.subs).filter(s => s && s.title), prio: [1, 2, 3, 4].includes(+t.prio) ? +t.prio : 4 }); }
  function list() { return toArr((Store.get().tasks || {}).list).filter(t => t && t.id && t.title).map(norm); }
  function save(arr) { Store.set('tasks.list', arr.map(t => JSON.parse(JSON.stringify(t)))); }
  const ord = (t) => (t.order != null && isFinite(+t.order)) ? +t.order : +t.createdAt || 0;
  const byOrd = (x, y) => (x.done - y.done) || (ord(x) - ord(y));
  function add(title, date, desc) { title = String(title || '').trim().slice(0, 200); if (!title) return; const a = list();
    const same = a.filter(t => (t.date || null) === (date || null)); const mx = same.length ? Math.max(...same.map(ord)) : 0;
    a.push({ id: uid(), title, date: date || null, done: false, createdAt: Date.now(), order: Math.max(mx + 1, Date.now()), prio: 4, desc: String(desc || '').trim().slice(0, 2000) || null }); save(a); }
  function patch(id, p) { save(list().map(t => t.id === id ? Object.assign({}, t, p) : t)); }
  function remove(id) { save(list().filter(t => t.id !== id)); }
  function todayCount() { const t = iso(today()); return list().filter(x => !x.done && x.date && x.date <= t).length; }

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
  const ICO = { inbox: 'ti-inbox', today: 'ti-calendar-event', week: 'ti-calendar-week' };
  const NAME = { inbox: 'Входящие', today: 'Сегодня', week: 'Предстоящее' };

  let view = 'week', boardX = 0, toastT = null;

  /* ── Разметка ── */
  function card(t, opts) {
    const td = iso(today()), late = !t.done && t.date && t.date < td;
    const showDate = t.date && (!(opts && opts.noDate) || late);
    const subs = t.subs.length ? `<span class="tk-m"><i class="ti ti-subtask"></i>${t.subs.filter(s => s.done).length}/${t.subs.length}</span>` : '';
    const date = showDate ? `<span class="tk-m ${late ? 'late' : 'ok'}"><i class="ti ti-calendar"></i>${dayLabel(t.date)}</span>` : '';
    const desc = t.desc ? `<span class="tk-d">${esc(t.desc.split('\n')[0])}</span>` : '';
    const meta = subs + date;
    return `<div class="tk-card${t.done ? ' done' : ''}" data-id="${esc(t.id)}" style="--pc:${PRIO[t.prio] || '#808080'}">
      <button class="tk-ck${t.prio < 4 ? ' p' : ''}" data-ck="${esc(t.id)}" aria-label="${t.done ? 'Вернуть' : 'Готово'}"><i class="ti ti-check"></i></button>
      <div class="tk-c-b" data-ed="${esc(t.id)}"><div class="tk-c-t">${esc(t.title)}</div>${desc}${meta ? `<div class="tk-meta">${meta}</div>` : ''}</div>
    </div>`;
  }
  const addBtn = (date) => `<button class="tk-addb" data-add="${date || ''}"><span class="tk-plus"><i class="ti ti-plus"></i></span>Добавить задачу</button>`;
  const addForm = (date) => `<form class="tk-addf" data-date="${date || ''}"><input class="tk-af-t" maxlength="200" placeholder="Название задачи" autocomplete="off"><input class="tk-af-d" maxlength="2000" placeholder="Описание" autocomplete="off">
      <div class="tk-af-b"><button type="button" class="tk-btn ghost" data-cancel>Отмена</button><button type="submit" class="tk-btn red">Добавить задачу</button></div></form>`;

  function listView(kind) {
    const all = list(), td = iso(today());
    if (kind === 'inbox') {
      const a = all.filter(t => !t.date && !t.done).sort(byOrd), dn = all.filter(t => !t.date && t.done);
      return `<div class="tk-page"><div class="tk-ph"><h1>Входящие</h1><span class="tk-cnt">${a.length ? a.length + ' ' + plural(a.length, 'задача', 'задачи', 'задач') : ''}</span></div>
        <div class="tk-list" data-list="">${a.map(t => card(t)).join('')}${addBtn('')}</div>${dn.length ? `<div class="tk-sec">Выполнено · ${dn.length}</div><div class="tk-list">${dn.map(t => card(t)).join('')}</div>` : ''}</div>`;
    }
    const late = all.filter(t => !t.done && t.date && t.date < td).sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : byOrd(x, y));
    const now = all.filter(t => !t.done && t.date === td).sort(byOrd), dn = all.filter(t => t.done && t.date === td);
    const n = late.length + now.length;
    return `<div class="tk-page"><div class="tk-ph"><h1>Сегодня</h1><span class="tk-cnt">${n ? '<i class="ti ti-circle-check"></i>' + n + ' ' + plural(n, 'задача', 'задачи', 'задач') : ''}</span></div>
      ${late.length ? `<div class="tk-sec"><span>Просрочено</span><button class="tk-move" data-move>Перенести</button></div><div class="tk-list">${late.map(t => card(t)).join('')}</div>` : ''}
      <div class="tk-sec"><span>${today().getDate()} ${MON[today().getMonth()]} · Сегодня · ${DOW[today().getDay()]}</span></div>
      <div class="tk-list" data-list="${td}">${now.map(t => card(t, { noDate: true })).join('')}${addBtn(td)}</div>
      ${dn.length ? `<div class="tk-sec">Выполнено · ${dn.length}</div><div class="tk-list">${dn.map(t => card(t, { noDate: true })).join('')}</div>` : ''}</div>`;
  }

  function weekView() {
    const all = list(), td = iso(today());
    const late = all.filter(t => !t.done && t.date && t.date < td).sort((x, y) => x.date < y.date ? -1 : 1);
    const days = Array.from({ length: DAYS }, (_, i) => addDays(today(), i));
    const col = (d) => { const ds = iso(d), items = all.filter(t => t.date === ds).sort(byOrd), lb = dayLabel(ds), nd = items.filter(t => !t.done).length;
      const name = lb === 'Сегодня' || lb === 'Завтра' ? lb : DOW[d.getDay()];
      return `<section class="tk-col${d.getDay() === 1 ? ' mon' : ''}" data-day="${ds}"><header>${d.getDate()} ${MON[d.getMonth()]} · ${name}<i>${nd || ''}</i></header>
        <div class="tk-col-l" data-list="${ds}">${items.map(t => card(t, { noDate: true })).join('')}${addBtn(ds)}</div></section>`; };
    return `<div class="tk-page tk-page-w"><div class="tk-ph"><h1>Предстоящее</h1></div>
      <div class="tk-wbar"><b id="tk-month">${MONN[today().getMonth()]} ${today().getFullYear()}</b>
        <div class="tk-nav"><button data-wk="-1" aria-label="Раньше"><i class="ti ti-chevron-left"></i></button><button data-wk="0">Сегодня</button><button data-wk="1" aria-label="Позже"><i class="ti ti-chevron-right"></i></button></div></div>
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
      patch(t.id, { title, desc: $('#tk-c-d').value.trim().slice(0, 2000) || null, date: t.date || null, prio: t.prio, subs: t.subs.length ? t.subs : null, done: !!t.done, doneAt: t.done ? (t0.doneAt || Date.now()) : null }); };
    const where = () => `<i class="ti ti-${t.date ? 'calendar' : 'inbox'}"></i>${t.date ? dayLabel(t.date) : 'Входящие'}`;
    const subsHtml = () => `<button class="tk-subs-h" id="tk-subs-h"><i class="ti ti-chevron-${subsOpen ? 'down' : 'right'}"></i><b>Подзадачи</b><span>${t.subs.filter(x => x.done).length}/${t.subs.length}</span></button>
      ${subsOpen ? t.subs.map((x, i) => `<div class="tk-sub${x.done ? ' done' : ''}"><button class="tk-ck" data-sck="${i}"><i class="ti ti-check"></i></button><input value="${esc(x.title)}" data-st="${i}" maxlength="200"><button class="tk-sub-x" data-sx="${i}" aria-label="Удалить подзадачу"><i class="ti ti-x"></i></button></div>`).join('') : ''}`;
    const dateVal = () => t.date ? `<i class="ti ti-calendar ${t.date < iso(today()) ? 'late' : 'ok'}"></i>${dayLabel(t.date)}` : '<i class="ti ti-calendar-off"></i>Без срока';
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
            <div class="tk-menu" id="tk-date-m" hidden>${[['', 'Без срока', 'ti-calendar-off'], [iso(today()), 'Сегодня', 'ti-calendar-event'], [iso(addDays(today(), 1)), 'Завтра', 'ti-sun'], [iso(addDays(today(), 7)), 'Через неделю', 'ti-calendar-week']].map(([v, l, ic]) => `<button data-d="${v}"><i class="ti ${ic}"></i>${l}</button>`).join('')}<label><i class="ti ti-calendar-search"></i><input type="date" id="tk-c-date" value="${t.date || ''}"></label></div></div>
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
    };
    const readSubs = () => ov.querySelectorAll('[data-st]').forEach(inp => { const x = t.subs[+inp.dataset.st]; if (x) x.title = inp.value.trim() || x.title; });
    const drawSubs = () => { $('#tk-subs').innerHTML = t.subs.length ? subsHtml() : ''; bindSubs(); };
    function bindSubs() {
      const h = $('#tk-subs-h'); if (h) h.onclick = () => { readSubs(); subsOpen = !subsOpen; drawSubs(); };
      ov.querySelectorAll('[data-sck]').forEach(b => b.onclick = () => { readSubs(); const x = t.subs[+b.dataset.sck]; x.done = !x.done; drawSubs(); commit(); });
      ov.querySelectorAll('[data-sx]').forEach(b => b.onclick = () => { readSubs(); t.subs.splice(+b.dataset.sx, 1); drawSubs(); commit(); });
      ov.querySelectorAll('[data-st]').forEach(inp => inp.addEventListener('change', () => { readSubs(); commit(); }));
    }
    drawSubs(); paint();
    const grow = (ta) => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ['#tk-c-t', '#tk-c-d'].forEach(q => { const ta = $(q); grow(ta); ta.addEventListener('input', () => grow(ta)); ta.addEventListener('change', commit); });
    $('#tk-c-t').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#tk-c-d').focus(); } });
    $('#tk-sub-add').addEventListener('submit', e => { e.preventDefault(); const inp = $('#tk-sub-add input'); const v = inp.value.trim(); if (!v) return; readSubs(); t.subs.push({ id: uid(), title: v.slice(0, 200), done: false }); subsOpen = true; inp.value = ''; drawSubs(); commit(); inp.focus(); });
    const menu = (b, m) => { $(b).onclick = (e) => { e.stopPropagation(); const open = $(m).hidden; ov.querySelectorAll('.tk-menu').forEach(x => { x.hidden = true; }); $(m).hidden = !open; }; };
    menu('#tk-date-b', '#tk-date-m'); menu('#tk-prio-b', '#tk-prio-m');
    $('.tk-modal').addEventListener('click', e => { if (!e.target.closest('.tk-pick')) ov.querySelectorAll('.tk-menu').forEach(x => { x.hidden = true; }); });
    ov.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { t.date = b.dataset.d || null; $('#tk-date-m').hidden = true; paint(); commit(); });
    $('#tk-c-date').onchange = (e) => { t.date = e.target.value || null; $('#tk-date-m').hidden = true; paint(); commit(); };
    ov.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { t.prio = +b.dataset.p; $('#tk-prio-m').hidden = true; paint(); commit(); });
    $('#tk-c-done').onclick = () => { t.done = !t.done; paint(); commit(); };
    const close = () => { readSubs(); const pend = $('#tk-sub-add input').value.trim(); if (pend) t.subs.push({ id: uid(), title: pend.slice(0, 200), done: false }); commit(); ov.remove(); redraw(); };
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    $('[data-close]').onclick = close;
    ov.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(); } });
    $('#tk-c-del').onclick = () => { if (confirm('Удалить задачу?')) { remove(t.id); ov.remove(); redraw(); } };
  }

  /* быстрое добавление из меню слева */
  function quickAdd(redraw) {
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay tk-ov tk-qov ' + themeCls();
    let d = view === 'inbox' ? '' : iso(today());
    const chips = () => [['', 'Входящие', 'ti-inbox'], [iso(today()), 'Сегодня', 'ti-calendar-event'], [iso(addDays(today(), 1)), 'Завтра', 'ti-sun']].map(([v, l, ic]) => `<button type="button" data-qd="${v}" class="${d === v ? 'on' : ''}"><i class="ti ${ic}"></i>${l}</button>`).join('');
    ov.innerHTML = `<form class="tk-quick"><input class="tk-af-t" maxlength="200" placeholder="Название задачи" autocomplete="off"><input class="tk-af-d" maxlength="2000" placeholder="Описание" autocomplete="off">
      <div class="tk-q-chips">${chips()}</div><div class="tk-af-b"><button type="button" class="tk-btn ghost" data-cancel>Отмена</button><button type="submit" class="tk-btn red">Добавить задачу</button></div></form>`;
    document.body.appendChild(ov);
    const f = ov.querySelector('form'); f.querySelector('.tk-af-t').focus();
    const bindC = () => ov.querySelectorAll('[data-qd]').forEach(b => b.onclick = () => { d = b.dataset.qd; ov.querySelector('.tk-q-chips').innerHTML = chips(); bindC(); });
    bindC();
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    ov.querySelector('[data-cancel]').onclick = () => ov.remove();
    f.addEventListener('submit', e => { e.preventDefault(); const t = f.querySelector('.tk-af-t').value.trim(); if (!t) return; add(t, d || null, f.querySelector('.tk-af-d').value); ov.remove(); redraw(); });
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
      if (!lst || !box.contains(lst)) return; lst.classList.add('tk-drop'); st.over = lst;
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
      const c = e.target.closest('.tk-card'); if (!c || !box.contains(c) || e.target.closest('.tk-ck') || e.button > 0 || c.closest('.late')) return;
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
      if (!st) return; const was = st.on, id = st.id, lst = st.over, ph = st.ph; let ids = null;
      if (was && lst && ph && ph.parentNode === lst) ids = [...lst.children].filter(c => c === ph || (c.classList.contains('tk-card') && !c.classList.contains('tk-dragging'))).map(c => c === ph ? id : c.dataset.id);
      const to = lst ? lst.dataset.list : undefined; clear();
      if (!was) return;
      box.dataset.justDragged = '1'; setTimeout(() => { delete box.dataset.justDragged; }, 80);
      if (to === undefined || !ids) return;
      const before = list(), t = before.find(x => x.id === id); if (!t) return;
      const pos = {}; ids.forEach((x, i) => { pos[x] = i + 1; });
      const moved = (t.date || '') !== to;
      save(before.map(x => pos[x.id] ? Object.assign({}, x, { order: pos[x.id] }, x.id === id ? { date: to || null } : {}) : x)); redraw();
      toast(moved ? (to ? 'Перенесено: ' + dayLabel(to).toLowerCase() : 'Перенесено во Входящие') : 'Порядок изменён', before, redraw);
    };
    box.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', mv, { passive: false }); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', clear);
    dragOff = () => { box.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', clear); };
  }

  /* ── Экран ── */
  function screen(mount) {
    if (!isOwner()) { Router.go('/home'); return; }
    document.documentElement.classList.add('tk-on');
    view = window.TabsCustom && TabsCustom.isHidden('tasks', 'week') ? TabsCustom.firstVisible('tasks', ['inbox', 'today', 'week']) : 'week'; boardX = 0;
    mount.innerHTML = `<div class="tk-app ${themeCls()}" id="tk-app">
      <aside class="tk-side">
        <div class="tk-side-top"><button class="tk-ib" id="tk-back" aria-label="На главную" title="На главную"><i class="ti ti-arrow-left"></i></button><b>Задачи</b>
          <button class="tk-ib" id="tk-theme" aria-label="Светлые или тёмные задачи" title="Светлые / тёмные задачи"><i class="ti"></i></button></div>
        <button class="tk-new" id="tk-new"><span class="tk-plus"><i class="ti ti-plus"></i></span>Добавить задачу</button>
        <nav class="tk-navl" id="tk-navl">${['inbox', 'today', 'week'].map(k => `<button data-v="${k}"><i class="ti ${ICO[k]}"></i><span class="tt-lg">${NAME[k]}</span><em data-n="${k}"></em></button>`).join('')}</nav>
      </aside>
      <main class="tk-main" id="tk-main"></main></div>`;
    const app = mount.querySelector('#tk-app'), main = mount.querySelector('#tk-main');
    const paintTheme = () => { const l = isLight(); app.classList.toggle('tkl', l); app.classList.toggle('tkd', !l); document.documentElement.classList.toggle('tk-on-light', l); mount.querySelector('#tk-theme i').className = 'ti ' + (l ? 'ti-moon' : 'ti-sun'); };
    paintTheme();
    mount.querySelector('#tk-back').onclick = () => Router.go('/home');
    mount.querySelector('#tk-theme').onclick = () => { Store.set('tasks.theme', isLight() ? 'dark' : 'light'); paintTheme(); };
    const draw = () => {
      const all = list(), td = iso(today());
      const n = { inbox: all.filter(t => !t.date && !t.done).length, today: all.filter(t => !t.done && t.date && t.date <= td).length, week: '' };
      mount.querySelectorAll('#tk-navl [data-v]').forEach(x => x.classList.toggle('on', x.dataset.v === view));
      mount.querySelectorAll('[data-n]').forEach(x => { x.textContent = n[x.dataset.n] || ''; });
      const ob = main.querySelector('#tk-board'); if (ob) boardX = ob.scrollLeft;
      main.innerHTML = view === 'week' ? weekView() : listView(view);
      const bd = main.querySelector('#tk-board');
      if (bd) { bd.scrollLeft = boardX;
        const upd = () => { const r = bd.getBoundingClientRect(); const c = [...bd.querySelectorAll('.tk-col[data-day]')].find(x => x.getBoundingClientRect().right > r.left + 40); if (c) { const d = parse(c.dataset.day); main.querySelector('#tk-month').textContent = MONN[d.getMonth()] + ' ' + d.getFullYear(); } };
        bd.addEventListener('scroll', upd, { passive: true }); upd(); }
      bindMain();
    };
    function bindMain() {
      main.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { const d = b.dataset.add; b.insertAdjacentHTML('beforebegin', addForm(d)); const f = b.previousElementSibling; b.remove();
        const t = f.querySelector('.tk-af-t'); t.focus();
        f.querySelector('[data-cancel]').onclick = () => draw();
        f.addEventListener('submit', e => { e.preventDefault(); if (!t.value.trim()) return; add(t.value, d || null, f.querySelector('.tk-af-d').value); draw(); const nb = main.querySelector(`[data-add="${d}"]`); if (nb) nb.click(); });
        f.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); draw(); } }); });
      main.querySelectorAll('[data-ck]').forEach(x => x.onclick = () => { const t = list().find(y => y.id === x.dataset.ck); if (!t) return; x.closest('.tk-card').classList.add('pop');
        setTimeout(() => { const before = list(); patch(t.id, { done: !t.done, doneAt: !t.done ? Date.now() : null }); draw(); if (!t.done) toast('Задача выполнена', before, draw); }, t.done ? 0 : 280); });
      main.querySelectorAll('[data-ed]').forEach(x => x.onclick = () => { if (main.dataset.justDragged) return; editModal(x.dataset.ed, draw); });
      main.querySelectorAll('[data-move]').forEach(x => x.onclick = () => { const before = list(), t = iso(today()); save(before.map(y => !y.done && y.date && y.date < t ? Object.assign({}, y, { date: t }) : y)); draw(); toast('Перенесено на сегодня', before, draw); });
      /* стрелки листают неделями: Пн–Вс, «Сегодня» возвращает к началу */
      main.querySelectorAll('[data-wk]').forEach(x => x.onclick = () => { const bd = main.querySelector('#tk-board'); if (!bd) return; const k = +x.dataset.wk;
        const first = bd.firstElementChild ? bd.firstElementChild.offsetLeft : 0;
        const mons = [...bd.querySelectorAll('.tk-col.mon')].map(c => c.offsetLeft - first); const cur = bd.scrollLeft;
        let target = 0;
        if (k > 0) { const m = mons.find(v => v > cur + 5); target = m != null ? m : cur; }
        else if (k < 0) { const prev = mons.filter(v => v < cur - 5); target = prev.length ? prev[prev.length - 1] : 0; }
        bd.scrollTo({ left: Math.max(0, target), behavior: 'smooth' }); });
    }
    mount.querySelectorAll('#tk-navl [data-v]').forEach(x => x.onclick = () => { view = x.dataset.v; boardX = 0; draw(); });
    if (window.TabsCustom) TabsCustom.apply(mount.querySelector('#tk-navl'), 'tasks', 'data-v', () => draw());
    mount.querySelector('#tk-new').onclick = () => quickAdd(draw);
    bindDrag(main, draw);
    draw();
  }

  return { screen, isOwner, todayCount, list };
})();
window.Screens = window.Screens || {};
window.Screens.tasks = function (mount) { Tasks.screen(mount); };
