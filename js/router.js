/* ============================================================
   ROUTER — hash-based, role-aware
   Coach role is locked to /training only.
   ============================================================ */

const Router = (() => {
  const _h = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mount = () => document.getElementById('app');

  const routes = {
    '/login': () => Screens.login(mount()),
    '/register': () => Screens.login(mount(), { register: true }),
    '/home': () => Screens.home(mount()),
    '/training': () => Screens.training(mount()),
    '/habits': () => Screens.habits(mount()),
    '/finance': () => Screens.finance(mount()),
    '/goals': () => Screens.goals(mount()),
    '/tasks': () => Screens.tasks(mount()),
  };

  function currentPath() {
    return location.hash.replace('#', '') || '/login';
  }

  function go(path) {
    location.hash = path;
  }

  /* окна не переживают смену экрана: «Назад» в браузере закрывает окно, а не оставляет его поверх другого раздела */
  function closeModals() { document.querySelectorAll('.tr-modal-overlay').forEach(o => o.remove()); }
  /* Escape закрывает верхнее окно, если само окно его не обработало */
  let _escN = -1;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') _escN = document.querySelectorAll('.tr-modal-overlay').length; }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    const all = document.querySelectorAll('.tr-modal-overlay');
    if (all.length && all.length === _escN) all[all.length - 1].remove(); /* само окно Escape не обработало */
  });
  window.addEventListener('hashchange', closeModals);
  /* Вкладки под шапкой раздела прилипают ровно к её нижнему краю: шапка не перекрывается и не «уменьшается» при прокрутке
     (раньше top был числом и не совпадал с высотой шапки, особенно на iPhone с вырезом) */
  function pinTabs() {
    [['.tr-header', '.tr-tabs'], ['.tochka-header', '.tochka-tabs'], ['.goals-header', '.goals-season-tabs'], ['.hab-header', '.hab-tabs'], ['.tk-header', '.tk-tabs']].forEach(([h, t]) => {
      const he = document.querySelector(h), te = document.querySelector(t);
      if (!he || !te || getComputedStyle(te).position !== 'sticky') return;
      te.style.setProperty('top', Math.round(he.getBoundingClientRect().height) + 'px', 'important');
    });
  }
  window.addEventListener('resize', () => pinTabs());
  function render(opts) {
    const keepScroll = !!(opts && opts.keepScroll);
    const prevY = window.scrollY;
    let path = currentPath();
    const loggedIn = Auth.isLoggedIn();
    /* Ссылка тренера: #/join/КОД → запоминаем код, после входа предложим подключиться */
    /* Ссылка на общий план: #/t/КОД → покажем, что внутри, и «Взять себе» (после входа) */
    if (path.indexOf('/t/') === 0) {
      try { localStorage.setItem('you_tpl', decodeURIComponent(path.slice(3)).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)); } catch (e) {}
      location.hash = loggedIn ? '/training' : '/register';
      return;
    }
    if (path.indexOf('/join/') === 0) {
      try { localStorage.setItem('you_join', decodeURIComponent(path.slice(6)).toUpperCase()); } catch (e) {}
      location.hash = loggedIn ? '/training' : '/register';
      return;
    }

    if (!loggedIn && path !== '/login' && path !== '/register') {
      path = '/login';
      location.hash = path;
      return;
    }
    if (loggedIn && (path === '/login' || path === '/register')) {
      path = '/home';
      location.hash = path;
      return;
    }

    document.documentElement.classList.remove('fin-dark-on', 'fin-inv-on', 'tk-on'); /* тёмные финансы — только на своём экране */
    /* Тренеру доступны только тренировки */
    if (loggedIn && Auth.role() === 'coach' && path !== '/training') {
      location.hash = '/training';
      return;
    }
    const handler = routes[path] || routes['/login'];
    try {
      handler();
      pinTabs(); setTimeout(pinTabs, 300); setTimeout(pinTabs, 1200);
      let tplPend = null; try { tplPend = localStorage.getItem('you_tpl'); } catch (e) {}
      if (window.Tour && !keepScroll && !tplPend) Tour.onScreen(path); /* по ссылке на план сначала превью, без тура поверх */
      if (window.TrainerLink && loggedIn) {
        if (path === '/training') TrainerLink.decorate();
        let pend = null; try { pend = localStorage.getItem('you_join'); } catch (e) {}
        if (pend && Auth.role() !== 'coach') setTimeout(() => TrainerLink.offer(), 700);
      }
      if (window.ShareTpl && loggedIn && Auth.role() !== 'coach') {
        let pt = null; try { pt = localStorage.getItem('you_tpl'); } catch (e) {}
        if (pt) setTimeout(() => ShareTpl.open(), 900);
      }
    } catch (e) {
      console.error('Screen render error on', path, e);
      const el = mount();
      if (el) {
        el.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#9D9A92;font-family:monospace;font-size:12px;line-height:1.7;background:#1A1C22;min-height:100vh;">'
          + '<div style="font-size:14px;color:#F87171;margin-bottom:16px;">Ошибка: ' + _h(path) + '</div>'
          + '<div style="color:#F59E0B;word-break:break-all;max-width:600px;margin:0 auto;">' + _h(e.message||'Unknown') + '</div>'
          + '<div style="color:#555;margin-top:8px;font-size:10px;word-break:break-all;max-width:600px;margin:8px auto;">' + (e.stack||'').split('\\n').slice(0,3).map(_h).join('<br>') + '</div>'
          + '<button onclick="location.reload(true)" style="margin-top:20px;padding:10px 20px;background:#4A7CFF;color:#fff;border:none;border-radius:8px;cursor:pointer;">Перезагрузить</button>'
          + '</div>';
      }
    }
    window.scrollTo(0, keepScroll ? prevY : 0);
  }

  window.addEventListener('hashchange', render);

  return { go, render, currentPath };
})();
