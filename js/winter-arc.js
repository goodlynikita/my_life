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

  function html() {
    return '<div class="ds-sw" id="ds-sw" role="tablist" aria-label="Дизайн">'
      + '<button class="ds-b on" data-ds="min" aria-label="Минимализм"><i class="ti ti-square-rounded"></i><span>Минимал</span></button>'
      + '<button class="ds-b" data-ds="wa" aria-label="Winter Arc"><i class="ti ti-snowflake"></i><span>Winter Arc</span></button>'
      + '</div>';
  }

  function bind(root) {
    const sw = root.querySelector('#ds-sw'); if (!sw) return;
    sw.querySelector('[data-ds="wa"]').addEventListener('click', (e) => { e.stopPropagation(); start(sw); });
  }

  /* элементы главного экрана, которые улетают */
  function targets() {
    const s = document.querySelector('.home2-screen'); if (!s) return [];
    const list = [...s.querySelectorAll('.home2-header > *, .hero-slider, .home2-tile')];
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

  function blowAway(els) {
    return Promise.all(els.map((el, i) => {
      const r = el.getBoundingClientRect();
      const dx = innerWidth - r.left + 80 + Math.random() * 120, dy = -60 - Math.random() * 160;
      const rot = 25 + Math.random() * 50;
      el.dataset.waT = `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(.7)`;
      const a = el.animate([
        { transform: 'none', opacity: 1, filter: 'blur(0)' },
        { transform: `translate(${dx * 0.12}px, ${dy * 0.1}px) rotate(${rot * 0.15}deg)`, opacity: 1, filter: 'blur(0)', offset: 0.25 },
        { transform: el.dataset.waT, opacity: 0, filter: 'blur(6px)' },
      ], { duration: 850, delay: i * 70, easing: 'cubic-bezier(.55,0,.8,.3)', fill: 'forwards' });
      return a.finished;
    }));
  }
  function comeBack(els) {
    return Promise.all(els.map((el, i) => {
      el.getAnimations().forEach(a => a.cancel());
      const from = `translate(${-innerWidth}px, -40px) rotate(-20deg) scale(.8)`;
      const a = el.animate([
        { transform: from, opacity: 0, filter: 'blur(6px)' },
        { transform: 'none', opacity: 1, filter: 'blur(0)' },
      ], { duration: 700, delay: i * 60, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      return a.finished.catch(() => {});
    }));
  }

  function start(sw) {
    if (busy) return; busy = true;
    const setSw = (m) => sw.querySelectorAll('.ds-b').forEach(b => b.classList.toggle('on', b.dataset.ds === m));
    setSw('wa');

    /* видео создаём прямо в нажатии: так браузер разрешит звук */
    const ov = document.createElement('div'); ov.className = 'wa-ov no-invert';
    ov.innerHTML = `<video playsinline preload="auto" poster="img/winterarc.jpg"></video>
      <div class="wa-load"><i class="ti ti-snowflake"></i></div>
      <button class="wa-skip">Пропустить <i class="ti ti-player-skip-forward"></i></button>
      <button class="wa-sound hidden"><i class="ti ti-volume"></i> Включить звук</button>`;
    document.body.appendChild(ov);
    const v = ov.querySelector('video'); v.src = SRC; v.muted = false; v.volume = 1;
    let unlocked = false;
    try { const p = v.play(); if (p && p.then) p.then(() => { if (!ov.classList.contains('playing')) { v.pause(); v.currentTime = 0; } unlocked = true; }).catch(() => {}); } catch (e) {}

    const els = targets();
    wind(1500);
    document.body.classList.add('wa-busy');
    blowAway(els).then(() => {
      ov.classList.add('dark');
      setTimeout(play, 450);
    });

    function play() {
      ov.classList.add('playing');
      v.currentTime = 0;
      v.muted = false;
      const p = v.play();
      if (p && p.catch) p.catch(() => {
        /* звук запрещён: играем без него и предлагаем включить */
        v.muted = true; v.play().catch(() => {});
        const b = ov.querySelector('.wa-sound'); b.classList.remove('hidden');
        b.onclick = () => { v.muted = false; b.remove(); };
      });
    }
    v.addEventListener('playing', () => ov.classList.add('ready'));
    v.addEventListener('waiting', () => ov.classList.remove('ready'));
    v.addEventListener('ended', finish);
    /* видео не загрузилось: дожидаемся чёрного экрана и показываем плашку */
    v.addEventListener('error', () => { const w = () => ov.classList.contains('playing') ? setTimeout(finish, 900) : setTimeout(w, 200); w(); });
    ov.querySelector('.wa-skip').onclick = () => { v.pause(); finish(); };

    let done = false;
    function finish() {
      if (done) return; done = true;
      ov.classList.add('ended');
      const sb = ov.querySelector('.wa-sound'); if (sb) sb.remove();
      const card = document.createElement('div'); card.className = 'wa-card';
      card.innerHTML = `<div class="wa-card-i"><i class="ti ti-snowflake"></i></div>
        <b>Winter Arc в разработке</b>
        <span>Второй дизайн YOU: тёмный, холодный и без поблажек. Сейчас доделываем, скоро можно будет переключиться.</span>
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

  return { html, bind };
})();
