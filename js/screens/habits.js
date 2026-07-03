/* ============================================================
   HABITS SCREEN v2 — полная реализация
   Расписание: weekday (пн-пт), 3perweek (3 раза в неделю)
   Структура: Store → habits.list[], habits.months.{YYYY-MM}.{habitId}.{day}
   ============================================================ */

window.Screens = window.Screens || {};

const HAB_WEEKDAYS = [1,2,3,4,5]; // пн=1 ... вс=0
const HAB_DOW = ['вс','пн','вт','ср','чт','пт','сб'];
const HAB_MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                        'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

function habDow(year, month, day) {
  return new Date(year, month, day).getDay(); // 0=вс
}

function habIsWorkday(year, month, day) {
  const d = habDow(year, month, day);
  return d >= 1 && d <= 5;
}

function habDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function habMonthKey(year, month) {
  return `${year}-${String(month+1).padStart(2,'0')}`;
}

function habGetList() {
  return (Store.get().habits?.list || []).filter(Boolean);
}

function habGetMarks(monthKey) {
  return Store.get().habits?.months?.[monthKey] || {};
}

function habSetMark(monthKey, hid, day, value) {
  Store.set(`habits.months.${monthKey}.${hid}.${day}`, value);
}

function habSaveList(list) {
  // Записываем каждый элемент отдельно
  list.forEach((h,i) => Store.set(`habits.list.${i}`, h));
  const prev = Store.get().habits?.list || [];
  for (let i = list.length; i < prev.length; i++) Store.set(`habits.list.${i}`, null);
}

/* Считаем прогресс с учётом расписания */
function habProgress(h, marks, year, month) {
  const hMarks = marks[h.id] || {};
  const days = habDaysInMonth(year, month);
  const today = new Date();
  const isCurrentMonth = today.getFullYear()===year && today.getMonth()===month;
  const lastDay = isCurrentMonth ? today.getDate() : days;

  let done=0, total=0;

  if (h.schedule === 'weekday') {
    for (let d=1; d<=lastDay; d++) {
      if (!habIsWorkday(year, month, d)) continue;
      total++;
      if (hMarks[d]==='done') done++;
    }
  } else if (h.schedule === '3perweek') {
    // Считаем недели
    const weeks = Math.ceil(lastDay / 7);
    total = weeks * (h.target||3);
    done = Object.values(hMarks).filter(v=>v==='done').length;
  } else {
    for (let d=1; d<=lastDay; d++) {
      total++;
      if (hMarks[d]==='done') done++;
    }
  }

  const pct = total>0 ? Math.round(done/total*100) : 0;
  return { done, total, pct };
}

/* Является ли день активным для этой привычки */
function habDayActive(h, year, month, day) {
  if (h.schedule==='weekday') return habIsWorkday(year, month, day);
  return true; // для 3perweek все дни кликабельны
}

function habNextMark(current, active) {
  if (!active) return current; // неактивный день — не меняем
  if (!current || current==='') return 'done';
  if (current==='done') return 'missed';
  return '';
}

function habMarkHtml(mark, active) {
  if (!active) return '<span class="hab-cell-dot"></span>';
  if (mark==='done') return '<i class="ti ti-check" style="color:#A8C97F;font-size:13px;"></i>';
  if (mark==='missed') return '<i class="ti ti-x" style="color:#FF5C5C;font-size:11px;"></i>';
  return '';
}

/* Модалка привычки */
function habOpenModal(existing, onSave) {
  const isEdit = !!existing;
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';

  const ICONS = ['ti-star','ti-bolt','ti-apple','ti-barbell','ti-device-mobile',
    'ti-book','ti-run','ti-heart','ti-moon','ti-sun','ti-drop',
    'ti-pencil','ti-music','ti-brain','ti-leaf','ti-flame','ti-target','ti-trophy'];

  overlay.innerHTML = `
    <div class="tr-modal" style="max-height:85vh;overflow-y:auto;">
      <p class="tr-modal-title">${isEdit?'Редактировать':'Новая привычка'}</p>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Название
          <input type="text" id="h-name" value="${existing?.name||''}" placeholder="Медитация, чтение…">
        </label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Описание / критерий
          <input type="text" id="h-desc" value="${existing?.description||''}" placeholder="Что считается выполненным?">
        </label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Расписание
          <select id="h-sched" class="tr-color-select">
            <option value="weekday" ${(existing?.schedule||'weekday')==='weekday'?'selected':''}>Пн – Пт (каждый рабочий день)</option>
            <option value="3perweek" ${existing?.schedule==='3perweek'?'selected':''}>3 раза в неделю</option>
            <option value="daily" ${existing?.schedule==='daily'?'selected':''}>Каждый день</option>
          </select>
        </label>
      </div>
      <div class="tr-modal-row" id="h-target-row" style="${(existing?.schedule||'weekday')==='3perweek'?'':'display:none;'}">
        <label>Цель / нед
          <input type="number" id="h-target" value="${existing?.target||3}" min="1" max="7" inputmode="numeric">
        </label>
      </div>
      <div style="margin-bottom:12px;">
        <div style="font-size:12px;color:#9D9A92;margin-bottom:8px;">Иконка</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${ICONS.map(ic=>`
            <button class="hab-icon-btn" data-icon="${ic}" style="width:36px;height:36px;border-radius:8px;border:0.5px solid #2A2D35;background:${(existing?.icon||'ti-star')===ic?'#2E7FD4':'#1C1E24'};color:#E8E5DC;cursor:pointer;font-size:16px;">
              <i class="ti ${ic}"></i>
            </button>`).join('')}
        </div>
      </div>
      <div class="tr-modal-actions">
        ${isEdit?'<button class="tr-modal-btn-secondary" id="h-del" style="color:#FF5C5C;">Удалить</button>':'<button class="tr-modal-btn-secondary" id="h-cancel">Отмена</button>'}
        <button class="tr-modal-btn-primary" id="h-save">Сохранить</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove(); });

  let selIcon = existing?.icon||'ti-star';

  overlay.querySelector('#h-sched').addEventListener('change', e => {
    overlay.querySelector('#h-target-row').style.display = e.target.value==='3perweek' ? '' : 'none';
  });

  overlay.querySelectorAll('.hab-icon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selIcon = btn.dataset.icon;
      overlay.querySelectorAll('.hab-icon-btn').forEach(b => b.style.background = b.dataset.icon===selIcon ? '#2E7FD4' : '#1C1E24');
    });
  });

  const cb = overlay.querySelector('#h-cancel');
  if (cb) cb.addEventListener('click', () => overlay.remove());

  const db = overlay.querySelector('#h-del');
  if (db) db.addEventListener('click', () => {
    if (!confirm(`Удалить "${existing.name}"?`)) return;
    onSave(null); overlay.remove();
  });

  overlay.querySelector('#h-save').addEventListener('click', () => {
    const name = overlay.querySelector('#h-name').value.trim();
    if (!name) return;
    const sched = overlay.querySelector('#h-sched').value;
    const target = parseInt(overlay.querySelector('#h-target').value)||3;
    onSave({
      id: existing?.id||'h_'+Date.now(),
      name,
      description: overlay.querySelector('#h-desc').value.trim(),
      icon: selIcon,
      schedule: sched,
      target: sched==='3perweek' ? target : sched==='weekday' ? 5 : 7
    });
    overlay.remove();
  });
}

/* ── Главный экран ───────────────────────────────── */
window.Screens.habits = function(mount) {
  const today = new Date();
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth();
  let activeTab = 'grid';

  mount.innerHTML = `
    <div class="theme-dark">
      <div class="sec-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <button class="sec-back" id="hab-back"><i class="ti ti-arrow-left"></i></button>
          <p class="sec-title">Привычки</p>
        </div>
        <button class="sec-back" id="hab-logout"><i class="ti ti-logout"></i></button>
      </div>
      <div class="sec-tabs" style="position:sticky;top:0;z-index:10;">
        <button class="sec-tab active" data-tab="grid">Месяц</button>
        <button class="sec-tab" data-tab="history">История</button>
      </div>
      <div class="sec-body" id="hab-content"></div>
    </div>`;

  document.getElementById('hab-back').addEventListener('click', () => Router.go('/home'));
  document.getElementById('hab-logout').addEventListener('click', () => { Auth.logout(); Router.go('/login'); });
  mount.querySelectorAll('.sec-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      mount.querySelectorAll('.sec-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      render();
    });
  });

  const content = document.getElementById('hab-content');

  /* ── Сетка месяца ───────────────────────────── */
  function renderGrid() {
    const habits = habGetList();
    const mk = habMonthKey(viewYear, viewMonth);
    const marks = habGetMarks(mk);
    const daysInMonth = habDaysInMonth(viewYear, viewMonth);
    const isNow = today.getFullYear()===viewYear && today.getMonth()===viewMonth;

    const dayNums = Array.from({length:daysInMonth},(_,i)=>i+1);

    // Итог месяца
    const progresses = habits.map(h => habProgress(h, marks, viewYear, viewMonth));
    const overallPct = progresses.length ? Math.round(progresses.reduce((s,p)=>s+p.pct,0)/progresses.length) : 0;
    const bestIdx = progresses.length ? progresses.indexOf(progresses.reduce((a,b)=>a.pct>b.pct?a:b)) : -1;
    const worstIdx = progresses.length ? progresses.indexOf(progresses.reduce((a,b)=>a.pct<b.pct?a:b)) : -1;

    content.innerHTML = `
      <div class="sec-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div class="sec-card-title" style="margin:0;">Итог месяца</div>
          <div style="display:flex;gap:6px;align-items:center;">
            <button id="hab-prev" class="sec-back" style="width:28px;height:28px;"><i class="ti ti-chevron-left"></i></button>
            <span style="font-size:13px;white-space:nowrap;">${HAB_MONTHS_RU[viewMonth]} ${viewYear}</span>
            <button id="hab-next" class="sec-back" style="width:28px;height:28px;" ${isNow?'disabled style="opacity:.3;"':''}><i class="ti ti-chevron-right"></i></button>
          </div>
        </div>
        <div class="sec-metric-grid">
          <div class="sec-metric">
            <div class="sec-metric-label">Общий прогресс</div>
            <div class="sec-metric-value accent">${overallPct}%</div>
          </div>
          <div class="sec-metric">
            <div class="sec-metric-label">Лучшая</div>
            <div class="sec-metric-value" style="font-size:13px;">${bestIdx>=0?habits[bestIdx]?.name:'—'}</div>
          </div>
          <div class="sec-metric">
            <div class="sec-metric-label">Требует внимания</div>
            <div class="sec-metric-value" style="font-size:13px;">${worstIdx>=0?habits[worstIdx]?.name:'—'}</div>
          </div>
        </div>
      </div>

      <div class="sec-card" style="padding:12px;">
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
          <table class="habit-table" style="min-width:max-content;">
            <thead>
              <tr>
                <th style="min-width:130px;text-align:left;padding:4px 8px;font-size:11px;color:#9D9A92;">Привычка</th>
                ${dayNums.map(d=>{
                  const dow = habDow(viewYear, viewMonth, d);
                  const isToday = isNow && d===today.getDate();
                  const isWE = dow===0||dow===6;
                  return `<th style="min-width:22px;font-size:10px;text-align:center;color:${isToday?'#2E7FD4':isWE?'#444':'#666'};font-weight:${isToday?700:400};">${d}</th>`;
                }).join('')}
                <th style="min-width:50px;font-size:10px;color:#9D9A92;padding-left:8px;">%</th>
                <th style="min-width:36px;font-size:10px;color:#9D9A92;">Итог</th>
              </tr>
              <tr>
                <th></th>
                ${dayNums.map(d=>{
                  const dow = habDow(viewYear,viewMonth,d);
                  const isWE = dow===0||dow===6;
                  return `<th style="font-size:9px;text-align:center;color:${isWE?'#333':'#555'};">${HAB_DOW[dow]}</th>`;
                }).join('')}
                <th></th><th></th>
              </tr>
            </thead>
            <tbody>
              ${habits.map((h,hi)=>{
                const hMarks = marks[h.id]||{};
                const prog = progresses[hi];
                const cells = dayNums.map(d=>{
                  const active = habDayActive(h, viewYear, viewMonth, d);
                  const mark = hMarks[d]||'';
                  const isToday = isNow && d===today.getDate();
                  return `<td style="text-align:center;padding:2px 1px;">
                    <span class="hab-cell ${active?'hab-active':''} ${mark} ${isToday?'hab-today':''}"
                      data-hid="${h.id}" data-day="${d}" data-active="${active}">
                      ${habMarkHtml(mark, active)}
                    </span>
                  </td>`;
                }).join('');

                const barW = Math.max(0, prog.pct);
                const barColor = prog.pct>=80?'#A8C97F':prog.pct>=50?'#E0B873':'#FF5C5C';

                return `
                  <tr>
                    <td style="padding:6px 8px;white-space:nowrap;">
                      <div style="display:flex;align-items:center;gap:6px;cursor:pointer;" class="hab-name-edit" data-idx="${hi}">
                        <i class="ti ${h.icon}" style="color:#C8A84B;font-size:13px;"></i>
                        <span style="font-size:12px;">${h.name}</span>
                      </div>
                      ${h.description?`<div style="font-size:10px;color:#555;margin-left:19px;">${h.description}</div>`:''}
                      <div style="font-size:9px;color:#444;margin-left:19px;">${h.schedule==='weekday'?'пн–пт':h.schedule==='3perweek'?`${h.target}×/нед`:'каждый день'}</div>
                    </td>
                    ${cells}
                    <td style="padding:4px 8px;min-width:50px;">
                      <div style="font-size:11px;font-weight:600;color:${barColor};margin-bottom:3px;">${prog.pct}%</div>
                      <div style="height:3px;background:#2A2D35;border-radius:2px;">
                        <div style="height:100%;width:${barW}%;background:${barColor};border-radius:2px;transition:width 0.4s;"></div>
                      </div>
                    </td>
                    <td style="text-align:center;font-size:12px;color:#9D9A92;">${prog.done}</td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <button id="hab-add" style="width:100%;margin-top:12px;padding:10px;border-radius:8px;border:0.5px dashed #2A2D35;background:none;color:#9D9A92;cursor:pointer;font-size:13px;">
          <i class="ti ti-plus"></i> Добавить привычку
        </button>
      </div>`;

    /* Клики по ячейкам */
    content.querySelectorAll('.hab-cell.hab-active').forEach(el => {
      el.addEventListener('click', () => {
        const hid = el.dataset.hid;
        const day = parseInt(el.dataset.day);
        const cur = marks[hid]?.[day]||'';
        const next = habNextMark(cur, true);
        habSetMark(mk, hid, day, next);
        el.className = `hab-cell hab-active ${next} ${el.classList.contains('hab-today')?'hab-today':''}`;
        el.innerHTML = habMarkHtml(next, true);
        // Обновляем % без полного перерендера
        renderGrid();
      });
    });

    /* Редактирование */
    content.querySelectorAll('.hab-name-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const list = habGetList();
        habOpenModal(list[idx], result => {
          if (result===null) list.splice(idx,1);
          else list[idx]=result;
          habSaveList(list);
          renderGrid();
        });
      });
    });

    document.getElementById('hab-add').addEventListener('click', () => {
      habOpenModal(null, result => {
        if (!result) return;
        const list = habGetList();
        list.push(result);
        habSaveList(list);
        renderGrid();
      });
    });

    document.getElementById('hab-prev').addEventListener('click', () => {
      viewMonth--; if(viewMonth<0){viewMonth=11;viewYear--;} renderGrid();
    });
    const nb = document.getElementById('hab-next');
    if (nb&&!nb.disabled) nb.addEventListener('click', () => {
      viewMonth++; if(viewMonth>11){viewMonth=0;viewYear++;} renderGrid();
    });
  }

  /* ── История ────────────────────────────────── */
  function renderHistory() {
    const habits = habGetList();
    const allMonths = Store.get().habits?.months || {};
    const keys = Object.keys(allMonths).sort((a,b)=>b.localeCompare(a));

    if (!keys.length) {
      content.innerHTML = '<div style="padding:40px;text-align:center;color:#555;font-size:13px;">История появится после первого месяца</div>';
      return;
    }

    content.innerHTML = keys.map(mk => {
      const [y,m] = mk.split('-').map(Number);
      const marks = allMonths[mk]||{};
      const progresses = habits.map(h => habProgress(h, marks, y, m-1));
      const overallPct = progresses.length ? Math.round(progresses.reduce((s,p)=>s+p.pct,0)/progresses.length) : 0;

      return `
        <div class="sec-card">
          <div class="sec-card-title">${HAB_MONTHS_RU[m-1]} ${y} · <span style="color:#C8A84B;">${overallPct}%</span></div>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th style="text-align:left;font-size:11px;color:#9D9A92;padding:4px 0;">Привычка</th>
                <th style="font-size:11px;color:#9D9A92;text-align:right;">%</th>
                <th style="font-size:11px;color:#9D9A92;text-align:right;padding-left:12px;">Итог</th>
              </tr>
            </thead>
            <tbody>
              ${habits.map((h,i)=>{
                const p = progresses[i];
                const barColor = p.pct>=80?'#A8C97F':p.pct>=50?'#E0B873':'#FF5C5C';
                return `<tr>
                  <td style="padding:6px 0;font-size:13px;">
                    <i class="ti ${h.icon}" style="color:#C8A84B;margin-right:6px;"></i>${h.name}
                  </td>
                  <td style="text-align:right;min-width:80px;">
                    <div style="font-size:12px;color:${barColor};font-weight:600;margin-bottom:3px;">${p.pct}%</div>
                    <div style="height:3px;background:#2A2D35;border-radius:2px;">
                      <div style="height:100%;width:${p.pct}%;background:${barColor};border-radius:2px;"></div>
                    </div>
                  </td>
                  <td style="text-align:right;padding-left:12px;font-size:13px;color:#9D9A92;">${p.done}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
    }).join('');
  }

  function render() {
    if (activeTab==='grid') renderGrid();
    else renderHistory();
  }

  render();
};
