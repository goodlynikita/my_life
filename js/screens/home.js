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
  /* Динамичные данные */
  const goals = (Store.get().goals?.directions || []).filter(Boolean);
  const allAmt = goals.reduce((s,g)=>s+g.amount,0);
  const yearAmt = goals.filter(g=>g.season!=='all').reduce((s,g)=>s+g.amount,0);
  const doneCnt = goals.filter(g=>g.done).length;
  const totalCnt = goals.length;
  const goalsPct = totalCnt ? Math.round(doneCnt/totalCnt*100) : 0;

  const now = new Date();
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

  function fmtAmt(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ') + '₽';
  }

  /* Месячный доход */
  const monthEntries = Store.get().finance?.years?.[now.getFullYear()]?.[String(now.getMonth()+1).padStart(2,'0')]?.entries || [];
  const monthIncome = monthEntries.reduce((s,e)=>s+(e.amount||0),0);

  /* Привычки сегодня */
  const habList = (Store.get().habits?.list || []).filter(Boolean);
  const habMk = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const habMarks = Store.get().habits?.months?.[habMk] || {};
  const todayDone = habList.filter(h => habMarks[h.id]?.[now.getDate()] === 'done').length;

  mount.innerHTML = `
    <div class="home2-screen">
      <div class="home2-header">
        <div>
          <p class="home2-date">${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}</p>
          <h1 class="home2-title">NIK · Система</h1>
        </div>
        <button class="home2-logout" id="logout-btn"><i class="ti ti-logout"></i></button>
      </div>

      <!-- Цели — главный блок -->
      <div class="home2-goals-card" data-route="/goals">
        <div class="home2-goals-eyebrow">🎯 ОБЩАЯ СУММА ЦЕЛЕЙ</div>
        <div class="home2-goals-amount">${fmtAmt(allAmt)}</div>
        <div class="home2-goals-sub">из них на текущий год: ${fmtAmt(yearAmt)}</div>
        <div class="home2-goals-bar-track">
          <div class="home2-goals-bar-fill" style="width:${goalsPct}%;"></div>
        </div>
        <div class="home2-goals-progress">${doneCnt} из ${totalCnt} закрыто · ${goalsPct}%</div>
      </div>

      <!-- Плитки -->
      <div class="home2-grid">
        <button class="home2-tile home2-tile-training" data-route="/training">
          <i class="ti ti-flame"></i>
          <div class="home2-tile-name">Тренировки</div>
          <div class="home2-tile-desc">План · прогрессия</div>
        </button>
        <button class="home2-tile home2-tile-habits" data-route="/habits">
          <i class="ti ti-checklist"></i>
          <div class="home2-tile-name">Привычки</div>
          <div class="home2-tile-desc">Сегодня ${todayDone}/${habList.length}</div>
        </button>
        <button class="home2-tile home2-tile-finance" data-route="/finance">
          <i class="ti ti-chart-bar"></i>
          <div class="home2-tile-name">Финансы</div>
          <div class="home2-tile-desc">${monthIncome>0?fmtAmt(monthIncome)+' в '+months[now.getMonth()]:'Добавить доход'}</div>
        </button>
        <button class="home2-tile home2-tile-goals" data-route="/goals">
          <i class="ti ti-target-arrow"></i>
          <div class="home2-tile-name">Цели</div>
          <div class="home2-tile-desc">${goalsPct}% выполнено</div>
        </button>
      </div>

      <div class="home2-footer">
        <div id="sync-status" style="font-size:11px;color:#9D9A92;"></div>
      </div>
    </div>
  `;

  mount.querySelectorAll('[data-route]').forEach(el => {
    el.addEventListener('click', () => Router.go(el.dataset.route));
  });
  document.getElementById('logout-btn').addEventListener('click', () => {
    Auth.logout();
    Router.go('/login');
  });
};