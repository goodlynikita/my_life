/* ============================================================
   ПЕРЕКЛЮЧАТЕЛЬ ДИЗАЙНА: Минимализм / Winter Arc
   Winter Arc пока в разработке. По нажатию:
   1) главный экран «сдувает» ветром со снегом,
   2) чёрный экран и видео со звуком,
   3) после видео плашка «в разработке», всё возвращается обратно.
   ============================================================ */
window.WinterArc = (function () {
  const SRC = 'img/winterarc.mp4';
  let busy = false;
  /* выбранный дизайн хранится на устройстве; Winter Arc пока только владельцу (Ник отложил выход), остальным заставка «в разработке» */
  const RELEASE = '2099-01-01';
  const isOwner = () => { try { const u = window.FirebaseSync && FirebaseSync.currentUser && FirebaseSync.currentUser(); const o = (window.AUTH_CONFIG || {}).ownerEmail; return !!(u && o && (u.email || '').toLowerCase() === o.toLowerCase()); } catch (e) { return false; } };
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const available = () => isOwner() || today() >= RELEASE;
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; };
  const isOn = () => ls('you_design') === 'wa' && available();
  /* шрифт для заголовков и цифр Winter Arc: грузим только когда дизайн включён */
  function loadFont() { if (document.getElementById('wa-font')) return; const l = document.createElement('link'); l.id = 'wa-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Unbounded:wght@300;500;700;800&display=swap'; document.head.appendChild(l); }
  function applyAttr() { if (isOn()) { document.documentElement.dataset.design = 'wa'; loadFont(); } else delete document.documentElement.dataset.design; }
  applyAttr();
  /* Главная Winter Arc тёмная; разделы используют выбранную тему. */
  function keepDark() {
    const h = document.documentElement, home = !h.dataset.sec || h.dataset.sec === 'home';
    const mode = isOn() && home ? 'dark' : window.Theme ? Theme.get() : h.getAttribute('data-theme');
    if (mode && h.getAttribute('data-theme') !== mode) h.setAttribute('data-theme', mode);
  }
  try { new MutationObserver(keepDark).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-design', 'data-sec'] }); } catch (e) {}
  keepDark();
  function setDesign(on) { ls('you_design', on ? 'wa' : null); applyAttr(); if (typeof Router !== 'undefined') { window.__keepUi = true; try { Router.render({ keepScroll: true }); } finally { window.__keepUi = false; } } }

  function html() {
    return '<div class="ds-sw" id="ds-sw" role="tablist" aria-label="Дизайн">'
      + '<button class="ds-b' + (isOn() ? '' : ' on') + '" data-ds="min" aria-label="Минимализм"><i class="ti ti-square-rounded"></i><span>Минимал</span></button>'
      + '<button class="ds-b' + (isOn() ? ' on' : '') + '" data-ds="wa" aria-label="Winter Arc"><i class="ti ti-snowflake"></i><span>Winter Arc</span></button>'
      + '</div>';
  }

  function bind(root) {
    const sw = root.querySelector('#ds-sw'); if (!sw) return;
    sw.querySelector('[data-ds="wa"]').addEventListener('click', (e) => { e.stopPropagation(); if (isOn()) return;
      /* первый раз: видео-заставка, дальше просто переключаем */
      if (available() && ls('you_wa_intro')) { setDesign(true); return; } start(sw); });
    sw.querySelector('[data-ds="min"]').addEventListener('click', (e) => { e.stopPropagation(); if (isOn()) setDesign(false); });
  }

  /* элементы главного экрана, которые улетают */
  function targets() {
    const s = document.querySelector('.home2-screen') || document.querySelector('#appv'); if (!s) return [];
    const list = [...s.querySelectorAll('.home2-header > *, .hdr-in > *, .hero-slider, .hub-attn, .home2-tile')];
    return list.filter(el => el.getBoundingClientRect().height > 0);
  }

  /* храним только свои анимации: CSS-анимации плиток не трогаем */
  const MINE = new WeakMap();
  function blowAway(els) {
    return Promise.all(els.map((el, i) => {
      const r = el.getBoundingClientRect();
      const dx = innerWidth - r.left + 80 + Math.random() * 120, dy = -60 - Math.random() * 160;
      const rot = 25 + Math.random() * 50;
      const a = el.animate([
        { transform: 'none', opacity: 1, filter: 'blur(0)' },
        { transform: `translate(${dx * 0.12}px, ${dy * 0.1}px) rotate(${rot * 0.15}deg)`, opacity: 1, filter: 'blur(0)', offset: 0.25 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(.7)`, opacity: 0, filter: 'blur(6px)' },
      ], { duration: 850, delay: i * 70, easing: 'cubic-bezier(.55,0,.8,.3)', fill: 'forwards' });
      MINE.set(el, [a]);
      return a.finished.catch(() => {});
    }));
  }
  function comeBack(els) {
    return Promise.all(els.map((el, i) => {
      (MINE.get(el) || []).forEach(a => { try { a.cancel(); } catch (e) {} });
      const from = `translate(${-innerWidth}px, -40px) rotate(-20deg) scale(.8)`;
      const a = el.animate([
        { transform: from, opacity: 0, filter: 'blur(6px)' },
        { transform: 'none', opacity: 1, filter: 'blur(0)' },
      ], { duration: 700, delay: i * 60, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'none' });
      MINE.set(el, [a]);
      /* до старта держим спрятанным, после конца полностью убираем анимацию */
      el.style.opacity = '0';
      setTimeout(() => { el.style.opacity = ''; }, i * 60 + 16);
      return a.finished.catch(() => {}).then(() => { try { a.cancel(); } catch (e) {} el.style.opacity = ''; el.style.transform = ''; el.style.filter = ''; });
    }));
  }

  function start(sw) {
    if (busy) return; busy = true;
    const setSw = (m) => sw && sw.querySelectorAll('.ds-b').forEach(b => b.classList.toggle('on', b.dataset.ds === m));
    setSw('wa');

    /* видео создаём прямо в нажатии: так браузер разрешит звук */
    const ov = document.createElement('div'); ov.className = 'wa-ov no-invert';
    ov.innerHTML = `<video playsinline preload="auto" poster="img/winterarc.jpg"></video>
      <div class="wa-load"><i class="ti ti-snowflake"></i></div>
      <button class="wa-skip">Пропустить <i class="ti ti-player-skip-forward"></i></button>
      <button class="wa-sound hidden"><i class="ti ti-volume"></i> Включить звук</button>`;
    document.body.appendChild(ov);
    /* запускаем прямо в нажатии, но без звука: так браузер потом разрешит включить звук,
       а раньше времени ничего не слышно */
    const v = ov.querySelector('video'); v.src = SRC; v.muted = true; v.volume = 1;
    try { const p = v.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}

    const els = targets();

    document.body.classList.add('wa-busy');
    blowAway(els).then(() => {
      ov.classList.add('dark');
      setTimeout(play, 450);
    });

    function noSound() {
      /* звук запрещён: играем без него и предлагаем включить */
      v.muted = true; v.play().catch(() => {});
      const b = ov.querySelector('.wa-sound'); if (!b) return; b.classList.remove('hidden');
      b.onclick = () => { v.muted = false; v.play().catch(() => {}); b.remove(); };
    }
    function play() {
      ov.classList.add('playing');
      try { v.currentTime = 0; } catch (e) {}
      v.muted = false;
      if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(noSound); }
      setTimeout(() => { if (!done && (v.paused || v.muted)) noSound(); }, 500);
    }
    v.addEventListener('playing', () => ov.classList.add('ready'));
    v.addEventListener('waiting', () => ov.classList.remove('ready'));
    v.addEventListener('ended', () => { if (ov.classList.contains('playing')) finish(); else { try { v.currentTime = 0; v.play(); } catch (e) {} } });
    /* видео не загрузилось: дожидаемся чёрного экрана и показываем плашку */
    v.addEventListener('error', () => { const w = () => ov.classList.contains('playing') ? setTimeout(finish, 900) : setTimeout(w, 200); w(); });
    ov.querySelector('.wa-skip').onclick = () => { v.pause(); finish(); };

    let done = false;
    function finish() {
      if (done) return; done = true;
      if (available()) { ls('you_wa_intro', '1'); ov.classList.add('out'); document.body.classList.remove('wa-busy'); busy = false;
        /* улетевшие элементы возвращаем на место, иначе экран остаётся пустым */
        els.forEach(el => { (MINE.get(el) || []).forEach(a => { try { a.cancel(); } catch (e) {} }); el.style.opacity = ''; el.style.transform = ''; el.style.filter = ''; });
        setDesign(true); setTimeout(() => { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} ov.remove(); }, 500); return; }
      ov.classList.add('ended');
      const sb = ov.querySelector('.wa-sound'); if (sb) sb.remove();
      const card = document.createElement('div'); card.className = 'wa-card';
      card.innerHTML = `<div class="wa-card-i"><i class="ti ti-snowflake"></i></div>
        <b>Winter Arc в разработке</b>
        <span>Второй дизайн вот-вот доделываем. Скоро можно будет переключиться.</span>
        <button class="wa-ok">Жду</button>`;
      ov.appendChild(card);
      requestAnimationFrame(() => card.classList.add('in'));
      card.querySelector('.wa-ok').onclick = close;
    }
    function close() {
      ov.classList.add('out');
      setSw('min');
      comeBack(els).then(() => { document.body.classList.remove('wa-busy'); busy = false; });
      setTimeout(() => { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} ov.remove(); }, 500);
    }
  }

  /* Состояния иконок только читают данные приложения. */
  const ICE_DATA = (() => {
    const values = raw => Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw) : [];
    const iso = date => date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    const months = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
    function habits(store, now) {
      const section = store.habits || {}, marks = (section.months || {})[iso(now).slice(0, 7)] || {};
      return values(section.list).filter(item => item && item.id != null).map(item => ({ id: String(item.id), done: (marks[item.id] || {})[now.getDate()] === 'done' }));
    }
    function income(store, year, month) {
      const bucket = ((((store.finance || {}).years || {})[year] || {})[String(month + 1).padStart(2, '0')] || {});
      return values(bucket.entries).reduce((total, entry) => total + (entry && Number.isFinite(+entry.amount) ? +entry.amount : 0), 0);
    }
    function finance(store, now) {
      const bars = Array.from({ length: 6 }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1), year = date.getFullYear(), month = date.getMonth();
        return { year, month, label: months[month], current: income(store, year, month), previous: income(store, year - 1, month) };
      });
      const max = Math.max(0, ...bars.flatMap(bar => [bar.current, bar.previous])), current = bars[5].current, previous = bars[5].previous;
      const rounded = previous > 0 ? Math.round((current - previous) / previous * 100) : null;
      return { bars: bars.map(bar => ({ ...bar, currentLevel: max ? Math.max(0, bar.current) / max : 0, previousLevel: max ? Math.max(0, bar.previous) / max : 0 })), current, previous,
        percent: Object.is(rounded, -0) ? 0 : rounded, label: months[now.getMonth()], year: now.getFullYear(), previousYear: now.getFullYear() - 1 };
    }
    function validDate(value) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
      const [year, month, day] = value.split('-').map(Number); return iso(new Date(year, month - 1, day)) === value;
    }
    function tasks(store, now) {
      const all = values((store.tasks || {}).list).filter(item => item && item.id && item.title), open = all.filter(item => !item.done), day = iso(now);
      const time = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
      const overdue = open.filter(item => validDate(item.date) && (item.date < day || item.date === day && /^\d{2}:\d{2}$/.test(item.time || '') && item.time < time)).length;
      return { open: open.length, overdue, state: overdue ? 'overdue' : open.length ? 'current' : 'clear', hue: overdue ? 178 : open.length ? 0 : -43,
        label: overdue ? 'Просрочено: ' + overdue : open.length ? 'Открыто: ' + open.length : 'Все задачи закрыты' };
    }
    return { habits, finance, tasks, iso };
  })();
  const iceMemory = { day: '', habits: new Map() };
  function iceDay() {
    const day = today(); if (iceMemory.day === day) return;
    iceMemory.day = day; iceMemory.habits.clear();
  }
  const iceLayers = '<span class="wa-ice-floor"></span><span class="wa-ice-base"></span>';
  const iceStatic = (key, extra = '') => '<span class="wa-ice-static wa-ice-' + key + '">' + iceLayers + extra + '</span>';
  function taskArt(st) {
    const state = ICE_DATA.tasks(st, new Date());
    return '<span class="wa-ice-static wa-ice-tasks" data-task-state="' + state.state + '" data-overdue="' + state.overdue + '" style="--task-hue:' + state.hue + 'deg" aria-label="' + state.label + '">' + iceLayers + '<span class="wa-ice-task-tint"></span><span class="wa-task-aura"></span></span>';
  }
  const ART = {
    'home2-tile-training': () => iceStatic('training', '<span class="wa-training-light"></span>'),
    'home2-tile-goals': () => iceStatic('goals', '<span class="wa-goal-hit"><span></span></span>'),
    'home2-tile-habits': st => {
      const list = ICE_DATA.habits(st, new Date());
      return '<span class="wa-ice-habits" data-count="' + list.length + '"><span class="wa-hab-floor"></span>' + list.map(item => {
        const target = item.done ? 1 : 0, old = iceMemory.habits.get(item.id), now = performance.now();
        const state = old && old.value === target ? old : { value: target, from: old ? old.value : 0, at: now };
        iceMemory.habits.set(item.id, state);
        const elapsed = Math.min(1050, now - state.at), from = elapsed < 1050 ? state.from : target;
        return '<span class="wa-habit-sphere' + (item.done ? ' on' : '') + '" data-habit-id="' + esc(item.id) + '" style="--from-lit:' + from + ';--to-lit:' + target + ';--lit-delay:-' + Math.round(elapsed) + 'ms"><span class="wa-sphere-dim"></span><span class="wa-sphere-lit"></span><span class="wa-sphere-breathe"></span></span>';
      }).join('') + '</span>';
    },
    'home2-tile-finance': st => {
      const fin = ICE_DATA.finance(st, new Date());
      const state = fin.percent === null ? 'unknown' : fin.percent < 0 ? 'negative' : fin.percent > 0 ? 'positive' : 'neutral';
      const hue = state === 'negative' ? 155 : state === 'positive' ? -45 : 0;
      return '<span class="wa-ice-static wa-ice-finance" data-finance-state="' + state + '" data-finance-percent="' + (fin.percent === null ? '' : fin.percent) + '" style="--finance-hue:' + hue + 'deg">' + iceLayers + '</span>';
    },
    'home2-tile-tasks': taskArt,
  };
  function layoutIce(scr) {
    scr.querySelectorAll('.wa-ice-habits').forEach(host => {
      const count = +host.dataset.count; if (!count) return;
      const width = host.clientWidth, height = host.clientHeight, ratio = 1.55;
      const columns = count <= 12 ? count : Math.ceil(Math.sqrt(count * width / height * 1.3));
      const rows = Math.ceil(count / columns), span = 1.12 * Math.max(0, columns - 1) + 1;
      const unit = Math.min(width / span, height / (rows * ratio + .32), 72);
      host.style.setProperty('--sphere-size', Math.max(1, unit) + 'px');
      host.querySelectorAll('.wa-habit-sphere').forEach((sphere, i) => {
        const col = i % columns, row = Math.floor(i / columns);
        sphere.style.left = ((width - span * unit) / 2 + col * unit * 1.12) + 'px';
        sphere.style.bottom = ((rows - row - 1) * unit * ratio + col / Math.max(1, columns - 1) * unit * .32) + 'px';
        sphere.style.zIndex = String(columns - col);
        sphere.style.setProperty('--sphere-phase', (-col * .38) + 's');
      });
    });
  }
  function refreshIceClock(scr) {
    if (iceMemory.day !== today() && typeof Router !== 'undefined') { window.__keepUi = true; try { Router.render({ keepScroll: true }); } finally { window.__keepUi = false; } return false; }
    const host = scr.querySelector('.wa-ice-tasks');
    if (host && typeof Store !== 'undefined') { const state = ICE_DATA.tasks(Store.get(), new Date()); host.dataset.taskState = state.state; host.dataset.overdue = state.overdue; host.style.setProperty('--task-hue', state.hue + 'deg'); host.setAttribute('aria-label', state.label); }
    return true;
  }

  function decorate(mount, st) {
    stopMotion();
    const scr = mount && mount.querySelector('.home2-screen'); if (!scr) return;
    applyAttr(); keepDark(); /* владелец известен только после входа: пересчитываем доступность */
    scr.querySelectorAll('.wa-x').forEach(el => el.remove());
    if (!isOn()) return;
    st = st || (typeof Store !== 'undefined' ? Store.get() : {});
    iceDay();
    let n = 0;
    scr.querySelectorAll('.home2-grid .home2-tile').forEach(t => {
      if (t.classList.contains('tile-hidden')) return; n++;
      const key = Object.keys(ART).find(k => t.classList.contains(k));
      const c = t.querySelector('.home2-tile-content'); if (!c) return;
      c.insertAdjacentHTML('afterbegin', '<span class="wa-x wa-n">' + String(n).padStart(2, '0') + '</span>');
      const nm = c.querySelector('.home2-tile-name'); if (nm) nm.insertAdjacentHTML('afterend', '<span class="wa-x wa-rule"></span>');
      /* главная цифра плитки крупно: «0/6 сегодня» → 0/6 + подпись */
      const ds = c.querySelector('.home2-tile-desc'), m = ds && metric(ds.textContent);
      if (ds) ds.classList.toggle('wa-hide', !!m);
      if (m) ds.insertAdjacentHTML('afterend', '<div class="wa-x wa-met"><b>' + esc(m[0]) + '</b>' + (m[1] ? '<span>' + esc(m[1]) + '</span>' : '') + '</div>');
      if (key) t.insertAdjacentHTML('beforeend', '<span class="wa-x wa-art" style="--wa-phase:-' + Math.round(performance.now()) + 'ms">' + ART[key](st) + '</span>');
    });
    /* у каждого слайда своя картинка: «Фокус дня» с FOCUS, цели с золотой вершиной, остальные горы по очереди */
    const hs = scr.querySelector('.hero-slider');
    if (hs) { hs.insertAdjacentHTML('afterbegin', '<span class="wa-x wa-frost wa-frost-hero" aria-hidden="true"></span>');
      let k = 0; hs.querySelectorAll('.hero-slide').forEach(sl => { const lb = (sl.querySelector('.hero-slide-label') || {}).textContent || '';
        const img = /фокус/i.test(lb) ? 'focus' : /цел/i.test(lb) ? 'peak3' : ['peak1', 'peak2', 'peak3'][k++ % 3];
        sl.classList.toggle('wa-has-goals', !!sl.querySelector('.hero-goals-bar'));
        sl.insertAdjacentHTML('afterbegin', '<span class="wa-x wa-sbg wa-sbg-' + img + '" style="background-image:url(img/wa/' + img + '.webp)" aria-hidden="true"></span>'); }); }
    /* полоса челленджа: день N из 92 (1 ноября – 31 января) */
    const grid = scr.querySelector('.home2-grid'); if (grid) grid.insertAdjacentHTML('beforebegin', arcHtml());
    layoutIce(scr);
    motion(scr);
  }
  const esc = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  function metric(txt) { const t = String(txt || '').trim(), m = t.match(/^(\d[\d\s\u00a0.,]*(?:\/\s?\d+)?\s?(?:%|₽)?)(.*)$/);
    if (!m) return null; return [m[1].trim(), m[2].replace(/^[\s\/·]+/, '').trim()]; }
  const DAY = 864e5, dOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  function plural(n, a, b, c) { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c; }
  function arcHtml() { const now = dOnly(new Date()), y = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear() - 1;
    const st = new Date(y, 10, 1), end = new Date(y + 1, 0, 31), total = Math.round((end - st) / DAY) + 1;
    let day = Math.round((now - st) / DAY) + 1, head;
    if (day > total) { const nx = new Date(y + 1, 10, 1), left = Math.round((nx - now) / DAY); day = 0; head = '<b>' + left + '</b><span>' + plural(left, 'ДЕНЬ', 'ДНЯ', 'ДНЕЙ') + ' ДО СТАРТА</span>'; }
    else head = '<b>ДЕНЬ ' + day + '</b><span>/ ' + total + '</span>';
    let ticks = ''; for (let i = 1; i <= total; i++) ticks += '<i' + (i < day ? ' class="p"' : i === day ? ' class="t"' : '') + '></i>';
    return '<div class="wa-x wa-arc"><div class="wa-arc-h"><span class="wa-arc-l">WINTER ARC</span><span class="wa-arc-d">' + head + '</span></div><div class="wa-arc-t">' + ticks + '</div></div>'; }

  /* награда: закрыл все привычки дня → морозная вспышка на весь экран */
  function habitsState() { try { const st = Store.get(), now = new Date(), ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const list = ((st.habits || {}).list || []).filter(Boolean), marks = ((st.habits || {}).months || {})[ym] || {};
    return list.length ? list.filter(h => (marks[h.id] || {})[now.getDate()] === 'done').length + '/' + list.length : ''; } catch (e) { return ''; } }
  let habPrev = null;
  function watch() { if (typeof Store === 'undefined' || !Store.subscribe) return setTimeout(watch, 500);
    habPrev = habitsState();
    Store.subscribe(() => { const cur = habitsState(), was = habPrev; habPrev = cur;
      if (!isOn() || !cur || cur === was) return; const [a, b] = cur.split('/'); if (a !== b || !was) return; const [pa, pb] = was.split('/'); if (pb !== b || +pa !== +a - 1) return;
      flash('ВСЕ ПРИВЫЧКИ', 'ДЕНЬ ЗАКРЫТ'); }); }
  function flash(top, big) { if (document.querySelector('.wa-flash')) return;
    const f = document.createElement('div'); f.className = 'wa-flash no-invert'; f.innerHTML = '<i></i><div><span>' + esc(top) + '</span><b>' + esc(big) + '</b></div>';
    document.body.appendChild(f); try { navigator.vibrate && navigator.vibrate([25, 40, 70]); } catch (e) {}
    f.addEventListener('click', () => f.remove()); setTimeout(() => f.remove(), 2600); }
  setTimeout(watch, 0);

  /* Один лёгкий слой снега за плитками. Пауза в фоне и при уменьшении движения. */
  let _motionCleanup = null;
  function stopMotion() { if (_motionCleanup) _motionCleanup(); }
  function motion(scr) {
    stopMotion();
    const reduced = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    const cards = [...scr.querySelectorAll('.home2-tile')];
    const canvas = document.createElement('canvas'); canvas.className = 'wa-x wa-snow'; canvas.setAttribute('aria-hidden', 'true'); scr.prepend(canvas);
    const ctx = canvas.getContext('2d', { alpha: true });
    let flakes = [], frame = 0, last = 0, snowTime = 0, snowWidth = 0, snowHeight = 0;
    const sizeSnow = () => {
      snowWidth = innerWidth; snowHeight = innerHeight;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(snowWidth * dpr); canvas.height = Math.round(snowHeight * dpr);
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      flakes = Array.from({ length: Math.min(150, Math.round(snowWidth * snowHeight / 8500) + 42) }, () => {
        const depth = Math.random();
        return { x: Math.random() * snowWidth, y: Math.random() * snowHeight, r: .55 + depth * 1.65, speed: 8 + depth * 25, alpha: .2 + depth * .48, phase: Math.random() * Math.PI * 2, sway: 3 + Math.random() * 12 };
      });
    };
    const drawSnow = time => {
      frame = 0; if (disposed || scr.classList.contains('wa-motion-paused') || !ctx) return;
      frame = requestAnimationFrame(drawSnow);
      if (time - last < 1000 / 30) return;
      const dt = last ? Math.min((time - last) / 1000, .08) : 0; last = time; snowTime += dt;
      ctx.clearRect(0, 0, snowWidth, snowHeight);
      flakes.forEach(f => {
        f.y += f.speed * dt; f.x += (5 + Math.sin(snowTime * .24 + f.phase) * f.sway) * dt;
        if (f.y > snowHeight + 5) { f.y = -5; f.x = Math.random() * snowWidth; }
        if (f.x > snowWidth + 5) f.x = -5; else if (f.x < -5) f.x = snowWidth + 5;
        ctx.globalAlpha = f.alpha; ctx.fillStyle = '#deecf5'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      });
    };
    const visible = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle('wa-inview', e.isIntersecting)), { threshold: .1 }) : null;
    cards.forEach(card => { if (visible) visible.observe(card); else card.classList.add('wa-inview'); });
    let disposed = false, pageHidden = false;
    const reconcile = () => {
      if (disposed) return;
      if (!scr.isConnected) { cleanup(); return; }
      if (!document.hidden && !pageHidden && isOn() && !refreshIceClock(scr)) return;
      scr.classList.toggle('wa-motion-paused', document.hidden || pageHidden || !!reduced?.matches || !isOn());
      if (scr.classList.contains('wa-motion-paused')) { cancelAnimationFrame(frame); frame = 0; last = 0; ctx?.clearRect(0, 0, snowWidth, snowHeight); }
      else if (!frame && ctx) frame = requestAnimationFrame(drawSnow);
    };
    const resize = () => { layoutIce(scr); sizeSnow(); reconcile(); };
    const hide = () => { pageHidden = true; reconcile(); };
    const show = () => { pageHidden = false; reconcile(); };
    const removed = new MutationObserver(() => { if (!scr.isConnected) cleanup(); });
    function cleanup() {
      if (disposed) return; disposed = true;
      removeEventListener('resize', resize); removeEventListener('pagehide', hide); removeEventListener('pageshow', show);
      document.removeEventListener('visibilitychange', reconcile);
      if (reduced?.removeEventListener) reduced.removeEventListener('change', reconcile); else reduced?.removeListener(reconcile);
      clearInterval(iceClock); visible?.disconnect(); removed.disconnect();
      cancelAnimationFrame(frame); frame = 0; canvas.remove();
      cards.forEach(card => card.classList.remove('wa-inview')); scr.classList.remove('wa-motion-paused');
      if (_motionCleanup === cleanup) _motionCleanup = null;
    }
    const iceClock = setInterval(() => { if (!document.hidden && !pageHidden && isOn() && scr.isConnected) refreshIceClock(scr); }, 30000);
    _motionCleanup = cleanup;
    addEventListener('resize', resize, { passive: true }); addEventListener('pagehide', hide); addEventListener('pageshow', show);
    document.addEventListener('visibilitychange', reconcile);
    if (reduced?.addEventListener) reduced.addEventListener('change', reconcile); else reduced?.addListener(reconcile);
    removed.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    layoutIce(scr); sizeSnow(); reconcile();
  }

  return { html, bind, decorate, refresh: () => { applyAttr(); keepDark(); if (!isOn()) stopMotion(); }, isOn, available, set: setDesign, start: (sw) => start(sw || document.getElementById('ds-sw')) };
})();
