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
      { sel: '#hero-slider', t: 'Фокус дня', d: 'Главное на сегодня: тренировка, привычки, деньги. Листай слайды пальцем, их можно настроить в меню «···».' },
      { sel: '.home2-tile-training', t: 'Тренировки', d: 'План на 8 недель, веса, подходы и AI-тренер, который сам растит нагрузку.' },
      { sel: '.home2-tile-habits', t: 'Привычки', d: 'Отмечай каждый день одним касанием. Серии и процент за месяц держат в тонусе.' },
      { sel: '.home2-tile-finance', t: 'Финансы', d: 'Доходы, копилка с защитой от импульсивных трат и план распределения денег.' },
      { sel: '.home2-tile-goals', t: 'Цели', d: 'Желания по сезонам с суммами. Видно, сколько закрыто и сколько осталось.' },
      { sel: '.theme-toggle', t: 'Светлая и тёмная тема', d: 'Переключай одним касанием. Выбор сохранится на всех устройствах.' },
      { sel: '#home-menu-btn', t: 'Меню', d: 'Настройка слайдов и плиток, повтор подсказок и выход из аккаунта.' },
      { sel: '.fb-envelope-home, [data-feedback]', t: 'Связь с нами', d: 'Нашёл ошибку или есть идея? Пиши сюда или сразу в Telegram, отвечаем лично.' },
    ],
    '/training': [
      { sel: '.tr-tabs', t: 'Разделы тренировок', d: 'План, рабочие веса, калькулятор 1ПМ, итоги, питание и AI-тренер.' },
      { sel: 'button[onclick*="tr-new-plan"]', t: 'Первый план', d: 'Начни отсюда: создай план на 8 недель, и в нём появятся дни для тренировок.' },
      { sel: '.tr-day-today, .tr-day', t: 'День в плане', d: 'Каждый день недели. Нажми «+», чтобы добавить тренировку: зал, бег, шаги, теннис и другое.' },
      { sel: '.tr-day-today .tr-day-add, .tr-day-add', t: 'Добавить тренировку', d: 'Выбери вид и группы мышц. Вес с прошлого раза подставится сам.' },
      { sel: '.tr-week-head', t: 'Недели плана', d: 'План длится 8 недель. Нажми на неделю, чтобы раскрыть или свернуть дни.' },
      { sel: '#tr-plan-menu-btn', t: 'Планы', d: 'Когда 8 недель закончатся, создай новый план. Старые сохранятся в истории.' },
      { sel: '#tr-coach', t: 'Кабинет тренера', d: 'Дай тренеру доступ только к тренировкам. Он зайдёт по твоему email со своим паролем.' },
      { sel: '#tr-undo', t: 'Отменить', d: 'Случайно удалил или изменил? Эта кнопка вернёт последнее действие.' },
    ],
    '/habits': [
      { sel: '.hab-tabs', t: 'Три вкладки', d: 'Месяц с отметками, Колесо жизни для оценки сфер и История прошлых месяцев.' },
      { sel: '.hab-cell.hab-active.hab-today, .hab-cell.hab-active', t: 'Отметка дня', d: 'Нажми один раз: сделал. Ещё раз: пропуск. Третий: очистить. Сегодняшний день обведён.' },
      { sel: '.sec-metric-grid', t: 'Итог месяца', d: 'Общий процент, лучшая привычка и та, что стоит подтянуть.' },
      { sel: '#hab-add', t: 'Новая привычка', d: 'Добавь свою: каждый день, по будням или несколько раз в неделю.' },
      { sel: '#hab-settings', t: 'Настройки', d: 'Здесь меняешь порядок, названия и расписание привычек.' },
    ],
    '/finance': [
      { sel: '.tochka-tabs', t: 'Разделы финансов', d: 'Месяц, ближайшие расходы, баланс с копилкой, итоги года и всё время.' },
      { sel: '.tochka-hero', t: 'Доход за месяц', d: 'Сумма всех поступлений и сравнение с тем же месяцем прошлого года. Стрелки листают месяцы.' },
      { sel: '#fin-add', t: 'Добавить приход', d: 'Записывай каждое поступление. Нажми на запись, чтобы изменить или удалить.' },
    ],
    '/goals': [
      { sel: '.goals-season-tabs', t: 'Сезоны', d: 'Все цели или по сезонам: весна, лето, осень, зима. У каждого свой цвет.' },
      { sel: '.goals-hero-all, .goals-hero-season', t: 'Прогресс', d: 'Сколько денег нужно на цели, сколько уже закрыто и сколько осталось.' },
      { sel: '.goals-check-v3', t: 'Выполнено', d: 'Отметь цель, когда купил или сделал. Сумма уйдёт в «закрыто».' },
      { sel: '#goals-new', t: 'Новая цель', d: 'Добавь цель с суммой, категорией и сезоном.' },
    ],
  };
  const TABS = {
    'finance.expenses': [
      { sel: '.xp-head', t: 'Ближайшие расходы', d: 'Слева то, что нужно оплатить. Справа потенциал: откуда придут деньги, чтобы закрыть.' },
      { sel: '.xp-sum', t: 'Профит или дефицит', d: 'Сразу видно, хватает ли ожидаемых денег на предстоящие траты.' },
    ],
    'finance.balance': [
      { sel: '.pg-card', t: 'Копилка', d: 'Процент от каждого дохода откладывается сам. Перед снятием будет честная проверка на импульсивную покупку.' },
      { sel: '.plan-card', t: 'Как распределить доход', d: 'Сначала копилка, потом базовые расходы, остальное на цели. Шестерёнка справа настраивает категории.' },
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
      { sel: '.hh-list, .sec-card', t: 'История', d: 'Все прошлые месяцы: процент выполнения и сколько раз сделано по каждой привычке.' },
    ],
    'training.working-weight': [
      { sel: '.tr-ww-group, .tr-ww-wrap', t: 'Рабочие веса', d: 'Последний вес и повторы по каждому упражнению и рост с начала плана.' },
    ],
    'training.one-rm': [
      { sel: '.tr-1rm-hero, .tr-1rm-wrap', t: 'Калькулятор 1ПМ', d: 'Введи вес и повторы, получишь максимум на один раз и рабочие веса под разные цели.' },
    ],
    'training.summary': [
      { sel: '.tr-body > *:first-child', t: 'Итоги', d: 'Тоннаж, прогресс по неделям и замеры тела.' },
    ],
    'training.nutrition': [
      { sel: '.nutr-macro-card, .tr-body > *:first-child', t: 'Питание', d: 'Норма белков, жиров и углеводов и приёмы пищи за день.' },
    ],
    'training.ai': [
      { sel: '.ai-card, .ai-hero', t: 'AI-тренер', d: 'Анализирует твои тренировки и расписывает план до конца блока с прогрессией нагрузок. Нужно 1–2 недели записей.' },
      { sel: '#ai-gen', t: 'Создать план', d: 'Одна кнопка. Потом переноси тренировки в основной план по дням.' },
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
  function isCoach() { return window.Auth && Auth.role && Auth.role() === 'coach'; }
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
  function find(sel) { const list = document.querySelectorAll(sel); for (const el of list) if (visible(el)) return el; return null; }

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
    const b = e.target.closest && e.target.closest('.tochka-tab, .hab-tab, .tr-tab, .goals-season-tab');
    if (!b) return;
    const path = Router.currentPath().replace('/', '');
    let tab = b.dataset.tab || '';
    if (b.classList.contains('goals-season-tab')) tab = (b.dataset.season && b.dataset.season !== 'all') || !/Всё/.test(b.textContent) ? 'season' : '';
    if (tab) setTimeout(() => onTab(path, tab), 450);
  }, true);

  return { onScreen, onTab, restart, _state: st };
})();
