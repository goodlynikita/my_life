import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const _fbApp = initializeApp(window.FIREBASE_CONFIG);
const _db = getDatabase(_fbApp);
const ROOT = 'nik-data';

const FirebaseSync = (() => {
  let _loaded = false;
  let _saveTimer = null;
  let _pendingPath = null;
  let _pendingValue = null;
  let _pollTimer = null;
  let _lastWriteAt = 0;
  let statusEl = null;
  let hideTimer = null;

  function isConfigured() {
    return !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL);
  }

  function sanitizeKeys(value) {
    if (Array.isArray(value)) return value.map(sanitizeKeys);
    if (value && typeof value === 'object') {
      const out = {};
      for (const key of Object.keys(value)) {
        out[key.replace(/[.#$/\[\]]/g, '')] = sanitizeKeys(value[key]);
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
      hideTimer = setTimeout(() => { if (statusEl) statusEl.style.opacity = '0'; }, 2500);
    }
  }

  /* Тихий pull — просто берём Firebase как есть, никакого merge */
  async function _silentPull() {
    if (!_loaded) return;
    /* Не тянем если сами только что писали — даём Firebase осесть */
    if (Date.now() - _lastWriteAt < 10000) return;
    try {
      const snap = await get(ref(_db, ROOT));
      if (!snap.exists()) return;
      const remote = snap.val();
      if (!remote?.training?.plans?.length) return;
      Store.replaceAll(remote);
      setStatus('Синхронизировано');
      window.dispatchEvent(new CustomEvent('firebase-remote-update'));
    } catch (e) { /* тихо */ }
  }

  async function pullIntoStore() {
    try {
      const snap = await Promise.race([
        get(ref(_db, ROOT)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
      ]);
      const remote = snap.exists() ? snap.val() : null;
      const hasData = remote?.training?.plans?.length > 0;
      if (hasData) {
        Store.replaceAll(remote);
        setStatus('Данные загружены');
      }
      _loaded = true;
      if (!_pollTimer) _pollTimer = setInterval(_silentPull, 10000);
      return hasData ? true : false;
    } catch (e) {
      console.error('pullIntoStore failed', e);
      setStatus('Нет связи', true);
      _loaded = false;
      return 'error';
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') _silentPull();
    else _pushBeacon();
  });

  async function pushPath(storePath, value) {
    if (!_loaded) return;
    const fbPath = ROOT + '/' + storePath.replace(/\./g, '/');
    setStatus('Сохранение…');
    _lastWriteAt = Date.now();
    try {
      await set(ref(_db, fbPath), sanitizeKeys(value));
      _lastWriteAt = Date.now();
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
    }, 400);
  }

  function _pushBeacon() {
    if (!_loaded) return;
    const d = Store.get();
    if (!d?.training?.plans?.length) return;
    _lastWriteAt = Date.now();
    try { set(ref(_db, ROOT), sanitizeKeys(d)).catch(() => {}); } catch (e) {}
  }

  window.addEventListener('pagehide', _pushBeacon);

  function getConfig() { return window.FIREBASE_CONFIG; }
  function setConfig() {}
  function clearConfig() {}
  function pushNow() { _pushBeacon(); }

  return { isConfigured, pullIntoStore, pushNow, scheduleSave, getConfig, setConfig, clearConfig };
})();

window.FirebaseSync = FirebaseSync;
