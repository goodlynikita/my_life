/* ============================================================
   FIREBASE SYNC
   Reads and writes one node in a Firebase Realtime Database using
   the Firebase REST API directly (no SDK needed, plain fetch).
   Config (project URL + secret) is stored in this browser's
   localStorage after being entered once in the settings screen.
   ============================================================ */

const FirebaseSync = (() => {
  const CFG_KEY = 'nik_firebase_cfg_v1';
  let saveTimer = null;
  let statusEl = null;

  function getConfig() {
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

  async function fetchRemote() {
    const cfg = getConfig();
    if (!cfg) return null;
    try {
      const res = await fetch(dataUrl());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      return json;
    } catch (e) {
      console.error('FirebaseSync.fetchRemote failed', e);
      setStatus('Не удалось загрузить данные с Firebase', true);
      return null;
    }
  }

  async function pullIntoStore() {
    const remote = await fetchRemote();
    if (remote) {
      Store.replaceAll(remote);
      setStatus('Данные загружены');
    }
  }

  async function pushNow() {
    const cfg = getConfig();
    if (!cfg) return;
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
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    setStatus('Изменения не сохранены…');
    saveTimer = setTimeout(() => { pushNow(); }, 2500);
  }

  return { getConfig, setConfig, clearConfig, isConfigured, pullIntoStore, pushNow, scheduleSave };
})();
