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
  const daysInMonth = habDaysInMonth(year, month);
  const today = new Date();
  const isCurrentMonth = today.getFullYear()===year && today.getMonth()===month;

  let done = Object.values(hMarks).filter(v=>v==='done').length;
  let total = 0;

  if (h.schedule === 'weekday') {
    /* Цель: все рабочие дни месяца */
    for (let d=1; d<=daysInMonth; d++) {
      if (habIsWorkday(year, month, d)) total++;
    }
  } else if (h.schedule === '3perweek') {
    /* Цель: target * кол-во недель в месяце */
    const fullWeeks = Math.floor(daysInMonth / 7);
    const remainder = daysInMonth % 7;
    total = fullWeeks * (h.target||3) + Math.round(remainder/7 * (h.target||3));
  } else {
    total = daysInMonth;
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
    <div class="tr-modal hab-modal">
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
    <div class="hab-screen hab-dark">
      <div class="hab-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <button class="hab-back-btn" id="hab-back"><i class="ti ti-arrow-left"></i></button>
          <p class="hab-screen-title">Привычки</p>
        </div>
        <button class="hab-back-btn" id="hab-logout"><i class="ti ti-logout"></i></button>
      </div>
      <div class="hab-tabs" style="position:sticky;top:53px;z-index:10;">
        <button class="hab-tab active" data-tab="grid">Месяц</button>
        <button class="hab-tab" data-tab="wheel">Колесо</button>
        <button class="hab-tab" data-tab="history">История</button>
      </div>
      <div class="hab-body" id="hab-content"></div>
    </div>`;

    document.getElementById('hab-back').addEventListener('click', () => Router.go('/home'));
  document.getElementById('hab-logout').addEventListener('click', () => { Auth.logout(); Router.go('/login'); });
  mount.querySelectorAll('.hab-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      mount.querySelectorAll('.hab-tab').forEach(b => b.classList.remove('active'));
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
        /* Обновляем только эту ячейку — без полного ре-рендера страницы */
        el.className = 'hab-cell hab-active ' + next + (el.classList.contains('hab-today')?' hab-today':'');
        el.innerHTML = habMarkHtml(next, true);
        /* Обновляем marks локально */
        if (!marks[hid]) marks[hid] = {};
        marks[hid][day] = next;
        /* Пересчитываем % только для этой привычки */
        const hi = habList.findIndex(h => h && h.id === hid);
        if (hi < 0) return;
        const prog = habProgress(habList[hi], marks, viewYear, viewMonth);
        const barColor = prog.pct >= 80 ? '#A8C97F' : prog.pct >= 50 ? '#E0B873' : '#FF5C5C';
        const pctEl = content.querySelector('.hab-pct-val[data-hi="'+hi+'"]');
        const barEl = content.querySelector('.hab-pct-bar[data-hi="'+hi+'"]');
        const totEl = content.querySelector('.hab-tot-val[data-hi="'+hi+'"]');
        if (pctEl) { pctEl.textContent = prog.pct+'%'; pctEl.style.color = barColor; }
        if (barEl) { barEl.style.width = prog.pct+'%'; barEl.style.background = barColor; }
        if (totEl) { totEl.textContent = prog.done; }
        /* Обновляем общий % */
        const allPcts = habList.map((h,i) => habProgress(h, marks, viewYear, viewMonth).pct);
        const overall = allPcts.length ? Math.round(allPcts.reduce((a,b)=>a+b,0)/allPcts.length) : 0;
        const overallEl = content.querySelector('.hab-overall-pct');
        if (overallEl) overallEl.textContent = overall+'%';
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


  /* ── КОЛЕСО ЖИЗНИ ───────────────────────────── */
  const WHEEL_SPHERES_DEFAULT = ["Здоровье / Спорт", "Финансы", "Работа / Карьера", "Отношения", "Личностный рост", "Отдых / Хобби", "Окружение", "Эмоции / Состояние"];

  function wheelGetData(monthKey) {
    return Store.get().habits?.wheel?.[monthKey] || null;
  }

  function wheelSave(monthKey, data) {
    Store.set(`habits.wheel.${monthKey}`, data);
  }

  function wheelDrawSVG(scores, size, interactive) {
    const n = scores.length;
    /* Увеличиваем отступ для подписей */
    const pad = 52;
    const cx = size/2, cy = size/2;
    const maxR = size/2 - pad;
    const angleStep = (2 * Math.PI) / n;

    /* Цвета для каждой сферы */
    const COLORS = ['#60A5FA','#A78BFA','#34D399','#F59E0B','#F87171','#38BDF8','#C084FC','#4ADE80'];

    /* Сетка с подписями значений */
    let gridLines = '';
    for (let ring = 2; ring <= 10; ring += 2) {
      const r = (ring/10) * maxR;
      const pts = Array.from({length:n},(_,i) => {
        const a = i * angleStep - Math.PI/2;
        return `${cx + r*Math.cos(a)},${cy + r*Math.sin(a)}`;
      }).join(' ');
      const alpha = ring === 10 ? '40' : '20';
      gridLines += `<polygon points="${pts}" fill="none" stroke="#9333EA${alpha}" stroke-width="${ring===10?1.5:0.5}"/>`;
      /* Подпись значения на 12 часов */
      gridLines += `<text x="${cx}" y="${cy - r - 3}" text-anchor="middle" font-size="8" fill="#9333EA66" font-family="Montserrat,sans-serif">${ring}</text>`;
    }

    /* Оси */
    let axes = Array.from({length:n},(_,i) => {
      const a = i * angleStep - Math.PI/2;
      return `<line x1="${cx}" y1="${cy}" x2="${cx + maxR*Math.cos(a)}" y2="${cy + maxR*Math.sin(a)}" stroke="#9333EA30" stroke-width="1"/>`;
    }).join('');

    /* Область данных — градиент */
    const dataPoints = scores.map((s,i) => {
      const r = Math.max(0.05, s/10) * maxR;
      const a = i * angleStep - Math.PI/2;
      return `${cx + r*Math.cos(a)},${cy + r*Math.sin(a)}`;
    }).join(' ');

    /* Подписи сфер — с запасом */
    const labels = WHEEL_SPHERES_DEFAULT.map((name,i) => {
      const a = i * angleStep - Math.PI/2;
      const labelR = maxR + 30;
      const x = cx + labelR*Math.cos(a);
      const y = cy + labelR*Math.sin(a);
      const cosA = Math.cos(a);
      const anchor = cosA > 0.3 ? 'start' : cosA < -0.3 ? 'end' : 'middle';
      const shortName = name.split('/')[0].trim();
      const score = scores[i];
      const color = COLORS[i % COLORS.length];
      return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" font-size="10" font-weight="600" fill="${color}" font-family="Montserrat,sans-serif">${shortName} ${score}</text>`;
    }).join('');

    /* Точки с цветами */
    const dots = scores.map((s,i) => {
      if (!s) return '';
      const r = (s/10) * maxR;
      const a = i * angleStep - Math.PI/2;
      const x = cx + r*Math.cos(a);
      const y = cy + r*Math.sin(a);
      const color = COLORS[i % COLORS.length];
      return `<circle cx="${x}" cy="${y}" r="5" fill="${color}" stroke="#1C1E24" stroke-width="2"/>`;
    }).join('');

    const avg = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) : '0';
    const avgColor = parseFloat(avg) >= 7 ? '#4ADE80' : parseFloat(avg) >= 5 ? '#F59E0B' : '#F87171';

    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
      <defs>
        <radialGradient id="wg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#9333EA" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#9333EA" stop-opacity="0.05"/>
        </radialGradient>
      </defs>
      ${gridLines}${axes}
      <polygon points="${dataPoints}" fill="url(#wg)" stroke="#9333EA" stroke-width="2.5" stroke-linejoin="round"/>
      ${dots}${labels}
      <circle cx="${cx}" cy="${cy}" r="28" fill="#1C1E24" stroke="#9333EA33" stroke-width="1"/>
      <text x="${cx}" y="${cy-5}" text-anchor="middle" font-size="20" font-weight="900" fill="${avgColor}" font-family="Montserrat,sans-serif">${avg}</text>
      <text x="${cx}" y="${cy+11}" text-anchor="middle" font-size="8" fill="#9333EA99" font-family="Montserrat,sans-serif">avg</text>
    </svg>`;
  }

  function wheelOpenForm(monthKey, existing, onSave) {
    const spheres = WHEEL_SPHERES_DEFAULT;
    const scores = existing?.scores || new Array(spheres.length).fill(5);
    const overlay = document.createElement('div');
    overlay.className = 'tr-modal-overlay';

    function buildSliders() {
      return spheres.map((name,i) => `
        <div class="wheel-slider-row">
          <div class="wheel-slider-label">
            <span>${name}</span>
            <span class="wheel-slider-val" id="wsv-${i}">${scores[i]}</span>
          </div>
          <input type="range" class="wheel-slider" data-i="${i}" min="1" max="10" value="${scores[i]}">
        </div>`).join('');
    }

    overlay.innerHTML = `
      <div class="tr-modal" style="max-height:90vh;overflow-y:auto;">
        <p class="tr-modal-title">Колесо жизни · ${monthKey}</p>
        <div id="wheel-preview" style="display:flex;justify-content:center;margin-bottom:12px;">
          ${wheelDrawSVG(scores, 220, false)}
        </div>
        <div id="wheel-sliders">${buildSliders()}</div>
        <div class="tr-modal-row" style="margin-top:8px;">
          <label style="flex:1 1 100%">Комментарий к месяцу
            <input type="text" id="wheel-comment" value="${existing?.comment||''}" placeholder="Как прошёл месяц?">
          </label>
        </div>
        <div class="tr-modal-actions">
          <button class="tr-modal-btn-secondary" id="wheel-cancel">Отмена</button>
          <button class="tr-modal-btn-primary" id="wheel-save">Сохранить</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
    overlay.querySelector('#wheel-cancel').addEventListener('click',()=>overlay.remove());

    overlay.querySelectorAll('.wheel-slider').forEach(sl => {
      sl.addEventListener('input', () => {
        const i = parseInt(sl.dataset.i);
        scores[i] = parseInt(sl.value);
        overlay.querySelector(`#wsv-${i}`).textContent = scores[i];
        overlay.querySelector('#wheel-preview').innerHTML = wheelDrawSVG(scores, 220, false);
      });
    });

    overlay.querySelector('#wheel-save').addEventListener('click',()=>{
      const comment = overlay.querySelector('#wheel-comment').value.trim();
      onSave({ scores: [...scores], comment, savedAt: new Date().toISOString() });
      overlay.remove();
    });
  }

  function renderWheel() {
    /* Список всех сохранённых колёс */
    const allWheels = Store.get().habits?.wheel || {};
    const keys = Object.keys(allWheels).sort((a,b)=>b.localeCompare(a));

    /* Текущий месяц */
    const now = new Date();
    const currentMk = habMonthKey(now.getFullYear(), now.getMonth());
    const currentData = wheelGetData(currentMk);

    content.innerHTML = `
      <div class="wheel-screen">
        <div class="wheel-current-card">
          <div class="wheel-card-head">
            <div>
              <div class="wheel-card-eyebrow">Текущий месяц</div>
              <div class="wheel-card-title">${HAB_MONTHS_RU[now.getMonth()]} ${now.getFullYear()}</div>
            </div>
            <button id="wheel-fill-now" class="wheel-fill-btn">
              ${currentData ? '✏️ Изменить' : '+ Заполнить'}
            </button>
          </div>
          ${currentData
            ? `<div style="display:flex;justify-content:center;">${wheelDrawSVG(currentData.scores, 260, false)}</div>
               ${currentData.comment ? `<div class="wheel-comment">"${currentData.comment}"</div>` : ''}`
            : `<div class="wheel-empty">Оцени свой месяц по 10 сферам жизни</div>`}
        </div>

        ${keys.filter(k=>k!==currentMk).length>0 ? `
        <div class="wheel-history">
          <div class="wheel-history-title">История</div>
          ${keys.filter(k=>k!==currentMk).map(mk=>{
            const d = allWheels[mk];
            const [y,m] = mk.split('-');
            const avg = d.scores ? (d.scores.reduce((a,b)=>a+b,0)/d.scores.length).toFixed(1) : '—';
            return `<div class="wheel-hist-row wheel-hist-open" data-mk="${mk}">
              <div>
                <div class="wheel-hist-month">${HAB_MONTHS_RU[parseInt(m)-1]} ${y}</div>
                ${d.comment?`<div class="wheel-hist-comment">"${d.comment}"</div>`:''}
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <div class="wheel-hist-avg">${avg}</div>
                <i class="ti ti-chevron-right" style="color:#9CA3AF;"></i>
              </div>
            </div>`;
          }).join('')}
        </div>` : ''}
      </div>`;

    document.getElementById('wheel-fill-now').addEventListener('click',()=>{
      wheelOpenForm(currentMk, currentData, result=>{
        wheelSave(currentMk, result);
        renderWheel();
      });
    });

    content.querySelectorAll('.wheel-hist-open').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const mk=btn.dataset.mk;
        const d=allWheels[mk];
        const [y,m]=mk.split('-');
        const overlay=document.createElement('div');
        overlay.className='tr-modal-overlay';
        overlay.innerHTML=`
          <div class="tr-modal">
            <p class="tr-modal-title">${HAB_MONTHS_RU[parseInt(m)-1]} ${y}</p>
            <div style="display:flex;justify-content:center;">${wheelDrawSVG(d.scores,260,false)}</div>
            ${d.comment?`<div class="wheel-comment" style="margin:12px 0;">"${d.comment}"</div>`:''}
            <div class="tr-modal-actions">
              <button class="tr-modal-btn-secondary" id="wh-edit">Изменить</button>
              <button class="tr-modal-btn-primary" id="wh-close">Закрыть</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
        overlay.querySelector('#wh-close').addEventListener('click',()=>overlay.remove());
        overlay.querySelector('#wh-edit').addEventListener('click',()=>{
          overlay.remove();
          wheelOpenForm(mk,d,result=>{wheelSave(mk,result);renderWheel();});
        });
      });
    });
  }

  function render() {
    if (activeTab==='grid') renderGrid();
    else if (activeTab==='wheel') renderWheel();
    else renderHistory();
  }

  render();
};
