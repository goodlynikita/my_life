/* ============================================================
   FIREBASE SYNC
   Reads and writes one node in a Firebase Realtime Database using
   the OFFICIAL Firebase SDK (loaded as an ES module), not a
   hand-rolled fetch() against the REST API. This is the same
   proven approach used in the "Бегу к себе" tracker, which syncs
   reliably across every device.
   The full firebaseConfig comes from window.FIREBASE_CONFIG
   (config.js), baked into the app — every device uses the same
   project automatically, no manual setup needed.
   ============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const FirebaseSync = (() => {
  let statusEl = null;
  let hideTimer = null;
  let fbApp = null;
  let db = null;
  /* Пока не завершена ПЕРВАЯ загрузка данных из Firebase, любые записи
     заблокированы. Это защищает от ситуации, когда экран успевает
     отрендериться и что-то «сохранить» (например пустой план) ДО того,
     как реальные данные пришли — и затереть их пустотой. Флаг ставится
     в true в конце pullIntoStore (успех или ошибка — неважно, после
     этого пользователь уже работает с реальными/кэшированными данными). */
  let ready = false;

  function getConfig() {
    if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL) {
      return window.FIREBASE_CONFIG;
    }
    return null;
  }

  function setConfig() {
    /* Конфиг теперь всегда берётся из config.js (window.FIREBASE_CONFIG),
       поэтому ручная настройка через localStorage больше не используется.
       Функция оставлена только для совместимости интерфейса. */
  }

  function clearConfig() {
    /* см. setConfig выше */
  }

  function isConfigured() {
    return !!getConfig();
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
    if (!statusEl) {
      console.warn('FirebaseSync: #sync-status element not found in DOM, status not shown:', text);
      return;
    }
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
      /* get() может зависнуть навсегда, если соединение с Firebase
         не устанавливается (блокировка websocket, App Check, сеть).
         Ограничиваем ожидание — иначе весь запуск приложения повисает
         и экран остаётся чёрным. По таймауту считаем Firebase недоступным
         и грузим данные из кэша / data.json. */
      const snap = await Promise.race([
        get(ref(database, 'nik-data')),
        new Promise((_, reject) => setTimeout(() => reject(new Error('firebase-timeout')), 6000))
      ]);
      const remote = snap.exists() ? snap.val() : null;
      const nodeExists = remote !== null && remote !== undefined;
      if (nodeExists) {
        Store.replaceAll(remote);
        setStatus('Данные загружены');
      }
      return nodeExists;
    } catch (e) {
      console.error('FirebaseSync.pullIntoStore failed', e);
      setStatus('Firebase недоступен — данные из локальной копии', true);
      return 'error';
    } finally {
      ready = true;
    }
  }

  async function pushNow() {
    const database = ensureInitialized();
    if (!database) return;
    setStatus('Сохранение…');
    try {
      await set(ref(database, 'nik-data'), Store.get());
      setStatus('Сохранено');
    } catch (e) {
      console.error('FirebaseSync.pushNow failed', e);
      setStatus('Ошибка сохранения. Проверь правила доступа Firebase.', true);
    }
  }

  function scheduleSave() {
    /* Не сохраняем, пока не завершилась первая загрузка — иначе ранний
       рендер может затереть реальные данные пустотой. Данные при этом
       уже лежат в localStorage (Store.persistLocal), так что ничего не
       теряется: после загрузки реальные данные перезапишут Store. */
    if (!ready) return;
    setStatus('Сохранение…');
    pushNow();
  }

  function pushBeacon() {
    /* SDK не поддерживает keepalive-запросы при закрытии вкладки так же
       просто, как fetch. На практике scheduleSave() уже сохраняет данные
       сразу при каждом изменении (без задержки), так что к моменту
       закрытия вкладки данные обычно уже записаны. Дополнительная
       попытка здесь не помешает, но не гарантирована. */
    const database = ensureInitialized();
    if (!database) return;
    try {
      set(ref(database, 'nik-data'), Store.get()).catch(() => {});
    } catch (e) { /* best effort, ignore */ }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') pushBeacon();
  });
  window.addEventListener('pagehide', pushBeacon);

  return { getConfig, setConfig, clearConfig, isConfigured, pullIntoStore, pushNow, scheduleSave };
})();

window.FirebaseSync = FirebaseSync;
