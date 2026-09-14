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
