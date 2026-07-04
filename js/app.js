/* ============================================================
   APP ENTRY POINT — точно как в "Бегу к себе"
   1. Ждём FirebaseSync (ES-модуль)
   2. Читаем данные из Firebase для текущей роли
   3. Если Firebase пуст — показываем пустой дефолт
      (НЕ пишем data.json в Firebase — это убивало данные)
   4. Рисуем экран
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
    await waitForFirebaseSync(3000);

    if (window.FirebaseSync && FirebaseSync.isConfigured()) {
      const result = await FirebaseSync.pullIntoStore();
      if (result !== true) {
        /* Firebase пуст или недоступен — дефолтные данные только локально,
           в Firebase НЕ пишем чтобы не затереть данные другой роли */
        Store.replaceAll(Store.defaultData());
      }
    } else {
      Store.replaceAll(Store.defaultData());
    }
  } catch (e) {
    console.error('App boot error', e);
    Store.replaceAll(Store.defaultData());
  } finally {
    Router.render();
  }
});
