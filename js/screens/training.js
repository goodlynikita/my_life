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
  { name: 'Кардио', color: '#3D6FB4' },
  { name: 'Бокс', color: '#D98A85' },
  { name: '10k', color: '#B6A4D9' },
  { name: 'Лыжи', color: '#3D6FB4' },
  { name: 'Отдых', color: '#8A8985' }
];

const MUSCLE_GROUPS = [
  { name: 'Грудь', color: '#A8C97F' },
  { name: 'Спина', color: '#7FB3D9' },
  { name: 'Руки', color: '#9C9A95' },
  { name: 'Ноги', color: '#E0B873' },
  { name: 'Плечи', color: '#B6A4D9' },
  { name: 'FULL BODY', color: '#2E7FD4' }
];

const CARDIO_DIRECTIONS = ['Бег', 'Велосипед', 'Плавание'];

function trIsGymType(typeName) {
  return typeName === 'Зал' || typeName === 'Зал ТРЕН';
}

function trIsRestType(typeName) {
  return typeName === 'Отдых';
}

function trIsTimeCalorieType(typeName) {
  return typeName === 'Теннис' || typeName === 'Бокс' || typeName === 'Лыжи';
}

function trIsCardioType(typeName) {
  return typeName === 'Кардио';
}

function trIsStepsType(typeName) {
  return typeName === '10k';
}

const MUSCLE_BLOCK_EXERCISES = {
  'Грудь': ['Жим гантели', 'Жим штанга', 'Жим гантели наклон', 'Жим штанга наклон', 'Кроссовер сверху', 'Кроссовер снизу', 'Разведения', 'Бабочка', 'Брусья'],
  'Спина': ['Пуловер', 'Тяга штанги', 'Тяга верхнего блока', 'Тяга нижнего блока', 'Гиперэкстензия', 'Тяга гантелей', 'Подтягивания'],
  'Руки': ['Подъём штанги', 'Французский жим', 'Молотки гантель', 'Подъём гантель', 'Разгибания канаты', 'Разгибания из-за головы', 'Бицепс наклон', 'Молотки стоя'],
  'Ноги': ['Присяд штанга', 'Присяд гакк', 'Жим ногами', 'Пресс', 'Разгибания', 'Сгибания'],
  'Плечи': ['Махи', 'Жим', 'Разведения']
};

function trExercisesForGroups(groupNames) {
  const set = new Set();
  const expanded = groupNames.includes('FULL BODY') ? Object.keys(MUSCLE_BLOCK_EXERCISES) : groupNames;
  expanded.forEach(g => {
    (MUSCLE_BLOCK_EXERCISES[g] || []).forEach(name => set.add(name));
  });
  return Array.from(set);
}

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
        groups: [],
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
    nutrition: { protein: 0, fat: 0, carbs: 0, totalKcal: 0 },
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

function trPace(ex) {
  if (!ex.distance || ex.distance === 0) return null;
  const paceMin = ex.duration / ex.distance;
  const min = Math.floor(paceMin);
  const sec = Math.round((paceMin - min) * 60);
  return `${min}:${String(sec).padStart(2, '0')} /км`;
}

function trMetricFor(ex) {
  if (ex.kind === 'cardio') return ex.distance;
  if (ex.kind === 'time_calorie') return ex.calories;
  if (ex.kind === 'steps') return ex.steps;
  return trTonnage(ex);
}

function trCalcProgress(plan, weekIndex, exerciseName) {
  const week1 = plan.weeks[0];
  let baseline = null;
  for (const day of week1.days) {
    const found = day.exercises.find(e => e.name === exerciseName);
    if (found) { baseline = trMetricFor(found); break; }
  }
  const currentWeek = plan.weeks[weekIndex];
  let current = null;
  for (const day of currentWeek.days) {
    const found = day.exercises.find(e => e.name === exerciseName);
    if (found) { current = trMetricFor(found); break; }
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
  const barPct = Math.min(100, Math.max(6, 50 + progress.pct / 2));
  const arrow = progress.dir === 'up' ? '▲' : progress.dir === 'down' ? '▼' : '–';
  const sign = progress.pct > 0 ? '+' : '';
  const progressBadge = `<span class="tr-progress ${progress.dir}">${arrow} ${sign}${progress.pct}%</span>`;
  const bar = `<div class="tr-progress-bar-track"><div class="tr-progress-bar-fill" data-fill="${barPct}"></div></div>`;
  const wrap = (headline, meta) => `
    <button class="tr-exercise" data-week="${weekIndex}" data-day="${dayIdx}" data-ex="${exIdx}">
      <div class="tr-ex-top">
        <div class="tr-ex-name">${ex.name}</div>
        <div class="tr-ex-stats">
          <span class="tr-ex-weight num">${headline}</span>
          ${progressBadge}
        </div>
      </div>
      <div class="tr-ex-bottom"><div class="tr-ex-meta num">${meta}</div></div>
      ${bar}
    </button>`;

  if (ex.kind === 'cardio') {
    const pace = trPace(ex);
    return wrap(`${ex.distance} км`, `${ex.duration} мин${pace ? ' · ' + pace : ''}`);
  }
  if (ex.kind === 'time_calorie') {
    return wrap(`${ex.calories} ккал`, `${ex.duration} мин`);
  }
  if (ex.kind === 'steps') {
    return wrap(`${ex.steps.toLocaleString('ru-RU')} шагов`, '');
  }
  const tonnage = trTonnage(ex);
  return wrap(`${tonnage.toLocaleString('ru-RU')} кг`, `${ex.sets} × ${ex.reps} × ${ex.weight} кг`);
}

function trRenderDay(day, plan, weekIndex, dayIdx) {
  const hasSession = !!day.type;
  const isRest = day.type === 'Отдых';
  const exercisesHtml = day.exercises.map((ex, exIdx) => trRenderExercise(ex, plan, weekIndex, dayIdx, exIdx)).join('');
  const typeColor = hasSession ? trBadgeColor(TRAINING_TYPES, day.type) : null;
  const groupTags = (day.groups || []).map(g => {
    const c = trBadgeColor(MUSCLE_GROUPS, g);
    return `<span class="tr-day-tag has-session" style="background:${c}22; color:${c}; border-color:${c}55;">${g}</span>`;
  }).join('');

  const actionBtn = isRest
    ? `<button class="tr-day-add tr-day-clear" data-week="${weekIndex}" data-day="${dayIdx}" aria-label="Удалить отдых" title="Сбросить день"><i class="ti ti-trash"></i></button>`
    : `<button class="tr-day-add" data-week="${weekIndex}" data-day="${dayIdx}" aria-label="Добавить"><i class="ti ti-plus"></i></button>`;

  return `
    <div class="tr-day">
      <div class="tr-day-head">
        <span class="tr-day-date">${day.date} ${day.dow}</span>
        ${hasSession
          ? `<span class="tr-day-tag has-session" style="background:${typeColor}22; color:${typeColor}; border-color:${typeColor}55;">${day.type}</span>${groupTags}`
          : `<span class="tr-day-tag">не задано</span>`}
        ${actionBtn}
      </div>
      ${isRest ? '<div class="tr-day-empty">День отдыха</div>' : exercisesHtml}
      ${(!isRest && day.exercises.length === 0) ? '<div class="tr-day-empty">Нет упражнений</div>' : ''}
    </div>`;
}

function trRenderWeek(week, plan, weekIndex, collapsed) {
  const days = week.days.map((d, dayIdx) => trRenderDay(d, plan, weekIndex, dayIdx)).join('');
  return `
    <div class="tr-week">
      <button class="tr-week-head tr-week-toggle" data-week="${weekIndex}">
        <i class="ti ti-chevron-${collapsed ? 'right' : 'down'}"></i>
        <span class="tr-week-label">Неделя ${week.weekNum}</span>
        <span class="tr-week-range">${week.range}</span>
      </button>
      <div class="tr-week-body" style="${collapsed ? 'display:none;' : ''}">${days}</div>
    </div>`;
}

function trRenderPlanTab(plan, collapsedWeeks) {
  return plan.weeks.map((w, i) => trRenderWeek(w, plan, i, (collapsedWeeks || []).includes(i))).join('');
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

  let fieldsHtml = '';
  if (ex.kind === 'cardio') {
    fieldsHtml = `
      <div class="tr-modal-row">
        <label>Дистанция, км<input type="number" id="m-distance" value="${ex.distance}" inputmode="decimal" step="0.1"></label>
        <label>Время, мин<input type="number" id="m-duration" value="${ex.duration}" inputmode="numeric"></label>
      </div>`;
  } else if (ex.kind === 'time_calorie') {
    fieldsHtml = `
      <div class="tr-modal-row">
        <label>Время, мин<input type="number" id="m-duration" value="${ex.duration}" inputmode="numeric"></label>
        <label>Калории<input type="number" id="m-calories" value="${ex.calories}" inputmode="numeric"></label>
      </div>`;
  } else if (ex.kind === 'steps') {
    fieldsHtml = `
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Количество шагов<input type="number" id="m-steps" value="${ex.steps}" inputmode="numeric"></label>
      </div>`;
  } else {
    fieldsHtml = `
      <div class="tr-modal-row">
        <label>Подходы<input type="number" id="m-sets" value="${ex.sets}" inputmode="numeric"></label>
        <label>Повторы<input type="number" id="m-reps" value="${ex.reps}" inputmode="numeric"></label>
        <label>Вес, кг<input type="number" id="m-weight" value="${ex.weight}" inputmode="numeric"></label>
      </div>`;
  }

  overlay.innerHTML = `
    <div class="tr-modal">
      <p class="tr-modal-title">${ex.name}</p>
      ${fieldsHtml}
      <div class="tr-modal-actions">
        <button class="tr-modal-btn-secondary" id="m-delete">Удалить</button>
        <button class="tr-modal-btn-primary" id="m-save">Сохранить</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#m-save').addEventListener('click', () => {
    if (ex.kind === 'cardio') {
      ex.distance = parseFloat(overlay.querySelector('#m-distance').value) || 0;
      ex.duration = parseFloat(overlay.querySelector('#m-duration').value) || 0;
    } else if (ex.kind === 'time_calorie') {
      ex.duration = parseFloat(overlay.querySelector('#m-duration').value) || 0;
      ex.calories = parseFloat(overlay.querySelector('#m-calories').value) || 0;
    } else if (ex.kind === 'steps') {
      ex.steps = parseInt(overlay.querySelector('#m-steps').value, 10) || 0;
    } else {
      ex.sets = parseInt(overlay.querySelector('#m-sets').value, 10) || 0;
      ex.reps = parseInt(overlay.querySelector('#m-reps').value, 10) || 0;
      ex.weight = parseFloat(overlay.querySelector('#m-weight').value) || 0;
    }
    overlay.remove();
    onSave();
  });
  overlay.querySelector('#m-delete').addEventListener('click', () => {
    plan.weeks[weekIndex].days[dayIdx].exercises.splice(exIdx, 1);
    overlay.remove();
    onSave();
  });
}

function trBuildExerciseSelect(selectedGroups) {
  const list = trExercisesForGroups(selectedGroups);
  const customOption = `<option value="__custom__">— своё название —</option>`;
  if (list.length === 0) {
    return `<select id="m-name"><option value="">— выбери группу мышц —</option>${customOption}</select>`;
  }
  const options = list.map(name => `<option value="${name}">${name}</option>`).join('');
  return `<select id="m-name" class="tr-color-select">${options}${customOption}</select>`;
}

function trBuildGroupCheckboxes(selected) {
  return MUSCLE_GROUPS.map(g => `
    <label style="flex:0 0 auto; display:flex; align-items:center; gap:5px; font-size:12.5px; color:var(--bone-soft); flex-direction:row;">
      <input type="checkbox" class="m-group-cb" value="${g.name}" ${selected.includes(g.name) ? 'checked' : ''} style="width:auto;">
      ${g.name}
    </label>
  `).join('');
}

function trBuildFormFields(typeName, selectedGroups) {
  if (trIsRestType(typeName)) {
    return `<p style="font-size:13px; color:var(--bone-faint); margin:4px 0 0;">День отмечен как отдых. Упражнения не нужны.</p>`;
  }
  if (trIsGymType(typeName)) {
    return `
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Группы мышц
          <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:6px;">${trBuildGroupCheckboxes(selectedGroups)}</div>
        </label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Упражнение<span id="m-name-wrap">${trBuildExerciseSelect(selectedGroups)}</span></label>
      </div>
      <div class="tr-modal-row">
        <label>Подходы<input type="number" id="m-sets" placeholder="—" inputmode="numeric"></label>
        <label>Повторы<input type="number" id="m-reps" placeholder="—" inputmode="numeric"></label>
        <label>Вес, кг<input type="number" id="m-weight" placeholder="—" inputmode="numeric"></label>
      </div>`;
  }
  if (trIsCardioType(typeName)) {
    return `
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Направление${trBuildSelect('m-cardio-dir', CARDIO_DIRECTIONS.map(d => ({ name: d })), CARDIO_DIRECTIONS[0])}</label>
      </div>
      <div class="tr-modal-row">
        <label>Дистанция, км<input type="number" id="m-distance" placeholder="—" inputmode="decimal" step="0.1"></label>
        <label>Время, мин<input type="number" id="m-duration" placeholder="—" inputmode="numeric"></label>
      </div>`;
  }
  if (trIsTimeCalorieType(typeName)) {
    return `
      <div class="tr-modal-row">
        <label>Время, мин<input type="number" id="m-duration" placeholder="—" inputmode="numeric"></label>
        <label>Калории<input type="number" id="m-calories" placeholder="—" inputmode="numeric"></label>
      </div>`;
  }
  if (trIsStepsType(typeName)) {
    return `
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Количество шагов<input type="number" id="m-steps" placeholder="—" inputmode="numeric"></label>
      </div>`;
  }
  return '';
}

function trOpenAddModal(plan, weekIndex, dayIdx, onSave) {
  const day = plan.weeks[weekIndex].days[dayIdx];
  const needsSetup = !day.type;
  const initialType = day.type || TRAINING_TYPES[0].name;
  const initialGroups = day.groups || [];
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';
  overlay.innerHTML = `
    <div class="tr-modal">
      <p class="tr-modal-title">${day.date} ${day.dow}</p>
      ${needsSetup ? `
        <div class="tr-modal-row">
          <label style="flex:1 1 100%">Тип${trBuildSelect('m-type', TRAINING_TYPES, initialType)}</label>
        </div>
      ` : ''}
      <div id="m-fields-wrap">${trBuildFormFields(initialType, initialGroups)}</div>
      <div class="tr-modal-actions">
        <button class="tr-modal-btn-secondary" id="m-cancel">Отмена</button>
        <button class="tr-modal-btn-primary" id="m-save">${trIsRestType(initialType) ? 'Отметить отдых' : 'Добавить'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#m-cancel').addEventListener('click', () => overlay.remove());

  function currentType() {
    const sel = overlay.querySelector('#m-type');
    return sel ? sel.value : day.type;
  }

  function selectedGroupsNow() {
    return Array.from(overlay.querySelectorAll('.m-group-cb:checked')).map(cb => cb.value);
  }

  function refreshFields() {
    const type = currentType();
    overlay.querySelector('#m-fields-wrap').innerHTML = trBuildFormFields(type, []);
    overlay.querySelector('#m-save').textContent = trIsRestType(type) ? 'Отметить отдых' : 'Добавить';
    bindGroupCheckboxes();
  }

  function bindGroupCheckboxes() {
    overlay.querySelectorAll('.m-group-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const groups = selectedGroupsNow();
        const wrap = overlay.querySelector('#m-name-wrap');
        if (wrap) { wrap.innerHTML = trBuildExerciseSelect(groups); bindNameSelect(); }
      });
    });
  }
  bindGroupCheckboxes();

  function bindNameSelect() {
    const sel = overlay.querySelector('#m-name-wrap select#m-name');
    if (!sel) return;
    sel.addEventListener('change', () => {
      if (sel.value === '__custom__') {
        const wrap = overlay.querySelector('#m-name-wrap');
        wrap.innerHTML = `<input type="text" id="m-name" placeholder="Название упражнения">`;
        wrap.querySelector('#m-name').focus();
      }
    });
  }
  bindNameSelect();

  if (needsSetup) {
    overlay.querySelector('#m-type').addEventListener('change', refreshFields);
  }

  overlay.querySelector('#m-save').addEventListener('click', () => {
    const type = currentType();
    if (needsSetup) {
      day.type = type;
    }

    if (trIsRestType(type)) {
      day.groups = [];
      day.exercises = [];
      overlay.remove();
      onSave();
      return;
    }

    if (trIsGymType(type)) {
      const groups = selectedGroupsNow();
      if (groups.length === 0) return;
      const name = overlay.querySelector('#m-name').value.trim();
      if (!name) return;
      day.groups = groups;
      day.exercises.push({
        kind: 'strength',
        name,
        sets: parseInt(overlay.querySelector('#m-sets').value, 10) || 0,
        reps: parseInt(overlay.querySelector('#m-reps').value, 10) || 0,
        weight: parseFloat(overlay.querySelector('#m-weight').value) || 0
      });
      overlay.remove();
      onSave();
      return;
    }

    if (trIsCardioType(type)) {
      const direction = overlay.querySelector('#m-cardio-dir').value;
      const distance = parseFloat(overlay.querySelector('#m-distance').value) || 0;
      const duration = parseFloat(overlay.querySelector('#m-duration').value) || 0;
      day.exercises.push({ kind: 'cardio', name: direction, distance, duration });
      overlay.remove();
      onSave();
      return;
    }

    if (trIsTimeCalorieType(type)) {
      const duration = parseFloat(overlay.querySelector('#m-duration').value) || 0;
      const calories = parseFloat(overlay.querySelector('#m-calories').value) || 0;
      day.exercises.push({ kind: 'time_calorie', name: type, duration, calories });
      overlay.remove();
      onSave();
      return;
    }

    if (trIsStepsType(type)) {
      const steps = parseInt(overlay.querySelector('#m-steps').value, 10) || 0;
      day.exercises.push({ kind: 'steps', name: type, steps });
      overlay.remove();
      onSave();
      return;
    }
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
        ${role === 'coach'
          ? `<span style="display:flex; align-items:center; gap:8px;"><span class="tr-role-badge">Тренер</span><button class="tr-back tr-logout-btn" id="tr-logout"><i class="ti ti-logout"></i> Выйти</button></span>`
          : `<button class="tr-back" id="tr-logout"><i class="ti ti-logout"></i></button>`}
      </div>
      <div class="tr-plan-bar">
        <select class="tr-plan-select" id="tr-plan-select"></select>
        ${role === 'owner' ? '<button class="tr-plan-new" id="tr-new-plan"><i class="ti ti-plus"></i> Новый план</button>' : ''}
      </div>
      <div class="tr-tabs">
        <button class="tr-tab active" data-tab="plan">План</button>
        <button class="tr-tab" data-tab="working-weight">Рабочий вес</button>
        <button class="tr-tab" data-tab="summary">Итоги</button>
        <button class="tr-tab" data-tab="nutrition">Питание</button>
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

  function collapsedWeeksKey(planId) {
    return `nik_collapsed_weeks_${planId}`;
  }

  function loadCollapsedWeeks(planId) {
    try {
      const raw = localStorage.getItem(collapsedWeeksKey(planId));
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCollapsedWeeks(planId, weeks) {
    try {
      localStorage.setItem(collapsedWeeksKey(planId), JSON.stringify(weeks));
    } catch (e) { /* ignore */ }
  }

  let collapsedWeeks = loadCollapsedWeeks(currentPlanId);

  function bindPlanEvents(plan) {
    content.querySelectorAll('.tr-exercise').forEach(btn => {
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
      btn.addEventListener('click', () => {
        const w = parseInt(btn.dataset.week, 10);
        const d = parseInt(btn.dataset.day, 10);
        if (btn.classList.contains('tr-day-clear')) {
          if (!confirm('Сбросить этот день обратно в «не задано»?')) return;
          const day = plan.weeks[w].days[d];
          day.type = null;
          day.groups = [];
          day.exercises = [];
          trSavePlans(trGetPlans().map(p => p.id === plan.id ? plan : p));
          renderTab('plan');
          return;
        }
        trOpenAddModal(plan, w, d, () => {
          trSavePlans(trGetPlans().map(p => p.id === plan.id ? plan : p));
          renderTab('plan');
        });
      });
    });
    content.querySelectorAll('.tr-week-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = parseInt(btn.dataset.week, 10);
        const idx = collapsedWeeks.indexOf(w);
        if (idx === -1) collapsedWeeks.push(w);
        else collapsedWeeks.splice(idx, 1);
        saveCollapsedWeeks(currentPlanId, collapsedWeeks);
        renderTab('plan');
      });
    });
  }

  function renderTab(tab) {
    const plan = getPlan();
    if (tab === 'plan') {
      content.innerHTML = trRenderPlanTab(plan, collapsedWeeks);
      trAnimateBars(content);
      bindPlanEvents(plan);
    } else if (tab === 'working-weight') {
      content.innerHTML = trRenderWorkingWeight(plan);
    } else if (tab === 'summary') {
      content.innerHTML = trRenderSummary(plan);
      const addBtn = document.getElementById('tr-add-measure');
      if (addBtn) {
        if (role === 'coach') {
          addBtn.style.display = 'none';
        } else {
          addBtn.addEventListener('click', () => trOpenMeasureModal(() => renderTab('summary')));
        }
      }
      content.querySelectorAll('.tr-measure-delete').forEach(btn => {
        if (role === 'coach') { btn.style.display = 'none'; return; }
        btn.addEventListener('click', () => {
          if (!confirm('Удалить этот замер?')) return;
          trDeleteMeasurement(parseInt(btn.dataset.idx, 10), () => renderTab('summary'));
        });
      });
    } else if (tab === 'nutrition') {
      content.innerHTML = trRenderNutrition(plan);
      const editBtn = document.getElementById('tr-edit-nutrition');
      if (editBtn) {
        if (role === 'coach') {
          editBtn.style.display = 'none';
        } else {
          editBtn.addEventListener('click', () => trOpenNutritionModal(plan, () => {
            trSavePlans(trGetPlans().map(p => p.id === plan.id ? plan : p));
            renderTab('nutrition');
          }));
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
    collapsedWeeks = loadCollapsedWeeks(currentPlanId);
    mount.querySelectorAll('.tr-tab').forEach(t => t.classList.remove('active'));
    mount.querySelector('[data-tab="plan"]').classList.add('active');
    renderTab('plan');
  });

  const newPlanBtn = document.getElementById('tr-new-plan');
  if (newPlanBtn) {
    newPlanBtn.addEventListener('click', () => {
      if (!confirm('Текущий план переходит в архив, начинаем новый план на 8 недель. Продолжить?')) return;
      currentPlanId = trCreateNextPlan();
      collapsedWeeks = [];
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

function trCollectGymExercises(plan) {
  const latest = {};
  plan.weeks.forEach((week, weekIndex) => {
    week.days.forEach((day, dayIdx) => {
      if (!trIsGymType(day.type)) return;
      day.exercises.forEach((ex, exIdx) => {
        if (ex.kind !== 'strength') return;
        latest[ex.name] = { ex, weekIndex, dayIdx, exIdx, groups: day.groups || [] };
      });
    });
  });
  return latest;
}

function trRenderWorkingWeight(plan) {
  const latest = trCollectGymExercises(plan);
  const names = Object.keys(latest);
  if (names.length === 0) {
    return `<div class="tr-empty-state"><i class="ti ti-weight"></i>Рабочий вес появится здесь после первой записи в зале.</div>`;
  }

  const byGroup = {};
  names.forEach(name => {
    const label = latest[name].groups.length ? latest[name].groups.join(' + ') : 'Без группы';
    if (!byGroup[label]) byGroup[label] = [];
    byGroup[label].push(name);
  });

  const rows = Object.keys(byGroup).map(label => {
    const exerciseRows = byGroup[label].map(name => {
      const { ex, weekIndex } = latest[name];
      const progress = trCalcProgress(plan, weekIndex, name);
      const arrow = progress.dir === 'up' ? '▲' : progress.dir === 'down' ? '▼' : '–';
      const sign = progress.pct > 0 ? '+' : '';
      return `
        <tr>
          <td class="tr-ww-name">${ex.name}</td>
          <td class="tr-ww-num num">${ex.sets}</td>
          <td class="tr-ww-num num">${ex.reps}</td>
          <td class="tr-ww-num num tr-ww-weight">${ex.weight} кг</td>
          <td class="tr-ww-num num tr-progress ${progress.dir}">${sign}${progress.pct}% ${arrow}</td>
        </tr>`;
    }).join('');
    return `
      <div class="tr-ww-group">
        <div class="tr-ww-group-label fb-accent">${label}</div>
        <table class="tr-ww-table">
          <thead>
            <tr>
              <th>Упражнение</th><th>Подх.</th><th>Повт.</th><th>Вес</th><th>Прогресс</th>
            </tr>
          </thead>
          <tbody>${exerciseRows}</tbody>
        </table>
      </div>`;
  }).join('');

  return `<div class="tr-ww-wrap">${rows}</div>`;
}

function trRenderNutrition(plan) {
  const n = plan.nutrition || { protein: 0, fat: 0, carbs: 0, totalKcal: 0 };
  return `
    <div class="tr-group-card">
      <div class="tr-group-title fb-accent">Питание <span class="tr-group-range">· план №${plan.number}</span></div>
      <div class="sec-metric-grid" style="margin-bottom:14px;">
        <div class="sec-metric" style="background:var(--void-card); border:0.5px solid #2E7FD455;">
          <div class="sec-metric-label">Общие ккал</div>
          <div class="sec-metric-value num" style="color:#5B9FE0;">${n.totalKcal} ккал</div>
        </div>
      </div>
      <div class="tr-day">
        <div class="tr-exercise" style="cursor:default;">
          <div class="tr-ex-top">
            <div class="tr-ex-name">Белки</div>
            <div class="tr-ex-stats"><span class="tr-ex-weight num">${n.protein} г</span></div>
          </div>
        </div>
        <div class="tr-exercise" style="cursor:default;">
          <div class="tr-ex-top">
            <div class="tr-ex-name">Жиры</div>
            <div class="tr-ex-stats"><span class="tr-ex-weight num">${n.fat} г</span></div>
          </div>
        </div>
        <div class="tr-exercise" style="cursor:default;">
          <div class="tr-ex-top">
            <div class="tr-ex-name">Угли</div>
            <div class="tr-ex-stats"><span class="tr-ex-weight num">${n.carbs} г</span></div>
          </div>
        </div>
      </div>
    </div>
    <button class="tr-plan-new" id="tr-edit-nutrition" style="width:100%; justify-content:center; margin-top:4px;">
      <i class="ti ti-edit"></i> Изменить
    </button>`;
}

function trOpenNutritionModal(plan, onSave) {
  const n = plan.nutrition || { protein: 0, fat: 0, carbs: 0, totalKcal: 0 };
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';
  overlay.innerHTML = `
    <div class="tr-modal">
      <p class="tr-modal-title">Питание · план №${plan.number}</p>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Общие ккал<input type="number" id="m-total-kcal" value="${n.totalKcal || ''}" inputmode="numeric"></label>
      </div>
      <div class="tr-modal-row">
        <label>Белки, г<input type="number" id="m-protein" value="${n.protein || ''}" inputmode="numeric"></label>
        <label>Жиры, г<input type="number" id="m-fat" value="${n.fat || ''}" inputmode="numeric"></label>
        <label>Угли, г<input type="number" id="m-carbs" value="${n.carbs || ''}" inputmode="numeric"></label>
      </div>
      <div class="tr-modal-actions">
        <button class="tr-modal-btn-secondary" id="m-cancel">Отмена</button>
        <button class="tr-modal-btn-primary" id="m-save">Сохранить</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#m-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#m-save').addEventListener('click', () => {
    plan.nutrition = {
      totalKcal: parseFloat(overlay.querySelector('#m-total-kcal').value) || 0,
      protein: parseFloat(overlay.querySelector('#m-protein').value) || 0,
      fat: parseFloat(overlay.querySelector('#m-fat').value) || 0,
      carbs: parseFloat(overlay.querySelector('#m-carbs').value) || 0
    };
    overlay.remove();
    onSave();
  });
}

const MEASURE_FIELDS = [
  'Талия', 'Плечи', 'Грудь', 'Лев рука', 'Прав рука',
  'Лев нога', 'Прав нога', 'Бедро', 'Вес', 'Мышечная масса',
  '% жира', 'Оценка InBody'
];

function trCollectExerciseHistory(plan, exerciseName) {
  // returns { first: {ex, weekIndex}, last: {ex, weekIndex} } across the whole plan
  let first = null;
  let last = null;
  plan.weeks.forEach((week, weekIndex) => {
    week.days.forEach(day => {
      const found = day.exercises.find(e => e.name === exerciseName);
      if (found) {
        if (!first) first = { ex: found, weekIndex };
        last = { ex: found, weekIndex };
      }
    });
  });
  return { first, last };
}

function trWasNowLabel(ex, metricLabelFn) {
  if (ex.kind === 'cardio') return `${ex.distance} км`;
  if (ex.kind === 'time_calorie') return `${ex.calories} ккал`;
  if (ex.kind === 'steps') return `${ex.steps.toLocaleString('ru-RU')} шагов`;
  return `${trTonnage(ex).toLocaleString('ru-RU')} кг`;
}

function trRenderWasNowRow(exerciseName, plan) {
  const { first, last } = trCollectExerciseHistory(plan, exerciseName);
  if (!first || !last) return '';
  const sameRecord = first.weekIndex === last.weekIndex;
  const wasVal = trMetricFor(first.ex);
  const nowVal = trMetricFor(last.ex);
  let pct = 0;
  if (wasVal === 0) {
    pct = nowVal === 0 ? 0 : 100;
  } else {
    pct = Math.round(((nowVal - wasVal) / wasVal) * 100);
  }
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '–';
  const sign = pct > 0 ? '+' : '';

  if (sameRecord) {
    return `
      <div class="tr-exercise" style="cursor:default">
        <div class="tr-ex-top">
          <div class="tr-ex-name">${exerciseName}</div>
          <div class="tr-ex-stats"><span class="tr-ex-weight num">${trWasNowLabel(last.ex)}</span></div>
        </div>
        <div class="tr-ex-bottom"><div class="tr-ex-meta num">только одна запись</div></div>
      </div>`;
  }

  return `
    <div class="tr-exercise" style="cursor:default">
      <div class="tr-ex-top">
        <div class="tr-ex-name">${exerciseName}</div>
        <div class="tr-ex-stats"><span class="tr-progress ${dir}">${sign}${pct}% ${arrow}</span></div>
      </div>
      <div class="tr-ex-bottom"><div class="tr-ex-meta num">было ${trWasNowLabel(first.ex)} → стало ${trWasNowLabel(last.ex)}</div></div>
    </div>`;
}

function trRenderSummary(plan) {
  const exerciseGroups = {}; // label -> Set of exercise names, by where they last appeared
  plan.weeks.forEach(week => {
    week.days.forEach(day => {
      if (!day.type || day.type === 'Отдых') return;
      const label = trIsGymType(day.type) && day.groups && day.groups.length
        ? day.groups.join(' + ')
        : day.type;
      if (!exerciseGroups[label]) exerciseGroups[label] = new Set();
      day.exercises.forEach(ex => exerciseGroups[label].add(ex.name));
    });
  });

  const labels = Object.keys(exerciseGroups).filter(l => exerciseGroups[l].size > 0);
  const exercisesHtml = labels.length === 0
    ? `<div class="tr-empty-state"><i class="ti ti-chart-bar"></i>Сводка «было → стало» появится здесь после заполнения плана.</div>`
    : labels.map(label => {
        const rows = Array.from(exerciseGroups[label]).map(name => trRenderWasNowRow(name, plan)).join('');
        return `
          <div class="tr-group-card">
            <div class="tr-group-title">${label} <span class="tr-group-range">· было → стало</span></div>
            <div class="tr-day">${rows}</div>
          </div>`;
      }).join('');

  return exercisesHtml + trRenderMeasurementsBlock();
}

function trRenderMeasurementsBlock() {
  const list = Store.get().training.measurements || [];
  const rowsHtml = list.length === 0
    ? `<div class="tr-empty-state"><i class="ti ti-ruler-2"></i>Замеры тела появятся здесь после первой записи.</div>`
    : list.slice().reverse().map((m, idx) => {
        const realIdx = list.length - 1 - idx;
        const fields = MEASURE_FIELDS.filter(f => m.values[f] !== undefined && m.values[f] !== '');
        return `
          <div class="tr-measure-card">
            <div class="tr-measure-date-row">
              <span class="tr-measure-date">${m.date}</span>
              <button class="tr-measure-delete" data-idx="${realIdx}" aria-label="Удалить замер"><i class="ti ti-trash"></i></button>
            </div>
            <div class="tr-measure-grid">
              ${fields.map(f => `<div class="tr-measure-item"><span>${f}</span><span>${m.values[f]}</span></div>`).join('')}
            </div>
          </div>`;
      }).join('');
  return `
    <div class="tr-group-card">
      <div class="tr-group-title">Замеры <button class="tr-measure-add-inline" id="tr-add-measure"><i class="ti ti-plus"></i> Добавить</button></div>
      ${rowsHtml}
    </div>`;
}

function trOpenMeasureModal(onSave) {
  const today = new Date();
  const dateStr = `${trFormatDate(today)}.${today.getFullYear()}`;
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';
  overlay.innerHTML = `
    <div class="tr-modal" style="max-height:80vh; overflow-y:auto;">
      <p class="tr-modal-title">Новый замер · ${dateStr}</p>
      <div class="tr-measure-form-grid">
        ${MEASURE_FIELDS.map(f => `
          <label class="tr-measure-form-field">${f}<input type="text" data-field="${f}" inputmode="decimal" placeholder="—"></label>
        `).join('')}
      </div>
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

function trDeleteMeasurement(idx, onSave) {
  const list = Store.get().training.measurements || [];
  list.splice(idx, 1);
  Store.set('training.measurements', list);
  onSave();
}
