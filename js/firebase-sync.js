/* ============================================================
   FIREBASE SYNC — official Firebase SDK
   Данные разделены по роли пользователя:
     nik-data/owner  — данные владельца (Никита)
     nik-data/coach  — данные тренера
   Это гарантирует что они никогда не затирают друг друга,
   как в "Бегу к себе" где у каждого свой ключ в Firebase.
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const FirebaseSync = (() => {
  let statusEl = null;
  let hideTimer = null;
  let fbApp = null;
  let db = null;
  let ready = false;

  function getConfig() {
    if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL) {
      return window.FIREBASE_CONFIG;
    }
    return null;
  }

  function setConfig() {}
  function clearConfig() {}

  function isConfigured() {
    return !!getConfig();
  }

  /* Путь в Firebase зависит от роли — owner или coach.
     Каждый читает и пишет только в своё место. */
  function dataPath() {
    const role = (window.Auth && Auth.role()) || 'owner';
    return 'nik-data/' + role;
  }

  function sanitizeKeys(value) {
    if (Array.isArray(value)) return value.map(sanitizeKeys);
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value)) {
        const safeKey = key.replace(/[.#$/\[\]]/g, '');
        out[safeKey] = sanitizeKeys(value[key]);
      }
      return out;
    }
    return value;
  }

  function ensureInitialized() {
    if (db) return db;
    const cfg = getConfig();
    if (!cfg) return null;
    fbApp = initializeApp(cfg);
    db = getDatabase(fbApp);
    return db;
  }

  function setStatus(text, isError) {
    statusEl = document.getElementById('sync-status');
    if (!statusEl) return;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    statusEl.textContent = text;
    statusEl.style.color = isError ? '#FF5C5C' : '#9D9A92';
    statusEl.style.opacity = '1';
    if (!isError) {
      hideTimer = setTimeout(() => {
        if (statusEl) statusEl.style.opacity = '0';
      }, 2500);
    }
  }

  async function pullIntoStore() {
    const database = ensureInitialized();
    if (!database) { ready = true; return 'error'; }
    try {
      const snap = await Promise.race([
        get(ref(database, dataPath())),
        new Promise((_, reject) => setTimeout(() => reject(new Error('firebase-timeout')), 6000))
      ]);
      const remote = snap.exists() ? snap.val() : null;
      const hasRealData = remote && remote.training
        && Array.isArray(remote.training.plans) && remote.training.plans.length > 0;
      if (hasRealData) {
        Store.replaceAll(remote);
        setStatus('Данные загружены');
        return true;
      }
      return false;
    } catch (e) {
      console.error('FirebaseSync.pullIntoStore failed', e);
      setStatus('Firebase недоступен', true);
      return 'error';
    } finally {
      ready = true;
    }
  }

  async function pushNow() {
    const database = ensureInitialized();
    if (!database) return;
    const d = Store.get();
    const hasPlans = d && d.training && Array.isArray(d.training.plans) && d.training.plans.length > 0;
    if (!hasPlans) {
      console.warn('FirebaseSync.pushNow: нет планов, пропускаем');
      return;
    }
    setStatus('Сохранение…');
    try {
      await set(ref(database, dataPath()), sanitizeKeys(d));
      setStatus('Сохранено');
    } catch (e) {
      console.error('FirebaseSync.pushNow failed', e);
      setStatus('Ошибка сохранения', true);
    }
  }

  function scheduleSave() {
    if (!ready) return;
    setStatus('Сохранение…');
    pushNow();
  }

  function pushBeacon() {
    const database = ensureInitialized();
    if (!database) return;
    try {
      set(ref(database, dataPath()), sanitizeKeys(Store.get())).catch(() => {});
    } catch (e) {}
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') pushBeacon();
  });
  window.addEventListener('pagehide', pushBeacon);

  return { getConfig, setConfig, clearConfig, isConfigured, pullIntoStore, pushNow, scheduleSave };
})();

window.FirebaseSync = FirebaseSync;
