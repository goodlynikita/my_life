import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, off } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const _fbApp = initializeApp(window.FIREBASE_CONFIG);
const _db = getDatabase(_fbApp);
const ROOT = 'nik-data';

const FirebaseSync = (() => {
  let statusEl = null;
  let hideTimer = null;
  let _pendingPath = null;
  let _pendingValue = null;
  let _saveTimer = null;
  let _loaded = false;
  let _realtimeUnsub = null;
  let _realtimeActive = false;
  /* Флаг: мы сами пишем в Firebase прямо сейчас — игнорируем входящий
     onValue чтобы не перезаписать локальные изменения удалённой копией */
  let _writing = false;
  /* Версия данных — инкрементируется при каждом локальном изменении.
     Если onValue приходит устаревшая версия — игнорируем её. */
  let _localVersion = 0;

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

  /* Первичная загрузка: один get() чтобы получить данные быстро,
     потом подписываемся на onValue для realtime обновлений */
  async function pullIntoStore() {
    try {
      const snap = await Promise.race([
        get(ref(_db, ROOT)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
      ]);

      const remote = snap.exists() ? snap.val() : null;
      const hasData = remote && remote.training
        && Array.isArray(remote.training.plans)
        && remote.training.plans.length > 0;

      if (hasData) {
        Store.replaceAll(remote);
        setStatus('Данные загружены');
        _loaded = true;
        _startRealtimeSync();
        return true;
      }

      _loaded = true;
      _startRealtimeSync();
      return false;
    } catch (e) {
      console.error('pullIntoStore failed', e);
      setStatus('Нет связи — работаем локально', true);
      /* При ошибке сети: пробуем загрузить данные через короткий retry */
      _scheduleRetry();
      _loaded = false;
      return 'error';
    }
  }

  /* Realtime listener — получаем изменения от тренера или другого устройства */
  function _startRealtimeSync() {
    if (_realtimeActive) return;
    _realtimeActive = true;

    const dbRef = ref(_db, ROOT);
    _realtimeUnsub = onValue(dbRef, (snap) => {
      /* Игнорируем если сами пишем */
      if (_writing) return;
      if (!_loaded) return;

      const remote = snap.exists() ? snap.val() : null;
      if (!remote) return;

      const hasData = remote.training
        && Array.isArray(remote.training.plans)
        && remote.training.plans.length > 0;

      if (!hasData) return;

      /* Мерджим: берём удалённые данные только если они "новее".
         Простая эвристика: сравниваем кол-во заполненных сессий. */
      const localData = Store.get();
      if (_isRemoteNewer(remote, localData)) {
        Store.replaceAll(remote);
        setStatus('Синхронизировано');
        /* Перерисовываем экран если открыт Training */
        _notifyScreenUpdate();
      }
    }, (err) => {
      console.error('realtime sync error', err);
    });
  }

  function _stopRealtimeSync() {
    if (_realtimeUnsub) {
      off(ref(_db, ROOT));
      _realtimeUnsub = null;
      _realtimeActive = false;
    }
  }

  function _countSessions(data) {
    let count = 0;
    try {
      for (const plan of (data.training?.plans || [])) {
        for (const week of (plan?.weeks || [])) {
          for (const day of (week?.days || [])) {
            count += (day?.sessions?.length || 0);
          }
        }
      }
    } catch (e) {}
    return count;
  }

  function _isRemoteNewer(remote, local) {
    /* Если у remote больше данных — берём remote */
    const remoteCount = _countSessions(remote);
    const localCount = _countSessions(local);
    return remoteCount > localCount;
  }

  function _notifyScreenUpdate() {
    /* Генерируем кастомное событие — training.js может его слушать */
    try {
      window.dispatchEvent(new CustomEvent('firebase-sync-update'));
    } catch (e) {}
  }

  let _retryTimer = null;
  function _scheduleRetry() {
    if (_retryTimer) return;
    _retryTimer = setTimeout(async () => {
      _retryTimer = null;
      console.log('FirebaseSync: retry pull...');
      const result = await pullIntoStore();
      if (result === true) {
        _notifyScreenUpdate();
      }
    }, 5000);
  }

  async function pushPath(storePath, value) {
    if (!_loaded) {
      console.warn('FirebaseSync: запись заблокирована — данные не загружены');
      return;
    }
    const fbPath = ROOT + '/' + storePath.replace(/\./g, '/');
    setStatus('Сохранение…');
    _writing = true;
    _localVersion++;
    try {
      await set(ref(_db, fbPath), sanitizeKeys(value));
      setStatus('Сохранено');
    } catch (e) {
      console.error('pushPath failed', fbPath, e);
      setStatus('Ошибка сохранения — повтор через 3с', true);
      /* Retry через 3 секунды */
      setTimeout(() => pushPath(storePath, value), 3000);
    } finally {
      /* Снимаем флаг записи через небольшую задержку,
         чтобы onValue успел сработать и мы его проигнорировали */
      setTimeout(() => { _writing = false; }, 1500);
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

  /* Полная запись при уходе со страницы */
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
    if (document.visibilityState === 'hidden') {
      pushBeacon();
    } else if (document.visibilityState === 'visible' && _loaded) {
      /* При возврате на вкладку — синхронизируем */
      get(ref(_db, ROOT)).then(snap => {
        if (!snap.exists() || _writing) return;
        const remote = snap.val();
        const local = Store.get();
        if (_isRemoteNewer(remote, local)) {
          Store.replaceAll(remote);
          setStatus('Обновлено');
          _notifyScreenUpdate();
        }
      }).catch(() => {});
    }
  });

  window.addEventListener('pagehide', pushBeacon);

  function getConfig() { return window.FIREBASE_CONFIG; }
  function setConfig() {}
  function clearConfig() {}
  function pushNow() { pushBeacon(); }

  return {
    isConfigured,
    pullIntoStore,
    pushNow,
    scheduleSave,
    getConfig, setConfig, clearConfig
  };
})();

window.FirebaseSync = FirebaseSync;
