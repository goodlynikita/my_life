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

function trIsToday(dateStr) {
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}`;
  return dateStr === todayStr;
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

const MUSCLE_BLOCK_EXERCISES_DEFAULT = {
  'Грудь': ['Жим гантели', 'Жим штанга', 'Жим гантели наклон', 'Жим штанга наклон', 'Кроссовер сверху', 'Кроссовер снизу', 'Разведения', 'Бабочка', 'Брусья'],
  'Спина': ['Пуловер', 'Тяга штанги', 'Тяга верхнего блока', 'Тяга нижнего блока', 'Гиперэкстензия', 'Тяга гантелей', 'Подтягивания'],
  'Руки': ['Подъём штанги', 'Французский жим', 'Молотки гантель', 'Подъём гантель', 'Разгибания канаты', 'Разгибания из-за головы', 'Бицепс наклон', 'Молотки стоя'],
  'Ноги': ['Присяд штанга', 'Присяд гакк', 'Жим ногами', 'Пресс', 'Разгибания', 'Сгибания'],
  'Плечи': ['Махи', 'Жим', 'Разведения']
};
/* При загрузке сбрасываем локальный кэш упражнений чтобы применить актуальный список */
try { localStorage.removeItem('nik_exercises_v1'); } catch(e) {}

function trLoadExercises() {
  try {
    const saved = localStorage.getItem('nik_exercises_v1');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return JSON.parse(JSON.stringify(MUSCLE_BLOCK_EXERCISES_DEFAULT));
}

function trSaveExercises(data) {
  try { localStorage.setItem('nik_exercises_v1', JSON.stringify(data)); } catch(e) {}
}

const MUSCLE_BLOCK_EXERCISES = trLoadExercises();

function trOpenExerciseEditor() {
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';
  
  function buildHtml() {
    const groupsHtml = Object.keys(MUSCLE_BLOCK_EXERCISES_DEFAULT).map(group => {
      const exercises = MUSCLE_BLOCK_EXERCISES[group] || [];
      return `
        <div class="tr-ex-edit-group" data-group="${group}">
          <div class="tr-ex-edit-group-title">${group}</div>
          <div class="tr-ex-edit-list">
            ${exercises.map((ex, i) => `
              <div class="tr-ex-edit-item" data-idx="${i}">
                <span class="tr-ex-edit-name">${ex}</span>
                <span style="display:flex; gap:4px;">
                  <button class="tr-ex-edit-rename" data-group="${group}" data-idx="${i}" title="Переименовать"><i class="ti ti-pencil"></i></button>
                  <button class="tr-ex-edit-delete" data-group="${group}" data-idx="${i}" title="Удалить"><i class="ti ti-trash"></i></button>
                </span>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:6px; display:flex; gap:6px;">
            <input type="text" class="tr-ex-edit-input" data-group="${group}" placeholder="Новое упражнение…" style="flex:1; padding:6px 8px; border-radius:6px; border:1px solid #2A2D35; background:#0F1117; color:#E8E5DC; font-size:13px;">
            <button class="tr-ex-edit-add" data-group="${group}" style="padding:6px 10px; border-radius:6px; background:#2E7FD4; color:#fff; border:none; cursor:pointer; font-size:13px;">+</button>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="tr-modal" style="max-height:80vh; overflow-y:auto; width:100%; max-width:420px;">
        <p class="tr-modal-title">Редактор упражнений</p>
        ${groupsHtml}
        <div class="tr-modal-actions" style="margin-top:16px;">
          <button class="tr-modal-btn-secondary" id="tr-ex-reset">Сбросить</button>
          <button class="tr-modal-btn-primary" id="tr-ex-close">Готово</button>
        </div>
      </div>`;
  }

  overlay.innerHTML = buildHtml();
  document.body.appendChild(overlay);

  function rebind() {
    overlay.innerHTML = buildHtml();
    bindEvents();
  }

  function bindEvents() {
    overlay.querySelector('#tr-ex-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#tr-ex-reset').addEventListener('click', () => {
      if (!confirm('Сбросить все упражнения к стандартным?')) return;
      Object.keys(MUSCLE_BLOCK_EXERCISES_DEFAULT).forEach(g => {
        MUSCLE_BLOCK_EXERCISES[g] = [...MUSCLE_BLOCK_EXERCISES_DEFAULT[g]];
      });
      trSaveExercises(MUSCLE_BLOCK_EXERCISES);
      rebind();
    });

    overlay.querySelectorAll('.tr-ex-edit-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const g = btn.dataset.group, i = parseInt(btn.dataset.idx);
        MUSCLE_BLOCK_EXERCISES[g].splice(i, 1);
        trSaveExercises(MUSCLE_BLOCK_EXERCISES);
        rebind();
      });
    });

    overlay.querySelectorAll('.tr-ex-edit-rename').forEach(btn => {
      btn.addEventListener('click', () => {
        const g = btn.dataset.group, i = parseInt(btn.dataset.idx);
        const newName = prompt('Новое название:', MUSCLE_BLOCK_EXERCISES[g][i]);
        if (newName && newName.trim()) {
          MUSCLE_BLOCK_EXERCISES[g][i] = newName.trim();
          trSaveExercises(MUSCLE_BLOCK_EXERCISES);
          rebind();
        }
      });
    });

    overlay.querySelectorAll('.tr-ex-edit-add').forEach(btn => {
      btn.addEventListener('click', () => {
        const g = btn.dataset.group;
        const input = overlay.querySelector(`.tr-ex-edit-input[data-group="${g}"]`);
        const val = input.value.trim();
        if (!val) return;
        if (!MUSCLE_BLOCK_EXERCISES[g]) MUSCLE_BLOCK_EXERCISES[g] = [];
        MUSCLE_BLOCK_EXERCISES[g].push(val);
        trSaveExercises(MUSCLE_BLOCK_EXERCISES);
        input.value = '';
        rebind();
      });
    });

    overlay.querySelectorAll('.tr-ex-edit-input').forEach(input => {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          const g = input.dataset.group;
          const val = input.value.trim();
          if (!val) return;
          if (!MUSCLE_BLOCK_EXERCISES[g]) MUSCLE_BLOCK_EXERCISES[g] = [];
          MUSCLE_BLOCK_EXERCISES[g].push(val);
          trSaveExercises(MUSCLE_BLOCK_EXERCISES);
          input.value = '';
          rebind();
        }
      });
    });
  }

  bindEvents();
}

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
      /* getDay() возвращает 0=вс, 1=пн...6=сб — переводим в нашу систему пн=0...вс=6 */
      const jsDay = date.getDay(); // 0=вс,1=пн,2=вт,...,6=сб
      const ruDay = jsDay === 0 ? 6 : jsDay - 1; // вс=6, пн=0, вт=1...
      days.push({
        date: trFormatDate(date),
        dow: DOW_NAMES[ruDay],
        sessions: []
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

const TR_UNDO_KEY = 'nik_tr_undo_stack';
const TR_UNDO_MAX = 20;

function trSnapshotBeforeChange() {
  try {
    const stack = JSON.parse(sessionStorage.getItem(TR_UNDO_KEY) || '[]');
    const snapshot = JSON.parse(JSON.stringify(Store.get().training));
    stack.push(snapshot);
    if (stack.length > TR_UNDO_MAX) stack.shift();
    sessionStorage.setItem(TR_UNDO_KEY, JSON.stringify(stack));
  } catch (e) { /* ignore */ }
}

function trUndoAvailable() {
  try {
    const stack = JSON.parse(sessionStorage.getItem(TR_UNDO_KEY) || '[]');
    return stack.length > 0;
  } catch (e) {
    return false;
  }
}

function trUndoLastChange() {
  try {
    const stack = JSON.parse(sessionStorage.getItem(TR_UNDO_KEY) || '[]');
    if (stack.length === 0) return false;
    const previous = stack.pop();
    sessionStorage.setItem(TR_UNDO_KEY, JSON.stringify(stack));
    Store.set('training', previous);
    return true;
  } catch (e) {
    return false;
  }
}

function trSavePlans(plans) {
  /* Пишем каждый план отдельным путём — не перезаписываем весь массив.
     Это гарантирует что одновременные правки двух пользователей
     не затирают друг друга в Firebase. */
  plans.forEach((plan, idx) => {
    if (plan) Store.set('training.plans.' + idx, plan);
  });
}

function trActivePlan() {
  const plans = trGetPlans();
  return plans.find(p => p.status === 'active') || plans[plans.length - 1] || null;
}

function trEnsureSeedPlan() {
  /* НЕ создаёт и НЕ сохраняет план. Возвращает id активного (или последнего)
     плана, либо null, если планов нет вообще. Создание плана — только через
     явную кнопку «Новый план». Раньше эта функция при пустом списке создавала
     пустой план и СОХРАНЯЛА его — что во время гонки данных затирало реальные
     данные в Firebase пустотой. Это и был корень «пустых тренировок». */
  const plans = trGetPlans();
  if (plans.length === 0) return null;
  const active = trActivePlan();
  return active ? active.id : plans[0].id;
}

function trCreateNextPlan() {
  trSnapshotBeforeChange();
  const plans = trGetPlans();
  plans.forEach(p => { if (p.status === 'active') p.status = 'archived'; });
  const maxNumber = plans.reduce((m, p) => Math.max(m, p.number), 0);
  /* Начинаем план с понедельника текущей недели */
  const _today = new Date();
  const _dow = _today.getDay(); // 0=вс, 1=пн, ..., 6=сб
  const _daysFromMon = _dow === 0 ? 6 : _dow - 1; // вс — это конец недели, отматываем 6 дней
  const _planStart = new Date(_today);
  _planStart.setDate(_today.getDate() - _daysFromMon);
  _planStart.setHours(0, 0, 0, 0);
  const newPlan = trBuildEmptyPlan(maxNumber + 1, _planStart);
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

function trDayAllExercises(day) {
  trMigrateDayToSessions(day);
  const list = [];
  day.sessions.forEach((session, sessionIdx) => {
    session.exercises.forEach((ex, exIdx) => list.push({ ex, sessionIdx, exIdx }));
  });
  return list;
}

function trCalcProgress(plan, weekIndex, exerciseName) {
  const week1 = plan.weeks[0];
  let baseline = null;
  let baselineKind = null;
  for (const day of week1.days) {
    const found = trDayAllExercises(day).find(e => e.ex.name === exerciseName);
    if (found) {
      baselineKind = found.ex.kind;
      /* Не показываем прогресс для шагов/кардио в зале — некорректное сравнение */
      if (found.ex.kind === 'steps' || found.ex.kind === 'cardio') return { pct: 0, dir: 'flat' };
      baseline = trMetricFor(found.ex);
      break;
    }
  }
  const currentWeek = plan.weeks[weekIndex];
  let current = null;
  for (const day of currentWeek.days) {
    const found = trDayAllExercises(day).find(e => e.ex.name === exerciseName);
    if (found) { current = trMetricFor(found.ex); break; }
  }
  if (baseline === null || current === null) return { pct: 0, dir: 'flat' };
  if (baseline === 0) {
    if (current === 0) return { pct: 0, dir: 'flat' };
    return { pct: 100, dir: 'up' };
  }
  const pct = Math.round(((current - baseline) / baseline) * 100);
  return { pct, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
}


const EXERCISE_PROGRESSION = {
  /* ГРУДЬ */
  'Жим гантели':        { min: 8,  max: 12, step: 2 },
  'Жим штанга':         { min: 6,  max: 10, step: 2.5 },
  'Жим гантели наклон': { min: 8,  max: 12, step: 2 },
  'Жим штанга наклон':  { min: 6,  max: 10, step: 2.5 },
  'Кроссовер сверху':   { min: 12, max: 15, step: 2.5 },
  'Кроссовер снизу':    { min: 12, max: 15, step: 2.5 },
  'Разведения':         { min: 12, max: 15, step: 2 },
  'Бабочка':            { min: 12, max: 15, step: 5 },
  'Брусья':             { min: 8,  max: 12, step: 2.5 },
  /* СПИНА */
  'Пуловер':            { min: 10, max: 12, step: 2.5 },
  'Тяга штанги':        { min: 8,  max: 10, step: 2.5 },
  'Тяга верхнего блока':{ min: 8,  max: 12, step: 5 },
  'Тяга нижнего блока': { min: 8,  max: 12, step: 5 },
  'Гиперэкстензия':     { min: 12, max: 15, step: 2.5 },
  'Тяга гантелей':      { min: 8,  max: 12, step: 2 },
  'Подтягивания':       { min: 6,  max: 10, step: 2.5 },
  /* РУКИ */
  'Подъём штанги':            { min: 8,  max: 12, step: 2.5 },
  'Французский жим':          { min: 8,  max: 12, step: 2.5 },
  'Молотки гантель':          { min: 8,  max: 12, step: 2 },
  'Подъём гантель':           { min: 8,  max: 12, step: 2 },
  'Разгибания канаты':        { min: 10, max: 12, step: 2.5 },
  'Разгибания из-за головы':  { min: 10, max: 12, step: 2.5 },
  'Бицепс наклон':            { min: 10, max: 12, step: 2 },
  'Молотки стоя':             { min: 8,  max: 12, step: 2 },
  /* НОГИ */
  'Присяд штанга': { min: 6,  max: 10, step: 5 },
  'Присяд гакк':   { min: 8,  max: 12, step: 5 },
  'Жим ногами':    { min: 10, max: 12, step: 10 },
  'Пресс':         { min: 15, max: 20, step: 0 },
  'Разгибания':    { min: 10, max: 12, step: 5 },
  'Сгибания':      { min: 10, max: 12, step: 5 },
  /* ПЛЕЧИ */
  'Махи':        { min: 12, max: 15, step: 2 },
  'Жим':         { min: 8,  max: 12, step: 2 },
};

function trGetProgression(exName) {
  return EXERCISE_PROGRESSION[exName] || null;
}

function trGetLastSession(plan, exName) {
  /* Ищем последнюю запись этого упражнения по всем неделям */
  let last = null;
  plan.weeks.forEach(week => {
    week.days.forEach(day => {
      trMigrateDayToSessions(day);
      day.sessions.forEach(session => {
        session.exercises.forEach(ex => {
          if (ex.name === exName && ex.kind === 'strength') last = ex;
        });
      });
    });
  });
  return last;
}

function trProgressionHint(plan, exName) {
  const prog = trGetProgression(exName);
  if (!prog) return null;

  const last = trGetLastSession(plan, exName);

  if (!last) {
    return {
      type: 'first',
      html: `<div class="tr-prog-hint tr-prog-first">
        <i class="ti ti-info-circle"></i>
        <span>Первый раз — начни с комфортного веса и нащупай свой рабочий</span>
      </div>`
    };
  }

  const { sets, reps, weight } = last;
  const lastLine = `${sets} × ${reps} × ${weight} кг`;

  if (prog.step === 0) {
    /* Пресс — только повторы */
    const target = reps < prog.max ? `${sets} × ${Math.min(reps + 2, prog.max)} повторов` : `усложни упражнение`;
    return {
      type: 'reps',
      html: `<div class="tr-prog-hint tr-prog-ok">
        <div class="tr-prog-last">Последний раз: ${lastLine}</div>
        <div class="tr-prog-target"><i class="ti ti-target"></i> Цель сегодня: ${target}</div>
      </div>`
    };
  }

  if (reps >= prog.max) {
    /* Закрыл все повторы — поднимаем вес */
    const newWeight = weight + prog.step;
    return {
      type: 'increase',
      html: `<div class="tr-prog-hint tr-prog-up">
        <div class="tr-prog-last">Последний раз: ${lastLine} ✅</div>
        <div class="tr-prog-target"><i class="ti ti-trending-up"></i> Поднимай до <strong>${newWeight} кг</strong>, цель ${sets} × ${prog.min}</div>
      </div>`
    };
  } else if (reps >= prog.min) {
    /* В диапазоне — держим вес, добавляем повторы */
    return {
      type: 'hold',
      html: `<div class="tr-prog-hint tr-prog-hold">
        <div class="tr-prog-last">Последний раз: ${lastLine}</div>
        <div class="tr-prog-target"><i class="ti ti-target"></i> Держи <strong>${weight} кг</strong>, цель — дойти до ${sets} × ${prog.max}</div>
      </div>`
    };
  } else {
    /* Ниже минимума — работаем над повторами */
    return {
      type: 'work',
      html: `<div class="tr-prog-hint tr-prog-low">
        <div class="tr-prog-last">Последний раз: ${lastLine}</div>
        <div class="tr-prog-target"><i class="ti ti-refresh"></i> Оставь <strong>${weight} кг</strong>, работай над повторами (цель ${prog.min}–${prog.max})</div>
      </div>`
    };
  }
}

function trRenderExercise(ex, plan, weekIndex, dayIdx, exIdx, sessionIdx) {
  const progress = trCalcProgress(plan, weekIndex, ex.name);
  const arrow = progress.dir === 'up' ? '▲' : progress.dir === 'down' ? '▼' : '–';
  const sign = progress.pct > 0 ? '+' : '';
  const progressBadge = `<span class="tr-progress ${progress.dir}">${arrow} ${sign}${progress.pct}%</span>`;
  /* Двунаправленный прогресс-бар: центр = 0%, вправо = рост, влево = падение */
  const clampedPct = Math.min(50, Math.abs(progress.pct) / 2); /* макс ±50% от центра */
  const barColor = progress.dir === 'up' ? '#A8C97F' : progress.dir === 'down' ? '#FF5C5C' : '#3A3D45';
  const barLeft = progress.dir === 'down' ? (50 - clampedPct) + '%' : '50%';
  const barWidth = clampedPct > 0 ? clampedPct + '%' : '0%';
  const bar = `<div class="tr-progress-bar-track"><div class="tr-progress-bar-fill" style="left:${barLeft}; width:${barWidth}; background:${barColor};"></div></div>`;
  const wrap = (headline, meta) => `
    <div class="tr-exercise-wrap" draggable="false" data-week="${weekIndex}" data-day="${dayIdx}" data-session="${sessionIdx}" data-ex="${exIdx}">
      <div class="tr-drag-handle" title="Перетащить"><i class="ti ti-grip-vertical"></i></div>
      <button class="tr-exercise" data-week="${weekIndex}" data-day="${dayIdx}" data-session="${sessionIdx}" data-ex="${exIdx}">
        <div class="tr-ex-top">
          <div class="tr-ex-name">${ex.name}</div>
          <div class="tr-ex-stats">
            <span class="tr-ex-weight num">${headline}</span>
            ${progressBadge}
          </div>
        </div>
        <div class="tr-ex-bottom"><div class="tr-ex-meta num">${meta}</div></div>
        ${bar}
      </button>
    </div>`;

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

function trMigrateDayToSessions(day) {
  // Backward compat: old days had { type, groups, exercises } directly.
  // New days have { sessions: [{ type, groups, exercises }] }.
  if (day.sessions) {
    // Firebase выкидывает пустые массивы и иногда возвращает массив как объект.
    // Гарантируем, что sessions и внутри exercises/groups — настоящие массивы,
    // иначе session.exercises.map(...) падает с undefined.
    day.sessions = Array.isArray(day.sessions) ? day.sessions : Object.values(day.sessions);
    day.sessions.forEach(s => {
      if (!s || typeof s !== 'object') return;
      s.exercises = Array.isArray(s.exercises) ? s.exercises : (s.exercises ? Object.values(s.exercises) : []);
      s.groups = Array.isArray(s.groups) ? s.groups : (s.groups ? Object.values(s.groups) : []);
      s.exercises.forEach(ex => {
        if (ex && ex.setDetails && !Array.isArray(ex.setDetails)) ex.setDetails = Object.values(ex.setDetails);
      });
    });
    return day;
  }
  if (day.type) {
    day.sessions = [{ type: day.type, groups: day.groups || [], exercises: day.exercises || [] }];
  } else {
    day.sessions = [];
  }
  delete day.type;
  delete day.groups;
  delete day.exercises;
  return day;
}

function trRenderDay(day, plan, weekIndex, dayIdx) {
  trMigrateDayToSessions(day);
  const sessions = day.sessions;
  const hasAnySession = sessions.length > 0;
  const isToday = trIsToday(day.date);

  const sessionsHtml = sessions.map((session, sessionIdx) => {
    const isRest = session.type === 'Отдых';
    const typeColor = trBadgeColor(TRAINING_TYPES, session.type);
    const groupTags = (session.groups || []).map(g => {
      const c = trBadgeColor(MUSCLE_GROUPS, g);
      return `<span class="tr-day-tag has-session" style="background:${c}22; color:${c}; border-color:${c}55;">${g}</span>`;
    }).join('');
    const exercisesHtml = session.exercises.map((ex, exIdx) => trRenderExercise(ex, plan, weekIndex, dayIdx, exIdx, sessionIdx)).join('');

    return `
      <div class="tr-session">
        <div class="tr-session-head">
          <span class="tr-day-tag has-session" style="background:${typeColor}22; color:${typeColor}; border-color:${typeColor}55;">${session.type}</span>${groupTags}
          <span class="tr-session-actions">
            <button class="tr-session-move" data-week="${weekIndex}" data-day="${dayIdx}" data-session="${sessionIdx}" aria-label="Перенести тренировку" title="Перенести в другой день" style="background:none; border:none; cursor:pointer; color:#9D9A92; padding:4px 6px; font-size:15px;"><i class="ti ti-calendar-share"></i></button>
            ${!isRest ? `<button class="tr-day-add tr-session-add-ex" data-week="${weekIndex}" data-day="${dayIdx}" data-session="${sessionIdx}" aria-label="Добавить упражнение" title="Добавить упражнение в эту тренировку"><i class="ti ti-plus"></i></button>` : ''}
            <button class="tr-day-add tr-day-clear" data-week="${weekIndex}" data-day="${dayIdx}" data-session="${sessionIdx}" aria-label="Удалить тренировку" title="Удалить эту тренировку"><i class="ti ti-trash"></i></button>
          </span>
        </div>
        ${isRest ? '<div class="tr-day-empty">День отдыха</div>' : exercisesHtml}
        ${(!isRest && session.exercises.length === 0) ? '<div class="tr-day-empty">Нет упражнений</div>' : ''}
      </div>`;
  }).join('');

  const comment = day.comment || '';
  const commentHtml = comment
    ? `<div class="tr-day-comment"><i class="ti ti-message-circle" style="font-size:12px;"></i> ${comment}</div>`
    : '';

  return `
    <div class="tr-day${isToday ? ' tr-day-today' : ''}">
      <div class="tr-day-head">
        <span class="tr-day-date">${day.date} ${day.dow}</span>
        ${isToday ? '<span class="tr-today-badge">Сегодня</span>' : ''}
        ${!hasAnySession ? `<span class="tr-day-tag">не задано</span>` : ''}
        <span style="display:flex; gap:4px; margin-left:auto;">
          <button class="tr-day-comment-btn" data-week="${weekIndex}" data-day="${dayIdx}" title="${comment ? 'Изменить заметку' : 'Добавить заметку'}" style="background:none; border:none; cursor:pointer; color:${comment ? '#2E7FD4' : '#555'}; padding:2px 4px;"><i class="ti ti-message-circle"></i></button>
          <button class="tr-day-add" data-week="${weekIndex}" data-day="${dayIdx}" aria-label="Добавить" title="${hasAnySession ? 'Добавить ещё одну тренировку в этот день' : 'Добавить тренировку'}"><i class="ti ti-plus"></i></button>
        </span>
      </div>
      ${commentHtml}
      ${sessionsHtml}
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
  if (!plan || !plan.weeks) {
    return '<div style="padding:40px 20px;text-align:center;color:#9D9A92;font-size:13px;">Загрузка плана…</div>';
  }
  return plan.weeks.map((w, i) => trRenderWeek(w, plan, i, (collapsedWeeks || []).includes(i))).join('');
}

function trAnimateBars(scope) {
  /* Анимация уже через CSS transition на inline style */
}

function trOpenExerciseModal(plan, weekIndex, dayIdx, sessionIdx, exIdx, onSave) {
  const ex = plan.weeks[weekIndex].days[dayIdx].sessions[sessionIdx].exercises[exIdx];
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
    const hint = trProgressionHint(plan, ex.name);
    const hintHtml = hint ? hint.html : '';
    fieldsHtml = `
      ${hintHtml}
      <div class="tr-modal-row">
        <label>Подходы<input type="number" id="m-sets" value="${ex.sets}" inputmode="numeric"></label>
        <label>Повторы<input type="number" id="m-reps" value="${ex.reps}" inputmode="numeric"></label>
        <label>Вес, кг<input type="number" id="m-weight" value="${ex.weight}" inputmode="numeric"></label>
      </div>
      <button type="button" class="tr-link-btn" id="m-toggle-sets">${ex.setDetails ? 'Скрыть' : 'Записать каждый подход отдельно'}</button>
      <div id="m-set-details-wrap">${ex.setDetails ? trBuildSetDetailsRows(ex.setDetails) : ''}</div>`;
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

  const toggleBtn = overlay.querySelector('#m-toggle-sets');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const wrap = overlay.querySelector('#m-set-details-wrap');
      if (wrap.innerHTML.trim()) {
        wrap.innerHTML = '';
        toggleBtn.textContent = 'Записать каждый подход отдельно';
      } else {
        const setsCount = parseInt(overlay.querySelector('#m-sets').value, 10) || 3;
        wrap.innerHTML = trBuildSetDetailsRows(ex.setDetails || Array.from({ length: setsCount }, () => ({ reps: ex.reps, weight: ex.weight })));
        toggleBtn.textContent = 'Скрыть';
      }
    });
  }

  overlay.addEventListener('click', (e) => {
    if (e.target.classList.contains('tr-set-add')) {
      const details = overlay.querySelector('.tr-set-details');
      const addBtn = details.querySelector('.tr-set-add');
      const row = document.createElement('div');
      row.className = 'tr-set-detail-row';
      const num = details.querySelectorAll('.tr-set-detail-row').length + 1;
      row.innerHTML = `
        <span class="tr-set-num">${num}</span>
        <input type="number" class="m-set-reps" value="" placeholder="повт." inputmode="numeric">
        <span class="tr-set-x">×</span>
        <input type="number" class="m-set-weight" value="" placeholder="кг" inputmode="decimal" step="0.5">
        <button type="button" class="tr-set-remove" aria-label="Удалить подход">×</button>`;
      details.insertBefore(row, addBtn);
    }
    if (e.target.classList.contains('tr-set-remove')) {
      e.target.closest('.tr-set-detail-row').remove();
      overlay.querySelectorAll('.tr-set-detail-row').forEach((row, i) => {
        row.querySelector('.tr-set-num').textContent = i + 1;
      });
    }
  });

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
      const detailRows = overlay.querySelectorAll('.tr-set-detail-row');
      if (detailRows.length > 0) {
        const setDetails = Array.from(detailRows).map(row => ({
          reps: parseInt(row.querySelector('.m-set-reps').value, 10) || 0,
          weight: parseFloat(row.querySelector('.m-set-weight').value) || 0
        }));
        ex.setDetails = setDetails;
        ex.sets = setDetails.length;
        ex.reps = Math.round(setDetails.reduce((s, d) => s + d.reps, 0) / setDetails.length) || 0;
        ex.weight = Math.round((setDetails.reduce((s, d) => s + d.weight, 0) / setDetails.length) * 10) / 10 || 0;
      } else {
        ex.sets = parseInt(overlay.querySelector('#m-sets').value, 10) || 0;
        ex.reps = parseInt(overlay.querySelector('#m-reps').value, 10) || 0;
        ex.weight = parseFloat(overlay.querySelector('#m-weight').value) || 0;
        delete ex.setDetails;
      }
    }
    overlay.remove();
    onSave();
  });
  overlay.querySelector('#m-delete').addEventListener('click', () => {
    plan.weeks[weekIndex].days[dayIdx].sessions[sessionIdx].exercises.splice(exIdx, 1);
    overlay.remove();
    onSave();
  });
}

function trBuildSetDetailsRows(setDetails) {
  return `
    <div class="tr-set-details">
      ${setDetails.map((d, i) => `
        <div class="tr-set-detail-row">
          <span class="tr-set-num">${i + 1}</span>
          <input type="number" class="m-set-reps" value="${d.reps}" placeholder="повт." inputmode="numeric">
          <span class="tr-set-x">×</span>
          <input type="number" class="m-set-weight" value="${d.weight}" placeholder="кг" inputmode="decimal" step="0.5">
          <button type="button" class="tr-set-remove" aria-label="Удалить подход">×</button>
        </div>
      `).join('')}
      <button type="button" class="tr-link-btn tr-set-add">+ Добавить подход</button>
    </div>`;
}

function trWeightHint(plan, exerciseName) {
  const { last } = trCollectExerciseHistory(plan, exerciseName);
  if (!last || last.ex.kind !== 'strength') return null;
  const suggested = Math.round((last.ex.weight + last.ex.weight * 0.05) * 2) / 2;
  return `Последний раз: ${last.ex.sets} × ${last.ex.reps} × ${last.ex.weight} кг. Можно попробовать ~${suggested} кг.`;
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

function trBuildFormFields(typeName, selectedGroups, plan) {
  if (trIsRestType(typeName)) {
    return `<p style="font-size:13px; color:var(--tr-bone-faint); margin:4px 0 0;">День отмечен как отдых. Упражнения не нужны.</p>`;
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
      </div>
      <p class="tr-hint" id="m-weight-hint"></p>`;
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

function trOpenAddExerciseToSessionModal(plan, weekIndex, dayIdx, sessionIdx, onSave) {
  const day = plan.weeks[weekIndex].days[dayIdx];
  const session = day.sessions[sessionIdx];
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';
  overlay.innerHTML = `
    <div class="tr-modal">
      <p class="tr-modal-title">${day.date} ${day.dow} · ${session.type}</p>
      <div id="m-fields-wrap">${trBuildFormFields(session.type, session.groups, plan)}</div>
      <div class="tr-modal-actions">
        <button class="tr-modal-btn-secondary" id="m-cancel">Отмена</button>
        <button class="tr-modal-btn-primary" id="m-save">Добавить</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#m-cancel').addEventListener('click', () => overlay.remove());

  function selectedGroupsNow() {
    const checked = Array.from(overlay.querySelectorAll('.m-group-cb:checked')).map(cb => cb.value);
    return checked.length ? checked : session.groups;
  }

  function updateWeightHint() {
    const hintEl = overlay.querySelector('#m-weight-hint');
    const nameEl = overlay.querySelector('#m-name-wrap #m-name');
    if (!hintEl || !nameEl || !nameEl.value || nameEl.value === '__custom__') {
      if (hintEl) hintEl.innerHTML = '';
      return;
    }
    const hint = trProgressionHint(plan, nameEl.value);
    hintEl.innerHTML = hint ? hint.html : '';
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
      } else {
        updateWeightHint();
      }
    });
    updateWeightHint();
  }
  bindNameSelect();

  overlay.querySelector('#m-save').addEventListener('click', () => {
    const type = session.type;
    if (trIsGymType(type)) {
      const groups = selectedGroupsNow();
      const name = overlay.querySelector('#m-name').value.trim();
      if (!name) return;
      session.groups = groups;
      session.exercises.push({
        kind: 'strength',
        name,
        sets: parseInt(overlay.querySelector('#m-sets').value, 10) || 0,
        reps: parseInt(overlay.querySelector('#m-reps').value, 10) || 0,
        weight: parseFloat(overlay.querySelector('#m-weight').value) || 0
      });
    } else if (trIsCardioType(type)) {
      const direction = overlay.querySelector('#m-cardio-dir').value;
      session.exercises.push({
        kind: 'cardio', name: direction,
        distance: parseFloat(overlay.querySelector('#m-distance').value) || 0,
        duration: parseFloat(overlay.querySelector('#m-duration').value) || 0
      });
    } else if (trIsTimeCalorieType(type)) {
      session.exercises.push({
        kind: 'time_calorie', name: type,
        duration: parseFloat(overlay.querySelector('#m-duration').value) || 0,
        calories: parseFloat(overlay.querySelector('#m-calories').value) || 0
      });
    } else if (trIsStepsType(type)) {
      session.exercises.push({
        kind: 'steps', name: type,
        steps: parseInt(overlay.querySelector('#m-steps').value, 10) || 0
      });
    }
    overlay.remove();
    onSave();
  });
}

function trOpenAddModal(plan, weekIndex, dayIdx, onSave) {
  const day = plan.weeks[weekIndex].days[dayIdx];
  trMigrateDayToSessions(day);
  const initialType = TRAINING_TYPES[0].name;
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';
  overlay.innerHTML = `
    <div class="tr-modal">
      <p class="tr-modal-title">${day.date} ${day.dow}${day.sessions.length > 0 ? ' · новая тренировка' : ''}</p>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Тип${trBuildSelect('m-type', TRAINING_TYPES, initialType)}</label>
      </div>
      <div id="m-fields-wrap">${trBuildFormFields(initialType, [], plan)}</div>
      <div class="tr-modal-actions">
        <button class="tr-modal-btn-secondary" id="m-cancel">Отмена</button>
        <button class="tr-modal-btn-primary" id="m-save">${trIsRestType(initialType) ? 'Отметить отдых' : 'Добавить'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#m-cancel').addEventListener('click', () => overlay.remove());

  function currentType() {
    return overlay.querySelector('#m-type').value;
  }

  function selectedGroupsNow() {
    return Array.from(overlay.querySelectorAll('.m-group-cb:checked')).map(cb => cb.value);
  }

  function updateWeightHint() {
    const hintEl = overlay.querySelector('#m-weight-hint');
    const nameEl = overlay.querySelector('#m-name-wrap #m-name');
    if (!hintEl || !nameEl || !nameEl.value || nameEl.value === '__custom__') {
      if (hintEl) hintEl.innerHTML = '';
      return;
    }
    const hint = trProgressionHint(plan, nameEl.value);
    hintEl.innerHTML = hint ? hint.html : '';
  }

  function refreshFields() {
    const type = currentType();
    overlay.querySelector('#m-fields-wrap').innerHTML = trBuildFormFields(type, [], plan);
    overlay.querySelector('#m-save').textContent = trIsRestType(type) ? 'Отметить отдых' : 'Добавить';
    bindGroupCheckboxes();
    bindNameSelect();
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
      } else {
        updateWeightHint();
      }
    });
    updateWeightHint();
  }
  bindNameSelect();

  overlay.querySelector('#m-type').addEventListener('change', refreshFields);

  overlay.querySelector('#m-save').addEventListener('click', () => {
    const type = currentType();

    if (trIsRestType(type)) {
      day.sessions.push({ type, groups: [], exercises: [] });
      overlay.remove();
      onSave();
      return;
    }

    if (trIsGymType(type)) {
      const groups = selectedGroupsNow();
      if (groups.length === 0) return;
      const name = overlay.querySelector('#m-name').value.trim();
      if (!name) return;
      day.sessions.push({
        type, groups,
        exercises: [{
          kind: 'strength',
          name,
          sets: parseInt(overlay.querySelector('#m-sets').value, 10) || 0,
          reps: parseInt(overlay.querySelector('#m-reps').value, 10) || 0,
          weight: parseFloat(overlay.querySelector('#m-weight').value) || 0
        }]
      });
      overlay.remove();
      onSave();
      return;
    }

    if (trIsCardioType(type)) {
      const direction = overlay.querySelector('#m-cardio-dir').value;
      const distance = parseFloat(overlay.querySelector('#m-distance').value) || 0;
      const duration = parseFloat(overlay.querySelector('#m-duration').value) || 0;
      day.sessions.push({ type, groups: [], exercises: [{ kind: 'cardio', name: direction, distance, duration }] });
      overlay.remove();
      onSave();
      return;
    }

    if (trIsTimeCalorieType(type)) {
      const duration = parseFloat(overlay.querySelector('#m-duration').value) || 0;
      const calories = parseFloat(overlay.querySelector('#m-calories').value) || 0;
      day.sessions.push({ type, groups: [], exercises: [{ kind: 'time_calorie', name: type, duration, calories }] });
      overlay.remove();
      onSave();
      return;
    }

    if (trIsStepsType(type)) {
      const steps = parseInt(overlay.querySelector('#m-steps').value, 10) || 0;
      day.sessions.push({ type, groups: [], exercises: [{ kind: 'steps', name: type, steps }] });
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
        <span style="display:flex; align-items:center; gap:8px;">
          <button class="tr-back tr-undo-btn" id="tr-undo" title="Отменить последнее действие"><i class="ti ti-arrow-back-up"></i></button>
          ${role === 'coach'
            ? `<span class="tr-role-badge">Тренер</span><button class="tr-back tr-logout-btn" id="tr-logout"><i class="ti ti-logout"></i> Выйти</button>`
            : `<button class="tr-back" id="tr-logout"><i class="ti ti-logout"></i></button>`}
        </span>
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

  function findCurrentWeekIndex(plan) {
    /* Определяем индекс текущей недели по дате */
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < plan.weeks.length; i++) {
      const week = plan.weeks[i];
      if (!week.range) continue;
      /* range формат: "01.07 – 07.07" */
      const parts = week.range.split(' – ');
      if (parts.length < 2) continue;
      /* Парсим дату конца недели */
      const endParts = parts[1].split('.');
      if (endParts.length < 2) continue;
      const endDay = parseInt(endParts[0]);
      const endMonth = parseInt(endParts[1]) - 1;
      const endYear = today.getFullYear();
      const weekEnd = new Date(endYear, endMonth, endDay);
      weekEnd.setHours(23, 59, 59);
      /* Парсим дату начала */
      const startParts = parts[0].split('.');
      const startDay = parseInt(startParts[0]);
      const startMonth = parseInt(startParts[1]) - 1;
      const weekStart = new Date(endYear, startMonth, startDay);
      weekStart.setHours(0, 0, 0, 0);
      if (today >= weekStart && today <= weekEnd) return i;
    }
    return -1; /* не найдена */
  }

  function loadCollapsedWeeks(planId, plan) {
    try {
      const raw = localStorage.getItem(collapsedWeeksKey(planId));
      if (raw) return JSON.parse(raw);
      /* Первый раз: сворачиваем все кроме текущей недели */
      if (!plan) return [];
      const currentIdx = findCurrentWeekIndex(plan);
      return plan.weeks.map((_, i) => i).filter(i => i !== currentIdx);
    } catch (e) {
      return [];
    }
  }

  function saveCollapsedWeeks(planId, weeks) {
    try {
      localStorage.setItem(collapsedWeeksKey(planId), JSON.stringify(weeks));
    } catch (e) { /* ignore */ }
  }

  let collapsedWeeks = loadCollapsedWeeks(currentPlanId, trGetPlans().find(p => p.id === currentPlanId));

  function trOpenMoveModal(plan, srcWeek, srcDay, srcSession, onSave) {
    /* Строим список всех дней плана для выбора */
    const options = [];
    plan.weeks.forEach((w, wi) => {
      w.days.forEach((d, di) => {
        if (wi === srcWeek && di === srcDay) return; /* пропускаем текущий */
        options.push({ wi, di, label: `Неделя ${wi+1} · ${d.date} ${d.dow}` });
      });
    });

    const overlay = document.createElement('div');
    overlay.className = 'tr-modal-overlay';
    overlay.innerHTML = `
      <div class="tr-modal" style="max-height:70vh; overflow-y:auto;">
        <p class="tr-modal-title"><i class="ti ti-calendar-share"></i> Перенести тренировку</p>
        <p style="font-size:13px; color:#9D9A92; margin-bottom:12px;">Выберите день назначения:</p>
        <div id="move-day-list">
          ${options.map((o, i) => `
            <button class="tr-move-day-opt" data-wi="${o.wi}" data-di="${o.di}" style="width:100%; text-align:left; padding:10px 12px; background:#1C1E24; border:0.5px solid #2A2D35; border-radius:8px; color:#E8E5DC; font-size:13px; cursor:pointer; margin-bottom:6px;">
              ${o.label}
            </button>`).join('')}
        </div>
        <div class="tr-modal-actions">
          <button class="tr-modal-btn-secondary" id="move-cancel">Отмена</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#move-cancel').addEventListener('click', () => overlay.remove());

    overlay.querySelectorAll('.tr-move-day-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const tgtW = parseInt(btn.dataset.wi);
        const tgtD = parseInt(btn.dataset.di);
        trSnapshotBeforeChange();

        /* Вырезаем сессию из источника */
        const srcSessions = plan.weeks[srcWeek].days[srcDay].sessions;
        const [movedSession] = srcSessions.splice(srcSession, 1);

        /* Вставляем в целевой день */
        trMigrateDayToSessions(plan.weeks[tgtW].days[tgtD]);
        plan.weeks[tgtW].days[tgtD].sessions.push(movedSession);

        trSavePlans(trGetPlans().map(p => p.id === plan.id ? plan : p));
        overlay.remove();
        onSave();
      });
    });
  }

  function bindPlanEvents(plan) {
    /* Комментарий к дню */
    content.querySelectorAll('.tr-day-comment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = parseInt(btn.dataset.week, 10), d = parseInt(btn.dataset.day, 10);
        const day = plan.weeks[w].days[d];
        const current = day.comment || '';
        const newComment = prompt('Заметка к дню (оставь пустым чтобы удалить):', current);
        if (newComment === null) return;
        trSnapshotBeforeChange();
        day.comment = newComment.trim();
        const planIdx = trGetPlans().findIndex(p => p.id === plan.id);
        /* Пустой коммент = удаление */
        Store.set('training.plans.' + planIdx + '.weeks.' + w + '.days.' + d + '.comment', day.comment || null);
        renderTab('plan');
      });
    });

    /* ── Drag-and-drop сортировка упражнений ───────────────── */
    let _dragSrc = null;

    /* ── Drag-and-drop: mouse (desktop) + touch (mobile) ── */
    let _touchSrc = null;
    let _touchClone = null;

    content.querySelectorAll('.tr-drag-handle').forEach(handle => {
      const wrap = handle.closest('.tr-exercise-wrap');

      /* Desktop */
      handle.addEventListener('mousedown', () => { wrap.draggable = true; });

      /* Mobile touch */
      handle.addEventListener('touchstart', (e) => {
        e.preventDefault();
        _touchSrc = wrap;
        wrap.classList.add('tr-dragging');
        /* Клон для визуальной подсказки */
        _touchClone = wrap.cloneNode(true);
        _touchClone.style.cssText = 'position:fixed; opacity:0.8; pointer-events:none; z-index:9999; width:' + wrap.offsetWidth + 'px; background:#1C1E24; border:1px solid #2E7FD4; border-radius:8px;';
        document.body.appendChild(_touchClone);
      }, { passive: false });
    });

    document.addEventListener('touchmove', (e) => {
      if (!_touchSrc) return;
      e.preventDefault();
      const t = e.touches[0];
      if (_touchClone) {
        _touchClone.style.left = (t.clientX - 20) + 'px';
        _touchClone.style.top = (t.clientY - 20) + 'px';
      }
      /* Найти элемент под пальцем */
      _touchClone && (_touchClone.style.display = 'none');
      const el = document.elementFromPoint(t.clientX, t.clientY);
      _touchClone && (_touchClone.style.display = '');
      const tgtWrap = el && el.closest('.tr-exercise-wrap');
      content.querySelectorAll('.tr-exercise-wrap').forEach(w => w.classList.remove('tr-drag-over'));
      if (tgtWrap && tgtWrap !== _touchSrc) tgtWrap.classList.add('tr-drag-over');
    }, { passive: false });

    document.addEventListener('touchend', (e) => {
      if (!_touchSrc) return;
      if (_touchClone) { _touchClone.remove(); _touchClone = null; }
      const t = e.changedTouches[0];
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const tgtWrap = el && el.closest('.tr-exercise-wrap');
      content.querySelectorAll('.tr-exercise-wrap').forEach(w => w.classList.remove('tr-drag-over'));
      _touchSrc.classList.remove('tr-dragging');
      _touchSrc.draggable = false;

      if (tgtWrap && tgtWrap !== _touchSrc) {
        const srcW = parseInt(_touchSrc.dataset.week, 10);
        const srcD = parseInt(_touchSrc.dataset.day, 10);
        const srcS = parseInt(_touchSrc.dataset.session, 10);
        const srcEx = parseInt(_touchSrc.dataset.ex, 10);
        const tgtW = parseInt(tgtWrap.dataset.week, 10);
        const tgtD = parseInt(tgtWrap.dataset.day, 10);
        const tgtS = parseInt(tgtWrap.dataset.session, 10);
        const tgtEx = parseInt(tgtWrap.dataset.ex, 10);
        if (srcW === tgtW && srcD === tgtD && srcS === tgtS) {
          trSnapshotBeforeChange();
          const exercises = plan.weeks[srcW].days[srcD].sessions[srcS].exercises;
          const [moved] = exercises.splice(srcEx, 1);
          exercises.splice(tgtEx, 0, moved);
          trSavePlans(trGetPlans().map(p => p.id === plan.id ? plan : p));
          renderTab('plan');
        }
      }
      _touchSrc = null;
    });

    content.querySelectorAll('.tr-exercise-wrap').forEach(wrap => {
      wrap.addEventListener('dragstart', (e) => {
        _dragSrc = wrap;
        wrap.classList.add('tr-dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      wrap.addEventListener('dragend', () => {
        wrap.draggable = false;
        wrap.classList.remove('tr-dragging');
        content.querySelectorAll('.tr-exercise-wrap').forEach(w => w.classList.remove('tr-drag-over'));
        _dragSrc = null;
      });

      wrap.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!_dragSrc || _dragSrc === wrap) return;
        const srcW = parseInt(_dragSrc.dataset.week, 10);
        const srcD = parseInt(_dragSrc.dataset.day, 10);
        const srcS = parseInt(_dragSrc.dataset.session, 10);
        const tgtW = parseInt(wrap.dataset.week, 10);
        const tgtD = parseInt(wrap.dataset.day, 10);
        const tgtS = parseInt(wrap.dataset.session, 10);
        if (srcW !== tgtW || srcD !== tgtD || srcS !== tgtS) return;
        e.dataTransfer.dropEffect = 'move';
        content.querySelectorAll('.tr-exercise-wrap').forEach(w => w.classList.remove('tr-drag-over'));
        wrap.classList.add('tr-drag-over');
      });

      wrap.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!_dragSrc || _dragSrc === wrap) return;
        const srcW = parseInt(_dragSrc.dataset.week, 10);
        const srcD = parseInt(_dragSrc.dataset.day, 10);
        const srcS = parseInt(_dragSrc.dataset.session, 10);
        const srcEx = parseInt(_dragSrc.dataset.ex, 10);
        const tgtW = parseInt(wrap.dataset.week, 10);
        const tgtD = parseInt(wrap.dataset.day, 10);
        const tgtS = parseInt(wrap.dataset.session, 10);
        const tgtEx = parseInt(wrap.dataset.ex, 10);
        if (srcW !== tgtW || srcD !== tgtD || srcS !== tgtS) return;

        trSnapshotBeforeChange();
        const exercises = plan.weeks[srcW].days[srcD].sessions[srcS].exercises;
        const [moved] = exercises.splice(srcEx, 1);
        exercises.splice(tgtEx, 0, moved);
        trSavePlans(trGetPlans().map(p => p.id === plan.id ? plan : p));
        renderTab('plan');
      });
    });

    content.querySelectorAll('.tr-exercise').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = parseInt(btn.dataset.week, 10);
        const d = parseInt(btn.dataset.day, 10);
        const s = parseInt(btn.dataset.session, 10);
        const ex = parseInt(btn.dataset.ex, 10);
        trSnapshotBeforeChange();
        trOpenExerciseModal(plan, w, d, s, ex, () => {
          trSavePlans(trGetPlans().map(p => p.id === plan.id ? plan : p));
          renderTab('plan');
        });
      });
    });
    content.querySelectorAll('.tr-session-move').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = parseInt(btn.dataset.week, 10);
        const d = parseInt(btn.dataset.day, 10);
        const s = parseInt(btn.dataset.session, 10);
        trOpenMoveModal(plan, w, d, s, () => renderTab('plan'));
      });
    });

    content.querySelectorAll('.tr-session-add-ex').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = parseInt(btn.dataset.week, 10);
        const d = parseInt(btn.dataset.day, 10);
        const s = parseInt(btn.dataset.session, 10);
        trSnapshotBeforeChange();
        trOpenAddExerciseToSessionModal(plan, w, d, s, () => {
          trSavePlans(trGetPlans().map(p => p.id === plan.id ? plan : p));
          renderTab('plan');
        });
      });
    });
    content.querySelectorAll('.tr-day-clear').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = parseInt(btn.dataset.week, 10);
        const d = parseInt(btn.dataset.day, 10);
        const s = parseInt(btn.dataset.session, 10);
        if (!confirm('Удалить эту тренировку из дня?')) return;
        trSnapshotBeforeChange();
        plan.weeks[w].days[d].sessions.splice(s, 1);
        trSavePlans(trGetPlans().map(p => p.id === plan.id ? plan : p));
        renderTab('plan');
      });
    });
    content.querySelectorAll('.tr-day-add:not(.tr-day-clear):not(.tr-session-add-ex)').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = parseInt(btn.dataset.week, 10);
        const d = parseInt(btn.dataset.day, 10);
        trSnapshotBeforeChange();
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

  const undoBtn = document.getElementById('tr-undo');
  function refreshUndoState() {
    if (!undoBtn) return;
    undoBtn.disabled = !trUndoAvailable();
    undoBtn.style.opacity = trUndoAvailable() ? '1' : '0.35';
  }

  function renderTab(tab) {
    refreshUndoState();
    let plan = getPlan();

    /* Выбранный план не найден, но другие планы есть — переключаемся на
       активный/последний (без создания и записи чего-либо). */
    if (!plan) {
      const fallbackId = trEnsureSeedPlan();
      if (fallbackId) {
        currentPlanId = fallbackId;
        populatePlanSelect();
        plan = getPlan();
      }
    }

    if (!plan || !plan.weeks) {
      const hasAnyPlan = trGetPlans().length > 0;
      if (!hasAnyPlan) {
        /* Планов нет вообще. Ничего не пишем в хранилище — просто показываем
           понятное состояние. Данные восстанавливаются из data.json (см. app.js),
           либо владелец создаёт план кнопкой «Новый план». */
        content.innerHTML = `<div style="padding:60px 20px;text-align:center;color:#9D9A92;font-size:13px;line-height:1.7;letter-spacing:0.02em;">
          Планов пока нет.${role === 'owner' ? '<br>Нажми «Новый план», чтобы создать первый.' : ''}
        </div>`;
        return;
      }
      /* Планы есть, но данные ещё не догрузились — одна попытка перезагрузки. */
      content.innerHTML = '<div style="padding:60px 20px;text-align:center;color:#9D9A92;font-size:13px;letter-spacing:0.03em;">Загрузка данных…</div>';
      if (window.FirebaseSync && FirebaseSync.isConfigured()) {
        FirebaseSync.pullIntoStore().then(() => {
          currentPlanId = trEnsureSeedPlan() || currentPlanId;
          populatePlanSelect();
          renderTab(tab);
        });
      }
      return;
    }

    if (tab === 'plan') {
      content.innerHTML = trRenderPlanTab(plan, collapsedWeeks);
      trAnimateBars(content);
      bindPlanEvents(plan);
    } else if (tab === 'working-weight') {
      content.innerHTML = trRenderWorkingWeight(plan);
      const wwEditBtn = document.getElementById('tr-edit-exercises-ww');
      if (wwEditBtn) wwEditBtn.addEventListener('click', () => trOpenExerciseEditor());
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
      content.querySelectorAll('.tr-measure-edit').forEach(btn => {
        if (role === 'coach') { btn.style.display = 'none'; return; }
        btn.addEventListener('click', () => {
          trOpenMeasureModal(() => renderTab('summary'), parseInt(btn.dataset.idx, 10));
        });
      });
    } else if (tab === 'nutrition') {
      content.innerHTML = trRenderNutrition(plan);
      /* Кнопка цели — вешаем здесь где content доступен */
      const goalBtn = content.querySelector('.nutr-edit-goal-btn');
      if (goalBtn) {
        if (role === 'coach') {
          goalBtn.style.display = 'none';
        } else {
          goalBtn.addEventListener('click', () => {
            trOpenNutritionModal(plan, () => {
              const planIdx = trGetPlans().findIndex(p => p.id === plan.id);
              Store.set('training.plans.' + planIdx + '.nutrition', plan.nutrition);
              renderTab('nutrition');
            });
          });
        }
      }
      const editBtn = document.getElementById('tr-edit-nutrition');
      if (editBtn) {
        if (role === 'coach') {
          editBtn.style.display = 'none';
        } else {
          editBtn.addEventListener('click', () => {
            trSnapshotBeforeChange();
            trOpenNutritionModal(plan, () => {
              trSavePlans(trGetPlans().map(p => p.id === plan.id ? plan : p));
              renderTab('nutrition');
            });
          });
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
    collapsedWeeks = loadCollapsedWeeks(currentPlanId, trGetPlans().find(p => p.id === currentPlanId));
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

  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      if (!confirm('Отменить последнее изменение?')) return;
      const ok = trUndoLastChange();
      if (ok) {
        populatePlanSelect();
        refreshUndoState();
        renderTab(document.querySelector('.tr-tab.active')?.dataset.tab || 'plan');
      }
    });
  }

  renderTab('plan');

  /* Данные обновились с Firebase (тренер добавил тренировку) */
  function _onRemoteUpdate() {
    populatePlanSelect();
    renderTab(document.querySelector('.tr-tab.active')?.dataset.tab || 'plan');
  }
  window.addEventListener('firebase-remote-update', _onRemoteUpdate);

  /* Чистим listener при уходе с экрана */
  const _obs = new MutationObserver(() => {
    if (!document.contains(mount)) {
      window.removeEventListener('firebase-remote-update', _onRemoteUpdate);
      _obs.disconnect();
    }
  });
  if (mount.parentElement) _obs.observe(mount.parentElement, { childList: true });
};

function trLastFilledWeekIndex(plan) {
  for (let i = plan.weeks.length - 1; i >= 0; i--) {
    const hasData = plan.weeks[i].days.some(d => d.exercises.length > 0);
    if (hasData) return i;
  }
  return 0;
}

function trExerciseCanonicalGroups(exName) {
  /* Определяем группу упражнения по каноническому списку.
     Если упражнение в нескольких группах — берём первую. */
  for (const [group, list] of Object.entries(MUSCLE_BLOCK_EXERCISES)) {
    if (list.includes(exName)) return [group];
  }
  return null; /* кастомное — определится по сессии */
}

function trCollectGymExercises(plan) {
  const latest = {};
  plan.weeks.forEach((week, weekIndex) => {
    week.days.forEach((day, dayIdx) => {
      trMigrateDayToSessions(day);
      day.sessions.forEach((session, sessionIdx) => {
        if (!trIsGymType(session.type)) return;
        session.exercises.forEach((ex, exIdx) => {
          if (ex.kind !== 'strength') return;
          /* Группа: ТОЛЬКО по каноническому списку упражнений.
             Группы сессии (напр "Спина+Руки") не используем — они для отображения дня,
             а не для определения к какой мышце относится упражнение. */
          const canonical = trExerciseCanonicalGroups(ex.name);
          const groups = canonical || ['Разное'];
          latest[ex.name] = { ex, weekIndex, dayIdx, sessionIdx, exIdx, groups };
        });
      });
    });
  });
  return latest;
}

const WORKING_WEIGHT_CATEGORIES = ['Грудь', 'Спина', 'Ноги', 'Руки', 'Плечи'];

function trRenderWorkingWeight(plan) {
  const latest = trCollectGymExercises(plan);
  const names = Object.keys(latest);
  if (names.length === 0) {
    return `<div class="tr-empty-state"><i class="ti ti-weight"></i>Рабочий вес появится здесь после первой записи в зале.</div>`;
  }

  /* Строим секции строго по порядку MUSCLE_BLOCK_EXERCISES.
     Упражнение попадает в секцию если:
     1) оно есть в каноническом списке группы, ИЛИ
     2) оно было записано с этой группой (для кастомных упражнений) */
  const rows = WORKING_WEIGHT_CATEGORIES.map(cat => {
    const canonicalList = MUSCLE_BLOCK_EXERCISES[cat] || [];

    /* Упражнения этой группы в каноническом порядке */
    const inOrder = canonicalList.filter(name => latest[name]);

    /* Кастомные упражнения записанные с этой группой но не в каноническом списке */
    const custom = names.filter(name => {
      if (canonicalList.includes(name)) return false;
      const groups = latest[name].groups || [];
      const expanded = groups.includes('FULL BODY') ? WORKING_WEIGHT_CATEGORIES : groups;
      return expanded.includes(cat);
    });

    const allForCat = [...inOrder, ...custom];
    if (allForCat.length === 0) return '';

    const exerciseRows = allForCat.map(name => {
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
        <div class="tr-ww-group-label fb-accent">${cat}</div>
        <table class="tr-ww-table">
          <thead><tr><th>Упражнение</th><th>Подх.</th><th>Повт.</th><th>Вес</th><th>Прогресс</th></tr></thead>
          <tbody>${exerciseRows}</tbody>
        </table>
      </div>`;
  }).filter(Boolean).join('');

  return `<div>
    <div style="display:flex; justify-content:flex-end; margin-bottom:8px;">
      <button id="tr-edit-exercises-ww" style="font-size:11px; color:#9D9A92; background:none; border:1px solid #2A2D35; border-radius:6px; padding:4px 10px; cursor:pointer;">⚙ Редактор упражнений</button>
    </div>
    <div class="tr-ww-wrap">${rows || '<div class="tr-empty-state">Нет данных</div>'}</div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════
   ДНЕВНИК ПИТАНИЯ
   Структура в Firebase: nik-data/nutrition/{YYYY-MM-DD}/{meal}/{idx}
   Приёмы: breakfast, lunch, dinner, snack
   ═══════════════════════════════════════════════════════ */

const MEAL_NAMES = {
  breakfast: { ru: 'Завтрак', icon: 'ti-sun' },
  lunch:     { ru: 'Обед',    icon: 'ti-sun-high' },
  dinner:    { ru: 'Ужин',    icon: 'ti-moon' },
  snack:     { ru: 'Перекус', icon: 'ti-apple' }
};
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

function nutrTodayKey() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function nutrDateKey(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function nutrFormatDate(key) {
  const [y, m, day] = key.split('-');
  const days = ['вс','пн','вт','ср','чт','пт','сб'];
  const d = new Date(parseInt(y), parseInt(m)-1, parseInt(day));
  return `${day}.${m}, ${days[d.getDay()]}`;
}

function nutrGetLog() {
  return Store.get().nutrition || {};
}

function nutrGetDay(dateKey) {
  const log = nutrGetLog();
  return log[dateKey] || { breakfast:[], lunch:[], dinner:[], snack:[] };
}

function nutrSaveDay(dateKey, dayData) {
  Store.set('nutrition.' + dateKey, dayData);
}

function nutrCalc(items) {
  return items.reduce((acc, item) => {
    const factor = (item.grams || 100) / 100;
    acc.kcal += Math.round((item.kcal || 0) * factor);
    acc.protein += Math.round((item.protein || 0) * factor * 10) / 10;
    acc.fat += Math.round((item.fat || 0) * factor * 10) / 10;
    acc.carbs += Math.round((item.carbs || 0) * factor * 10) / 10;
    return acc;
  }, { kcal: 0, protein: 0, fat: 0, carbs: 0 });
}

function nutrDayTotal(dayData) {
  const all = MEAL_ORDER.flatMap(m => dayData[m] || []);
  return nutrCalc(all);
}

/* Поиск: сначала своя база (Firebase), потом Open Food Facts */
async function nutrSearch(query) {
  const results = [];

  /* 1. Своя база */
  const custom = Store.get().nutritionFoods || [];
  const lq = query.toLowerCase();
  custom.filter(f => f.name.toLowerCase().includes(lq)).forEach(f => {
    results.push({ ...f, source: 'custom' });
  });

  /* 2. Open Food Facts */
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&lc=ru&cc=ru`;
    const res = await fetch(url);
    const data = await res.json();
    (data.products || []).forEach(p => {
      const n = p.nutriments || {};
      const kcal = Math.round(n['energy-kcal_100g'] || n['energy_100g'] / 4.184 || 0);
      if (!kcal || !p.product_name) return;
      results.push({
        name: p.product_name_ru || p.product_name,
        kcal,
        protein: Math.round((n.proteins_100g || 0) * 10) / 10,
        fat: Math.round((n.fat_100g || 0) * 10) / 10,
        carbs: Math.round((n.carbohydrates_100g || 0) * 10) / 10,
        source: 'off'
      });
    });
  } catch(e) { /* тихо */ }

  return results.slice(0, 8);
}

function nutrSaveToCustom(product) {
  const foods = Store.get().nutritionFoods || [];
  if (!foods.find(f => f.name === product.name)) {
    const newFood = { name: product.name, kcal: product.kcal, protein: product.protein, fat: product.fat, carbs: product.carbs };
    foods.push(newFood);
    /* Пишем каждый продукт по индексу чтобы не перезаписывать весь массив */
    Store.set('nutritionFoods.' + (foods.length - 1), newFood);
  }
}

function nutrGetFrequent() {
  /* Собираем все продукты из истории и сортируем по частоте использования */
  const log = nutrGetLog();
  const freq = {};
  Object.values(log).forEach(day => {
    MEAL_ORDER.forEach(meal => {
      (day[meal] || []).forEach(item => {
        if (!item || !item.name) return;
        if (!freq[item.name]) freq[item.name] = { ...item, count: 0 };
        freq[item.name].count++;
      });
    });
  });
  return Object.values(freq).sort((a, b) => b.count - a.count).slice(0, 15);
}

function nutrOpenAddModal(dateKey, meal, onSave) {
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';
  overlay.innerHTML = `
    <div class="tr-modal" style="max-height:88vh; overflow-y:auto; display:flex; flex-direction:column;">
      <p class="tr-modal-title"><i class="ti ${MEAL_NAMES[meal].icon}"></i> ${MEAL_NAMES[meal].ru}</p>

      <div class="nutr-search-row">
        <input type="text" id="nutr-q" placeholder="Поиск продукта…" autocomplete="off">
        <button id="nutr-search-btn" class="tr-modal-btn-primary" style="white-space:nowrap; padding:8px 12px;">Найти</button>
      </div>

      <div id="nutr-results"></div>

      <div id="nutr-frequent-wrap"></div>

      <div class="tr-modal-row" style="margin-top:8px;">
        <label style="flex:1 1 100%;">Граммы<input type="number" id="nutr-grams" value="100" inputmode="numeric"></label>
      </div>

      <details style="margin-top:4px;">
        <summary style="font-size:12px; color:#555; cursor:pointer; padding:6px 0;">+ добавить вручную</summary>
        <div style="margin-top:8px;">
          <div class="tr-modal-row">
            <label style="flex:1 1 100%">Название<input type="text" id="nutr-name" placeholder="Название продукта"></label>
          </div>
          <div class="tr-modal-row">
            <label>Ккал/100г<input type="number" id="nutr-kcal" inputmode="numeric"></label>
          </div>
          <div class="tr-modal-row">
            <label>Белки<input type="number" id="nutr-prot" inputmode="decimal" step="0.1"></label>
            <label>Жиры<input type="number" id="nutr-fat" inputmode="decimal" step="0.1"></label>
            <label>Углев<input type="number" id="nutr-carbs" inputmode="decimal" step="0.1"></label>
          </div>
        </div>
      </details>

      <div class="tr-modal-actions" style="margin-top:12px;">
        <button class="tr-modal-btn-secondary" id="nutr-cancel">Отмена</button>
        <button class="tr-modal-btn-primary" id="nutr-add">Добавить</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#nutr-cancel').addEventListener('click', () => overlay.remove());

  let selectedProduct = null;

  function fillManual(p, grams) {
    overlay.querySelector('#nutr-name').value = p.name;
    overlay.querySelector('#nutr-grams').value = grams || 100;
    overlay.querySelector('#nutr-kcal').value = p.kcal;
    overlay.querySelector('#nutr-prot').value = p.protein;
    overlay.querySelector('#nutr-fat').value = p.fat;
    overlay.querySelector('#nutr-carbs').value = p.carbs;
    selectedProduct = p;
  }

  function renderResultList(items, container, showCount) {
    if (!items.length) {
      container.innerHTML = '<div style="padding:8px; font-size:13px; color:#9D9A92;">Не найдено</div>';
      return;
    }
    container.innerHTML = items.map((p, i) => `
      <div class="nutr-result-item" data-idx="${i}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div class="nutr-result-name">${p.name}${p.source === 'custom' || showCount ? '' : ''}</div>
          <span class="nutr-result-kcal">${p.kcal} ккал</span>
        </div>
        <div class="nutr-result-meta">Б ${p.protein}г · Ж ${p.fat}г · У ${p.carbs}г · на 100г${showCount && p.count > 1 ? ' · ' + p.count + 'x' : ''}</div>
      </div>`).join('');
    container.querySelectorAll('.nutr-result-item').forEach((el, i) => {
      el.addEventListener('click', () => {
        fillManual(items[i], items[i].grams || 100);
        container.querySelectorAll('.nutr-result-item').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        overlay.querySelector('#nutr-results').querySelectorAll('.nutr-result-item').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
      });
    });
  }

  /* Часто используемые при открытии */
  const freqWrap = overlay.querySelector('#nutr-frequent-wrap');
  const frequent = nutrGetFrequent();
  if (frequent.length > 0) {
    freqWrap.innerHTML = '<div style="font-size:11px; color:#9D9A92; text-transform:uppercase; letter-spacing:0.05em; padding:10px 0 6px;">Часто используемые</div>';
    const listEl = document.createElement('div');
    freqWrap.appendChild(listEl);
    renderResultList(frequent, listEl, true);
  }

  async function doSearch() {
    const q = overlay.querySelector('#nutr-q').value.trim();
    if (!q) {
      overlay.querySelector('#nutr-results').innerHTML = '';
      return;
    }
    const resultsEl = overlay.querySelector('#nutr-results');
    freqWrap.style.display = 'none';
    resultsEl.innerHTML = '<div style="padding:8px; font-size:13px; color:#9D9A92;">Ищем…</div>';
    const res = await nutrSearch(q);
    if (res.length === 0) {
      resultsEl.innerHTML = '<div style="padding:8px; font-size:13px; color:#9D9A92;">Не найдено — добавьте вручную ↓</div>';
      return;
    }
    renderResultList(res, resultsEl, false);
  }

  overlay.querySelector('#nutr-search-btn').addEventListener('click', doSearch);
  overlay.querySelector('#nutr-q').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  overlay.querySelector('#nutr-q').addEventListener('input', e => {
    if (!e.target.value.trim()) {
      overlay.querySelector('#nutr-results').innerHTML = '';
      freqWrap.style.display = '';
    }
  });

  overlay.querySelector('#nutr-add').addEventListener('click', () => {
    const name = overlay.querySelector('#nutr-name').value.trim();
    const grams = parseFloat(overlay.querySelector('#nutr-grams').value) || 100;
    const kcal = parseFloat(overlay.querySelector('#nutr-kcal').value) || 0;
    const protein = parseFloat(overlay.querySelector('#nutr-prot').value) || 0;
    const fat = parseFloat(overlay.querySelector('#nutr-fat').value) || 0;
    const carbs = parseFloat(overlay.querySelector('#nutr-carbs').value) || 0;
    if (!name) return;
    const item = { name, grams, kcal, protein, fat, carbs };
    if (selectedProduct) nutrSaveToCustom(selectedProduct);
    const dayData = nutrGetDay(dateKey);
    dayData[meal] = [...(dayData[meal] || []), item];
    nutrSaveDay(dateKey, dayData);
    overlay.remove();
    onSave();
  });
}

function nutrRenderMacroBar(value, target, color) {
  const pct = target > 0 ? Math.min(100, Math.round(value / target * 100)) : 0;
  const low = target > 0 && pct < 80;
  return `<div class="nutr-bar-wrap">
    <div class="nutr-bar-fill" style="width:${pct}%; background:${color};"></div>
    ${low ? '<div class="nutr-bar-low"></div>' : ''}
  </div>`;
}

function nutrRenderDay(dateKey, plan, onUpdate) {
  const dayData = nutrGetDay(dateKey);
  const total = nutrDayTotal(dayData);
  const target = plan.nutrition || { totalKcal: 0, protein: 0, fat: 0, carbs: 0 };
  const isToday = dateKey === nutrTodayKey();

  const kcalPct = target.totalKcal > 0 ? Math.round(total.kcal / target.totalKcal * 100) : 0;
  const kcalLeft = target.totalKcal - total.kcal;
  const kcalColor = kcalLeft < 0 ? '#FF5C5C' : kcalLeft < 200 ? '#E0B873' : '#2E7FD4';

  const macrosHtml = `
    <div class="nutr-macros-grid">
      <div class="nutr-macro-card">
        <div class="nutr-macro-label">Калории</div>
        <div class="nutr-macro-val" style="color:${kcalColor}">${total.kcal}</div>
        <div class="nutr-macro-sub">${target.totalKcal > 0 ? `из ${target.totalKcal}` : 'цель не задана'}</div>
        ${nutrRenderMacroBar(total.kcal, target.totalKcal, kcalColor)}
      </div>
      <div class="nutr-macro-card">
        <div class="nutr-macro-label">Белки</div>
        <div class="nutr-macro-val" style="color:#A8C97F">${total.protein}г</div>
        <div class="nutr-macro-sub">${target.protein > 0 ? `из ${target.protein}г` : '—'}</div>
        ${nutrRenderMacroBar(total.protein, target.protein, '#A8C97F')}
      </div>
      <div class="nutr-macro-card">
        <div class="nutr-macro-label">Жиры</div>
        <div class="nutr-macro-val" style="color:#E0B873">${total.fat}г</div>
        <div class="nutr-macro-sub">${target.fat > 0 ? `из ${target.fat}г` : '—'}</div>
        ${nutrRenderMacroBar(total.fat, target.fat, '#E0B873')}
      </div>
      <div class="nutr-macro-card">
        <div class="nutr-macro-label">Углеводы</div>
        <div class="nutr-macro-val" style="color:#B6A4D9">${total.carbs}г</div>
        <div class="nutr-macro-sub">${target.carbs > 0 ? `из ${target.carbs}г` : '—'}</div>
        ${nutrRenderMacroBar(total.carbs, target.carbs, '#B6A4D9')}
      </div>
    </div>`;

  const mealsHtml = MEAL_ORDER.map(meal => {
    const items = dayData[meal] || [];
    const mealTotal = nutrCalc(items);
    const itemsHtml = items.map((item, idx) => `
      <div class="nutr-food-item">
        <div class="nutr-food-left">
          <div class="nutr-food-name">${item.name}</div>
          <div class="nutr-food-meta">Б${Math.round(item.protein * item.grams / 100 * 10)/10} · Ж${Math.round(item.fat * item.grams / 100 * 10)/10} · У${Math.round(item.carbs * item.grams / 100 * 10)/10}</div>
        </div>
        <div class="nutr-food-right">
          <input class="nutr-grams-inline" type="number" value="${item.grams}" min="1" data-meal="${meal}" data-idx="${idx}" style="width:52px; text-align:center; background:#0F1117; border:0.5px solid #2A2D35; border-radius:6px; color:#E8E5DC; font-size:12px; padding:3px 4px;">
          <span class="nutr-food-kcal" id="kcal-${meal}-${idx}">${Math.round(item.kcal * item.grams / 100)} ккал</span>
          <button class="nutr-delete-btn" data-meal="${meal}" data-idx="${idx}" title="Удалить"><i class="ti ti-trash"></i></button>
        </div>
      </div>`).join('');

    return `
      <div class="nutr-meal-block">
        <div class="nutr-meal-head">
          <span class="nutr-meal-title"><i class="ti ${MEAL_NAMES[meal].icon}"></i> ${MEAL_NAMES[meal].ru}</span>
          <span class="nutr-meal-kcal">${mealTotal.kcal} ккал</span>
          <button class="nutr-add-meal-btn" data-meal="${meal}"><i class="ti ti-plus"></i></button>
        </div>
        ${itemsHtml || '<div class="nutr-empty-meal">Нет записей</div>'}
      </div>`;
  }).join('');

  return { macrosHtml, mealsHtml, total, target };
}

function trRenderNutrition(plan) {
  const n = plan.nutrition || { protein: 0, fat: 0, carbs: 0, totalKcal: 0 };

  /* Текущий день и навигация */
  let dayOffset = 0;

  function getDateKey() { return nutrDateKey(dayOffset); }

  function renderAll() {
    const dateKey = getDateKey();
    const { macrosHtml, mealsHtml } = nutrRenderDay(dateKey, plan, renderAll);
    const wrap = document.getElementById('nutr-wrap');
    if (!wrap) return;

    wrap.innerHTML = `
      <div class="nutr-date-nav">
        <button id="nutr-prev"><i class="ti ti-chevron-left"></i></button>
        <span class="nutr-date-label">${dayOffset === 0 ? 'Сегодня' : nutrFormatDate(dateKey)}</span>
        <button id="nutr-next" ${dayOffset >= 0 ? 'disabled' : ''}><i class="ti ti-chevron-right"></i></button>
      </div>
      ${macrosHtml}
      ${mealsHtml}`;

    wrap.querySelector('#nutr-prev').addEventListener('click', () => { dayOffset--; renderAll(); });
    const nextBtn = wrap.querySelector('#nutr-next');
    if (nextBtn) nextBtn.addEventListener('click', () => { dayOffset++; renderAll(); });

    wrap.querySelectorAll('.nutr-add-meal-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        nutrOpenAddModal(getDateKey(), btn.dataset.meal, renderAll);
      });
    });

    wrap.querySelectorAll('.nutr-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const meal = btn.dataset.meal;
        const idx = parseInt(btn.dataset.idx);
        const dayData = nutrGetDay(getDateKey());
        dayData[meal].splice(idx, 1);
        nutrSaveDay(getDateKey(), dayData);
        renderAll();
      });
    });

    /* Inline редактирование граммов */
    wrap.querySelectorAll('.nutr-grams-inline').forEach(input => {
      input.addEventListener('change', () => {
        const meal = input.dataset.meal;
        const idx = parseInt(input.dataset.idx);
        const newGrams = parseFloat(input.value) || 100;
        const dayData = nutrGetDay(getDateKey());
        dayData[meal][idx].grams = newGrams;
        nutrSaveDay(getDateKey(), dayData);
        /* Обновляем только ккал без полного перерендера */
        const item = dayData[meal][idx];
        const kcalEl = wrap.querySelector('#kcal-' + meal + '-' + idx);
        if (kcalEl) kcalEl.textContent = Math.round(item.kcal * newGrams / 100) + ' ккал';
      });
    });
  }

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="tr-group-card" style="margin-bottom:12px;">
      <div class="tr-group-title fb-accent" style="display:flex; align-items:center;">
        Цель · план №${plan.number}
        <button class="nutr-edit-goal-btn" style="margin-left:auto; background:none; border:0.5px solid #2A2D35; border-radius:6px; color:#9D9A92; cursor:pointer; font-size:12px; padding:3px 8px;"><i class="ti ti-edit"></i> Изменить</button>
      </div>
      <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:8px;">
        <span style="font-size:13px; color:#2E7FD4;">${n.totalKcal} ккал</span>
        <span style="font-size:13px; color:#A8C97F;">Б ${n.protein}г</span>
        <span style="font-size:13px; color:#E0B873;">Ж ${n.fat}г</span>
        <span style="font-size:13px; color:#B6A4D9;">У ${n.carbs}г</span>
      </div>
    </div>
    <div id="nutr-wrap"></div>`;

  setTimeout(() => renderAll(), 0);
  return wrap.innerHTML;
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
      const found = trDayAllExercises(day).find(e => e.ex.name === exerciseName);
      if (found) {
        if (!first) first = { ex: found.ex, weekIndex };
        last = { ex: found.ex, weekIndex };
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

function trSumMetricAcrossPlan(plan, exerciseName, kind) {
  let sum = 0;
  let count = 0;
  plan.weeks.forEach(week => {
    week.days.forEach(day => {
      trDayAllExercises(day).forEach(({ ex }) => {
        if (ex.name !== exerciseName) return;
        if (kind === 'time_calorie') sum += ex.calories || 0;
        if (kind === 'steps') sum += ex.steps || 0;
        count++;
      });
    });
  });
  return { sum, count };
}

function trRenderWasNowRow(exerciseName, plan) {
  const { first, last } = trCollectExerciseHistory(plan, exerciseName);
  if (!first || !last) return '';

  // Calories and steps are summed across the whole plan, not "was -> now"
  if (first.ex.kind === 'time_calorie' || first.ex.kind === 'steps') {
    const kind = first.ex.kind;
    const { sum, count } = trSumMetricAcrossPlan(plan, exerciseName, kind);
    const label = kind === 'time_calorie' ? `${sum.toLocaleString('ru-RU')} ккал всего` : `${sum.toLocaleString('ru-RU')} шагов всего`;
    return `
      <div class="tr-exercise" style="cursor:default">
        <div class="tr-ex-top">
          <div class="tr-ex-name">${exerciseName}</div>
          <div class="tr-ex-stats"><span class="tr-ex-weight num">${label}</span></div>
        </div>
        <div class="tr-ex-bottom"><div class="tr-ex-meta num">${count} ${count === 1 ? 'запись' : 'записей'}</div></div>
      </div>`;
  }

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

function trRenderWasNowWeightRow(exerciseName, plan) {
  /* Показываем прогрессию рабочего веса: неделя 1 → текущая */
  let first = null, last = null;
  plan.weeks.forEach((week, wi) => {
    week.days.forEach(day => {
      trMigrateDayToSessions(day);
      day.sessions.forEach(session => {
        if (!trIsGymType(session.type)) return;
        session.exercises.forEach(ex => {
          if (ex.name !== exerciseName || ex.kind !== 'strength') return;
          if (!first) first = { ex, wi };
          last = { ex, wi };
        });
      });
    });
  });

  if (!first) return '';

  const w1 = first.ex.weight;
  const wN = last.ex.weight;
  const diff = wN - w1;
  const pct = w1 > 0 ? Math.round((diff / w1) * 100) : 0;
  const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '–';
  const color = diff > 0 ? '#A8C97F' : diff < 0 ? '#FF5C5C' : '#9D9A92';
  const sign = diff > 0 ? '+' : '';

  /* Прогресс-бар */
  const clamp = Math.min(50, Math.abs(pct) / 2);
  const barColor = diff > 0 ? '#A8C97F' : diff < 0 ? '#FF5C5C' : '#3A3D45';
  const barLeft = diff < 0 ? (50 - clamp) + '%' : '50%';
  const barWidth = clamp > 0 ? clamp + '%' : '0%';
  const bar = `<div class="tr-progress-bar-track"><div class="tr-progress-bar-fill" style="left:${barLeft}; width:${barWidth}; background:${barColor};"></div></div>`;

  return `
    <div class="tr-exercise" style="cursor:default;">
      <div class="tr-ex-top">
        <div class="tr-ex-name">${exerciseName}</div>
        <div class="tr-ex-stats">
          <span class="tr-ex-weight num" style="color:${color};">${sign}${diff} кг ${arrow} ${sign}${pct}%</span>
        </div>
      </div>
      <div class="tr-ex-bottom">
        <div class="tr-ex-meta num" style="display:flex; gap:8px; align-items:center;">
          <span style="color:#9D9A92;">Нед.${first.wi+1}: ${first.ex.sets}×${first.ex.reps}×${w1}кг</span>
          <span style="color:#555;">→</span>
          <span style="color:#E8E5DC;">Нед.${last.wi+1}: ${last.ex.sets}×${last.ex.reps}×${wN}кг</span>
        </div>
      </div>
      ${bar}
    </div>`;
}

function trRenderSummary(plan) {
  const GYM_ORDER = WORKING_WEIGHT_CATEGORIES;

  /* Собираем упражнения зала по каноническим группам */
  const gymByGroup = {};
  plan.weeks.forEach(week => {
    week.days.forEach(day => {
      trMigrateDayToSessions(day);
      day.sessions.forEach(session => {
        if (!trIsGymType(session.type)) return;
        session.exercises.forEach(ex => {
          if (!ex.name || ex.kind !== 'strength') return;
          const canonical = trExerciseCanonicalGroups(ex.name);
          const groups = canonical || (session.groups && session.groups.length ? session.groups : ['FULL BODY']);
          const expanded = groups.includes('FULL BODY') ? GYM_ORDER : groups;
          expanded.forEach(g => {
            if (!gymByGroup[g]) gymByGroup[g] = new Set();
            gymByGroup[g].add(ex.name);
          });
        });
      });
    });
  });

  /* Зал: прогрессия рабочего веса по группам */
  const gymHtml = GYM_ORDER.filter(g => gymByGroup[g] && gymByGroup[g].size > 0).map(g => {
    const canonical = MUSCLE_BLOCK_EXERCISES[g] || [];
    const inOrder = canonical.filter(name => gymByGroup[g].has(name));
    const custom = Array.from(gymByGroup[g]).filter(name => !canonical.includes(name));
    const allNames = [...inOrder, ...custom];
    const rows = allNames.map(name => trRenderWasNowWeightRow(name, plan)).join('');
    if (!rows) return '';
    return `
      <div class="tr-group-card">
        <div class="tr-group-title">${g} <span class="tr-group-range">· прогрессия веса</span></div>
        <div class="tr-day">${rows}</div>
      </div>`;
  }).filter(Boolean).join('');

  /* Остальное: кардио/теннис по объёму */
  const otherByType = {};
  plan.weeks.forEach(week => {
    week.days.forEach(day => {
      trMigrateDayToSessions(day);
      day.sessions.forEach(session => {
        if (trIsGymType(session.type) || session.type === 'Отдых') return;
        if (!otherByType[session.type]) otherByType[session.type] = new Set();
        session.exercises.forEach(ex => { if (ex.name) otherByType[session.type].add(ex.name); });
      });
    });
  });

  const TYPE_ORDER = ['Теннис', 'Кардио', 'Бокс', '10k', 'Лыжи'];
  const orderedTypes = [
    ...TYPE_ORDER.filter(t => otherByType[t]),
    ...Object.keys(otherByType).filter(t => !TYPE_ORDER.includes(t))
  ];
  const otherHtml = orderedTypes.filter(t => otherByType[t] && otherByType[t].size > 0).map(t => {
    const rows = Array.from(otherByType[t]).map(name => trRenderWasNowRow(name, plan)).join('');
    return `
      <div class="tr-group-card">
        <div class="tr-group-title">${t} <span class="tr-group-range">· было → стало</span></div>
        <div class="tr-day">${rows}</div>
      </div>`;
  }).join('');

  const allHtml = gymHtml + otherHtml;
  const exercisesHtml = allHtml
    ? allHtml
    : `<div class="tr-empty-state"><i class="ti ti-chart-bar"></i>Прогрессия появится здесь после нескольких недель тренировок.</div>`;

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
              <span style="display:flex; gap:4px;">
                <button class="tr-measure-edit" data-idx="${realIdx}" aria-label="Редактировать замер"><i class="ti ti-edit"></i></button>
                <button class="tr-measure-delete" data-idx="${realIdx}" aria-label="Удалить замер"><i class="ti ti-trash"></i></button>
              </span>
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

function trOpenMeasureModal(onSave, existingIdx) {
  const list = Store.get().training.measurements || [];
  const isEdit = existingIdx !== undefined && existingIdx !== null;
  const existing = isEdit ? list[existingIdx] : null;
  const today = new Date();
  const defaultDate = `${trFormatDate(today)}.${today.getFullYear()}`;
  const dateValue = existing ? existing.date : defaultDate;
  const values = existing ? existing.values : {};

  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';
  overlay.innerHTML = `
    <div class="tr-modal" style="max-height:80vh; overflow-y:auto;">
      <p class="tr-modal-title">${isEdit ? 'Редактировать замер' : 'Новый замер'}</p>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Дата (ДД.ММ.ГГГГ)<input type="text" id="m-measure-date" value="${dateValue}" placeholder="29.06.2026"></label>
      </div>
      <div class="tr-measure-form-grid">
        ${MEASURE_FIELDS.map(f => `
          <label class="tr-measure-form-field">${f}<input type="text" data-field="${f}" inputmode="decimal" placeholder="—" value="${values[f] !== undefined ? values[f] : ''}"></label>
        `).join('')}
      </div>
      <div class="tr-modal-actions">
        ${isEdit ? '<button class="tr-modal-btn-secondary" id="m-delete">Удалить</button>' : '<button class="tr-modal-btn-secondary" id="m-cancel">Отмена</button>'}
        <button class="tr-modal-btn-primary" id="m-save">Сохранить</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  const cancelBtn = overlay.querySelector('#m-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', () => overlay.remove());
  const deleteBtn = overlay.querySelector('#m-delete');
  if (deleteBtn) deleteBtn.addEventListener('click', () => {
    if (!confirm('Удалить этот замер?')) return;
    trDeleteMeasurement(existingIdx, onSave);
    overlay.remove();
  });
  overlay.querySelector('#m-save').addEventListener('click', () => {
    const newValues = {};
    overlay.querySelectorAll('input[data-field]').forEach(input => {
      if (input.value.trim() !== '') newValues[input.dataset.field] = input.value.trim();
    });
    const newDate = overlay.querySelector('#m-measure-date').value.trim() || defaultDate;
    trSnapshotBeforeChange();
    const freshList = Store.get().training.measurements || [];
    if (isEdit) {
      freshList[existingIdx] = { date: newDate, values: newValues };
    } else {
      freshList.push({ date: newDate, values: newValues });
    }
    freshList.forEach((m, i) => { if (m) Store.set('training.measurements.' + i, m); });
    overlay.remove();
    onSave();
  });
}

function trDeleteMeasurement(idx, onSave) {
  trSnapshotBeforeChange();
  const list = Store.get().training.measurements || [];
  list.splice(idx, 1);
  list.forEach((m, i) => { if (m) Store.set('training.measurements.' + i, m); });
  onSave();
}
