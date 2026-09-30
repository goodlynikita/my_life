import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, push, update, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
  deleteUser,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const _fbApp = initializeApp(window.FIREBASE_CONFIG);
const _db    = getDatabase(_fbApp);
const _auth  = getAuth(_fbApp);

/* ── Тренер ──
   Тренер входит с email владельца и своим паролем. Под капотом это отдельный
   технический аккаунт @coach.you-app. Доступ к данным: только training,
   это проверяют правила Firebase (coaches/{ключ}.uid + enabled). */
const COACH_DOMAIN = 'coach.you-app';
function isCoachUser(u) { return !!(u && u.email && u.email.toLowerCase().endsWith('@' + COACH_DOMAIN)); }
let _coachRoot = null;           /* 'nik-data' или 'users/<uid>' владельца данных */
function rootKeyFor(u) {         /* ключ данных владельца: 'nik-data' или uid */
  const ownerEmail = window.AUTH_CONFIG?.ownerEmail;
  return (ownerEmail && u && u.email === ownerEmail) ? 'nik-data' : (u ? u.uid : null);
}
async function sha256(t) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(t).trim().toLowerCase()));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ── Путь к данным пользователя ── */
function userRoot() {
  const user = _auth.currentUser;
  if (!user) return null;
  if (isCoachUser(user)) return _coachRoot;
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
      if (isCoachUser(_auth.currentUser)) [...sections].forEach(t => { if (t !== 'training') sections.delete(t); });
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
      const coach = isCoachUser(_auth.currentUser);
      const snap = await get(ref(_db, coach ? root + '/training' : root));
      if (!snap.exists()) return;
      if (_queue.size > 0 || _flushing) return; /* пока ждали ответ — появились правки */
      Store.replaceAll(coach ? { training: snap.val() } : snap.val());
      window.dispatchEvent(new CustomEvent('firebase-remote-update'));
    } catch(e) {}
  }

  async function resolveCoachRoot() {
    const u = _auth.currentUser;
    if (!isCoachUser(u)) return null;
    const snap = await get(ref(_db, 'coachLinks/' + u.uid));
    const key = snap.exists() ? snap.val() : null;
    _coachRoot = key ? (key === 'nik-data' ? 'nik-data' : 'users/' + key) : null;
    return _coachRoot;
  }

  async function pullIntoStore() {
    if (isCoachUser(_auth.currentUser)) {
      try {
        const root = await resolveCoachRoot();
        if (!root) { setStatus('Доступ тренера не найден', true); return 'error'; }
        const snap = await get(ref(_db, root + '/training'));
        Store.replaceAll({ training: snap.exists() ? snap.val() : { plans: [], measurements: [] } });
        _loaded = true;
        setStatus('Данные загружены');
        if (!_pollTimer) _pollTimer = setInterval(_silentPull, 300000);
        return true;
      } catch (e) {
        console.error('coach pull failed', e);
        setStatus('Доступ тренера закрыт', true);
        _loaded = false;
        return 'error';
      }
    }
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
  /* ── Настройки из админки (settings/*, читаются всеми) ── */
  let _settings = null;
  async function loadSettings() {
    try {
      const snap = await Promise.race([
        get(ref(_db, 'settings')),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))
      ]);
      _settings = snap.exists() ? snap.val() : {};
    } catch (e) { _settings = _settings || {}; }
    window.APP_CONFIG = window.APP_CONFIG || {};
    if (_settings.freeUsersLimit) window.APP_CONFIG.freeUsersLimit = Number(_settings.freeUsersLimit);
    if (_settings.supportUrl) window.APP_CONFIG.supportUrl = _settings.supportUrl;
    window.APP_CONFIG.registrationOpen = _settings.registrationOpen !== false;
    return window.APP_CONFIG;
  }

  /* ── Реестр пользователей для админки: userIndex/{uid} ──
     Пишем только свои поля (правила не дают трогать blocked) */
  async function touchUserIndex(user) {
    if (!user || isCoachUser(user)) return;
    const base = 'userIndex/' + user.uid + '/';
    const upd = {};
    upd[base + 'email'] = user.email || '';
    if (user.displayName) upd[base + 'name'] = user.displayName;
    upd[base + 'lastSeen'] = new Date().toISOString();
    upd[base + 'ua'] = (navigator.userAgent || '').slice(0, 180);
    const created = user.metadata && user.metadata.creationTime ? new Date(user.metadata.creationTime).toISOString() : new Date().toISOString();
    upd[base + 'createdAt'] = created;
    try { await update(ref(_db), upd); } catch (e) { /* правила ещё не обновлены — не критично */ }
  }

  /* Личное сообщение от админа: userIndex/{uid}/notice = {text, at}; прочитано → noticeSeen = at */
  async function getNotice(user) {
    if (!user) return null;
    try {
      const snap = await get(ref(_db, 'userIndex/' + user.uid));
      const v = snap.exists() ? snap.val() : {};
      if (v.notice && v.notice.text && v.notice.at !== v.noticeSeen) return v.notice;
    } catch (e) {}
    return null;
  }
  async function markNoticeSeen(user, at) {
    if (!user) return;
    try { await set(ref(_db, 'userIndex/' + user.uid + '/noticeSeen'), at); } catch (e) {}
  }
  function getAnnouncement() {
    const a = _settings && _settings.announcement;
    return a && a.active && a.text ? a : null;
  }

  async function isBlocked(user) {
    if (!user || isCoachUser(user)) return false;
    try {
      const snap = await get(ref(_db, 'userIndex/' + user.uid + '/blocked'));
      return snap.exists() && snap.val() === true;
    } catch (e) { return false; }
  }

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
    await loadSettings();
    if (window.APP_CONFIG.registrationOpen === false) { const e = new Error('closed'); e.code = 'app/registration-closed'; throw e; }
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
    touchUserIndex(cred.user);
    return cred.user;
  }

  /* ── Управление тренером (из шапки тренировок) ── */
  async function getCoach() {
    const u = _auth.currentUser; if (!u || isCoachUser(u)) return null;
    const snap = await get(ref(_db, 'coaches/' + rootKeyFor(u)));
    return snap.exists() ? snap.val() : null;
  }
  async function setCoachPassword(password) {
    const u = _auth.currentUser; if (!u || isCoachUser(u)) throw new Error('no user');
    const key = rootKeyFor(u);
    /* Отдельный экземпляр Firebase, чтобы создание аккаунта тренера не разлогинило тебя */
    const second = initializeApp(window.FIREBASE_CONFIG, 'coach-setup-' + Date.now());
    const auth2 = getAuth(second);
    const alias = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + '@' + COACH_DOMAIN;
    const cred = await createUserWithEmailAndPassword(auth2, alias, password);
    const coachUid = cred.user.uid;
    try { await signOut(auth2); } catch (e) {}
    await set(ref(_db, 'coachLinks/' + coachUid), key);
    await set(ref(_db, 'coaches/' + key), { uid: coachUid, enabled: true, updatedAt: new Date().toISOString() });
    await set(ref(_db, 'coachAlias/' + await sha256(u.email)), alias);
    return true;
  }
  async function setCoachEnabled(on) {
    const u = _auth.currentUser; if (!u || isCoachUser(u)) return;
    await set(ref(_db, 'coaches/' + rootKeyFor(u) + '/enabled'), !!on);
  }
  async function removeCoach() {
    const u = _auth.currentUser; if (!u || isCoachUser(u)) return;
    await set(ref(_db, 'coaches/' + rootKeyFor(u)), null);
    await set(ref(_db, 'coachAlias/' + await sha256(u.email)), null);
  }

  /* ── Обратная связь → feedback/{id} ── */
  async function sendFeedback(data) {
    const u = _auth.currentUser;
    const payload = {
      type: data.type || 'other', text: String(data.text || '').slice(0, 4000),
      contact: String(data.contact || '').slice(0, 200),
      telegram: String(data.telegram || '').slice(0, 64),
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
    let cred;
    try {
      cred = await signInWithEmailAndPassword(_auth, email, password);
    } catch (e) {
      /* Не подошёл пароль владельца — может, это пароль тренера */
      let alias = null;
      try { const a = await get(ref(_db, 'coachAlias/' + await sha256(email))); alias = a.exists() ? a.val() : null; } catch (x) {}
      if (!alias) throw e;
      cred = await signInWithEmailAndPassword(_auth, alias, password); /* ошибка → «неверный пароль» */
      _coachRoot = null;
      return cred.user;
    }
    if (await isBlocked(cred.user)) {
      await signOut(_auth);
      const e = new Error('blocked'); e.code = 'app/blocked'; throw e;
    }
    touchUserIndex(cred.user);
    return cred.user;
  }

  async function logout() {
    _loaded = false;
    _coachRoot = null;
    Store.replaceAll(Store.defaultData ? Store.defaultData() : {});
    await signOut(_auth);
  }

  function onAuth(callback) {
    return onAuthStateChanged(_auth, callback);
  }

  function currentUser() {
    return _auth.currentUser;
  }

  /* Сброс пароля: Firebase присылает письмо со ссылкой */
  async function idToken() { return _auth && _auth.currentUser ? _auth.currentUser.getIdToken() : null; }

  async function resetPassword(email) {
    if (!_auth) throw new Error('not-configured');
    try { _auth.languageCode = 'ru'; } catch (e) {}
    await sendPasswordResetEmail(_auth, String(email || '').trim());
  }

  return {
    isConfigured, pullIntoStore, scheduleSave, resetPassword, idToken,
    pushNow: _pushBeacon,
    register, login, logout, onAuth, currentUser,
    getUsersCount, sendFeedback, freeLimit, loadSettings, touchUserIndex, isBlocked,
    getNotice, markNoticeSeen, getAnnouncement,
    isCoach: () => isCoachUser(_auth.currentUser), getCoach, setCoachPassword, setCoachEnabled, removeCoach,
    getConfig: () => window.FIREBASE_CONFIG
  };
})();

window.FirebaseSync = FirebaseSync;
