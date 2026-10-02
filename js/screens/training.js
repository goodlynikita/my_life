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

const TRAINING_TYPES_DEFAULT = [
  { name: 'Тренажерный зал', color: '#4ADE80', group: 'Зал' },
  { name: 'Растяжка',   color: '#C084FC', group: 'Фитнес' },
  { name: 'Стрейчинг',  color: '#C084FC', group: 'Фитнес' },
  { name: 'Пилатес',    color: '#C084FC', group: 'Фитнес' },
  { name: 'Йога',       color: '#C084FC', group: 'Фитнес' },
  { name: 'Функциональная', color: '#A78BFA', group: 'Фитнес' },
  { name: 'Бег',        color: '#60A5FA', group: 'Кардио' },
  { name: 'Велосипед',  color: '#60A5FA', group: 'Кардио' },
  { name: 'Дорожка',    color: '#60A5FA', group: 'Кардио' },
  { name: 'Эллипс',     color: '#60A5FA', group: 'Кардио' },
  { name: 'Плавание',   color: '#38BDF8', group: 'Кардио' },
  { name: 'Теннис',     color: '#F59E0B', group: 'Спорт' },
  { name: 'Бокс',       color: '#F87171', group: 'Спорт' },
  { name: 'Баскетбол',  color: '#FB923C', group: 'Спорт' },
  { name: 'Футбол',     color: '#4ADE80', group: 'Спорт' },
  { name: 'Волейбол',   color: '#FBBF24', group: 'Спорт' },
  { name: 'Борьба',     color: '#F87171', group: 'Спорт' },
  { name: 'Лыжи',       color: '#93C5FD', group: 'Спорт' },
  { name: 'Сноуборд',   color: '#93C5FD', group: 'Спорт' },
  { name: 'Коньки',     color: '#93C5FD', group: 'Спорт' },
  { name: 'Шаги',       color: '#A78BFA', group: 'Шаги' },
  { name: 'Отдых',      color: '#6B7280', group: 'Отдых' },
];
/* Спокойная палитра (без кислотных цветов) — цвет типа берётся по его группе */
const TR_GROUP_COLORS = {
  'Зал':    '#6FAF8C',
  'Фитнес': '#A48FCB',
  'Кардио': '#6F9BCB',
  'Спорт':  '#C9A266',
  'Шаги':   '#8E89C6',
  'Отдых':  '#7C818D',
};
/* цвет идёт в style="…": только #hex, иначе через него можно подсунуть разметку */
function trSafeColor(c, d) { return (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c.trim())) ? c.trim() : (d || '#8A8F9C'); }
function trTypeColor(t) { return TR_GROUP_COLORS[t.group] || trSafeColor(t.color); }
function trNormalizeTypes(arr) {
  return (Array.isArray(arr) ? arr : Object.values(arr || {}))
    .filter(t => t && t.name)
    .map(t => ({ name: t.name, group: t.group || 'Спорт', color: trTypeColor(t) }));
}
const TR_COACH = !!window.__coachMode; /* кабинет тренера: каталог берём только у клиента, в память браузера не пишем */
function trLoadTypes() {
  if (TR_COACH) return trNormalizeTypes(TRAINING_TYPES_DEFAULT);
  try { const s = localStorage.getItem('nik_training_types'); if (s) return trNormalizeTypes(JSON.parse(s)); } catch(e) {}
  return trNormalizeTypes(TRAINING_TYPES_DEFAULT);
}
/* Типы сохраняются и в Firebase — иначе удалённые типы «возвращались»
   (раньше удаление вообще никуда не записывалось) */
function trSaveTypes(arr) {
  if (!TR_COACH) try { localStorage.setItem('nik_training_types', JSON.stringify(arr)); } catch(e) {}
  try { Store.set('training.catalog.types', arr.map(t => ({ name: t.name, group: t.group, color: t.color }))); } catch(e) {}
}
let TRAINING_TYPES = trLoadTypes();

/* Цвета групп мышц — приглушённые, в тон картинкам силуэта */
const MUSCLE_COLOR = {
  'Грудь':     '#7FB36E',
  'Спина':     '#6C95C8',
  'Руки':      '#9B82C6',
  'Ноги':      '#CF9A5E',
  'Плечи':     '#C47FA0',
  'Кор':       '#C57070',
  'FULL BODY': '#6FAF8C',
};
const MUSCLE_GROUPS = Object.keys(MUSCLE_COLOR).map(name => ({ name, color: MUSCLE_COLOR[name] }));

const CARDIO_DIRECTIONS = ['Бег', 'Велосипед', 'Дорожка', 'Эллипс', 'Плавание', 'Гребля'];

const TRAINING_CATEGORIES = [
  { id: 'Тренажерный зал', label: 'Тренажерный зал', color: TR_GROUP_COLORS['Зал'],    desc: 'Силовые по группам мышц' },
  { id: 'Фитнес', label: 'Фитнес',            color: TR_GROUP_COLORS['Фитнес'], desc: 'Растяжка, пилатес, йога' },
  { id: 'Кардио', label: 'Кардио',            color: TR_GROUP_COLORS['Кардио'], desc: 'Бег, велосипед, плавание' },
  { id: 'Спорт',  label: 'Спорт',             color: TR_GROUP_COLORS['Спорт'],  desc: 'Игровые и зимние виды' },
  { id: 'Шаги',   label: 'Шаги',              color: TR_GROUP_COLORS['Шаги'],   desc: 'Трекинг шагов' },
  { id: 'Отдых',  label: 'Отдых',             color: TR_GROUP_COLORS['Отдых'],  desc: 'День восстановления' },
];

function trIsGymType(typeName) {
  return (TRAINING_TYPES.find(t => t.name === typeName) || {}).group === 'Зал' || typeName === 'Тренажерный зал';
}
function trIsRestType(typeName) {
  return typeName === 'Отдых';
}
function trIsTimeCalorieType(typeName) {
  return typeName === 'Спорт' || ['Теннис', 'Бокс', 'Борьба', 'Баскетбол', 'Футбол', 'Волейбол', 'Йога', 'Растяжка', 'Лыжи', 'Сноуборд', 'Коньки'].includes(typeName);
}
function trIsCardioType(typeName) {
  return typeName === 'Кардио' || ['Бег', 'Велосипед', 'Дорожка', 'Эллипс', 'Плавание', 'Гребля'].includes(typeName);
}
function trIsStepsType(typeName) {
  return typeName === 'Шаги' || typeName === '10k' || typeName === 'Ходьба';
}
function trIsFitnessType(typeName) {
  return typeName === 'Фитнес' || ['Растяжка', 'Стрейчинг', 'Пилатес', 'Йога', 'Функциональная'].includes(typeName);
}

const MUSCLE_BLOCK_EXERCISES_DEFAULT = {
  'Грудь': [
    'Жим штанги лёжа', 'Жим гантелей лёжа', 'Жим штанги наклон', 'Жим гантелей наклон',
    'Жим штанги обратный наклон', 'Жим гантелей обратный наклон',
    'Разведения гантелей лёжа', 'Разведения на наклонной', 'Бабочка (тренажёр)',
    'Кроссовер сверху', 'Кроссовер снизу', 'Кроссовер средний',
    'Отжимания', 'Отжимания на брусьях', 'Пуловер гантель',
    'Жим в Смите', 'Жим в Хаммере',
  ],
  'Спина': [
    'Подтягивания широкий хват', 'Подтягивания узкий хват', 'Подтягивания нейтральный',
    'Тяга верхнего блока широкий', 'Тяга верхнего блока узкий', 'Тяга верхнего блока обратный',
    'Тяга нижнего блока', 'Тяга нижнего блока широкий',
    'Тяга штанги в наклоне', 'Тяга гантели одной рукой', 'Тяга Т-грифа',
    'Гиперэкстензия', 'Гиперэкстензия с весом',
    'Пуловер на верхнем блоке', 'Становая тяга', 'Становая тяга румынская',
    'Шраги штанга', 'Шраги гантели',
  ],
  'Руки': [
    /* Бицепс */
    'Подъём штанги на бицепс', 'Подъём гантелей на бицепс', 'Молотки гантели',
    'Молотки канат', 'Подъём на скамье Скотта', 'Концентрированный подъём',
    'Подъём на нижнем блоке', 'Подъём обратным хватом',
    /* Трицепс */
    'Французский жим штанга', 'Французский жим EZ-гриф', 'Французский жим гантели',
    'Разгибания на верхнем блоке канат', 'Разгибания на верхнем блоке прямой',
    'Разгибания из-за головы гантель', 'Разгибания из-за головы канат',
    'Отжимания на брусьях (трицепс)', 'Кикбэк гантели',
  ],
  'Ноги': [
    'Приседания со штангой', 'Приседания Смит', 'Приседания гакк-машина',
    'Жим ногами', 'Жим ногами узкий хват', 'Жим ногами широкий хват',
    'Разгибания ног', 'Сгибания ног лёжа', 'Сгибания ног стоя', 'Сгибания ног сидя',
    'Румынская тяга', 'Выпады со штангой', 'Выпады гантели', 'Болгарские сплит-приседания',
    'Сумо-присед', 'Ягодичный мостик', 'Ягодичный мостик штанга',
    'Подъём на носки стоя', 'Подъём на носки сидя',
    'Отведение ног в тренажёре', 'Приведение ног в тренажёре',
  ],
  'Плечи': [
    'Жим штанги сидя', 'Жим гантелей сидя', 'Жим гантелей стоя', 'Жим Арнольда',
    'Жим штанги из-за головы', 'Армейский жим',
    'Махи гантелей в стороны', 'Махи на нижнем блоке', 'Махи в кроссовере',
    'Тяга штанги к подбородку', 'Тяга гантели к подбородку',
    'Разведения в наклоне', 'Разведения на заднюю дельту в тренажёре',
    'Обратная бабочка (задняя дельта)',
  ],
  'Кор': [
    'Скручивания', 'Обратные скручивания', 'Велосипед',
    'Планка', 'Боковая планка', 'Динамическая планка',
    'Подъём ног лёжа', 'Подъём ног в висе', 'Подъём коленей в висе',
    'Русский твист', 'Русский твист с весом',
    'Скручивания на верхнем блоке', 'Скручивания с весом',
    'Гиперэкстензия (поясница)', 'Вакуум',
    'Ab Wheel', 'Дровосек на блоке',
  ],
  'FULL BODY': [
    'Бёрпи', 'Турецкий подъём', 'Рывок гири', 'Толчок гири',
    'Становая тяга', 'Тяга сумо', 'Трастеры',
    'Тяга саней', 'Фермерская ходьба', 'Прогулка фермера гантели',
    'Прыжки на ящик', 'Прыжки через скакалку',
    'Баттл-рейпс', 'Маховые движения гирей',
  ],
};

/* Ключ v2 — новые пользователи получат полный список, у старых (v1) остаются их данные */
function trLoadExercises() {
  if (TR_COACH) return JSON.parse(JSON.stringify(MUSCLE_BLOCK_EXERCISES_DEFAULT));
  try {
    const saved = localStorage.getItem('nik_exercises_v2');
    if (saved) return JSON.parse(saved);
    /* Проверяем есть ли у пользователя старые данные v1 — если есть, мигрируем */
    const old = localStorage.getItem('nik_exercises_v1');
    if (old) {
      const parsed = JSON.parse(old);
      /* Добавляем новые группы которых не было (Кор, FULL BODY) */
      if (!parsed['Кор']) parsed['Кор'] = JSON.parse(JSON.stringify(MUSCLE_BLOCK_EXERCISES_DEFAULT['Кор']));
      if (!parsed['FULL BODY']) parsed['FULL BODY'] = JSON.parse(JSON.stringify(MUSCLE_BLOCK_EXERCISES_DEFAULT['FULL BODY']));
      localStorage.setItem('nik_exercises_v2', JSON.stringify(parsed));
      return parsed;
    }
  } catch(e) {}
  return JSON.parse(JSON.stringify(MUSCLE_BLOCK_EXERCISES_DEFAULT));
}

function trSaveExercises(data) {
  if (!TR_COACH) try { localStorage.setItem('nik_exercises_v2', JSON.stringify(data)); } catch(e) {}
  try { Store.set('training.catalog.exercises', JSON.parse(JSON.stringify(data))); } catch(e) {}
}

const MUSCLE_BLOCK_EXERCISES = trLoadExercises();

/* Каталог (типы + упражнения) живёт в Firebase: подтягиваем его при каждом
   открытии экрана, чтобы правки с другого устройства не терялись */
function trSyncCatalogFromStore() {
  const cat = (Store.get().training || {}).catalog || {};
  /* у тренера каталог свой у каждого клиента: сначала сброс к стандартному */
  if (TR_COACH) {
    TRAINING_TYPES.splice(0, TRAINING_TYPES.length, ...trNormalizeTypes(TRAINING_TYPES_DEFAULT));
    Object.keys(MUSCLE_BLOCK_EXERCISES).forEach(k => { delete MUSCLE_BLOCK_EXERCISES[k]; });
    Object.assign(MUSCLE_BLOCK_EXERCISES, JSON.parse(JSON.stringify(MUSCLE_BLOCK_EXERCISES_DEFAULT)));
  }
  if (cat.types) {
    const types = trNormalizeTypes(cat.types);
    if (types.length) {
      TRAINING_TYPES.splice(0, TRAINING_TYPES.length, ...types);
      if (!TR_COACH) try { localStorage.setItem('nik_training_types', JSON.stringify(types)); } catch(e) {}
    }
  }
  if (cat.exercises && typeof cat.exercises === 'object') {
    Object.keys(MUSCLE_BLOCK_EXERCISES).forEach(k => { delete MUSCLE_BLOCK_EXERCISES[k]; });
    Object.keys(cat.exercises).forEach(k => {
      const v = cat.exercises[k];
      MUSCLE_BLOCK_EXERCISES[k] = Array.isArray(v) ? v.filter(Boolean) : Object.values(v || {}).filter(Boolean);
    });
    if (!TR_COACH) try { localStorage.setItem('nik_exercises_v2', JSON.stringify(MUSCLE_BLOCK_EXERCISES)); } catch(e) {}
  }
}

function trOpenExerciseEditor() {
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';

  const GYM_TYPES = ['Тренажерный зал', 'Зал ТРЕН'];
  const groups = Object.keys(MUSCLE_BLOCK_EXERCISES_DEFAULT);

  let step = 'type';
  let selType = null;
  let selGroup = null;

  function render() { overlay.innerHTML = buildHtml(); bind(); }

  function buildHtml() {
    if (step === 'type') return buildTypeStep();
    if (step === 'group') return buildGroupStep();
    return buildExStep();
  }

  function buildTypeStep() {
    const typeGroups = {};
    TRAINING_TYPES.forEach(t => {
      if (!typeGroups[t.group]) typeGroups[t.group] = [];
      typeGroups[t.group].push(t);
    });
    const html = Object.entries(typeGroups).map(([grp, types]) =>
      `<div style="margin-bottom:16px;">
        <div style="font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;">${trEsc(grp)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;" data-group="${trEsc(grp)}">
          ${types.map(t => `
            <div style="position:relative;display:inline-flex;">
              <button class="tr-type-sel-btn" data-type="${trEsc(t.name)}" style="padding:8px 14px 8px 10px;border-radius:10px;border:1.5px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.7);cursor:pointer;font-size:13px;font-weight:600;font-family:inherit;display:flex;align-items:center;gap:6px;">
                <span style="width:8px;height:8px;border-radius:50%;background:${trTypeColor(t)};flex-shrink:0;"></span>${trEsc(t.name)}
              </button>
              <button class="tr-type-del-btn" data-type="${trEsc(t.name)}" title="Удалить" style="position:absolute;top:-5px;right:-5px;width:16px;height:16px;border-radius:50%;background:#F87171;border:none;color:#fff;cursor:pointer;font-size:10px;line-height:1;display:flex;align-items:center;justify-content:center;padding:0;z-index:2;">×</button>
            </div>`).join('')}
          <button class="tr-type-add-btn" data-group="${trEsc(grp)}" style="padding:8px 12px;border-radius:10px;border:1.5px dashed rgba(255,255,255,0.2);background:none;color:rgba(255,255,255,0.35);cursor:pointer;font-size:18px;font-family:inherit;line-height:1;">+</button>
        </div>
      </div>`
    ).join('');
    return modal('Виды тренировок', `<div style="padding:4px 0 8px;font-size:13px;color:#9D9A92;">Выбери тип тренировки</div>${html}`,
      `<button id="ed-close" style="flex:1;padding:11px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:none;color:#9D9A92;cursor:pointer;font-size:13px;font-family:inherit;">Закрыть</button>`);
  }

  function buildGroupStep() {
    const COLOR_MAP = MUSCLE_COLOR;
    const html = groups.map(g => {
      const count = (MUSCLE_BLOCK_EXERCISES[g]||[]).length;
      const c = COLOR_MAP[g]||'#9D9A92';
      return `<button class="tr-grp-sel-btn" data-group="${trEsc(g)}" style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:12px 14px;border-radius:10px;border:1.5px solid ${c}22;background:${c}10;cursor:pointer;font-family:inherit;margin-bottom:8px;box-sizing:border-box;"><div style="display:flex;align-items:center;gap:10px;"><span style="width:10px;height:10px;border-radius:50%;background:${c};flex-shrink:0;"></span><span style="font-size:14px;font-weight:700;color:#E8E5DC;">${trEsc(trGL(g))}</span></div><span style="font-size:12px;color:${c};">${count} упр.</span></button>`;
    }).join('');
    return modal(`Зал → Группа мышц`, html,
      `<button id="ed-back" style="flex:1;padding:11px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:none;color:#9D9A92;cursor:pointer;font-size:13px;font-family:inherit;">← Назад</button>
       <button id="ed-close" style="flex:1;padding:11px;border-radius:10px;background:#2E7FD4;color:#fff;border:none;cursor:pointer;font-size:13px;font-weight:700;font-family:inherit;">Готово</button>`);
  }

  function buildExStep() {
    const exercises = MUSCLE_BLOCK_EXERCISES[selGroup]||[];
    const items = exercises.length
      ? exercises.map((ex,i) => `<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.06);min-width:0;"><span style="flex:1;font-size:13px;color:#E8E5DC;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${trEsc(ex)}</span><button class="tr-ex-ren" data-idx="${i}" style="background:none;border:none;color:#9D9A92;cursor:pointer;padding:4px;"><i class="ti ti-pencil" style="font-size:14px;"></i></button><button class="tr-ex-del" data-idx="${i}" style="background:none;border:none;color:#F87171;cursor:pointer;padding:4px;"><i class="ti ti-trash" style="font-size:14px;"></i></button></div>`).join('')
      : '<div style="color:#555;font-size:13px;padding:16px 0;text-align:center;">Список пуст, добавь упражнения</div>';
    const isGym = GYM_TYPES.includes(selType);
    return modal(`${selType} → ${selGroup}`,
      `<div style="overflow-y:auto;flex:1;min-height:0;">${items}</div>
       <div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.06);">
         <input id="tr-ex-new" type="text" placeholder="Новое упражнение…" style="flex:1;padding:9px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#E8E5DC;font-size:13px;font-family:inherit;box-sizing:border-box;outline:none;min-width:0;">
         <button id="tr-ex-add" style="padding:9px 14px;border-radius:8px;background:#2E7FD4;color:#fff;border:none;cursor:pointer;font-size:20px;font-weight:700;flex-shrink:0;">+</button>
       </div>`,
      `<button id="ed-back" style="flex:1;padding:11px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:none;color:#9D9A92;cursor:pointer;font-size:12px;font-family:inherit;">${isGym?'← '+selType:'← Назад'}</button>
       <button id="tr-ex-clear" style="flex:1;padding:11px;border-radius:10px;border:1px solid rgba(248,113,113,0.3);background:rgba(248,113,113,0.08);color:#F87171;cursor:pointer;font-size:12px;font-family:inherit;">🗑 Очистить</button>
       <button id="ed-close" style="flex:2;padding:11px;border-radius:10px;background:#2E7FD4;color:#fff;border:none;cursor:pointer;font-size:13px;font-weight:700;font-family:inherit;">Готово</button>`);
  }

  function modal(title, body, footer) {
    return `<div style="background:#1C1E26;border-radius:16px;width:100%;max-width:420px;max-height:82vh;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;">
      <div style="padding:16px 18px 12px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:15px;font-weight:800;color:#E8E5DC;">${trEsc(title)}</span>
        <button id="ed-x" style="background:none;border:none;color:#9D9A92;cursor:pointer;font-size:24px;line-height:1;padding:0;">×</button>
      </div>
      <div style="flex:1;min-height:0;overflow-y:auto;padding:14px 18px;display:flex;flex-direction:column;-webkit-overflow-scrolling:touch;">${body}</div>
      <div style="padding:12px 18px;border-top:1px solid rgba(255,255,255,0.08);display:flex;gap:8px;flex-shrink:0;">${footer}</div>
    </div>`;
  }

  function bind() {
    overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove(); });
    overlay.querySelector('#ed-x')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('#ed-close')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('#ed-back')?.addEventListener('click', () => {
      if (step==='exercises' && GYM_TYPES.includes(selType)) { step='group'; }
      else { step='type'; selType=null; selGroup=null; }
      render();
    });
    overlay.querySelectorAll('.tr-type-sel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selType = btn.dataset.type;
        if (GYM_TYPES.includes(selType)) { step='group'; }
        else { step='exercises'; selGroup=selType; if(!MUSCLE_BLOCK_EXERCISES[selGroup]) MUSCLE_BLOCK_EXERCISES[selGroup]=[]; }
        render();
      });
    });

    // Удалить тип
    overlay.querySelectorAll('.tr-type-del-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const typeName = btn.dataset.type;
        if (!confirm('Удалить тип «' + typeName + '»?')) return;
        const idx = TRAINING_TYPES.findIndex(t => t.name === typeName);
        if (idx !== -1) TRAINING_TYPES.splice(idx, 1);
        // Удаляем упражнения этого типа
        delete MUSCLE_BLOCK_EXERCISES[typeName];
        trSaveTypes(TRAINING_TYPES);
        trSaveExercises(MUSCLE_BLOCK_EXERCISES);
        render();
      });
    });

    // Добавить новый тип в группу
    overlay.querySelectorAll('.tr-type-add-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const grp = btn.dataset.group;
        const name = prompt('Название нового типа в группе «' + grp + '»:');
        if (!name || !name.trim()) return;
        const trimmed = name.trim();
        if (TRAINING_TYPES.find(t => t.name === trimmed)) { alert('Такой тип уже есть'); return; }
        TRAINING_TYPES.push({ name: trimmed, color: TR_GROUP_COLORS[grp] || '#8A8F9C', group: grp });
        trSaveTypes(TRAINING_TYPES);
        render();
      });
    });
    overlay.querySelectorAll('.tr-grp-sel-btn').forEach(btn => {
      btn.addEventListener('click', () => { selGroup=btn.dataset.group; step='exercises'; render(); });
    });
    const addInput = overlay.querySelector('#tr-ex-new');
    const doAdd = () => {
      const val = addInput?.value?.trim(); if(!val) return;
      if(!MUSCLE_BLOCK_EXERCISES[selGroup]) MUSCLE_BLOCK_EXERCISES[selGroup]=[];
      MUSCLE_BLOCK_EXERCISES[selGroup].push(val); trSaveExercises(MUSCLE_BLOCK_EXERCISES); render();
    };
    overlay.querySelector('#tr-ex-add')?.addEventListener('click', doAdd);
    addInput?.addEventListener('keydown', e => { if(e.key==='Enter') doAdd(); });
    overlay.querySelectorAll('.tr-ex-del').forEach(btn => {
      btn.addEventListener('click', () => {
        MUSCLE_BLOCK_EXERCISES[selGroup].splice(parseInt(btn.dataset.idx),1);
        trSaveExercises(MUSCLE_BLOCK_EXERCISES); render();
      });
    });
    overlay.querySelectorAll('.tr-ex-ren').forEach(btn => {
      btn.addEventListener('click', () => {
        const i=parseInt(btn.dataset.idx);
        const span=btn.closest('div').querySelector('span');
        const inp=document.createElement('input');
        inp.value=MUSCLE_BLOCK_EXERCISES[selGroup][i];
        inp.style.cssText='flex:1;background:rgba(255,255,255,0.08);border:1px solid #2E7FD4;border-radius:6px;color:#E8E5DC;font-size:13px;padding:3px 8px;font-family:inherit;min-width:0;';
        span.replaceWith(inp); inp.focus(); inp.select();
        const save=()=>{ const v=inp.value.trim(); if(v) MUSCLE_BLOCK_EXERCISES[selGroup][i]=v; trSaveExercises(MUSCLE_BLOCK_EXERCISES); render(); };
        inp.addEventListener('blur',save); inp.addEventListener('keydown',e=>{if(e.key==='Enter')save();});
      });
    });
    overlay.querySelector('#tr-ex-clear')?.addEventListener('click', () => {
      const count=(MUSCLE_BLOCK_EXERCISES[selGroup]||[]).length;
      if(!count||!confirm(`Удалить все ${count} упражнений из «${selGroup}»?`)) return;
      MUSCLE_BLOCK_EXERCISES[selGroup]=[]; trSaveExercises(MUSCLE_BLOCK_EXERCISES); render();
    });
  }

  render();
  document.body.appendChild(overlay);
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
  return found ? trSafeColor(found.color, '#8A8985') : '#8A8985';
}

function trBuildSelect(id, list, current) {
  /* Если в списке есть группы — делаем optgroup */
  const hasGroups = list.some(i => i.group);
  let options;
  if (hasGroups) {
    const groups = [...new Set(list.map(i => i.group).filter(Boolean))];
    const groupLabels = { 'Зал': 'Тренажерный зал', 'Кардио': 'Кардио', 'Шаги': 'Шаги', 'Спорт': 'Спорт', 'Зима': 'Зима', 'Прочее': 'Прочее' };
    options = groups.map(g => {
      const items = list.filter(i => i.group === g);
      return `<optgroup label="${trEsc(groupLabels[g]||g)}">${items.map(i => `<option value="${trEsc(i.name)}" ${i.name===current?'selected':''}>${trEsc(i.name)}</option>`).join('')}</optgroup>`;
    }).join('');
  } else {
    options = list.map(item =>
      `<option value="${trEsc(item.name)}" ${item.name === current ? 'selected' : ''}>${trEsc(item.name)}</option>`
    ).join('');
  }
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

/* Снимок планов до правки: с ним trSavePlans пишет только изменённые дни.
   Обновляется, когда данные пришли заново (новый массив) и после каждого сохранения */
let _trBase = null, _trBaseRef = null;
function trGetPlans() {
  const plans = Store.get().training.plans || [];
  if (plans !== _trBaseRef) { _trBaseRef = plans; try { _trBase = JSON.parse(JSON.stringify(plans)); } catch (e) { _trBase = null; } }
  return plans;
}

const TR_UNDO_KEY = 'nik_tr_undo_stack';
const TR_UNDO_MAX = 20;

/* снимок для «Отменить», который попадает в историю только если правка случилась (окно могли просто закрыть) */
function trSnapshotTake() { try { return JSON.stringify(Store.get().training); } catch (e) { return null; } }
function trSnapshotPush(snap) {
  if (!snap) return;
  try { if (JSON.stringify(Store.get().training) === snap) return; } catch (e) {} /* ничего не поменялось: шаг отмены не нужен */
  try { const stack = JSON.parse(sessionStorage.getItem(TR_UNDO_KEY) || '[]'); stack.push(JSON.parse(snap)); if (stack.length > TR_UNDO_MAX) stack.shift(); sessionStorage.setItem(TR_UNDO_KEY, JSON.stringify(stack)); } catch (e) {}
}

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
    /* отмена правки в Плане не должна стирать AI-план и его настройки */
    const cur = Store.get().training || {};
    if (cur.ai !== undefined) previous.ai = cur.ai;
    if (cur.aiPrefs !== undefined) previous.aiPrefs = cur.aiPrefs;
    Store.set('training', previous);
    if (window.TrainingAI && TrainingAI.resyncQueue) TrainingAI.resyncQueue();
    return true;
  } catch (e) {
    return false;
  }
}

function trSavePlans(plans) {
  /* Пишем каждый план отдельным путём — не перезаписываем весь массив.
     Это гарантирует что одновременные правки двух пользователей
     не затирают друг друга в Firebase. */
  /* Пишем только изменённые дни (точечные пути): если тренер в это время поправил другой день,
     его правка не затрётся. Новый план или изменённая структура недель пишутся целиком */
  const same = (a, b) => { try { return JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b); } catch (e) { return false; } };
  const base = Array.isArray(_trBase) && _trBaseRef === Store.get().training.plans ? _trBase : null;
  plans.forEach((plan, idx) => {
    if (!plan) return;
    const old = base && base[idx];
    const pw = plan.weeks || [], ow = (old && old.weeks) || [];
    if (!old || old.id !== plan.id || pw.length !== ow.length) { Store.set('training.plans.' + idx, plan); return; }
    Object.keys(Object.assign({}, old, plan)).forEach(k => { if (k !== 'weeks' && !same(old[k], plan[k])) Store.set('training.plans.' + idx + '.' + k, plan[k] === undefined ? null : plan[k]); });
    pw.forEach((w, wi) => {
      const o = ow[wi], wd = (w && w.days) || [], od = (o && o.days) || [];
      if (!w || !o || wd.length !== od.length) { if (!same(w, o)) Store.set('training.plans.' + idx + '.weeks.' + wi, w); return; }
      Object.keys(Object.assign({}, o, w)).forEach(k => { if (k !== 'days' && !same(o[k], w[k])) Store.set('training.plans.' + idx + '.weeks.' + wi + '.' + k, w[k] === undefined ? null : w[k]); });
      wd.forEach((d, di) => { if (!same(d, od[di])) Store.set('training.plans.' + idx + '.weeks.' + wi + '.days.' + di, d); });
    });
  });
  try { _trBase = JSON.parse(JSON.stringify(Store.get().training.plans || [])); _trBaseRef = Store.get().training.plans; } catch (e) {}
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
  /* текущий план: со status 'active', а у старых планов без статуса последний */
  let wasActive = plans.filter(p => p && p.status === 'active');
  if (!wasActive.length) { const cur = trActivePlan(); if (cur) wasActive = [cur]; }
  wasActive.forEach(p => { p.status = 'archived'; });
  const maxNumber = plans.reduce((m, p) => Math.max(m, +p.number || 0), 0);
  /* Начинаем план с понедельника текущей недели */
  const _today = new Date();
  const _dow = _today.getDay(); // 0=вс, 1=пн, ..., 6=сб
  const _daysFromMon = _dow === 0 ? 6 : _dow - 1; // вс — это конец недели, отматываем 6 дней
  const _planStart = new Date(_today);
  _planStart.setDate(_today.getDate() - _daysFromMon);
  _planStart.setHours(0, 0, 0, 0);
  const newPlan = trBuildEmptyPlan(maxNumber + 1, _planStart);
  /* тренировки текущей недели переезжают в новый план, иначе они пропадают из «Плана» и «Весов» */
  const _wkEnd = new Date(_planStart); _wkEnd.setDate(_wkEnd.getDate() + 7);
  const _w0 = (newPlan.weeks || [])[0];
  wasActive.forEach(op => (op.weeks || []).forEach(w => ((w && w.days) || []).forEach(d => {
    if (!d) return; const dt = trDayDateOf(op, d.date); if (!dt || dt < _planStart || dt >= _wkEnd) return;
    trMigrateDayToSessions(d);
    if (!(d.sessions || []).length && !d.comment) return;
    const nd = _w0 && (_w0.days || []).find(x => x && x.date === d.date); if (!nd) return;
    nd.sessions = (nd.sessions || []).concat(d.sessions || []); if (d.comment && !nd.comment) nd.comment = d.comment;
    d.sessions = []; delete d.comment;
  })));
  plans.push(newPlan);
  trSavePlans(plans);
  return newPlan.id;
}

function trTonnage(ex) {
  /* если записан каждый подход, считаем точно по подходам */
  const sd = ex && ex.setDetails ? (Array.isArray(ex.setDetails) ? ex.setDetails : Object.values(ex.setDetails)) : null;
  if (sd && sd.length) return Math.round(sd.reduce((t, d) => t + (+d.reps || 0) * (+d.weight || 0), 0) * 10) / 10;
  return Math.round((ex.sets * ex.reps * ex.weight) * 10) / 10;
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

function trCalcProgress(plan, weekIndex, exerciseName, baseWeekIndex) {
  const _bi = (typeof baseWeekIndex === "number") ? baseWeekIndex : 0;
  const week1 = plan.weeks[_bi] || plan.weeks[0];
  let baseline = null;
  for (const day of week1.days) {
    const found = trDayAllExercises(day).find(e => e.ex.name === exerciseName);
    if (found) {
      /* Шаги и кардио не сравниваем с силовыми */
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
  if (baseline === null || current === null) return { pct: 0, dir: 'flat', diff: 0 };
  if (baseline === 0) {
    if (current === 0) return { pct: 0, dir: 'flat', diff: 0 };
    return { pct: 100, dir: 'up', diff: Math.round((current - baseline) * 10) / 10 };
  }
  const diff = Math.round((current - baseline) * 10) / 10;
  const pct = Math.round((diff / baseline) * 100);
  return { pct, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat', diff };
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

/* Крайнее выполнение упражнения: сначала ищем в текущем плане,
   если там его ещё не было — в прошлых планах (от свежих к старым) */
function trFindLastStrength(plan, exName) {
  const today = new Date(); today.setHours(23, 59, 59, 0);
  const dayDate = (p, dateStr) => {
    const [dd, mm] = String(dateStr || '').split('.').map(Number);
    if (!dd || !mm) return null;
    const start = p.startDate ? new Date(p.startDate) : new Date();
    let d = new Date(start.getFullYear(), mm - 1, dd);
    if (d < new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7)) d = new Date(start.getFullYear() + 1, mm - 1, dd);
    return d;
  };
  const scan = (p) => {
    let found = null;
    (p && p.weeks || []).forEach(week => (week && week.days || []).forEach(day => {
      if (!day) return;
      const dt = dayDate(p, day.date);
      if (dt && dt > today) return; /* будущие (запланированные) дни не считаем */
      trMigrateDayToSessions(day);
      (day.sessions || []).forEach(session => (session && session.exercises || []).forEach(ex => {
        if (ex && ex.kind === 'strength' && ex.name === exName && ex !== window._trEditingEx && (ex.weight > 0 || (ex.reps > 0 && /подтяг|отжим|брусь|планк|скруч|подъём ног|подъем ног|гиперэкст|выпады|присед без/i.test(ex.name)))) found = { ex, date: day.date, plan: p };
      }));
    }));
    return found;
  };
  const inCurrent = scan(plan);
  if (inCurrent) return inCurrent;
  const others = trGetPlans().filter(p => p && (!plan || p.id !== plan.id))
    .sort((a, b) => (b.number || 0) - (a.number || 0));
  for (const p of others) { const r = scan(p); if (r) return r; }
  return null;
}

function trGetLastSession(plan, exName) {
  const r = trFindLastStrength(plan, exName);
  return r ? r.ex : null;
}

/* Подставить в форму вес/подходы/повторы с прошлого раза (если поля пустые
   или были подставлены автоматически ранее) */
function trPrefillFromLast(root, plan, exName) {
  const last = exName ? trFindLastStrength(plan, exName) : null;
  const fields = { '#m-sets': 'sets', '#m-reps': 'reps', '#m-weight': 'weight' };
  Object.keys(fields).forEach(sel => {
    const inp = root.querySelector(sel);
    if (!inp) return;
    const auto = inp.dataset.auto === '1';
    if (inp.value !== '' && !auto) return; /* пользователь ввёл сам — не трогаем */
    const v = last ? last.ex[fields[sel]] : '';
    inp.value = v ? (sel === '#m-weight' ? String(v).replace('.', ',') : v) : '';
    inp.dataset.auto = v ? '1' : '';
  });
  root.querySelectorAll('#m-sets,#m-reps,#m-weight').forEach(inp => {
    if (!inp._autoBound) { inp._autoBound = true; inp.addEventListener('input', () => { inp.dataset.auto = ''; }); }
  });
  return last;
}

function trProgressionHint(plan, exName) {
  const prog = trGetProgression(exName);
  const lastInfo = trFindLastStrength(plan, exName);
  const last = lastInfo ? lastInfo.ex : null;
  const whereLine = lastInfo
    ? (lastInfo.plan && plan && lastInfo.plan.id !== plan.id ? ` · план №${trEsc(lastInfo.plan.number)}, ${trEsc(lastInfo.date)}` : ` · ${trEsc(lastInfo.date)}`)
    : '';

  if (!prog) {
    if (!last) return null;
    return {
      type: 'last',
      html: `<div class="tr-prog-hint tr-prog-hold">
        <div class="tr-prog-last">Прошлый раз: ${trEsc(last.sets)} × ${trEsc(last.reps)} × ${trEsc(last.weight)} кг${whereLine}</div>
      </div>`
    };
  }

  if (!last) {
    return {
      type: 'first',
      html: `<div class="tr-prog-hint tr-prog-first">
        <i class="ti ti-info-circle"></i>
        <span>Первый раз: начни с комфортного веса и нащупай свой рабочий</span>
      </div>`
    };
  }

  const { sets, reps, weight } = last;
  const lastLine = `${trEsc(sets)} × ${trEsc(reps)} × ${trEsc(weight)} кг${whereLine}`;

  if (prog.step === 0) {
    /* Пресс — только повторы */
    const target = reps < prog.max ? `${trEsc(sets)} × ${Math.min(reps + 2, prog.max)} повторов` : `усложни упражнение`;
    return {
      type: 'reps',
      html: `<div class="tr-prog-hint tr-prog-ok">
        <div class="tr-prog-last">Прошлый раз: ${lastLine}</div>
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
        <div class="tr-prog-last">Прошлый раз: ${lastLine} ✅</div>
        <div class="tr-prog-target"><i class="ti ti-trending-up"></i> Поднимай до <strong>${newWeight} кг</strong>, цель ${trEsc(sets)} × ${prog.min}</div>
      </div>`
    };
  } else if (reps >= prog.min) {
    /* В диапазоне — держим вес, добавляем повторы */
    return {
      type: 'hold',
      html: `<div class="tr-prog-hint tr-prog-hold">
        <div class="tr-prog-last">Прошлый раз: ${lastLine}</div>
        <div class="tr-prog-target"><i class="ti ti-target"></i> Держи <strong>${trEsc(weight)} кг</strong>, цель: дойти до ${trEsc(sets)} × ${prog.max}</div>
      </div>`
    };
  } else {
    /* Ниже минимума — работаем над повторами */
    return {
      type: 'work',
      html: `<div class="tr-prog-hint tr-prog-low">
        <div class="tr-prog-last">Прошлый раз: ${lastLine}</div>
        <div class="tr-prog-target"><i class="ti ti-refresh"></i> Оставь <strong>${trEsc(weight)} кг</strong>, работай над повторами (цель ${prog.min}–${prog.max})</div>
      </div>`
    };
  }
}

function trRenderExercise(ex, plan, weekIndex, dayIdx, exIdx, sessionIdx) {
  const progress = trCalcProgress(plan, weekIndex, ex.name);
  const arrow = progress.dir === 'up' ? '▲' : progress.dir === 'down' ? '▼' : '';
  const sign = progress.pct > 0 ? '+' : '';
  const diffStr = (progress.diff !== undefined && progress.diff !== 0)
    ? ' ' + (progress.diff > 0 ? '+' : '') + (Math.round(progress.diff * 10) / 10) + ' кг'
    : '';
  let progressBadge = '<span class="tr-progress '+progress.dir+'">'+(arrow ? arrow+' ' : '')+sign+progress.pct+'%'+diffStr+'</span>';
  /* Двунаправленный прогресс-бар: центр = 0%, вправо = рост, влево = падение */
  const clampedPct = Math.min(50, Math.abs(progress.pct) / 2); /* макс ±50% от центра */
  const barColor = progress.dir === 'up' ? '#A8C97F' : progress.dir === 'down' ? '#FF5C5C' : '#3A3D45';
  const barLeft = progress.dir === 'down' ? (50 - clampedPct) + '%' : '50%';
  const barWidth = clampedPct > 0 ? clampedPct + '%' : '0%';
  let bar = `<div class="tr-progress-bar-track"><div class="tr-progress-bar-fill" style="left:${barLeft}; width:${barWidth}; background:${barColor};"></div></div>`;
  /* AI-тренировка, которую ещё не сделали: это план, прироста пока нет */
  const _sess = (((plan.weeks[weekIndex] || {}).days || [])[dayIdx] || {}).sessions;
  const _s = _sess ? _sess[sessionIdx] : null;
  /* будущий день (и несделанная AI-тренировка на сегодня): прироста ещё нет, это план */
  {
    const _dt = window.TrainingAI && TrainingAI.planDayDate ? TrainingAI.planDayDate(plan, plan.weeks[weekIndex].days[dayIdx].date) : null;
    const _t0 = new Date(); _t0.setHours(0, 0, 0, 0);
    const future = _dt && _dt > _t0;
    const aiTodo = _s && _s.ai && !_s.aiOk && (!_dt || _dt >= _t0);
    if (future || aiTodo) { progressBadge = '<span class="tr-progress plan">план</span>'; bar = '<div class="tr-progress-bar-track"></div>'; }
  }
  const wrap = (headline, meta) => `
    <div class="tr-exercise-wrap" draggable="false" data-week="${weekIndex}" data-day="${dayIdx}" data-session="${sessionIdx}" data-ex="${exIdx}">
      <div class="tr-drag-handle" title="Перетащить"><i class="ti ti-grip-vertical"></i></div>
      <button class="tr-exercise" data-week="${weekIndex}" data-day="${dayIdx}" data-session="${sessionIdx}" data-ex="${exIdx}">
        <div class="tr-ex-top">
          <div class="tr-ex-name">${trEsc(ex.name)}</div>
          <div class="tr-ex-stats">
            <span class="tr-ex-weight num">${headline}</span>
          </div>
        </div>
        <div class="tr-ex-bottom"><div class="tr-ex-meta num">${meta}</div>${progressBadge}</div>
        ${bar}
      </button>
    </div>`;

  if (ex.kind === 'cardio') {
    const pace = trPace(ex);
    if (!(+ex.distance > 0)) return wrap(`${trEsc(ex.duration || 0)} мин`, 'без дистанции');
    return wrap(`${trEsc(String(ex.distance).replace('.', ','))} км`, `${trEsc(ex.duration)} мин${pace ? ' · ' + pace : ''}`);
  }
  if (ex.kind === 'time_calorie') {
    return wrap(`${trEsc(ex.calories)} ккал`, `${trEsc(ex.duration)} мин`);
  }
  if (ex.kind === 'steps') {
    return wrap(`${(+ex.steps || 0).toLocaleString('ru-RU')} шагов`, '');
  }
  /* крупно тоннаж, рабочий вес строкой ниже */
  const tonnage = trTonnage(ex);
  const wNum = +ex.weight || 0;
  const wStr = String(wNum).replace('.', ',');
  if (!wNum) return wrap(/подтяг|отжим|брусь|планк|скруч|подъём ног|гиперэкст/i.test(ex.name) ? 'свой вес' : '<span class="tr-ex-pick">вес подбери</span>', `${trEsc(ex.sets)} × ${trEsc(ex.reps)}`).replace(/<span class="tr-progress [^"]*">[^<]*<\/span>/, '');
  return wrap(`${tonnage.toLocaleString('ru-RU')} кг`, `${trEsc(ex.sets)} × ${trEsc(ex.reps)} · вес ${wStr} кг`);
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

/* экранирование текста пользователя (заметки, названия), чтобы HTML не исполнялся */
/* числа из полей ввода: запятая как точка, без минуса, NaN и бесконечности, с разумным потолком */
function trNum(v, max) { const n = parseFloat(String(v == null ? '' : v).replace(',', '.').replace(/\s/g, '')); return isFinite(n) && n > 0 ? Math.min(n, max || 100000) : 0; }
function trInt(v, max) { return Math.round(trNum(v, max)); }
/* перед сохранением: заполненное поле с минусом, не числом или слишком большим числом не превращаем молча в 0 */
const TR_NUM_MAX = { 'm-sets': 50, 'm-reps': 1000, 'm-weight': 1000, 'm-distance': 1000, 'm-duration': 1440, 'm-calories': 20000, 'm-steps': 200000, 'm-set-reps': 1000, 'm-set-weight': 1000 };
function trNumsBad(root) {
  const bad = [];
  root.querySelectorAll('#m-sets, #m-reps, #m-weight, #m-distance, #m-duration, #m-calories, #m-steps, .m-set-reps, .m-set-weight').forEach(i => {
    const raw = String(i.value || '').trim(); if (!raw) return;
    const n = +raw.replace(',', '.').replace(/\s/g, ''), max = TR_NUM_MAX[i.id] || TR_NUM_MAX[[...i.classList].find(c => TR_NUM_MAX[c])] || 100000;
    if (!isFinite(n) || n < 0 || n > max) bad.push(((i.closest('label') || {}).textContent || 'число').replace(/\s+/g, ' ').trim().split(/[ ,]/)[0].toLowerCase());
  });
  if (bad.length) alert('Проверь: ' + [...new Set(bad)].join(', ') + '. Нужно положительное число в разумных пределах');
  return bad.length > 0;
}
/* подпись группы: ключ данных «FULL BODY» не меняем (старые записи), а показываем по-русски */
function trGL(g) { return g === 'FULL BODY' ? 'Всё тело' : g; }
function trEsc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* окно ввода текста вместо системного prompt(): несколько строк, кнопки в стиле приложения.
   Возвращает строку, '' (удалить) или null (отмена) */
function trAskText(o) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.className = 'tr-modal-overlay';
    ov.innerHTML = `<div class="tr-modal tr-ask">
      <p class="tr-modal-title">${trEsc(o.title)}</p>
      ${o.hint ? `<p class="tr-ask-hint">${trEsc(o.hint)}</p>` : ''}
      <textarea id="tr-ask-t" rows="4" maxlength="600" placeholder="Напиши здесь">${trEsc(o.value || '')}</textarea>
      <div class="tr-modal-actions">
        ${o.clear ? '<button class="tr-modal-btn-secondary" id="tr-ask-del">Удалить</button>' : '<button class="tr-modal-btn-secondary" id="tr-ask-x">Отмена</button>'}
        <button class="tr-modal-btn-primary" id="tr-ask-ok">Сохранить</button>
      </div></div>`;
    document.body.appendChild(ov);
    const ta = ov.querySelector('#tr-ask-t');
    const done = (v) => { ov.remove(); resolve(v); };
    ov.addEventListener('click', e => { if (e.target === ov) done(null); });
    const x = ov.querySelector('#tr-ask-x'); if (x) x.onclick = () => done(null);
    const del = ov.querySelector('#tr-ask-del'); if (del) del.onclick = () => done('');
    ov.querySelector('#tr-ask-ok').onclick = () => done(ta.value);
    const onKey = (e) => { if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); done(null); } };
    document.addEventListener('keydown', onKey);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 60);
  });
}

/* метки тренировки: насыщенный фон и светлый текст своего цвета */
function trTagStyle(c) {
  c = trSafeColor(c, '#8A8985');
  return `background:${c}33; color:color-mix(in srgb, ${c} 55%, #fff); border-color:${c}55; box-shadow:inset 0 0 0 1px ${c}40;`;
}

/* AI-тренировки в Плане, у которых больше нет AI-плана: баннер с кнопкой «Убрать» */
function trAiOrphanBanner(plan) {
  if (!window.TrainingAI || !TrainingAI.orphanList) return '';
  const t = Store.get().training || {};
  if (t.ai) return '';
  const n = TrainingAI.orphanList(plan).length;
  if (!n) return '';
  return `<div class="tr-orph"><i class="ti ti-sparkles"></i><div><b>${n} ${n % 10 === 1 && n % 100 !== 11 ? 'тренировка' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? 'тренировки' : 'тренировок'} от удалённого AI-плана</b><span>Сделанные и изменённые тобой останутся</span></div><button id="tr-orph-rm">Убрать</button></div>`;
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
      return `<span class="tr-day-tag has-session" style="${trTagStyle(c)}">${trEsc(trGL(g))}</span>`;
    }).join('');
    const exercisesHtml = session.exercises.map((ex, exIdx) => trRenderExercise(ex, plan, weekIndex, dayIdx, exIdx, sessionIdx)).join('');

    return `
      <div class="tr-session">
        <div class="tr-session-head">
          <span class="tr-day-tag has-session tr-session-type-tag" title="Сменить тип" data-week="${weekIndex}" data-day="${dayIdx}" data-session="${sessionIdx}" style="${trTagStyle(typeColor)}cursor:pointer;">${trEsc(session.type)}</span>${groupTags}
          <span class="tr-session-actions">
            <button class="tr-session-move tr-day-add" data-week="${weekIndex}" data-day="${dayIdx}" data-session="${sessionIdx}" aria-label="Перенести тренировку" title="Перенести в другой день"><i class="ti ti-calendar-share"></i></button>
            ${!isRest ? `<button class="tr-day-add tr-session-add-ex" data-week="${weekIndex}" data-day="${dayIdx}" data-session="${sessionIdx}" aria-label="Добавить упражнение" title="Добавить упражнение в эту тренировку"><i class="ti ti-plus"></i></button>` : ''}
            <button class="tr-day-add tr-day-clear" data-week="${weekIndex}" data-day="${dayIdx}" data-session="${sessionIdx}" aria-label="Удалить тренировку" title="Удалить эту тренировку"><i class="ti ti-trash"></i></button>
          </span>
        </div>
        ${isRest ? '<div class="tr-day-empty">День отдыха</div>' : exercisesHtml}
        ${(!isRest && session.exercises.length === 0) ? '<div class="tr-day-empty">Нет упражнений</div>' : ''}
      </div>`;
  }).join('');

  /* в кабинете тренера кнопка заметки пишет заметку тренера, а заметка клиента подписана */
  const coachMode = !!window.__coachMode;
  const comment = day.comment || '';
  const myNote = coachMode ? (day.coachNote || '') : comment;
  const commentHtml = (comment
    ? `<div class="tr-day-comment"><i class="ti ti-message-circle" style="font-size:12px;"></i> ${coachMode ? '<b>Клиент:</b> ' : ''}${trEsc(comment)}</div>`
    : '') + (day.coachNote
    ? `<div class="tr-day-coachnote"><i class="ti ti-user-star"></i><span><b>Тренер:</b> ${trEsc(day.coachNote)}</span></div>`
    : '');

  return `
    <div class="tr-day${isToday ? ' tr-day-today' : ''}">
      <div class="tr-day-head">
        <span class="tr-day-date">${trEsc(day.date)} ${trEsc(day.dow)}</span>
        ${isToday ? '<span class="tr-today-badge">Сегодня</span>' : ''}
        ${!hasAnySession ? `<span class="tr-day-tag">не задано</span>` : ''}
        <span style="display:flex; gap:4px; margin-left:auto; align-items:center;">
          ${window.TrainerClient ? TrainerClient.doneBtn(day, plan, weekIndex, dayIdx) : ''}
          <button class="tr-day-comment-btn" data-week="${weekIndex}" data-day="${dayIdx}" title="${myNote ? 'Изменить заметку' : (coachMode ? 'Заметка тренера (клиент её увидит)' : 'Добавить заметку')}" style="background:none; border:none; cursor:pointer; color:${myNote ? '#2E7FD4' : '#555'}; padding:2px 4px;"><i class="ti ti-message-circle"></i></button>
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
        <span class="tr-week-label">Неделя ${trEsc(week.weekNum)}</span>
        <span class="tr-week-range">${trEsc(week.range)}</span>
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
  window._trEditingEx = ex; /* подсказка «Прошлый раз» не должна брать эту же запись */
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';

  let fieldsHtml = '';
  if (ex.kind === 'cardio') {
    fieldsHtml = `
      <div class="tr-modal-row">
        <label>Дистанция, км<input type="text" id="m-distance" value="${trEsc(String(ex.distance || '').replace('.', ','))}" inputmode="decimal"></label>
        <label>Время, мин<input type="number" id="m-duration" value="${trEsc(ex.duration)}" inputmode="numeric"></label>
      </div>`;
  } else if (ex.kind === 'time_calorie') {
    fieldsHtml = `
      <div class="tr-modal-row">
        <label>Время, мин<input type="number" id="m-duration" value="${trEsc(ex.duration)}" inputmode="numeric"></label>
        <label>Калории<input type="number" id="m-calories" value="${trEsc(ex.calories)}" inputmode="numeric"></label>
      </div>`;
  } else if (ex.kind === 'steps') {
    fieldsHtml = `
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Количество шагов<input type="number" id="m-steps" value="${trEsc(ex.steps)}" inputmode="numeric"></label>
      </div>`;
  } else {
    const hint = trProgressionHint(plan, ex.name);
    const hintHtml = hint ? hint.html : '';
    fieldsHtml = `
      ${hintHtml}
      <div class="tr-modal-row">
        <label>Подходы<input type="number" id="m-sets" value="${trEsc(ex.sets)}" inputmode="numeric"></label>
        <label>Повторы<input type="number" id="m-reps" value="${trEsc(ex.reps)}" inputmode="numeric"></label>
        <label>Вес, кг<input type="text" id="m-weight" value="${trEsc(String(ex.weight || '').replace('.', ','))}" inputmode="decimal"></label>
      </div>
      <button type="button" class="tr-link-btn" id="m-toggle-sets">${ex.setDetails ? 'Скрыть' : 'Записать каждый подход отдельно'}</button>
      <div id="m-set-details-wrap">${ex.setDetails ? trBuildSetDetailsRows(ex.setDetails) : ''}</div>`;
  }

  overlay.innerHTML = `
    <div class="tr-modal">
      <div class="tr-modal-head"><p class="tr-modal-title">${trEsc(ex.name)}</p><button class="tr-modal-del" id="m-delete" title="Удалить упражнение" aria-label="Удалить упражнение"><i class="ti ti-trash"></i></button></div>
      ${fieldsHtml}
      <div class="tr-modal-actions">
        <button class="tr-modal-btn-secondary" id="m-cancel">Отмена</button>
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
        <input type="text" class="m-set-weight" value="" placeholder="кг" inputmode="decimal">
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
    if (trNumsBad(overlay)) return;
    if (ex.kind === 'cardio') {
      ex.distance = trNum(overlay.querySelector('#m-distance').value, 1000);
      ex.duration = trNum(overlay.querySelector('#m-duration').value, 1440);
    } else if (ex.kind === 'time_calorie') {
      ex.duration = trNum(overlay.querySelector('#m-duration').value, 1440);
      ex.calories = trNum(overlay.querySelector('#m-calories').value, 20000);
    } else if (ex.kind === 'steps') {
      ex.steps = trInt(overlay.querySelector('#m-steps').value, 200000);
    } else {
      const detailRows = overlay.querySelectorAll('.tr-set-detail-row');
      if (detailRows.length > 0) {
        const setDetails = Array.from(detailRows).map(row => ({
          reps: trInt(row.querySelector('.m-set-reps').value, 1000),
          weight: trNum(row.querySelector('.m-set-weight').value, 1000)
        }));
        ex.setDetails = setDetails;
        ex.sets = setDetails.length;
        ex.reps = Math.round(setDetails.reduce((s, d) => s + d.reps, 0) / setDetails.length) || 0;
        /* рабочий вес: самый тяжёлый подход, а не среднее (среднего веса на штанге не было) */
        ex.weight = Math.max(0, ...setDetails.map(d => d.weight));
      } else {
        ex.sets = trInt(overlay.querySelector('#m-sets').value, 50);
        ex.reps = trInt(overlay.querySelector('#m-reps').value, 1000);
        ex.weight = trNum(overlay.querySelector('#m-weight').value, 1000);
        delete ex.setDetails;
      }
    }
    overlay.remove();
    onSave();
  });
  overlay.querySelector('#m-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#m-delete').addEventListener('click', () => {
    if (!confirm('Удалить упражнение «' + ex.name + '»?')) return;
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
          <input type="number" class="m-set-reps" value="${trEsc(d.reps||'')}" placeholder="повт." inputmode="numeric">
          <span class="tr-set-x">×</span>
          <input type="text" class="m-set-weight" value="${trEsc(d.weight ? String(d.weight).replace('.', ',') : '')}" placeholder="кг" inputmode="decimal">
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
  return `Последний раз: ${trEsc(last.ex.sets)} × ${trEsc(last.ex.reps)} × ${trEsc(last.ex.weight)} кг. Можно попробовать ~${suggested} кг.`;
}

/* ── Короткие списки в модалках тренировок показываем кнопками, как в кабинете тренера.
   Сам select остаётся (скрытый), поэтому вся логика .value и change работает как раньше ── */
function trChipify(root) {
  root.querySelectorAll('.tr-modal select').forEach(sel => {
    if (sel.dataset.chips || sel.id === 'm-name' || sel.options.length < 2 || sel.options.length > 12) return;
    sel.dataset.chips = '1'; sel.style.display = 'none';
    if (sel.id === 'm-type') { trDropdown(sel); return; }
    const box = document.createElement('div'); box.className = 'tr-chips';
    const draw = () => { box.innerHTML = Array.from(sel.options).map(o => `<button type="button" class="tr-chip${o.value === sel.value ? ' on' : ''}" data-v="${o.value.replace(/"/g, '&quot;')}">${trEsc(o.textContent)}</button>`).join(''); };
    draw();
    box.addEventListener('click', (e) => { const b = e.target.closest('.tr-chip'); if (!b || b.dataset.v === sel.value) return; sel.value = b.dataset.v; draw(); sel.dispatchEvent(new Event('change', { bubbles: true })); });
    sel.insertAdjacentElement('afterend', box);
  });
}
/* «Тип» тренировки: свой раскрывающийся список с цветом и подписью */
function trDropdown(sel) {
  const cat = (v) => TRAINING_CATEGORIES.find(c => c.id === v) || { id: v, label: v, color: '#8A8F9C', desc: '' };
  const dd = document.createElement('div'); dd.className = 'tr-dd';
  const head = () => { const c = cat(sel.value); return `<button type="button" class="tr-dd-h"><i class="tr-dd-dot" style="--c:${c.color}"></i><span><b>${c.label}</b><small>${c.desc || ''}</small></span><i class="ti ti-chevron-down tr-dd-ch"></i></button>`; };
  const list = () => `<div class="tr-dd-list">${Array.from(sel.options).map(o => { const c = cat(o.value); return `<button type="button" class="tr-dd-o${o.value === sel.value ? ' on' : ''}" data-v="${o.value.replace(/"/g, '&quot;')}"><i class="tr-dd-dot" style="--c:${c.color}"></i><span><b>${c.label}</b><small>${c.desc || ''}</small></span>${o.value === sel.value ? '<i class="ti ti-check"></i>' : ''}</button>`; }).join('')}</div>`;
  const draw = (open) => { dd.classList.toggle('open', !!open); dd.innerHTML = head() + (open ? list() : ''); };
  draw(false);
  dd.addEventListener('click', (e) => {
    const o = e.target.closest('.tr-dd-o');
    if (o) { const ch = o.dataset.v !== sel.value; sel.value = o.dataset.v; draw(false); if (ch) sel.dispatchEvent(new Event('change', { bubbles: true })); return; }
    if (e.target.closest('.tr-dd-h')) draw(!dd.classList.contains('open'));
  });
  sel.insertAdjacentElement('afterend', dd);
}
(function trChipWatch() {
  if (window.__trChipObs) return;
  const ok = (ov) => (/training/.test(location.hash) || (window.__coachMode && document.querySelector('.coach-tr'))) && !/modal-(finance|habits|goals)|fin-/.test(ov.className || '');
  window.__trChipObs = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      const ov = n.classList && n.classList.contains('tr-modal-overlay') ? n : (n.closest && n.closest('.tr-modal-overlay'));
      if (ov && ok(ov)) trChipify(ov);
    }
  });
  const go = () => window.__trChipObs.observe(document.body, { childList: true, subtree: true });
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
})();

function trBuildExerciseSelect(selectedGroups) {
  const list = trExercisesForGroups(selectedGroups);
  const customOption = `<option value="__custom__">Своё название…</option>`;
  if (list.length === 0) {
    return `<select id="m-name" class="tr-color-select"><option value="">Выбери группу мышц</option>${customOption}</select>`;
  }
  const options = list.map(name => `<option value="${trEsc(name)}">${trEsc(name)}</option>`).join('');
  return `<select id="m-name" class="tr-color-select">${options}${customOption}</select>`;
}

/* ── Группы мышц: кнопки + силуэт ──────────────────────────────
   Картинки лежат в img/m/. Для 9 готовых комбинаций — готовые PNG,
   для любых других сочетаний силуэт собирается из слоёв ov_*.png */
const MUSCLE_IMG_KEY = { 'Грудь':'chest', 'Спина':'back', 'Ноги':'legs', 'Руки':'arms', 'Плечи':'shoulders', 'Кор':'core' };
const MUSCLE_KEY_ORDER = ['chest','back','legs','arms','shoulders','core'];
const MUSCLE_COMBOS = {
  'chest_shoulders':1, 'chest_arms':1, 'chest_core':1,   /* Грудь+Плечи, Грудь+Руки, Грудь+Кор */
  'back_arms':1, 'back_shoulders':1, 'back_core':1,      /* Спина+Руки, Спина+Плечи, Спина+Кор */
  'legs_core':1, 'legs_shoulders':1, 'legs_arms':1,      /* Ноги+Кор, Ноги+Плечи, Ноги+Руки */
};
function trMuscleImageHtml(groups) {
  const img = f => `<img src="img/m/${f}.png" alt="" draggable="false">`;
  const g = (groups || []).filter(Boolean);
  const keys = g.filter(x => MUSCLE_IMG_KEY[x]).map(x => MUSCLE_IMG_KEY[x])
    .sort((a, b) => MUSCLE_KEY_ORDER.indexOf(a) - MUSCLE_KEY_ORDER.indexOf(b));
  let inner;
  if (g.includes('FULL BODY') || keys.length >= 6) inner = img('full');
  else if (keys.length === 0) inner = img('body');
  else if (keys.length === 1) inner = img(keys[0]);
  else if (keys.length === 2 && MUSCLE_COMBOS[keys.join('_')]) inner = img(keys.join('_'));
  else inner = img('body') + keys.map(k => img('ov_' + k)).join('');
  return `<div class="m-sil-stack">${inner}</div>`;
}

function trMuscleBtn(name, active) {
  const label = name === 'FULL BODY' ? 'Всё<br>тело' : trEsc(name);
  return `<label class="m-group-label${name === 'FULL BODY' ? ' m-group-full' : ''}${active ? ' is-on' : ''}" data-group="${name}" style="--mc:${MUSCLE_COLOR[name] || '#8A8F9C'};">
      <input type="checkbox" class="m-group-cb m-group-check" value="${name}" ${active ? 'checked' : ''} style="display:none;">
      <span>${label}</span>
    </label>`;
}

function trBuildGroupCheckboxes(selected) {
  selected = selected || [];
  const has = n => selected.includes(n);
  return `<div class="m-groups-picker">
      ${['Грудь','Спина','Ноги','Руки','Плечи','Кор'].map(n => trMuscleBtn(n, has(n))).join('')}
      ${trMuscleBtn('FULL BODY', has('FULL BODY'))}
      <div id="m-silhouette" class="m-silhouette">${trMuscleImageHtml(selected)}</div>
    </div>`;
}

/* Обновить подсветку кнопок и силуэт по отмеченным чекбоксам */
function trRefreshMuscleVisual(root, groups) {
  root.querySelectorAll('.m-group-label').forEach(lbl => {
    const cb = lbl.querySelector('.m-group-cb');
    if (cb) lbl.classList.toggle('is-on', cb.checked);
  });
  const sil = root.querySelector('#m-silhouette');
  if (sil) sil.innerHTML = trMuscleImageHtml(groups);
}

function trBuildFormFields(typeName, selectedGroups, plan) {
  if (trIsRestType(typeName)) {
    return `<p style="font-size:13px; color:var(--tr-bone-faint); margin:4px 0 0;">День отмечен как отдых. Упражнения не нужны.</p>`;
  }
  if (trIsGymType(typeName)) {
    return `
      <div class="tr-modal-row">
        <div style="flex:1 1 100%" class="m-groups-field"><span class="m-groups-title">Группы мышц</span>
          ${trBuildGroupCheckboxes(selectedGroups)}
        </div>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Упражнение<span id="m-name-wrap">${trBuildExerciseSelect(selectedGroups)}</span></label>
      </div>
      <div class="tr-modal-row">
        <label>Подходы<input type="number" id="m-sets" placeholder="0" inputmode="numeric"></label>
        <label>Повторы<input type="number" id="m-reps" placeholder="0" inputmode="numeric"></label>
        <label>Вес, кг<input type="text" id="m-weight" placeholder="0" inputmode="decimal"></label>
      </div>
      <p class="tr-hint" id="m-weight-hint"></p>`;
  }
  if (trIsCardioType(typeName)) {
    return `
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Направление${trBuildSelect('m-cardio-dir', CARDIO_DIRECTIONS.map(d => ({ name: d })), CARDIO_DIRECTIONS[0])}</label>
      </div>
      <div class="tr-modal-row">
        <label>Дистанция, км<input type="text" id="m-distance" placeholder="0" inputmode="decimal"></label>
        <label>Время, мин<input type="number" id="m-duration" placeholder="0" inputmode="numeric"></label>
      </div>`;
  }
  if (trIsTimeCalorieType(typeName)) {
    return `
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Вид спорта
          <select id="m-sport-name" style="width:100%;margin-top:6px;padding:10px 12px;background:#22252F;border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#E8E5DC;font-size:14px;font-family:Montserrat,sans-serif;">
            <option value="Теннис">Теннис</option><option value="Бокс">Бокс</option><option value="Баскетбол">Баскетбол</option><option value="Футбол">Футбол</option><option value="Волейбол">Волейбол</option><option value="Борьба">Борьба</option><option value="Лыжи">Лыжи</option><option value="Сноуборд">Сноуборд</option><option value="Коньки">Коньки</option>
          </select>
        </label>
      </div>
      <div class="tr-modal-row">
        <label>Время, мин<input type="number" id="m-duration" placeholder="0" inputmode="numeric"></label>
        <label>Калории<input type="number" id="m-calories" placeholder="0" inputmode="numeric"></label>
      </div>`;
  }
  if (trIsStepsType(typeName)) {
    return `
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Количество шагов<input type="number" id="m-steps" placeholder="0" inputmode="numeric"></label>
      </div>`;
  }
  if (trIsFitnessType(typeName)) {
    return `
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Вид занятия
          <select id="m-fitness-name" style="width:100%;margin-top:6px;padding:10px 12px;background:#22252F;border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#E8E5DC;font-size:14px;font-family:Montserrat,sans-serif;">
            <option value="Растяжка">Растяжка</option><option value="Стрейчинг">Стрейчинг</option><option value="Пилатес">Пилатес</option><option value="Йога">Йога</option><option value="Функциональная">Функциональная</option>
          </select>
        </label>
      </div>
      <div class="tr-modal-row">
        <label>Время, мин<input type="number" id="m-duration" placeholder="0" inputmode="numeric"></label>
        <label>Калории<input type="number" id="m-calories" placeholder="0" inputmode="numeric"></label>
      </div>`;
  }
  // Фолбэк для любого другого типа
  return `
    <div class="tr-modal-row">
      <label>Время, мин<input type="number" id="m-duration" placeholder="0" inputmode="numeric"></label>
      <label>Калории<input type="number" id="m-calories" placeholder="0" inputmode="numeric"></label>
    </div>`;
}

function trOpenAddExerciseToSessionModal(plan, weekIndex, dayIdx, sessionIdx, onSave) {
  const day = plan.weeks[weekIndex].days[dayIdx];
  const session = day.sessions[sessionIdx];
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';
  overlay.innerHTML = `
    <div class="tr-modal">
      <p class="tr-modal-title">${trEsc(day.date)} ${trEsc(day.dow)} · ${trEsc(session.type)}</p>
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
    trPrefillFromLast(overlay, plan, nameEl.value);
    const hint = trProgressionHint(plan, nameEl.value);
    hintEl.innerHTML = hint ? hint.html : '';
  }

  function refreshMuscleUI() {
    const groups = selectedGroupsNow();

    trRefreshMuscleVisual(overlay, Array.from(overlay.querySelectorAll('.m-group-cb:checked')).map(cb => cb.value));

    // Обновляем список упражнений
    const wrap = overlay.querySelector('#m-name-wrap');
    if (wrap) { wrap.innerHTML = trBuildExerciseSelect(groups); bindNameSelect(); }
  }

  function bindGroupCheckboxes() {
    overlay.querySelectorAll('.m-group-label').forEach(lbl => {
      lbl.addEventListener('click', (e) => {
        e.preventDefault();
        const cb = lbl.querySelector('.m-group-cb');
        if (!cb) return;
        cb.checked = !cb.checked;
        refreshMuscleUI();
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
    if (trNumsBad(overlay)) return;
    const type = session.type;
    if (trIsGymType(type)) {
      const groups = selectedGroupsNow();
      const name = overlay.querySelector('#m-name').value.trim();
      if (!name) return;
      session.groups = groups;
      session.exercises.push({
        kind: 'strength',
        name,
        sets: trInt(overlay.querySelector('#m-sets').value, 50),
        reps: trInt(overlay.querySelector('#m-reps').value, 1000),
        weight: trNum(overlay.querySelector('#m-weight').value, 1000)
      });
    } else if (trIsCardioType(type)) {
      const direction = overlay.querySelector('#m-cardio-dir').value;
      session.exercises.push({
        kind: 'cardio', name: direction,
        distance: trNum(overlay.querySelector('#m-distance').value, 1000),
        duration: trNum(overlay.querySelector('#m-duration').value, 1440)
      });
    } else if (trIsTimeCalorieType(type)) {
      session.exercises.push({
        kind: 'time_calorie', name: type,
        duration: trNum(overlay.querySelector('#m-duration').value, 1440),
        calories: trNum(overlay.querySelector('#m-calories').value, 20000)
      });
    } else if (trIsStepsType(type)) {
      session.exercises.push({
        kind: 'steps', name: type,
        steps: trInt(overlay.querySelector('#m-steps').value, 200000)
      });
    }
    overlay.remove();
    onSave();
  });
}

function trOpenAddModal(plan, weekIndex, dayIdx, onSave) {
  const day = plan.weeks[weekIndex].days[dayIdx];
  trMigrateDayToSessions(day);
  const initialType = TRAINING_CATEGORIES[0].id;
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';
  overlay.innerHTML = `
    <div class="tr-modal">
      <p class="tr-modal-title">${trEsc(day.date)} ${trEsc(day.dow)}${day.sessions.length > 0 ? ' · новая тренировка' : ''}</p>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Тип${trBuildSelect('m-type', TRAINING_CATEGORIES.map(function(t){return {name:t.id,color:t.color};}), initialType)}</label>
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
    trPrefillFromLast(overlay, plan, nameEl.value);
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

  function refreshAddMuscleUI() {
    const groups = selectedGroupsNow();
    trRefreshMuscleVisual(overlay, groups);
    const wrap = overlay.querySelector('#m-name-wrap');
    if (wrap) { wrap.innerHTML = trBuildExerciseSelect(groups); bindNameSelect(); }
  }

  function bindGroupCheckboxes() {
    overlay.querySelectorAll('.m-group-label').forEach(lbl => {
      lbl.addEventListener('click', (e) => {
        e.preventDefault();
        const cb = lbl.querySelector('.m-group-cb');
        if (!cb) return;
        cb.checked = !cb.checked;
        refreshAddMuscleUI();
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
    if (trNumsBad(overlay)) return;
    const type = currentType();

    if (trIsRestType(type)) {
      day.sessions.push({ type, groups: [], exercises: [] });
      overlay.remove();
      onSave();
      return;
    }

    if (trIsGymType(type)) {
      const groups = selectedGroupsNow();
      const name = overlay.querySelector('#m-name').value.trim();
      if (!name) return;
      day.sessions.push({
        type, groups,
        exercises: [{
          kind: 'strength',
          name,
          sets: trInt(overlay.querySelector('#m-sets').value, 50),
          reps: trInt(overlay.querySelector('#m-reps').value, 1000),
          weight: trNum(overlay.querySelector('#m-weight').value, 1000)
        }]
      });
      overlay.remove();
      onSave();
      return;
    }

    if (trIsCardioType(type)) {
      const direction = overlay.querySelector('#m-cardio-dir').value;
      const distance = trNum(overlay.querySelector('#m-distance').value, 1000);
      const duration = trNum(overlay.querySelector('#m-duration').value, 1440);
      day.sessions.push({ type, groups: [], exercises: [{ kind: 'cardio', name: direction, distance, duration }] });
      overlay.remove();
      onSave();
      return;
    }

    if (trIsTimeCalorieType(type)) {
      const duration = trNum(overlay.querySelector('#m-duration').value, 1440);
      const calories = trNum(overlay.querySelector('#m-calories').value, 20000);
      /* «Спорт»: название берём из выбранного вида (Бокс, Теннис…), а не просто «Спорт» */
      const sp = overlay.querySelector('#m-sport-name'), spName = sp && sp.value ? sp.value : type;
      day.sessions.push({ type, groups: [], exercises: [{ kind: 'time_calorie', name: spName, duration, calories }] });
      overlay.remove();
      onSave();
      return;
    }

    if (trIsStepsType(type)) {
      const steps = trInt(overlay.querySelector('#m-steps').value, 200000);
      day.sessions.push({ type, groups: [], exercises: [{ kind: 'steps', name: type, steps }] });
      overlay.remove();
      onSave();
      return;
    }

    if (trIsFitnessType(type)) {
      const nameEl = overlay.querySelector('#m-fitness-name');
      const name = nameEl ? (nameEl.value || type) : type;
      const duration = trNum(overlay.querySelector('#m-duration')?.value, 1440);
      const calories = trNum(overlay.querySelector('#m-calories')?.value, 20000);
      day.sessions.push({ type, groups: [], exercises: [{ kind: 'time_calorie', name, duration, calories }] });
      overlay.remove();
      onSave();
      return;
    }

    // Фолбэк — сохраняем с duration/calories
    const _sportSel = overlay.querySelector('#m-sport-name');
    const _sportName = _sportSel ? _sportSel.value : type;
    const duration = trNum(overlay.querySelector('#m-duration')?.value, 1440);
    const calories = trNum(overlay.querySelector('#m-calories')?.value, 20000);
    day.sessions.push({ type, groups: [], exercises: [{ kind: 'time_calorie', name: _sportName, duration, calories }] });
    overlay.remove();
    onSave();
  });
}


/* ═══════════════════════════════════════════
   1RM CALCULATOR — Epley formula
   1RM = weight × (1 + reps / 30)
   ═══════════════════════════════════════════ */
function calc1RM(weight, reps) {
  if (!weight || !reps || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/* Рекомендации по зонам нагрузки от 1RM */
function get1RMZones(rm) {
  return [
    { label: 'Максимальная сила',  pct: 95, reps: '1–2',  color: '#FF5C5C', kg: Math.round(rm * 0.95) },
    { label: 'Сила',              pct: 85, reps: '3–5',  color: '#FF8C42', kg: Math.round(rm * 0.85) },
    { label: 'Сила + масса',      pct: 75, reps: '6–8',  color: '#F59E0B', kg: Math.round(rm * 0.75) },
    { label: 'Масса',             pct: 70, reps: '8–12', color: '#4A7CFF', kg: Math.round(rm * 0.70) },
    { label: 'Выносливость',      pct: 60, reps: '12–20',color: '#34D399', kg: Math.round(rm * 0.60) },
  ];
}

function trRender1RMCalc() {
  return `<div class="tr-1rm-wrap">
    <div class="tr-1rm-hero">
      <div class="tr-1rm-title">Калькулятор максимума</div>
      <div class="tr-1rm-sub tr-1rm-what">Сколько ты поднимешь <b>один раз</b> и какие веса брать под силу, массу и выносливость.</div>
    </div>
    <div class="tr-1rm-inputs">
      <label class="tr-1rm-label">
        <span>Вес, кг</span>
        <input id="rm-weight" type="text" inputmode="decimal" placeholder="100" class="tr-1rm-input">
      </label>
      <div class="tr-1rm-x">×</div>
      <label class="tr-1rm-label">
        <span>Повторения</span>
        <input id="rm-reps" type="number" inputmode="numeric" placeholder="5" min="1" max="30" class="tr-1rm-input">
      </label>
    </div>
    <button id="rm-calc-btn" class="tr-1rm-btn">Рассчитать</button>
    <div id="rm-result" class="tr-1rm-result" style="display:none;"></div>
  </div>`;
}

window.Screens.training = function (mount) {
  window._trJumpToday = true; /* при входе в раздел план прокручивается к сегодняшнему дню */
  try { trSyncCatalogFromStore(); } catch (e) { console.warn('catalog sync', e); }
  const role = Auth.role();
  const activeId = trEnsureSeedPlan();
  let currentPlanId = activeId;

  function getPlan() {
    return trGetPlans().find(p => p.id === currentPlanId);
  }

  mount.innerHTML = `
    <div class="theme-dark" style="width:100%;min-width:0;box-sizing:border-box;">
      <div class="tr-header" style="display:flex;align-items:center;justify-content:space-between;width:100%;box-sizing:border-box;padding:14px 20px;padding-top:max(14px,env(safe-area-inset-top));background:linear-gradient(135deg,#1a3a8f 0%,#1e4fc2 50%,#2563eb 100%);position:sticky;top:0;z-index:20;">
        <div style="display:flex; align-items:center; gap:10px;">
          <button class="tr-back" id="tr-back"><i class="ti ti-arrow-left"></i></button>
          <p class="tr-title">Тренировки</p>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button class="tr-back tr-undo-btn" id="tr-undo" title="Отменить последнее действие"><i class="ti ti-arrow-back-up"></i></button>
          <button class="tr-back" id="tr-plan-menu-btn" title="Планы"><i class="ti ti-layout-list"></i></button>
          ${role === 'coach'
            ? `<button class="tr-coach-chip" id="tr-coach-me" title="Кабинет тренера"><i class="ti ti-user-shield"></i><span>Тренер</span><i class="ti ti-chevron-down tr-coach-chip-arr"></i></button>`
            : `<button class="tr-back tr-coach-btn" id="tr-trainer" title="Тренер"><i class="ti ti-user-star"></i></button><button class="tr-back" id="tr-logout"><i class="ti ti-logout"></i></button>`}
        </div>
      </div>
      <div class="tr-plan-bar" id="tr-plan-bar" style="display:none;">
        <select class="tr-plan-select" id="tr-plan-select"></select>
        <button class="tr-plan-new" id="tr-new-plan"><i class="ti ti-plus"></i> Новый план</button>
        ${role === 'coach' ? '' : '<button class="tr-plan-new tr-plan-share" id="tr-share-plan" title="Поделиться планом" aria-label="Поделиться планом"><i class="ti ti-share"></i></button>'}
      </div>
      <div class="tr-tabs">
        <button class="tr-tab active" data-tab="plan">План</button>
        <button class="tr-tab" data-tab="working-weight"><span class="tt-lg">Рабочий вес</span><span class="tt-sm">Веса</span></button>
        <button class="tr-tab" data-tab="summary">Итоги</button>
        <button class="tr-tab" data-tab="nutrition">Питание</button>
        <button class="tr-tab tr-tab-ai" data-tab="ai"><i class="ti ti-sparkles"></i> AI</button>
      </div>
      <div class="tr-body" id="tr-content"></div>
    </div>
  `;

  const content = document.getElementById('tr-content');
  /* Тренеру некуда уходить с тренировок — кнопку «назад» прячем */
  if (role === 'coach') { const bk = document.getElementById('tr-back'); if (bk) bk.style.visibility = 'hidden'; }
  const trainerBtn = document.getElementById('tr-trainer');
  if (trainerBtn) trainerBtn.addEventListener('click', () => { if (!window.TrainerLink) return; if (FirebaseSync.myTrainerCached && FirebaseSync.myTrainerCached()) TrainerLink.info(); else TrainerLink.connect(); });
  const coachMe = document.getElementById('tr-coach-me');
  if (coachMe) coachMe.addEventListener('click', trOpenCoachMeSheet);
  const planSelect = document.getElementById('tr-plan-select');

  function populatePlanSelect() {
    const plans = trGetPlans().slice().sort((a, b) => b.number - a.number);
    planSelect.innerHTML = plans.map(p =>
      `<option value="${trEsc(p.id)}" ${p.id === currentPlanId ? 'selected' : ''}>План №${trEsc(p.number)}${p.status === 'archived' ? ' · архив' : ''}</option>`
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
    /* у недели нет диапазона дат: считаем по дате начала плана */
    try { if (window.TrainingAI && TrainingAI.currentWeekIdx) { const k = TrainingAI.currentWeekIdx(plan); if (k >= 0 && k < plan.weeks.length) return k; } } catch (e) {}
    return -1; /* не найдена */
  }

  function loadCollapsedWeeks(planId, plan) {
    try {
      const raw = localStorage.getItem(collapsedWeeksKey(planId));
      const currentIdx = plan ? findCurrentWeekIndex(plan) : -1;
      if (raw) {
        const saved = JSON.parse(raw);
        // Текущая неделя всегда раскрыта
        return saved.filter(i => i !== currentIdx);
      }
      /* Первый раз: сворачиваем все кроме текущей недели */
      if (!plan) return [];
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
    /* дни от сегодня (прошедшие и текущий пропускаем), занятые подписаны */
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const options = [];
    plan.weeks.forEach((w, wi) => {
      w.days.forEach((d, di) => {
        if (wi === srcWeek && di === srcDay) return;
        const dt = window.TrainingAI && TrainingAI.planDayDate ? TrainingAI.planDayDate(plan, d.date) : null;
        if (dt && dt < t0) return;
        trMigrateDayToSessions(d);
        const busy = (d.sessions || []).filter(x => x && x.type !== 'Отдых').map(x => (x.groups && x.groups.length ? x.groups.join(', ') : x.type)).join(' · ');
        options.push({ wi, di, date: d.date, dow: d.dow, today: dt && +dt === +t0, busy });
      });
    });

    const overlay = document.createElement('div');
    overlay.className = 'tr-modal-overlay';
    overlay.innerHTML = `
      <div class="tr-modal tr-move" style="max-height:80vh; overflow-y:auto;">
        <p class="tr-modal-title">Перенести тренировку</p>
        <p class="tr-ask-hint">Выбери день</p>
        <div class="tr-move-grid">
          ${options.map(o => `
            <button class="tr-move-day-opt${o.today ? ' today' : ''}${o.busy ? ' busy' : ''}" data-wi="${o.wi}" data-di="${o.di}">
              <b>${trEsc(o.dow)}, ${trEsc(o.date)}</b><span>${o.today ? 'сегодня' : o.busy ? trEsc(o.busy) : 'свободно'}</span>
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
        const td = plan.weeks[tgtW].days[tgtD];
        if (window.TrainingAI && TrainingAI.toast) TrainingAI.toast('Перенёс на ' + td.dow + ', ' + td.date);
      });
    });
  }

  function bindPlanEvents(plan) {
    /* Комментарий к дню */
    content.querySelectorAll('.tr-day-comment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = parseInt(btn.dataset.week, 10), d = parseInt(btn.dataset.day, 10);
        const day = plan.weeks[w].days[d];
        const coach = !!window.__coachMode;
        trAskText({
          title: coach ? 'Заметка тренера' : 'Заметка к дню',
          hint: coach ? 'Клиент увидит её в этом дне' : 'Самочувствие, что получилось, что поменять',
          value: coach ? (day.coachNote || '') : (day.comment || ''),
          clear: coach ? !!day.coachNote : !!day.comment,
        }).then(v => {
          if (v === null) return;
          const pi = trGetPlans().findIndex(p => p.id === plan.id);
          if (coach) {
            day.coachNote = v.trim() || null;
            Store.set('training.plans.' + pi + '.weeks.' + w + '.days.' + d + '.coachNote', day.coachNote);
          } else {
            trSnapshotBeforeChange();
            day.comment = v.trim();
            /* Пустой коммент = удаление */
            Store.set('training.plans.' + pi + '.weeks.' + w + '.days.' + d + '.comment', day.comment || null);
          }
          renderTab('plan');
        });
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
        const snap = trSnapshotTake();
        trOpenExerciseModal(plan, w, d, s, ex, () => {
          trSnapshotPush(snap);
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
        const snap = trSnapshotTake();
        trOpenAddExerciseToSessionModal(plan, w, d, s, () => {
          trSnapshotPush(snap);
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

    // Клик на тег типа — быстрая смена типа
    content.querySelectorAll('.tr-session-type-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const w = parseInt(tag.dataset.week, 10);
        const d = parseInt(tag.dataset.day, 10);
        const s = parseInt(tag.dataset.session, 10);
        const session = plan.weeks[w].days[d].sessions[s];
        const overlay = document.createElement('div');
        overlay.className = 'tr-modal-overlay';
        const opts = TRAINING_TYPES.map(t =>
          `<button class="tr-type-pick-btn" data-type="${trEsc(t.name)}" style="display:flex;align-items:center;gap:8px;width:100%;padding:10px 14px;background:none;border:none;border-bottom:1px solid #2A2D35;color:${t.name===session.type?trBadgeColor(TRAINING_TYPES,t.name):'#E8E5DC'};cursor:pointer;font-size:13px;font-weight:${t.name===session.type?700:400};text-align:left;font-family:inherit;">
            <span style="width:8px;height:8px;border-radius:50%;background:${trBadgeColor(TRAINING_TYPES,t.name)};flex-shrink:0;"></span>
            ${trEsc(t.name)}
            ${t.name===session.type?'<i class="ti ti-check" style="margin-left:auto;font-size:14px;"></i>':''}
          </button>`
        ).join('');
        overlay.innerHTML = `<div class="tr-modal" style="max-height:70vh;overflow-y:auto;width:100%;max-width:340px;padding:0;">
          <div style="padding:14px 16px;border-bottom:1px solid #2A2D35;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:15px;font-weight:700;color:#E8E5DC;">Тип тренировки</span>
            <button id="tr-type-close" style="background:none;border:none;color:#9D9A92;cursor:pointer;font-size:20px;line-height:1;">×</button>
          </div>
          ${opts}
        </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove(); });
        overlay.querySelector('#tr-type-close').addEventListener('click', () => overlay.remove());
        overlay.querySelectorAll('.tr-type-pick-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const nt = btn.dataset.type;
            if (nt === session.type) { overlay.remove(); return; }
            /* силовые упражнения не могут жить в беге или отдыхе: предупреждаем и убираем их */
            const strength = (session.exercises || []).filter(e => e && (!e.kind || e.kind === 'strength'));
            if (!trIsGymType(nt) && strength.length && !confirm(`Сменить на «${nt}»? Силовые упражнения (${strength.length}) из этой тренировки удалятся.`)) return;
            trSnapshotBeforeChange();
            session.type = nt;
            // Сбрасываем группы и силовые упражнения, если тип не зал
            if (!trIsGymType(session.type)) { session.groups = []; session.exercises = (session.exercises || []).filter(e => e && e.kind && e.kind !== 'strength'); }
            trSavePlans(trGetPlans().map(p => p.id === plan.id ? plan : p));
            overlay.remove();
            renderTab('plan');
          });
        });
      });
    });
    content.querySelectorAll('.tr-day-add:not(.tr-day-clear):not(.tr-session-add-ex):not(.tr-session-move)').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = parseInt(btn.dataset.week, 10);
        const d = parseInt(btn.dataset.day, 10);
        const snap = trSnapshotTake();
        trOpenAddModal(plan, w, d, () => {
          trSnapshotPush(snap);
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
    const prevTab = content.dataset.tab; content.dataset.tab = tab;
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
      /* во вкладке AI без плана показываем анкету AI-тренера: план создастся по кнопке */
      if (!hasAnyPlan && tab === 'ai' && window.TrainingAI) {
        TrainingAI.render(content, null, { getPlans: trGetPlans, savePlans: trSavePlans, afterTransfer: () => { refreshUndoState(); },
          createPlan: () => { currentPlanId = trCreateNextPlan(); collapsedWeeks = []; populatePlanSelect(); return trGetPlans().find(p => p && p.id === currentPlanId); },
          rerender: () => renderTab('ai') });
        return;
      }
      if (!hasAnyPlan) {
        content.innerHTML = `<div style="padding:32px 20px 60px;max-width:480px;margin:0 auto;">
          <div style="text-align:center;margin-bottom:28px;">
            <div style="font-size:40px;margin-bottom:10px;color:#7EA0FF;"><i class="ti ti-barbell"></i></div>
            <div style="font-size:18px;font-weight:800;color:#E8E5DC;margin-bottom:8px;">Начни свой первый план</div>
            <div style="font-size:13px;color:#9D9A92;line-height:1.6;">Появится сетка на 8 недель. Заполни её сам или попроси AI.</div>
          </div>
          <div style="margin-bottom:22px;">          <button onclick="document.querySelector('.tr-tab[data-tab=&quot;ai&quot;]')?.click()" style="width:100%;padding:14px;background:linear-gradient(135deg,#2C4FA8,#3A62C9);border:none;border-radius:12px;color:#fff;font-size:15px;font-weight:800;cursor:pointer;font-family:Montserrat,sans-serif;letter-spacing:0.02em;margin-bottom:10px;"><i class="ti ti-sparkles"></i> План от AI-тренера</button>
          <button onclick="document.getElementById('tr-new-plan')?.click()" style="width:100%;padding:13px;background:none;border:1px solid rgba(96,165,250,0.35);border-radius:12px;color:#93C5FD;font-size:14px;font-weight:700;cursor:pointer;font-family:Montserrat,sans-serif;">+ Заполнить вручную</button></div>

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
      /* перерисовка плана после правки не прыгает наверх */
      const keepY = prevTab === 'plan' ? window.scrollY : null;
      content.innerHTML = (window.TrainerClient ? TrainerClient.weeklyHtml() : '') + trAiOrphanBanner(plan) + trRenderPlanTab(plan, collapsedWeeks);
      if (keepY != null) { window.scrollTo(0, keepY); requestAnimationFrame(() => window.scrollTo(0, keepY)); }
      const orphBtn = document.getElementById('tr-orph-rm');
      if (orphBtn) orphBtn.onclick = () => { if (!confirm('Убрать из Плана будущие тренировки от удалённого AI-плана? Сделанные и изменённые тобой останутся.')) return; trSnapshotBeforeChange(); const n = TrainingAI.dropOrphans(trGetPlans(), plan.id); trSavePlans(trGetPlans()); renderTab('plan'); if (window.TrainingAI && TrainingAI.toast) TrainingAI.toast('Убрал ' + n); };
      trAnimateBars(content);
      bindPlanEvents(plan);
      if (window._trJumpToday) { window._trJumpToday = false;
        const td = content.querySelector('.tr-day-today');
        if (td && td.getBoundingClientRect().top > innerHeight * 0.6) setTimeout(() => td.scrollIntoView({ block: 'center' }), 60); }
      if (window.TrainerClient) TrainerClient.bind(content, plan, () => renderTab('plan'));
    } else if (tab === 'working-weight') {
      let _baseWkIdx = 0;
      const _renderWW = () => {
        content.innerHTML = trRenderWorkingWeight(plan, _baseWkIdx);
        const eb = document.getElementById('tr-edit-exercises-ww');
        const rmHtml = '<button class="tr-rm-open" id="tr-rm-open"><i class="ti ti-calculator"></i> Калькулятор максимума</button>';
        if (eb && eb.parentElement) { eb.parentElement.style.justifyContent = 'space-between'; eb.parentElement.style.alignItems = 'center'; eb.insertAdjacentHTML('beforebegin', rmHtml); }
        else content.insertAdjacentHTML('afterbegin', rmHtml);
        document.getElementById('tr-rm-open').onclick = () => renderTab('one-rm');
        const sel = document.getElementById('tr-base-week-sel');
        if (sel) {
          sel.closest('div').style.display='none';
        }
        const editBtn = document.getElementById('tr-edit-exercises-ww');
        if (editBtn) editBtn.addEventListener('click', trOpenExerciseEditor);
      };
      _renderWW();
    } else if (tab === 'one-rm') {
      /* Сброс через 1 минуту бездействия */
      if (window._last1rmState && window._last1rmState.ts) {
        if (Date.now() - window._last1rmState.ts > 60000) window._last1rmState = {};
      }
      const _saved1rm = window._last1rmState || {};
      content.innerHTML = trRender1RMCalc();
      content.insertAdjacentHTML('afterbegin', '<button class="tr-rm-back" id="tr-rm-back"><i class="ti ti-arrow-left"></i> Веса</button>');
      document.getElementById('tr-rm-back').onclick = () => renderTab('working-weight');
      const calcBtn = document.getElementById('rm-calc-btn');
      const wEl = document.getElementById('rm-weight');
      const rEl = document.getElementById('rm-reps');
      /* Восстанавливаем прошлые значения */
      if (_saved1rm.w) wEl.value = _saved1rm.w;
      if (_saved1rm.r) rEl.value = _saved1rm.r;

      if (calcBtn) {
        const doCalc = () => {
          /* запятая как точка: «62,5» это 62,5 кг, а не 625 */
          const w = trNum(wEl.value, 1000), r = trInt(rEl.value, 30);
          const resultEl0 = document.getElementById('rm-result');
          if (!w || !r || +String(rEl.value).replace(',', '.') > 30) { resultEl0.innerHTML = '<div class="tr-1rm-answer"><div class="tr-1rm-answer-sub">Вес больше нуля, повторы от 1 до 30</div></div>'; resultEl0.style.display = 'block'; return; }
          window._last1rmState = { w, r, ts: Date.now() };
          const rm = calc1RM(w, r);
          const zones = get1RMZones(rm);
          const zonesHtml = zones.map(z => `
            <div class="tr-1rm-zone" style="--zone-color:${z.color}">
              <div class="tr-1rm-zone-bar" style="width:${z.pct}%"></div>
              <div class="tr-1rm-zone-info">
                <span class="tr-1rm-zone-label">${z.label}</span>
                <span class="tr-1rm-zone-reps">${z.reps} повт.</span>
              </div>
              <div class="tr-1rm-zone-kg">${z.kg} кг</div>
            </div>`).join('');
          const resultEl = document.getElementById('rm-result');
          resultEl.innerHTML = `
            <div class="tr-1rm-answer">
              <div class="tr-1rm-answer-label">Расчётный максимум</div>
              <div class="tr-1rm-answer-num">${String(rm).replace('.', ',')}<span> кг</span></div>
              <div class="tr-1rm-answer-sub">${String(w).replace('.', ',')} кг × ${r} повт.</div>
            </div>
            <div class="tr-1rm-zones-title">Зоны нагрузки</div>
            <div class="tr-1rm-zones">${zonesHtml}</div>`;
          resultEl.style.display = 'block';
        };
        calcBtn.addEventListener('click', doCalc);
        [wEl, rEl].forEach(el => {
          el?.addEventListener('keydown', e => { if(e.key==='Enter') doCalc(); });
        });
        /* Если были предыдущие значения - показываем результат сразу */
        if (_saved1rm.w && _saved1rm.r) doCalc();
        else setTimeout(() => wEl?.focus(), 100);
      }
    } else if (tab === 'summary') {
      content.innerHTML = trRenderSummary(plan);
      const bpBox = document.getElementById('tr-bp');
      if (bpBox && window.BodyProgress) BodyProgress.bind(bpBox, (p, m) => { if (p) window._bpPeriod = p; if (m) window._bpMain = m; renderTab('summary'); });
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
    } else if (tab === 'ai') {
      if (window.TrainingAI) TrainingAI.render(content, plan, {
        getPlans: trGetPlans,
        savePlans: trSavePlans,
        afterTransfer: () => { refreshUndoState(); },
        /* план создаётся сам, если его ещё нет: одна кнопка в AI */
        createPlan: () => { currentPlanId = trCreateNextPlan(); collapsedWeeks = []; populatePlanSelect(); return trGetPlans().find(p => p && p.id === currentPlanId); },
        rerender: () => renderTab('ai'),
        openPlan: () => { const b = document.querySelector('.tr-tab[data-tab="plan"]'); if (b) b.click();
          /* к началу сегодняшней карточки, а не к последнему упражнению */
          setTimeout(() => { const d = document.querySelector('.tr-day-today'); if (d) { d.scrollIntoView({ block: 'start' }); window.scrollBy(0, -120); } }, 200); },
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
            if (typeof window.trOpenNutritionModal === "function") window.trOpenNutritionModal(plan, () => {
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
            if (typeof window.trOpenNutritionModal === "function") window.trOpenNutritionModal(plan, () => {
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

  const sharePlanBtn = document.getElementById('tr-share-plan');
  if (sharePlanBtn) sharePlanBtn.addEventListener('click', () => { if (window.ShareTpl) ShareTpl.shareModal(); });
  const newPlanBtn = document.getElementById('tr-new-plan');
  if (newPlanBtn) {
    newPlanBtn.addEventListener('click', () => {
      const isFirst = trGetPlans().length === 0;
      const ov = document.createElement('div');
      ov.className = 'tr-modal-overlay';
      ov.innerHTML = `<div class="tr-modal" style="max-width:360px;padding:24px 20px;">
        <div style="font-size:22px;text-align:center;margin-bottom:12px;">${isFirst ? '🏋️' : '🔄'}</div>
        <p class="tr-modal-title" style="text-align:center;margin-bottom:8px;">${isFirst ? 'Создать первый план' : 'Начать новый план'}</p>
        <p style="font-size:13px;color:#9D9A92;text-align:center;line-height:1.6;margin-bottom:20px;">${isFirst
          ? 'Создаётся 8-недельная сетка. Заполняй её под себя: тип тренировки, группы мышц, упражнения.'
          : 'Текущий план уйдёт в историю, тренировки этой недели переедут в новый. Прошлые веса подставятся сами, когда выберешь упражнение.'
        }</p>
        <div class="tr-modal-actions">
          <button class="tr-modal-btn-secondary" id="tr-new-plan-cancel">Отмена</button>
          <button class="tr-modal-btn-primary" id="tr-new-plan-confirm">${isFirst ? 'Создать' : 'Новый план'}</button>
        </div>
      </div>`;
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
      ov.querySelector('#tr-new-plan-cancel').addEventListener('click', () => ov.remove());
      ov.querySelector('#tr-new-plan-confirm').addEventListener('click', () => {
        ov.remove();
        currentPlanId = trCreateNextPlan();
        collapsedWeeks = [];
        populatePlanSelect();
        renderTab('plan');
        /* Баннер-подсказка показывается только при создании первого плана */
        if (isFirst) {
          const banner = document.createElement('div');
          banner.id = 'tr-onboarding-banner';
          banner.style.cssText = 'background:rgba(37,99,235,0.1);border:1px solid rgba(37,99,235,0.25);border-radius:12px;padding:14px 16px;margin:12px 16px;display:flex;align-items:flex-start;gap:10px;';
          banner.innerHTML = `<span style="font-size:18px;flex-shrink:0;">💡</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:700;color:#93C5FD;margin-bottom:4px;">Как заполнить план?</div>
              <div style="font-size:12px;color:rgba(147,197,253,0.75);line-height:1.5;">
                Нажми <b style="color:#93C5FD;">+</b> рядом с днём → выбери тип и упражнения.<br>
                Тип тренировки меняется кликом на тег <b style="color:#93C5FD;">«Зал ✏️»</b>.<br>
                Список упражнений → вкладка <b style="color:#93C5FD;">«Рабочий вес» → «Редактор»</b>.
              </div>
              <button id="tr-banner-close" style="margin-top:8px;padding:4px 10px;background:none;border:1px solid rgba(147,197,253,0.3);border-radius:6px;color:rgba(147,197,253,0.7);font-size:11px;cursor:pointer;font-family:Montserrat,sans-serif;">Понятно ✓</button>
            </div>`;
          const contentEl = mount.querySelector('.tr-body');
          if (contentEl) contentEl.prepend(banner);
          banner.querySelector('#tr-banner-close')?.addEventListener('click', () => banner.remove());
        }
      });
    });
  }

  mount.querySelectorAll('.tr-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      mount.querySelectorAll('.tr-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderTab(tab.dataset.tab);
    });
  });

  /* Тоггл выбора плана — состояние сохраняется */
  const planMenuBtn = document.getElementById('tr-plan-menu-btn');
  const planBarEl = document.getElementById('tr-plan-bar');
  if (planMenuBtn && planBarEl) {
    const plans = trGetPlans().filter(Boolean);
    // Показываем бар автоматически если планов нет
    if (plans.length === 0) {
      planBarEl.style.display = 'none'; /* пустой список планов только путает: на экране уже есть кнопки «AI» и «Заполнить вручную» */
    } else {
      const planBarSaved = Store.get().home?.planBarVisible;
      if (planBarSaved === true) planBarEl.style.display = 'flex';
    }
    planMenuBtn.addEventListener('click', () => {
      const isVisible = planBarEl.style.display !== 'none';
      planBarEl.style.display = isVisible ? 'none' : 'flex';
      Store.set('home.planBarVisible', !isVisible);
    });
  }
  const backBtn = document.getElementById('tr-back');
  if (backBtn) backBtn.addEventListener('click', () => Router.go('/home'));
  const logoutBtn = document.getElementById('tr-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', () => { Auth.logout().then(function(){ Router.go('/login'); }); });

  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      /* без вопроса: отмену можно отменить только новой правкой, поэтому просто сообщаем */
      const ok = trUndoLastChange();
      if (ok) {
        populatePlanSelect();
        refreshUndoState();
        renderTab(document.querySelector('.tr-tab.active')?.dataset.tab || 'plan');
        if (window.TrainingAI && TrainingAI.toast) TrainingAI.toast('Последнее действие отменено');
      } else if (window.TrainingAI && TrainingAI.toast) TrainingAI.toast('Отменять нечего');
    });
  }

  renderTab('plan');

  /* Данные обновились с Firebase — не перерисовываем если юзер редактирует */
  function _onRemoteUpdate() {
    const active = document.activeElement;
    const isEditing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
    if (isEditing) return; /* пользователь вводит данные — не мешаем */
    populatePlanSelect();
    /* Перерисовываем только если не на вкладке план (там идёт ввод) */
    const activeTab = document.querySelector('.tr-tab.active')?.dataset.tab || 'plan';
    if (activeTab !== 'plan') renderTab(activeTab);
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
  /* нет в справочнике: распознаём по названию, как AI-тренер (гакк, румынская тяга → ноги) */
  try {
    const c = window.TrainingAI && TrainingAI.classify ? TrainingAI.classify(exName) : null;
    if (c && c.group) {
      const g = /Бицепс|Трицепс|Руки/.test(c.group) ? 'Руки' : c.group;
      if (WORKING_WEIGHT_CATEGORIES.includes(g)) return [g];
    }
  } catch (e) {}
  return null; /* совсем незнакомое — определится по сессии */
}

/* Тренировка уже сделана: день не в будущем, и это не AI-тренировка, которую только поставили
   в План и ещё не подтвердили (правило как в AI-тренере). Итоги считаем только по сделанному */
const TR_BODYW = /подтяг|отжим|брусь|планк|скруч|подъём ног|подъем ног|гиперэкст|пресс|вакуум/i;
function trSessionDone(plan, day, s) {
  const d = trDayDateOf(plan, day && day.date);
  const end = new Date(); end.setHours(23, 59, 59, 0);
  if (!d || d > end) return false;
  if (s && s.ai && s.aiSig && !s.aiOk) {
    const sig = (s.exercises || []).map(e => e ? (e.name + '|' + (+e.weight || 0) + '|' + e.reps + '|' + e.sets) : '').join(';');
    const fresh = d >= new Date(end.getFullYear(), end.getMonth(), end.getDate() - 7);
    if (fresh && s.aiSig === sig) return false;
  }
  return true;
}
/* упражнение реально записано: есть вес или повторы (подход-заготовка «0×0» не считается) */
function trExLogged(ex) {
  if (!ex) return false;
  if (ex.kind === 'strength') return (+ex.weight || 0) > 0 || (+ex.reps || 0) > 0;
  if (ex.kind === 'cardio') return (+ex.distance || 0) > 0 || (+ex.duration || 0) > 0;
  if (ex.kind === 'time_calorie') return (+ex.calories || 0) > 0 || (+ex.duration || 0) > 0;
  if (ex.kind === 'steps') return (+ex.steps || 0) > 0;
  return true;
}

/* дата дня плана (dd.mm) с учётом перехода года */
function trDayDateOf(p, dateStr) {
  const [dd, mm] = String(dateStr || '').split('.').map(Number);
  if (!dd || !mm) return null;
  const start = p && p.startDate ? new Date(p.startDate) : new Date();
  let d = new Date(start.getFullYear(), mm - 1, dd);
  if (d < new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7)) d = new Date(start.getFullYear() + 1, mm - 1, dd);
  return d;
}
/* AI-тренировка стоит в плане, но человек её ещё не записывал */
function trAiUntouched(session) {
  if (!session || !session.ai || !session.aiSig) return false;
  const sig = (session.exercises || []).map(e => e ? (e.name + '|' + (+e.weight || 0) + '|' + e.reps + '|' + e.sets) : '').join(';');
  return sig === session.aiSig && !session.aiOk;
}
function trCollectGymExercises(plan) {
  const latest = {};
  const today = new Date(); today.setHours(23, 59, 59, 0);
  plan.weeks.forEach((week, weekIndex) => {
    week.days.forEach((day, dayIdx) => {
      trMigrateDayToSessions(day);
      /* будущие дни и непройденные AI-тренировки в рабочие веса не попадают */
      const dt = trDayDateOf(plan, day.date);
      if (dt && dt > today) return;
      day.sessions.forEach((session, sessionIdx) => {
        if (!trIsGymType(session.type)) return;
        if (trAiUntouched(session)) return;
        session.exercises.forEach((ex, exIdx) => {
          if (ex.kind !== 'strength') return;
          if (!(+ex.weight > 0) && !(+ex.reps > 0)) return;
          /* Группа: сначала ищем в каноническом списке, иначе берём из сессии */
          const canonical = trExerciseCanonicalGroups(ex.name);
          const groups = canonical || session.groups || [];
          latest[ex.name] = { ex, weekIndex, dayIdx, sessionIdx, exIdx, groups };
        });
      });
    });
  });
  return latest;
}

const WORKING_WEIGHT_CATEGORIES = ['Грудь', 'Спина', 'Ноги', 'Руки', 'Плечи', 'Кор', 'FULL BODY'];

function trRenderWorkingWeight(plan, baseWeekIndex) {
  const _bw = (typeof baseWeekIndex === 'number') ? baseWeekIndex : 0;
  const weekOpts = plan.weeks.map((w,i) => '<option value="'+i+'" '+(i===_bw?'selected':'')+'>'+'Нед. '+(i+1)+'</option>').join('');
  const baseSelector = '<div style="padding:8px 16px 4px;display:flex;align-items:center;gap:8px;"><span style="font-size:11px;color:#9D9A92;white-space:nowrap;">База:</span><select id="tr-base-week-sel" style="background:#1C1E24;color:#E8E5DC;border:1px solid #2A2D35;border-radius:6px;padding:3px 6px;font-size:12px;">'+weekOpts+'</select></div>';
  const latest = trCollectGymExercises(plan);
  const names = Object.keys(latest);
  if (names.length === 0) {
    return `<div>
      <div style="padding:8px 16px 4px;display:flex;justify-content:flex-end;">
        <button id="tr-edit-exercises-ww" class="tr-rm-open"><i class="ti ti-adjustments-horizontal"></i> Упражнения</button>
      </div>
      <div class="tr-empty-state"><i class="ti ti-weight"></i>Рабочий вес появится здесь после первой записи в зале.</div>
    </div>`;
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
      const progress = trCalcProgress(plan, weekIndex, name, _bw);
      const arrow = progress.dir === 'up' ? '▲' : progress.dir === 'down' ? '▼' : '';
      const sign = progress.pct > 0 ? '+' : '';
      return `
        <tr>
          <td class="tr-ww-name">${trEsc(ex.name)}</td>
          <td class="tr-ww-num num">${trEsc(ex.sets)}</td>
          <td class="tr-ww-num num">${trEsc(ex.reps)}</td>
          <td class="tr-ww-num num tr-ww-weight">${trEsc(String(ex.weight).replace(".", ","))}&nbsp;кг</td>
          <td class="tr-ww-num num tr-progress ${progress.dir}">${sign}${progress.pct}% ${arrow}</td>
        </tr>`;
    }).join('');

    return `
      <div class="tr-ww-group">
        <div class="tr-ww-group-label fb-accent">${trEsc(trGL(cat))}</div>
        <table class="tr-ww-table">
          <thead><tr><th>Упражнение</th><th>Подх</th><th>Повт</th><th>Вес</th><th>Рост</th></tr></thead>
          <tbody>${exerciseRows}</tbody>
        </table>
      </div>`;
  }).filter(Boolean).join('');

  return baseSelector + `<div>
    <div style="display:flex; justify-content:flex-end; margin-bottom:8px;">
      <button id="tr-edit-exercises-ww" class="tr-rm-open"><i class="ti ti-adjustments-horizontal"></i> Упражнения</button>
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
          <div class="nutr-result-name">${trEsc(p.name)}${p.source === 'custom' || showCount ? '' : ''}</div>
          <span class="nutr-result-kcal">${trEsc(p.kcal)} ккал</span>
        </div>
        <div class="nutr-result-meta">Б ${trEsc(p.protein)}г · Ж ${trEsc(p.fat)}г · У ${trEsc(p.carbs)}г · на 100г${showCount && p.count > 1 ? ' · ' + p.count + 'x' : ''}</div>
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
      resultsEl.innerHTML = '<div style="padding:8px; font-size:13px; color:#9D9A92;">Не найдено, добавь вручную ↓</div>';
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
        <div class="nutr-macro-sub">${target.protein > 0 ? `из ${target.protein}г` : 'без цели'}</div>
        ${nutrRenderMacroBar(total.protein, target.protein, '#A8C97F')}
      </div>
      <div class="nutr-macro-card">
        <div class="nutr-macro-label">Жиры</div>
        <div class="nutr-macro-val" style="color:#E0B873">${total.fat}г</div>
        <div class="nutr-macro-sub">${target.fat > 0 ? `из ${target.fat}г` : 'без цели'}</div>
        ${nutrRenderMacroBar(total.fat, target.fat, '#E0B873')}
      </div>
      <div class="nutr-macro-card">
        <div class="nutr-macro-label">Углеводы</div>
        <div class="nutr-macro-val" style="color:#B6A4D9">${total.carbs}г</div>
        <div class="nutr-macro-sub">${target.carbs > 0 ? `из ${target.carbs}г` : 'без цели'}</div>
        ${nutrRenderMacroBar(total.carbs, target.carbs, '#B6A4D9')}
      </div>
    </div>`;

  const mealsHtml = MEAL_ORDER.map(meal => {
    const items = dayData[meal] || [];
    const mealTotal = nutrCalc(items);
    const itemsHtml = items.map((item, idx) => `
      <div class="nutr-food-item">
        <div class="nutr-food-left">
          <div class="nutr-food-name">${trEsc(item.name)}</div>
          <div class="nutr-food-meta">Б${Math.round(item.protein * item.grams / 100 * 10)/10} · Ж${Math.round(item.fat * item.grams / 100 * 10)/10} · У${Math.round(item.carbs * item.grams / 100 * 10)/10}</div>
        </div>
        <div class="nutr-food-right">
          <input class="nutr-grams-inline" type="number" value="${trEsc(item.grams)}" min="1" data-meal="${meal}" data-idx="${idx}" style="width:52px; text-align:center; background:#0F1117; border:0.5px solid #2A2D35; border-radius:6px; color:#E8E5DC; font-size:12px; padding:3px 4px;">
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
        Цель · план №${trEsc(plan.number)}
        <button class="nutr-edit-goal-btn" style="margin-left:auto; background:none; border:0.5px solid #2A2D35; border-radius:6px; color:#9D9A92; cursor:pointer; font-size:12px; padding:3px 8px;"><i class="ti ti-edit"></i> Изменить</button>
      </div>
      <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:8px;">
        <span style="font-size:13px; color:#2E7FD4;">${trEsc(n.totalKcal)} ккал</span>
        <span style="font-size:13px; color:#A8C97F;">Б ${trEsc(n.protein)}г</span>
        <span style="font-size:13px; color:#E0B873;">Ж ${trEsc(n.fat)}г</span>
        <span style="font-size:13px; color:#B6A4D9;">У ${trEsc(n.carbs)}г</span>
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
  // returns { first: {ex, weekIndex}, last: {ex, weekIndex}, count } по сделанным тренировкам плана
  let first = null;
  let last = null;
  let count = 0;
  plan.weeks.forEach((week, weekIndex) => {
    week.days.forEach(day => {
      const found = trDayAllExercises(day).find(e => e.ex.name === exerciseName && trExLogged(e.ex) && trSessionDone(plan, day, day.sessions[e.sessionIdx]));
      if (found) {
        if (!first) first = { ex: found.ex, weekIndex };
        last = { ex: found.ex, weekIndex }; count++;
      }
    });
  });
  return { first, last, count };
}

function trWasNowLabel(ex, metricLabelFn) {
  if (ex.kind === 'cardio') return `${trEsc(ex.distance)} км`;
  if (ex.kind === 'time_calorie') return `${trEsc(ex.calories)} ккал`;
  if (ex.kind === 'steps') return `${(+ex.steps || 0).toLocaleString('ru-RU')} шагов`;
  return `${trTonnage(ex).toLocaleString('ru-RU')} кг`;
}

function trSumMetricAcrossPlan(plan, exerciseName, kind) {
  let sum = 0;
  let count = 0;
  plan.weeks.forEach(week => {
    week.days.forEach(day => {
      trDayAllExercises(day).forEach(({ ex, sessionIdx }) => {
        if (ex.name !== exerciseName || !trExLogged(ex) || !trSessionDone(plan, day, day.sessions[sessionIdx])) return;
        if (kind === 'time_calorie') sum += ex.calories || 0;
        if (kind === 'steps') sum += ex.steps || 0;
        count++;
      });
    });
  });
  return { sum, count };
}

function trRenderWasNowRow(exerciseName, plan) {
  const { first, last, count: nRec } = trCollectExerciseHistory(plan, exerciseName);
  if (!first || !last) return '';

  // Calories and steps are summed across the whole plan, not "was -> now"
  if (first.ex.kind === 'time_calorie' || first.ex.kind === 'steps') {
    const kind = first.ex.kind;
    const { sum, count } = trSumMetricAcrossPlan(plan, exerciseName, kind);
    const label = kind === 'time_calorie' ? `${sum.toLocaleString('ru-RU')} ккал всего` : `${sum.toLocaleString('ru-RU')} шагов всего`;
    return `
      <div class="tr-exercise" style="cursor:default">
        <div class="tr-ex-top">
          <div class="tr-ex-name">${trEsc(exerciseName)}</div>
          <div class="tr-ex-stats"><span class="tr-ex-weight num">${label}</span></div>
        </div>
        <div class="tr-ex-bottom"><div class="tr-ex-meta num">${count} ${count === 1 ? 'запись' : 'записей'}</div></div>
      </div>`;
  }

  const sameRecord = nRec < 2;
  const wasVal = trMetricFor(first.ex);
  const nowVal = trMetricFor(last.ex);
  let pct = 0;
  if (wasVal === 0) {
    pct = nowVal === 0 ? 0 : 100;
  } else {
    pct = Math.round(((nowVal - wasVal) / wasVal) * 100);
  }
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '';
  const sign = pct > 0 ? '+' : '';

  if (sameRecord) {
    return `
      <div class="tr-exercise" style="cursor:default">
        <div class="tr-ex-top">
          <div class="tr-ex-name">${trEsc(exerciseName)}</div>
          <div class="tr-ex-stats"><span class="tr-ex-weight num">${trEsc(trWasNowLabel(last.ex))}</span></div>
        </div>
        <div class="tr-ex-bottom"><div class="tr-ex-meta num">только одна запись</div></div>
      </div>`;
  }

  return `
    <div class="tr-exercise" style="cursor:default">
      <div class="tr-ex-top">
        <div class="tr-ex-name">${trEsc(exerciseName)}</div>
        <div class="tr-ex-stats"><span class="tr-progress ${dir}">${sign}${pct}% ${arrow}</span></div>
      </div>
      <div class="tr-ex-bottom"><div class="tr-ex-meta num">было ${trEsc(trWasNowLabel(first.ex))} → стало ${trEsc(trWasNowLabel(last.ex))}</div></div>
    </div>`;
}

function trRenderWasNowWeightRow(exerciseName, plan) {
  /* Прогрессия по сделанным тренировкам: первая запись в плане → последняя */
  let first = null, last = null, n = 0;
  plan.weeks.forEach((week, wi) => {
    week.days.forEach(day => {
      trMigrateDayToSessions(day);
      day.sessions.forEach(session => {
        if (!trIsGymType(session.type) || !trSessionDone(plan, day, session)) return;
        session.exercises.forEach(ex => {
          if (ex.name !== exerciseName || ex.kind !== 'strength' || !trExLogged(ex)) return;
          if (!first) first = { ex, wi };
          last = { ex, wi }; n++;
        });
      });
    });
  });
  if (!first) return '';

  const fw = (v) => String(Math.round((+v || 0) * 10) / 10).replace('.', ',');
  const lbl = (e) => (+e.weight || 0) > 0 ? `${trEsc(e.sets)}×${trEsc(e.reps)}×${fw(e.weight)} кг` : `${trEsc(e.sets)}×${trEsc(e.reps)}`;
  const w1 = +first.ex.weight || 0, wN = +last.ex.weight || 0;
  const r1 = (+first.ex.sets || 0) * (+first.ex.reps || 0), rN = (+last.ex.sets || 0) * (+last.ex.reps || 0);
  /* со своим весом (0 кг) сравниваем повторы, а не килограммы */
  /* со своим весом или тот же вес, но выросли повторы: показываем повторы */
  const byReps = (w1 === 0 && wN === 0) || (Math.abs(wN - w1) < 0.05 && rN !== r1);
  const diff = byReps ? rN - r1 : Math.round((wN - w1) * 10) / 10;
  const pct = byReps ? (r1 > 0 ? Math.round(diff / r1 * 100) : 0) : (w1 > 0 ? Math.round(diff / w1 * 100) : 0);
  const color = diff > 0 ? '#A8C97F' : diff < 0 ? '#FF5C5C' : '#9D9A92';
  const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '';
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
  const head = n < 2
    ? `<span class="tr-ex-weight num" style="color:#9D9A92;">одна запись</span>`
    : byReps
      ? `<span class="tr-ex-weight num" style="color:${color};">${sign}${Math.abs(diff)} ${diff === 0 ? 'повторов' : 'повт.'} ${arrow}${pct ? ' ' + sign + Math.abs(pct) + '%' : ''}</span>`
      : `<span class="tr-ex-weight num" style="color:${color};">${sign}${fw(Math.abs(diff))} кг ${arrow}${w1 > 0 && pct ? ' ' + sign + Math.abs(pct) + '%' : ''}</span>`;

  const clamp = Math.min(50, Math.abs(pct) / 2);
  const barColor = diff > 0 ? '#A8C97F' : diff < 0 ? '#FF5C5C' : '#3A3D45';
  const bar = n < 2 ? '' : `<div class="tr-progress-bar-track"><div class="tr-progress-bar-fill" style="left:${diff < 0 ? (50 - clamp) + '%' : '50%'}; width:${clamp > 0 ? clamp + '%' : '0%'}; background:${barColor};"></div></div>`;

  return `
    <div class="tr-exercise" style="cursor:default;">
      <div class="tr-ex-top">
        <div class="tr-ex-name">${trEsc(exerciseName)}</div>
        <div class="tr-ex-stats">${head}</div>
      </div>
      <div class="tr-ex-bottom">
        <div class="tr-ex-meta num" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          ${n < 2 ? `<span style="color:#E8E5DC;">Неделя ${last.wi + 1}: ${lbl(last.ex)}</span>`
            : `<span style="color:#9D9A92;">Неделя ${first.wi + 1}: ${lbl(first.ex)}</span><span style="color:#555;">→</span><span style="color:#E8E5DC;">Неделя ${last.wi + 1}: ${lbl(last.ex)}</span>`}
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
        if (!trIsGymType(session.type) || !trSessionDone(plan, day, session)) return;
        session.exercises.forEach(ex => {
          if (!ex.name || ex.kind !== 'strength' || !trExLogged(ex)) return;
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
        <div class="tr-group-title">${trEsc(trGL(g))} <span class="tr-group-range">· прогрессия веса</span></div>
        <div class="tr-day">${rows}</div>
      </div>`;
  }).filter(Boolean).join('');

  /* Остальное: кардио/теннис по объёму */
  const otherByType = {};
  plan.weeks.forEach(week => {
    week.days.forEach(day => {
      trMigrateDayToSessions(day);
      day.sessions.forEach(session => {
        if (trIsGymType(session.type) || session.type === 'Отдых' || !trSessionDone(plan, day, session)) return;
        if (!otherByType[session.type]) otherByType[session.type] = new Set();
        session.exercises.forEach(ex => { if (ex.name && trExLogged(ex)) otherByType[session.type].add(ex.name); });
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
        <div class="tr-group-title">${trEsc(t)} <span class="tr-group-range">· было → стало</span></div>
        <div class="tr-day">${rows}</div>
      </div>`;
  }).join('');

  const allHtml = gymHtml + otherHtml;
  const exercisesHtml = allHtml
    ? allHtml
    : `<div class="tr-empty-state"><i class="ti ti-chart-bar"></i>Прогрессия появится здесь после нескольких недель тренировок.</div>`;

  let body = '';
  if (window.BodyProgress) {
    let hist = null; try { hist = window.TrainingAI ? TrainingAI.collect(trGetPlans()) : null; } catch (e) {}
    body = `<div class="tr-group-card bp-wrap" id="tr-bp">${BodyProgress.html(Store.get().training.measurements, { hist, period: window._bpPeriod, main: window._bpMain })}</div>`;
  }
  return body + exercisesHtml + trRenderMeasurementsBlock();
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
              <span class="tr-measure-date">${trEsc(m.date)}</span>
              <span style="display:flex; gap:4px;">
                <button class="tr-measure-edit" data-idx="${realIdx}" aria-label="Редактировать замер"><i class="ti ti-edit"></i></button>
                <button class="tr-measure-delete" data-idx="${realIdx}" aria-label="Удалить замер"><i class="ti ti-trash"></i></button>
              </span>
            </div>
            <div class="tr-measure-grid">
              ${fields.map(f => `<div class="tr-measure-item"><span>${trEsc(f)}</span><span>${trEsc(m.values[f])}</span></div>`).join('')}
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
  const prevM = isEdit ? (list[existingIdx - 1] || null) : (list.filter(Boolean).slice(-1)[0] || null);
  const formInner = window.BodyProgress && BodyProgress.formHtml
    ? BodyProgress.formHtml(values, prevM ? prevM.values : {}, dateValue)
    : `<div class="tr-modal-row"><label style="flex:1 1 100%">Дата (ДД.ММ.ГГГГ)<input type="text" id="m-measure-date" value="${trEsc(dateValue)}"></label></div>
       <div class="tr-measure-form-grid">${MEASURE_FIELDS.map(f => `<label class="tr-measure-form-field">${f}<input type="text" data-field="${f}" inputmode="decimal" value="${trEsc(values[f] !== undefined ? values[f] : '')}"></label>`).join('')}</div>`;
  overlay.innerHTML = `
    <div class="tr-modal mf-modal">
      <p class="tr-modal-title">${isEdit ? 'Редактировать замер' : 'Новый замер'}</p>
      ${formInner}
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
    let newValues = {}, newDate = '';
    if (window.BodyProgress && BodyProgress.readForm && overlay.querySelector('.mf')) { const r = BodyProgress.readForm(overlay); if (r.bad && r.bad.length) { alert('Нужно число: ' + r.bad.join(', ')); return; } newValues = r.values; newDate = r.date; }
    else { overlay.querySelectorAll('input[data-field]').forEach(input => { if (input.value.trim() !== '') newValues[input.dataset.field] = input.value.trim(); }); newDate = overlay.querySelector('#m-measure-date').value.trim(); }
    newDate = newDate || defaultDate;
    if (!Object.keys(newValues).length) { alert('Заполни хотя бы один замер'); return; }
    trSnapshotBeforeChange();
    const freshList = Store.get().training.measurements || [];
    /* пишем только изменённый замер: свежие записи с другого устройства не затираются */
    const at = isEdit ? existingIdx : freshList.length;
    Store.set('training.measurements.' + at, { date: newDate, values: newValues });
    overlay.remove();
    onSave();
  });
}

function trDeleteMeasurement(idx, onSave) {
  trSnapshotBeforeChange();
  const list = Store.get().training.measurements || [];
  list.splice(idx, 1);
  /* весь список целиком: иначе в облаке остаётся последний индекс и замер «воскресает» */
  Store.set('training.measurements', list.filter(Boolean));
  onSave();
}


/* ── Доступ для тренера: пароль, вкл/выкл, удалить ── */
async function trOpenCoachModal() {
  const email = (window.FirebaseSync && FirebaseSync.currentUser() || {}).email || '';
  const ov = document.createElement('div');
  ov.className = 'tr-modal-overlay';
  ov.innerHTML = '<div class="tr-modal coach-modal"><div class="coach-loading">Загрузка…</div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  let coach = null;
  try { coach = await FirebaseSync.getCoach(); } catch (e) { console.error(e); }
  const box = ov.querySelector('.coach-modal');

  function render(msg, isErr) {
    const has = !!(coach && coach.uid);
    const on = has && coach.enabled !== false;
    box.innerHTML = `
      <div class="coach-head">
        <div class="coach-ico"><i class="ti ti-user-shield"></i></div>
        <div><p class="tr-modal-title" style="margin:0">Доступ для тренера</p>
        <div class="coach-sub">Тренер видит и редактирует только тренировки</div></div>
      </div>
      <div class="coach-status ${has ? (on ? 'on' : 'off') : 'none'}">
        <i class="ti ${has ? (on ? 'ti-circle-check' : 'ti-player-pause') : 'ti-circle-dashed'}"></i>
        ${has ? (on ? 'Доступ открыт' : 'Доступ приостановлен') : 'Тренер ещё не подключён'}
        ${has && on ? `<button class="coach-toggle" id="co-pause">Приостановить</button>` : has ? `<button class="coach-toggle" id="co-resume">Открыть</button>` : ''}
      </div>
      <div class="coach-how">
        <div class="coach-how-t">Как тренер входит</div>
        <div class="coach-cred"><span>Email</span><b>${email.replace(/[<>&]/g, '')}</b></div>
        <div class="coach-cred"><span>Пароль</span><b>${has ? 'тот, что ты задал ниже' : 'задай ниже'}</b></div>
        <div class="coach-note">Это твой email, но пароль у тренера свой. Твой пароль он не узнает, а финансы, привычки и цели ему закрыты.</div>
      </div>
      <div class="tr-modal-row"><label style="flex:1 1 100%">${has ? 'Новый пароль для тренера' : 'Пароль для тренера'}
        <input type="text" id="co-pwd" placeholder="минимум 6 символов" autocomplete="off" autocapitalize="off" spellcheck="false"></label></div>
      <div class="coach-msg ${isErr ? 'err' : ''}">${msg || ''}</div>
      <div class="tr-modal-actions">
        ${has ? '<button class="tr-modal-btn-secondary coach-del" id="co-del">Удалить тренера</button>' : '<button class="tr-modal-btn-secondary" id="co-close">Закрыть</button>'}
        <button class="tr-modal-btn-primary" id="co-save">${has ? 'Сменить пароль' : 'Открыть доступ'}</button>
      </div>`;
    const q = (id) => box.querySelector(id);
    if (q('#co-close')) q('#co-close').onclick = () => ov.remove();
    q('#co-save').onclick = async () => {
      const pwd = q('#co-pwd').value.trim();
      if (pwd.length < 6) { render('Пароль минимум 6 символов', true); return; }
      q('#co-save').disabled = true; q('#co-save').textContent = '…';
      try {
        await FirebaseSync.setCoachPassword(pwd);
        coach = await FirebaseSync.getCoach();
        render(has ? 'Пароль изменён. Старый пароль тренера больше не работает.' : 'Готово! Передай тренеру свой email и этот пароль.');
      } catch (e) {
        console.error(e);
        render(e && e.code === 'auth/weak-password' ? 'Слишком простой пароль' : 'Не получилось. Проверь интернет и правила Firebase.', true);
      }
    };
    if (q('#co-pause')) q('#co-pause').onclick = async () => { await FirebaseSync.setCoachEnabled(false); coach.enabled = false; render('Доступ приостановлен. Тренер не сможет открыть тренировки.'); };
    if (q('#co-resume')) q('#co-resume').onclick = async () => { await FirebaseSync.setCoachEnabled(true); coach.enabled = true; render('Доступ снова открыт.'); };
    if (q('#co-del')) q('#co-del').onclick = async () => {
      if (!confirm('Удалить доступ тренера? Он больше не сможет войти.')) return;
      await FirebaseSync.removeCoach(); coach = null; render('Тренер удалён.');
    };
  }
  render();
}


/* Кабинет тренера: окно по тапу на плашку «Тренер» с кнопкой выхода */
function trOpenCoachMeSheet() {
  const u = window.FirebaseSync && FirebaseSync.currentUser ? FirebaseSync.currentUser() : null;
  const ov = document.createElement('div');
  ov.className = 'tr-modal-overlay';
  ov.innerHTML = `<div class="tr-modal coach-modal coach-me">
    <div class="coach-head">
      <div class="coach-ico"><i class="ti ti-user-shield"></i></div>
      <div><div class="tr-modal-title" style="margin:0">Кабинет тренера</div>
      <div class="coach-sub">Доступны только тренировки подопечного</div></div>
    </div>
    <div class="coach-status on"><i class="ti ti-circle-check"></i> Ты вошёл как тренер</div>
    <div class="coach-note" style="margin:0 0 16px">Можешь вести план, отмечать подходы и веса. Финансы, привычки и цели закрыты.</div>
    <div class="tr-modal-actions">
      <button class="tr-modal-btn-secondary" id="cm-stay">Остаться</button>
      <button class="tr-modal-btn-primary coach-exit" id="cm-exit"><i class="ti ti-logout"></i> Выйти</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  ov.querySelector('#cm-stay').addEventListener('click', close);
  ov.querySelector('#cm-exit').addEventListener('click', () => {
    if (!confirm('Выйти из кабинета тренера? Чтобы вернуться, нужно будет снова ввести email и пароль тренера.')) return;
    close();
    Promise.resolve(Auth.logout()).then(() => Router.go('/login'));
  });
}
