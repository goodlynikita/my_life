import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, push, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const _fbApp = initializeApp(window.FIREBASE_CONFIG);
const _db    = getDatabase(_fbApp);
const _auth  = getAuth(_fbApp);

/* ── Путь к данным пользователя ── */
function userRoot() {
  const user = _auth.currentUser;
  if (!user) return null;
  /* Владелец определяется по email — использует старый путь nik-data */
  const ownerEmail = window.AUTH_CONFIG?.ownerEmail;
  if (ownerEmail && user.email === ownerEmail) return 'nik-data';
  /* Остальные пользователи — изолированный путь */
  return 'users/' + user.uid;
}

const FirebaseSync = (() => {
  let _loaded  = false;
  let _pollTimer = null;
  let _lastWriteAt = 0;
  let _flushTimer = null;
  const _queue = new Map();
  let hideTimer = null;
  let _flushing = false;

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
    _flushing = true;
    _lastWriteAt = Date.now();
    setStatus('Сохранение…');
    try {
      const sections = new Set();
      for (const [path] of entries) sections.add(path.split('.')[0]);
      for (const top of sections) {
        const data = Store.get()[top];
        if (data !== undefined) await set(ref(_db, root + '/' + top), sanitizeKeys(data));
      }
      _flushing = false;
      _lastWriteAt = Date.now();
      setStatus('Сохранено');
    } catch(e) {
      _flushing = false;
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
    /* Не тянем, пока есть неотправленные правки — иначе старая версия
       с сервера затрёт свежие изменения (удалённое «воскресает») */
    if (_queue.size > 0 || _flushing) return;
    if (Date.now() - _lastWriteAt < 10000) return;
    try {
      const snap = await get(ref(_db, root));
      if (!snap.exists()) return;
      if (_queue.size > 0 || _flushing) return; /* пока ждали ответ — появились правки */
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
        (remote?.training?.plans && remote.training.plans.length > 0) ||
        remote?.finance?.years ||
        remote?.goals?.directions ||
        (remote?.habits?.list && remote.habits.list.length > 0)
      );
      if (hasData) { Store.replaceAll(remote); setStatus('Данные загружены'); }
      /* Если у пользователя нет данных но он владелец - данные уже в nik-data */
      _loaded = true;
      if (!_pollTimer) _pollTimer = setInterval(_silentPull, 300000); /* 5 минут */
      return hasData ? true : false;
    } catch(e) {
      console.error('pullIntoStore failed', e);
      setStatus('Нет связи', true);
      _loaded = false;
      return 'error';
    }
  }

  /* При сворачивании отправляем ТОЛЬКО несохранённые правки.
     Раньше тут целиком перезаписывался весь корень данных локальной копией —
     если на другом устройстве данные были новее, они затирались, и удалённые
     тренировки/цели «возвращались». */
  function _pushBeacon() {
    const root = userRoot();
    if (!_loaded || !root) return;
    if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
    if (_queue.size > 0) _flushQueue();
  }

  let _hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      /* Вернулись в приложение — подтягиваем свежие данные с других устройств */
      if (Date.now() - _hiddenAt > 15000) _silentPull();
    } else {
      _hiddenAt = Date.now();
      _pushBeacon();
    }
  });
  window.addEventListener('pagehide', _pushBeacon);

  /* ── Firebase Auth API ── */
  /* ── Счётчик пользователей и лимит бесплатных мест ──
     stats/usersCount — сколько зарегистрировано (правила: читать всем, писать залогиненным) */
  function freeLimit() { return (window.APP_CONFIG && window.APP_CONFIG.freeUsersLimit) || 1000; }

  async function getUsersCount() {
    try {
      const snap = await Promise.race([
        get(ref(_db, 'stats/usersCount')),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))
      ]);
      const v = snap.exists() ? Number(snap.val()) : 0;
      return isFinite(v) ? v : 0;
    } catch (e) { return null; } /* нет доступа / нет сети — счётчик просто не показываем */
  }

  async function register(email, password, displayName) {
    const limit = freeLimit();
    const before = await getUsersCount();
    if (before !== null && before >= limit) { const e = new Error('limit'); e.code = 'app/limit-reached'; throw e; }
    const cred = await createUserWithEmailAndPassword(_auth, email, password);
    /* Бронируем место атомарно: если пока регистрировались, места кончились — откатываем аккаунт */
    try {
      const tx = await runTransaction(ref(_db, 'stats/usersCount'), (c) => {
        c = Number(c) || 0;
        if (c >= limit) return; /* abort */
        return c + 1;
      });
      if (!tx.committed) {
        try { await deleteUser(cred.user); } catch (e) {}
        const e = new Error('limit'); e.code = 'app/limit-reached'; throw e;
      }
    } catch (e) {
      if (e.code === 'app/limit-reached') throw e;
      console.warn('usersCount not updated (проверь правила stats в Firebase)', e);
    }
    if (displayName) await updateProfile(cred.user, { displayName });
    return cred.user;
  }

  /* ── Обратная связь → feedback/{id} ── */
  async function sendFeedback(data) {
    const u = _auth.currentUser;
    const payload = {
      type: data.type || 'other', text: String(data.text || '').slice(0, 4000),
      contact: String(data.contact || '').slice(0, 200),
      uid: u ? u.uid : null, email: u ? u.email : null,
      at: new Date().toISOString(), ua: navigator.userAgent.slice(0, 200)
    };
    await Promise.race([
      push(ref(_db, 'feedback'), payload),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
    ]);
    return true;
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
    getUsersCount, sendFeedback, freeLimit,
    getConfig: () => window.FIREBASE_CONFIG
  };
})();

window.FirebaseSync = FirebaseSync;
