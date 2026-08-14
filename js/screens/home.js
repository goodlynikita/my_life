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

      <!-- Hero slider -->
      <div class="hero-slider" id="hero-slider">
        <div class="hero-slides" id="hero-slides">

          <!-- Слайд 1: Фокус дня -->
          <div class="hero-slide slide-focus" data-route="/training">
            <div class="hero-slide-label">ФОКУС ДНЯ</div>
            <div class="hero-slide-main">
              <div class="hero-workout">
                <span class="hero-workout-icon">💪</span>
                <span class="hero-workout-text">${todayWorkout || 'Заполни тренировку'}</span>
              </div>
            </div>
            <div class="hero-slide-sub">
              <div class="hero-stat">
                <span class="hero-stat-icon">✅</span>
                <span>Привычки: <strong>${todayDone}/${habList.length}</strong> сегодня</span>
              </div>
              <div class="hero-stat" style="margin-top:6px;">
                <span class="hero-stat-icon">📅</span>
                <span>${now.getDate()} ${months[now.getMonth()]}, ${['вс','пн','вт','ср','чт','пт','сб'][now.getDay()]}</span>
              </div>
            </div>
            <div class="hero-slide-glow slide-glow-blue"></div>
          </div>

          <!-- Слайд 2: Финансовый пульс -->
          <div class="hero-slide slide-finance" data-route="/finance">
            <div class="hero-slide-label">ФИНАНСОВЫЙ ПУЛЬС</div>
            <div class="hero-slide-main">
              <div class="hero-amount">${monthIncome>0?fmtAmt(monthIncome):'Добавь доход'}</div>
              <div class="hero-amount-sub">${months[now.getMonth()]} ${now.getFullYear()}</div>
            </div>
            <div class="hero-slide-sub">
              <div class="hero-stat">
                <span class="hero-stat-icon">🛡</span>
                <span>Подушка: <strong style="color:${(monthIncome-97000)>=0?'#4ADE80':'#F87171'}">${fmtAmt(Math.max(0,monthIncome-97000))}</strong></span>
              </div>
              <div class="hero-stat" style="margin-top:6px;">
                <span class="hero-stat-icon">⚡</span>
                <span>Ближайший: <strong>Зубы 24 000₽</strong></span>
              </div>
            </div>
            <div class="hero-slide-glow slide-glow-green"></div>
          </div>

          <!-- Слайд 3: Прогресс целей -->
          <div class="hero-slide slide-goals" data-route="/goals">
            <div class="hero-slide-label">ПРОГРЕСС ЦЕЛЕЙ</div>
            <div class="hero-slide-main">
              <div class="hero-goals-pct">${goalsPct}%</div>
              <div class="hero-goals-bar">
                <div class="hero-goals-fill" style="width:${goalsPct}%"></div>
              </div>
            </div>
            <div class="hero-slide-sub">
              <div class="hero-stat">
                <span class="hero-stat-icon">🎯</span>
                <span><strong>${doneCnt}</strong> из <strong>${totalCnt}</strong> закрыто</span>
              </div>
              <div class="hero-stat" style="margin-top:6px;">
                <span class="hero-stat-icon">💎</span>
                <span>Осталось: <strong>${fmtAmt(yearAmt-doneYearAmt)}</strong></span>
              </div>
            </div>
            <div class="hero-slide-glow slide-glow-purple"></div>
          </div>

        </div>
        <!-- Dots -->
        <div class="hero-dots">
          <div class="hero-dot active" data-idx="0"></div>
          <div class="hero-dot" data-idx="1"></div>
          <div class="hero-dot" data-idx="2"></div>
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

  /* ── Hero slider ── */
  const slider = document.getElementById('hero-slider');
  const slides = document.getElementById('hero-slides');
  const dots = mount.querySelectorAll('.hero-dot');
  if (slider && slides) {
    let cur = 0;
    let autoTimer = null;
    const total = 3;

    function goTo(idx) {
      cur = (idx + total) % total;
      slides.style.transform = \`translateX(-\${cur * 100}%)\`;
      dots.forEach((d,i) => d.classList.toggle('active', i === cur));
    }

    function startAuto() {
      if (autoTimer) clearInterval(autoTimer);
      autoTimer = setInterval(() => goTo(cur + 1), 4000);
    }

    dots.forEach(d => {
      d.addEventListener('click', e => {
        e.stopPropagation();
        goTo(parseInt(d.dataset.idx));
        startAuto();
      });
    });

    /* Swipe */
    let tx = 0, sx = 0;
    slides.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    slides.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) { goTo(dx < 0 ? cur+1 : cur-1); startAuto(); }
    });

    startAuto();
  }
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