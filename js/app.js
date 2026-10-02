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
      + '<div>' + String(e.message || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }) + '</div>'
      + '<div style="color:#555;margin-top:8px;">' + String(e.filename||'').split('/').pop().replace(/[<>&"']/g, '') + ':' + (+e.lineno || 0) + '</div>'
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
        if (user && FirebaseSync.isBlocked && await FirebaseSync.isBlocked(user)) {
          /* Доступ закрыт из админки */
          window._accountBlocked = true;
          await FirebaseSync.logout();
          user = null;
        }
        if (user) {
          if (FirebaseSync.touchUserIndex) FirebaseSync.touchUserIndex(user);
          /* Пользователь залогинен — грузим его данные */
          try {
            const result = await FirebaseSync.pullIntoStore();
            const isCoach = FirebaseSync.isCoach && FirebaseSync.isCoach();
            if (result !== true) {
              /* Firebase недоступен — пробуем локальный бекап (тренеру — никогда: там могут быть чужие данные) */
              const hasLocal = !isCoach && Store.loadFromLocalBackup && Store.loadFromLocalBackup();
              if (!hasLocal) Store.replaceAll({});
            }
          } catch(e) {
            /* Офлайн — берём локальный бекап (не для тренера) */
            const hasLocal = !(FirebaseSync.isCoach && FirebaseSync.isCoach()) && Store.loadFromLocalBackup && Store.loadFromLocalBackup();
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
    if (window.Theme) Theme.syncFromStore();
    window._appReady = true;
    /* быстрые ссылки: ?r=/habits (ярлыки на иконке), ?spend=кофе 290 (запись траты из «Команд» iPhone), ?add=1 (сразу строка записи) */
    try {
      const q = new URLSearchParams(location.search);
      const r = q.get('r'), sp = q.get('spend'), add = q.has('add');
      if (r || sp != null || add) {
        if (sp != null && sp.trim()) window.__spendQuick = sp.trim().slice(0, 200);
        else if (sp != null || add) window.__spendFocus = true;
        const to = (sp != null || add) ? '/finance' : (/^\/(home|training|habits|finance|goals)$/.test(r) ? r : '/home');
        history.replaceState(null, '', location.pathname + '#' + to);
      }
    } catch (e) {}
    Router.render();
    if (window.FirebaseSync && FirebaseSync.myTrainer && typeof Auth !== 'undefined' && Auth.isLoggedIn() && Auth.role() !== 'coach') {
      FirebaseSync.myTrainer().then((t) => { if (Router.currentPath() !== '/training') return; if (t) Router.render({ keepScroll: true }); else if (window.TrainerLink) TrainerLink.decorate(); }).catch(() => {});
      FirebaseSync.isTrainer().then(v => { window._isTrainer = v; }).catch(() => {});
    }
    if (window.Notices) setTimeout(() => Notices.check(), 1200);
  }
});

/* Пришли свежие данные с другого устройства — перерисовываем экран,
   если пользователь сейчас ничего не редактирует (тренировки обновляются сами) */
window.addEventListener('firebase-remote-update', function () {
  if (window.Theme) Theme.syncFromStore();
  var a = document.activeElement;
  var editing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT');
  var modalOpen = !!document.querySelector('.tr-modal-overlay');
  if (editing || modalOpen) return;
  if (Router.currentPath() === '/training') return;
  Router.render({ keepScroll: true });
});
