import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, push, update, runTransaction, onValue, increment } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
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
    /* обычные «Сохранение / Сохранено / Данные загружены» не показываем: плашка мешала кнопкам и тостам.
       Показываем только то, что требует внимания */
    if (!isError && /^(Сохранение|Сохранено|Данные загружены)/.test(text)) { el.style.opacity = '0'; return; }
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
      /* Клиента ведёт тренер: если тренер успел поменять план — сначала берём его версию */
      if (sections.has('training') && _myTrainer && !isCoachUser(_auth.currentUser)) {
        try {
          const rs = await get(ref(_db, root + '/training/coachRev'));
          const srv = rs.exists() ? +rs.val() : 0, loc = +((Store.get().training || {}).coachRev || 0);
          if (srv > loc) {
            const ts = await get(ref(_db, root + '/training'));
            const cur = Store.get(); cur.training = ts.val() || cur.training; Store.replaceAll(cur);
            sections.delete('training');
            window.dispatchEvent(new CustomEvent('coach-plan-update', { detail: { conflict: true } }));
          }
        } catch (e) {}
      }
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

  /* ── Аналитика: только счётчики, без самих данных ──
     userIndex/{uid}/m = { c: {раздел: число}, d: {ГГГГММДД: 1}, pwa, nps }
     userIndex/{uid}/errs/e0..e4 = последние ошибки
     userIndex/{uid}/ref = откуда пришёл; refs/{кто позвал}/{uid} = для счётчика у пригласившего */
  async function track(c, day, extra) {
    const u = _auth.currentUser; if (!u || isCoachUser(u)) return;
    const base = 'userIndex/' + u.uid + '/m/', upd = {};
    Object.keys(c || {}).forEach(k => { if (c[k] > 0 && /^[a-z]{2,12}$/.test(k)) upd[base + 'c/' + k] = increment(c[k]); });
    if (day) upd[base + 'd/' + day] = 1;
    Object.keys(extra || {}).forEach(k => { if (/^(pwa|nps|w\/\d{8})$/.test(k)) upd[base + k] = extra[k]; });
    if (!Object.keys(upd).length) return;
    try { await update(ref(_db), upd); } catch (e) {}
  }
  let _errN = 0;
  async function logError(info) {
    const u = _auth.currentUser; if (!u || isCoachUser(u) || _errN >= 5) return;
    const slot = 'e' + (Math.floor(Date.now() / 1000) % 5); _errN++;
    try { await set(ref(_db, 'userIndex/' + u.uid + '/errs/' + slot), { msg: String(info.msg || '').slice(0, 300), src: String(info.src || '').slice(0, 160), scr: String(info.scr || '').slice(0, 60), at: new Date().toISOString(), ua: (navigator.userAgent || '').slice(0, 160) }); } catch (e) {}
  }
  /* Источник регистрации: ссылка друга, тренера или кабинета тренера */
  async function saveReferral(user, name) {
    let r = null, join = null;
    try { r = JSON.parse(localStorage.getItem('you_ref') || 'null'); join = localStorage.getItem('you_join'); } catch (e) {}
    let by = null, kind = null;
    if (join) { try { const inv = await findInvite(join); if (inv && inv.trainerUid) { by = inv.trainerUid; kind = 'client'; } } catch (e) {} }
    if (!by && r && r.by && r.by !== user.uid) { by = String(r.by).slice(0, 64); kind = r.kind === 'trainer' ? 'trainer' : 'friend'; }
    if (!by) return;
    const at = Date.now();
    try { await set(ref(_db, 'userIndex/' + user.uid + '/ref'), { by, kind, at }); } catch (e) {}
    try { await set(ref(_db, 'refs/' + by + '/' + user.uid), { kind, at, name: String(name || user.displayName || '').slice(0, 60) }); } catch (e) {}
    try { localStorage.removeItem('you_ref'); } catch (e) {}
  }
  async function myRefs() {
    const u = _auth.currentUser; if (!u) return null;
    try { const s = await get(ref(_db, 'refs/' + u.uid)); return s.exists() ? s.val() : {}; } catch (e) { return null; }
  }
  async function getIndexMeta() {
    const u = _auth.currentUser; if (!u) return null;
    try { const s = await get(ref(_db, 'userIndex/' + u.uid + '/m')); return s.exists() ? s.val() : {}; } catch (e) { return null; }
  }

  /* Личное сообщение от админа: userIndex/{uid}/notice = {text, at}; прочитано → noticeSeen = at */
  let _myIndex = null;
  async function getNotice(user) {
    if (!user) return null;
    try {
      const snap = await get(ref(_db, 'userIndex/' + user.uid));
      const v = snap.exists() ? snap.val() : {}; _myIndex = v;
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
    saveReferral(cred.user, displayName);
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
    if (data.score != null) payload.score = Math.max(0, Math.min(10, Math.round(+data.score) || 0));
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
    try { _myTrainer = null; stopWatch(); if (_linkUnsub) { _linkUnsub(); _linkUnsub = null; } } catch (e) {}
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

  /* ════════ Тренеры и клиенты (B2B) ════════
     trainers/{uid}            — профиль тренера (name, code, limit)
     invites/{code}            — код приглашения → тренер
     clientTrainer/{key}       — у клиента (key = uid или 'nik-data') его тренер
     trainerClients/{t}/{key}  — список клиентов тренера
     Тренер пишет только в training клиента и ставит training.coachRev */
  let _myTrainer = null, _revUnsub = null;
  const myKey = () => rootKeyFor(_auth.currentUser);
  function genCode() { const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 6; i++) c += a[Math.floor(Math.random() * a.length)]; return c; }
  async function isTrainer() { const u = _auth.currentUser; if (!u || isCoachUser(u)) return false; try { return (await get(ref(_db, 'trainers/' + u.uid))).exists(); } catch (e) { return false; } }
  async function becomeTrainer(name) {
    const u = _auth.currentUser; if (!u) throw new Error('auth');
    const ex = await get(ref(_db, 'trainers/' + u.uid)); if (ex.exists()) return ex.val();
    let code = genCode();
    for (let i = 0; i < 5 && (await get(ref(_db, 'invites/' + code))).exists(); i++) code = genCode();
    const t = { name: String(name || u.displayName || u.email.split('@')[0]).slice(0, 60), email: u.email, createdAt: Date.now(), tier: 'free', limit: 50, code };
    await set(ref(_db, 'trainers/' + u.uid), t);
    await set(ref(_db, 'invites/' + code), { trainerUid: u.uid, name: t.name, createdAt: Date.now() });
    return t;
  }
  async function findInvite(code) {
    code = String(code || '').trim().toUpperCase(); if (!code) return null;
    const s = await get(ref(_db, 'invites/' + code)); return s.exists() ? { code, ...s.val() } : null;
  }
  async function myTrainer() {
    const k = myKey(); if (!k || isCoachUser(_auth.currentUser)) return null;
    try { const s = await get(ref(_db, 'clientTrainer/' + k)); _myTrainer = s.exists() ? s.val() : null; } catch (e) { _myTrainer = null; }
    await cleanupPrev(k);
    if (_myTrainer) watchCoachRev(); else stopWatch();
    watchLink();
    return _myTrainer;
  }
  /* Новый тренер подключился по ключу → убираем себя из списка прежнего */
  async function cleanupPrev(k) {
    const t = _myTrainer; if (!t || !t.prev || t.prev === t.trainerUid) return;
    try { await set(ref(_db, 'trainerClients/' + t.prev + '/' + k), null); await set(ref(_db, 'clientTrainer/' + k + '/prev'), null); } catch (e) {}
    delete t.prev;
  }
  /* Следим за связью с тренером: тренер может подключиться по ключу в любой момент */
  let _linkUnsub = null;
  function watchLink() {
    if (_linkUnsub) return; const k = myKey(); if (!k) return;
    _linkUnsub = onValue(ref(_db, 'clientTrainer/' + k), async (snap) => {
      const v = snap.exists() ? snap.val() : null;
      const was = _myTrainer ? _myTrainer.trainerUid : null, now = v ? v.trainerUid : null;
      _myTrainer = v;
      if (v) { await cleanupPrev(k); watchCoachRev(); } else stopWatch();
      if (was !== now) window.dispatchEvent(new CustomEvent('trainer-link-change', { detail: { trainer: v } }));
    }, () => {});
  }

  /* ── Ключ доступа: клиент выдаёт его тренеру сам ──
     accessKeys/{KEY} = { key, uid, root, name, email, createdAt, expiresAt, prev } */
  const KEY_TTL = 24 * 3600 * 1000;
  function genKey() { const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 8; i++) c += a[Math.floor(Math.random() * a.length)]; return c; }
  async function createAccessKey(fullName) {
    const u = _auth.currentUser; if (!u) throw { code: 'auth' };
    await revokeAccessKey();
    let code = genKey();
    for (let i = 0; i < 5 && (await get(ref(_db, 'accessKeys/' + code))).exists(); i++) code = genKey();
    const now = Date.now(), cur = _myTrainer || await myTrainer();
    const rec = { key: myKey(), uid: u.uid, root: userRoot(), name: String(fullName).slice(0, 80), email: u.email || '', createdAt: now, expiresAt: now + KEY_TTL };
    if (cur) rec.prev = cur.trainerUid;
    await set(ref(_db, 'accessKeys/' + code), rec);
    try { localStorage.setItem('you_akey_' + u.uid, JSON.stringify({ code, expiresAt: rec.expiresAt, name: rec.name })); } catch (e) {}
    watchLink();
    return { code, ...rec };
  }
  function myAccessKey() {
    const u = _auth.currentUser; if (!u) return null;
    try { const v = JSON.parse(localStorage.getItem('you_akey_' + u.uid) || 'null'); return v && v.expiresAt > Date.now() ? v : null; } catch (e) { return null; }
  }
  async function revokeAccessKey() {
    const u = _auth.currentUser; if (!u) return;
    let v = null; try { v = JSON.parse(localStorage.getItem('you_akey_' + u.uid) || 'null'); } catch (e) {}
    if (v && v.code) { try { await set(ref(_db, 'accessKeys/' + v.code), null); } catch (e) {} }
    try { localStorage.removeItem('you_akey_' + u.uid); } catch (e) {}
  }
  async function connectTrainer(code, fullName) {
    const u = _auth.currentUser; if (!u) throw { code: 'auth' };
    const inv = await findInvite(code); if (!inv) throw { code: 'not-found' };
    if (inv.trainerUid === u.uid) throw { code: 'self' };
    if (inv.full) throw { code: 'full' };
    const k = myKey(); const old = await myTrainer();
    if (old && old.trainerUid !== inv.trainerUid) { try { await set(ref(_db, 'trainerClients/' + old.trainerUid + '/' + k), null); } catch (e) {} }
    const now = Date.now();
    await set(ref(_db, 'clientTrainer/' + k), { trainerUid: inv.trainerUid, name: inv.name || 'Тренер', code: inv.code, since: now, uid: u.uid });
    await set(ref(_db, 'trainerClients/' + inv.trainerUid + '/' + k), { uid: u.uid, email: u.email || '', name: String(fullName || u.displayName || '').slice(0, 80), code: inv.code, since: now, root: userRoot() });
    _myTrainer = { trainerUid: inv.trainerUid, name: inv.name, code: inv.code, since: now };
    watchCoachRev();
    return _myTrainer;
  }
  async function disconnectTrainer() {
    const k = myKey(); const t = _myTrainer || await myTrainer(); if (!t) return;
    try { await set(ref(_db, 'trainerClients/' + t.trainerUid + '/' + k), null); } catch (e) {}
    await set(ref(_db, 'clientTrainer/' + k), null);
    _myTrainer = null; stopWatch();
  }
  /* Тренер поменял план → сразу подтягиваем тренировки */
  function watchCoachRev() {
    if (_revUnsub) return; const root = userRoot(); if (!root) return;
    _revUnsub = onValue(ref(_db, root + '/training/coachRev'), async (snap) => {
      const srv = snap.exists() ? +snap.val() : 0, loc = +((Store.get().training || {}).coachRev || 0);
      if (!srv || srv <= loc || _queue.size > 0 || _flushing) return;
      try {
        const ts = await get(ref(_db, root + '/training'));
        if (!ts.exists()) return;
        const cur = Store.get(); cur.training = ts.val(); Store.replaceAll(cur);
        window.dispatchEvent(new CustomEvent('coach-plan-update', { detail: {} }));
      } catch (e) {}
    });
  }
  function stopWatch() { if (_revUnsub) { try { _revUnsub(); } catch (e) {} _revUnsub = null; } }

  return {
    isTrainer, becomeTrainer, findInvite, myTrainer, createAccessKey, myAccessKey, revokeAccessKey, connectTrainer, disconnectTrainer, myTrainerCached: () => _myTrainer,
    isConfigured, pullIntoStore, scheduleSave, resetPassword, idToken,
    pushNow: _pushBeacon,
    register, login, logout, onAuth, currentUser,
    getUsersCount, sendFeedback, freeLimit, loadSettings, touchUserIndex, isBlocked,
    getNotice, markNoticeSeen, getAnnouncement, myIndexCached: () => _myIndex, track, logError, myRefs, getIndexMeta, saveReferral,
    isCoach: () => isCoachUser(_auth.currentUser), getCoach, setCoachPassword, setCoachEnabled, removeCoach,
    getConfig: () => window.FIREBASE_CONFIG
  };
})();

window.FirebaseSync = FirebaseSync;
