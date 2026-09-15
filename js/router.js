/* ============================================================
   ROUTER — hash-based, role-aware
   Coach role is locked to /training only.
   ============================================================ */

const Router = (() => {
  const mount = () => document.getElementById('app');

  const routes = {
    '/login': () => Screens.login(mount()),
    '/home': () => Screens.home(mount()),
    '/training': () => Screens.training(mount()),
    '/habits': () => Screens.habits(mount()),
    '/finance': () => Screens.finance(mount()),
    '/goals': () => Screens.goals(mount()),
  };

  function currentPath() {
    return location.hash.replace('#', '') || '/login';
  }

  function go(path) {
    location.hash = path;
  }

  function render() {
    let path = currentPath();
    const loggedIn = Auth.isLoggedIn();

    if (!loggedIn && path !== '/login') {
      path = '/login';
      location.hash = path;
      return;
    }
    if (loggedIn && path === '/login') {
      path = '/home';
      location.hash = path;
      return;
    }

    const handler = routes[path] || routes['/login'];
    try {
      handler();
    } catch (e) {
      console.error('Screen render error on', path, e);
      const el = mount();
      if (el) {
        el.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#9D9A92;font-family:monospace;font-size:12px;line-height:1.7;background:#1A1C22;min-height:100vh;">'
          + '<div style="font-size:14px;color:#F87171;margin-bottom:16px;">Ошибка: ' + path + '</div>'
          + '<div style="color:#F59E0B;word-break:break-all;max-width:600px;margin:0 auto;">' + (e.message||'Unknown') + '</div>'
          + '<div style="color:#555;margin-top:8px;font-size:10px;word-break:break-all;max-width:600px;margin:8px auto;">' + (e.stack||'').split('\\n').slice(0,3).join('<br>') + '</div>'
          + '<button onclick="location.reload(true)" style="margin-top:20px;padding:10px 20px;background:#4A7CFF;color:#fff;border:none;border-radius:8px;cursor:pointer;">Перезагрузить</button>'
          + '</div>';
      }
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', render);

  return { go, render, currentPath };
})();
