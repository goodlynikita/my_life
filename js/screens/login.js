window.Screens = window.Screens || {};

window.Screens.login = function(mount) {
  /* Проверяем есть ли сохранённые пользователи в Firebase */
  mount.innerHTML = `
    <div style="min-height:100vh;background:linear-gradient(135deg,#0C1628 0%,#1A4A8A 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;font-family:'Montserrat',sans-serif;position:relative;overflow:hidden;">
      <div style="position:absolute;top:-100px;right:-100px;width:400px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(96,165,250,0.2) 0%,transparent 70%);pointer-events:none;"></div>
      <div style="position:absolute;bottom:-100px;left:-100px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(167,139,250,0.15) 0%,transparent 70%);pointer-events:none;"></div>

      <img src="icon.png" onerror="this.style.display='none'" style="width:80px;height:80px;border-radius:20px;margin-bottom:20px;box-shadow:0 8px 32px rgba(74,124,255,0.4);">
      <div style="font-size:26px;font-weight:900;color:#F2F4F8;margin-bottom:4px;">NIK · Система</div>
      <div style="font-size:13px;color:rgba(242,244,248,0.4);margin-bottom:32px;">Персональный трекер жизни</div>

      <div style="width:100%;max-width:380px;">
        <!-- Tabs -->
        <div style="display:flex;background:rgba(255,255,255,0.06);border-radius:14px;padding:4px;margin-bottom:20px;gap:4px;">
          <button id="tab-login" onclick="showTab('login')" style="flex:1;padding:10px;border:none;border-radius:10px;background:rgba(74,124,255,0.9);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:'Montserrat',sans-serif;transition:all .2s;">Войти</button>
          <button id="tab-reg" onclick="showTab('reg')" style="flex:1;padding:10px;border:none;border-radius:10px;background:none;color:rgba(255,255,255,0.5);font-size:13px;font-weight:700;cursor:pointer;font-family:'Montserrat',sans-serif;transition:all .2s;">Регистрация</button>
        </div>

        <!-- Login form -->
        <div id="form-login" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:24px;">
          <div style="font-size:14px;font-weight:700;color:#F2F4F8;margin-bottom:14px;">Пароль владельца</div>
          <input id="login-pwd" type="password" placeholder="••••••••" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.15);border-radius:12px;color:#F2F4F8;font-size:20px;font-weight:600;padding:12px 14px;letter-spacing:4px;outline:none;margin-bottom:10px;-webkit-appearance:none;font-family:'Montserrat',sans-serif;">
          <div id="login-err" style="font-size:12px;color:#F87171;margin-bottom:10px;min-height:16px;text-align:center;"></div>
          <button id="login-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#4A7CFF,#7C3AED);border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:'Montserrat',sans-serif;box-shadow:0 4px 20px rgba(74,124,255,0.4);">Войти</button>
        </div>

        <!-- Register form -->
        <div id="form-reg" style="display:none;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:24px;">
          <div style="font-size:14px;font-weight:700;color:#F2F4F8;margin-bottom:4px;">Новый пользователь</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:14px;">Создай свой пароль для входа</div>
          <input id="reg-pwd" type="password" placeholder="Новый пароль" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.15);border-radius:12px;color:#F2F4F8;font-size:16px;font-weight:600;padding:12px 14px;letter-spacing:2px;outline:none;margin-bottom:8px;-webkit-appearance:none;font-family:'Montserrat',sans-serif;">
          <input id="reg-pwd2" type="password" placeholder="Повтори пароль" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,0.08);border:1.5px solid rgba(255,255,255,0.15);border-radius:12px;color:#F2F4F8;font-size:16px;font-weight:600;padding:12px 14px;letter-spacing:2px;outline:none;margin-bottom:8px;-webkit-appearance:none;font-family:'Montserrat',sans-serif;">
          <div id="reg-err" style="font-size:12px;color:#F87171;margin-bottom:10px;min-height:16px;text-align:center;"></div>
          <button id="reg-btn" style="width:100%;padding:14px;background:linear-gradient(135deg,#059669,#10b981);border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:'Montserrat',sans-serif;box-shadow:0 4px 20px rgba(5,150,105,0.4);">Создать аккаунт</button>
          <div style="margin-top:12px;font-size:11px;color:rgba(255,255,255,0.3);text-align:center;line-height:1.5;">Хеш пароля сохранится в Firebase.<br>Для смены пароля — обратись к владельцу.</div>
        </div>
      </div>

      <div style="margin-top:20px;font-size:11px;color:rgba(242,244,248,0.2);text-align:center;">На каждом устройстве нужно войти один раз</div>
    </div>`;

  /* Tab switching */
  window.showTab = function(tab) {
    var loginForm = document.getElementById('form-login');
    var regForm = document.getElementById('form-reg');
    var tabLogin = document.getElementById('tab-login');
    var tabReg = document.getElementById('tab-reg');
    if (tab === 'login') {
      loginForm.style.display = 'block';
      regForm.style.display = 'none';
      tabLogin.style.background = 'rgba(74,124,255,0.9)';
      tabLogin.style.color = '#fff';
      tabReg.style.background = 'none';
      tabReg.style.color = 'rgba(255,255,255,0.5)';
    } else {
      loginForm.style.display = 'none';
      regForm.style.display = 'block';
      tabReg.style.background = 'rgba(5,150,105,0.9)';
      tabReg.style.color = '#fff';
      tabLogin.style.background = 'none';
      tabLogin.style.color = 'rgba(255,255,255,0.5)';
    }
  };

  /* Login */
  async function tryLogin() {
    var pwd = document.getElementById('login-pwd').value;
    var err = document.getElementById('login-err');
    var btn = document.getElementById('login-btn');
    if (!pwd) { err.textContent = 'Введи пароль'; return; }
    btn.textContent = '...'; btn.disabled = true;
    var role = await Auth.attemptLogin(pwd);
    if (role) {
      Router.go('/home');
    } else {
      err.textContent = 'Неверный пароль';
      document.getElementById('login-pwd').value = '';
      btn.textContent = 'Войти'; btn.disabled = false;
    }
  }

  /* Register */
  async function tryRegister() {
    var pwd = document.getElementById('reg-pwd').value;
    var pwd2 = document.getElementById('reg-pwd2').value;
    var err = document.getElementById('reg-err');
    var btn = document.getElementById('reg-btn');

    if (!pwd || pwd.length < 4) { err.textContent = 'Минимум 4 символа'; return; }
    if (pwd !== pwd2) { err.textContent = 'Пароли не совпадают'; return; }

    btn.textContent = '...'; btn.disabled = true;
    var h = await Auth.hash(pwd);

    /* Сохраняем новый хеш как coachHash в Firebase */
    Store.set('auth.extraUsers.' + Date.now(), { hash: h, createdAt: new Date().toISOString() });

    /* Проверяем совпадение с owner или сохранённым */
    var role = await Auth.attemptLogin(pwd);
    if (!role) {
      /* Нужно добавить поддержку в auth.js через Firebase */
      /* Пока просто сохраняем хеш и входим как coach */
      localStorage.setItem('nik_extra_hash', h);
      localStorage.setItem('nik_session_v1', JSON.stringify({ role: 'coach', at: Date.now() }));
      Router.go('/home');
    } else {
      Router.go('/home');
    }
  }

  /* Event listeners */
  setTimeout(function() {
    var loginBtn = document.getElementById('login-btn');
    var regBtn = document.getElementById('reg-btn');
    var loginPwd = document.getElementById('login-pwd');

    if (loginBtn) loginBtn.addEventListener('click', tryLogin);
    if (regBtn) regBtn.addEventListener('click', tryRegister);
    if (loginPwd) {
      loginPwd.focus();
      loginPwd.addEventListener('keydown', function(e){ if(e.key==='Enter') tryLogin(); });
    }
    document.getElementById('reg-pwd2')?.addEventListener('keydown', function(e){ if(e.key==='Enter') tryRegister(); });
  }, 100);
};
