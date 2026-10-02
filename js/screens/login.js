window.Screens = window.Screens || {};

window.Screens.login = function(mount, opts) {
  opts = opts || {};
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
          <div style="text-align:right;margin:-2px 2px 8px;"><button id="login-forgot" type="button" style="background:none;border:none;padding:4px 0;color:rgba(142,168,255,0.9);font-size:12.5px;font-weight:700;cursor:pointer;font-family:'Montserrat',sans-serif;">Забыл пароль?</button></div>
          <div id="login-err" style="font-size:12px;color:#F87171;margin-bottom:10px;min-height:16px;text-align:center;"></div>
          <button id="login-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#4A7CFF,#7C3AED);border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:'Montserrat',sans-serif;box-shadow:0 4px 20px rgba(74,124,255,0.4);">Войти</button>
        </div>

        <!-- Восстановление пароля -->
        <div id="form-forgot" style="display:none;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:22px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <div style="width:38px;height:38px;border-radius:12px;background:rgba(74,124,255,0.18);color:#8EA8FF;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;"><i class="ti ti-key"></i></div>
            <div style="font-size:16px;font-weight:800;color:#F2F4F8;">Восстановить пароль</div>
          </div>
          <div id="fg-txt" style="font-size:13px;color:rgba(255,255,255,0.55);margin-bottom:14px;line-height:1.5;">Укажи email от аккаунта. Пришлём письмо со ссылкой, по ней задашь новый пароль.</div>
          <input id="fg-email" type="email" inputmode="email" placeholder="Email" autocomplete="email" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.15);border-radius:12px;color:#F2F4F8;font-size:15px;padding:13px 14px;outline:none;margin-bottom:10px;-webkit-appearance:none;font-family:'Montserrat',sans-serif;">
          <div id="fg-err" style="font-size:12px;color:#F87171;margin-bottom:10px;min-height:16px;text-align:center;"></div>
          <button id="fg-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#4A7CFF,#7C3AED);border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:'Montserrat',sans-serif;box-shadow:0 4px 20px rgba(74,124,255,0.4);">Отправить ссылку</button>
          <button id="fg-back" type="button" style="width:100%;margin-top:8px;padding:10px;background:none;border:none;color:rgba(255,255,255,0.55);font-size:13px;font-weight:700;cursor:pointer;font-family:'Montserrat',sans-serif;"><i class="ti ti-arrow-left"></i> Назад ко входу</button>
        </div>

        <!-- Форма регистрации -->
        <div id="form-reg-closed" class="reg-closed" style="display:none;">
          <div class="reg-closed-ico"><i class="ti ti-lock"></i></div>
          <div class="reg-closed-title">Бесплатные места закончились</div>
          <div class="reg-closed-txt">Все <b class="seats-limit-copy">1000</b> мест заняты. Напиши в поддержку, и мы пришлём личный инвайт.</div>
          <button class="reg-closed-btn" id="reg-invite"><i class="ti ti-brand-telegram"></i> Получить инвайт</button>
        </div>
        <div id="form-reg" style="display:none;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:22px;">
          <div id="reg-hint" style="font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:14px;line-height:1.5;"></div>
          <input id="reg-name" type="text" placeholder="Имя (необязательно)" autocomplete="given-name" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.15);border-radius:12px;color:#F2F4F8;font-size:15px;padding:13px 14px;outline:none;margin-bottom:8px;-webkit-appearance:none;font-family:'Montserrat',sans-serif;">
          <input id="reg-email" type="email" inputmode="email" placeholder="Email" autocomplete="email" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.15);border-radius:12px;color:#F2F4F8;font-size:15px;padding:13px 14px;outline:none;margin-bottom:8px;-webkit-appearance:none;font-family:'Montserrat',sans-serif;">
          <input id="reg-pwd" type="password" placeholder="Пароль (мин. 6 символов)" autocomplete="new-password" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.15);border-radius:12px;color:#F2F4F8;font-size:15px;padding:13px 14px;outline:none;margin-bottom:8px;-webkit-appearance:none;font-family:'Montserrat',sans-serif;">
          <input id="reg-pwd2" type="password" placeholder="Повтори пароль" autocomplete="new-password" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.15);border-radius:12px;color:#F2F4F8;font-size:15px;padding:13px 14px;outline:none;margin-bottom:10px;-webkit-appearance:none;font-family:'Montserrat',sans-serif;">
          <label class="lg-chk"><input type="checkbox" id="reg-terms"><span>Принимаю <a href="legal/terms.html" target="_blank" rel="noopener">Пользовательское соглашение</a> и <a href="legal/privacy.html" target="_blank" rel="noopener">Политику обработки данных</a></span></label>
          <label class="lg-chk"><input type="checkbox" id="reg-pd"><span>Даю <a href="legal/consent.html" target="_blank" rel="noopener">согласие на обработку персональных данных</a></span></label>
          <div id="reg-err" style="font-size:12px;color:#F87171;margin-bottom:10px;min-height:16px;text-align:center;"></div>
          <button id="reg-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#059669,#10b981);border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:'Montserrat',sans-serif;box-shadow:0 4px 20px rgba(5,150,105,0.4);">Создать аккаунт</button>
        </div>
      </div>

      <div style="margin-top:20px;"></div>
      <a href="coach.html" class="login-coach-link"><i class="ti ti-user-star"></i><span><b>Вы тренер?</b> Откройте кабинет тренера</span><i class="ti ti-chevron-right"></i></a>
      <a href="start.html" style="margin-top:10px;font-size:12px;font-weight:700;color:rgba(142,168,255,0.75);text-decoration:none;display:inline-flex;align-items:center;gap:6px;"><i class="ti ti-sparkles"></i> Что умеет YOU</a>
      <div class="lg-legal"><a href="legal/terms.html" target="_blank" rel="noopener">Соглашение</a> · <a href="legal/privacy.html" target="_blank" rel="noopener">Политика данных</a> · <a href="legal/requisites.html" target="_blank" rel="noopener">Реквизиты</a></div>
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

  /* ── Забыли пароль ── */
  (function(){
    const fLogin = document.getElementById('form-login'), fForgot = document.getElementById('form-forgot');
    const tabs = document.getElementById('tab-login').parentElement;
    const showForgot = (on) => {
      fLogin.style.display = on ? 'none' : 'block'; fForgot.style.display = on ? 'block' : 'none'; tabs.style.display = on ? 'none' : '';
      if (on) {
        document.getElementById('fg-email').value = document.getElementById('login-email').value.trim();
        document.getElementById('fg-err').textContent = '';
        setTimeout(() => document.getElementById('fg-email').focus(), 80);
      }
    };
    document.getElementById('login-forgot').addEventListener('click', () => showForgot(true));
    document.getElementById('fg-back').addEventListener('click', () => showForgot(false));
    document.getElementById('fg-btn').addEventListener('click', async () => {
      const email = document.getElementById('fg-email').value.trim();
      const err = document.getElementById('fg-err'), btn = document.getElementById('fg-btn');
      err.style.color = '#F87171';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = 'Проверь email'; return; }
      btn.disabled = true; btn.textContent = 'Отправляю…';
      try {
        await FirebaseSync.resetPassword(email);
        document.getElementById('fg-txt').innerHTML = 'Если аккаунт с адресом <b style="color:#F2F4F8">' + email.replace(/[<>&]/g, '') + '</b> существует, письмо уже в пути. Открой ссылку из письма и задай новый пароль. Не видно письма? Загляни в «Спам».';
        err.style.color = '#4ADE80'; err.textContent = 'Письмо отправлено';
        btn.textContent = 'Отправить ещё раз';
      } catch (e) {
        const c = (e && e.code) || '';
        err.textContent = c === 'auth/invalid-email' ? 'Некорректный email'
          : c === 'auth/too-many-requests' ? 'Слишком много попыток. Попробуй через несколько минут'
          : c === 'auth/network-request-failed' ? 'Нет интернета. Проверь подключение'
          : 'Не получилось отправить. Попробуй ещё раз или напиши в поддержку';
        btn.textContent = 'Отправить ссылку';
      }
      btn.disabled = false;
    });
    document.getElementById('fg-email').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('fg-btn').click(); });
  })();

  /* Пришли с лендинга по кнопке «Получить приложение» — сразу регистрация */
  if (opts.register) setTimeout(() => { const t = document.getElementById('tab-reg'); if (t) t.click(); }, 0);

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
      /* фиксируем, какую редакцию документов и когда принял пользователь */
      try { Store.set('profile.consent', { v: '2026-09-30', at: Date.now(), terms: true, pd: true }); } catch (x) {}
      Router.go('/home');
      if (window.FirebaseSync.myTrainer) FirebaseSync.myTrainer().catch(() => {});
      if (window.Notices) setTimeout(() => Notices.check(), 1200);
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
    if (!document.getElementById('reg-terms').checked) { err.textContent = 'Отметь, что принимаешь соглашение'; return; }
    if (!document.getElementById('reg-pd').checked) { err.textContent = 'Отметь согласие на обработку данных'; return; }

    btn.textContent = '...'; btn.disabled = true; err.textContent = '';
    try {
      await Auth.register(email, pwd, name || null);
      await FirebaseSync.pullIntoStore();
      /* фиксируем, какую редакцию документов и когда принял пользователь */
      try { Store.set('profile.consent', { v: '2026-09-30', at: Date.now(), terms: true, pd: true }); } catch (x) {}
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
