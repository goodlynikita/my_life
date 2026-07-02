import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const _fbApp = initializeApp(window.FIREBASE_CONFIG);
const _db = getDatabase(_fbApp);
const ROOT = 'nik-data';

const FirebaseSync = (() => {
  let statusEl = null;
  let hideTimer = null;
  let _pendingPath = null;
  let _pendingValue = null;
  let _saveTimer = null;
  /* Флаг — данные реально загружены из Firebase.
     Пока false — любая запись заблокирована. */
  let _loaded = false;

  function isConfigured() {
    return !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL);
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
    try {
      const snap = await Promise.race([
        get(ref(_db, ROOT)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000))
      ]);
      const remote = snap.exists() ? snap.val() : null;
      const hasData = remote && remote.training
        && Array.isArray(remote.training.plans)
        && remote.training.plans.length > 0;
      if (hasData) {
        Store.replaceAll(remote);
        setStatus('Данные загружены');
        _loaded = true;
        return true;
      }
      /* Firebase пуст — разрешаем запись только после того как
         пользователь сам создаст первый план */
      _loaded = true;
      return false;
    } catch (e) {
      console.error('pullIntoStore failed', e);
      setStatus('Ошибка загрузки', true);
      /* При ошибке НЕ разрешаем запись — не затираем данные */
      _loaded = false;
      return 'error';
    }
  }

  async function pushPath(storePath, value) {
    if (!_loaded) {
      console.warn('FirebaseSync: запись заблокирована — данные ещё не загружены');
      return;
    }
    const fbPath = ROOT + '/' + storePath.replace(/\./g, '/');
    setStatus('Сохранение…');
    try {
      await set(ref(_db, fbPath), sanitizeKeys(value));
      setStatus('Сохранено');
    } catch (e) {
      console.error('pushPath failed', fbPath, e);
      setStatus('Ошибка сохранения', true);
    }
  }

  function scheduleSave(path, value) {
    if (!_loaded) return;
    _pendingPath = path;
    _pendingValue = value;
    if (_saveTimer) clearTimeout(_saveTimer);
    _saveTimer = setTimeout(async () => {
      if (_pendingPath !== null) {
        await pushPath(_pendingPath, _pendingValue);
        _pendingPath = null;
        _pendingValue = null;
      }
    }, 300);
  }

  /* При закрытии — пишем только если данные были реально загружены */
  function pushBeacon() {
    if (!_loaded) return;
    const d = Store.get();
    const hasPlans = d && d.training
      && Array.isArray(d.training.plans)
      && d.training.plans.length > 0;
    if (!hasPlans) return;
    try {
      set(ref(_db, ROOT), sanitizeKeys(d)).catch(() => {});
    } catch (e) {}
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') pushBeacon();
  });
  window.addEventListener('pagehide', pushBeacon);

  function getConfig() { return window.FIREBASE_CONFIG; }
  function setConfig() {}
  function clearConfig() {}
  function pushNow() { pushBeacon(); }

  return { isConfigured, pullIntoStore, pushNow, scheduleSave, getConfig, setConfig, clearConfig };
})();

window.FirebaseSync = FirebaseSync;
