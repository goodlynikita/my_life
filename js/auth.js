/* ============================================================
   AUTH — password gate with two roles: owner / coach
   Passwords are hashed (SHA-256) before comparison and storage.
   This protects against casual viewing of the source, not a
   determined attacker who can read the public repo's raw JSON.
   ============================================================ */

const Auth = (() => {
  const SESSION_KEY = 'nik_session_v1';

  // Hashes come from config.js — generate yours at generate-hash.html
  const CONFIG = window.AUTH_CONFIG || { ownerHash: '', coachHash: '' };

  async function hash(text) {
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setSession(role) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ role, at: Date.now() }));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function role() {
    const s = getSession();
    return s ? s.role : null;
  }

  function isLoggedIn() {
    return role() !== null;
  }

  async function attemptLogin(password) {
    const h = await hash(password);
    if (h === CONFIG.ownerHash) {
      setSession('owner');
      return 'owner';
    }
    if (h === CONFIG.coachHash) {
      setSession('coach');
      return 'coach';
    }
    return null;
  }

  function logout() {
    clearSession();
  }

  return { hash, attemptLogin, logout, role, isLoggedIn };
})();
