import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const _fbApp = initializeApp(window.FIREBASE_CONFIG);
const _db    = getDatabase(_fbApp);
const _auth  = getAuth(_fbApp);

/* ── Путь к данным пользователя ── */
function userRoot() {
  const uid = _auth.currentUser?.uid;
  /* Владелец использует старый путь nik-data для совместимости */
  if (uid && uid === window._OWNER_UID) return 'nik-data';
  return uid ? 'users/' + uid : null;
}

const FirebaseSync = (() => {
  let _loaded  = false;
  let _pollTimer = null;
  let _lastWriteAt = 0;
  let _flushTimer = null;
  const _queue = new Map();
  let hideTimer = null;

  function isConfigured() {
    return !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL);
  }

  function sanitizeKeys(value) {
    if (value === undefined || value === null) return null;
    if (Array.isArray(value)) return value.map(sanitizeKeys);
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value)) {
        const v = sanitizeKeys(value[key]);
        if (v !== undefined) out[key.replace(/[.#$\/\[\]]/g, '_')] = v;
      }
      return out;
    }
    if (typeof value === 'number' && !isFinite(value)) return null;
    return value;
  }

  function setStatus(text, isError) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    el.textContent = text;
    el.style.color = isError ? '#FF5C5C' : '#9D9A92';
    el.style.opacity = '1';
    if (!isError) hideTimer = setTimeout(() => { el.style.opacity = '0'; }, 2500);
  }

  async function _flushQueue() {
    const root = userRoot();
    if (!root || _queue.size === 0) return;
    const entries = [..._queue.entries()];
    _queue.clear();
    _lastWriteAt = Date.now();
    setStatus('Сохранение…');
    try {
      const sections = new Set();
      for (const [path] of entries) sections.add(path.split('.')[0]);
      for (const top of sections) {
        const data = Store.get()[top];
        if (data !== undefined) await set(ref(_db, root + '/' + top), sanitizeKeys(data));
      }
      setStatus('Сохранено');
    } catch(e) {
      console.error('flush failed', e);
      setStatus('Ошибка сохранения', true);
      for (const [p,v] of entries) _queue.set(p,v);
      setTimeout(_flushQueue, 3000);
    }
  }

  function scheduleSave(path, value) {
    if (!_loaded) return;
    _queue.set(path, value);
    if (_flushTimer) clearTimeout(_flushTimer);
    _flushTimer = setTimeout(_flushQueue, 600);
  }

  async function _silentPull() {
    const root = userRoot();
    if (!_loaded || !root) return;
    if (Date.now() - _lastWriteAt < 10000) return;
    try {
      const snap = await get(ref(_db, root));
      if (!snap.exists()) return;
      Store.replaceAll(snap.val());
      window.dispatchEvent(new CustomEvent('firebase-remote-update'));
    } catch(e) {}
  }

  async function pullIntoStore() {
    const root = userRoot();
    if (!root) { _loaded = true; return false; }
    try {
      const snap = await Promise.race([
        get(ref(_db, root)),
        new Promise((_,reject) => setTimeout(() => reject(new Error('timeout')), 8000))
      ]);
      const remote = snap.exists() ? snap.val() : null;
      const hasData = remote && (
        remote?.training?.plans?.length > 0 ||
        remote?.finance?.years ||
        remote?.goals?.directions ||
        remote?.habits?.list?.length > 0
      );
      if (hasData) { Store.replaceAll(remote); setStatus('Данные загружены'); }
      _loaded = true;
      if (!_pollTimer) _pollTimer = setInterval(_silentPull, 15000);
      return hasData ? true : false;
    } catch(e) {
      console.error('pullIntoStore failed', e);
      setStatus('Нет связи', true);
      _loaded = false;
      return 'error';
    }
  }

  function _pushBeacon() {
    const root = userRoot();
    if (!_loaded || !root) return;
    if (_queue.size > 0) _flushQueue();
    try { set(ref(_db, root), sanitizeKeys(Store.get())).catch(() => {}); } catch(e) {}
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') _silentPull();
    else _pushBeacon();
  });
  window.addEventListener('pagehide', _pushBeacon);

  /* ── Firebase Auth API ── */
  async function register(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(_auth, email, password);
    if (displayName) await updateProfile(cred.user, { displayName });
    return cred.user;
  }

  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(_auth, email, password);
    return cred.user;
  }

  async function logout() {
    _loaded = false;
    Store.replaceAll(Store.defaultData ? Store.defaultData() : {});
    await signOut(_auth);
  }

  function onAuth(callback) {
    return onAuthStateChanged(_auth, callback);
  }

  function currentUser() {
    return _auth.currentUser;
  }

  return {
    isConfigured, pullIntoStore, scheduleSave,
    pushNow: _pushBeacon,
    register, login, logout, onAuth, currentUser,
    getConfig: () => window.FIREBASE_CONFIG
  };
})();

window.FirebaseSync = FirebaseSync;
