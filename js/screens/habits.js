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

/* огонёк серии у привычки: одна функция для таблицы и для обновления после отметки */
function habStreakChip(h){const s=habStreak(h,Store.get());if(!s)return '';const c=s>=14?'#FF4500':s>=7?'#F59E0B':s>=3?'#FB923C':'#9D9A92';return `<span class="hab-streak-chip" style="display:inline-flex;align-items:center;gap:3px;background:${c}18;border:1px solid ${c}44;border-radius:20px;padding:1px 6px;margin-left:2px;"><svg width="7" height="9" viewBox="0 0 8 10" fill="${c}"><path d="M4 0C4 0 6.5 3 6.5 5.5C6.5 7.5 5.4 9 4 9C2.6 9 1.5 7.5 1.5 5.5C1.5 4 2.5 2.5 3 1.5C3 1.5 2 3 2.5 4.5C3 4 3.5 3 4 0Z"/></svg><span style="font-size:10px;font-weight:700;color:${c};">${s}</span></span>`}
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

const HABITS_DEMO = [
  { id:'hd1', name:'Физическая активность', description:'Минимум 30 мин движения', icon:'ti-run', schedule:'daily',    target:7  },
  { id:'hd2', name:'Читать книгу',           description:'Хотя бы 10 страниц',      icon:'ti-book', schedule:'daily',   target:7  },
  { id:'hd3', name:'Вода 2 литра',           description:'Выпить 2л воды за день',  icon:'ti-droplet', schedule:'daily',target:7  },
  { id:'hd4', name:'Без соцсетей утром',     description:'Первый час без телефона', icon:'ti-device-mobile-off', schedule:'weekday', target:5 },
  { id:'hd5', name:'Тренировка в зале',      description:'Полноценная тренировка',  icon:'ti-barbell', schedule:'3perweek', target:3 },
  { id:'hd6', name:'Медитация',              description:'5–10 минут тишины',       icon:'ti-brain',  schedule:'daily',   target:7  },
  { id:'hd7', name:'Планирование дня',       description:'Записать 3 главных дела', icon:'ti-checklist', schedule:'weekday', target:5 },
];

function habGetList() {
  return (Store.get().habits?.list || []).filter(Boolean);
}
function habIsDemo() {
  /* демо только пока человек его не убрал и ничего своего не добавил */
  return habGetList().length === 0 && !Store.get().habits?.demoOff;
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

/* иконка привычки идёт в class: только имена Tabler вида ti-xxx */
const habIco = (v) => /^ti-[a-z0-9-]{1,40}$/.test(String(v || '')) ? v : 'ti-star';
const habEsc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Считаем прогресс с учётом расписания */
function habProgress(h, marks, year, month) {
  const hMarks = marks[h.id] || {};
  const daysInMonth = habDaysInMonth(year, month);
  const today = new Date();
  const isCurrentMonth = today.getFullYear()===year && today.getMonth()===month;

  /* текущий месяц считаем по прошедшим дням, а не по всему месяцу: 2-го числа 2 из 2 = 100%, а не 6% */
  const lastDay = isCurrentMonth ? today.getDate() : daysInMonth;
  let done = Object.entries(hMarks).filter(([d,v])=>v==='done' && +d <= lastDay).length;
  let total = 0;

  if (h.schedule === 'weekday') {
    for (let d=1; d<=lastDay; d++) {
      if (habIsWorkday(year, month, d)) total++;
    }
  } else if (h.schedule === 'weekend') {
    for (let d=1; d<=lastDay; d++) {
      const dow = new Date(year, month, d).getDay();
      if (dow===0||dow===6) total++;
    }
  } else if (h.schedule === 'custom') {
    const days = h.customDays||[];
    for (let d=1; d<=lastDay; d++) {
      const dow = new Date(year, month, d).getDay()||7; // 1=пн..7=вс
      if (days.includes(dow)) total++;
    }
  } else if (h.schedule === '3perweek') {
    const fullWeeks = Math.floor(lastDay / 7);
    const remainder = lastDay % 7;
    total = fullWeeks * (h.target||3) + Math.round(remainder/7 * (h.target||3));
  } else {
    total = lastDay;
  }
  /* будущий месяц или день без плановых отметок */
  if (isCurrentMonth && total < 1) total = 0;

  const pct = total>0 ? Math.min(100, Math.round(done/total*100)) : 0;
  return { done, total, pct };
}

/* Является ли день активным для этой привычки */
function habDayActive(h, year, month, day) {
  if (h.schedule==='weekday') return habIsWorkday(year, month, day);
  if (h.schedule==='weekend') { const dow=new Date(year,month,day).getDay(); return dow===0||dow===6; }
  if (h.schedule==='custom') { const dow=new Date(year,month,day).getDay()||7; return (h.customDays||[]).includes(dow); }
  return true;
}


/* Считаем текущий стрик (дней подряд = done) до сегодня включительно */
function habStreak(h, store) {
  const allMonths = store.habits?.months || {};
  const today = new Date();
  let streak = 0;
  let d = new Date(today);

  for (let i = 0; i < 365; i++) {
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    const mk = habMonthKey(year, month);
    const mark = allMonths[mk]?.[h.id]?.[day];
    const active = habDayActive(h, year, month, day);

    if (!active) { d.setDate(d.getDate() - 1); continue; } // не рабочий — пропускаем
    if (mark === 'done') {
      streak++;
    } else if (i === 0 && (!mark || mark === '')) {
      // Сегодня ещё не отмечено — не ломаем стрик, продолжаем смотреть вчера
    } else {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function habSchedLabel(h) {
  if (h.schedule === 'weekday') return 'пн–пт';
  if (h.schedule === 'weekend') return 'сб–вс';
  if (h.schedule === '3perweek') return (h.target || 3) + '×/нед';
  if (h.schedule === 'custom') {
    const names = ['пн','вт','ср','чт','пт','сб','вс'];
    const d = (h.customDays || []).slice().sort((a,b)=>a-b).map(x => names[x-1]).filter(Boolean);
    return d.length ? d.join(', ') : 'своё';
  }
  return 'каждый день';
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
  overlay.className = 'tr-modal-overlay modal-habits';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:300;padding:20px;box-sizing:border-box;';

  const ICONS = ['ti-star','ti-bolt','ti-apple','ti-barbell','ti-device-mobile',
    'ti-book','ti-run','ti-heart','ti-moon','ti-sun','ti-droplet',
    'ti-pencil','ti-music','ti-brain','ti-leaf','ti-flame','ti-target','ti-trophy'];

  overlay.innerHTML = `
    <div class="tr-modal hab-modal">
      <p class="tr-modal-title">${isEdit?'Редактировать':'Новая привычка'}</p>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Название
          <input type="text" id="h-name" value="${habEsc(existing?.name||'')}" placeholder="Медитация, чтение…">
        </label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Описание / критерий
          <input type="text" id="h-desc" value="${habEsc(existing?.description||'')}" placeholder="Что считается выполненным?">
        </label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Расписание
          <select id="h-sched" class="tr-color-select">
            <option value="daily"    ${existing?.schedule==='daily'   ?'selected':''}>Каждый день</option>
            <option value="weekday"  ${(existing?.schedule||'weekday')==='weekday'?'selected':''}>Пн – Пт (рабочие дни)</option>
            <option value="3perweek" ${existing?.schedule==='3perweek'?'selected':''}>N раз в неделю</option>
            <option value="weekend"  ${existing?.schedule==='weekend' ?'selected':''}>Сб – Вс (выходные)</option>
            <option value="custom"   ${existing?.schedule==='custom'  ?'selected':''}>Своё расписание</option>
          </select>
        </label>
      </div>
      <div class="tr-modal-row" id="h-target-row" style="${existing?.schedule==='3perweek'?'':'display:none;'}">
        <label>Раз в неделю
          <input type="number" id="h-target" value="${existing?.target||3}" min="1" max="7" inputmode="numeric">
        </label>
      </div>
      <div id="h-custom-days-row" style="${existing?.schedule==='custom'?'':'display:none;'}">
        <div style="font-size:12px;color:#9D9A92;margin-bottom:8px;">Выбери дни</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((d,i)=>{
            const val = i+1;
            const checked = (existing?.customDays||[]).includes(val);
            return `<label style="display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;">
              <input type="checkbox" class="h-custom-day-cb" value="${val}" ${checked?'checked':''} style="display:none;">
              <span class="h-day-pill" style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:1.5px solid ${checked?'#16A34A':'#2A2D35'};background:${checked?'rgba(22,163,74,0.2)':'transparent'};color:${checked?'#4ADE80':'#9D9A92'};transition:all 0.15s;">${d}</span>
            </label>`;
          }).join('')}
        </div>
      </div>
      <div style="margin-bottom:12px;">
        <div style="font-size:12px;color:#9D9A92;margin-bottom:8px;">Иконка</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${ICONS.map(ic=>`
            <button class="hab-icon-btn" data-icon="${ic}" style="width:36px;height:36px;border-radius:8px;border:0.5px solid ${(existing?.icon||'ti-star')===ic?'#16A34A':'#2A2D35'};background:${(existing?.icon||'ti-star')===ic?'rgba(22,163,74,0.25)':'#1C1E24'};color:${(existing?.icon||'ti-star')===ic?'#4ADE80':'#E8E5DC'};cursor:pointer;font-size:16px;">
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
    const v = e.target.value;
    overlay.querySelector('#h-target-row').style.display = v==='3perweek' ? '' : 'none';
    overlay.querySelector('#h-custom-days-row').style.display = v==='custom' ? '' : 'none';
  });

  // Pill-кнопки для дней недели
  overlay.querySelectorAll('.h-custom-day-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const pill = cb.nextElementSibling;
      if (cb.checked) {
        pill.style.borderColor='#16A34A'; pill.style.background='rgba(22,163,74,0.2)'; pill.style.color='#4ADE80';
      } else {
        pill.style.borderColor='#2A2D35'; pill.style.background='transparent'; pill.style.color='#9D9A92';
      }
    });
    // Клик на pill тоже тоглит чекбокс
    cb.nextElementSibling.addEventListener('click', () => { cb.checked=!cb.checked; cb.dispatchEvent(new Event('change')); });
  });

  overlay.querySelectorAll('.hab-icon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selIcon = btn.dataset.icon;
      overlay.querySelectorAll('.hab-icon-btn').forEach(b => {
        const isSelected = b.dataset.icon === selIcon;
        b.style.background = isSelected ? 'rgba(22,163,74,0.25)' : '#1C1E24';
        b.style.borderColor = isSelected ? '#16A34A' : '#2A2D35';
        b.style.color = isSelected ? '#4ADE80' : '#E8E5DC';
      });
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
    const customDays = sched==='custom'
      ? Array.from(overlay.querySelectorAll('.h-custom-day-cb:checked')).map(c=>parseInt(c.value))
      : [];
    onSave({
      id: existing?.id||'h_'+Date.now(),
      name,
      description: overlay.querySelector('#h-desc').value.trim(),
      icon: selIcon,
      schedule: sched,
      target: sched==='3perweek' ? target : sched==='weekday' ? 5 : sched==='weekend' ? 2 : sched==='custom' ? customDays.length : 7,
      customDays,
    });
    overlay.remove();
  });
}

/* ── Главный экран ───────────────────────────────── */
window.Screens.habits = function(mount) {
  const today = new Date();
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth();
  let activeTab = (window.__keepUi && window.__ui && window.__ui.hab) || 'grid';

  mount.innerHTML = `
    <div class="hab-screen hab-dark">
      <div class="hab-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <button class="hab-back-btn" id="hab-back"><i class="ti ti-arrow-left"></i></button>
          <p class="hab-screen-title">Привычки</p>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="hab-back-btn" id="hab-settings"><i class="ti ti-settings"></i></button>
          <button class="hab-back-btn" id="hab-logout"><i class="ti ti-logout"></i></button>
        </div>
      </div>
      <div class="hab-tabs" style="position:sticky;top:53px;z-index:10;">
        <button class="hab-tab active" data-tab="grid">Месяц</button>
        <button class="hab-tab" data-tab="wheel">Колесо</button>
        <button class="hab-tab" data-tab="history">История</button>
      </div>
      <div id="wh-remind"></div>
      <div class="hab-body" id="hab-content"></div>
    </div>`;

    document.getElementById('hab-back').addEventListener('click', () => Router.go('/home'));
  document.getElementById('hab-logout').addEventListener('click', () => { Auth.logout().then(function(){ Router.go('/login'); }); });

  /* ── Настройки привычек ── */
  document.getElementById('hab-settings').addEventListener('click', () => {
    const habits = habGetList();
    const ov = document.createElement('div');
    ov.className = 'tr-modal-overlay modal-habits';
    ov.style.cssText = 'align-items:center;justify-content:center;padding:20px;box-sizing:border-box;'; /* bottom sheet */

    function renderSettings() {
      const list = habGetList();
      const itemsHtml = list.map((h, i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #1E2028;">
          <i class="ti ${habIco(h.icon)}" style="font-size:20px;color:#C8A84B;width:24px;text-align:center;"></i>
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:600;color:#E8E5DC;font-family:Montserrat,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${habEsc(h.name)}</div>
            <div style="font-size:11px;color:#6B6F7A;margin-top:2px;">${habSchedLabel(h)}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <button class="hab-set-edit hab-icon-action" data-idx="${i}" title="Изменить" aria-label="Изменить"><i class="ti ti-edit"></i></button>
            <button class="hab-set-del hab-icon-action hab-icon-danger" data-idx="${i}" title="Удалить" aria-label="Удалить"><i class="ti ti-trash"></i></button>
          </div>
        </div>`).join('');

      ov.innerHTML = `<div style="background:#13151A;border-radius:16px;width:100%;max-width:480px;margin:0 auto;max-height:85vh;display:flex;flex-direction:column;">
        <div style="position:sticky;top:0;background:#13151A;padding:18px 20px 14px;border-bottom:1px solid #1E2028;border-radius:16px 16px 0 0;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <span style="font-size:17px;font-weight:800;color:#E8E5DC;font-family:Montserrat,sans-serif;">Настройки привычек</span>
          <button id="hab-set-close" style="background:#1E2028;border:none;border-radius:50%;width:30px;height:30px;color:#9D9A92;cursor:pointer;font-size:18px;">×</button>
        </div>
        <div style="overflow-y:auto;flex:1;padding:0 20px 32px;">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#555;padding:14px 0 6px;">Список привычек</div>
          ${itemsHtml||'<div style="color:#555;font-size:13px;padding:16px 0;">Нет привычек</div>'}
          <button id="hab-set-add" style="width:100%;margin-top:14px;padding:13px;background:#A8C97F;border:none;border-radius:12px;color:#1A1C22;font-size:14px;font-weight:800;cursor:pointer;font-family:Montserrat,sans-serif;">+ Добавить привычку</button>
        </div>
      </div>`;

      ov.querySelector('#hab-set-close').addEventListener('click', () => ov.remove());
      ov.addEventListener('click', e => { if(e.target===ov) ov.remove(); });

      /* Раньше тут вызывалась несуществующая openHabitModal — кнопки молча не работали */
      ov.querySelector('#hab-set-add').addEventListener('click', () => {
        habOpenModal(null, result => {
          if (!result) return;
          const list = habGetList();
          list.push(result);
          habSaveList(list);
          render(); renderSettings();
        });
      });

      ov.querySelectorAll('.hab-set-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          const list = habGetList();
          habOpenModal(list[idx], result => {
            if (result === null) list.splice(idx, 1);
            else list[idx] = result;
            habSaveList(list);
            render(); renderSettings();
          });
        });
      });

      ov.querySelectorAll('.hab-set-del').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          if (!confirm('Удалить привычку?')) return;
          const list2 = habGetList();
          list2.splice(idx, 1);
          habSaveList(list2);
          render();
          renderSettings();
        });
      });
    }

    document.body.appendChild(ov);
    renderSettings();
  });
  mount.querySelectorAll('.hab-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      mount.querySelectorAll('.hab-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      render();
    });
  if (window.TabsCustom) TabsCustom.apply(mount.querySelector('.hab-tabs'), 'habits', 'data-tab');
  });

  const content = document.getElementById('hab-content');

  /* ── Сетка месяца ───────────────────────────── */
  function renderGrid() {
    const isDemo = habIsDemo();
    const habits = isDemo ? HABITS_DEMO : habGetList();
    const mk = habMonthKey(viewYear, viewMonth);
    const marks = isDemo ? {} : habGetMarks(mk);
    const daysInMonth = habDaysInMonth(viewYear, viewMonth);
    const isNow = today.getFullYear()===viewYear && today.getMonth()===viewMonth;

    const dayNums = Array.from({length:daysInMonth},(_,i)=>i+1);

    const progresses = habits.map(h => habProgress(h, marks, viewYear, viewMonth));
    const overallPct = progresses.length ? Math.round(progresses.reduce((s,p)=>s+p.pct,0)/progresses.length) : 0;
    const bestIdx = progresses.length ? progresses.indexOf(progresses.reduce((a,b)=>a.pct>b.pct?a:b)) : -1;
    const worstIdx = progresses.length ? progresses.indexOf(progresses.reduce((a,b)=>a.pct<b.pct?a:b)) : -1;
    /* все на одном уровне: «лучшая» и «подтянуть» ничего не говорят */
    const habSame = progresses.length < 2 || progresses.every(p => p.pct === progresses[0].pct);

    const demoBanner = isDemo ? `
      <div id="hab-demo-banner" style="background:rgba(22,163,74,0.08);border:1px solid rgba(22,163,74,0.2);border-radius:12px;padding:12px 14px;margin:0 0 12px;display:flex;align-items:flex-start;gap:10px;">
        <span style="font-size:18px;flex-shrink:0;">💡</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:700;color:#86EFAC;margin-bottom:3px;">Это демо-привычки</div>
          <div style="font-size:12px;color:rgba(134,239,172,0.7);line-height:1.5;">Популярные привычки для примера. Добавь свои через «+ Добавить привычку».</div>
          <button id="hab-clear-demo" style="margin-top:8px;padding:6px 14px;background:rgba(22,163,74,0.15);border:1px solid rgba(22,163,74,0.35);border-radius:8px;color:#4ADE80;font-size:12px;font-weight:700;cursor:pointer;font-family:Montserrat,sans-serif;">✏️ Начать с чистого листа</button>
        </div>
      </div>` : '';

    content.innerHTML = `
      <div class="sec-card">
      ${demoBanner}
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div class="sec-card-title" style="margin:0;">Итог месяца</div>
          <div style="display:flex;gap:6px;align-items:center;">
            <button id="hab-prev" class="sec-back" style="width:28px;height:28px;"><i class="ti ti-chevron-left"></i></button>
            <span style="font-size:13px;white-space:nowrap;">${HAB_MONTHS_RU[viewMonth]} ${viewYear}</span>
            <button id="hab-next" class="sec-back" style="width:28px;height:28px;${isNow?'opacity:.3;':''}" ${isNow?'disabled':''}><i class="ti ti-chevron-right"></i></button>
          </div>
        </div>
        <div class="sec-metric-grid" style="grid-template-columns:repeat(3,1fr);gap:10px;">
          <div class="sec-metric" style="background:#1C1E24;border-radius:14px;padding:14px 10px;text-align:center;">
            <div class="sec-metric-label" style="font-size:9px;color:#9D9A92;margin-bottom:6px;letter-spacing:0.06em;text-transform:uppercase;">Прогресс</div>
            <div class="sec-metric-value accent hab-overall-pct" style="font-size:clamp(20px,6vw,28px);font-weight:900;line-height:1;">${overallPct}%</div>
          </div>
          <div class="sec-metric" style="background:#1C1E24;border-radius:14px;padding:14px 10px;text-align:center;">
            <div class="sec-metric-label" style="font-size:9px;color:#9D9A92;margin-bottom:6px;letter-spacing:0.06em;text-transform:uppercase;">Лучшая</div>
            <div class="sec-metric-value" style="font-size:clamp(10px,2.8vw,13px);font-weight:700;color:#A8C97F;line-height:1.3;word-break:break-word;" id="hab-best">${bestIdx>=0&&!habSame?habEsc(habits[bestIdx]?.name):(progresses.every(p=>!p.pct)?'пока нет отметок':'нет лидера')}</div>
          </div>
          <div class="sec-metric" style="background:#1C1E24;border-radius:14px;padding:14px 10px;text-align:center;">
            <div class="sec-metric-label" style="font-size:9px;color:#9D9A92;margin-bottom:6px;letter-spacing:0.06em;text-transform:uppercase;">Подтянуть</div>
            <div class="sec-metric-value" style="font-size:clamp(10px,2.8vw,13px);font-weight:700;color:#E0B873;line-height:1.3;word-break:break-word;" id="hab-worst">${worstIdx>=0&&!habSame?habEsc(habits[worstIdx]?.name):(progresses.every(p=>!p.pct)?'пока нет отметок':'нет отстающих')}</div>
          </div>
        </div>
      </div>

      <div class="sec-card" style="padding:0;overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px 8px;border-bottom:1px solid rgba(255,255,255,0.06);">
          <button id="hab-grid-prev" style="background:rgba(255,255,255,0.07);border:none;border-radius:8px;width:30px;height:30px;color:#E8E5DC;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;"><i class="ti ti-chevron-left"></i></button>
          <span style="font-size:13px;font-weight:700;color:#E8E5DC;">${HAB_MONTHS_RU[viewMonth]} ${viewYear}</span>
          <button id="hab-grid-next" ${isNow?'disabled':''} style="${isNow?'opacity:.3;cursor:default;':''}background:rgba(255,255,255,0.07);border:none;border-radius:8px;width:30px;height:30px;color:#E8E5DC;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;"><i class="ti ti-chevron-right"></i></button>
        </div>
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;position:relative;">
          <table class="habit-table" style="min-width:max-content;min-width:calc(7*40px + 130px);">
            <thead style="position:sticky;top:0;z-index:5;">
              <tr>
                <th style="min-width:130px;text-align:left;padding:4px 8px;font-size:11px;color:#9D9A92;${(!window.Features||window.Features.isOn('habit_sticky_col'))?'position:sticky;left:0;z-index:6;background:#1A1C22;':''}">Привычка</th>
                ${dayNums.map(d=>{
                  const dow = habDow(viewYear, viewMonth, d);
                  const isToday = isNow && d===today.getDate();
                  const isWE = dow===0||dow===6;
                  return `<th style="min-width:22px;font-size:10px;text-align:center;color:${isToday?'#4ADE80':isWE?'#444':'#666'};font-weight:${isToday?700:400};">${d}</th>`;
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
                    <span class="hab-cell ${active?'hab-active':''} ${['done','missed'].includes(mark)?mark:''} ${isToday?'hab-today':''}"
                      data-hid="${habEsc(h.id)}" data-day="${d}" data-active="${active}">
                      ${habMarkHtml(mark, active)}
                    </span>
                  </td>`;
                }).join('');

                const barW = Math.max(0, prog.pct);
                const barColor = prog.pct>=80?'#A8C97F':prog.pct>=50?'#E0B873':'#FF5C5C';

                return `
                  <tr>
                    <td class="hab-nm-td" style="padding:6px 8px;white-space:nowrap;${(!window.Features||window.Features.isOn('habit_sticky_col'))?'position:sticky;left:0;z-index:4;background:#1A1C22;':''}">
                      <div style="display:flex;align-items:center;gap:6px;cursor:pointer;" class="hab-name-edit" data-idx="${hi}">
                        <i class="ti ${habIco(h.icon)}" style="color:#C8A84B;font-size:13px;"></i>
                        <span class="hab-nm" style="font-size:12px;">${habEsc(h.name)}</span>
                      </div>
                      ${h.description?`<div style="font-size:10px;color:#555;margin-left:19px;">${habEsc(h.description)}</div>`:''}
                      <div style="display:flex;align-items:center;gap:6px;margin-left:19px;margin-top:1px;">
                        <span style="font-size:9px;color:#555;">${habSchedLabel(h)}</span>
                        <span class="hab-streak-wrap" data-hi="${hi}">${habStreakChip(h)}</span>
                      </div>
                    </td>
                    ${cells}
                    <td style="padding:4px 8px;min-width:50px;">
                      <div class="hab-pct-val" data-hi="${hi}" style="font-size:11px;font-weight:600;color:${barColor};margin-bottom:3px;">${prog.pct}%</div>
                      <div style="height:3px;background:#2A2D35;border-radius:2px;">
                        <div class="hab-pct-bar" data-hi="${hi}" style="height:100%;width:${barW}%;background:${barColor};border-radius:2px;transition:width 0.4s;"></div>
                      </div>
                    </td>
                    <td class="hab-tot-val" data-hi="${hi}" style="text-align:center;font-size:12px;color:#9D9A92;">${prog.done}</td>
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
        const habList = habits; /* раньше тут была неопределённая переменная → ошибка после клика */
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
        const stEl = content.querySelector('.hab-streak-wrap[data-hi="'+hi+'"]'); if (stEl) stEl.innerHTML = habStreakChip(habList[hi]);
        /* Обновляем общий % */
        const allPcts = habList.map((h,i) => habProgress(h, marks, viewYear, viewMonth).pct);
        const overall = allPcts.length ? Math.round(allPcts.reduce((a,b)=>a+b,0)/allPcts.length) : 0;
        const overallEl = content.querySelector('.hab-overall-pct');
        if (overallEl) overallEl.textContent = overall+'%';
        /* «Лучшая» и «Подтянуть» тоже сразу */
        const same = allPcts.length < 2 || allPcts.every(p => p === allPcts[0]);
        const bi = allPcts.indexOf(Math.max(...allPcts)), wi = allPcts.indexOf(Math.min(...allPcts));
        const bEl = content.querySelector('#hab-best'), wEl = content.querySelector('#hab-worst');
        if (bEl) bEl.innerHTML = !same && habList[bi] ? habEsc(habList[bi].name) : (allPcts.every(p => !p) ? 'пока нет отметок' : 'нет лидера');
        if (wEl) wEl.innerHTML = !same && habList[wi] ? habEsc(habList[wi].name) : (allPcts.every(p => !p) ? 'пока нет отметок' : 'нет отстающих');
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

    // Кнопка «Начать с чистого листа» — сохраняем пустой список чтобы убрать демо
    const clearDemoBtn = document.getElementById('hab-clear-demo');
    if (clearDemoBtn) {
      clearDemoBtn.addEventListener('click', () => {
        if (!confirm('Удалить демо-привычки и начать с нуля?')) return;
        habSaveList([]);
        Store.set('habits.demoOff', true);
        renderGrid();
      });
    }

    document.getElementById('hab-add').addEventListener('click', () => {
      habOpenModal(null, result => {
        if (!result) return;
        /* При первом добавлении своей привычки — инициализируем пустой список (сбрасываем демо) */
        const list = habIsDemo() ? [] : habGetList();
        list.push(result);
        habSaveList(list);
        Store.set('habits.demoOff', true);
        renderGrid();
      });
    });

    // Стрелки над таблицей
    const _gp = document.getElementById('hab-grid-prev');
    const _gn = document.getElementById('hab-grid-next');
    if (_gp) _gp.addEventListener('click', () => { viewMonth--; if(viewMonth<0){viewMonth=11;viewYear--;} renderGrid(); });
    if (_gn && !_gn.disabled) _gn.addEventListener('click', () => { viewMonth++; if(viewMonth>11){viewMonth=0;viewYear++;} renderGrid(); });

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
      content.innerHTML = '<div class="hh-empty" style="padding:40px;text-align:center;color:#555;font-size:13px;">История появится после первого месяца</div>';
      return;
    }

    content.innerHTML = keys.map(mk => {
      const [y,m] = mk.split('-').map(Number);
      const marks = allMonths[mk]||{};
      const progresses = habits.map(h => habProgress(h, marks, y, m-1));
      const overallPct = progresses.length ? Math.round(progresses.reduce((s,p)=>s+p.pct,0)/progresses.length) : 0;

      return `
        <div class="sec-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <button class="hab-hist-prev-mk" data-mk="${mk}" style="background:rgba(255,255,255,0.06);border:none;border-radius:7px;width:26px;height:26px;color:#9D9A92;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;"><i class="ti ti-chevron-left"></i></button>
              <span class="sec-card-title" style="margin:0;">${HAB_MONTHS_RU[m-1]} ${y} · <span style="color:#C8A84B;">${overallPct}%</span></span>
              <button class="hab-hist-next-mk" data-mk="${mk}" style="background:rgba(255,255,255,0.06);border:none;border-radius:7px;width:26px;height:26px;color:#9D9A92;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;"><i class="ti ti-chevron-right"></i></button>
            </div>
          </div>
          <div class="hh-list">
            <div class="hh-row hh-head"><span>Привычка</span><span>Выполнение</span><span class="r">%</span><span class="r">Итог</span></div>
            ${habits.map((h,i)=>{
              const p = progresses[i];
              const barColor = p.pct>=80?'#8FD17F':p.pct>=50?'#E0B873':'#FF6B63';
              return `<div class="hh-row">
                <span class="hh-name"><i class="ti ${habIco(h.icon)}"></i>${habEsc(h.name)}</span>
                <span class="hh-bar"><span style="width:${Math.min(100,p.pct)}%;background:${barColor};"></span></span>
                <span class="hh-pct r" style="color:${barColor}">${p.pct}%</span>
                <span class="hh-done r">${p.done}</span>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    }).join('');

    // Обработчики стрелок переименования месяца
    content.querySelectorAll('.hab-hist-prev-mk, .hab-hist-next-mk').forEach(btn => {
      btn.addEventListener('click', () => {
        const oldMk = btn.dataset.mk;
        const [oy, om] = oldMk.split('-').map(Number);
        const isPrev = btn.classList.contains('hab-hist-prev-mk');
        let nm = om + (isPrev ? -1 : 1);
        let ny = oy;
        if (nm < 1) { nm = 12; ny--; }
        if (nm > 12) { nm = 1; ny++; }
        const newMk = ny + '-' + String(nm).padStart(2, '0');

        const store = Store.get();
        const allMonths = store.habits?.months || {};

        // Проверяем что целевой ключ свободен
        if (allMonths[newMk]) {
          if (!confirm('В ' + HAB_MONTHS_RU[nm-1] + ' ' + ny + ' уже есть данные. Перезаписать?')) return;
        }

        // Перемещаем данные
        const data = allMonths[oldMk];
        delete allMonths[oldMk];
        allMonths[newMk] = data;

        Store.set('habits.months', allMonths);
        renderHistory();
      });
    });
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
    const COLORS = ['#60A5FA','#4ADE80','#34D399','#F59E0B','#F87171','#38BDF8','#C084FC','#4ADE80'];

    /* Сетка с подписями значений */
    let gridLines = '';
    for (let ring = 2; ring <= 10; ring += 2) {
      const r = (ring/10) * maxR;
      const pts = Array.from({length:n},(_,i) => {
        const a = i * angleStep - Math.PI/2;
        return `${cx + r*Math.cos(a)},${cy + r*Math.sin(a)}`;
      }).join(' ');
      const alpha = ring === 10 ? '40' : '20';
      gridLines += `<polygon points="${pts}" fill="none" stroke="#16A34A${alpha}" stroke-width="${ring===10?1.5:0.5}"/>`;
      /* Подпись значения на 12 часов */
      gridLines += `<text x="${cx}" y="${cy - r - 3}" text-anchor="middle" font-size="8" fill="#16A34A66" font-family="Montserrat,sans-serif">${ring}</text>`;
    }

    /* Оси */
    let axes = Array.from({length:n},(_,i) => {
      const a = i * angleStep - Math.PI/2;
      return `<line x1="${cx}" y1="${cy}" x2="${cx + maxR*Math.cos(a)}" y2="${cy + maxR*Math.sin(a)}" stroke="#16A34A30" stroke-width="1"/>`;
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

    const avg = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1).replace('.', ',') : '0';
    const avgColor = parseFloat(avg.replace(',', '.')) >= 7 ? '#4ADE80' : parseFloat(avg.replace(',', '.')) >= 5 ? '#F59E0B' : '#F87171';

    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
      <defs>
        <radialGradient id="wg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#16A34A" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#16A34A" stop-opacity="0.05"/>
        </radialGradient>
      </defs>
      ${gridLines}${axes}
      <polygon points="${dataPoints}" fill="url(#wg)" stroke="#16A34A" stroke-width="2.5" stroke-linejoin="round"/>
      ${dots}${labels}
      <circle cx="${cx}" cy="${cy}" r="28" fill="#1C1E24" stroke="#16A34A33" stroke-width="1"/>
      <text x="${cx}" y="${cy-5}" text-anchor="middle" font-size="20" font-weight="900" fill="${avgColor}" font-family="Montserrat,sans-serif">${avg}</text>
      <text x="${cx}" y="${cy+11}" text-anchor="middle" font-size="8" fill="#16A34A99" font-family="Montserrat,sans-serif">среднее</text>
    </svg>`;
  }

  function wheelAllData() {
    const all = Store.get().habits?.wheel || {};
    const out = {};
    Object.keys(all).forEach(k => { if (all[k] && Array.isArray(all[k].scores)) out[k] = all[k]; });
    return out;
  }
  function wheelMkLabel(mk) {
    const [y, m] = mk.split('-').map(Number);
    return HAB_MONTHS_RU[m-1] + ' ' + y;
  }

  /* Форма колеса. Месяц в селекте = месяц, в который СОХРАНИТСЯ оценка.
     Раньше сохранение шло в месяц, открытый на экране, а не выбранный в форме —
     поэтому август записывался как сентябрь. */
  function wheelOpenForm(monthKey, existing, onDone) {
    const spheres = WHEEL_SPHERES_DEFAULT;
    const originMk = existing ? monthKey : null;           /* откуда открыли запись */
    let targetMk = monthKey;
    const scores = ((existing && existing.scores) || new Array(spheres.length).fill(5)).slice();
    let comment = (existing && existing.comment) || '';
    const overlay = document.createElement('div');
    overlay.className = 'tr-modal-overlay modal-habits';

    const buildSliders = () => spheres.map((name,i) => `
        <div class="wheel-slider-row">
          <div class="wheel-slider-label">
            <span>${name}</span>
            <span class="wheel-slider-val" id="wsv-${i}">${scores[i]}</span>
          </div>
          <input type="range" class="wheel-slider" style="--p:${(scores[i] - 1) / 9 * 100}%" data-i="${i}" min="1" max="10" value="${scores[i]}">
        </div>`).join('');

    const now = new Date();
    let monthOpts = '';
    for (let i = 0; i < 24; i++) {
      let om = now.getMonth() - i, oy = now.getFullYear();
      while (om < 0) { om += 12; oy--; }
      const mk = habMonthKey(oy, om);
      monthOpts += `<option value="${mk}" ${mk === monthKey ? 'selected' : ''}>${HAB_MONTHS_RU[om]} ${oy}${wheelGetData(mk) ? ' •' : ''}</option>`;
    }

    overlay.innerHTML = `
      <div class="tr-modal" style="max-height:90vh;overflow-y:auto;">
        <p class="tr-modal-title" style="margin:0 0 10px;">Колесо жизни</p>
        <label class="wheel-month-pick">За какой месяц оценка
          <select id="wf-month-select">${monthOpts}</select>
        </label>
        <div id="wf-move-note" class="wheel-move-note" style="display:none;"></div>
        <div id="wheel-preview" style="display:flex;justify-content:center;margin:10px 0 12px;">${wheelDrawSVG(scores, 220, false)}</div>
        <div id="wheel-sliders">${buildSliders()}</div>
        <div class="tr-modal-row" style="margin-top:8px;">
          <label style="flex:1 1 100%">Комментарий к месяцу
            <input type="text" id="wheel-comment" placeholder="Как прошёл месяц?">
          </label>
        </div>
        <div class="tr-modal-actions">
          <button class="tr-modal-btn-secondary" id="wheel-cancel">Отмена</button>
          <button class="tr-modal-btn-primary" id="wheel-save">Сохранить</button>
        </div>
      </div>`;
    overlay.querySelector('#wheel-comment').value = comment;

    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
    overlay.querySelector('#wheel-cancel').addEventListener('click',()=>overlay.remove());

    function bindSliders() {
      overlay.querySelectorAll('.wheel-slider').forEach(sl => {
        sl.addEventListener('input', () => {
          const i = parseInt(sl.dataset.i);
          scores[i] = parseInt(sl.value);
          sl.style.setProperty('--p', (scores[i] - 1) / 9 * 100 + '%');
          overlay.querySelector('#wsv-'+i).textContent = scores[i];
          overlay.querySelector('#wheel-preview').innerHTML = wheelDrawSVG(scores, 220, false);
        });
      });
    }
    bindSliders();

    function updateMoveNote() {
      const note = overlay.querySelector('#wf-move-note');
      if (originMk && targetMk !== originMk) {
        const busy = !!wheelGetData(targetMk);
        note.style.display = '';
        note.innerHTML = busy
          ? `За ${wheelMkLabel(targetMk)} уже есть оценка, она будет заменена этой. Запись за ${wheelMkLabel(originMk)} будет удалена.`
          : `Оценка будет перенесена: ${wheelMkLabel(originMk)} → ${wheelMkLabel(targetMk)}.`;
      } else {
        note.style.display = 'none';
      }
    }

    overlay.querySelector('#wf-month-select').addEventListener('change', e => {
      targetMk = e.target.value;
      /* Новая оценка (не перенос): если в выбранном месяце уже есть данные — показываем их */
      if (!originMk) {
        const ex = wheelGetData(targetMk);
        const sc = (ex && ex.scores) || new Array(spheres.length).fill(5);
        for (let i=0;i<spheres.length;i++) scores[i] = sc[i];
        overlay.querySelector('#wheel-sliders').innerHTML = buildSliders();
        overlay.querySelector('#wheel-comment').value = (ex && ex.comment) || '';
        overlay.querySelector('#wheel-preview').innerHTML = wheelDrawSVG(scores, 220, false);
        bindSliders();
      }
      updateMoveNote();
    });

    overlay.querySelector('#wheel-save').addEventListener('click',()=>{
      const result = { scores: [...scores], comment: overlay.querySelector('#wheel-comment').value.trim(), savedAt: new Date().toISOString() };
      wheelSave(targetMk, result);
      if (originMk && originMk !== targetMk) Store.set(`habits.wheel.${originMk}`, null);
      overlay.remove();
      onDone && onDone(targetMk);
    });
  }

  /* Выбранный на экране месяц — по умолчанию текущий */
  const _wheelNow = new Date();
  let wheelSelMk = habMonthKey(_wheelNow.getFullYear(), _wheelNow.getMonth());
  { const pm = new Date(_wheelNow.getFullYear(), _wheelNow.getMonth() - 1, 1), pmk = habMonthKey(pm.getFullYear(), pm.getMonth());
    if (_wheelNow.getDate() <= 10 && !wheelGetData(pmk)) wheelSelMk = pmk; }

  function renderWheel() {
    const allWheels = wheelAllData();
    const keys = Object.keys(allWheels).sort((a,b)=>b.localeCompare(a));
    const nowMk = habMonthKey(_wheelNow.getFullYear(), _wheelNow.getMonth());
    const currentData = allWheels[wheelSelMk] || null;
    const isRealNow = wheelSelMk === nowMk;
    const [selY, selM] = wheelSelMk.split('-').map(Number);

    content.innerHTML = `
      <div class="wheel-screen">
        <div class="wheel-current-card">
          <div class="wheel-card-head">
            <div class="wheel-month-nav">
              <button class="wheel-nav-btn" id="wheel-prev" aria-label="Предыдущий месяц"><i class="ti ti-chevron-left"></i></button>
              <span class="wheel-month-name">${HAB_MONTHS_RU[selM-1]} ${selY}</span>
              <button class="wheel-nav-btn" id="wheel-next" aria-label="Следующий месяц" ${isRealNow?'disabled':''}><i class="ti ti-chevron-right"></i></button>
            </div>
            <button id="wheel-fill-now" class="wheel-fill-btn">
              ${currentData ? '<i class="ti ti-edit"></i> Изменить' : '<i class="ti ti-plus"></i> Заполнить'}
            </button>
          </div>
          ${currentData
            ? `<div style="display:flex;justify-content:center;">${wheelDrawSVG(currentData.scores, 260, false)}</div>
               ${currentData.comment ? `<div class="wheel-comment">"${habEsc(currentData.comment)}"</div>` : ''}`
            : `<div class="wheel-empty">За ${HAB_MONTHS_RU[selM-1].toLowerCase()} оценки нет. Оцени месяц по сферам жизни</div>`}
        </div>

        ${keys.filter(k=>k!==wheelSelMk).length>0 ? `
        <div class="wheel-history">
          <div class="wheel-history-title">История</div>
          ${keys.filter(k=>k!==wheelSelMk).map(mk=>{
            const d = allWheels[mk];
            const avg = d.scores.length ? (d.scores.reduce((a,b)=>a+b,0)/d.scores.length).toFixed(1).replace('.', ',') : '0';
            return `<div class="wheel-hist-row wheel-hist-open" data-mk="${mk}">
              <div>
                <div class="wheel-hist-month">${wheelMkLabel(mk)}</div>
                ${d.comment?`<div class="wheel-hist-comment">"${habEsc(d.comment)}"</div>`:''}
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <div class="wheel-hist-avg">${avg}</div>
                <i class="ti ti-chevron-right" style="color:#4ADE80;font-size:18px;font-weight:700;"></i>
              </div>
            </div>`;
          }).join('')}
        </div>` : ''}
      </div>`;

    const shift = (delta) => {
      let y = selY, m = selM - 1 + delta;
      while (m < 0) { m += 12; y--; }
      while (m > 11) { m -= 12; y++; }
      const mk = habMonthKey(y, m);
      if (mk > nowMk) return;
      wheelSelMk = mk; renderWheel();
    };
    document.getElementById('wheel-prev').addEventListener('click', () => shift(-1));
    document.getElementById('wheel-next').addEventListener('click', () => shift(1));

    document.getElementById('wheel-fill-now').addEventListener('click', () => {
      wheelOpenForm(wheelSelMk, wheelGetData(wheelSelMk), (savedMk) => { wheelSelMk = savedMk; renderWheel(); });
    });

    content.querySelectorAll('.wheel-hist-open').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const mk=btn.dataset.mk;
        const d=allWheels[mk];
        const overlay=document.createElement('div');
        overlay.className='tr-modal-overlay modal-habits';
        overlay.innerHTML=`
          <div class="tr-modal">
            <p class="tr-modal-title">${wheelMkLabel(mk)}</p>
            <div style="display:flex;justify-content:center;">${wheelDrawSVG(d.scores,260,false)}</div>
            ${d.comment?`<div class="wheel-comment" style="margin:12px 0;">"${habEsc(d.comment)}"</div>`:''}
            <div class="tr-modal-actions">
              <button class="tr-modal-btn-secondary" id="wh-edit">Изменить / перенести</button>
              <button class="tr-modal-btn-primary" id="wh-close">Закрыть</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
        overlay.querySelector('#wh-close').addEventListener('click',()=>overlay.remove());
        overlay.querySelector('#wh-edit').addEventListener('click',()=>{
          overlay.remove();
          wheelOpenForm(mk, d, () => renderWheel());
        });
      });
    });
  }

  /* Месяц закончился, а колесо за него не заполнено: напоминание первые 10 дней нового месяца */
  function renderRemind() {
    const box = document.getElementById('wh-remind'); if (!box) return;
    const n = new Date(), pm = new Date(n.getFullYear(), n.getMonth() - 1, 1);
    const pmk = habMonthKey(pm.getFullYear(), pm.getMonth());
    let dismissed = false; try { dismissed = localStorage.getItem('wh_dismiss_' + pmk) === '1'; } catch (e) {}
    const tabBtn = mount.querySelector('.hab-tab[data-tab="wheel"]');
    const need = n.getDate() <= 10 && !wheelGetData(pmk);
    if (tabBtn) tabBtn.classList.toggle('hab-tab-dot', need);
    if (!need || dismissed) { box.innerHTML = ''; return; }
    const name = HAB_MONTHS_RU[pm.getMonth()];
    box.innerHTML = `<div class="wh-remind"><i class="ti ti-calendar-check"></i><div><b>${name} закончился</b><span>Оцени месяц, это минута</span></div>
      <button class="wh-go" id="wh-go">Оценить</button><button class="wh-x" id="wh-x" aria-label="Скрыть"><i class="ti ti-x"></i></button></div>`;
    box.querySelector('#wh-go').onclick = () => wheelOpenForm(pmk, null, () => { renderRemind(); if (activeTab === 'wheel') { wheelSelMk = pmk; renderWheel(); } });
    box.querySelector('#wh-x').onclick = () => { try { localStorage.setItem('wh_dismiss_' + pmk, '1'); } catch (e) {} renderRemind(); };
  }

  function render() {
    renderRemind();
    window.__ui = Object.assign(window.__ui || {}, { hab: activeTab });
    mount.querySelectorAll('.hab-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
    if (activeTab==='grid') renderGrid();
    else if (activeTab==='wheel') renderWheel();
    else renderHistory();
  }

  render();
};
