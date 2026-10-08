/* ============================================================
   ЗАДАЧИ (пока только для владельца)
   Входящие (без даты), Сегодня (сегодня и просроченные), Предстоящее (дни колонками).
   Данные: tasks.list = [{ id, title, date: 'YYYY-MM-DD' | null, done, doneAt, createdAt }]
   ============================================================ */
window.Tasks = (function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toArr = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
  const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const DOW = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const parse = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };

  function isOwner() {
    const u = window.FirebaseSync && FirebaseSync.currentUser ? FirebaseSync.currentUser() : null;
    const owner = (window.AUTH_CONFIG && AUTH_CONFIG.ownerEmail || '').toLowerCase();
    return !!(u && u.email && owner && u.email.toLowerCase() === owner);
  }
  function list() { return toArr((Store.get().tasks || {}).list).filter(t => t && t.id && t.title); }
  function save(arr) { Store.set('tasks.list', arr.map(t => Object.assign({}, t))); }
  function add(title, date) { title = String(title || '').trim().slice(0, 200); if (!title) return; const a = list(); a.push({ id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title, date: date || null, done: false, createdAt: Date.now() }); save(a); }
  function patch(id, p) { save(list().map(t => t.id === id ? Object.assign({}, t, p) : t)); }
  function remove(id) { save(list().filter(t => t.id !== id)); }

  /* сколько на сегодня: для плитки на главной */
  function todayCount() { const t = iso(today()); return list().filter(x => !x.done && x.date && x.date <= t).length; }

  function dayLabel(ds) {
    const d = parse(ds); if (!d) return ''; const t = today(), diff = Math.round((d - t) / 864e5);
    if (diff === 0) return 'Сегодня'; if (diff === 1) return 'Завтра'; if (diff === -1) return 'Вчера';
    return d.getDate() + ' ' + MON[d.getMonth()];
  }

  let view = 'today', weekFrom = null;

  function row(t) {
    const td = iso(today()), late = !t.done && t.date && t.date < td;
    return `<div class="tk-row${t.done ? ' done' : ''}" data-id="${esc(t.id)}">
      <button class="tk-ck" data-ck="${esc(t.id)}" aria-label="${t.done ? 'Вернуть' : 'Готово'}"><i class="ti ti-check"></i></button>
      <button class="tk-tt" data-ed="${esc(t.id)}"><span>${esc(t.title)}</span>${t.date && view !== 'week' ? `<em class="${late ? 'late' : ''}"><i class="ti ti-calendar"></i>${dayLabel(t.date)}</em>` : ''}</button>
    </div>`;
  }
  function addBox(date, ph) {
    return `<form class="tk-add" data-date="${date || ''}"><i class="ti ti-plus"></i><input type="text" maxlength="200" placeholder="${ph || 'Добавить задачу'}" enterkeyhint="done"></form>`;
  }

  function body() {
    const all = list(), td = iso(today());
    if (view === 'inbox') {
      const a = all.filter(t => !t.date && !t.done).sort((x, y) => x.createdAt - y.createdAt);
      return `<div class="tk-col one">${addBox(null)}${a.map(row).join('') || '<div class="tk-empty">Здесь пусто</div>'}${doneTail(all.filter(t => !t.date && t.done))}</div>`;
    }
    if (view === 'today') {
      const late = all.filter(t => !t.done && t.date && t.date < td).sort((x, y) => x.date < y.date ? -1 : 1);
      const now = all.filter(t => !t.done && t.date === td);
      return `<div class="tk-col one">
        ${late.length ? `<div class="tk-sec late">Просрочено · ${late.length}</div>${late.map(row).join('')}<div class="tk-sec">Сегодня</div>` : ''}
        ${addBox(td)}${now.map(row).join('') || (late.length ? '' : '<div class="tk-empty">На сегодня задач нет</div>')}
        ${doneTail(all.filter(t => t.done && t.date === td))}</div>`;
    }
    /* Предстоящее: 7 дней колонками */
    const from = weekFrom || today();
    const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
    const m = days[0];
    return `<div class="tk-wk-nav"><b>${['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'][m.getMonth()]} ${m.getFullYear()}</b>
        <div><button data-wk="-1" aria-label="Раньше"><i class="ti ti-chevron-left"></i></button><button data-wk="0">Сегодня</button><button data-wk="1" aria-label="Позже"><i class="ti ti-chevron-right"></i></button></div></div>
      <div class="tk-week">${days.map(d => { const ds = iso(d), items = all.filter(t => t.date === ds).sort((x, y) => (x.done - y.done) || (x.createdAt - y.createdAt));
        const lbl = dayLabel(ds); return `<div class="tk-day${ds === td ? ' now' : ''}"><div class="tk-day-h">${d.getDate()} ${MON[d.getMonth()]} · ${/^(Сегодня|Завтра|Вчера)$/.test(lbl) ? lbl : DOW[d.getDay()]} <span>${items.filter(t => !t.done).length}</span></div>
          ${items.map(row).join('')}${addBox(ds)}</div>`; }).join('')}</div>`;
  }
  function doneTail(arr) { return arr.length ? `<div class="tk-sec">Выполнено · ${arr.length}</div>${arr.map(row).join('')}` : ''; }

  function editModal(t, redraw) {
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay';
    ov.innerHTML = `<div class="tr-modal tk-modal"><p class="tr-modal-title">Задача</p>
      <textarea id="tk-e-t" rows="2" maxlength="200">${esc(t.title)}</textarea>
      <div class="tk-e-dates">${[['', 'Без даты'], [iso(today()), 'Сегодня'], [iso(addDays(today(), 1)), 'Завтра'], [iso(addDays(today(), 7)), 'Через неделю']].map(([v, l]) => `<button type="button" data-d="${v}" class="${(t.date || '') === v ? 'on' : ''}">${l}</button>`).join('')}
        <input type="date" id="tk-e-d" value="${t.date || ''}"></div>
      <div class="tr-modal-actions"><button class="tr-modal-btn-secondary" id="tk-e-del">Удалить</button><button class="tr-modal-btn-primary" id="tk-e-ok">Сохранить</button></div></div>`;
    document.body.appendChild(ov);
    const di = ov.querySelector('#tk-e-d');
    ov.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { di.value = b.dataset.d; ov.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('on', x === b)); });
    di.onchange = () => ov.querySelectorAll('[data-d]').forEach(x => x.classList.toggle('on', x.dataset.d === di.value));
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    ov.querySelector('#tk-e-del').onclick = () => { if (confirm('Удалить задачу?')) { remove(t.id); ov.remove(); redraw(); } };
    ov.querySelector('#tk-e-ok').onclick = () => { const title = ov.querySelector('#tk-e-t').value.trim(); if (!title) return; patch(t.id, { title: title.slice(0, 200), date: di.value || null }); ov.remove(); redraw(); };
  }

  function screen(mount) {
    if (!isOwner()) { Router.go('/home'); return; }
    mount.innerHTML = `<div class="tk-screen">
      <div class="tk-header"><button class="tk-back" id="tk-back" aria-label="Назад"><i class="ti ti-arrow-left"></i></button><p>Задачи</p></div>
      <div class="tk-tabs" id="tk-tabs">${[['inbox', 'Входящие', 'ti-inbox'], ['today', 'Сегодня', 'ti-calendar-event'], ['week', 'Предстоящее', 'ti-calendar-week']].map(([k, l, ic]) => `<button data-v="${k}"><i class="ti ${ic}"></i>${l}<span class="tk-n" data-n="${k}"></span></button>`).join('')}</div>
      <div class="tk-body" id="tk-body"></div></div>`;
    mount.querySelector('#tk-back').onclick = () => Router.go('/home');
    const b = mount.querySelector('#tk-body');
    const draw = (focusDate) => {
      const all = list(), td = iso(today());
      const n = { inbox: all.filter(t => !t.date && !t.done).length, today: all.filter(t => !t.done && t.date && t.date <= td).length, week: 0 };
      mount.querySelectorAll('#tk-tabs button').forEach(x => x.classList.toggle('on', x.dataset.v === view));
      mount.querySelectorAll('[data-n]').forEach(x => { const v = n[x.dataset.n]; x.textContent = v || ''; });
      b.innerHTML = body();
      b.querySelectorAll('.tk-add').forEach(f => f.addEventListener('submit', e => { e.preventDefault(); const inp = f.querySelector('input'); if (!inp.value.trim()) return; add(inp.value, f.dataset.date || null); draw(f.dataset.date || 'none'); }));
      if (focusDate) { const f = b.querySelector(`.tk-add[data-date="${focusDate === 'none' ? '' : focusDate}"] input`); if (f) f.focus(); }
      b.querySelectorAll('[data-ck]').forEach(x => x.onclick = () => { const t = list().find(y => y.id === x.dataset.ck); if (!t) return; const row = x.closest('.tk-row'); row.classList.add('pop'); setTimeout(() => { patch(t.id, { done: !t.done, doneAt: !t.done ? Date.now() : null }); draw(); }, t.done ? 0 : 260); });
      b.querySelectorAll('[data-ed]').forEach(x => x.onclick = () => { const t = list().find(y => y.id === x.dataset.ed); if (t) editModal(t, draw); });
      b.querySelectorAll('[data-wk]').forEach(x => x.onclick = () => { const k = +x.dataset.wk; weekFrom = k === 0 ? null : addDays(weekFrom || today(), k * 7); draw(); });
    };
    mount.querySelectorAll('#tk-tabs button').forEach(x => x.onclick = () => { view = x.dataset.v; draw(); });
    draw();
  }

  return { screen, isOwner, todayCount, list };
})();
window.Screens = window.Screens || {};
window.Screens.tasks = function (mount) { Tasks.screen(mount); };
