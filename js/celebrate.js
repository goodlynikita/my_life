/* ============================================================
   CELEBRATE — один раз показываем «союз» клиента и тренера
   Celebrate.once(key, { kicker, title, sub, btn })
   key запоминается в localStorage, второй раз не показывается
   ============================================================ */
window.Celebrate = (() => {
  const SEEN = 'you_celebrated';
  const seen = () => { try { return JSON.parse(localStorage.getItem(SEEN) || '{}'); } catch (e) { return {}; } };
  const mark = (k) => { try { const s = seen(); s[k] = Date.now(); localStorage.setItem(SEEN, JSON.stringify(s)); } catch (e) {} };
  const esc = (t) => String(t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const CSS = `
  .cel-ov{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(4,6,14,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);animation:cel-fade .35s ease both}
  .cel-ov.out{animation:cel-fade .3s ease reverse both}
  @keyframes cel-fade{from{opacity:0}to{opacity:1}}
  .cel-card{position:relative;width:100%;max-width:400px;border-radius:28px;padding:2px;background:conic-gradient(from var(--cel-a,0deg),#7C9CFF,#C084FC,#F0ABFC,#FCD34D,#7C9CFF);animation:cel-pop .7s cubic-bezier(.2,1.4,.4,1) both,cel-spin 4s linear infinite;box-shadow:0 30px 80px rgba(124,156,255,.35),0 0 0 1px rgba(255,255,255,.04)}
  @property --cel-a{syntax:'<angle>';inherits:false;initial-value:0deg}
  @keyframes cel-spin{to{--cel-a:360deg}}
  @keyframes cel-pop{0%{transform:scale(.6) translateY(40px);opacity:0;filter:blur(8px)}100%{transform:none;opacity:1;filter:none}}
  .cel-in{border-radius:26px;overflow:hidden;background:#0D1020;position:relative}
  .cel-vid{position:relative;aspect-ratio:4/3;background:#111 center/cover no-repeat}
  .cel-vid video{width:100%;height:100%;object-fit:cover;display:block}
  .cel-vid::after{content:'';position:absolute;inset:auto 0 0 0;height:55%;background:linear-gradient(to top,#0D1020 4%,rgba(13,16,32,0))}
  .cel-snd{position:absolute;top:12px;right:12px;z-index:2;width:38px;height:38px;border-radius:50%;border:none;background:rgba(0,0,0,.45);color:#fff;font-size:18px;cursor:pointer;backdrop-filter:blur(6px)}
  .cel-badge{position:absolute;top:12px;left:12px;z-index:2;padding:6px 11px;border-radius:99px;background:rgba(0,0,0,.45);color:#fff;font:800 10.5px/1 Montserrat,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;backdrop-filter:blur(6px)}
  .cel-txt{position:relative;padding:0 22px 22px;margin-top:-44px;z-index:1;text-align:center;font-family:Montserrat,system-ui,sans-serif}
  .cel-kick{font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#A5B4FC;margin-bottom:8px;animation:cel-up .6s .25s both}
  .cel-title{font-size:30px;line-height:1.08;font-weight:900;letter-spacing:-.5px;background:linear-gradient(90deg,#fff,#C7D2FE,#F5D0FE,#fff);background-size:250% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:cel-up .6s .35s both,cel-shine 3.2s 1s linear infinite}
  @keyframes cel-shine{to{background-position:-250% 0}}
  @keyframes cel-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .cel-sub{margin-top:10px;font-size:14px;line-height:1.5;color:rgba(226,232,255,.72);animation:cel-up .6s .45s both}
  .cel-sub b{color:#fff}
  .cel-btn{margin-top:18px;width:100%;padding:15px;border:none;border-radius:16px;background:linear-gradient(135deg,#6E8BFF,#A78BFA);color:#fff;font:800 15px Montserrat,system-ui,sans-serif;letter-spacing:.02em;cursor:pointer;box-shadow:0 10px 30px rgba(124,108,240,.45);animation:cel-up .6s .55s both}
  .cel-btn:active{transform:scale(.98)}
  .cel-spark{position:absolute;width:6px;height:6px;border-radius:50%;pointer-events:none;opacity:0;animation:cel-sp 1.6s ease-out forwards}
  @keyframes cel-sp{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--x),var(--y)) scale(.4)}}
  @media (prefers-reduced-motion:reduce){.cel-card,.cel-title,.cel-kick,.cel-sub,.cel-btn{animation:none}}
  html[data-theme="light"] .cel-ov{filter:invert(1) hue-rotate(180deg)}
  html[data-theme="light"] .cel-ov video,html[data-theme="light"] .cel-vid{filter:invert(1) hue-rotate(180deg)}
  `;
  function injectCss() { if (document.getElementById('cel-css')) return; const s = document.createElement('style'); s.id = 'cel-css'; s.textContent = CSS; document.head.appendChild(s); }

  function sparks(card) {
    const cols = ['#7C9CFF', '#C084FC', '#F0ABFC', '#FCD34D', '#86EFAC'];
    for (let i = 0; i < 26; i++) {
      const sp = document.createElement('i'); sp.className = 'cel-spark';
      const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 160;
      sp.style.cssText = `left:50%;top:38%;background:${cols[i % cols.length]};--x:${Math.cos(a) * r}px;--y:${Math.sin(a) * r}px;animation-delay:${0.2 + Math.random() * 0.4}s`;
      card.appendChild(sp);
    }
  }

  function show(o) {
    injectCss();
    const ov = document.createElement('div'); ov.className = 'cel-ov';
    ov.innerHTML = `<div class="cel-card"><div class="cel-in">
      <div class="cel-vid" style="background-image:url(img/celebrate/alliance.jpg)">
        <video src="img/celebrate/alliance.mp4" poster="img/celebrate/alliance.jpg" autoplay muted loop playsinline webkit-playsinline preload="auto"></video>
        <span class="cel-badge">${esc(o.badge || 'Союз заключён')}</span>
        <button class="cel-snd" aria-label="Звук"><i class="ti ti-volume-off"></i></button>
      </div>
      <div class="cel-txt">
        ${o.kicker ? `<div class="cel-kick">${esc(o.kicker)}</div>` : ''}
        <div class="cel-title">${esc(o.title)}</div>
        ${o.sub ? `<div class="cel-sub">${o.sub}</div>` : ''}
        <button class="cel-btn">${esc(o.btn || 'Погнали')}</button>
      </div></div></div>`;
    document.body.appendChild(ov);
    const v = ov.querySelector('video'), snd = ov.querySelector('.cel-snd');
    try { const p = v.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    snd.onclick = (e) => { e.stopPropagation(); v.muted = !v.muted; if (!v.muted) { v.currentTime = 0; v.play().catch(() => {}); } snd.innerHTML = `<i class="ti ti-volume${v.muted ? '-off' : ''}"></i>`; };
    sparks(ov.querySelector('.cel-card'));
    if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) try { navigator.vibrate([30, 40, 60]); } catch (e) {}
    const close = () => { ov.classList.add('out'); try { v.pause(); } catch (e) {} setTimeout(() => ov.remove(), 300); };
    ov.querySelector('.cel-btn').onclick = close;
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    return ov;
  }

  /* показать один раз по ключу */
  function once(key, o) {
    if (!key || seen()[key]) return null;
    mark(key);
    return show(o);
  }
  return { show, once, seen, mark };
})();
