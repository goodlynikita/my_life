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
  /* выбранный дизайн хранится на устройстве; Winter Arc открыт всем с 1 ноября, владельцу сразу */
  const RELEASE = '2026-11-01';
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
    /* статуя и пульс за ней: по линии бежит удар сердца */
    'home2-tile-training': () => '<svg class="wa-ecg" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1000" d="M0 34 H120 L132 34 L140 22 L148 34 L160 34 L168 6 L178 56 L188 30 L196 34 H262 L270 28 L278 34 H400"/><path class="hot" pathLength="1000" d="M0 34 H120 L132 34 L140 22 L148 34 L160 34 L168 6 L178 56 L188 30 L196 34 H262 L270 28 L278 34 H400"/></svg><img class="wa-img wa-img-statue" src="img/wa/statue.webp" alt="">',
    /* мишень: изредка вспыхивает попадание, по ней бежит небольшой разлом */
    'home2-tile-goals': () => '<span class="wa-tg"><img src="img/wa/target.webp" alt=""><i class="wa-hit"></i><svg class="wa-crack" viewBox="0 0 100 100" aria-hidden="true">'
      + '<path d="M47 50 L58 44 L64 46 L73 38"/><path d="M47 50 L40 41 L41 33 L35 26"/><path d="M47 50 L44 60 L49 68 L46 77"/><path d="M47 50 L37 53 L30 51"/><path d="M47 50 L57 57 L63 56"/></svg></span>',
    'home2-tile-habits': (st) => { const now = new Date(), ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      const list = ((st.habits || {}).list || []).filter(Boolean), marks = ((st.habits || {}).months || {})[ym] || {};
      const dots = list.slice(0, 12).map(h => (marks[h.id] || {})[now.getDate()] === 'done');
      /* точки по кругу, как в загрузке: сделанные светятся */
      const n = dots.length; if (!n) return '';
      return '<div class="wa-ring" style="--n:' + n + '">' + dots.map((d, i) => { const a = i / n * 2 * Math.PI - Math.PI / 2;
        return '<i class="' + (d ? 'on' : '') + '" style="left:' + (50 + 42 * Math.cos(a)).toFixed(2) + '%;top:' + (50 + 42 * Math.sin(a)).toFixed(2) + '%;--i:' + i + '"></i>'; }).join('') + '</div>'; },
    /* доход по месяцам: столбики, текущий месяц ярче, по нему изредка пробегает импульс */
    'home2-tile-finance': () => { const now = new Date(), v = [], L = ['Я', 'Ф', 'М', 'А', 'М', 'И', 'И', 'А', 'С', 'О', 'Н', 'Д'];
      for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); let x = 0; try { x = finSum(finEntries(d.getFullYear(), d.getMonth())) || 0; } catch (e) {} v.push({ x, l: L[d.getMonth()] }); }
      const mx = Math.max.apply(null, v.map(o => o.x)); if (!(mx > 0)) return '';
      return '<span class="wa-bars">' + v.map((o, i) => '<span class="wa-bar' + (i === 5 ? ' cur' : '') + '"><i style="--h:' + Math.max(4, Math.round(o.x / mx * 100)) + '%;--d:' + (i * 70) + 'ms"></i><em>' + o.l + '</em></span>').join('') + '</span>'; },
    /* песочные часы: песок течёт, в конце часы переворачиваются */
    'home2-tile-tasks': () => '<span class="wa-hg"><svg viewBox="0 0 100 150" aria-hidden="true"><defs>'
      + '<clipPath id="wa-hg-t"><path d="M22 16 H78 C78 52 56 62 52 75 H48 C44 62 22 52 22 16Z"/></clipPath>'
      + '<clipPath id="wa-hg-b"><path d="M48 75 H52 C56 88 78 98 78 134 H22 C22 98 44 88 48 75Z"/></clipPath>'
      + '<linearGradient id="wa-hg-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD0C4"/><stop offset=".5" stop-color="#F0645A"/><stop offset="1" stop-color="#B4302A"/></linearGradient></defs>'
      + '<g clip-path="url(#wa-hg-t)"><rect class="wa-hg-top" x="20" y="16" width="60" height="60" fill="url(#wa-hg-s)"/></g>'
      + '<g clip-path="url(#wa-hg-b)"><path class="wa-hg-bot" d="M20 106 C35 104 42 92 50 88 C58 92 65 104 80 106 L80 160 H20Z" fill="url(#wa-hg-s)"/></g>'
      + '<line class="wa-hg-str" x1="50" y1="74" x2="50" y2="133"/>'
      + '<path class="wa-hg-glass" d="M22 16 H78 C78 52 56 62 52 75 C56 88 78 98 78 134 H22 C22 98 44 88 48 75 C44 62 22 52 22 16Z"/>'
      + '<rect class="wa-hg-cap" x="14" y="8" width="72" height="8" rx="3"/><rect class="wa-hg-cap" x="14" y="134" width="72" height="8" rx="3"/></svg></span>',
  };
  function decorate(mount, st) {
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
      t.insertAdjacentHTML('beforeend', '<span class="wa-x wa-frost wa-frost-' + fr + '" aria-hidden="true"></span><span class="wa-x wa-arr"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg></span>' + (key ? '<span class="wa-x wa-art">' + ART[key](st) + '</span>' : ''));
      tap(t); if (key === 'home2-tile-finance') ball(t);
    });
    /* у каждого слайда своя картинка: «Фокус дня» с FOCUS, цели с золотой вершиной, остальные горы по очереди */
    const hs = scr.querySelector('.hero-slider');
    if (hs) { hs.insertAdjacentHTML('afterbegin', '<span class="wa-x wa-frost wa-frost-hero" aria-hidden="true"></span>');
      let k = 0; hs.querySelectorAll('.hero-slide').forEach(sl => { const lb = (sl.querySelector('.hero-slide-label') || {}).textContent || '';
        const img = /фокус/i.test(lb) ? 'focus' : /цел/i.test(lb) ? 'peak3' : ['peak1', 'peak2', 'peak3'][k++ % 3];
        sl.insertAdjacentHTML('afterbegin', '<span class="wa-x wa-sbg wa-sbg-' + img + '" style="background-image:url(img/wa/' + img + '.webp)" aria-hidden="true"></span>'); }); }
    /* полоса челленджа: день N из 92 (1 ноября – 31 января) */
    const grid = scr.querySelector('.home2-grid'); if (grid) grid.insertAdjacentHTML('beforebegin', arcHtml());
    scr.insertAdjacentHTML('afterbegin', '<span class="wa-x wa-rime" aria-hidden="true"></span><span class="wa-x wa-aurora" aria-hidden="true"><i></i><i></i></span><span class="wa-x wa-fog" aria-hidden="true"></span>');
    const ft = scr.querySelector('.home2-footer');
    if (ft) ft.insertAdjacentHTML('afterbegin', '<div class="wa-x wa-foot"><span class="wa-foot-l"><b>WINTER ARC</b><i></i>YOUR NEXT OPPONENT IS YOU.</span><span class="wa-foot-r">COMPETE WITH YOURSELF.</span></div>');
    snow(scr);
  }
  const esc = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  function metric(txt) { const t = String(txt || '').trim(), m = t.match(/^(\d[\d\s\u00a0.,]*(?:\/\s?\d+)?\s?(?:%|₽)?)(.*)$/);
    if (!m) return null; return [m[1].trim(), m[2].replace(/^[\s\/·]+/, '').trim()]; }
  /* финансы: шарик прыгает по верхушкам столбиков и приземляется на текущий месяц */
  function ball(t) {
    const wrap = t.querySelector('.wa-bars'); if (!wrap || !wrap.animate || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    requestAnimationFrame(() => {
      const cols = [...wrap.querySelectorAll('.wa-bar')]; if (cols.length < 2 || !wrap.offsetWidth) return;
      const pts = cols.map(c => { const i = c.querySelector('i'); return [c.offsetLeft + i.offsetLeft + i.offsetWidth / 2, c.offsetTop + i.offsetTop]; });
      const b = document.createElement('b'); b.className = 'wa-ball'; wrap.appendChild(b);
      const T = 7600, hop = 430, drop = 520, t0 = 900, R = 4, kf = [], at = (ms) => Math.min(1, ms / T);
      const pos = (x, y, o, extra) => Object.assign({ transform: 'translate(' + (x - R).toFixed(1) + 'px,' + (y - 2 * R).toFixed(1) + 'px)' + (extra || ''), opacity: o }, {});
      kf.push(Object.assign(pos(pts[0][0], pts[0][1] - 60, 0), { offset: 0 }));
      kf.push(Object.assign(pos(pts[0][0], pts[0][1] - 60, 0), { offset: at(t0) }));
      kf.push(Object.assign(pos(pts[0][0], pts[0][1], 1, ' scale(1.25,.75)'), { offset: at(t0 + drop), easing: 'ease-out' }));
      let tm = t0 + drop; const hits = [tm];
      for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], apex = Math.min(y0, y1) - 22;
        for (let k = 1; k <= 8; k++) { const u = k / 8, x = x0 + (x1 - x0) * u, y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * (2 * apex - (y0 + y1) / 2) + u * u * y1;
          kf.push(Object.assign(pos(x, y, 1, k === 8 ? ' scale(1.25,.75)' : ''), { offset: at(tm + hop * u) })); }
        tm += hop; hits.push(tm); }
      const [lx, ly] = pts[pts.length - 1];
      kf.push(Object.assign(pos(lx, ly, 1), { offset: at(tm + 160) }));
      kf.push(Object.assign(pos(lx, ly, 1), { offset: at(tm + 1500) }));
      kf.push(Object.assign(pos(lx, ly - 10, 0), { offset: at(tm + 1900) }));
      kf.push(Object.assign(pos(lx, ly - 10, 0), { offset: 1 }));
      b.animate(kf, { duration: T, iterations: Infinity });
      /* столбик вспыхивает в момент касания, последний сильнее */
      cols.forEach((c, i) => { const h = hits[i], last = i === cols.length - 1, k = [{ filter: 'brightness(1)', offset: 0 }];
        k.push({ filter: 'brightness(1)', offset: at(h - 1) }, { filter: 'brightness(' + (last ? 2.1 : 1.6) + ')', offset: at(h + 40) }, { filter: 'brightness(1)', offset: at(h + (last ? 900 : 380)) }, { filter: 'brightness(1)', offset: 1 });
        c.querySelector('i').animate(k, { duration: T, iterations: Infinity }); });
    });
  }
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

  /* снег в глубину: дальний слой мелкий и медленный, ближний крупный; иногда порыв ветра; при «меньше движения» не идёт */
  function snow(scr) {
    if (scr.querySelector('.wa-snow') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const c = document.createElement('canvas'); c.className = 'wa-x wa-snow'; scr.prepend(c);
    const g = c.getContext('2d'); let W = 0, H = 0, P = [];
    const flake = (near) => near ? { x: Math.random() * W, y: Math.random() * H, r: 1.5 + Math.random() * 1.3, v: 40 + Math.random() * 30, s: Math.random() * 6.28, a: .55 + Math.random() * .3, k: 1.4 }
      : { x: Math.random() * W, y: Math.random() * H, r: .4 + Math.random() * .9, v: 9 + Math.random() * 14, s: Math.random() * 6.28, a: .15 + Math.random() * .3, k: .6 };
    const size = () => { const dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const nf = Math.round(Math.min(80, W / 9)), nn = Math.round(Math.min(16, W / 50)); P = Array.from({ length: nf }, () => flake(false)).concat(Array.from({ length: nn }, () => flake(true))); };
    size(); addEventListener('resize', size);
    let last = performance.now(), wind = 0, gust = 0, nextGust = last + 7000 + Math.random() * 8000;
    (function f(t) { if (!c.isConnected) { removeEventListener('resize', size); return; }
      const dt = Math.min(.05, (t - last) / 1000); last = t; g.clearRect(0, 0, W, H);
      /* порыв: за секунду разгоняется, держится и стихает */
      if (t > nextGust) { gust = 70 + Math.random() * 60; nextGust = t + 9000 + Math.random() * 9000; setTimeout(() => { gust = 0; }, 1800); }
      wind += (gust - wind) * Math.min(1, dt * (gust ? 1.6 : .8));
      if (!document.hidden) P.forEach(p => { p.y += p.v * dt; p.s += dt; p.x += (Math.sin(p.s) * 8 + wind * p.k) * dt;
        if (p.y > H + 4) { p.y = -4; p.x = Math.random() * W; } if (p.x > W + 6) p.x = -6; else if (p.x < -6) p.x = W + 6;
        g.globalAlpha = p.a; g.fillStyle = '#EAF4FF'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill(); });
      requestAnimationFrame(f); })(last);
  }

  return { html, bind, decorate, refresh: () => { applyAttr(); keepDark(); }, isOn, available, set: setDesign, start: (sw) => start(sw || document.getElementById('ds-sw')) };
})();
