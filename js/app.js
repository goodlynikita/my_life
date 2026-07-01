/* ============================================================
   APP ENTRY POINT
   Source-of-truth: Firebase ВСЕГДА первый источник данных.
   Логика намеренно простая — как в "Бегу к себе":
   1. Ждём FirebaseSync
   2. Читаем данные из Firebase
   3. Если Firebase пуст — берём локальный кэш
   4. Если кэша тоже нет — берём data.json как дефолт
   5. Рисуем экран

   ВАЖНО: data.json и дефолтные данные НЕ записываются
   в Firebase автоматически. Иначе при каждом старте с пустым
   стором они затирают реальные данные других пользователей.
   В Firebase данные попадают ТОЛЬКО когда пользователь реально
   что-то изменил в приложении (через Store.set → scheduleSave).
   ============================================================ */

function waitForFirebaseSync(maxWaitMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    function check() {
      if (window.FirebaseSync) { resolve(true); return; }
      if (Date.now() - start > maxWaitMs) { resolve(false); return; }
      setTimeout(check, 30);
    }
    check();
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await waitForFirebaseSync(2000);
    const firebaseReady = window.FirebaseSync && FirebaseSync.isConfigured();

    if (firebaseReady) {
      const remoteResult = await FirebaseSync.pullIntoStore();

      if (remoteResult === true) {
        /* Данные успешно загружены из Firebase — всё готово */
      } else if (remoteResult === false) {
        /* Firebase пуст (нет данных вообще).
           Берём локальный кэш или data.json, но НЕ пишем в Firebase —
           пусть первая реальная запись пользователя инициализирует базу. */
        const cached = await Store.load();
        if (!cached || !cached.training || !Array.isArray(cached.training.plans) || cached.training.plans.length === 0) {
          const seed = await Store.loadSeedFromRepo();
          if (seed) Store.replaceAll(seed);
          else Store.replaceAll(Store.defaultData());
        }
      } else {
        /* Firebase недоступен/таймаут — берём локальный кэш */
        const cached = await Store.load();
        if (!cached || !cached.training || !Array.isArray(cached.training.plans) || cached.training.plans.length === 0) {
          const seed = await Store.loadSeedFromRepo();
          if (seed) Store.replaceAll(seed);
          else Store.replaceAll(Store.defaultData());
        }
      }
    } else {
      /* Firebase не сконфигурирован — работаем локально */
      const cached = await Store.load();
      if (!cached) {
        const seed = await Store.loadSeedFromRepo();
        Store.replaceAll(seed || Store.defaultData());
      }
    }
  } catch (e) {
    console.error('App boot error', e);
    try {
      if (!Store.get().training) Store.replaceAll(Store.defaultData());
    } catch (_) {}
  } finally {
    Router.render();
  }
});
