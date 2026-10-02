/* ============================================================
   ФИНАНСЫ → «Расходы»: сколько можно спокойно потратить до конца месяца
   или до зарплаты N-го числа (finance.payday, выбор по нажатию на подпись)
   • Главная цифра: доход месяца минус копилка, минус ещё не оплаченный план
     по категориям, минус уже потраченное. Раскрывается «Как рассчитано».
   • Норма на сегодня: свободное делим на оставшиеся дни.
   • Шкала месяца с плановыми платежами (у категории есть день оплаты)
     и короткий список «Ближайшие платежи».
   • Запись одной строкой: «кофе 420», «такси 350 тинькофф», «продукты 2,3к».
     Пока печатаешь, видно, как строка разберётся: сумма, категория, карта.
   • Категории запоминаются: поменял категорию у траты, в следующий раз
     такая же строка попадёт туда сама (finance.spendRules, без сети).
   • Траты: finance.spend['YYYY-MM'] = [{ id, amt, cat, note, src, at }]
   Категории и копилка берутся из «Баланса» (finance.balance).
   ============================================================ */
window.FinSpend = (function () {
  /* экранируем всё, что пришло от пользователя или из базы */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /* цвет идёт в style="…": пропускаем только #hex, чтобы нельзя было подсунуть CSS */
  const col = (c, d) => (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c.trim())) ? c.trim() : (d || '#9CA3AF');
  /* Firebase может вернуть массив как объект {0:…,1:…} */
  const toArr = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map(k => v[k]) : []);
  const num = (n) => Math.round(Math.abs(n || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const fmt = (n) => (n < 0 ? '−' : '') + num(n) + ' ₽';
  const MON_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const MON_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const MON_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
  const DOW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const MAX_AMT = 100000000; /* 100 млн за одну трату: больше почти наверняка опечатка */
  const PALETTE = ['#977FE9', '#6366F1', '#60A5FA', '#06B6D4', '#14B8A6', '#10B981', '#5FC98B', '#FBBF24', '#F59E0B', '#E07A4F', '#EF4444', '#EC4899', '#F472B6', '#9CA3AF'];
  const catKey = (c) => (c && c.id) || ('n:' + String((c && c.name) || ''));
  const ymKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  /* склонение: 1 день, 2 дня, 5 дней */
  const plural = (n, f) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? f[2] : b > 1 && b < 5 ? f[1] : b === 1 ? f[0] : f[2]; };
  /* пользователь просил меньше анимаций: показываем сразу итог */
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  /* уникальный id: Date.now() сам по себе совпадает при двух записях за миллисекунду */
  const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ── Данные ── */
  /* бюджет из «Баланса»: копии категорий, у каждой гарантированно есть id */
  function budget() {
    const st = (Store.get().finance || {}).balance || {};
    /* у старых категорий нет id: ключом служит название */
    const cats = toArr(st.categories || (st.demoOff ? [] : (window.FIN_DEFAULT_CATS || []))).filter(c => c && typeof c === 'object').map(c => Object.assign({}, c, { id: catKey(c) }));
    const pct = +st.savePct;
    return { cats, savePct: st.savePct != null && isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 30, demo: !st.categories && !st.demoOff };
  }
  /* траты месяца, мусорные записи отбрасываем, суммы приводим к числу */
  function list(ym) {
    return toArr(((Store.get().finance || {}).spend || {})[ym]).filter(x => x && typeof x === 'object').map(x => Object.assign({}, x, { amt: Math.max(0, +x.amt || 0), at: isFinite(+x.at) && +x.at > 0 ? +x.at : monthStart(ym) }));
  }
  /* запись без времени попадает на первое число своего месяца */
  function monthStart(ym) { const [y, m] = String(ym).split('-').map(Number); return new Date(y || 1970, (m || 1) - 1, 1, 12).getTime(); }
  function saveList(ym, arr) { Store.set('finance.spend.' + ym, arr.filter(Boolean)); }
  function income(d) {
    try { return typeof finEntries === 'function' ? toArr(finEntries(d.getFullYear(), d.getMonth())).reduce((s, e) => s + ((e && +e.amount) || 0), 0) : 0; } catch (e) { return 0; }
  }
  /* сколько потрачено по каждой категории за месяц */
  function catSpent(ym) {
    const out = {}; list(ym).forEach(x => { const k = x.cat || '_other'; out[k] = (out[k] || 0) + x.amt; }); return out;
  }
  /* день зарплаты: считаем «до зарплаты» вместо «до конца месяца». Нет дня = до конца месяца */
  function payday() { const d = Math.round(+(Store.get().finance || {}).payday); return d >= 2 && d <= 31 ? d : 0; }
  /* день P в месяце: 31-е в 30-дневном месяце = последний день */
  const dayIn = (y, m, P) => new Date(y, m, Math.min(P, new Date(y, m + 1, 0).getDate()));
  /* период: с последней зарплаты (включительно) до следующей (не включая) */
  function period(now, P) {
    P = P || 1;
    let s = dayIn(now.getFullYear(), now.getMonth(), P);
    if (s > now) s = dayIn(now.getFullYear(), now.getMonth() - 1, P);
    return { start: s, end: dayIn(s.getFullYear(), s.getMonth() + 1, P) };
  }
  /* траты за период, он может захватывать два месяца */
  function listRange(start, end) {
    const out = []; const a = +start, b = +end;
    for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d < end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const ym = ymKey(d); list(ym).forEach(x => { if (x.at >= a && x.at < b) out.push(Object.assign(x, { ym })); });
    }
    return out;
  }
  /* выученные правила «слово → категория» */
  function rules() { const r = (Store.get().finance || {}).spendRules; return r && typeof r === 'object' ? r : {}; }

  /* ── Расчёт «сколько можно потратить» ── */
  function calc(now) {
    now = now || new Date();
    const ym = ymKey(now);
    const b = budget();
    /* период: календарный месяц или от зарплаты до зарплаты. Доход берём за месяц, в котором пришла зарплата */
    const P = payday(), per = period(now, P), incM = per.start;
    let inc = income(incM), est = false, estFrom = null;
    /* доходов в этом месяце ещё нет: берём последний месяц с доходом (до трёх назад) */
    if (!inc) for (let i = 1; i <= 3 && !inc; i++) { const p = new Date(incM.getFullYear(), incM.getMonth() - i, 1); const pi = income(p); if (pi) { inc = pi; est = true; estFrom = p.getMonth(); } }
    const save = Math.round(inc * b.savePct / 100);
    const items = listRange(per.start, per.end);
    const sp = {}; items.forEach(x => { const k = x.cat || '_other'; sp[k] = (sp[k] || 0) + x.amt; });
    const spent = Object.values(sp).reduce((s, v) => s + v, 0);
    /* план, который ещё предстоит оплатить: по каждой категории остаток плана */
    const planOf = {}; b.cats.forEach(c => { planOf[c.id] = Math.max(0, +c.amt || 0); });
    const planTotal = Object.values(planOf).reduce((s, v) => s + v, 0);
    const planLeft = b.cats.reduce((s, c) => s + Math.max(0, planOf[c.id] - (sp[c.id] || 0)), 0);
    const free = inc - save - planLeft - spent;
    const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dim = Math.round((per.end - per.start) / 864e5); /* дней в периоде */
    const daysLeft = Math.max(1, Math.round((per.end - t0) / 864e5));
    /* «свободные» траты сегодня: без категории или сверх плана категории (траты в рамках плана уже учтены выше) */
    const todayKey = now.toDateString();
    const todayBy = {}; items.filter(x => new Date(x.at).toDateString() === todayKey).forEach(x => { const k = x.cat && planOf[x.cat] != null ? x.cat : '_other'; todayBy[k] = (todayBy[k] || 0) + x.amt; });
    const todaySpent = Object.entries(todayBy).reduce((s, [k, v]) => s + (k === '_other' ? v : Math.min(v, Math.max(0, (sp[k] || 0) - planOf[k]))), 0);
    /* норма на день считается от свободного на утро: сегодняшние траты не уменьшают сегодняшнюю норму */
    const perDay = Math.max(0, Math.floor((free + todaySpent) / daysLeft));
    /* сколько ушло именно в плановые категории (для кольца в «Балансе») */
    const planSpent = b.cats.reduce((s, c) => s + (sp[c.id] || 0), 0);
    return { ym, P, start: per.start, end: per.end, items, inc, est, estFrom, save, savePct: b.savePct, planLeft, planTotal, planSpent, spent, free, daysLeft, dim, perDay, todaySpent, cats: b.cats, sp, demo: b.demo };
  }

  /* плановые платежи месяца: категории с днём оплаты, оплачено = потрачено ≥ плана */
  function payments(c, now) {
    now = now || new Date();
    const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = c.start || new Date(now.getFullYear(), now.getMonth(), 1);
    return c.cats.filter(x => +x.day >= 1 && +x.day <= 31).map(x => {
      /* дата платежа внутри периода: в месяце начала периода или в следующем */
      let date = dayIn(start.getFullYear(), start.getMonth(), Math.round(+x.day));
      if (date < start) date = dayIn(start.getFullYear(), start.getMonth() + 1, Math.round(+x.day));
      const amt = Math.max(0, +x.amt || 0), sp = c.sp[x.id] || 0;
      const paid = amt > 0 ? sp >= amt : sp > 0;
      const diff = Math.round((date - t0) / 864e5);
      return { id: x.id, name: x.name || 'Платёж', color: col(x.color), day: date.getDate(), date, amt, left: Math.max(0, amt - sp), paid, late: !paid && diff < 0, diff };
    }).sort((a, b) => (a.paid - b.paid) || (b.late - a.late) || (a.date - b.date));
  }

  /* ── Разбор строки ── */
  const KW = [
    [/кофе|кафе|ресторан|бар(?![а-яё])|бургер|пицц|суши|шаурм|обед|ужин|завтрак|доставк|вкусно и|макдон|kfc|кфс|старбакс|ролл/i, [/кафе|ресторан/i, /еда|питани/i]],
    [/продукт|магнит|пят[её]р|вкусвил|азбук|перекр[её]ст|ашан|лента|дикси|самокат|лавк|еда домой|супермаркет|овощ|фрукт/i, [/продукт/i, /еда|питани/i]],
    [/такси|метро|автобус|электрич|кикшер|каршер|тройк|проезд|трамва/i, [/такси|транспорт|проезд/i, /авто|машин/i]],
    [/бензин|азс|заправк|мойк|шиномон|сто(?![а-яё])|автосервис|парковк|штраф/i, [/автомоб|бензин|машин|авто/i, /транспорт/i]],
    [/аренд|ипотек|квартплат/i, [/аренд|ипотек|жиль/i]],
    [/жкх|коммунал|свет(?![а-яё])|газ(?![а-яё])|вода(?![а-яё])/i, [/коммунал|жкх/i, /жиль|аренд/i]],
    [/зал(?![а-яё])|фитнес|спорт|абонемент|тренер|бассейн|протеин/i, [/спорт|фитнес|здоров/i]],
    [/аптек|врач|клиник|анализ|стоматол|лекарств/i, [/медицин|аптек|здоров/i]],
    [/кино|театр|концерт|игр|steam|боулинг|хобби|развлеч/i, [/развлеч|хобби|отдых/i]],
    [/подписк|spotify|netflix|icloud|яндекс плюс|youtube|кинопоиск|chatgpt|claude/i, [/подписк|сервис/i]],
    [/одежд|обув|кроссовк|куртк|джинс|футболк|wildberries|вб(?![а-яё])|ozon|озон|ламода/i, [/одежд|обув|покупк/i]],
    [/барбер|стрижк|маникюр|космет|салон|уход/i, [/красот|уход/i]],
    [/связь|интернет|телефон|мобильн|сотов/i, [/телефон|интернет|связь/i]],
    [/подар/i, [/подар/i]],
  ];
  const SRC = [[/тинько|т-банк|тбанк|tinkoff/i, 'Т-Банк'], [/сбер/i, 'Сбер'], [/альфа/i, 'Альфа'], [/втб/i, 'ВТБ'], [/озон банк|ozon банк/i, 'Озон Банк'], [/налич|нал(?:ом|ик\S*)?(?![а-яё])|кэш|кеш/i, 'Наличные'], [/кредитк/i, 'Кредитка']];
  const STOP = new Set(['для', 'это', 'еще', 'ещё', 'все', 'всё', 'как', 'что', 'над', 'под', 'при', 'про', 'без']);
  const LET = /[a-zа-яё]/i;
  const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[.#$[\]/]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = (low) => low.split(/[^a-zа-я0-9]+/).filter(w => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
  const stem = (w) => w.length >= 5 ? w.slice(0, Math.max(4, w.length - 2)) : w;

  /* все суммы в строке: 420, 1 200, 1.500, 2,5к, 3k, 1.5 тыс, 420р, 2 млн */
  function amounts(raw) {
    const out = []; const re = /(\d{1,3}(?:[  .]\d{3})+(?!\d)|\d+)(?:[.,](\d{1,2})(?!\d))?/g; let m;
    while ((m = re.exec(raw))) {
      const st = m.index; let en = st + m[0].length;
      if (LET.test(raw[st - 1] || '')) continue; /* часть слова: iphone15 */
      let v = parseFloat(m[1].replace(/[  .]/g, '') + (m[2] ? '.' + m[2] : '')) || 0, unit = false, t;
      const tail = () => raw.slice(en);
      if ((t = tail().match(/^\s*млн\.?(?![а-яё])/i))) { v *= 1e6; en += t[0].length; unit = true; }
      else if ((t = tail().match(/^\s*(?:тыс(?:яч[аи]?|\.)?|т\.р\.?)(?![а-яё])/i))) { v *= 1000; en += t[0].length; unit = true; }
      /* «к» как тысячи только слитно («2,5к») или в самом конце: «500 к ужину» остаётся пятьюстами */
      else if ((t = tail().match(/^(?:[кk](?![a-zа-яё])|\s+[кk]\s*$)/i))) { v *= 1000; en += t[0].length; unit = true; }
      else if (LET.test(raw[en] || '') && !/^(?:р|₽|руб)/i.test(tail())) continue; /* «5шт», «3д» не сумма */
      if ((t = tail().match(/^\s*(?:₽|руб(?:л[а-яё]*|\.)?|р\.?)(?![а-яё])/i))) { en += t[0].length; unit = true; }
      out.push({ v: Math.round(v), st, en, unit });
      re.lastIndex = en;
    }
    return out;
  }
  /* сумма из поля «Сумма» в окне правки: те же форматы, что и в строке */
  function parseAmt(s) { const a = amounts(String(s || '').trim()); return a.length ? a.sort((x, y) => (y.unit - x.unit) || (y.v - x.v))[0].v : 0; }

  /* категория по выученным правилам: целая фраза, потом слово, потом основа слова */
  function ruleCat(low, cats) {
    const r = rules(); const has = (k) => k === '_other' || cats.some(c => c.id === k);
    if (r[low] && has(r[low])) return r[low];
    const ws = words(low);
    for (const w of ws) if (r[w] && has(r[w])) return r[w];
    const keys = Object.keys(r).filter(k => k.indexOf(' ') < 0);
    for (const w of ws) { const s = stem(w); const k = keys.find(k2 => stem(k2) === s && has(r[k2])); if (k) return r[k]; }
    return null;
  }
  /* запоминаем выбор пользователя: фраза целиком и первое значимое слово */
  function learn(note, key) {
    const low = norm(note); if (!low) return;
    const r = Object.assign({}, rules()); const k = key || '_other';
    r[low] = k; const w = words(low)[0]; if (w) r[w] = k;
    const ks = Object.keys(r); if (ks.length > 300) ks.slice(0, ks.length - 300).forEach(x => delete r[x]); /* не раздуваем базу */
    Store.set('finance.spendRules', r);
  }

  function parse(text, cats, forced) {
    const raw = String(text || '').trim().slice(0, 200);
    if (!raw) return null;
    cats = cats || budget().cats;
    const all = amounts(raw);
    /* несколько чисел: сначала с «₽/к/тыс», иначе самое большое («2 кофе 380» → 380) */
    const pick = all.slice().sort((a, b) => (b.unit - a.unit) || (b.v - a.v))[0];
    const amt = pick ? pick.v : 0;
    let rest = pick ? (raw.slice(0, pick.st) + ' ' + raw.slice(pick.en)) : raw;
    rest = rest.replace(/₽/g, ' ');
    let src = ''; SRC.forEach(([re, n]) => { if (!src && re.test(rest)) { src = n; rest = rest.replace(new RegExp('(^|\\s)(?:(?:с|со|через|по|картой|карта)\\s+)?(?:' + re.source + ')\\S*', 'i'), ' '); } });
    rest = rest.replace(/\s+/g, ' ').trim().replace(/^[\s,.;:!-]+|[\s,.;:-]+$/g, '').replace(/^(?:за|на|в|во)\s+/i, '').replace(/\s+(?:с|со|по|через|за|на|в)$/i, '').trim();
    /* категория: выбранная вручную → выученная → по названию своей категории → по ключевым словам */
    let cat = null, learned = false; const low = norm(rest);
    if (forced && cats.some(c => c.id === forced)) cat = cats.find(c => c.id === forced);
    if (!cat && low) { const k = ruleCat(low, cats); if (k) { learned = true; cat = k === '_other' ? null : cats.find(c => c.id === k); } }
    if (!cat && !learned && low) { const ws = words(low); cat = cats.find(c => c.name && norm(c.name).split(/[\s/(),.]+/).some(w => w.length > 3 && ws.some(t => t.startsWith(w.slice(0, Math.max(4, w.length - 2)))))); }
    if (!cat && !learned) for (const [re, alts] of KW) { if (re.test(low)) { for (const catRe of alts) { cat = cats.find(c => catRe.test(c.name)); if (cat) break; } if (cat) break; } }
    const note = rest ? rest[0].toUpperCase() + rest.slice(1) : (cat ? cat.name : 'Трата');
    const err = !amt ? 'noamt' : amt > MAX_AMT ? 'big' : null;
    return { amt, cat: cat ? cat.id : null, catName: cat ? cat.name : 'Другое', catColor: cat ? col(cat.color) : '#737373', note, src, learned, multi: all.length > 1, err };
  }

  /* ── Анимации ── */
  const prevW = {}; let prevFree = null;
  /* полоски и кольца плавно едут от прошлого значения к новому; при reduce-motion сразу */
  function animate(root, soft) {
    root.querySelectorAll('[data-w]').forEach(el => { const k = el.dataset.k; el.style.width = (reduced() ? +el.dataset.w : (soft && k && prevW[k] != null) ? prevW[k] : 0) + '%'; });
    root.querySelectorAll('[data-off]').forEach(el => { if (!reduced()) el.style.strokeDashoffset = el.dataset.full; else el.style.strokeDashoffset = el.dataset.off; });
    void root.offsetWidth; /* фиксируем старт, иначе браузер склеит кадры и перехода не будет */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.querySelectorAll('[data-w]').forEach(el => { el.style.width = el.dataset.w + '%'; if (el.dataset.k) prevW[el.dataset.k] = +el.dataset.w; });
      root.querySelectorAll('[data-off]').forEach(el => { el.style.strokeDashoffset = el.dataset.off; });
    }));
  }
  /* большая цифра «докручивается» до нового значения */
  function countUp(el, from, to) {
    if (!el) return;
    if (reduced() || from === to || !isFinite(from)) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 700;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1 && el.isConnected) requestAnimationFrame(step); };
    el.textContent = fmt(from); requestAnimationFrame(step);
  }

  /* ── Вид ── */
  /* чипы разбора строки: ключ нужен, чтобы анимировать только то, что поменялось */
  function chipList(p) {
    if (!p) return [];
    const out = [{ k: 'kind', h: '<span class="sp-chip"><i class="ti ti-arrow-up-right"></i>Расход</span>' }];
    out.push({ k: 'amt', h: `<span class="sp-chip ${p.err ? 'warn' : 'on'}">${p.err === 'noamt' ? 'сумма?' : p.err === 'big' ? 'слишком много' : fmt(p.amt)}</span>` });
    out.push({ k: 'cat', h: `<span class="sp-chip${p.learned ? ' ai' : ''}" style="--c:${p.catColor}"${p.learned ? ' title="Запомнил по прошлому разу"' : ''}>${p.learned ? '<i class="ti ti-sparkles"></i>' : '<i class="sp-dot"></i>'}${esc(p.catName)}</span>` });
    if (p.src) out.push({ k: 'src', h: `<span class="sp-chip"><i class="ti ti-credit-card"></i>${esc(p.src)}</span>` });
    return out;
  }
  /* обновляем чипы без мигания: старые одинаковые остаются на месте, новые проявляются */
  function setChips(box, items, warn) {
    const old = {}; box.querySelectorAll('[data-k]').forEach(e => { old[e.dataset.k] = e; });
    if (warn) items = items.concat([{ k: 'warn', h: `<span class="sp-hint warn">${esc(warn)}</span>` }]);
    const nodes = items.map(it => {
      const o = old[it.k]; if (o && o.dataset.h === it.h) return o;
      const t = document.createElement('template'); t.innerHTML = it.h.trim(); const n = t.content.firstElementChild;
      n.dataset.k = it.k; n.dataset.h = it.h; n.classList.add('sp-in'); return n;
    });
    box.replaceChildren(...nodes);
  }
  const dayLabel = (d) => { const t = new Date(); t.setHours(0, 0, 0, 0); const dd = new Date(d); dd.setHours(0, 0, 0, 0); const diff = Math.round((t - dd) / 864e5); return diff === 0 ? 'Сегодня' : diff === 1 ? 'Вчера' : DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MON_GEN[d.getMonth()]; };
  /* подпись платежа: «5 октября · через 3 дня» */
  function payWhen(p, now) {
    const d = p.date.getDate() + ' ' + MON_GEN[p.date.getMonth()];
    if (p.paid) return d;
    if (p.late) return d + ' · не оплачено';
    return d + ' · ' + (p.diff === 0 ? 'сегодня' : p.diff === 1 ? 'завтра' : 'через ' + p.diff + ' ' + plural(p.diff, ['день', 'дня', 'дней']));
  }
  let showAll = false, lastCommit = { sig: '', t: 0 }, soft = false;

  function render(content, rerenderOuter) {
    /* перерисовка после записи/правки «мягкая»: без вылета карточек, цифры едут от прошлых значений */
    const first = !soft; soft = false;
    const rerender = () => { soft = true; rerenderOuter(); };
    const now = new Date();
    const c = calc(now);
    const items = c.items.slice().sort((a, b) => b.at - a.at);
    const catById = {}; c.cats.forEach(x => { catById[x.id] = x; });
    /* последний день периода: конец месяца или день перед зарплатой */
    const monthEnd = new Date(c.end.getFullYear(), c.end.getMonth(), c.end.getDate() - 1);
    const dm = (d) => d.getDate() + ' ' + MON_GEN[d.getMonth()];
    const pctToday = c.perDay > 0 ? Math.min(100, Math.round(c.todaySpent / c.perDay * 100)) : (c.todaySpent > 0 ? 100 : 0);
    /* шкала периода: где мы сейчас */
    const pos = (d) => Math.max(0, Math.min(100, Math.round(Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - c.start) / 864e5) / Math.max(1, c.dim - 1) * 1000) / 10));
    const monthPos = pos(now);
    const pays = payments(c, now);
    const payLeft = pays.reduce((s, p) => s + (p.paid ? 0 : p.left), 0);
    const shown = showAll ? items : items.slice(0, 40);
    const groups = [];
    shown.forEach(x => { const d = new Date(x.at); const k = d.toDateString(); let g = groups.find(z => z.k === k); if (!g) { g = { k, d, items: [] }; groups.push(g); } g.items.push(x); });
    const noInc = !c.inc;
    const bigTxt = (c.est ? '≈ ' : '') + fmt(noInc ? 0 : c.free);

    content.classList.toggle('sp-first', first);
    content.innerHTML = `
      <div class="sp-card sp-hero">
        <div class="sp-hero-top">
          <div class="sp-hero-m">
            <button class="sp-lbl sp-per" id="sp-per">${c.P ? 'До зарплаты ' + dm(c.end) : 'Свободно до ' + dm(monthEnd)}<i class="ti ti-chevron-down"></i></button>
            <div class="sp-big${!noInc && c.free < 0 ? ' neg' : ''}${noInc ? ' mute' : ''}${bigTxt.length > 11 ? ' long' : ''}">${c.est ? '<small>≈</small>' : ''}<span id="sp-num">${fmt(noInc ? 0 : c.free)}</span></div>
          </div>
          <button class="sp-help" id="sp-help" aria-label="Подсказки"><i class="ti ti-help"></i></button>
        </div>
        ${noInc ? '<button class="sp-cta" id="sp-to-month"><i class="ti ti-plus"></i>Добавь доход месяца</button>' : ''}
        <div class="sp-track">
          <span class="sp-track-fill" data-k="track" data-w="${monthPos}"></span>
          ${pays.map(p => `<i class="sp-mark${p.paid ? ' paid' : ''}${p.late ? ' late' : ''}" style="left:${pos(p.date)}%;--c:${p.color}" title="${esc(p.name)}, ${dm(p.date)}"></i>`).join('')}
          <i class="sp-track-now" style="left:${monthPos}%"></i>
        </div>
        <div class="sp-track-l"><span style="${monthPos < 30 ? 'visibility:hidden' : ''}">${dm(c.start)}</span><span class="sp-track-t" style="left:${Math.min(85, Math.max(15, monthPos))}%">сегодня, ${now.getDate()}</span><span style="${monthPos > 70 ? 'visibility:hidden' : ''}">${dm(monthEnd)}</span></div>
        ${noInc ? '' : `<div class="sp-today">
          <div class="sp-today-h"><span>Сегодня</span><b>${fmt(c.todaySpent)} <em>из ${fmt(c.perDay)}</em></b></div>
          <div class="sp-bar"><span data-k="today" data-w="${pctToday}" class="${c.todaySpent > c.perDay ? 'over' : ''}"></span></div>
        </div>`}
        <details class="sp-how"><summary>Как рассчитано <i class="ti ti-chevron-down"></i></summary>
          <div class="sp-how-r"><span>${c.est ? 'Доход (как в ' + MON_PREP[c.estFrom] + ')' : c.P ? 'Доход за ' + MON_NOM[c.start.getMonth()] : 'Доход за месяц'}</span><b>${fmt(c.inc)}</b></div>
          <div class="sp-how-r"><span>В копилку, ${c.savePct}%</span><b>−${fmt(c.save)}</b></div>
          <div class="sp-how-r"><span>План по категориям, ещё не потрачено</span><b>−${fmt(c.planLeft)}</b></div>
          <div class="sp-how-r"><span>${c.P ? 'Уже потрачено с ' + dm(c.start) : 'Уже потрачено в этом месяце'}</span><b>−${fmt(c.spent)}</b></div>
          <div class="sp-how-r sp-how-t"><span>Свободно</span><b>${fmt(c.free)}</b></div>
          <div class="sp-how-r"><span>Осталось дней, с сегодняшним</span><b>${c.daysLeft}</b></div>
        </details>
      </div>

      ${pays.length ? `<div class="sp-card sp-pay">
        <div class="sp-sec-h">Ближайшие платежи${payLeft ? `<b>ещё ${fmt(payLeft)}</b>` : '<b class="ok">всё оплачено</b>'}</div>
        ${pays.slice(0, 3).map(p => `<button class="sp-pay-r${p.paid ? ' paid' : ''}${p.late ? ' late' : ''}" data-cat="${esc(p.id)}" data-left="${p.left}">
          <i class="sp-cal" style="--c:${p.color}">${p.day}</i>
          <span class="sp-row-m"><b>${esc(p.name)}</b><em>${esc(payWhen(p, now))}</em></span>
          <span class="sp-row-a">${p.paid ? '<span class="sp-paid"><i class="ti ti-check"></i>оплачено</span>' : fmt(p.left)}</span></button>`).join('')}
      </div>` : ''}

      <div class="sp-card sp-add">
        <div class="sp-add-row">
          <input id="sp-in" type="text" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" maxlength="200" placeholder="Кофе 420 с Тинькофф">
          <button id="sp-ok" aria-label="Записать"><i class="ti ti-check"></i></button>
        </div>
        <div class="sp-chips" id="sp-chips"></div>
      </div>

      <div class="sp-card sp-list">
        <div class="sp-list-h">${c.P ? 'Траты с ' + dm(c.start) : 'Траты за ' + MON_NOM[now.getMonth()]}<b>${fmt(c.spent)}</b></div>
        ${groups.length ? groups.map(g => `<div class="sp-day">${dayLabel(g.d)}<span>${fmt(g.items.reduce((s, x) => s + x.amt, 0))}</span></div>
          ${g.items.map(x => { const ct = catById[x.cat]; return `<button class="sp-row" data-id="${esc(x.id)}" data-ym="${esc(x.ym)}">
            <i class="sp-ico" style="--c:${ct ? col(ct.color) : '#737373'}">${esc((String(x.note || '?').trim()[0] || '?').toUpperCase())}</i>
            <span class="sp-row-m"><b>${esc(x.note || 'Трата')}</b><em>${esc(ct ? ct.name : 'Другое')}${x.src ? ' · ' + esc(x.src) : ''}</em></span>
            <span class="sp-row-a">−${fmt(x.amt)}</span></button>`; }).join('')}`).join('')
          + (items.length > shown.length ? `<button class="sp-more" id="sp-more">Показать все ${items.length}</button>` : '')
          : `<div class="sp-empty"><i class="ti ti-receipt"></i>${c.P ? 'Трат с зарплаты пока нет' : 'Трат в этом месяце пока нет'}</div>`}
      </div>`;

    const inp = content.querySelector('#sp-in'), chips = content.querySelector('#sp-chips');
    /* кнопка видна только когда что-то написано: на телефоне хватает Enter/«Готово» на клавиатуре */
    const row = content.querySelector('.sp-add-row');
    const syncBtn = () => { if (row && inp) row.classList.toggle('has-text', !!inp.value.trim()); };
    if (inp) { inp.addEventListener('input', syncBtn); syncBtn(); }
    const cats = c.cats;
    /* живой разбор строки; ручной выбор категории из «платежей» сбрасывается, если стёрли название */
    const refresh = (warn) => { const p = parse(inp.value, cats, inp.dataset.cat); setChips(chips, chipList(p), warn != null ? warn : (p && p.multi && !p.err ? 'Взял ' + fmt(p.amt) + ', остальные числа оставил в названии' : '')); };
    inp.addEventListener('input', () => { if (inp.dataset.cat && !inp.value.trim()) delete inp.dataset.cat; refresh(); });
    const commit = () => {
      const p = parse(inp.value, cats, inp.dataset.cat);
      if (!p) { inp.focus(); return; }
      if (p.err) { inp.focus(); refresh(p.err === 'big' ? 'Больше 100 млн за раз? Проверь сумму' : 'Добавь сумму, например «кофе 420»'); return; }
      /* защита от двойного Enter/клика: та же строка второй раз за секунду не записывается */
      const sig = inp.value.trim().toLowerCase();
      if (sig === lastCommit.sig && Date.now() - lastCommit.t < 1000) return;
      lastCommit = { sig, t: Date.now() };
      const at = Date.now(), ym = ymKey(new Date(at)); /* месяц берём в момент записи, а не отрисовки */
      const rec = { id: uid('s'), amt: p.amt, cat: p.cat, note: p.note, src: p.src || '', at };
      const arr = list(ym); arr.push(rec); saveList(ym, arr);
      rerender();
      toast(`Записал ${fmt(p.amt)} · ${p.catName}`, () => { saveList(ym, list(ym).filter(x => x.id !== rec.id)); rerender(); });
      const ni = document.querySelector('#sp-in'); if (ni) ni.focus({ preventScroll: true });
    };
    content.querySelector('#sp-ok').addEventListener('click', commit);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); if (!e.repeat) commit(); } });
    const hb = content.querySelector('#sp-help'); if (hb) hb.onclick = () => { if (window.Tour && Tour.play) Tour.play(TIPS.filter(t => document.querySelector(t.sel)), 'tab:finance.expenses'); };
    const tm = content.querySelector('#sp-to-month'); if (tm) tm.onclick = () => { const t = document.querySelector('.tochka-tab[data-tab="month"]'); if (t) t.click(); };
    const more = content.querySelector('#sp-more'); if (more) more.onclick = () => { showAll = true; rerender(); };
    /* платёж из списка: подставляем строку с суммой остатка, Enter запишет его в нужную категорию */
    content.querySelectorAll('.sp-pay-r').forEach(b => b.addEventListener('click', () => {
      const ct = catById[b.dataset.cat]; if (!ct) return;
      if (b.classList.contains('paid')) { catModal(ct.id, rerender); return; }
      const short = String(ct.name || '').split(/\s*[/(,]\s*/)[0].trim() || 'Платёж';
      inp.value = short + ' ' + (+b.dataset.left || ''); inp.dataset.cat = ct.id; refresh(); syncBtn(); inp.focus();
      inp.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
    }));
    content.querySelectorAll('.sp-row').forEach(b => b.addEventListener('click', () => editModal(b.dataset.ym || c.ym, b.dataset.id, cats, rerender)));
    const pb = content.querySelector('#sp-per'); if (pb) pb.onclick = () => periodModal(rerender);

    animate(content, !first);
    const to = noInc ? 0 : c.free;
    countUp(content.querySelector('#sp-num'), first || prevFree == null ? 0 : prevFree, to);
    prevFree = to;
  }

  /* подсказки вместо описаний на экране: по кнопке «?» и один раз при первом входе (Tour) */
  const TIPS = [
    { sel: '.sp-per', t: 'До конца месяца или до зарплаты', d: 'Нажми, чтобы выбрать: считать до конца месяца или до зарплаты N-го числа. До зарплаты: период от прошлой зарплаты до следующей, доход берётся за месяц, в котором пришла зарплата, траты и платежи за этот период.' },
    { sel: '.sp-big', t: 'Свободно до конца месяца', d: 'Доход месяца минус копилка, минус план по категориям, который ещё не потрачен, минус уже потраченное. Если доходов в этом месяце пока нет, считаю от последнего месяца с доходом, тогда стоит знак ≈. Красная цифра: план и траты уже больше дохода, урежь план в «Балансе» или добавь доход.' },
    { sel: '.sp-track', t: 'Месяц', d: 'Белая точка: где ты сейчас. Цветные точки: плановые платежи (день оплаты задаётся у категории во вкладке «Баланс»). Тусклая точка уже оплачена, красная просрочена.' },
    { sel: '.sp-today', t: 'Сегодня', d: 'Норма на день: свободные деньги делим на оставшиеся дни. Сюда идут траты без категории и сверх плана. Покупки в рамках плана (продукты и т.п.) норму не съедают. Перебрал сегодня, завтра норма станет чуть меньше.' },
    { sel: '.sp-how', t: 'Как рассчитано', d: 'Раскрой, чтобы увидеть всю арифметику. Категории и процент копилки настраиваются во вкладке «Баланс».' },
    { sel: '.sp-pay', t: 'Ближайшие платежи', d: 'Категории с днём оплаты. Платёж считается оплаченным, когда траты в категории дошли до плана. Нажми на платёж, и строка для записи заполнится сама, останется нажать Enter.' },
    { sel: '#sp-in', t: 'Запись одной строкой', d: 'Пиши как есть: «кофе 420», «такси 350 тинькофф», «продукты 2,3к», «аренда 30 тыс». Ниже сразу видно, как разберётся: сумма, категория, карта. Enter, и готово. Ошибся, жми «Отменить».' },
    { sel: '#sp-chips, #sp-in', t: 'Я запоминаю категории', d: 'Если поменяешь категорию у траты, я запомню. В следующий раз такая же строка сама попадёт куда надо, в подсказке у категории появится значок со звёздочками.' },
    { sel: '.sp-row, .sp-empty', t: 'Траты', d: 'Нажми на трату, чтобы поменять сумму, категорию или дату (например, если забыл записать вчера) либо удалить.' },
  ];

  /* снимок месяцев до изменения: на нём держится «Отменить» */
  function snapshot(yms) { const s = {}; yms.forEach(y => { s[y] = list(y); }); return () => Object.keys(s).forEach(y => saveList(y, s[y])); }
  const isoDay = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  /* правка или удаление записи, в том числе перенос на другой день (и месяц) */
  function editModal(ym, id, cats, rerender) {
    const arr = list(ym); const x = arr.find(z => z.id === id); if (!x) return;
    const d0 = new Date(x.at), t = new Date(); t.setHours(0, 0, 0, 0);
    const dd = new Date(d0); dd.setHours(0, 0, 0, 0); const ago = Math.round((t - dd) / 864e5);
    const known = cats.some(ct => ct.id === x.cat);
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay modal-finance';
    ov.innerHTML = `<div class="tr-modal sp-edit" role="dialog" aria-label="Трата">
      <p class="tr-modal-title">Трата</p>
      <div class="tr-modal-row"><label style="flex:1 1 100%">Что<input type="text" id="se-n" maxlength="120" value="${esc(x.note || '')}"></label></div>
      <div class="tr-modal-row"><label style="flex:1">Сумма, ₽<input type="text" inputmode="decimal" id="se-a" value="${x.amt}"></label>
        <label style="flex:1">Карта<input type="text" id="se-s" maxlength="40" placeholder="Не указана" value="${esc(x.src || '')}"></label></div>
      <div class="tr-modal-row"><label style="flex:1 1 100%">Категория<select id="se-c"><option value="">Другое</option>${cats.map(ct => `<option value="${esc(ct.id)}"${ct.id === x.cat ? ' selected' : ''}>${esc(ct.name)}</option>`).join('')}</select></label></div>
      <div class="sp-seg-l">Дата</div>
      <div class="sp-seg" id="se-d"><button type="button" data-d="0" class="${ago === 0 ? 'on' : ''}">Сегодня</button><button type="button" data-d="1" class="${ago === 1 ? 'on' : ''}">Вчера</button><button type="button" data-d="pick" class="${ago > 1 || ago < 0 ? 'on' : ''}">${ago > 1 || ago < 0 ? d0.getDate() + ' ' + MON_GEN[d0.getMonth()] : 'Другая'}</button></div>
      <div class="tr-modal-row" id="se-dt-row" style="${ago > 1 || ago < 0 ? '' : 'display:none'}"><label style="flex:1 1 100%">День<input type="date" id="se-dt" max="${isoDay(new Date())}" value="${isoDay(d0)}"></label></div>
      <div class="sp-err" id="se-err"></div>
      <div class="tr-modal-actions"><button class="tr-modal-btn-secondary" id="se-del" style="color:#EF4444;">Удалить</button><button class="tr-modal-btn-primary" id="se-ok">Сохранить</button></div></div>`;
    document.body.appendChild(ov);
    const $ = (s) => ov.querySelector(s);
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    let mode = ago === 0 ? '0' : ago === 1 ? '1' : 'pick';
    $('#se-d').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; mode = b.dataset.d;
      $('#se-d').querySelectorAll('button').forEach(z => z.classList.toggle('on', z === b));
      $('#se-dt-row').style.display = mode === 'pick' ? '' : 'none';
      if (mode === 'pick') { const di = $('#se-dt'); di.focus(); try { di.showPicker && di.showPicker(); } catch (er) {} }
    });
    const selCat0 = $('#se-c').value;
    $('#se-del').onclick = () => {
      const undo = snapshot([ym]);
      saveList(ym, list(ym).filter(z => z.id !== id)); close(); rerender();
      toast(`Удалил ${fmt(x.amt)}`, () => { undo(); rerender(); });
    };
    $('#se-ok').onclick = () => {
      const err = (m) => { $('#se-err').textContent = m; };
      const amt = parseAmt($('#se-a').value);
      if (!amt) return err('Укажи сумму, например 420');
      if (amt > MAX_AMT) return err('Сумма больше 100 млн, проверь');
      /* дата: сохраняем время суток, меняем только день */
      let day;
      if (mode === 'pick') { const v = $('#se-dt').value; if (!v) return err('Выбери день'); const [yy, mm, dn] = v.split('-').map(Number); day = new Date(yy, mm - 1, dn); }
      else { day = new Date(); day.setDate(day.getDate() - +mode); }
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), d0.getHours(), d0.getMinutes(), d0.getSeconds()).getTime();
      if (day.getTime() > t.getTime() + 864e5 - 1) return err('Будущую дату поставить нельзя');
      const sel = $('#se-c').value;
      const catChanged = sel !== selCat0;
      const note = $('#se-n').value.trim().slice(0, 120) || x.note || 'Трата';
      const rec = Object.assign({}, x, { note, amt, src: $('#se-s').value.trim().slice(0, 40), at: Math.min(at, Date.now()), cat: catChanged ? (sel || null) : (known ? sel || null : x.cat) });
      const ym2 = ymKey(new Date(rec.at));
      const undo = snapshot(ym2 === ym ? [ym] : [ym, ym2]);
      if (catChanged) learn(note, sel || '_other'); /* учимся только на ручной смене категории */
      if (ym2 === ym) saveList(ym, list(ym).map(z => z.id === id ? rec : z));
      else { saveList(ym, list(ym).filter(z => z.id !== id)); const a2 = list(ym2); a2.push(rec); saveList(ym2, a2); }
      close(); rerender();
      const cn = (cats.find(ct => ct.id === rec.cat) || {}).name || 'Другое';
      toast(ym2 !== ym ? `Перенёс в ${MON_NOM[new Date(rec.at).getMonth()]}` : catChanged ? `Запомнил: «${note}» → ${cn}` : 'Сохранил', () => { undo(); rerender(); });
    };
  }

  /* ── Категория: название, план, цвет, день платежа (общий блок для «Баланса» и «Расходов») ── */
  function catRowHtml(c, spent) {
    const day = +c.day >= 1 && +c.day <= 31 ? Math.round(+c.day) : '';
    return `<div class="ce-row" data-id="${esc(c.id)}" data-spent="${spent || 0}">
      <div class="ce-top"><button type="button" class="ce-sw" style="--c:${col(c.color)}" aria-label="Цвет"></button>
        <input type="text" class="ce-name" maxlength="60" value="${esc(c.name || '')}" placeholder="Название">
        <button type="button" class="ce-del" aria-label="Удалить категорию"><i class="ti ti-trash"></i></button></div>
      <div class="ce-pal" hidden>${PALETTE.map(p => `<button type="button" data-c="${p}" style="--c:${p}" class="${p.toLowerCase() === col(c.color).toLowerCase() ? 'on' : ''}" aria-label="${p}"></button>`).join('')}</div>
      <div class="ce-bot"><label>План, ₽<input type="text" class="ce-amt" inputmode="numeric" value="${+c.amt || 0}"></label>
        <label>День платежа<select class="ce-day"><option value="">Без даты</option>${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}"${day === i + 1 ? ' selected' : ''}>${i + 1} числа</option>`).join('')}</select></label></div>
    </div>`;
  }
  /* палитра и удаление в строках категорий; удаление с тратами спрашивает подтверждение */
  function bindCatRows(box) {
    box.addEventListener('click', e => {
      const sw = e.target.closest('.ce-sw'); const row = e.target.closest('.ce-row'); if (!row) return;
      if (sw) { const p = row.querySelector('.ce-pal'); p.hidden = !p.hidden; return; }
      const pc = e.target.closest('.ce-pal button');
      if (pc) { row.querySelector('.ce-sw').style.setProperty('--c', pc.dataset.c); row.dataset.color = pc.dataset.c; row.querySelectorAll('.ce-pal button').forEach(b => b.classList.toggle('on', b === pc)); row.querySelector('.ce-pal').hidden = true; return; }
      if (e.target.closest('.ce-del')) {
        const sp = +row.dataset.spent || 0;
        if (sp > 0 && !confirm(`В этой категории уже ${fmt(sp)} трат за месяц. Удалить категорию? Траты останутся и будут в «Другое».`)) return;
        row.remove();
      }
    });
  }
  /* собираем категории из строк окна; старые поля (spent и др.) сохраняем */
  function readCatRows(box, base) {
    const byId = {}; (base || []).forEach(c => { byId[c.id] = c; });
    return Array.from(box.querySelectorAll('.ce-row')).map(r => {
      const old = byId[r.dataset.id] || {};
      const c = Object.assign({}, old, { id: r.dataset.id, name: r.querySelector('.ce-name').value.trim().slice(0, 60) || old.name || 'Категория', amt: parseAmt(r.querySelector('.ce-amt').value), color: col(r.dataset.color || old.color) });
      const d = +r.querySelector('.ce-day').value; if (d >= 1 && d <= 31) c.day = d; else delete c.day;
      return c;
    });
  }
  /* записываем категории в «Баланс», не трогая цель дохода и копилку */
  function saveCats(cats) {
    const st = (Store.get().finance || {}).balance || {};
    Store.set('finance.balance', Object.assign({}, st, { categories: cats.map(c => JSON.parse(JSON.stringify(c))), demoOff: true }));
  }
  /* окно одной категории: нажатие на категорию в «Балансе» или на оплаченный платёж */
  function catModal(id, onDone) {
    const b = budget(); const c = b.cats.find(x => x.id === id); if (!c) return;
    const sp = catSpent(ymKey(new Date()))[id] || 0;
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay modal-finance';
    ov.innerHTML = `<div class="tr-modal sp-edit"><p class="tr-modal-title">Категория</p><div id="ce-box">${catRowHtml(c, sp)}</div>
      <div class="tr-modal-actions"><button class="tr-modal-btn-secondary" id="ce-cancel">Отмена</button><button class="tr-modal-btn-primary" id="ce-ok">Сохранить</button></div></div>`;
    document.body.appendChild(ov);
    const box = ov.querySelector('#ce-box'); bindCatRows(box);
    const close = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelector('#ce-cancel').onclick = close;
    ov.querySelector('#ce-ok').onclick = () => {
      const edited = readCatRows(box, b.cats); /* строка удалена → категории нет */
      saveCats(b.cats.map(x => x.id === id ? edited[0] : x).filter(Boolean));
      close(); if (onDone) onDone();
    };
  }

  /* до конца месяца или до зарплаты N-го числа */
  function periodModal(onDone) {
    const P = payday();
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay modal-finance';
    ov.innerHTML = `<div class="tr-modal sp-edit" role="dialog" aria-label="Период"><p class="tr-modal-title">Считать свободные деньги</p>
      <div class="sp-seg" id="pd-seg"><button type="button" data-v="month" class="${P ? '' : 'on'}">До конца месяца</button><button type="button" data-v="pay" class="${P ? 'on' : ''}">До зарплаты</button></div>
      <div class="tr-modal-row" id="pd-row" style="margin-top:12px;${P ? '' : 'display:none'}"><label style="flex:1 1 100%">Зарплата приходит<select id="pd-day">${Array.from({ length: 30 }, (_, i) => `<option value="${i + 2}"${(P || 10) === i + 2 ? ' selected' : ''}>${i + 2} числа</option>`).join('')}</select></label></div>
      <div class="tr-modal-actions"><button class="tr-modal-btn-secondary" id="pd-cancel">Отмена</button><button class="tr-modal-btn-primary" id="pd-ok">Сохранить</button></div></div>`;
    document.body.appendChild(ov);
    const $ = (q) => ov.querySelector(q);
    let mode = P ? 'pay' : 'month';
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    $('#pd-seg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.v;
      $('#pd-seg').querySelectorAll('button').forEach(z => z.classList.toggle('on', z === b)); $('#pd-row').style.display = mode === 'pay' ? '' : 'none'; });
    $('#pd-cancel').onclick = close;
    $('#pd-ok').onclick = () => {
      const d = mode === 'pay' ? +$('#pd-day').value : 0;
      Store.set('finance.payday', d >= 2 && d <= 31 ? d : null);
      close(); if (onDone) onDone();
      toast(d ? 'Считаю до зарплаты ' + d + ' числа' : 'Считаю до конца месяца');
    };
  }

  function toast(text, undo) {
    document.querySelectorAll('.sp-toast').forEach(t => t.remove());
    const t = document.createElement('div'); t.className = 'sp-toast'; t.setAttribute('role', 'status');
    t.innerHTML = `<i class="ti ti-circle-check"></i><span>${esc(text)}</span>${undo ? '<button>Отменить</button>' : ''}`;
    document.body.appendChild(t);
    let used = false; /* «Отменить» срабатывает один раз */
    if (undo) t.querySelector('button').onclick = () => { if (used) return; used = true; undo(); t.remove(); };
    setTimeout(() => t.classList.add('out'), 4200); setTimeout(() => t.remove(), 4600);
  }

  return { render, calc, catSpent, parse, parseAmt, payments, ymKey, catKey, budget, learn, animate, countUp, catModal, catRowHtml, bindCatRows, readCatRows, saveCats, esc, col, PALETTE, TIPS };
})();
