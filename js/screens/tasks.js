/* ============================================================
   ЗАДАЧИ (пока только для владельца)
   Входящие (без даты), Сегодня (сегодня и просроченные), Предстоящее (дни колонками,
   задачи перетаскиваются между днями, просроченные можно перенести на сегодня).
   Данные: tasks.list = [{ id, title, date: 'YYYY-MM-DD' | null, done, doneAt, createdAt,
                           desc, prio: 1..4, subs: [{ id, title, done }] }]
   ============================================================ */
window.Tasks = (function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toArr = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
  const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const MONN = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const DOW = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const PRIO = { 1: '#E5484D', 2: '#F59E0B', 3: '#4A7CFF', 4: '' };
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const parse = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  function isOwner() {
    const u = window.FirebaseSync && FirebaseSync.currentUser ? FirebaseSync.currentUser() : null;
    const owner = (window.AUTH_CONFIG && AUTH_CONFIG.ownerEmail || '').toLowerCase();
    return !!(u && u.email && owner && u.email.toLowerCase() === owner);
  }
  function norm(t) { return Object.assign({}, t, { subs: toArr(t.subs).filter(s => s && s.title), prio: [1, 2, 3, 4].includes(+t.prio) ? +t.prio : 4 }); }
  function list() { return toArr((Store.get().tasks || {}).list).filter(t => t && t.id && t.title).map(norm); }
  function save(arr) { Store.set('tasks.list', arr.map(t => JSON.parse(JSON.stringify(t)))); }
  function add(title, date) { title = String(title || '').trim().slice(0, 200); if (!title) return; const a = list(); a.push({ id: uid(), title, date: date || null, done: false, createdAt: Date.now(), prio: 4 }); save(a); }
  function patch(id, p) { save(list().map(t => t.id === id ? Object.assign({}, t, p) : t)); }
  function remove(id) { save(list().filter(t => t.id !== id)); }
  const byPrio = (x, y) => (x.done - y.done) || (x.prio - y.prio) || (x.createdAt - y.createdAt);

  /* сколько на сегодня: для плитки на главной */
  function todayCount() { const t = iso(today()); return list().filter(x => !x.done && x.date && x.date <= t).length; }

  function dayLabel(ds) {
    const d = parse(ds); if (!d) return ''; const t = today(), diff = Math.round((d - t) / 864e5);
    if (diff === 0) return 'Сегодня'; if (diff === 1) return 'Завтра'; if (diff === -1) return 'Вчера';
    return d.getDate() + ' ' + MON[d.getMonth()];
  }

  let view = 'today', weekFrom = null;

  function row(t, opts) {
    const td = iso(today()), late = !t.done && t.date && t.date < td;
    const showDate = t.date && (!opts || !opts.noDate || late);
    const subs = t.subs.length ? `<em class="tk-subs"><i class="ti ti-subtask"></i>${t.subs.filter(s => s.done).length}/${t.subs.length}</em>` : '';
    const meta = subs + (showDate ? `<em class="${late ? 'late' : ''}"><i class="ti ti-calendar"></i>${dayLabel(t.date)}</em>` : '') + (t.desc ? '<em class="tk-hasdesc"><i class="ti ti-align-left"></i></em>' : '');
    return `<div class="tk-row${t.done ? ' done' : ''}" data-id="${esc(t.id)}" style="--pc:${PRIO[t.prio] || '#6E727E'}">
      <button class="tk-ck${t.prio < 4 ? ' p' : ''}" data-ck="${esc(t.id)}" aria-label="${t.done ? 'Вернуть' : 'Готово'}"><i class="ti ti-check"></i></button>
      <button class="tk-tt" data-ed="${esc(t.id)}"><span>${esc(t.title)}</span>${meta ? `<span class="tk-meta">${meta}</span>` : ''}</button>
    </div>`;
  }
  function addBox(date) {
    return `<form class="tk-add" data-date="${date || ''}"><i class="ti ti-plus"></i><input type="text" maxlength="200" placeholder="Добавить задачу" enterkeyhint="done"></form>`;
  }
  function doneTail(arr) { return arr.length ? `<div class="tk-sec">Выполнено · ${arr.length}</div>${arr.map(t => row(t)).join('')}` : ''; }

  function body() {
    const all = list(), td = iso(today());
    if (view === 'inbox') {
      const a = all.filter(t => !t.date && !t.done).sort(byPrio);
      return `<div class="tk-col one">${addBox(null)}${a.map(t => row(t)).join('') || '<div class="tk-empty">Здесь пусто</div>'}${doneTail(all.filter(t => !t.date && t.done))}</div>`;
    }
    if (view === 'today') {
      const late = all.filter(t => !t.done && t.date && t.date < td).sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : byPrio(x, y));
      const now = all.filter(t => !t.done && t.date === td).sort(byPrio);
      return `<div class="tk-col one">
        ${late.length ? `<div class="tk-sec late"><span>Просрочено · ${late.length}</span><button class="tk-move" data-move>Перенести на сегодня</button></div>${late.map(t => row(t)).join('')}<div class="tk-sec">Сегодня</div>` : ''}
        ${addBox(td)}${now.map(t => row(t, { noDate: true })).join('') || (late.length ? '' : '<div class="tk-empty">На сегодня задач нет</div>')}
        ${doneTail(all.filter(t => t.done && t.date === td))}</div>`;
    }
    /* Предстоящее: просроченные + 7 дней колонками */
    const from = weekFrom || today();
    const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
    const late = weekFrom ? [] : all.filter(t => !t.done && t.date && t.date < td).sort((x, y) => x.date < y.date ? -1 : 1);
    return `<div class="tk-wk-nav"><b>${MONN[days[0].getMonth()]} ${days[0].getFullYear()}</b>
        <div><button data-wk="-1" aria-label="Раньше"><i class="ti ti-chevron-left"></i></button><button data-wk="0">Сегодня</button><button data-wk="1" aria-label="Позже"><i class="ti ti-chevron-right"></i></button></div></div>
      <div class="tk-week">
        ${late.length ? `<div class="tk-day late"><div class="tk-day-h"><span>Просрочено <i>${late.length}</i></span><button class="tk-move" data-move>Перенести</button></div>${late.map(t => row(t)).join('')}</div>` : ''}
        ${days.map(d => { const ds = iso(d), items = all.filter(t => t.date === ds).sort(byPrio);
        const lbl = dayLabel(ds); return `<div class="tk-day${ds === td ? ' now' : ''}" data-day="${ds}"><div class="tk-day-h"><span>${d.getDate()} ${MON[d.getMonth()]} · ${/^(Сегодня|Завтра|Вчера)$/.test(lbl) ? lbl : DOW[d.getDay()]} <i>${items.filter(t => !t.done).length}</i></span></div>
          ${items.map(t => row(t, { noDate: true })).join('')}${addBox(ds)}</div>`; }).join('')}</div>`;
  }

  /* ── Карточка задачи: описание, подзадачи, срок, приоритет ── */
  function editModal(id, redraw) {
    const t0 = list().find(x => x.id === id); if (!t0) return;
    const t = JSON.parse(JSON.stringify(t0));
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay tk-ov';
    const subsHtml = () => t.subs.map((s, i) => `<div class="tk-sub${s.done ? ' done' : ''}"><button class="tk-ck" data-sck="${i}"><i class="ti ti-check"></i></button><input value="${esc(s.title)}" data-st="${i}" maxlength="200"><button class="tk-sub-x" data-sx="${i}" aria-label="Удалить подзадачу"><i class="ti ti-x"></i></button></div>`).join('');
    const DATES = [['', 'Без даты', 'ti-calendar-off'], [iso(today()), 'Сегодня', 'ti-calendar-event'], [iso(addDays(today(), 1)), 'Завтра', 'ti-sun'], [iso(addDays(today(), 7)), 'Через неделю', 'ti-calendar-week']];
    ov.innerHTML = `<div class="tk-card">
      <div class="tk-card-top"><span><i class="ti ti-${t.date ? 'calendar' : 'inbox'}"></i>${t.date ? dayLabel(t.date) : 'Входящие'}</span><button class="tk-x" data-close aria-label="Закрыть"><i class="ti ti-x"></i></button></div>
      <div class="tk-card-body">
        <div class="tk-card-main">
          <div class="tk-card-title" style="--pc:${PRIO[t.prio] || '#6E727E'}"><button class="tk-ck${t.prio < 4 ? ' p' : ''}${t.done ? ' on' : ''}" id="tk-c-done"><i class="ti ti-check"></i></button><textarea id="tk-c-t" rows="1" maxlength="200">${esc(t.title)}</textarea></div>
          <div class="tk-desc"><i class="ti ti-align-left"></i><textarea id="tk-c-d" rows="2" maxlength="2000" placeholder="Описание">${esc(t.desc || '')}</textarea></div>
          <div class="tk-subs-l" id="tk-subs">${subsHtml()}</div>
          <form class="tk-add tk-sub-add" id="tk-sub-add"><i class="ti ti-plus"></i><input type="text" maxlength="200" placeholder="Добавить подзадачу"></form>
        </div>
        <div class="tk-card-side">
          <div class="tk-side-l">Срок</div>
          <div class="tk-chips" id="tk-c-dates">${DATES.map(([v, l, ic]) => `<button type="button" data-d="${v}" class="${(t.date || '') === v ? 'on' : ''}"><i class="ti ${ic}"></i>${l}</button>`).join('')}</div>
          <input type="date" id="tk-c-date" value="${t.date || ''}">
          <div class="tk-side-l">Приоритет</div>
          <div class="tk-chips tk-prio" id="tk-c-prio">${[1, 2, 3, 4].map(p => `<button type="button" data-p="${p}" class="${t.prio === p ? 'on' : ''}" style="--pc:${PRIO[p] || '#8A8F9C'}"><i class="ti ti-flag"></i>P${p}</button>`).join('')}</div>
        </div>
      </div>
      <div class="tk-card-act"><button class="tk-del" id="tk-c-del"><i class="ti ti-trash"></i> Удалить</button><button class="tk-ok" id="tk-c-ok">Сохранить</button></div>
    </div>`;
    document.body.appendChild(ov);
    const $ = (s) => ov.querySelector(s);
    const grow = (ta) => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    ['#tk-c-t', '#tk-c-d'].forEach(s => { const ta = $(s); grow(ta); ta.addEventListener('input', () => grow(ta)); });
    $('#tk-c-t').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#tk-c-d').focus(); } });
    const readSubs = () => ov.querySelectorAll('[data-st]').forEach(inp => { const s = t.subs[+inp.dataset.st]; if (s) s.title = inp.value.trim() || s.title; });
    const bindSubs = () => {
      ov.querySelectorAll('[data-sck]').forEach(b => b.onclick = () => { readSubs(); const s = t.subs[+b.dataset.sck]; s.done = !s.done; $('#tk-subs').innerHTML = subsHtml(); bindSubs(); });
      ov.querySelectorAll('[data-sx]').forEach(b => b.onclick = () => { readSubs(); t.subs.splice(+b.dataset.sx, 1); $('#tk-subs').innerHTML = subsHtml(); bindSubs(); });
    };
    bindSubs();
    $('#tk-sub-add').addEventListener('submit', e => { e.preventDefault(); const inp = $('#tk-sub-add input'); const v = inp.value.trim(); if (!v) return; readSubs(); t.subs.push({ id: uid(), title: v.slice(0, 200), done: false }); inp.value = ''; $('#tk-subs').innerHTML = subsHtml(); bindSubs(); inp.focus(); });
    const di = $('#tk-c-date');
    ov.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { di.value = b.dataset.d; ov.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('on', x === b)); });
    di.onchange = () => ov.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('on', x.dataset.d === di.value));
    ov.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { t.prio = +b.dataset.p; ov.querySelectorAll('[data-p]').forEach(x => x.classList.toggle('on', x === b));
      const tt = $('.tk-card-title'); tt.style.setProperty('--pc', PRIO[t.prio] || '#6E727E'); $('#tk-c-done').classList.toggle('p', t.prio < 4); });
    $('#tk-c-done').onclick = () => { t.done = !t.done; $('#tk-c-done').classList.toggle('on', t.done); };
    const close = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    $('[data-close]').onclick = close;
    $('#tk-c-del').onclick = () => { if (confirm('Удалить задачу?')) { remove(t.id); close(); redraw(); } };
    $('#tk-c-ok').onclick = () => {
      const title = $('#tk-c-t').value.trim(); if (!title) { $('#tk-c-t').focus(); return; }
      readSubs(); const pend = $('#tk-sub-add input').value.trim(); if (pend) t.subs.push({ id: uid(), title: pend.slice(0, 200), done: false });
      patch(t.id, { title: title.slice(0, 200), desc: $('#tk-c-d').value.trim().slice(0, 2000) || null, date: di.value || null, prio: t.prio, subs: t.subs.length ? t.subs : null,
        done: !!t.done, doneAt: t.done ? (t0.doneAt || Date.now()) : null });
      close(); redraw();
    };
    if (!t0.title) $('#tk-c-t').focus();
  }

  /* ── Перетаскивание задач между днями (мышь сразу, палец после долгого нажатия) ── */
  function bindDrag(box, redraw) {
    let st = null;
    const clear = () => { if (!st) return; clearTimeout(st.timer); if (st.ghost) st.ghost.remove(); if (st.row) st.row.classList.remove('tk-dragging');
      box.querySelectorAll('.tk-drop').forEach(x => x.classList.remove('tk-drop')); document.removeEventListener('touchmove', block, { passive: false }); st = null; };
    const block = (e) => { if (st && st.on) e.preventDefault(); };
    const start = () => {
      st.on = true; const r = st.row.getBoundingClientRect();
      const g = st.row.cloneNode(true); g.className += ' tk-ghost'; g.style.width = r.width + 'px'; document.body.appendChild(g);
      st.ghost = g; st.dx = st.x - r.left; st.dy = st.y - r.top; st.row.classList.add('tk-dragging'); move(st.x, st.y);
      if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) {}
    };
    const move = (x, y) => {
      st.ghost.style.transform = `translate(${x - st.dx}px,${y - st.dy}px) rotate(2deg)`;
      const el = document.elementFromPoint(x, y); const day = el && el.closest('.tk-day[data-day]');
      box.querySelectorAll('.tk-drop').forEach(d => { if (d !== day) d.classList.remove('tk-drop'); }); if (day) day.classList.add('tk-drop'); st.over = day;
      const sc = box.querySelector('.tk-week'); if (sc && sc.scrollWidth > sc.clientWidth) { const r = sc.getBoundingClientRect(); if (x > r.right - 40) sc.scrollLeft += 12; else if (x < r.left + 40) sc.scrollLeft -= 12; }
    };
    box.addEventListener('pointerdown', e => {
      const row = e.target.closest('.tk-day .tk-row'); if (!row || e.target.closest('.tk-ck') || e.button > 0) return;
      st = { row, id: row.dataset.id, x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse', on: false };
      if (st.touch) { document.addEventListener('touchmove', block, { passive: false }); st.timer = setTimeout(() => { if (st) start(); }, 320); }
    });
    window.addEventListener('pointermove', e => {
      if (!st) return;
      if (!st.on) { const d = Math.hypot(e.clientX - st.x, e.clientY - st.y); if (st.touch) { if (d > 8) clear(); return; } if (d > 6) { st.x = e.clientX; st.y = e.clientY; start(); } return; }
      e.preventDefault(); move(e.clientX, e.clientY);
    });
    const end = () => {
      if (!st) return; const was = st.on, id = st.id, to = st.over && st.over.dataset.day; clear();
      if (!was) return;
      box.dataset.justDragged = '1'; setTimeout(() => { delete box.dataset.justDragged; }, 50);
      const t = list().find(x => x.id === id); if (t && to && t.date !== to) { patch(id, { date: to }); redraw(); }
    };
    window.addEventListener('pointerup', end); window.addEventListener('pointercancel', clear);
  }

  function themeIco() { return window.Theme && Theme.get() === 'light' ? 'ti-moon' : 'ti-sun'; }

  function screen(mount) {
    if (!isOwner()) { Router.go('/home'); return; }
    mount.innerHTML = `<div class="tk-screen">
      <div class="tk-header"><button class="tk-back" id="tk-back" aria-label="Назад"><i class="ti ti-arrow-left"></i></button><p>Задачи</p>
        <button class="tk-back tk-theme" id="tk-theme" aria-label="Светлая или тёмная тема"><i class="ti ${themeIco()}"></i></button></div>
      <div class="tk-tabs" id="tk-tabs">${[['inbox', 'Входящие', 'ti-inbox'], ['today', 'Сегодня', 'ti-calendar-event'], ['week', 'Предстоящее', 'ti-calendar-week']].map(([k, l, ic]) => `<button data-v="${k}"><i class="ti ${ic}"></i>${l}<span class="tk-n" data-n="${k}"></span></button>`).join('')}</div>
      <div class="tk-body" id="tk-body"></div></div>`;
    mount.querySelector('#tk-back').onclick = () => Router.go('/home');
    mount.querySelector('#tk-theme').onclick = () => { if (!window.Theme) return; Theme.set(Theme.get() === 'light' ? 'dark' : 'light'); mount.querySelector('#tk-theme i').className = 'ti ' + themeIco(); };
    const b = mount.querySelector('#tk-body');
    const draw = (focusDate) => {
      const all = list(), td = iso(today());
      const n = { inbox: all.filter(t => !t.date && !t.done).length, today: all.filter(t => !t.done && t.date && t.date <= td).length, week: 0 };
      mount.querySelectorAll('#tk-tabs button').forEach(x => x.classList.toggle('on', x.dataset.v === view));
      mount.querySelectorAll('[data-n]').forEach(x => { const v = n[x.dataset.n]; x.textContent = v || ''; });
      const sx = b.querySelector('.tk-week') ? b.querySelector('.tk-week').scrollLeft : 0;
      b.innerHTML = body();
      const wk = b.querySelector('.tk-week'); if (wk) wk.scrollLeft = sx;
      b.querySelectorAll('.tk-add').forEach(f => f.addEventListener('submit', e => { e.preventDefault(); const inp = f.querySelector('input'); if (!inp.value.trim()) return; add(inp.value, f.dataset.date || null); draw(f.dataset.date || 'none'); }));
      if (focusDate) { const f = b.querySelector(`.tk-add[data-date="${focusDate === 'none' ? '' : focusDate}"] input`); if (f) f.focus(); }
      b.querySelectorAll('[data-ck]').forEach(x => x.onclick = () => { const t = list().find(y => y.id === x.dataset.ck); if (!t) return; const row = x.closest('.tk-row'); row.classList.add('pop'); setTimeout(() => { patch(t.id, { done: !t.done, doneAt: !t.done ? Date.now() : null }); draw(); }, t.done ? 0 : 260); });
      b.querySelectorAll('[data-ed]').forEach(x => x.onclick = () => { if (b.dataset.justDragged) return; editModal(x.dataset.ed, draw); });
      b.querySelectorAll('[data-wk]').forEach(x => x.onclick = () => { const k = +x.dataset.wk; weekFrom = k === 0 ? null : addDays(weekFrom || today(), k * 7); draw(); });
      b.querySelectorAll('[data-move]').forEach(x => x.onclick = () => { const t = iso(today()); save(list().map(y => !y.done && y.date && y.date < t ? Object.assign({}, y, { date: t }) : y)); draw(); });
    };
    mount.querySelectorAll('#tk-tabs button').forEach(x => x.onclick = () => { view = x.dataset.v; draw(); });
    bindDrag(b, draw);
    draw();
  }

  return { screen, isOwner, todayCount, list };
})();
window.Screens = window.Screens || {};
window.Screens.tasks = function (mount) { Tasks.screen(mount); };
