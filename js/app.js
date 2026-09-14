/* ============================================================
   APP ENTRY POINT
   1. Ждём FirebaseSync (ES-модуль)
   2. Ждём Firebase Auth — определяем залогинен ли юзер
   3. Если залогинен — грузим его данные и рендерим
   4. Если нет — показываем экран логина
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

window.addEventListener('error', function(e) {
  console.error('GLOBAL ERROR:', e.message, e.filename, e.lineno);
  var app = document.getElementById('app');
  if (app && app.innerHTML.trim() === '') {
    app.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#F87171;font-family:monospace;font-size:12px;line-height:1.8;background:#1A1C22;min-height:100vh;">'
      + '<div style="font-size:16px;margin-bottom:16px;">⚠️ Ошибка загрузки</div>'
      + '<div>' + e.message + '</div>'
      + '<div style="color:#555;margin-top:8px;">' + (e.filename||'').split('/').pop() + ':' + e.lineno + '</div>'
      + '<button onclick="location.reload(true)" style="margin-top:20px;padding:10px 20px;background:#4A7CFF;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;">Перезагрузить</button>'
      + '</div>';
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const fbReady = await waitForFirebaseSync(5000);
    if (!fbReady) {
      Store.replaceAll({});
      Router.render();
      return;
    }

    /* Ждём Firebase Auth — onAuthStateChanged вызывается один раз при инициализации */
    await new Promise((resolve) => {
      const unsubscribe = FirebaseSync.onAuth(async (user) => {
        unsubscribe();
        if (user) {
          /* Пользователь залогинен — грузим его данные */
          try {
            const result = await FirebaseSync.pullIntoStore();
            if (result !== true) {
              /* Firebase недоступен — пробуем локальный бекап */
              const hasLocal = Store.loadFromLocalBackup && Store.loadFromLocalBackup();
              if (!hasLocal) Store.replaceAll({});
            }
          } catch(e) {
            /* Офлайн — берём локальный бекап */
            const hasLocal = Store.loadFromLocalBackup && Store.loadFromLocalBackup();
            if (!hasLocal) Store.replaceAll({});
          }
        } else {
          /* Не залогинен — покажем экран входа */
          Store.replaceAll({});
        }
        resolve();
      });
    });

  } catch(e) {
    console.error('App boot error', e);
    Store.replaceAll({});
  } finally {
    Router.render();
  }
});
