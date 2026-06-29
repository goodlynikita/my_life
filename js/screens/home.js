/* ============================================================
   HOME SCREEN + LOGIN SCREEN renderers
   ============================================================ */

window.Screens = window.Screens || {};

window.Screens.login = function (mount) {
  mount.innerHTML = `
    <div class="auth-screen">
      <form class="auth-card" id="login-form" novalidate>
        <div class="auth-mark"></div>
        <h1 class="auth-title">NIK</h1>
        <p class="auth-sub">Личная система</p>
        <input
          class="auth-input"
          type="password"
          id="login-password"
          placeholder="••••••••"
          autocomplete="current-password"
          autofocus
        />
        <button class="auth-btn" type="submit">Войти</button>
        <p class="auth-error" id="login-error"></p>
      </form>
    </div>
  `;

  const form = document.getElementById('login-form');
  const input = document.getElementById('login-password');
  const errorEl = document.getElementById('login-error');
  const card = mount.querySelector('.auth-card');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = input.value.trim();
    if (!pwd) return;
    const role = await Auth.attemptLogin(pwd);
    if (role) {
      Router.go(role === 'coach' ? '/training' : '/home');
    } else {
      errorEl.textContent = 'Неверный пароль';
      card.classList.remove('auth-shake');
      requestAnimationFrame(() => card.classList.add('auth-shake'));
      input.value = '';
      input.focus();
    }
  });
};

window.Screens.home = function (mount) {
  mount.innerHTML = `
    <div class="home-screen">
      <div class="home-header">
        <p class="home-eyebrow">Личная система</p>
        <h1 class="home-title">Добро пожаловать</h1>
      </div>
      <div class="home-grid">
        <button class="tile tile-training" data-route="/training">
          <i class="tile-icon ti ti-flame" aria-hidden="true"></i>
          <div>
            <p class="tile-name">Тренировки</p>
            <p class="tile-desc">План, замеры, прогрессия</p>
            <div class="tile-rule"></div>
          </div>
        </button>
        <button class="tile" data-route="/habits">
          <i class="tile-icon ti ti-checklist" aria-hidden="true"></i>
          <div>
            <p class="tile-name">Привычки</p>
            <p class="tile-desc">Дисциплина по месяцам</p>
            <div class="tile-rule"></div>
          </div>
        </button>
        <button class="tile tile-finance" data-route="/finance">
          <i class="tile-icon ti ti-chart-bar" aria-hidden="true"></i>
          <div>
            <p class="tile-name">Финансы</p>
            <p class="tile-desc">Доход, история, профит</p>
            <div class="tile-rule"></div>
          </div>
        </button>
        <button class="tile" data-route="/goals">
          <i class="tile-icon ti ti-target-arrow" aria-hidden="true"></i>
          <div>
            <p class="tile-name">Цели</p>
            <p class="tile-desc">Сбережения, сезоны, база</p>
            <div class="tile-rule"></div>
          </div>
        </button>
      </div>
      <div class="home-footer">
        <button class="logout-link" id="sync-settings-btn">Настройки синхронизации</button>
        <span style="margin: 0 8px; color: var(--bone-faint);">·</span>
        <button class="logout-link" id="logout-btn">Выйти</button>
        <div id="sync-status" style="margin-top:8px; font-size:11px;"></div>
      </div>
    </div>
  `;

  mount.querySelectorAll('.tile').forEach(tile => {
    tile.addEventListener('click', () => Router.go(tile.dataset.route));
  });
  document.getElementById('logout-btn').addEventListener('click', () => {
    Auth.logout();
    Router.go('/login');
  });
  document.getElementById('sync-settings-btn').addEventListener('click', () => {
    Screens.openSyncSettings();
  });
};

Screens.openSyncSettings = function () {
  const cfg = FirebaseSync.getConfig() || { databaseURL: '' };
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';
  overlay.innerHTML = `
    <div class="tr-modal" style="max-width:400px;">
      <p class="tr-modal-title">Синхронизация с Firebase</p>
      <p style="font-size:12px; color:var(--bone-faint); margin:-6px 0 14px;">
        Вставь адрес базы данных из Firebase (Realtime Database → вкладка "Data" → ссылка вида https://имя-проекта-default-rtdb.firebaseio.com).
      </p>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Адрес базы данных<input type="text" id="cfg-url" value="${cfg.databaseURL}" placeholder="https://nik-tracker-default-rtdb.firebaseio.com"></label>
      </div>
      <div class="tr-modal-actions">
        <button class="tr-modal-btn-secondary" id="cfg-cancel">Отмена</button>
        <button class="tr-modal-btn-primary" id="cfg-save">Сохранить</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#cfg-cancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#cfg-save').addEventListener('click', async () => {
    const databaseURL = overlay.querySelector('#cfg-url').value.trim();
    if (!databaseURL) return;
    FirebaseSync.setConfig({ databaseURL });
    overlay.remove();
    await FirebaseSync.pullIntoStore();
  });
};