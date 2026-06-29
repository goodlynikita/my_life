/* ============================================================
   TRAINING SCREEN
   Real editable plans backed by Store. Each plan is exactly
   8 weeks. Progress % is always computed against week 1 of the
   same exercise within the active plan (tonnage-based).
   ============================================================ */

window.Screens = window.Screens || {};

const DOW_NAMES = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

function trFormatDate(d) {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function trAddDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function trUid() {
  return Math.random().toString(36).slice(2, 9);
}

const TRAINING_TYPES = [
  { name: 'Зал', color: '#A8C97F' },
  { name: 'Зал ТРЕН', color: '#A8C97F' },
  { name: 'Теннис', color: '#7FB3D9' },
  { name: 'IRONSTAR', color: '#3D6FB4' },
  { name: 'Бокс', color: '#D98A85' },
  { name: '10k', color: '#B6A4D9' },
  { name: 'Лыжи', color: '#3D6FB4' },
  { name: 'Отдых', color: '#8A8985' }
];

const MUSCLE_GROUPS = [
  { name: 'Грудь', color: '#A8C97F' },
  { name: 'Ноги', color: '#E0B873' },
  { name: 'Спина', color: '#7FB3D9' },
  { name: 'Руки + плечи', color: '#9C9A95' },
  { name: 'FULL BODY', color: '#A8C97F' },
  { name: 'Бег', color: '#3D6FB4' },
  { name: 'Плавание', color: '#3D6FB4' },
  { name: 'Велосипед', color: '#3D6FB4' },
  { name: 'Кардио', color: '#D9A98A' },
  { name: 'Кардио + растяжка', color: '#D9A98A' },
  { name: 'Горные лыжи', color: '#B6A4D9' },
  { name: 'Отдых', color: '#8A8985' }
];

function trBadgeColor(list, name) {
  const found = list.find(x => x.name === name);
  return found ? found.color : '#8A8985';
}

function trBuildSelect(id, list, current) {
  const options = list.map(item =>
    `<option value="${item.name}" ${item.name === current ? 'selected' : ''}>${item.name}</option>`
  ).join('');
  return `<select id="${id}" class="tr-color-select">${options}</select>`;
}

function trBuildEmptyPlan(number, startDate) {
  const weeks = [];
  let cursor = new Date(startDate);
  for (let w = 0; w < 8; w++) {
    const weekStart = trAddDays(cursor, w * 7);
    const weekEnd = trAddDays(weekStart, 6);
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = trAddDays(weekStart, d);
      days.push({
        date: trFormatDate(date),
        dow: DOW_NAMES[d],
        type: null,
        group: null,
        exercises: []
      });
    }
    weeks.push({
      weekNum: w + 1,
      range: `${trFormatDate(weekStart)} – ${trFormatDate(weekEnd)}`,
      days
    });
  }
  return {
    id: trUid(),
    number,
    startDate: startDate.toISOString(),
    status: 'active',
    weeks
  };
}

function trGetPlans() {
  return Store.get().training.plans || [];
}

function trSavePlans(plans) {
  Store.set('training.plans', plans);
}

function trActivePlan() {
  const plans = trGetPlans();
  return plans.find(p => p.status === 'active') || plans[plans.length - 1] || null;
}

function trEnsureSeedPlan() {
  const plans = trGetPlans();
  if (plans.length === 0) {
    const seeded = trBuildEmptyPlan(1, new Date());
    trSavePlans([seeded]);
    return seeded.id;
  }
  return trActivePlan() ? trActivePlan().id : plans[0].id;
}

function trCreateNextPlan() {
  const plans = trGetPlans();
  plans.forEach(p => { if (p.status === 'active') p.status = 'archived'; });
  const maxNumber = plans.reduce((m, p) => Math.max(m, p.number), 0);
  const newPlan = trBuildEmptyPlan(maxNumber + 1, new Date());
  plans.push(newPlan);
  trSavePlans(plans);
  return newPlan.id;
}

function trTonnage(ex) {
  return ex.sets * ex.reps * ex.weight;
}

function trCalcProgress(plan, weekIndex, exerciseName) {
  const week1 = plan.weeks[0];
  let baseline = null;
  for (const day of week1.days) {
    const found = day.exercises.find(e => e.name === exerciseName);
    if (found) { baseline = trTonnage(found); break; }
  }
  const currentWeek = plan.weeks[weekIndex];
  let current = null;
  for (const day of currentWeek.days) {
    const found = day.exercises.find(e => e.name === exerciseName);
    if (found) { current = trTonnage(found); break; }
  }
  if (baseline === null || current === null) return { pct: 0, dir: 'flat' };
  if (baseline === 0) {
    if (current === 0) return { pct: 0, dir: 'flat' };
    return { pct: 100, dir: 'up' };
  }
  const pct = Math.round(((current - baseline) / baseline) * 100);
  return { pct, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
}

function trRenderExercise(ex, plan, weekIndex, dayIdx, exIdx) {
  const progress = trCalcProgress(plan, weekIndex, ex.name);
  const tonnage = trTonnage(ex);
  const barPct = Math.min(100, Math.max(6, 50 + progress.pct / 2));
  const arrow = progress.dir === 'up' ? '▲' : progress.dir === 'down' ? '▼' : '–';
  const sign = progress.pct > 0 ? '+' : '';
  return `
    <button class="tr-exercise" data-week="${weekIndex}" data-day="${dayIdx}" data-ex="${exIdx}">
      <div class="tr-ex-top">
        <div class="tr-ex-name">${ex.name}</div>
        <div class="tr-ex-stats">
          <span class="tr-ex-weight num">${tonnage.toLocaleString('ru-RU')} кг</span>
          <span class="tr-progress ${progress.dir}">${arrow} ${sign}${progress.pct}%</span>
        </div>
      </div>
      <div class="tr-ex-bottom">
        <div class="tr-ex-meta num">${ex.sets} × ${ex.reps} × ${ex.weight} кг</div>
      </div>
      <div class="tr-progress-bar-track"><div class="tr-progress-bar-fill" data-fill="${barPct}"></div></div>
    </button>`;
}

function trRenderDay(day, plan, weekIndex, dayIdx) {
  const hasSession = day.type && day.group;
  const exercisesHtml = day.exercises.map((ex, exIdx) => trRenderExercise(ex, plan, weekIndex, dayIdx, exIdx)).join('');
  const typeColor = hasSession ? trBadgeColor(TRAINING_TYPES, day.type) : null;
  const groupColor = hasSession ? trBadgeColor(MUSCLE_GROUPS, day.group) : null;

  return `
    <div class="tr-day">
      <div class="tr-day-head">
        <span class="tr-day-date">${day.date} ${day.dow}</span>
        ${hasSession
          ? `<span class="tr-day-tag has-session" style="background:${typeColor}22; color:${typeColor}; border-color:${typeColor}55;">${day.type}</span>
             <span class="tr-day-tag has-session" style="background:${groupColor}22; color:${groupColor}; border-color:${groupColor}55;">${day.group}</span>`
          : `<span class="tr-day-tag">не задано</span>`}
        <button class="tr-day-add" data-week="${weekIndex}" data-day="${dayIdx}" aria-label="Добавить">
          <i class="ti ti-plus"></i>
        </button>
      </div>
      ${exercisesHtml}
      ${day.exercises.length === 0 ? '<div class="tr-day-empty">Нет упражнений</div>' : ''}
    </div>`;
}

function trRenderWeek(week, plan, weekIndex) {
  const days = week.days.map((d, dayIdx) => trRenderDay(d, plan, weekIndex, dayIdx)).join('');
  return `
    <div class="tr-week">
      <div class="tr-week-head">
        <span class="tr-week-label">Неделя ${week.weekNum}</span>
        <span class="tr-week-range">${week.range}</span>
      </div>
      ${days}
    </div>`;
}

function trRenderPlanTab(plan) {
  return plan.weeks.map((w, i) => trRenderWeek(w, plan, i)).join('');
}

function trAnimateBars(scope) {
  requestAnimationFrame(() => {
    scope.querySelectorAll('.tr-progress-bar-fill').forEach(el => {
      const pct = el.dataset.fill;
      requestAnimationFrame(() => { el.style.width = pct + '%'; });
    });
  });
}

function trOpenExerciseModal(plan, weekIndex, dayIdx, exIdx, onSave) {
  const ex = plan.weeks[weekIndex].days[dayIdx].exercises[exIdx];
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';
  overlay.innerHTML = `
    <div class="tr-modal">
      <p class="tr-modal-title">${ex.name}</p>
      <div class="tr-modal-row">
        <label>Подходы<input type="number" id="m-sets" value="${ex.sets}" inputmode="numeric"></label>
        <label>Повторы<input type="number" id="m-reps" value="${ex.reps}" inputmode="numeric"></label>
        <label>Вес, кг<input type="number" id="m-weight" value="${ex.weight}" inputmode="numeric"></label>
      </div>
      <div class="tr-modal-actions">
        <button class="tr-modal-btn-secondary" id="m-delete">Удалить</button>
        <button class="tr-modal-btn-primary" id="m-save">Сохранить</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#m-save').addEventListener('click', () => {
    ex.sets = parseInt(overlay.querySelector('#m-sets').value, 10) || 0;
    ex.reps = parseInt(overlay.querySelector('#m-reps').value, 10) || 0;
    ex.weight = parseFloat(overlay.querySelector('#m-weight').value) || 0;
    overlay.remove();
    onSave();
  });
  overlay.querySelector('#m-delete').addEventListener('click', () => {
    plan.weeks[weekIndex].days[dayIdx].exercises.splice(exIdx, 1);
    overlay.remove();
    onSave();
  });
}

function trOpenAddModal(plan, weekIndex, dayIdx, onSave) {
  const day = plan.weeks[weekIndex].days[dayIdx];
  const needsSetup = !day.type || !day.group;
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';
  overlay.innerHTML = `
    <div class="tr-modal">
      <p class="tr-modal-title">${day.date} ${day.dow}</p>
      ${needsSetup ? `
        <div class="tr-modal-row">
          <label>Тип${trBuildSelect('m-type', TRAINING_TYPES, day.type)}</label>
          <label>Группа${trBuildSelect('m-group', MUSCLE_GROUPS, day.group)}</label>
        </div>
      ` : ''}
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Упражнение<input type="text" id="m-name" placeholder="Жим штанги"></label>
      </div>
      <div class="tr-modal-row">
        <label>Подходы<input type="number" id="m-sets" value="3" inputmode="numeric"></label>
        <label>Повторы<input type="number" id="m-reps" value="10" inputmode="numeric"></label>
        <label>Вес, кг<input type="number" id="m-weight" value="0" inputmode="numeric"></label>
      </div>
      <div class="tr-modal-actions">
        <button class="tr-modal-btn-secondary" id="m-cancel">Отмена</button>
        <button class="tr-modal-btn-primary" id="m-save">Добавить</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#m-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#m-save').addEventListener('click', () => {
    const name = overlay.querySelector('#m-name').value.trim();
    if (!name) return;
    if (needsSetup) {
      day.type = overlay.querySelector('#m-type').value;
      day.group = overlay.querySelector('#m-group').value;
    }
    day.exercises.push({
      name,
      sets: parseInt(overlay.querySelector('#m-sets').value, 10) || 0,
      reps: parseInt(overlay.querySelector('#m-reps').value, 10) || 0,
      weight: parseFloat(overlay.querySelector('#m-weight').value) || 0
    });
    overlay.remove();
    onSave();
  });
}

window.Screens.training = function (mount) {
  const role = Auth.role();
  const activeId = trEnsureSeedPlan();
  let currentPlanId = activeId;

  function getPlan() {
    return trGetPlans().find(p => p.id === currentPlanId);
  }

  mount.innerHTML = `
    <div class="theme-dark">
      <div class="tr-header">
        <div style="display:flex; align-items:center; gap:10px;">
          ${role === 'owner' ? '<button class="tr-back" id="tr-back"><i class="ti ti-arrow-left"></i></button>' : ''}
          <p class="tr-title">Тренировки</p>
        </div>
        ${role === 'coach' ? '<span class="tr-role-badge">Тренер · просмотр</span>' : `<button class="tr-back" id="tr-logout"><i class="ti ti-logout"></i></button>`}
      </div>
      <div class="tr-plan-bar">
        <select class="tr-plan-select" id="tr-plan-select"></select>
        ${role === 'owner' ? '<button class="tr-plan-new" id="tr-new-plan"><i class="ti ti-plus"></i> Новый план</button>' : ''}
      </div>
      <div class="tr-tabs">
        <button class="tr-tab active" data-tab="plan">План</button>
        <button class="tr-tab" data-tab="summary">Итоги 8 недель</button>
        <button class="tr-tab" data-tab="measure">Замеры</button>
      </div>
      <div class="tr-body" id="tr-content"></div>
    </div>
  `;

  const content = document.getElementById('tr-content');
  const planSelect = document.getElementById('tr-plan-select');

  function populatePlanSelect() {
    const plans = trGetPlans().slice().sort((a, b) => b.number - a.number);
    planSelect.innerHTML = plans.map(p =>
      `<option value="${p.id}" ${p.id === currentPlanId ? 'selected' : ''}>План №${p.number}${p.status === 'archived' ? ' · архив' : ''}</option>`
    ).join('');
  }

  function bindPlanEvents(plan) {
    content.querySelectorAll('.tr-exercise').forEach(btn => {
      if (role === 'coach') { btn.style.cursor = 'default'; return; }
      btn.addEventListener('click', () => {
        const w = parseInt(btn.dataset.week, 10);
        const d = parseInt(btn.dataset.day, 10);
        const ex = parseInt(btn.dataset.ex, 10);
        trOpenExerciseModal(plan, w, d, ex, () => {
          trSavePlans(trGetPlans().map(p => p.id === plan.id ? plan : p));
          renderTab('plan');
        });
      });
    });
    content.querySelectorAll('.tr-day-add').forEach(btn => {
      if (role === 'coach') { btn.style.display = 'none'; return; }
      btn.addEventListener('click', () => {
        const w = parseInt(btn.dataset.week, 10);
        const d = parseInt(btn.dataset.day, 10);
        trOpenAddModal(plan, w, d, () => {
          trSavePlans(trGetPlans().map(p => p.id === plan.id ? plan : p));
          renderTab('plan');
        });
      });
    });
  }

  function renderTab(tab) {
    const plan = getPlan();
    if (tab === 'plan') {
      content.innerHTML = trRenderPlanTab(plan);
      trAnimateBars(content);
      bindPlanEvents(plan);
    } else if (tab === 'summary') {
      content.innerHTML = trRenderSummary(plan);
    } else if (tab === 'measure') {
      content.innerHTML = trRenderMeasurements();
      const addBtn = document.getElementById('tr-add-measure');
      if (addBtn) {
        if (role === 'coach') {
          addBtn.style.display = 'none';
        } else {
          addBtn.addEventListener('click', () => trOpenMeasureModal(() => renderTab('measure')));
        }
      }
    }
  }

  populatePlanSelect();
  if (role === 'coach') {
    planSelect.disabled = true;
    const newBtn = document.getElementById('tr-new-plan');
    if (newBtn) newBtn.remove();
  }

  planSelect.addEventListener('change', () => {
    currentPlanId = planSelect.value;
    mount.querySelectorAll('.tr-tab').forEach(t => t.classList.remove('active'));
    mount.querySelector('[data-tab="plan"]').classList.add('active');
    renderTab('plan');
  });

  const newPlanBtn = document.getElementById('tr-new-plan');
  if (newPlanBtn) {
    newPlanBtn.addEventListener('click', () => {
      if (!confirm('Текущий план переходит в архив, начинаем новый план на 8 недель. Продолжить?')) return;
      currentPlanId = trCreateNextPlan();
      populatePlanSelect();
      renderTab('plan');
    });
  }

  mount.querySelectorAll('.tr-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      mount.querySelectorAll('.tr-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderTab(tab.dataset.tab);
    });
  });

  const backBtn = document.getElementById('tr-back');
  if (backBtn) backBtn.addEventListener('click', () => Router.go('/home'));
  const logoutBtn = document.getElementById('tr-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', () => { Auth.logout(); Router.go('/login'); });

  renderTab('plan');
};

function trLastFilledWeekIndex(plan) {
  for (let i = plan.weeks.length - 1; i >= 0; i--) {
    const hasData = plan.weeks[i].days.some(d => d.exercises.length > 0);
    if (hasData) return i;
  }
  return 0;
}

function trRenderSummary(plan) {
  const weekIndex = trLastFilledWeekIndex(plan);
  const groups = {};
  plan.weeks[weekIndex].days.forEach(day => {
    if (!day.group) return;
    if (!groups[day.group]) groups[day.group] = [];
    day.exercises.forEach(ex => {
      const progress = trCalcProgress(plan, weekIndex, ex.name);
      groups[day.group].push({ ex, progress });
    });
  });

  const groupNames = Object.keys(groups);
  if (groupNames.length === 0) {
    return `<div class="tr-empty-state"><i class="ti ti-chart-bar"></i>Сводка появится здесь после заполнения плана.</div>`;
  }

  return groupNames.map(name => {
    const rows = groups[name].map(({ ex, progress }) => {
      const arrow = progress.dir === 'up' ? '▲' : progress.dir === 'down' ? '▼' : '–';
      const sign = progress.pct > 0 ? '+' : '';
      return `
        <div class="tr-exercise" style="cursor:default">
          <div class="tr-ex-top">
            <div class="tr-ex-name">${ex.name}</div>
            <div class="tr-ex-stats">
              <span class="tr-ex-weight num">${trTonnage(ex).toLocaleString('ru-RU')} кг</span>
              <span class="tr-progress ${progress.dir}">${arrow} ${sign}${progress.pct}%</span>
            </div>
          </div>
          <div class="tr-ex-bottom"><div class="tr-ex-meta num">${ex.sets} × ${ex.reps} × ${ex.weight} кг</div></div>
        </div>`;
    }).join('');
    return `
      <div class="tr-group-card">
        <div class="tr-group-title">${name} <span class="tr-group-range">· неделя ${weekIndex + 1}</span></div>
        <div class="tr-day">${rows}</div>
      </div>`;
  }).join('');
}

const MEASURE_FIELDS = [
  'Вес', 'Грудь', 'Талия (по пупку)', 'Бедро',
  'Нога (напряж.) левая', 'Нога (напряж.) правая', 'Бицепс',
  '% жира', 'Мышечная масса', 'Оценка InBody'
];

function trRenderMeasurements() {
  const list = Store.get().training.measurements || [];
  const empty = list.length === 0
    ? `<div class="tr-empty-state"><i class="ti ti-ruler-2"></i>Пока нет замеров. Добавь первый.</div>`
    : list.slice().reverse().map(m => `
      <div class="tr-measure-card">
        <div class="tr-measure-date">${m.date}</div>
        <div class="tr-measure-grid">
          ${MEASURE_FIELDS.filter(f => m.values[f] !== undefined && m.values[f] !== '').map(f => `
            <div class="tr-measure-item"><span>${f}</span><span>${m.values[f]}</span></div>
          `).join('')}
        </div>
      </div>`).join('');
  return `${empty}<button class="tr-fab" id="tr-add-measure" aria-label="Добавить замер"><i class="ti ti-plus"></i></button>`;
}

function trOpenMeasureModal(onSave) {
  const today = new Date();
  const dateStr = `${trFormatDate(today)}.${today.getFullYear()}`;
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';
  overlay.innerHTML = `
    <div class="tr-modal" style="max-height:80vh; overflow-y:auto;">
      <p class="tr-modal-title">Новый замер · ${dateStr}</p>
      ${MEASURE_FIELDS.map(f => `
        <div class="tr-modal-row">
          <label style="flex:1 1 100%">${f}<input type="text" data-field="${f}" inputmode="decimal" placeholder="—"></label>
        </div>
      `).join('')}
      <div class="tr-modal-actions">
        <button class="tr-modal-btn-secondary" id="m-cancel">Отмена</button>
        <button class="tr-modal-btn-primary" id="m-save">Сохранить</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#m-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#m-save').addEventListener('click', () => {
    const values = {};
    overlay.querySelectorAll('input[data-field]').forEach(input => {
      if (input.value.trim() !== '') values[input.dataset.field] = input.value.trim();
    });
    const list = Store.get().training.measurements || [];
    list.push({ date: dateStr, values });
    Store.set('training.measurements', list);
    overlay.remove();
    onSave();
  });
}
