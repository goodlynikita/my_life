/* ============================================================
   AUTH — теперь через Firebase Authentication
   Владелец: входит по email (из config.js)
   Остальные: регистрируются сами, данные изолированы
   ============================================================ */

const Auth = (() => {
  function role() {
    const user = window.FirebaseSync?.currentUser();
    if (!user) return null;
    /* Владелец определяется по email из конфига */
    if (window.AUTH_CONFIG?.ownerEmail && user.email === window.AUTH_CONFIG.ownerEmail) {
      return 'owner';
    }
    return 'user';
  }

  function isLoggedIn() {
    return !!window.FirebaseSync?.currentUser();
  }

  async function attemptLogin(email, password) {
    try {
      await window.FirebaseSync.login(email, password);
      return role();
    } catch(e) {
      console.error('login failed', e);
      return null;
    }
  }

  async function register(email, password, displayName) {
    try {
      await window.FirebaseSync.register(email, password, displayName);
      return role();
    } catch(e) {
      console.error('register failed', e);
      throw e;
    }
  }

  async function logout() {
    await window.FirebaseSync.logout();
  }

  function currentUser() {
    return window.FirebaseSync?.currentUser();
  }

  /* Legacy hash — оставляем для обратной совместимости */
  async function hash(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  return { attemptLogin, register, logout, role, isLoggedIn, currentUser, hash };
})();
