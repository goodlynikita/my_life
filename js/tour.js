/* ============================================================
   ПОДСКАЗКИ ДЛЯ НОВЫХ ПОЛЬЗОВАТЕЛЕЙ
   • Приветствие + тур по главному экрану (стрелка на каждую кнопку)
   • Тур по каждому разделу при первом входе
   • Короткая подсказка при первом открытии каждой вкладки
   Показываются один раз. Отметки хранятся в Store → home.tour
   (синхронизируются между устройствами). Старым пользователям
   с данными туры не показываются. Повторить: меню «···» → «Подсказки».
   ============================================================ */
window.Tour = (function () {
  const SINCE = Date.parse('2026-09-29T00:00:00Z'); /* аккаунты, созданные после запуска подсказок */
  let running = false, queue = [];

  /* ── Шаги ── */
  const SCREENS = {
    '/home': [
      { sel: '#hero-slider', t: 'Фокус дня', d: 'Главное на сегодня: тренировка, привычки, деньги. Листай слайды пальцем. Какие слайды показывать, выбираешь в меню «···».' },
      { sel: '.home2-tile-training', t: 'Тренировки', d: 'План на 8 недель, рабочие веса, замеры тела и AI-тренер. Он соберёт программу и сам прибавит вес, когда ты готов.' },
      { sel: '.home2-tile-habits', t: 'Привычки', d: 'Отмечай каждый день одним касанием. Видно серии и процент за месяц.' },
      { sel: '.home2-tile-finance', t: 'Финансы', d: 'Доходы, траты и копилка. Сразу видно, сколько можно потратить сегодня, чтобы хватило до зарплаты.' },
      { sel: '.home2-tile-goals', t: 'Цели', d: 'Желания по сезонам с суммами. Видно, сколько уже закрыто и сколько осталось.' },
      { sel: '.theme-toggle', t: 'Светлая и тёмная тема', d: 'Переключай одним касанием. Выбор сохранится на всех устройствах.' },
      { sel: '#home-menu-btn', t: 'Меню', d: 'Слайдер и плитки, цвета «Яркие / Пастельные», тренер, повтор подсказок и выход.' },
      { sel: '.fb-envelope-home, [data-feedback]', t: 'Связь с нами', d: 'Нашёл ошибку или есть идея? Пиши сюда или сразу в Telegram, отвечаем лично.' },
    ],
    '/training': [
      { sel: '.tr-tabs', t: 'Разделы тренировок', d: 'План, рабочие веса, итоги с замерами тела и AI-тренер.' },
      { sel: 'button[onclick*="tr-new-plan"]', t: 'Первый план', d: 'Начни отсюда. План на 8 недель можно заполнить самому или попросить AI-тренера собрать программу.' },
      { sel: '.tr-day-today, .tr-day', t: 'День в плане', d: 'Каждый день недели. Нажми «+», чтобы добавить тренировку: зал, бег, шаги, теннис и другое.' },
      { sel: '.tr-day-today .tr-day-add, .tr-day-add', t: 'Добавить тренировку', d: 'Выбери вид и группы мышц. Вес с прошлого раза подставится сам.' },
      { sel: '.tr-week-head', t: 'Недели плана', d: 'План длится 8 недель. Нажми на неделю, чтобы раскрыть или свернуть дни.' },
      { sel: '#tr-plan-menu-btn', t: 'Планы', d: 'Когда 8 недель закончатся, создай новый план. Старые сохранятся в истории.' },
      { sel: '#tr-trainer', t: 'Тренер', d: 'Занимаешься с тренером? Дай ему ключ доступа. Он будет вести твой план и увидит только тренировки.' },
      { sel: '#tr-undo', t: 'Отменить', d: 'Случайно удалил или изменил? Эта кнопка вернёт как было.' },
    ],
    '/habits': [
      { sel: '.hab-tabs', t: 'Три вкладки', d: 'Месяц: отметки по дням. Колесо: оценка сфер жизни. История: прошлые месяцы.' },
      { sel: '.hab-cell.hab-active.hab-today, .hab-cell.hab-active', t: 'Отметка дня', d: 'Одно касание: сделал. Второе: пропустил. Третье: снять отметку. Сегодня обведено рамкой.' },
      { sel: '.sec-metric-grid', t: 'Итог месяца', d: 'Общий процент, лучшая привычка и та, которую стоит подтянуть.' },
      { sel: '#hab-add', t: 'Новая привычка', d: 'Добавь свою: каждый день, по будням или несколько раз в неделю.' },
      { sel: '#hab-settings', t: 'Настройки', d: 'Порядок, названия и расписание привычек.' },
    ],
    '/finance': [
      { sel: '.tochka-tabs', t: 'Разделы финансов', d: 'Расходы: сколько можно тратить. Месяц: доходы. Баланс: план и копилка. Год и Всё время: итоги.' },
      { sel: '.sp-demo', t: 'Это пример', d: 'Пока ты ничего не записал, здесь пример трат. Он исчезнет сам после первой твоей траты или дохода.' },
      { sel: '.sp-per', t: 'До конца месяца или до зарплаты', d: 'Нажми, чтобы выбрать, до какого дня считать деньги.' },
      { sel: '.sp-big', t: 'Свободно', d: 'Сколько можно потратить до этого дня. Как посчитано, видно в «Как рассчитано».' },
      { sel: '#sp-in', t: 'Запись одной строкой', d: 'Пиши как есть: «кофе 420», «такси 350 тинькофф». Enter, и готово.' },
      { sel: '.tochka-tab[data-tab="month"]', t: 'Доходы', d: 'Зарплату и другие поступления записывай во вкладке «Месяц». От них считается, сколько можно тратить.' },
    ],
    '/tasks': [
      { sel: '#tk-navl', t: 'Задачи', d: 'Входящие без срока, задачи на сегодня и неделя по дням. Свои проекты добавляются в настройке вкладок.' },
      { sel: '#tk-add-h, #tk-new', t: 'Быстро добавить', d: 'Пиши прямо в названии: «завтра в 18», «1200», «важно», «#проект». Дата, время и приоритет поставятся сами.' },
      { sel: '#tk-board', t: 'Перетаскивай', d: 'Задачу можно перетащить на другой день. Выполненные уходят во вкладку «Выполнено» и через неделю удаляются.' },
    ],
    '/goals': [
      { sel: '.goals-season-tabs', t: 'Сезоны', d: 'Все цели сразу или по сезонам: весна, лето, осень, зима.' },
      { sel: '.goals-hero-all, .goals-hero-season', t: 'Прогресс', d: 'Сколько денег нужно на цели, сколько уже закрыто и сколько осталось.' },
      { sel: '.goals-check-v3', t: 'Выполнено', d: 'Купил или сделал? Отметь цель, и сумма уйдёт в «закрыто».' },
      { sel: '#goals-new', t: 'Новая цель', d: 'Добавь цель с суммой, категорией и сезоном.' },
    ],
  };
  const TABS = {
    get 'finance.expenses'() { return window.FinSpend ? window.FinSpend.TIPS : []; },
    'finance.month': [
      { sel: '.tochka-hero', t: 'Доход за месяц', d: 'Все поступления за месяц и сравнение с прошлым годом. Стрелки листают месяцы.' },
      { sel: '#fin-add', t: 'Добавить доход', d: 'Записывай каждое поступление: зарплату, подработку, кэшбэк. Нажми на запись, чтобы изменить или удалить.' },
    ],
    'finance.balance': [
      { sel: '.bal-ring', t: 'Месяц в одном кольце', d: 'Толстое кольцо: сколько из плана уже потрачено. Тонкое: сколько месяца прошло. Плашка рядом подскажет: по плану, быстрее плана или уже сверх.' },
      { sel: '.plan-cat-bar', t: 'Траты по категориям', d: 'Полоска: сколько потрачено из плана. Белая отметка: сколько нормально потратить к сегодняшнему дню. Траты записываешь во вкладке «Расходы».' },
      { sel: '.plan-cat-sp', t: 'Настрой категорию', d: 'Нажми на категорию, чтобы поменять план, цвет и день платежа. Если указать день, платёж появится в «Расходах» в списке «Ближайшие платежи».' },
      { sel: '.pg-card', t: 'Копилка', d: 'С каждого дохода сюда сам уходит процент. Перед снятием спрошу, точно ли покупка нужна, а не импульс.' },
      { sel: '.plan-card', t: 'Как распределить доход', d: 'Сначала копилка, потом обязательные расходы, остальное на цели и удовольствия. Категории настраиваются шестерёнкой справа.' },
    ],
    'finance.year': [
      { sel: '.tochka-stats-row', t: 'Итоги года', d: 'Средний доход в месяц и лучший месяц. Нажми на месяц ниже, чтобы открыть его.' },
    ],
    'finance.all': [
      { sel: '.tochka-hero', t: 'За всё время', d: 'Сумма по всем годам и рост к прошлому году. Нажми на год, чтобы открыть его.' },
    ],
    'habits.wheel': [
      { sel: '.wheel-current-card', t: 'Колесо жизни', d: 'Раз в месяц оцени 8 сфер от 1 до 10. Сразу видно, где проседаешь.' },
      { sel: '.wheel-fill-btn', t: 'Оценить месяц', d: 'Нажми, выставь оценки и оставь короткий комментарий.' },
    ],
    'habits.history': [
      { sel: '.hh-list, .sec-card, .hh-empty', t: 'История', d: 'Все прошлые месяцы: процент выполнения и сколько раз сделана каждая привычка.' },
    ],
    'training.working-weight': [
      { sel: '.tr-ww-group, .tr-ww-wrap, .tr-empty-state', t: 'Рабочие веса', d: 'Последний вес и повторы по каждому упражнению и насколько он вырос с начала плана.' },
      { sel: '#tr-rm-open', t: 'Калькулятор максимума', d: 'Сколько ты поднимешь на один раз и какие веса брать под силу, массу или выносливость.' },
      { sel: '#tr-edit-exercises-ww', t: 'Упражнения', d: 'Списки упражнений для каждого вида тренировки. Добавь своё или убери лишнее, и в плане будет выбор только из нужного.' },
    ],
    'training.one-rm': [
      { sel: '.tr-1rm-hero, .tr-1rm-wrap', t: 'Калькулятор максимума', d: 'Введи вес и сколько раз его поднял. Посчитаю максимум на один раз и рабочие веса под силу, массу и выносливость.' },
    ],
    'training.summary': [
      { sel: '#tr-bp', t: 'Прогресс тела', d: 'Вес с графиком и темпом в неделю, все замеры с динамикой и выводы: уходит жир, растут объёмы или пора проверить питание.' },
      { sel: '#tr-add-measure', t: 'Новый замер', d: 'Раз в 2–4 недели, утром натощак. Чем регулярнее, тем точнее выводы.' },
    ],
    'training.nutrition': [
      { sel: '.nutr-edit-goal-btn', t: 'Цель по питанию', d: 'Калории, белки, жиры и углеводы на день. Цель своя у каждого плана тренировок.' },
      { sel: '.nutr-date-nav', t: 'День', d: 'Стрелками листаешь прошлые дни, чтобы посмотреть или дописать.' },
      { sel: '.nutr-add-meal-btn', t: 'Добавить еду', d: 'Выбери продукт и граммы, калории и БЖУ посчитаются сами. Граммы можно поправить прямо в списке.' },
    ],
    'training.ai-chat': [
      { sel: '.ch-head', t: 'Чат с тренером', d: 'Тренер видит твои тренировки, веса и замеры и отвечает по ним. Спроси, почему встал вес, чем заменить упражнение или как сократить тренировку.' },
      { sel: '.ch-quick', t: 'Готовые вопросы', d: 'Нажми, чтобы спросить в одно касание.' },
      { sel: '.ch-left', t: 'Сообщения', d: 'Сколько бесплатных сообщений осталось в этом месяце. Первого числа счётчик обновится.' },
    ],
    'training.ai': [
      { sel: '.ai-views', t: 'Режимы AI', d: 'Программа от AI-тренера, Разбор твоего прогресса и Чат с тренером.' },
      { sel: '.q-focus', t: 'Упор', d: 'FULL BODY: грудь, спина, ноги, плечи и руки поровну. Ноги и ягодицы: низ два раза за круг, верх одним днём.' },
      { sel: '.q-nrow', t: 'Тренировок в круге', d: 'Сколько разных тренировок. Обычно столько, сколько раз в неделю ходишь в зал.' },
      { sel: '.q-circle', t: 'Тренировки по кругу', d: 'Идут по очереди: 1, 2, 3 и снова 1. В какой день идти, выбираешь ты. Нажми на мышцу, чтобы перенести её в другую тренировку.' },
      { sel: '#q-gen', t: 'Составить план', d: 'Подставлю упражнения и веса до конца плана и буду прибавлять вес сам после каждой тренировки.' },
      { sel: '#q-help', t: 'Подсказки', d: 'Забыл, что к чему? Нажми сюда, и подсказки покажутся снова.' },
    ],
    'training.ai-insights': [
      { sel: '.in-week', t: 'Итоги недели', d: 'Каждый понедельник: тренировки, тоннаж, что выросло, что отстаёт и фокус на неделю.' },
      { sel: '.in-bal', t: 'Баланс нагрузки', d: 'Подходы на каждую мышцу в неделю. Зелёный: норма, жёлтый: мало, красный: много.' },
      { sel: '.in-rec, .in-card:nth-of-type(3)', t: 'Рекорды и прогноз', d: 'Твой максимум на один раз и когда дойдёшь до цели. Флажком ставишь свою цель.' },
      { sel: '.in-pl, .in-ok', t: 'Плато', d: 'Если упражнение стоит 3 тренировки, тренер предложит замену. Нажми, и она встанет в план.' },
      { sel: '#in-share', t: 'Сторис', d: 'Красивая картинка с прогрессом за 8 недель. Поделись в сторис или сохрани.' },
    ],
    'goals.season': [
      { sel: '.goals-hero-season, .goals-hero-all', t: 'Цели сезона', d: 'Сумма целей сезона, сколько месяцев осталось и сколько откладывать в месяц.' },
    ],
  };

  /* ── Состояние ── */
  /* Состояние хранится и в Store (синхронизация), и локально (надёжно, даже если
     облако перезапишет раздел). Берём более свежую ревизию, просмотренные объединяем. */
  function lsKey() { const u = window.FirebaseSync && FirebaseSync.currentUser ? FirebaseSync.currentUser() : null; return 'you_tour_' + (u && u.uid || 'anon'); }
  function readLocal() { try { return JSON.parse(localStorage.getItem(lsKey()) || 'null'); } catch (e) { return null; } }
  function st() {
    const a = ((Store.get() || {}).home || {}).tour || null, b = readLocal();
    if (!a && !b) return null;
    if (!a || !b) return JSON.parse(JSON.stringify(a || b));
    const ra = a.rev || 0, rb = b.rev || 0, top = ra >= rb ? a : b, other = ra >= rb ? b : a;
    const seen = Object.assign({}, (ra === rb ? other.seen : null) || {}, top.seen || {});
    return { enabled: top.enabled, rev: top.rev || 0, seen };
  }
  function save(s) {
    try { localStorage.setItem(lsKey(), JSON.stringify(s)); } catch (e) {}
    try { Store.set('home.tour', s); } catch (e) {}
  }
  function disableAll() { const s = st() || { seen: {} }; s.enabled = false; s.rev = (s.rev || 0) + 1; save(s); queue = []; }
  function isCoach() { return typeof Auth !== 'undefined' && Auth.role && Auth.role() === 'coach'; }
  function hasData(s) {
    const tr = (s.training || {}).plans, hb = (s.habits || {}).months, fy = (s.finance || {}).years, g = s.goals;
    const n = (o) => o ? (Array.isArray(o) ? o.length : Object.keys(o).length) : 0;
    return n(tr) > 0 || n(hb) > 0 || n(fy) > 0 || (g && n(g.items || g.list || g.categories) > 0);
  }
  /* Решаем один раз: новый пользователь или нет */
  function ensure() {
    let s = st();
    if (s && typeof s.enabled === 'boolean') return s;
    const u = window.FirebaseSync && FirebaseSync.currentUser ? FirebaseSync.currentUser() : null;
    if (!u) return null;
    const created = u.metadata && u.metadata.creationTime ? Date.parse(u.metadata.creationTime) : NaN;
    const isNew = !isNaN(created) ? created >= SINCE && !hasData(Store.get() || {}) : !hasData(Store.get() || {});
    s = { enabled: isNew, seen: {} };
    save(s);
    return s;
  }
  function seen(key) { const s = st(); return !!(s && s.seen && s.seen[key]); }
  function markSeen(key) { const s = st() || { enabled: true, seen: {} }; s.seen = s.seen || {}; s.seen[key] = true; save(s); }
  function allowed() { if (isCoach() || !window._appReady) return false; const s = ensure(); return !!(s && s.enabled); }

  /* ── Отрисовка ── */
  function visible(el) { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(el).visibility !== 'hidden'; }
  /* селекторы через запятую по приоритету: «.tr-day-today .tr-day-add, .tr-day-add» сначала ищет сегодняшний день */
  function find(sel) { for (const part of String(sel).split(',')) { let list = []; try { list = document.querySelectorAll(part.trim()); } catch (e) {} for (const el of list) if (visible(el)) return el; } return null; }

  function play(steps, key, done) {
    const items = steps.filter(s => find(s.sel));
    if (!items.length) { markSeen(key); done && done(); return; }
    running = true;
    const root = document.createElement('div');
    root.className = 'tour-root';
    root.innerHTML = `<div class="tour-block"></div><div class="tour-hole"></div>
      <div class="tour-tip" role="dialog"><div class="tour-arrow"></div>
        <div class="tour-step"></div><div class="tour-t"></div><div class="tour-d"></div>
        <div class="tour-foot"><button class="tour-skip">Пропустить</button><div class="tour-dots"></div><button class="tour-next">Далее</button></div>
        <button class="tour-off">Больше не показывать подсказки</button>
      </div>`;
    document.body.appendChild(root);
    const hole = root.querySelector('.tour-hole'), tip = root.querySelector('.tour-tip'), arrow = root.querySelector('.tour-arrow');
    let i = 0, target = null;

    function place() {
      if (!target) return;
      const r = target.getBoundingClientRect(), pad = 6, vw = innerWidth, vh = innerHeight;
      const hx = Math.max(4, r.left - pad), hy = Math.max(4, r.top - pad);
      const hw = Math.min(vw - 8, r.width + pad * 2), hh = Math.min(vh - 8, r.height + pad * 2);
      Object.assign(hole.style, { left: hx + 'px', top: hy + 'px', width: hw + 'px', height: hh + 'px',
        borderRadius: Math.min(22, parseFloat(getComputedStyle(target).borderRadius) + 4 || 14) + 'px' });
      const tw = Math.min(330, vw - 24); tip.style.width = tw + 'px';
      const th = tip.offsetHeight;
      const below = hy + hh + 14 + th < vh - 10 || hy < th + 30;
      const top = below ? Math.min(vh - th - 10, hy + hh + 14) : Math.max(10, hy - th - 14);
      const cx = r.left + r.width / 2;
      const left = Math.max(12, Math.min(vw - tw - 12, cx - tw / 2));
      tip.style.left = left + 'px'; tip.style.top = top + 'px';
      tip.classList.toggle('below', below); tip.classList.toggle('above', !below);
      arrow.style.left = Math.max(18, Math.min(tw - 18, cx - left)) + 'px';
    }
    function show() {
      const s = items[i];
      target = find(s.sel);
      if (!target) { next(); return; }
      const r = target.getBoundingClientRect();
      if (r.top < 70 || r.bottom > innerHeight - 20) target.scrollIntoView({ block: 'center', behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
      root.querySelector('.tour-step').textContent = items.length > 1 ? `Подсказка ${i + 1} из ${items.length}` : 'Подсказка';
      root.querySelector('.tour-t').textContent = s.t;
      root.querySelector('.tour-d').textContent = s.d;
      root.querySelector('.tour-dots').innerHTML = items.length > 1 ? items.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('') : '';
      root.querySelector('.tour-next').textContent = i === items.length - 1 ? 'Понятно' : 'Далее';
      tip.classList.remove('in'); void tip.offsetWidth;
      requestAnimationFrame(() => { place(); tip.classList.add('in'); });
    }
    function next() { i++; if (i >= items.length) finish(); else show(); }
    function finish() {
      markSeen(key); running = false;
      removeEventListener('resize', place); removeEventListener('scroll', place, true); removeEventListener('keydown', onKey);
      root.classList.add('out'); setTimeout(() => root.remove(), 250);
      done && done();
      setTimeout(pump, 400);
    }
    function onKey(e) { if (e.key === 'Escape') finish(); if (e.key === 'Enter' || e.key === 'ArrowRight') next(); }
    root.querySelector('.tour-next').addEventListener('click', next);
    root.querySelector('.tour-skip').addEventListener('click', finish);
    root.querySelector('.tour-off').addEventListener('click', () => { disableAll(); finish(); });
    root.querySelector('.tour-block').addEventListener('click', next);
    addEventListener('resize', place); addEventListener('scroll', place, true); addEventListener('keydown', onKey);
    show();
  }

  /* Приветствие перед первым туром */
  function welcome(then, cancel) {
    const ov = document.createElement('div');
    ov.className = 'tour-root tour-welcome-wrap';
    ov.innerHTML = `<div class="tour-block"></div><div class="tour-welcome">
      <img src="icon.png" alt=""><div class="tour-wt">Добро пожаловать в YOU</div>
      <div class="tour-wd">Покажу за 30 секунд, что здесь где и зачем. В каждом разделе тоже будут короткие подсказки, один раз.</div>
      <button class="tour-next tour-wgo">Показать</button><button class="tour-skip tour-wno">Разберусь сам</button></div>`;
    document.body.appendChild(ov);
    const close = () => { ov.classList.add('out'); setTimeout(() => ov.remove(), 250); };
    ov.querySelector('.tour-wgo').addEventListener('click', () => { close(); setTimeout(then, 260); });
    ov.querySelector('.tour-wno').addEventListener('click', () => {
      close(); disableAll(); cancel && cancel();
    });
  }

  /* Очередь, чтобы подсказки не накладывались */
  function pump() {
    if (running || !queue.length) return;
    const job = queue.shift();
    if (seen(job.key) || !allowed()) { pump(); return; }
    if (job.path && Router.currentPath() !== job.path) { pump(); return; }
    if (document.querySelector('.tr-modal-overlay, .fb-overlay')) { queue.unshift(job); setTimeout(pump, 1500); return; }
    if (job.key === 'screen:/home' && !seen('welcome')) {
      running = true; markSeen('welcome');
      welcome(() => { running = false; play(job.steps, job.key); }, () => { running = false; });
      return;
    }
    play(job.steps, job.key);
  }
  function enqueue(key, steps, path) {
    if (!steps || seen(key) || !allowed()) return;
    if (queue.some(j => j.key === key)) return;
    queue.push({ key, steps, path });
    setTimeout(pump, 700);
  }

  function onScreen(path) {
    if (!SCREENS[path]) return;
    enqueue('screen:' + path, SCREENS[path], path);
  }
  function onTab(section, tab) {
    const k = section + '.' + tab;
    if (TABS[k]) enqueue('tab:' + k, TABS[k], '/' + section);
  }
  function restart() {
    const s0 = st() || {};
    save({ enabled: true, seen: {}, rev: (s0.rev || 0) + 1 });
    queue = [];
    Router.go('/home'); Router.render && Router.render();
    setTimeout(() => onScreen('/home'), 300);
  }

  /* Переключение вкладок в любом разделе */
  document.addEventListener('click', (e) => {
    const v = e.target.closest && e.target.closest('.ai-view');
    if (v && (v.dataset.v === 'insights' || v.dataset.v === 'chat')) { setTimeout(() => onTab('training', 'ai-' + v.dataset.v), 450); return; }
    if (e.target.closest && e.target.closest('#tr-rm-open')) { setTimeout(() => onTab('training', 'one-rm'), 450); return; }
    const b = e.target.closest && e.target.closest('.tochka-tab, .hab-tab, .tr-tab, .goals-season-tab');
    if (!b) return;
    if (typeof Router === 'undefined') return; /* в кабинете тренера роутера нет */
    const path = Router.currentPath().replace('/', '');
    let tab = b.dataset.tab || '';
    if (b.classList.contains('goals-season-tab')) tab = (b.dataset.season && b.dataset.season !== 'all') || !/Всё/.test(b.textContent) ? 'season' : '';
    if (tab) setTimeout(() => onTab(path, tab), 450);
  }, true);

  return { onScreen, onTab, restart, play, _state: st };
})();
