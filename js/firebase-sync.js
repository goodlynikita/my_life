/* ============================================================
   FIREBASE SYNC — точно как в "Бегу к себе"
   SDK инициализируется один раз глобально.
   Данные читаются при входе, пишутся при каждом изменении.
   Никакого кэша, никакого localStorage, никакого scheduleSave.
   Каждая роль читает/пишет в свой узел:
     nik-data/owner — данные владельца
     nik-data/coach — данные тренера
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

/* Инициализация один раз — как в "Бегу к себе" */
const _fbApp = initializeApp(window.FIREBASE_CONFIG);
const _db = getDatabase(_fbApp);

const FirebaseSync = (() => {
  let statusEl = null;
  let hideTimer = null;

  function isConfigured() {
    return !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL);
  }

  /* Путь зависит от роли — owner или coach */
  function dataPath() {
    const role = (window.Auth && Auth.role()) || 'owner';
    return 'nik-data/' + role;
  }

  /* Firebase запрещает . # $ / [ ] в ключах — чистим перед записью */
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

  /* Читаем данные из Firebase для текущей роли */
  async function pullIntoStore() {
    try {
      const snap = await Promise.race([
        get(ref(_db, dataPath())),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000))
      ]);
      const remote = snap.exists() ? snap.val() : null;
      const hasData = remote && remote.training
        && Array.isArray(remote.training.plans)
        && remote.training.plans.length > 0;
      if (hasData) {
        Store.replaceAll(remote);
        setStatus('Данные загружены');
        return true;
      }
      return false;
    } catch (e) {
      console.error('pullIntoStore failed', e);
      setStatus('Ошибка загрузки данных', true);
      return 'error';
    }
  }

  /* Пишем данные в Firebase — вызывается при каждом изменении */
  async function pushNow() {
    const d = Store.get();
    const hasPlans = d && d.training
      && Array.isArray(d.training.plans)
      && d.training.plans.length > 0;
    if (!hasPlans) return;
    setStatus('Сохранение…');
    try {
      await set(ref(_db, dataPath()), sanitizeKeys(d));
      setStatus('Сохранено');
    } catch (e) {
      console.error('pushNow failed', e);
      setStatus('Ошибка сохранения', true);
    }
  }

  /* Вызывается из Store.set() при каждом изменении данных */
  function scheduleSave() {
    pushNow();
  }

  /* Сохраняем при закрытии вкладки */
  function pushBeacon() {
    const d = Store.get();
    const hasPlans = d && d.training
      && Array.isArray(d.training.plans)
      && d.training.plans.length > 0;
    if (!hasPlans) return;
    try {
      set(ref(_db, dataPath()), sanitizeKeys(d)).catch(() => {});
    } catch (e) {}
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') pushBeacon();
  });
  window.addEventListener('pagehide', pushBeacon);

  /* Совместимость с app.js */
  function getConfig() { return window.FIREBASE_CONFIG; }
  function setConfig() {}
  function clearConfig() {}

  return { isConfigured, pullIntoStore, pushNow, scheduleSave, getConfig, setConfig, clearConfig };
})();

window.FirebaseSync = FirebaseSync;
