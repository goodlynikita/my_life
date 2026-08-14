import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const _fbApp = initializeApp(window.FIREBASE_CONFIG);
const _db = getDatabase(_fbApp);
const ROOT = 'nik-data';

const FirebaseSync = (() => {
  let _loaded = false;
  let _pollTimer = null;
  let _lastWriteAt = 0;
  let statusEl = null;
  let hideTimer = null;

  /* Очередь сохранений: path -> value. Несколько изменений накапливаются
     и сбрасываются все вместе — ни одно не теряется. */
  const _queue = new Map();
  let _flushTimer = null;

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

  async function _flushQueue() {
    if (_queue.size === 0) return;
    const entries = [..._queue.entries()];
    _queue.clear();
    _lastWriteAt = Date.now();
    setStatus('Сохранение…');

    /* Если все пути начинаются с одного топ-раздела — пишем одним set.
       Иначе пишем каждый путь отдельно. */
    try {
      /* Группируем: finance/* → один set finance, goals/* → один set goals и тд */
      const sections = new Map();
      for (const [path, value] of entries) {
        const top = path.split('.')[0];
        if (!sections.has(top)) sections.set(top, []);
        sections.get(top).push({ path, value });
      }

      for (const [top, items] of sections) {
        if (items.length === 1) {
          /* Один путь — пишем точечно */
          const fbPath = ROOT + '/' + items[0].path.replace(/\./g, '/');
          await set(ref(_db, fbPath), sanitizeKeys(items[0].value));
        } else {
          /* Несколько путей в одном разделе — пишем весь раздел */
          const sectionData = Store.get()[top];
          await set(ref(_db, ROOT + '/' + top), sanitizeKeys(sectionData));
        }
      }
      _lastWriteAt = Date.now();
      setStatus('Сохранено');
    } catch (e) {
      console.error('flush failed', e);
      setStatus('Ошибка сохранения', true);
      /* Возвращаем в очередь для повтора */
      for (const [path, value] of entries) _queue.set(path, value);
      setTimeout(_flushQueue, 3000);
    }
  }

  function scheduleSave(path, value) {
    if (!_loaded) return;
    _queue.set(path, value);
    if (_flushTimer) clearTimeout(_flushTimer);
    _flushTimer = setTimeout(_flushQueue, 500);
  }

  async function _silentPull() {
    if (!_loaded) return;
    if (Date.now() - _lastWriteAt < 10000) return;
    try {
      const snap = await get(ref(_db, ROOT));
      if (!snap.exists()) return;
      const remote = snap.val();
      if (!remote?.training?.plans?.length) return;
      Store.replaceAll(remote);
      setStatus('Синхронизировано');
      window.dispatchEvent(new CustomEvent('firebase-remote-update'));
    } catch (e) {}
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

  /* Beacon — сохраняет ВСЕ данные при уходе со страницы */
  function _pushBeacon() {
    if (!_loaded) return;
    /* Сначала сбрасываем очередь если есть */
    if (_queue.size > 0) {
      _flushQueue();
      return;
    }
    const d = Store.get();
    _lastWriteAt = Date.now();
    try { set(ref(_db, ROOT), sanitizeKeys(d)).catch(() => {}); } catch (e) {}
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') _silentPull();
    else _pushBeacon();
  });
  window.addEventListener('pagehide', _pushBeacon);

  function getConfig() { return window.FIREBASE_CONFIG; }
  function setConfig() {}
  function clearConfig() {}
  function pushNow() { _pushBeacon(); }

  return { isConfigured, pullIntoStore, pushNow, scheduleSave, getConfig, setConfig, clearConfig };
})();

window.FirebaseSync = FirebaseSync;
