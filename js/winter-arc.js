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
  function applyAttr() { if (isOn()) document.documentElement.dataset.design = 'wa'; else delete document.documentElement.dataset.design; }
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
    'home2-tile-training': () => '<img class="wa-img wa-img-statue" src="img/wa/statue.webp" alt="">',
    'home2-tile-goals': () => '<img class="wa-img wa-img-target" src="img/wa/target.webp" alt="">',
    'home2-tile-habits': (st) => { const now = new Date(), ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      const list = ((st.habits || {}).list || []).filter(Boolean), marks = ((st.habits || {}).months || {})[ym] || {};
      const dots = list.slice(0, 12).map(h => (marks[h.id] || {})[now.getDate()] === 'done');
      /* точки по кругу, как в загрузке: сделанные светятся */
      const n = dots.length; if (!n) return '';
      return '<div class="wa-ring" style="--n:' + n + '">' + dots.map((d, i) => { const a = i / n * 2 * Math.PI - Math.PI / 2;
        return '<i class="' + (d ? 'on' : '') + '" style="left:' + (50 + 42 * Math.cos(a)).toFixed(2) + '%;top:' + (50 + 42 * Math.sin(a)).toFixed(2) + '%;--i:' + i + '"></i>'; }).join('') + '</div>'; },
    /* финансы: купюры и монеты летят по ветру вместе со снегом */
    'home2-tile-finance': () => { const now = new Date(), v = [];
      for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); let x = 0; try { x = finSum(finEntries(d.getFullYear(), d.getMonth())) || 0; } catch (e) {} v.push(x); }
      const mx = Math.max.apply(null, v);
      const bars = '';
      const F = [[12, 7.5, 0, 'b'], [38, 9, -2.5, 'b'], [64, 8.2, -5.2, 'c'], [24, 10, -6.8, 'b'], [52, 7, -1.2, 'c'], [76, 9.4, -4, 'b'], [8, 8.6, -3.4, 'c']];
      return bars + '<span class="wa-fly">' + F.map(f => '<i class="wa-' + f[3] + '" style="--y:' + f[0] + '%;--t:' + f[1] + 's;--dl:' + f[2] + 's"></i>').join('') + '</span>'; },
    /* пешка, которая видит в зеркале короля: каждый маленький шаг делает тебя сильнее */
    'home2-tile-tasks': () => '<img class="wa-img wa-img-chess" src="img/wa/chess.webp" alt="">',
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
      t.insertAdjacentHTML('beforeend', '<span class="wa-x wa-frost" aria-hidden="true"></span><span class="wa-x wa-arr"><i class="ti ti-arrow-right"></i></span>' + (key ? '<span class="wa-x wa-art">' + ART[key](st) + '</span>' : ''));
    });
    /* у каждого слайда своя картинка: «Фокус дня» с FOCUS, цели с золотой вершиной, остальные горы по очереди */
    const hs = scr.querySelector('.hero-slider');
    if (hs) { hs.insertAdjacentHTML('afterbegin', '<span class="wa-x wa-frost wa-frost-hero" aria-hidden="true"></span>');
      let k = 0; hs.querySelectorAll('.hero-slide').forEach(sl => { const lb = (sl.querySelector('.hero-slide-label') || {}).textContent || '';
        const img = /фокус/i.test(lb) ? 'focus' : /цел/i.test(lb) ? 'peak3' : ['peak1', 'peak2', 'peak3'][k++ % 3];
        sl.insertAdjacentHTML('afterbegin', '<span class="wa-x wa-sbg wa-sbg-' + img + '" style="background-image:url(img/wa/' + img + '.webp)" aria-hidden="true"></span>'); }); }
    scr.insertAdjacentHTML('afterbegin', '<span class="wa-x wa-rime" aria-hidden="true"></span>');
    const ft = scr.querySelector('.home2-footer');
    if (ft) ft.insertAdjacentHTML('afterbegin', '<div class="wa-x wa-foot"><span class="wa-foot-l"><b>WINTER ARC</b><i></i>YOUR NEXT OPPONENT IS YOU.</span><span class="wa-foot-r">COMPETE WITH YOURSELF.</span></div>');
    snow(scr);
  }
  /* тихий снег на фоне главной; при «меньше движения» не идёт */
  function snow(scr) {
    if (scr.querySelector('.wa-snow') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const c = document.createElement('canvas'); c.className = 'wa-x wa-snow'; scr.prepend(c);
    const g = c.getContext('2d'); let W = 0, H = 0, P = [];
    const size = () => { const dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      P = Array.from({ length: Math.round(Math.min(90, W / 8)) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: .5 + Math.random() * 1.8, v: 12 + Math.random() * 30, s: Math.random() * 6.28, a: .25 + Math.random() * .5 })); };
    size(); addEventListener('resize', size);
    let last = performance.now();
    (function f(t) { if (!c.isConnected) { removeEventListener('resize', size); return; }
      const dt = Math.min(.05, (t - last) / 1000); last = t; g.clearRect(0, 0, W, H);
      if (!document.hidden) P.forEach(p => { p.y += p.v * dt; p.s += dt; p.x += Math.sin(p.s) * 8 * dt; if (p.y > H + 4) { p.y = -4; p.x = Math.random() * W; }
        g.globalAlpha = p.a; g.fillStyle = '#EAF4FF'; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill(); });
      requestAnimationFrame(f); })(last);
  }

  return { html, bind, decorate, refresh: () => { applyAttr(); keepDark(); }, isOn, available, set: setDesign, start: (sw) => start(sw || document.getElementById('ds-sw')) };
})();
