/* ============================================================
   GITHUB SYNC
   Reads and writes a single data.json file in the repo via the
   GitHub Contents API, using a personal access token stored in
   this browser's localStorage. This gives cross-device sync and
   free history through git commits, with no backend server.
   ============================================================ */

const GithubSync = (() => {
  const CFG_KEY = 'nik_github_cfg_v1';
  const DATA_PATH = 'data.json';
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
    return !!(cfg && cfg.token && cfg.owner && cfg.repo);
  }

  function apiBase() {
    const cfg = getConfig();
    return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${DATA_PATH}`;
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
      const res = await fetch(apiBase(), {
        headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json' }
      });
      if (res.status === 404) return { content: null, sha: null };
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      const decoded = decodeURIComponent(escape(atob(json.content)));
      return { content: JSON.parse(decoded), sha: json.sha };
    } catch (e) {
      console.error('GithubSync.fetchRemote failed', e);
      setStatus('Не удалось загрузить данные с GitHub', true);
      return null;
    }
  }

  async function pullIntoStore() {
    const remote = await fetchRemote();
    if (remote && remote.content) {
      Store.replaceAll(remote.content);
      setStatus('Данные загружены с GitHub');
    }
  }

  async function pushNow() {
    const cfg = getConfig();
    if (!cfg) return;
    setStatus('Сохранение…');
    try {
      const existing = await fetchRemote();
      const body = {
        message: `update data — ${new Date().toISOString()}`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(Store.get(), null, 2)))),
        ...(existing && existing.sha ? { sha: existing.sha } : {})
      };
      const res = await fetch(apiBase(), {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      setStatus('Сохранено в GitHub');
    } catch (e) {
      console.error('GithubSync.pushNow failed', e);
      setStatus('Ошибка сохранения. Проверь токен и доступ к репозиторию.', true);
    }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    setStatus('Изменения не сохранены…');
    saveTimer = setTimeout(() => { pushNow(); }, 2500);
  }

  return { getConfig, setConfig, clearConfig, isConfigured, pullIntoStore, pushNow, scheduleSave };
})();
