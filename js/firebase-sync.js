import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

/* ============================================================
   FIREBASE SYNC
   - get() при старте, set() при изменении — как в "Бегу к себе"
   - pull каждые 30с и при возврате на вкладку
   - MERGE вместо замены: данные объединяются по дням,
     локальные данные никогда не затираются удалёнными
   ============================================================ */

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

  /* ── MERGE ──────────────────────────────────────────────────
     Объединяем remote и local:
     - Структура планов/недель берётся из того у кого больше планов
     - Для каждого дня: если локальный день пустой (нет сессий) и
       удалённый заполнен — берём удалённый
     - Если оба заполнены — оставляем локальный (приоритет)
     - Если только локальный заполнен — оставляем локальный
     Итог: данные только добавляются, никогда не затираются
  ────────────────────────────────────────────────────────── */
  function _mergePlans(localPlans, remotePlans) {
    if (!remotePlans?.length) return localPlans;
    if (!localPlans?.length) return remotePlans;

    // Берём максимальное количество планов
    const count = Math.max(localPlans.length, remotePlans.length);
    const merged = [];

    for (let pi = 0; pi < count; pi++) {
      const lp = localPlans[pi];
      const rp = remotePlans[pi];

      if (!lp && rp) { merged.push(rp); continue; }
      if (lp && !rp) { merged.push(lp); continue; }
      if (!lp && !rp) { merged.push(null); continue; }

      // Оба плана есть — мерджим по неделям/дням
      const planBase = { ...rp, ...lp }; // метаданные из локального
      const localWeeks = lp.weeks || [];
      const remoteWeeks = rp.weeks || [];
      const weekCount = Math.max(localWeeks.length, remoteWeeks.length);
      const mergedWeeks = [];

      for (let wi = 0; wi < weekCount; wi++) {
        const lw = localWeeks[wi];
        const rw = remoteWeeks[wi];

        if (!lw && rw) { mergedWeeks.push(rw); continue; }
        if (lw && !rw) { mergedWeeks.push(lw); continue; }
        if (!lw && !rw) { mergedWeeks.push(null); continue; }

        const localDays = lw.days || [];
        const remoteDays = rw.days || [];
        const dayCount = Math.max(localDays.length, remoteDays.length);
        const mergedDays = [];

        for (let di = 0; di < dayCount; di++) {
          const ld = localDays[di];
          const rd = remoteDays[di];

          if (!ld && rd) { mergedDays.push(rd); continue; }
          if (ld && !rd) { mergedDays.push(ld); continue; }
          if (!ld && !rd) { mergedDays.push(null); continue; }

          const localSessions = ld.sessions || [];
          const remoteSessions = rd.sessions || [];
          const localHasData = localSessions.some(s => s?.exercises?.length > 0 || s?.type);
          const remoteHasData = remoteSessions.some(s => s?.exercises?.length > 0 || s?.type);

          if (localHasData) {
            // Локальные данные есть — приоритет за ними
            // Но добавляем сессии тренера которых нет локально
            const allSessions = [...localSessions];
            for (const rs of remoteSessions) {
              if (!rs) continue;
              // Проверяем нет ли уже такой сессии (по типу и группам)
              const exists = localSessions.some(ls =>
                ls && ls.type === rs.type &&
                JSON.stringify(ls.groups) === JSON.stringify(rs.groups)
              );
              if (!exists) allSessions.push(rs);
            }
            mergedDays.push({ ...rd, ...ld, sessions: allSessions });
          } else if (remoteHasData) {
            // Локальный пустой, удалённый заполнен — берём удалённый
            mergedDays.push({ ...ld, sessions: remoteSessions });
          } else {
            mergedDays.push(ld);
          }
        }

        mergedWeeks.push({ ...rw, ...lw, days: mergedDays });
      }

      merged.push({ ...planBase, weeks: mergedWeeks });
    }

    return merged;
  }

  function _mergeData(local, remote) {
    if (!remote) return local;
    if (!local) return remote;

    const mergedPlans = _mergePlans(
      local?.training?.plans || [],
      remote?.training?.plans || []
    );

    // Замеры: берём все уникальные по дате
    const localM = local?.training?.measurements || [];
    const remoteM = remote?.training?.measurements || [];
    const allDates = new Set(localM.map(m => m?.date));
    const mergedM = [...localM];
    for (const m of remoteM) {
      if (m && !allDates.has(m.date)) mergedM.push(m);
    }

    return {
      ...remote,
      ...local,
      training: {
        ...remote.training,
        ...local.training,
        plans: mergedPlans,
        measurements: mergedM
      }
    };
  }

  function _hasNewData(local, remote) {
    // Быстрая проверка: есть ли у remote что-то чего нет локально
    const remotePlans = remote?.training?.plans || [];
    const localPlans = local?.training?.plans || [];
    for (let pi = 0; pi < remotePlans.length; pi++) {
      const rp = remotePlans[pi];
      const lp = localPlans[pi];
      if (!rp) continue;
      if (!lp) return true;
      const rWeeks = rp.weeks || [];
      const lWeeks = lp.weeks || [];
      for (let wi = 0; wi < rWeeks.length; wi++) {
        const rDays = rWeeks[wi]?.days || [];
        const lDays = lWeeks[wi]?.days || [];
        for (let di = 0; di < rDays.length; di++) {
          const rd = rDays[di];
          const ld = lDays[di];
          const rs = rd?.sessions || [];
          const ls = ld?.sessions || [];
          if (rs.some(s => s?.type) && !ls.some(s => s?.type)) return true;
        }
      }
    }
    return false;
  }

  async function _silentPull() {
    if (!_loaded) return;
    if (Date.now() - _lastWriteAt < 10000) return;
    try {
      const snap = await get(ref(_db, ROOT));
      if (!snap.exists()) return;
      const remote = snap.val();
      if (!remote?.training?.plans?.length) return;

      const local = Store.get();
      if (!_hasNewData(local, remote)) return;

      const merged = _mergeData(local, remote);
      Store.replaceAll(merged);
      setStatus('Тренер добавил данные ↓');
      // Сохраняем мердж обратно в Firebase
      _lastWriteAt = Date.now();
      await set(ref(_db, ROOT), sanitizeKeys(merged));
      _lastWriteAt = Date.now();
      window.dispatchEvent(new CustomEvent('firebase-remote-update'));
    } catch (e) {
      // тихо игнорируем
    }
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
      if (!_pollTimer) {
        _pollTimer = setInterval(_silentPull, 30000);
      }
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
