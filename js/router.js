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
    const loggedRole = Auth.role();

    if (!loggedRole && path !== '/login') {
      path = '/login';
      location.hash = path;
      return;
    }
    if (loggedRole === 'coach' && path !== '/training') {
      path = '/training';
      location.hash = path;
      return;
    }
    if (loggedRole && path === '/login') {
      path = loggedRole === 'coach' ? '/training' : '/home';
      location.hash = path;
      return;
    }

    const handler = routes[path] || routes['/login'];
    handler();
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', render);

  return { go, render, currentPath };
})();
