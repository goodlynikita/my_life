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
  const doneYearAmt = goals.filter(g=>g.done && g.season!=='all').reduce((s,g)=>s+g.amount,0);

  const now = new Date();
  const months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

  function fmtAmt(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ') + '₽';
  }

  /* Месячный доход */
  const monthEntries = Store.get().finance?.years?.[now.getFullYear()]?.[String(now.getMonth()+1).padStart(2,'0')]?.entries || [];
  const monthIncome = monthEntries.reduce((s,e)=>s+(e.amount||0),0);

  /* Тренировка сегодня */
  const plans = Store.get().training?.plans || [];
  const activePlan = plans.find(p => p && p.status === 'active') || plans[plans.length-1];
  let todayWorkout = '';
  if (activePlan) {
    activePlan.weeks?.forEach(week => {
      week?.days?.forEach(day => {
        if (day?.date) {
          const [d,m] = day.date.split('.');
          if (parseInt(d)===now.getDate() && parseInt(m)===(now.getMonth()+1)) {
            const sessions = day.sessions || [];
            const types = sessions.filter(s=>s&&s.type!=='Отдых').map(s=>{
              const groups = s.groups?.length ? s.groups.join(' · ') : s.type;
              return groups;
            });
            todayWorkout = types.join(', ') || (sessions.some(s=>s?.type==='Отдых') ? 'Отдых' : '');
          }
        }
      });
    });
  }

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

      <!-- Сводка месяца -->
      <div class="home2-summary-card">
        <div class="home2-summary-top">
          <div>
            <div class="home2-goals-eyebrow">${months[now.getMonth()].toUpperCase()} ${now.getFullYear()}</div>
            <div class="home2-summary-title">Сводка месяца</div>
          </div>
        </div>
        <div class="home2-summary-grid">
          <div class="home2-summary-item">
            <div class="home2-summary-label">Доход</div>
            <div class="home2-summary-val" style="color:#16A34A;">${monthIncome>0?fmtAmt(monthIncome):'—'}</div>
          </div>
          <div class="home2-summary-item">
            <div class="home2-summary-label">Привычки</div>
            <div class="home2-summary-val" style="color:#A8C97F;">${todayDone}/${habList.length} сегодня</div>
          </div>
          <div class="home2-summary-item">
            <div class="home2-summary-label">Цели закрыто</div>
            <div class="home2-summary-val" style="color:#A78BFA;">${doneCnt}/${totalCnt} · ${goalsPct}%</div>
          </div>
          <div class="home2-summary-item" data-route="/goals" style="cursor:pointer;">
            <div class="home2-summary-label">Осталось целей</div>
            <div class="home2-summary-val" style="color:#F0EDE5;">${fmtAmt(yearAmt - doneYearAmt)}</div>
          </div>
        </div>
        <div class="home2-goals-bar-track" style="margin-top:12px;">
          <div class="home2-goals-bar-fill" style="width:${goalsPct}%;"></div>
        </div>
      </div>

      <!-- Плитки -->
      <div class="home2-grid">
        <button class="home2-tile home2-tile-training" data-route="/training">
          <div class="home2-tile-content">
            <i class="ti ti-flame home2-tile-icon"></i>
            <div class="home2-tile-name">Тренировки</div>
            <div class="home2-tile-desc">${todayWorkout || 'Заполни тренировку'}</div>
          </div>
        </button>
        <button class="home2-tile home2-tile-habits" data-route="/habits">
          <div class="home2-tile-content">
            <i class="ti ti-checklist home2-tile-icon"></i>
            <div class="home2-tile-name">Привычки</div>
            <div class="home2-tile-desc">Сегодня ${todayDone}/${habList.length}</div>
          </div>
        </button>
        <button class="home2-tile home2-tile-finance" data-route="/finance">
          <div class="home2-tile-content">
            <i class="ti ti-chart-bar home2-tile-icon"></i>
            <div class="home2-tile-name">Финансы</div>
            <div class="home2-tile-desc">${monthIncome>0?fmtAmt(monthIncome)+' / '+months[now.getMonth()]:'Добавить доход'}</div>
          </div>
        </button>
        <button class="home2-tile home2-tile-goals" data-route="/goals">
          <div class="home2-tile-content">
            <i class="ti ti-target-arrow home2-tile-icon"></i>
            <div class="home2-tile-name">Цели</div>
            <div class="home2-tile-desc">${goalsPct}% выполнено</div>
          </div>
        </button>
      </div>      </div>

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

  /* ── Баннер колеса жизни ── */
  (function checkWheelReminder() {
    const now = new Date();
    const day = now.getDate();
    if (day > 7) return; // показываем только первые 7 дней месяца

    // Проверяем прошлый месяц
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevMk = `${prevYear}-${String(prevMonth+1).padStart(2,'0')}`;
    const MONTHS_RU = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];

    const wheelData = Store.get().habits?.wheel?.[prevMk];
    if (wheelData) return; // уже заполнено

    // Показываем баннер
    const banner = document.createElement('div');
    banner.className = 'wheel-banner';
    banner.innerHTML = `
      <div class="wheel-banner-inner">
        <div class="wheel-banner-icon">🎯</div>
        <div class="wheel-banner-text">
          <div class="wheel-banner-title">${MONTHS_RU[prevMonth].charAt(0).toUpperCase()+MONTHS_RU[prevMonth].slice(1)} закончился</div>
          <div class="wheel-banner-sub">Оцени месяц — колесо жизни</div>
        </div>
        <button class="wheel-banner-btn" id="wheel-banner-go">Заполнить</button>
        <button class="wheel-banner-close" id="wheel-banner-close">✕</button>
      </div>`;

    // Вставляем после header
    const header = mount.querySelector('.home2-header');
    if (header) header.after(banner);

    document.getElementById('wheel-banner-go').addEventListener('click', () => {
      Router.go('/habits');
      // Небольшая задержка чтобы экран загрузился, потом переключаем на вкладку колеса
      setTimeout(() => {
        const wheelTab = document.querySelector('.hab-tab[data-tab="wheel"]');
        if (wheelTab) wheelTab.click();
      }, 300);
    });

    document.getElementById('wheel-banner-close').addEventListener('click', () => {
      banner.remove();
    });
  })();
};