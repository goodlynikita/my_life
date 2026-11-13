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
  /* Winter Arc всегда тёмный: светлая тема в нём не включается (на «Минимал» вернётся как была) */
  function keepDark() { const h = document.documentElement; if (isOn() && h.getAttribute('data-theme') === 'light') { h.setAttribute('data-theme', 'dark'); h.dataset.waLight = '1'; }
    else if (!isOn() && h.dataset.waLight) { delete h.dataset.waLight; if (window.Theme && Theme.get() === 'light') h.setAttribute('data-theme', 'light'); } }
  try { new MutationObserver(keepDark).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-design'] }); } catch (e) {}
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

  /* ветер со снегом поверх экрана */
  function wind(ms) {
    const c = document.createElement('canvas'); c.className = 'wa-wind';
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    c.width = W * dpr; c.height = H * dpr; document.body.appendChild(c);
    const g = c.getContext('2d'); g.scale(dpr, dpr);
    const P = [];
    for (let i = 0; i < 140; i++) P.push({ x: -Math.random() * W, y: Math.random() * H, v: 900 + Math.random() * 1400, r: 0.8 + Math.random() * 2.2, l: 10 + Math.random() * 60, a: 0.3 + Math.random() * 0.6, w: Math.random() * 6.28 });
    const t0 = performance.now();
    (function frame(t) {
      const k = (t - t0) / 1000; g.clearRect(0, 0, W, H);
      const fade = Math.min(1, (ms / 1000 - k) * 2.5);
      P.forEach(p => {
        const x = p.x + p.v * k, y = p.y + Math.sin(p.w + k * 3) * 14 - k * 40;
        g.globalAlpha = p.a * Math.max(0, fade);
        g.strokeStyle = '#E8F1FF'; g.lineWidth = p.r; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - p.l, y + p.l * 0.08); g.stroke();
      });
      if (k * 1000 < ms) requestAnimationFrame(frame); else c.remove();
    })(t0);
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
    wind(1500);
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

  /* ── Оформление главной в Winter Arc: номера 01-05, стрелка, иллюстрации и живые данные на плитках, снег, подпись внизу ── */
  const ART = {
    /* Готовые 3D-иллюстрации, без расчёта сцены в браузере. */
    'home2-tile-training': () => '<svg class="wa-ecg" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 34 H120 L132 34 L140 22 L148 34 L160 34 L168 6 L178 56 L188 30 L196 34 H262 L270 28 L278 34 H400"/></svg><span class="wa-prop wa-prop-training" aria-hidden="true"></span>',
    'home2-tile-goals': () => '<span class="wa-prop wa-prop-goals" aria-hidden="true"></span>',
    'home2-tile-habits': (st) => { const now = new Date(), ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      const list = ((st.habits || {}).list || []).filter(Boolean), marks = ((st.habits || {}).months || {})[ym] || {};
      const dots = list.slice(0, 12).map(h => (marks[h.id] || {})[now.getDate()] === 'done');
      /* точки по кругу, как в загрузке: сделанные светятся */
      const n = dots.length; if (!n) return '';
      return '<div class="wa-ring" style="--n:' + n + '">' + dots.map((d, i) => { const a = i / n * 2 * Math.PI - Math.PI / 2;
        return '<i class="' + (d ? 'on' : '') + '" style="left:' + (50 + 42 * Math.cos(a)).toFixed(2) + '%;top:' + (50 + 42 * Math.sin(a)).toFixed(2) + '%;--i:' + i + '"></i>'; }).join('') + '</div>'; },
    /* Доход по месяцам, текущий месяц выделен. */
    'home2-tile-finance': () => { const now = new Date(), v = [], L = ['Я', 'Ф', 'М', 'А', 'М', 'И', 'И', 'А', 'С', 'О', 'Н', 'Д'];
      for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); let x = 0; try { x = finSum(finEntries(d.getFullYear(), d.getMonth())) || 0; } catch (e) {} v.push({ x, l: L[d.getMonth()] }); }
      const mx = Math.max.apply(null, v.map(o => o.x)); if (!(mx > 0)) return '';
      return '<span class="wa-bars">' + v.map((o, i) => '<span class="wa-bar' + (i === 5 ? ' cur' : '') + '"><i style="--h:' + Math.max(4, Math.round(o.x / mx * 100)) + '%;--d:' + (i * 70) + 'ms"></i><em>' + o.l + '</em></span>').join('') + '</span>'; },
    'home2-tile-tasks': () => '<span class="wa-prop wa-prop-tasks" aria-hidden="true"></span>',
  };
  function decorate(mount, st) {
    stopMotion();
    const scr = mount && mount.querySelector('.home2-screen'); if (!scr) return;
    applyAttr(); keepDark(); /* владелец известен только после входа: пересчитываем доступность */
    scr.querySelectorAll('.wa-x').forEach(el => el.remove());
    if (!isOn()) return;
    st = st || (typeof Store !== 'undefined' ? Store.get() : {});
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
      const fr = { 'home2-tile-training': 'shard', 'home2-tile-habits': 'fern', 'home2-tile-finance': 'flake', 'home2-tile-goals': 'crack', 'home2-tile-tasks': 'feather' }[key] || 'fern';
      t.insertAdjacentHTML('beforeend', '<span class="wa-x wa-frost wa-frost-' + fr + '" aria-hidden="true"></span>' + (key ? '<span class="wa-x wa-art">' + ART[key](st) + '</span>' : ''));
      tap(t);
    });
    /* у каждого слайда своя картинка: «Фокус дня» с FOCUS, цели с золотой вершиной, остальные горы по очереди */
    const hs = scr.querySelector('.hero-slider');
    if (hs) { hs.insertAdjacentHTML('afterbegin', '<span class="wa-x wa-frost wa-frost-hero" aria-hidden="true"></span>');
      let k = 0; hs.querySelectorAll('.hero-slide').forEach(sl => { const lb = (sl.querySelector('.hero-slide-label') || {}).textContent || '';
        const img = /фокус/i.test(lb) ? 'focus' : /цел/i.test(lb) ? 'peak3' : ['peak1', 'peak2', 'peak3'][k++ % 3];
        sl.insertAdjacentHTML('afterbegin', '<span class="wa-x wa-sbg wa-sbg-' + img + '" style="background-image:url(img/wa/' + img + '.webp)" aria-hidden="true"></span>'); }); }
    /* полоса челленджа: день N из 92 (1 ноября – 31 января) */
    const grid = scr.querySelector('.home2-grid'); if (grid) grid.insertAdjacentHTML('beforebegin', arcHtml());
    scr.insertAdjacentHTML('afterbegin', '<span class="wa-x wa-rime" aria-hidden="true"></span>');
    const ft = scr.querySelector('.home2-footer');
    if (ft) ft.insertAdjacentHTML('afterbegin', '<div class="wa-x wa-foot"><span class="wa-foot-l"><b>WINTER ARC</b><i></i>YOUR NEXT OPPONENT IS YOU.</span><span class="wa-foot-r">COMPETE WITH YOURSELF.</span></div>');
    snow(scr);
  }
  const esc = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  function metric(txt) { const t = String(txt || '').trim(), m = t.match(/^(\d[\d\s\u00a0.,]*(?:\/\s?\d+)?\s?(?:%|₽)?)(.*)$/);
    if (!m) return null; return [m[1].trim(), m[2].replace(/^[\s\/·]+/, '').trim()]; }
  /* отклик на нажатие: плитка проседает, от пальца расходится морозный свет */
  function tap(t) { if (t.dataset.waTap) return; t.dataset.waTap = '1';
    t.addEventListener('pointerdown', (e) => { if (!isOn()) return; const r = t.getBoundingClientRect(), s = document.createElement('span'); s.className = 'wa-x wa-ripple';
      s.style.left = (e.clientX - r.left) + 'px'; s.style.top = (e.clientY - r.top) + 'px'; t.appendChild(s); setTimeout(() => s.remove(), 700); }); }
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

  /* Один снеговой слой, ограниченная частота кадров и очистка при уходе с главной. */
  let _motionCleanup = null;
  function stopMotion() { if (_motionCleanup) _motionCleanup(); }
  function snow(scr) {
    stopMotion();
    const c = document.createElement('canvas'); c.className = 'wa-x wa-snow'; c.setAttribute('aria-hidden', 'true'); scr.prepend(c);
    const g = c.getContext('2d', { alpha: true });
    if (!g) { c.remove(); return; }
    const reduced = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    const cards = [...scr.querySelectorAll('.home2-tile')];
    const visible = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle('wa-inview', e.isIntersecting)), { threshold: .1 }) : null;
    cards.forEach(card => { if (visible) visible.observe(card); else card.classList.add('wa-inview'); });
    let W = 0, H = 0, P = [], raf = 0, last = 0, previous = 0, fps = 24, disposed = false, pageHidden = false;
    const size = () => {
      W = innerWidth; H = innerHeight;
      const mobile = W <= 600, low = navigator.connection?.saveData || navigator.deviceMemory <= 4 || navigator.hardwareConcurrency <= 4;
      const dpr = Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5);
      fps = mobile || low ? 24 : 30;
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = mobile ? (low ? 14 : 20) : (low ? 26 : 44);
      P = Array.from({ length: count }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, r: i % 7 === 0 ? 1.9 : .45 + Math.random() * .8,
        v: i % 7 === 0 ? 19 + Math.random() * 9 : 6 + Math.random() * 12, a: i % 7 === 0 ? .38 : .13 + Math.random() * .19, phase: Math.random() * Math.PI * 2, crystal: i % 7 === 0 }));
    };
    const paused = () => document.hidden || pageHidden || !!reduced?.matches || !isOn();
    const frame = t => {
      raf = 0;
      if (!scr.isConnected) { cleanup(); return; }
      if (disposed || paused()) return;
      if (t - last >= 1000 / fps - 1) {
        const dt = Math.min(.08, (t - previous) / 1000 || 0); last = t; previous = t; g.clearRect(0, 0, W, H);
        P.forEach(p => {
          p.y += p.v * dt; p.phase += dt * .35; p.x += Math.sin(p.phase) * 3.5 * dt;
          if (p.y > H + 4) { p.y = -4; p.x = Math.random() * W; }
          g.globalAlpha = p.a; g.fillStyle = '#E0ECFA';
          if (p.crystal) { g.strokeStyle = '#E0ECFA'; g.lineWidth = .65; g.beginPath();
            for (let n = 0; n < 3; n++) { const a = n * Math.PI / 3, dx = Math.cos(a) * p.r, dy = Math.sin(a) * p.r; g.moveTo(p.x - dx, p.y - dy); g.lineTo(p.x + dx, p.y + dy); } g.stroke();
          } else { g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); }
        });
      }
      raf = requestAnimationFrame(frame);
    };
    const reconcile = () => {
      if (disposed) return;
      if (!scr.isConnected) { cleanup(); return; }
      if (raf) cancelAnimationFrame(raf); raf = 0;
      const off = paused(); scr.classList.toggle('wa-motion-paused', off);
      if (reduced?.matches) g.clearRect(0, 0, W, H);
      if (!off) { last = 0; previous = performance.now(); raf = requestAnimationFrame(frame); }
    };
    const resize = () => { size(); reconcile(); };
    const hide = () => { pageHidden = true; reconcile(); };
    const show = () => { pageHidden = false; reconcile(); };
    const removed = new MutationObserver(() => { if (!scr.isConnected) cleanup(); });
    function cleanup() {
      if (disposed) return; disposed = true;
      if (raf) cancelAnimationFrame(raf); raf = 0;
      removeEventListener('resize', resize); removeEventListener('pagehide', hide); removeEventListener('pageshow', show);
      document.removeEventListener('visibilitychange', reconcile);
      if (reduced?.removeEventListener) reduced.removeEventListener('change', reconcile); else reduced?.removeListener(reconcile);
      visible?.disconnect(); removed.disconnect(); c.remove();
      cards.forEach(card => card.classList.remove('wa-inview')); scr.classList.remove('wa-motion-paused');
      if (_motionCleanup === cleanup) _motionCleanup = null;
    }
    _motionCleanup = cleanup;
    addEventListener('resize', resize, { passive: true }); addEventListener('pagehide', hide); addEventListener('pageshow', show);
    document.addEventListener('visibilitychange', reconcile);
    if (reduced?.addEventListener) reduced.addEventListener('change', reconcile); else reduced?.addListener(reconcile);
    removed.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    size(); reconcile();
  }

  return { html, bind, decorate, refresh: () => { applyAttr(); keepDark(); if (!isOn()) stopMotion(); }, isOn, available, set: setDesign, start: (sw) => start(sw || document.getElementById('ds-sw')) };
})();
