/* ============================================================
   HABITS SCREEN — полная реализация с Firebase
   Структура: Store → habits.months.{YYYY-MM}.{habitId}.{day} = 'done'|'missed'|''
   ============================================================ */

window.Screens = window.Screens || {};

/* ── Вспомогательные функции ──────────────────────── */
function habGetMonthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function habTodayInfo() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

function habDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function habMonthLabel(year, month) {
  const names = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  return `${names[month]} ${year}`;
}

function habGetHabits() {
  return Store.get().habits?.list || [];
}

function habGetMarks(monthKey) {
  return Store.get().habits?.months?.[monthKey] || {};
}

function habSetMark(monthKey, habitId, day, value) {
  Store.set(`habits.months.${monthKey}.${habitId}.${day}`, value);
}

function habSaveHabits(list) {
  list.forEach((h, i) => Store.set(`habits.list.${i}`, h));
}

function habPct(marks, habitId, target, daysInMonth, currentDay) {
  const hMarks = marks[habitId] || {};
  const totalWeeks = Math.ceil(daysInMonth / 7);
  const done = Object.values(hMarks).filter(v => v === 'done').length;
  const goal = target * totalWeeks;
  return goal > 0 ? Math.min(100, Math.round((done / goal) * 100)) : 0;
}

function habMarkSymbol(m) {
  if (m === 'done') return '<i class="ti ti-check"></i>';
  if (m === 'missed') return '<i class="ti ti-x"></i>';
  return '';
}

function habNextMark(current) {
  if (!current || current === '') return 'done';
  if (current === 'done') return 'missed';
  return '';
}

/* ── Модалка добавления/редактирования привычки ───── */
function habOpenModal(existing, onSave) {
  const isEdit = !!existing;
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';

  const ICONS = [
    'ti-star','ti-bolt','ti-apple','ti-barbell','ti-device-mobile',
    'ti-book','ti-run','ti-heart','ti-moon','ti-sun','ti-drop',
    'ti-pencil','ti-music','ti-brain','ti-leaf','ti-flame'
  ];

  overlay.innerHTML = `
    <div class="tr-modal">
      <p class="tr-modal-title">${isEdit ? 'Редактировать привычку' : 'Новая привычка'}</p>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Название
          <input type="text" id="hab-name" value="${existing?.name || ''}" placeholder="Например: Медитация">
        </label>
      </div>
      <div class="tr-modal-row">
        <label>Цель в неделю
          <input type="number" id="hab-target" value="${existing?.target || 5}" min="1" max="7" inputmode="numeric">
        </label>
      </div>
      <div style="margin-bottom:12px;">
        <div style="font-size:12px; color:#9D9A92; margin-bottom:8px;">Иконка</div>
        <div style="display:flex; flex-wrap:wrap; gap:8px;">
          ${ICONS.map(ic => `
            <button class="hab-icon-btn ${(existing?.icon || 'ti-star') === ic ? 'selected' : ''}" data-icon="${ic}" style="width:36px; height:36px; border-radius:8px; border:0.5px solid #2A2D35; background:${(existing?.icon || 'ti-star') === ic ? '#2E7FD4' : '#1C1E24'}; color:#E8E5DC; cursor:pointer; font-size:16px;">
              <i class="ti ${ic}"></i>
            </button>`).join('')}
        </div>
      </div>
      <div class="tr-modal-actions">
        ${isEdit ? '<button class="tr-modal-btn-secondary" id="hab-delete" style="color:#FF5C5C;">Удалить</button>' : '<button class="tr-modal-btn-secondary" id="hab-cancel">Отмена</button>'}
        <button class="tr-modal-btn-primary" id="hab-save">Сохранить</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  let selectedIcon = existing?.icon || 'ti-star';
  overlay.querySelectorAll('.hab-icon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedIcon = btn.dataset.icon;
      overlay.querySelectorAll('.hab-icon-btn').forEach(b => {
        b.style.background = b.dataset.icon === selectedIcon ? '#2E7FD4' : '#1C1E24';
        b.classList.toggle('selected', b.dataset.icon === selectedIcon);
      });
    });
  });

  const cancelBtn = overlay.querySelector('#hab-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', () => overlay.remove());

  const deleteBtn = overlay.querySelector('#hab-delete');
  if (deleteBtn) deleteBtn.addEventListener('click', () => {
    if (!confirm(`Удалить привычку "${existing.name}"?`)) return;
    onSave(null); // null = удалить
    overlay.remove();
  });

  overlay.querySelector('#hab-save').addEventListener('click', () => {
    const name = overlay.querySelector('#hab-name').value.trim();
    const target = parseInt(overlay.querySelector('#hab-target').value) || 5;
    if (!name) return;
    onSave({ id: existing?.id || 'h_' + Date.now(), name, icon: selectedIcon, target });
    overlay.remove();
  });
}

/* ── Главный экран ────────────────────────────────── */
window.Screens.habits = function (mount) {
  const today = habTodayInfo();
  let viewYear = today.year;
  let viewMonth = today.month;

  mount.innerHTML = `
    <div class="theme-dark">
      <div class="sec-header">
        <div style="display:flex; align-items:center; gap:10px;">
          <button class="sec-back" id="sec-back"><i class="ti ti-arrow-left"></i></button>
          <p class="sec-title">Привычки</p>
        </div>
        <button class="sec-back" id="sec-logout"><i class="ti ti-logout"></i></button>
      </div>
      <div class="sec-body" id="habits-content"></div>
    </div>`;

  document.getElementById('sec-back').addEventListener('click', () => Router.go('/home'));
  document.getElementById('sec-logout').addEventListener('click', () => { Auth.logout(); Router.go('/login'); });

  const content = document.getElementById('habits-content');

  function render() {
    const habits = habGetHabits();
    const monthKey = habGetMonthKey(viewYear, viewMonth);
    const marks = habGetMarks(monthKey);
    const daysInMonth = habDaysInMonth(viewYear, viewMonth);
    const isCurrentMonth = viewYear === today.year && viewMonth === today.month;
    const lastDay = isCurrentMonth ? today.day : daysInMonth;

    /* Итоги */
    const pcts = habits.map(h => habPct(marks, h.id, h.target, daysInMonth, lastDay));
    const overallPct = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
    const bestIdx = pcts.indexOf(Math.max(...pcts));
    const worstIdx = pcts.indexOf(Math.min(...pcts));

    /* Дни для заголовка */
    const dayHeaders = Array.from({length: daysInMonth}, (_, i) => i + 1);

    content.innerHTML = `
      <div class="sec-card">
        <div class="sec-card-title">Итог месяца</div>
        <div class="sec-metric-grid">
          <div class="sec-metric">
            <div class="sec-metric-label">Общий прогресс</div>
            <div class="sec-metric-value accent">${overallPct}%</div>
          </div>
          <div class="sec-metric">
            <div class="sec-metric-label">Лучшая</div>
            <div class="sec-metric-value">${habits[bestIdx]?.name || '—'}</div>
          </div>
          <div class="sec-metric">
            <div class="sec-metric-label">Требует внимания</div>
            <div class="sec-metric-value">${habits[worstIdx]?.name || '—'}</div>
          </div>
        </div>
      </div>

      <div class="sec-card">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
          <div class="sec-card-title" style="margin:0;">Сетка дисциплины</div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button id="hab-prev" class="sec-back" style="width:28px; height:28px;"><i class="ti ti-chevron-left"></i></button>
            <span style="font-size:13px; color:#E8E5DC; white-space:nowrap;">${habMonthLabel(viewYear, viewMonth)}</span>
            <button id="hab-next" class="sec-back" style="width:28px; height:28px;" ${isCurrentMonth ? 'disabled style="opacity:0.3;"' : ''}><i class="ti ti-chevron-right"></i></button>
          </div>
        </div>
        <div style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
          <table class="habit-table">
            <thead>
              <tr>
                <th style="min-width:120px;"></th>
                ${dayHeaders.map(d => `<th style="font-size:10px; color:${isCurrentMonth && d === today.day ? '#2E7FD4' : 'var(--bone-faint)'}; font-weight:${isCurrentMonth && d === today.day ? '700' : '500'}; min-width:24px;">${d}</th>`).join('')}
                <th style="font-size:10px; color:var(--bone-faint); min-width:40px;">%</th>
              </tr>
            </thead>
            <tbody>
              ${habits.map((h, hi) => {
                const hMarks = marks[h.id] || {};
                const pct = pcts[hi];
                const cells = dayHeaders.map(d => {
                  const m = hMarks[d] || '';
                  const isToday = isCurrentMonth && d === today.day;
                  return `<td class="habit-cell">
                    <span class="habit-mark ${m} ${isToday ? 'habit-today' : ''}" data-hid="${h.id}" data-day="${d}">${habMarkSymbol(m)}</span>
                  </td>`;
                }).join('');
                return `
                  <tr>
                    <td class="habit-row-label">
                      <i class="ti ${h.icon}" style="font-size:13px; color:var(--brass); margin-right:6px;"></i>
                      <span class="hab-edit-btn" data-idx="${hi}" style="cursor:pointer;">${h.name}</span>
                    </td>
                    ${cells}
                    <td style="font-size:11px; color:var(--brass); font-weight:600; padding-left:6px;">${pct}%</td>
                  </tr>
                  <tr>
                    <td colspan="${daysInMonth + 2}" style="padding-bottom:8px;">
                      <div class="habit-progress-row">
                        <span style="font-size:11px; color:var(--bone-faint);">цель ${h.target}/нед</span>
                        <div class="habit-progress-track"><div class="habit-progress-fill" style="width:${pct}%"></div></div>
                      </div>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <button id="hab-add" style="width:100%; margin-top:12px; padding:10px; border-radius:8px; border:0.5px dashed #2A2D35; background:none; color:#9D9A92; cursor:pointer; font-size:13px;">
          <i class="ti ti-plus"></i> Добавить привычку
        </button>
      </div>`;

    /* Клики по ячейкам сетки */
    content.querySelectorAll('.habit-mark').forEach(el => {
      el.addEventListener('click', () => {
        const hid = el.dataset.hid;
        const day = parseInt(el.dataset.day);
        const current = marks[hid]?.[day] || '';
        const next = habNextMark(current);
        habSetMark(monthKey, hid, day, next);
        /* Обновляем локально без полного перерендера */
        el.className = `habit-mark ${next} ${el.classList.contains('habit-today') ? 'habit-today' : ''}`;
        el.innerHTML = habMarkSymbol(next);
        /* Обновляем % */
        render();
      });
    });

    /* Редактирование привычки */
    content.querySelectorAll('.hab-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        habOpenModal(habits[idx], (result) => {
          const list = habGetHabits();
          if (result === null) list.splice(idx, 1);
          else list[idx] = result;
          habSaveHabits(list);
          render();
        });
      });
    });

    /* Добавить привычку */
    document.getElementById('hab-add').addEventListener('click', () => {
      habOpenModal(null, (result) => {
        if (!result) return;
        const list = habGetHabits();
        list.push(result);
        habSaveHabits(list);
        render();
      });
    });

    /* Навигация по месяцам */
    document.getElementById('hab-prev').addEventListener('click', () => {
      viewMonth--;
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      render();
    });
    const nextBtn = document.getElementById('hab-next');
    if (nextBtn && !nextBtn.disabled) {
      nextBtn.addEventListener('click', () => {
        viewMonth++;
        if (viewMonth > 11) { viewMonth = 0; viewYear++; }
        render();
      });
    }
  }

  render();
};
