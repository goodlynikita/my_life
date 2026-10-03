/* ============================================================
   ТЕЛЕФОН И ЧАСЫ: данные с телефона без открытия YOU
   Команды на iPhone и MacroDroid на Android отправляют POST на личный адрес
   <databaseURL>/inbox/<ключ>.json. Что умеет приходить:
     { k: 'sms', text, from? }                       SMS или пуш банка → трата в «Расходы»
     { k: 'day', n, kcal?, min?, d? }                 шаги за день → «Шаги» в плане
     { k: 'workout', type, min?, kcal?, km?, start? } тренировка с часов → в план
   YOU при запуске и при возврате в приложение забирает записи и удаляет их из ящика.
   Ключ знает только владелец, читать ящик может только он (правила Firebase).
   ============================================================ */
window.Inbox = (function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const KEY_RE = /^[A-Za-z0-9]{24}$/;
  function key() { const k = (Store.get().inbox || {}).key; return typeof k === 'string' && KEY_RE.test(k) ? k : ''; }
  function genKey() {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789', b = new Uint8Array(24);
    crypto.getRandomValues(b); return Array.from(b, x => a[x % a.length]).join('');
  }
  function url(k) { return String((window.FIREBASE_CONFIG || {}).databaseURL || '').replace(/\/+$/, '') + '/inbox/' + k + '.json'; }
  const ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  /* время записи зашито в push-ключ Firebase: свои часы телефона не нужны */
  const PUSH = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  function pushTime(id) {
    let t = 0; const s = String(id || '').slice(0, 8); if (s.length < 8) return Date.now();
    for (const c of s) { const i = PUSH.indexOf(c); if (i < 0) return Date.now(); t = t * 64 + i; }
    return t > 1.5e12 && t < Date.now() + 864e5 ? t : Date.now();
  }
  /* числа из Команд приходят и числом, и строкой «8 432» или «45,5 мин» */
  function num(v) { const m = String(v == null ? '' : v).replace(/[\s  ]/g, '').replace(',', '.').match(/-?\d+(?:\.\d+)?/); return m ? +m[0] : 0; }
  function dayOf(item) {
    const d = String(item.d || '').trim();
    let m = d.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12);
    m = d.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/); if (m) return new Date(+m[3], +m[2] - 1, +m[1], 12);
    return new Date(item._at);
  }

  /* ── SMS и пуши банков ── */
  const SKIP = /код|парол|code|не сообща|никому|отказ|отклон|недостаточно|зачисл|поступ|пополн|входящ|возврат|кэшб|кешб|cashback|начислен|вам перевел|перевод от|отмен|заблок|вход в |одобрен|кредитный лимит|задолженн|напомина/i;
  const SPEND = /покупк|оплат|списан|снятие|выдача|перевод|платёж|платеж|purchase|payment|pokupka|oplata|spisan/i;
  const AMT = /(\d{1,3}(?:[   ]\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(?:₽|руб(?:\.|лей|ля|ль)?|р\.?|rub|rur)(?![а-яёa-z])/i;
  const BANKS = [[/сбер|sber|^900$/i, 'Сбер'], [/т-банк|тбанк|тинько|tinkoff|t-bank|tbank/i, 'Т-Банк'], [/альфа|alfa/i, 'Альфа'], [/втб|vtb/i, 'ВТБ'],
    [/озон|ozon/i, 'Озон Банк'], [/яндекс ?банк|yandex ?bank/i, 'Яндекс Банк'], [/газпромбанк|gazprombank/i, 'Газпромбанк'], [/райф|raif/i, 'Райффайзен'], [/совком|sovcom/i, 'Совкомбанк'], [/мтс ?банк|mts ?bank/i, 'МТС Банк']];
  const BRANDS = [[/pyater|пят[её]р/i, 'Пятёрочка'], [/magnit|магнит/i, 'Магнит'], [/perekr|перекр/i, 'Перекрёсток'], [/vkusvill|вкусвил/i, 'ВкусВилл'], [/lenta|лента/i, 'Лента'],
    [/auchan|ашан/i, 'Ашан'], [/dixy|дикси/i, 'Дикси'], [/samokat|самокат/i, 'Самокат'], [/wildberr|вайлдб/i, 'Wildberries'], [/ozon|озон/i, 'Ozon'],
    [/yandex.?(?:go|taxi)|яндекс.?(?:go|такси)|uber|citymobil/i, 'Такси'], [/yandex.?eda|яндекс.?еда|delivery ?club|kuper|купер/i, 'Доставка еды'],
    [/yandex.?plus|яндекс.?плюс|kinopoisk|кинопоиск|ivi\b|okko/i, 'Подписка'], [/apple\.com|itunes|google ?play/i, 'Подписка'], [/apteka|аптек|zdravcity|eapteka/i, 'Аптека'],
    [/kfc|burger|vkusno|вкусно и|mcdon|rostic|ростикс|dodo|додо/i, 'Фастфуд'], [/coffee|kofe|кофе|cofix|shokoladnica|starbucks|surf/i, 'Кофе'],
    [/azs|азс|lukoil|лукойл|gazpromneft|rosneft|роснефть|shell|tatneft/i, 'АЗС'], [/mosmetro|metro ?moscow|troika|тройка|transport|транспорт/i, 'Транспорт']];
  function bankParse(text, from) {
    const raw = String(text || '').replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000);
    if (!raw || SKIP.test(raw) || !SPEND.test(raw)) return null;
    /* остаток на счёте тоже с ₽: отрезаем всё после «Баланс/Доступно/Остаток» */
    const head = raw.split(/\b(?:баланс|доступно|остаток|ост\.|ост:|доступный|balance|bal:)/i)[0];
    const m = head.match(AMT); if (!m) return null;
    const amt = +(m[1].replace(/[^\d]/g, '') + '.' + (m[2] || '0')); if (!(amt > 0)) return null;
    const clean = (s) => s
      .replace(/(?:карта|карты|картой|card|сч[её]т|сч\.|счета)\s*(?:[a-z]+)?\s*[*•]*\s*\d{2,}/gi, ' ')
      .replace(/\b(?:ecmc|visa|mir|мир|mastercard|maestro|mc|pay)[-\s*•]*\d{4}\b/gi, ' ').replace(/[*•]+\d{2,}/g, ' ')
      .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ').replace(/\b\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\b/g, ' ')
      .replace(/(?:^|\s)(?:покупка|оплата|списание|успешн\S*|на сумму|сумма|с карты|по карте|в|на|по|из|rub|rur|руб\.?|р\.)(?=\s|$|[,.])/gi, ' ')
      .replace(/\b(?:moskva|moscow|g\.? ?moskva|sankt-?peterbu\S*|spb|rus|ru)\b/gi, ' ')
      .split(/[,;]|\. /)[0].replace(/\s+/g, ' ').replace(/^[\s,.:;!-]+|[\s,.:;!-]+$/g, '').trim();
    let note = clean(head.slice(m.index + m[0].length));
    if (!/[a-zа-яё]{2}/i.test(note)) note = clean(head.slice(0, m.index).replace(SPEND, ' '));
    if (/снятие|выдача/i.test(raw)) note = 'Наличные';
    else if (/перевод/i.test(raw) && !/[a-zа-яё]{3}/i.test(note)) note = 'Перевод';
    const br = BRANDS.find(([re]) => re.test(note) || re.test(head)); if (br && !/снятие|выдача/i.test(raw)) note = br[1];
    else if (note === note.toUpperCase() && /[A-ZА-ЯЁ]{3}/.test(note)) note = note.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()); /* PYATEROCHKA → Pyaterochka */
    if (/перевод/i.test(raw) && note !== 'Перевод' && !br) note = 'Перевод ' + note;
    if (!note || !/[a-zа-яё]{2}/i.test(note)) note = 'Трата';
    const bank = BANKS.find(([re]) => re.test(raw) || re.test(String(from || '')));
    return { amt, note: note.slice(0, 60), src: bank ? bank[1] : '' };
  }

  /* ── План тренировок: день по дате ── */
  function withDay(date, fn) {
    if (typeof trGetPlans !== 'function' || typeof trSavePlans !== 'function') return false;
    const plans = trGetPlans(); if (!Array.isArray(plans) || !plans.length) return false;
    const want = ymd(date);
    const act = plans.filter(p => p && p.status === 'active'), order = act.concat(plans.filter(p => p && act.indexOf(p) < 0).reverse());
    for (const plan of order) {
      for (const w of (plan.weeks || [])) for (const day of ((w && w.days) || [])) {
        if (!day) continue;
        const dt = trDayDateOf(plan, day.date); if (!dt || ymd(dt) !== want) continue;
        if (typeof trMigrateDayToSessions === 'function') trMigrateDayToSessions(day);
        if (!Array.isArray(day.sessions)) day.sessions = [];
        if (fn(day) === false) return false;
        trSavePlans(plans); return true;
      }
    }
    return false;
  }
  function saveHealth(date, patch) {
    const k = ymd(date), cur = ((Store.get().health || {}).days || {})[k] || {};
    Store.set('health.days.' + k, Object.assign({}, cur, patch, { at: Date.now() }));
  }
  function applySteps(item) {
    const n = Math.round(num(item.n != null ? item.n : item.steps)); if (!(n >= 100 && n <= 200000)) return null;
    const date = dayOf(item), kcal = Math.round(num(item.kcal)), min = Math.round(num(item.min));
    saveHealth(date, Object.assign({ steps: n }, kcal > 0 && kcal < 20000 ? { kcal } : {}, min > 0 && min < 1440 ? { min } : {}));
    withDay(date, (day) => {
      let ex = null, ses = null;
      day.sessions.forEach(s => (s && s.exercises || []).forEach(e => { if (!ex && e && e.kind === 'steps') { ex = e; ses = s; } }));
      if (ex) { if (ses.src === 'health' || !(+ex.steps > 0) || n > +ex.steps) { if (+ex.steps === n) return false; ex.steps = n; ses.src = 'health'; } else return false; }
      else day.sessions.push({ type: 'Шаги', groups: [], src: 'health', exercises: [{ kind: 'steps', name: 'Шаги', steps: n }] });
    });
    return { steps: n };
  }
  /* тип тренировки с часов → тип плана. Ходьбу не пишем: она уже в шагах */
  const WT = [[/ходьб|walk|hik|поход/i, null], [/бег|run|jog/i, ['cardio', 'Бег', 'Бег']], [/вело|cycl|bike|spin/i, ['cardio', 'Велосипед', 'Велосипед']],
    [/плав|swim|бассейн|pool/i, ['cardio', 'Плавание', 'Плавание']], [/эллипс|ellipt/i, ['cardio', 'Эллипс', 'Эллипс']], [/греб|row/i, ['cardio', 'Гребля', 'Гребля']],
    [/йог|yoga/i, ['tc', 'Йога', 'Йога']], [/пилат|pilates/i, ['tc', 'Пилатес', 'Пилатес']], [/растяж|стретч|stretch|flexib|гибк|cooldown|заминк/i, ['tc', 'Растяжка', 'Растяжка']],
    [/теннис|tennis|падел|padel/i, ['tc', 'Теннис', 'Теннис']], [/бокс|box|кикбокс/i, ['tc', 'Бокс', 'Бокс']], [/футбол|soccer|football/i, ['tc', 'Футбол', 'Футбол']],
    [/баскет|basket/i, ['tc', 'Баскетбол', 'Баскетбол']], [/волейб|volley/i, ['tc', 'Волейбол', 'Волейбол']], [/борьб|wrestl|martial|единобор/i, ['tc', 'Борьба', 'Борьба']],
    [/сноуб|snowb/i, ['tc', 'Сноуборд', 'Сноуборд']], [/лыж|ski/i, ['tc', 'Лыжи', 'Лыжи']], [/коньк|skat/i, ['tc', 'Коньки', 'Коньки']],
    [/сил|strength|weight|gym|зал/i, ['gym']], [/функц|functional|hiit|интервал|cross|кросс|core|кор/i, ['tc', 'Функциональная', 'Функциональная']]];
  function applyWorkout(item) {
    const t = String(item.type || '').trim().slice(0, 60);
    const hit = WT.find(([re]) => re.test(t)); if (hit && !hit[1]) return null;
    const map = hit ? hit[1] : ['tc', 'Функциональная', t || 'Тренировка'];
    let min = num(item.min); if (min > 600) min = min / 60; min = Math.round(min);           /* пришли секунды */
    let km = num(item.km); if (km > 300) km = km / 1000; km = Math.round(km * 100) / 100;    /* пришли метры */
    const kcal = Math.round(num(item.kcal));
    if (!(min > 0) && !(kcal > 0) && !(km > 0)) return null;
    const wid = String(item.start || item._id).slice(0, 40), date = item.start && !isNaN(Date.parse(item.start)) ? new Date(Date.parse(item.start)) : dayOf(item);
    const minOk = min > 0 && min <= 1440 ? min : 0, kcalOk = kcal > 0 && kcal <= 20000 ? kcal : 0, kmOk = km > 0 && km <= 1000 ? km : 0;
    let label = map[2] || 'Тренировка';
    const ok = withDay(date, (day) => {
      if (day.sessions.some(s => s && s.wid === wid)) return false;
      const watch = { min: minOk, kcal: kcalOk, type: t };
      if (map[0] === 'gym') {
        /* силовая с часов: если в плане есть зал, дописываем ему время и калории, упражнения не трогаем */
        const g = day.sessions.find(s => s && typeof trIsGymType === 'function' && trIsGymType(s.type) && !s.wid);
        if (g) { g.watch = watch; g.wid = wid; label = 'Зал'; return; }
        day.sessions.push({ type: 'Функциональная', groups: [], src: 'watch', wid, exercises: [{ kind: 'time_calorie', name: 'Силовая', duration: minOk, calories: kcalOk }] });
        label = 'Силовая'; return;
      }
      /* та же тренировка уже стоит в плане и не заполнена: заполняем её */
      const same = day.sessions.find(s => s && !s.wid && s.type === map[1] && (s.exercises || []).every(e => !e || !((+e.duration || 0) > 0 || (+e.distance || 0) > 0 || (+e.calories || 0) > 0)));
      const ex = map[0] === 'cardio' ? { kind: 'cardio', name: map[2], distance: kmOk, duration: minOk } : { kind: 'time_calorie', name: map[2], duration: minOk, calories: kcalOk };
      if (same) { same.exercises = [ex]; same.wid = wid; same.src = 'watch'; same.watch = watch; }
      else day.sessions.push({ type: map[1], groups: [], src: 'watch', wid, watch, exercises: [ex] });
    });
    return ok ? { label, min: minOk } : null;
  }

  /* ── Забрать ящик ── */
  let busy = false, lastPull = 0;
  async function pull(force) {
    const k = key();
    if (!k || busy || !window.FirebaseSync || !FirebaseSync.inboxTake) return;
    if (typeof Auth !== 'undefined' && (!Auth.isLoggedIn() || Auth.role() === 'coach')) return;
    if (window.__coachMode) return;
    if (!force && Date.now() - lastPull < 20000) return;
    busy = true; lastPull = Date.now();
    try {
      const items = await FirebaseSync.inboxTake(k, 60);
      if (!items.length) return;
      const spent = [], steps = [], works = [];
      items.forEach(it => {
        it._at = pushTime(it._id);
        try {
          if (it.k === 'sms') {
            const b = bankParse(it.text, it.from); if (!b || !window.FinSpend || !FinSpend.addBank) return;
            const r = FinSpend.addBank({ id: 'b' + it._id.replace(/[^\w-]/g, ''), amt: b.amt, note: b.note, src: b.src, at: it._at }); if (r) spent.push(r);
          } else if (it.k === 'day') { const r = applySteps(it); if (r) steps.push(r); }
          else if (it.k === 'workout') { const r = applyWorkout(it); if (r) works.push(r); }
        } catch (e) { if (window.FirebaseSync && FirebaseSync.logError) try { FirebaseSync.logError('inbox: ' + (e && e.message)); } catch (x) {} }
      });
      Store.set('inbox.last', Date.now());
      if (!spent.length && !steps.length && !works.length) return;
      const fmt = (n) => Math.round(n).toLocaleString('ru-RU');
      const parts = [];
      if (spent.length === 1) parts.push('Трата ' + fmt(spent[0].amt) + ' ₽ · ' + spent[0].note);
      else if (spent.length) parts.push('Траты из банка: ' + spent.length + ' на ' + fmt(spent.reduce((s, x) => s + x.amt, 0)) + ' ₽');
      if (steps.length) parts.push('Шаги: ' + fmt(steps[steps.length - 1].steps));
      if (works.length) parts.push(works.length === 1 ? 'Тренировка: ' + works[0].label + (works[0].min ? ' ' + works[0].min + ' мин' : '') : 'Тренировки с часов: ' + works.length);
      if (window.FinSpend && FinSpend.toast) FinSpend.toast(parts.join('. '));
      if (window.Router && /^\/(home|training|finance)/.test(Router.currentPath() || '') && !document.querySelector('.tr-modal-overlay')) Router.render({ keepScroll: true });
    } catch (e) {
    } finally { busy = false; }
  }

  /* ── Окно «Телефон и часы» ── */
  async function ensureKey() {
    let k = key(); if (k) return k;
    k = genKey(); await FirebaseSync.inboxClaim(k); Store.set('inbox.key', k); return k;
  }
  function copy(text, btn) {
    const done = () => { if (btn) { const o = btn.textContent; btn.textContent = 'Скопировано'; setTimeout(() => { btn.textContent = o; }, 1500); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallback());
    else fallback();
    function fallback() { const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) {} t.remove(); }
  }
  const ios = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function guide(os, k) {
    const U = '<code class="ib-code">' + esc(url(k)) + '</code>';
    const post = (fields) => `<li>Добавь действие «Получить содержимое URL». URL: адрес выше. Нажми «Показать больше»: Метод <b>POST</b>, Тело запроса <b>JSON</b></li><li>Поля JSON: ${fields}</li>`;
    if (os === 'ios') return `
      <details class="ib-step" open><summary><i class="ti ti-message-2"></i>Траты из SMS банка</summary><ol>
        <li>Команды → Автоматизация → «+» → <b>Сообщение</b></li>
        <li>Отправитель: твой банк (например, 900). Сообщение содержит: <b>Покупка</b> или <b>Оплата</b>. Выбери «Запускать сразу»</li>
        <li>«Новая пустая автоматизация»</li>
        ${post('<b>k</b> (текст) = <code>sms</code>, <b>text</b> (текст) = переменная «Ввод быстрой команды» → «Содержимое»')}
        <li>Сделай такую же автоматизацию для каждого банка</li></ol>
        <p class="ib-note">Пуши банковских приложений iPhone командам не отдаёт. Включи в банке SMS-уведомления или пиши трату строкой.</p></details>
      <details class="ib-step"><summary><i class="ti ti-shoe"></i>Шаги из «Здоровья»</summary><ol>
        <li>Команды → Автоматизация → «+» → <b>Время суток</b>: 23:50, ежедневно, «Запускать сразу»</li>
        <li>«Найти образцы здоровья»: Тип <b>Шаги</b>, Дата начала <b>сегодня</b></li>
        <li>«Вычислить статистику»: <b>Сумма</b></li>
        ${post('<b>k</b> = <code>day</code>, <b>n</b> (число) = «Статистика»')}</ol>
        <p class="ib-note">Носишь часы и шагов вдвое больше, чем в «Здоровье»? В поиске образцов добавь фильтр «Источник» = iPhone.</p></details>
      <details class="ib-step"><summary><i class="ti ti-device-watch"></i>Тренировки с часов</summary><ol>
        <li>Apple Watch, Garmin, Huawei, Amazfit, Xiaomi: включи в их приложении запись в «Здоровье»</li>
        <li>Команды → Автоматизация → «+» → <b>Тренировка Apple Watch</b> → «Завершается» (с другими часами: «Время суток», 23:55)</li>
        <li>«Найти образцы здоровья»: Тип <b>Тренировки</b>, Сортировка: дата начала, сначала новые, Ограничение: <b>1</b></li>
        ${post('<b>k</b> = <code>workout</code>, <b>type</b> = «Тип тренировки», <b>min</b> = «Длительность», <b>kcal</b> = «Активная энергия», <b>km</b> = «Расстояние», <b>start</b> = «Дата начала»')}</ol>
        <p class="ib-note">Бег, вело и плавание попадут в кардио, теннис и бокс в спорт, силовая допишет время к залу. Ходьба уже в шагах.</p></details>`;
    return `
      <details class="ib-step" open><summary><i class="ti ti-bell"></i>Траты из пушей и SMS банка</summary><ol>
        <li>Установи <b>MacroDroid</b> из Google Play и дай ему доступ к уведомлениям</li>
        <li>Макрос → Триггер «<b>Уведомление</b>» → «Получено» → выбери приложения банков. Текст содержит: <b>Покупка</b> (для SMS: триггер «SMS получено»)</li>
        <li>Действие «<b>HTTP-запрос</b>»: Метод <b>POST</b>, URL: адрес выше, Тип содержимого <b>application/json</b></li>
        <li>Тело: <code>{"k":"sms","text":"…"}</code>, вместо «…» через кнопку «…» вставь «Текст уведомления» (или «Текст SMS»)</li></ol>
        <p class="ib-note">Банк шлёт и пуш, и SMS? Не страшно: одинаковую трату за 3 минуты запишу один раз.</p></details>
      <details class="ib-step"><summary><i class="ti ti-shoe"></i>Шаги и часы</summary>
        <p class="ib-note">На Android шаги и тренировки хранит Health Connect, а доступ к нему есть только у приложений из Google Play. Подтянем, когда YOU появится в Google Play. Пока вписывай шаги в план вручную.</p></details>`;
  }
  async function open() {
    if (!window.FirebaseSync || !FirebaseSync.inboxClaim) return;
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay ib-ov';
    ov.innerHTML = '<div class="tr-modal ib" role="dialog" aria-label="Телефон и часы"><p class="tr-modal-title">Телефон и часы</p><p class="ib-sub">Загружаю…</p></div>';
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    let k;
    try { k = await ensureKey(); } catch (e) {
      ov.querySelector('.ib-sub').textContent = 'Не получилось создать адрес. Проверь интернет и попробуй ещё раз'; return;
    }
    let os = ios() ? 'ios' : 'and';
    const last = +((Store.get().inbox || {}).last) || 0;
    const draw = () => {
      ov.querySelector('.tr-modal').innerHTML = `<p class="tr-modal-title">Телефон и часы</p>
        <div class="ib-url"><span>Твой личный адрес</span>${'<code class="ib-code">' + esc(url(k)) + '</code>'}
          <div class="ib-row"><button class="tr-modal-btn-primary" id="ib-copy">Скопировать</button><button class="tr-modal-btn-secondary" id="ib-new" title="Старый адрес перестанет работать">Новый адрес</button></div></div>
        <div class="sp-seg ib-seg"><button type="button" data-os="ios" class="${os === 'ios' ? 'on' : ''}"><i class="ti ti-brand-apple"></i> iPhone</button><button type="button" data-os="and" class="${os === 'and' ? 'on' : ''}"><i class="ti ti-brand-android"></i> Android</button></div>
        <div class="ib-guide">${guide(os, k)}</div>
        <p class="ib-last">${last ? 'Последние данные: ' + esc(new Date(last).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })) : 'Данных с телефона пока не было'}</p>
        <p class="ib-note ib-warn"><i class="ti ti-lock"></i> Никому не показывай адрес: по нему можно добавить записи. Если он ушёл в чужие руки, нажми «Новый адрес».</p>
        <div class="tr-modal-actions"><button class="tr-modal-btn-secondary" id="ib-check" style="flex:1">Проверить сейчас</button><button class="tr-modal-btn-primary" id="ib-ok" style="flex:1">Готово</button></div>`;
      const q = (s) => ov.querySelector(s);
      q('#ib-copy').onclick = () => copy(url(k), q('#ib-copy'));
      q('#ib-ok').onclick = close;
      q('#ib-check').onclick = async () => { const b = q('#ib-check'); b.disabled = true; b.textContent = 'Проверяю…'; await pull(true); b.disabled = false; b.textContent = 'Проверить сейчас'; };
      ov.querySelectorAll('[data-os]').forEach(b => b.onclick = () => { os = b.dataset.os; draw(); });
      q('#ib-new').onclick = async () => {
        if (!confirm('Сделать новый адрес? Старый перестанет работать, его нужно будет заменить в Командах или MacroDroid.')) return;
        const old = k, nk = genKey();
        try { await FirebaseSync.inboxClaim(nk); } catch (e) { alert('Не получилось. Проверь интернет'); return; }
        try { await pull(true); } catch (e) {}
        Store.set('inbox.key', nk); k = nk;
        try { await FirebaseSync.inboxDrop(old); } catch (e) {}
        draw();
      };
    };
    draw();
  }

  /* забираем при запуске и при каждом возврате в приложение */
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(() => pull(), 800); });
  return { open, pull, bankParse, key, url, _applySteps: applySteps, _applyWorkout: applyWorkout };
})();
