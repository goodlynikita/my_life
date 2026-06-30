/* ============================================================
   FIREBASE SYNC
   Reads and writes one node in a Firebase Realtime Database using
   the Firebase REST API directly (no SDK needed, plain fetch).
   The database URL comes from window.FIREBASE_CONFIG (config.js),
   baked into the app — every device uses the same database with
   zero manual setup. localStorage override only exists as a
   fallback for advanced use, not needed in normal operation.
   ============================================================ */

const FirebaseSync = (() => {
  const CFG_KEY = 'nik_firebase_cfg_v1';
  let statusEl = null;

  function getConfig() {
    if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL) {
      return window.FIREBASE_CONFIG;
    }
    try {
      const raw = localStorage.getItem(CFG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setConfig(cfg) {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  }

  function clearConfig() {
    localStorage.removeItem(CFG_KEY);
  }

  function isConfigured() {
    const cfg = getConfig();
    return !!(cfg && cfg.databaseURL);
  }

  function dataUrl() {
    const cfg = getConfig();
    let base = cfg.databaseURL.replace(/\/$/, '');
    return `${base}/nik-data.json`;
  }

  function setStatus(text, isError) {
    if (!statusEl) statusEl = document.getElementById('sync-status');
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.style.color = isError ? 'var(--danger)' : 'var(--bone-faint)';
  }

  const FETCH_ERROR = Symbol('fetch-error');

  async function fetchRemote() {
    const cfg = getConfig();
    if (!cfg) return FETCH_ERROR;
    try {
      const res = await fetch(dataUrl());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      return json; // null is a valid Firebase response meaning "node is empty"
    } catch (e) {
      console.error('FirebaseSync.fetchRemote failed', e);
      setStatus('Не удалось загрузить данные с Firebase', true);
      return FETCH_ERROR;
    }
  }

  async function pullIntoStore() {
    const remote = await fetchRemote();
    if (remote === FETCH_ERROR) {
      return 'error';
    }
    const nodeExists = remote !== null && remote !== undefined;
    if (nodeExists) {
      Store.replaceAll(remote);
      setStatus('Данные загружены');
    }
    return nodeExists;
  }

  let pushChain = Promise.resolve();
  let pendingPush = false;

  async function pushNow() {
    const cfg = getConfig();
    if (!cfg) return;
    // Chain pushes so a slower earlier request can never land after (and
    // overwrite with stale data) a faster later one.
    pendingPush = true;
    pushChain = pushChain.then(async () => {
      pendingPush = false;
      setStatus('Сохранение…');
      try {
        const res = await fetch(dataUrl(), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Store.get())
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        setStatus('Сохранено');
      } catch (e) {
        console.error('FirebaseSync.pushNow failed', e);
        setStatus('Ошибка сохранения. Проверь адрес базы данных и правила доступа.', true);
      }
    });
    await pushChain;
  }

  function scheduleSave() {
    pushNow();
  }

  function pushBeacon() {
    // Fired on page hide/unload — keepalive lets this PUT survive even if
    // the tab closes right after, unlike a regular fetch which gets aborted.
    const cfg = getConfig();
    if (!cfg) return;
    try {
      fetch(dataUrl(), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Store.get()),
        keepalive: true
      }).catch(() => {});
    } catch (e) { /* best effort, ignore */ }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') pushBeacon();
  });
  window.addEventListener('pagehide', pushBeacon);

  return { getConfig, setConfig, clearConfig, isConfigured, pullIntoStore, pushNow, scheduleSave };
})();
