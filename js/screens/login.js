window.Screens = window.Screens || {};

window.Screens.login = function(mount) {
  mount.innerHTML = `
    <div style="min-height:100vh;background:linear-gradient(135deg,#0C1628 0%,#1A4A8A 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;font-family:'Montserrat',sans-serif;position:relative;overflow:hidden;">
      <div style="position:absolute;top:-100px;right:-100px;width:400px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(96,165,250,0.2) 0%,transparent 70%);pointer-events:none;"></div>
      <div style="position:absolute;bottom:-100px;left:-100px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(167,139,250,0.15) 0%,transparent 70%);pointer-events:none;"></div>

      ${window.Feedback ? Feedback.buttonHtml('fb-envelope-login') : ''}
      <img src="icon.png" onerror="this.style.display='none'" style="width:76px;height:76px;border-radius:18px;margin-bottom:16px;box-shadow:0 8px 32px rgba(74,124,255,0.4);">
      <div style="font-size:24px;font-weight:900;color:#F2F4F8;margin-bottom:4px;">YOU</div>
      <div style="font-size:12px;color:rgba(242,244,248,0.4);margin-bottom:18px;">Персональный трекер жизни</div>

      <!-- Счётчик мест: заполняется из Firebase (stats/usersCount) -->
      <div id="seats" class="seats" style="display:none;">
        <div class="seats-top">
          <span class="seats-badge"><i class="ti ti-gift"></i> Бесплатно для первых <b id="seats-limit">1000</b></span>
          <span class="seats-left" id="seats-left"></span>
        </div>
        <div class="seats-track"><div class="seats-fill" id="seats-fill"></div></div>
        <div class="seats-sub" id="seats-sub"></div>
      </div>

      <div style="width:100%;max-width:380px;">
        <!-- Вкладки -->
        <div style="display:flex;background:rgba(255,255,255,0.06);border-radius:14px;padding:4px;margin-bottom:16px;gap:4px;">
          <button id="tab-login" style="flex:1;padding:10px;border:none;border-radius:10px;background:rgba(74,124,255,0.9);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:'Montserrat',sans-serif;transition:all .2s;">Войти</button>
          <button id="tab-reg" style="flex:1;padding:10px;border:none;border-radius:10px;background:none;color:rgba(255,255,255,0.5);font-size:13px;font-weight:700;cursor:pointer;font-family:'Montserrat',sans-serif;transition:all .2s;">Регистрация</button>
        </div>

        <!-- Форма входа -->
        <div id="form-login" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:22px;">
          <input id="login-email" type="email" inputmode="email" placeholder="Email" autocomplete="email" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.15);border-radius:12px;color:#F2F4F8;font-size:15px;padding:13px 14px;outline:none;margin-bottom:8px;-webkit-appearance:none;font-family:'Montserrat',sans-serif;">
          <input id="login-pwd" type="password" placeholder="Пароль" autocomplete="current-password" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.15);border-radius:12px;color:#F2F4F8;font-size:15px;padding:13px 14px;outline:none;margin-bottom:10px;-webkit-appearance:none;font-family:'Montserrat',sans-serif;">
          <div id="login-err" style="font-size:12px;color:#F87171;margin-bottom:10px;min-height:16px;text-align:center;"></div>
          <button id="login-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#4A7CFF,#7C3AED);border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:'Montserrat',sans-serif;box-shadow:0 4px 20px rgba(74,124,255,0.4);">Войти</button>
        </div>

        <!-- Форма регистрации -->
        <div id="form-reg-closed" class="reg-closed" style="display:none;">
          <div class="reg-closed-ico"><i class="ti ti-lock"></i></div>
          <div class="reg-closed-title">Бесплатные места закончились</div>
          <div class="reg-closed-txt">Все <b class="seats-limit-copy">1000</b> мест заняты. Напиши в поддержку, и мы пришлём личный инвайт.</div>
          <button class="reg-closed-btn" id="reg-invite"><i class="ti ti-brand-telegram"></i> Получить инвайт</button>
        </div>
        <div id="form-reg" style="display:none;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:22px;">
          <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:14px;line-height:1.5;">Создай аккаунт. Твои данные хранятся отдельно и недоступны другим.</div>
          <input id="reg-name" type="text" placeholder="Имя (необязательно)" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.15);border-radius:12px;color:#F2F4F8;font-size:15px;padding:13px 14px;outline:none;margin-bottom:8px;-webkit-appearance:none;font-family:'Montserrat',sans-serif;">
          <input id="reg-email" type="email" inputmode="email" placeholder="Email" autocomplete="email" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.15);border-radius:12px;color:#F2F4F8;font-size:15px;padding:13px 14px;outline:none;margin-bottom:8px;-webkit-appearance:none;font-family:'Montserrat',sans-serif;">
          <input id="reg-pwd" type="password" placeholder="Пароль (мин. 6 символов)" autocomplete="new-password" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.15);border-radius:12px;color:#F2F4F8;font-size:15px;padding:13px 14px;outline:none;margin-bottom:8px;-webkit-appearance:none;font-family:'Montserrat',sans-serif;">
          <input id="reg-pwd2" type="password" placeholder="Повтори пароль" autocomplete="new-password" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.15);border-radius:12px;color:#F2F4F8;font-size:15px;padding:13px 14px;outline:none;margin-bottom:10px;-webkit-appearance:none;font-family:'Montserrat',sans-serif;">
          <div id="reg-err" style="font-size:12px;color:#F87171;margin-bottom:10px;min-height:16px;text-align:center;"></div>
          <button id="reg-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#059669,#10b981);border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:'Montserrat',sans-serif;box-shadow:0 4px 20px rgba(5,150,105,0.4);">Создать аккаунт</button>
        </div>
      </div>

      <div style="margin-top:20px;font-size:11px;color:rgba(242,244,248,0.2);text-align:center;">На каждом устройстве нужно войти один раз</div>
    </div>`;

  /* Tab switching */
  document.getElementById('tab-login').addEventListener('click', () => {
    document.getElementById('form-login').style.display = 'block';
    document.getElementById('form-reg').style.display = 'none';
    document.getElementById('form-reg-closed').style.display = 'none';
    document.getElementById('tab-login').style.background = 'rgba(74,124,255,0.9)';
    document.getElementById('tab-login').style.color = '#fff';
    document.getElementById('tab-reg').style.background = 'none';
    document.getElementById('tab-reg').style.color = 'rgba(255,255,255,0.5)';
  });

  document.getElementById('tab-reg').addEventListener('click', () => {
    document.getElementById('form-login').style.display = 'none';
    document.getElementById('form-reg').style.display = regClosed ? 'none' : 'block';
    document.getElementById('form-reg-closed').style.display = regClosed ? 'block' : 'none';
    document.getElementById('tab-reg').style.background = 'rgba(5,150,105,0.9)';
    document.getElementById('tab-reg').style.color = '#fff';
    document.getElementById('tab-login').style.background = 'none';
    document.getElementById('tab-login').style.color = 'rgba(255,255,255,0.5)';
    if (!regClosed) setTimeout(() => document.getElementById('reg-name').focus(), 100);
  });

  /* ── Счётчик мест ── */
  var regClosed = false;
  var LIMIT = (window.APP_CONFIG && APP_CONFIG.freeUsersLimit) || 1000;
  function plural(n, a, b, c) { var x = n % 10, y = n % 100; return x === 1 && y !== 11 ? a : x >= 2 && x <= 4 && (y < 12 || y > 14) ? b : c; }
  function showSeats(count) {
    var box = document.getElementById('seats');
    if (!box || count === null || count === undefined) return;
    var left = Math.max(0, LIMIT - count);
    var pct = Math.min(100, Math.round(count / LIMIT * 100));
    document.getElementById('seats-limit').textContent = LIMIT.toLocaleString('ru-RU');
    document.querySelectorAll('.seats-limit-copy').forEach(function(e){ e.textContent = LIMIT.toLocaleString('ru-RU'); });
    document.getElementById('seats-left').textContent = left > 0 ? 'осталось ' + left.toLocaleString('ru-RU') + ' ' + plural(left, 'место', 'места', 'мест') : 'мест нет';
    document.getElementById('seats-fill').style.width = Math.max(2, pct) + '%';
    document.getElementById('seats-sub').textContent = left > 0
      ? (count >= 10 ? 'Уже с нами: ' + count.toLocaleString('ru-RU') + ' ' + plural(count, 'человек', 'человека', 'человек') : 'Регистрация открыта, успей занять место')
      : 'Регистрация по личным инвайтам через поддержку';
    box.style.display = '';
    box.classList.toggle('is-full', left === 0);
    if (left === 0) {
      regClosed = true;
      if (document.getElementById('form-reg').style.display === 'block') {
        document.getElementById('form-reg').style.display = 'none';
        document.getElementById('form-reg-closed').style.display = 'block';
      }
    }
  }
  function applyClosed(title, text) {
    regClosed = true;
    var t = document.querySelector('.reg-closed-title'), x = document.querySelector('.reg-closed-txt');
    if (title && t) t.textContent = title;
    if (text && x) x.textContent = text;
    if (document.getElementById('form-reg').style.display === 'block') {
      document.getElementById('form-reg').style.display = 'none';
      document.getElementById('form-reg-closed').style.display = 'block';
    }
  }
  if (window.FirebaseSync && FirebaseSync.loadSettings) {
    FirebaseSync.loadSettings().then(function(cfg){
      LIMIT = cfg.freeUsersLimit || LIMIT;
      if (cfg.registrationOpen === false) applyClosed('Регистрация временно закрыта', 'Новых пользователей сейчас добавляем по личным инвайтам. Напиши в поддержку.');
      return FirebaseSync.getUsersCount();
    }).then(showSeats);
  } else if (window.FirebaseSync && FirebaseSync.getUsersCount) FirebaseSync.getUsersCount().then(showSeats);
  if (window._accountBlocked) {
    var le = document.getElementById('login-err');
    if (le) le.textContent = 'Доступ к аккаунту ограничен. Напиши в поддержку.';
  }
  function openInvite() {
    if (window.Feedback) Feedback.openTelegram();
  }
  document.getElementById('reg-invite').addEventListener('click', openInvite);

  /* Login */
  async function tryLogin() {
    var email = document.getElementById('login-email').value.trim();
    var pwd   = document.getElementById('login-pwd').value;
    var err   = document.getElementById('login-err');
    var btn   = document.getElementById('login-btn');
    if (!email) { err.textContent = 'Введи email'; return; }
    if (!pwd)   { err.textContent = 'Введи пароль'; return; }
    btn.textContent = '...'; btn.disabled = true; err.textContent = '';
    try {
      await Auth.attemptLogin(email, pwd);
      /* onAuthStateChanged в app.js подхватит и переключит роутер */
      await FirebaseSync.pullIntoStore();
      Router.go('/home');
    } catch(e) {
      err.textContent = e && e.code === 'app/blocked' ? 'Доступ к аккаунту ограничен. Напиши в поддержку.' : 'Неверный email или пароль';
      btn.textContent = 'Войти'; btn.disabled = false;
    }
  }

  /* Register */
  async function tryRegister() {
    var name  = document.getElementById('reg-name').value.trim();
    var email = document.getElementById('reg-email').value.trim();
    var pwd   = document.getElementById('reg-pwd').value;
    var pwd2  = document.getElementById('reg-pwd2').value;
    var err   = document.getElementById('reg-err');
    var btn   = document.getElementById('reg-btn');

    if (!email)        { err.textContent = 'Введи email'; return; }
    if (pwd.length < 6){ err.textContent = 'Пароль минимум 6 символов'; return; }
    if (pwd !== pwd2)  { err.textContent = 'Пароли не совпадают'; return; }

    btn.textContent = '...'; btn.disabled = true; err.textContent = '';
    try {
      await Auth.register(email, pwd, name || null);
      await FirebaseSync.pullIntoStore();
      Router.go('/home');
    } catch(e) {
      if (e.code === 'app/limit-reached') { showSeats(LIMIT); document.getElementById('tab-reg').click(); return; }
      if (e.code === 'app/registration-closed') { applyClosed('Регистрация временно закрыта', 'Новых пользователей сейчас добавляем по личным инвайтам. Напиши в поддержку.'); document.getElementById('tab-reg').click(); return; }
      var msg = e.code === 'auth/email-already-in-use' ? 'Этот email уже зарегистрирован'
              : e.code === 'auth/invalid-email'        ? 'Некорректный email'
              : 'Ошибка регистрации. Попробуй ещё раз.';
      err.textContent = msg;
      btn.textContent = 'Создать аккаунт'; btn.disabled = false;
    }
  }

  /* Handlers */
  document.getElementById('login-btn').addEventListener('click', tryLogin);
  document.getElementById('reg-btn').addEventListener('click', tryRegister);
  document.getElementById('login-email').focus();
  document.getElementById('login-pwd').addEventListener('keydown', e => { if(e.key==='Enter') tryLogin(); });
  document.getElementById('reg-pwd2').addEventListener('keydown', e => { if(e.key==='Enter') tryRegister(); });
};
