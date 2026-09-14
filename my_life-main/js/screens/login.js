window.Screens = window.Screens || {};

window.Screens.login = function(mount) {
  mount.innerHTML = `
    <div style="
      min-height:100vh;
      background:linear-gradient(135deg,#0C1628 0%,#0F3460 50%,#1A4A8A 100%);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      padding:20px;font-family:'Montserrat',sans-serif;
    ">
      <!-- Glow -->
      <div style="position:fixed;top:-100px;right:-100px;width:400px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(96,165,250,0.25) 0%,transparent 70%);pointer-events:none;"></div>
      <div style="position:fixed;bottom:-100px;left:-100px;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(167,139,250,0.2) 0%,transparent 70%);pointer-events:none;"></div>

      <!-- Logo -->
      <img src="icon.png" onerror="this.style.display='none'" style="width:80px;height:80px;border-radius:20px;margin-bottom:24px;box-shadow:0 8px 32px rgba(74,124,255,0.4);">

      <!-- Title -->
      <div style="font-size:28px;font-weight:900;color:#F2F4F8;letter-spacing:-0.5px;margin-bottom:6px;">NIK · Система</div>
      <div style="font-size:13px;color:rgba(242,244,248,0.4);margin-bottom:40px;letter-spacing:0.02em;">Персональный трекер жизни</div>

      <!-- Card -->
      <div style="width:100%;max-width:360px;background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px 24px;">
        <div style="font-size:15px;font-weight:700;color:#F2F4F8;margin-bottom:20px;">Введи пароль</div>

        <input
          id="login-pwd"
          type="password"
          placeholder="••••••••"
          autocomplete="current-password"
          style="
            width:100%;box-sizing:border-box;
            background:rgba(255,255,255,0.08);
            border:1.5px solid rgba(255,255,255,0.15);
            border-radius:12px;
            color:#F2F4F8;
            font-size:20px;
            font-weight:600;
            padding:14px 16px;
            letter-spacing:4px;
            font-family:'Montserrat',sans-serif;
            outline:none;
            transition:border-color .2s;
            margin-bottom:12px;
            -webkit-appearance:none;
          "
        >
        <div id="login-err" style="font-size:12px;color:#F87171;margin-bottom:12px;min-height:16px;text-align:center;"></div>

        <button id="login-btn" style="
          width:100%;padding:16px;
          background:linear-gradient(135deg,#4A7CFF,#7C3AED);
          border:none;border-radius:12px;
          color:#fff;font-size:15px;font-weight:800;
          cursor:pointer;font-family:'Montserrat',sans-serif;
          box-shadow:0 4px 20px rgba(74,124,255,0.5);
          transition:transform .15s,box-shadow .15s;
          -webkit-appearance:none;
        ">Войти</button>
      </div>

      <div style="margin-top:20px;font-size:11px;color:rgba(242,244,248,0.25);text-align:center;line-height:1.6;">
        На каждом устройстве нужно войти один раз.<br>Пароль сохраняется в браузере.
      </div>
    </div>`;

  const input = document.getElementById('login-pwd');
  const btn   = document.getElementById('login-btn');
  const err   = document.getElementById('login-err');

  input.focus();

  input.addEventListener('focus', function() {
    input.style.borderColor = 'rgba(74,124,255,0.8)';
    input.style.boxShadow   = '0 0 0 3px rgba(74,124,255,0.2)';
  });
  input.addEventListener('blur', function() {
    input.style.borderColor = 'rgba(255,255,255,0.15)';
    input.style.boxShadow   = 'none';
  });

  async function tryLogin() {
    const pwd = input.value;
    if (!pwd) { err.textContent = 'Введи пароль'; return; }
    btn.textContent = '...';
    btn.disabled = true;
    const role = await Auth.attemptLogin(pwd);
    if (role) {
      Router.go(role === 'coach' ? '/training' : '/home');
    } else {
      err.textContent = 'Неверный пароль';
      input.value = '';
      input.focus();
      btn.textContent = 'Войти';
      btn.disabled = false;
    }
  }

  btn.addEventListener('click', tryLogin);
  input.addEventListener('keydown', function(e) { if (e.key === 'Enter') tryLogin(); });
};
