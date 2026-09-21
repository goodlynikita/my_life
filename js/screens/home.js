window.Screens = window.Screens || {};

window.Screens.home = function(mount) {
  var store = Store.get();
  var goals = ((store.goals && store.goals.directions) || []).filter(Boolean);
  var yearAmt = goals.filter(function(g){return g.season!=='all';}).reduce(function(s,g){return s+(g.amount||0);},0);
  var doneCnt = goals.filter(function(g){return g.done;}).length;
  var totalCnt = goals.length;
  var goalsPct = totalCnt ? Math.round(doneCnt/totalCnt*100) : 0;
  var doneYearAmt = goals.filter(function(g){return g.done&&g.season!=='all';}).reduce(function(s,g){return s+(g.amount||0);},0);

  var now = new Date();
  var MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  var DOWS_SHORT = ['вс','пн','вт','ср','чт','пт','сб'];
  var DOWS_FULL = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];

  function fmt(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ')+'₽'; }

  var yr = now.getFullYear();
  var mm = String(now.getMonth()+1).padStart(2,'0');
  var finYears = (store.finance && store.finance.years) || {};
  var entries = (finYears[yr] && finYears[yr][mm] && finYears[yr][mm].entries) || [];
  var monthIncome = entries.reduce(function(s,e){return s+((e&&e.amount)||0);},0);

  var finCats = (store.finance && store.finance.balance && store.finance.balance.categories) || [];
  var plannedExpenses = finCats.length > 0
    ? finCats.reduce(function(s,c){return s+(c&&c.amt||0);}, 0)
    : ((store.home && store.home.plannedExpenses) || 97000);
  var cushion = monthIncome - plannedExpenses;

  var habList = ((store.habits && store.habits.list) || []).filter(Boolean);
  var habMarks = ((store.habits && store.habits.months) || {})[yr+'-'+mm] || {};
  var todayDone = habList.filter(function(h){
    return habMarks[h.id] && habMarks[h.id][now.getDate()] === 'done';
  }).length;

  var plans = (store.training && store.training.plans) || [];
  var activePlan = plans.filter(Boolean).find(function(p){return p.status==='active';}) || plans.filter(Boolean).slice(-1)[0];
  var todayGroups = [];
  var todayWorkout = '';
  if (activePlan && activePlan.weeks) {
    activePlan.weeks.forEach(function(week){
      if(!week||!week.days) return;
      week.days.forEach(function(day){
        if(!day||!day.date) return;
        var p = day.date.split('.');
        if(parseInt(p[0])===now.getDate() && parseInt(p[1])===(now.getMonth()+1)) {
          var sessions = day.sessions || [];
          var exercises = day.exercises || [];
          sessions.filter(function(s){return s&&s.type!=='Отдых'&&s.type!=='10k';}).forEach(function(s){
            if(s.groups&&s.groups.length) todayGroups = todayGroups.concat(s.groups);
            else if(s.type) todayGroups.push(s.type);
          });
          if(!todayGroups.length && exercises.length>0) todayWorkout = 'Тренировка';
        }
      });
    });
    if(todayGroups.length) todayWorkout = todayGroups.join(' + ');
  }

  var curMonth = now.getMonth();
  var curSeason = curMonth<=7 ? 'summer' : curMonth<=10 ? 'autumn' : 'december';
  var seasonGoals = goals.filter(function(g){return g.season===curSeason;});
  var seasonTotal = seasonGoals.reduce(function(s,g){return s+(g.amount||0);},0);
  var seasonDone  = seasonGoals.filter(function(g){return g.done;}).reduce(function(s,g){return s+(g.amount||0);},0);
  var seasonLeft  = seasonTotal - seasonDone;

  /* Habit dots — 12 кружков: первые todayDone залиты */
  function makeHabitDots(done, total) {
    var dots = '';
    var show = Math.min(12, Math.max(total, 6));
    for(var i=0; i<show; i++) {
      dots += '<div class="wa-habits-dot '+(i < done ? 'done' : 'empty')+'"></div>';
    }
    return dots;
  }

  /* Finance sparkline (SVG) */
  var sparkSvg = '<svg class="wa-spark" width="80" height="38" viewBox="0 0 80 38" fill="none" xmlns="http://www.w3.org/2000/svg">'
    + '<polyline points="0,30 12,24 22,28 33,18 45,22 56,12 65,16 80,4" '
    + 'stroke="#A78BFA" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    + '<circle cx="80" cy="4" r="4" fill="#A78BFA" opacity="0.9"/>'
    + '</svg>';

  /* Goals orbit */
  var orbitHtml = '<div class="wa-orbit">'
    + '<div class="wa-orbit-ring"><div class="wa-orbit-dot"></div></div>'
    + '<div class="wa-orbit-center"></div>'
    + '</div>';

  /* Date string */
  var dateStr = DOWS_FULL[now.getDay()]+', '+now.getDate()+' '+MONTHS[now.getMonth()].toLowerCase();

  /* Hero banner — прогресс целей */
  var heroLeftNum = yearAmt - doneYearAmt > 0 ? fmt(yearAmt - doneYearAmt) : '—';
  var heroHtml = '<div class="wa-hero" data-route="/goals">'
    + '<div class="wa-hero-glow"></div>'
    + '<div class="wa-hero-content">'
    + '<div class="wa-hero-label">ПРОГРЕСС ЦЕЛЕЙ</div>'
    + '<div class="wa-hero-pct">'+goalsPct+'%</div>'
    + '<div class="wa-hero-bar-track"><div class="wa-hero-bar-fill" id="wa-bar" style="width:0%"></div></div>'
    + '<div class="wa-hero-stats">'
    + '<div class="wa-hero-stat"><div class="wa-hero-stat-num">'+doneCnt+'<span style="opacity:0.5;font-size:12px;">/'+totalCnt+'</span></div><div class="wa-hero-stat-lbl">закрыто</div></div>'
    + '<div style="width:1px;height:28px;background:rgba(255,255,255,0.15);"></div>'
    + '<div class="wa-hero-stat"><div class="wa-hero-stat-num" style="font-size:13px;">'+heroLeftNum+'</div><div class="wa-hero-stat-lbl">осталось</div></div>'
    + '</div>'
    + '</div>'
    + '<div class="wa-hero-dots" id="wa-hero-dots">'
    + '<div class="wa-hero-dot active" data-hero-slide="0"></div>'
    + '<div class="wa-hero-dot" data-hero-slide="1"></div>'
    + '<div class="wa-hero-dot" data-hero-slide="2"></div>'
    + '<div class="wa-hero-dot" data-hero-slide="3"></div>'
    + '<div class="wa-hero-dot" data-hero-slide="4"></div>'
    + '</div>'
    + '</div>';

  /* Grid карточки */
  var gridHtml = '<div class="wa-grid">'
    /* 01 — Тренировки */
    + '<div class="wa-card wa-card-training" data-route="/training">'
    + '<div class="wa-body-img"></div>'
    + '<div>'
    + '<div class="wa-card-header"><span class="wa-card-num">01</span><span class="wa-card-cat">BODY</span></div>'
    + '<div class="wa-card-title">ТРЕНИРОВКИ</div>'
    + '</div>'
    + '<div class="wa-card-sub">'+(todayWorkout || 'СИЛА · ВЫНОСЛИВОСТЬ · ПРОГРЕСС')+'</div>'
    + '<div class="wa-card-arrow"><i class="ti ti-arrow-up-right"></i></div>'
    + '</div>'
    /* 02 — Привычки */
    + '<div class="wa-card wa-card-habits" data-route="/habits">'
    + '<div class="wa-habits-dots">'+makeHabitDots(todayDone, habList.length)+'</div>'
    + '<div>'
    + '<div class="wa-card-header"><span class="wa-card-num">02</span><span class="wa-card-cat">DISCIPLINE</span></div>'
    + '<div class="wa-card-title">ПРИВЫЧКИ</div>'
    + '</div>'
    + '<div class="wa-card-sub">МАЛЕНЬКИЕ ШАГИ · БОЛЬШИЕ ИЗМЕНЕНИЯ</div>'
    + '<div class="wa-card-arrow"><i class="ti ti-arrow-right"></i></div>'
    + '</div>'
    /* 03 — Финансы */
    + '<div class="wa-card wa-card-finance" data-route="/finance">'
    + sparkSvg
    + '<div>'
    + '<div class="wa-card-header"><span class="wa-card-num">03</span><span class="wa-card-cat">WEALTH</span></div>'
    + '<div class="wa-card-title">ФИНАНСЫ</div>'
    + '</div>'
    + '<div class="wa-card-sub">КОНТРОЛЬ · РОСТ · СВОБОДА</div>'
    + '<div class="wa-card-arrow"><i class="ti ti-arrow-right"></i></div>'
    + '</div>'
    /* 04 — Цели */
    + '<div class="wa-card wa-card-goals" data-route="/goals">'
    + orbitHtml
    + '<div>'
    + '<div class="wa-card-header"><span class="wa-card-num">04</span><span class="wa-card-cat">GROWTH</span></div>'
    + '<div class="wa-card-title">ЦЕЛИ</div>'
    + '</div>'
    + '<div class="wa-card-sub">ФОКУС · ПЛАН · РЕЗУЛЬТАТ</div>'
    + '<div class="wa-card-arrow"><i class="ti ti-arrow-right"></i></div>'
    + '</div>'
    + '</div>';

  /* Footer */
  var footerHtml = '<div class="wa-footer">'
    + '<div class="wa-footer-brand">'
    + '<span class="wa-footer-name">WINTER ARC</span>'
    + '<div class="wa-footer-pipe"></div>'
    + '<span class="wa-footer-tagline">YOUR NEXT OPPONENT IS YOU.</span>'
    + '</div>'
    + '<div style="display:flex;align-items:center;gap:10px;">'
    + '<div id="sync-status" class="wa-sync"></div>'
    + '<span class="wa-footer-right">COMPETE WITH YOURSELF.</span>'
    + '</div>'
    + '</div>';

  /* Full screen */
  mount.innerHTML = '<div class="wa-screen">'
    + '<div class="wa-header">'
    + '<div>'
    + '<div class="wa-header-date">'+dateStr+'</div>'
    + '<div class="wa-header-title">YOU</div>'
    + '</div>'
    + '<div class="wa-header-actions">'
    + '<button class="wa-btn-icon" id="slides-edit-btn" title="Редактор слайдов"><i class="ti ti-layout"></i></button>'
    + '<button class="wa-btn-icon" id="tile-settings-btn" title="Плитки"><i class="ti ti-layout-grid"></i></button>'
    + '<button class="wa-btn-icon" id="slider-settings-btn" title="Настройки"><i class="ti ti-settings"></i></button>'
    + '<button class="wa-btn-icon" id="logout-btn"><i class="ti ti-logout"></i></button>'
    + '</div>'
    + '</div>'
    + heroHtml
    + gridHtml
    + footerHtml
    + '</div>';

  /* Animate progress bar */
  setTimeout(function() {
    var bar = document.getElementById('wa-bar');
    if(bar) bar.style.width = goalsPct + '%';
  }, 100);

  /* Navigation */
  mount.querySelectorAll('[data-route]').forEach(function(el) {
    el.addEventListener('click', function() { Router.go(el.dataset.route); });
  });

  /* Logout */
  document.getElementById('logout-btn').addEventListener('click', function() {
    Auth.logout().then(function() { Router.go('/login'); });
  });

  /* Slides editor */
  var slidesEditBtn = document.getElementById('slides-edit-btn');
  if(slidesEditBtn) slidesEditBtn.addEventListener('click', function() {
    window.Slides && window.Slides.openEditor();
  });

  /* Hero dots — visually rotating only (они декоративные, нет слайдера) */
  var heroDots = mount.querySelectorAll('[data-hero-slide]');
  if(heroDots.length) {
    var heroSlide = 0;
    setInterval(function() {
      heroDots[heroSlide].classList.remove('active');
      heroSlide = (heroSlide + 1) % heroDots.length;
      heroDots[heroSlide].classList.add('active');
    }, 3500);
    heroDots.forEach(function(d) {
      d.addEventListener('click', function(e) {
        e.stopPropagation();
        heroDots[heroSlide].classList.remove('active');
        heroSlide = parseInt(d.dataset.heroSlide);
        heroDots[heroSlide].classList.add('active');
      });
    });
  }

  /* ── Tile Settings (сохраняем совместимость) ── */
  document.getElementById('tile-settings-btn').addEventListener('click', function() {
    /* упрощённая заглушка — можно расширить */
    var ov = document.createElement('div');
    ov.className = 'tr-modal-overlay';
    ov.style.cssText = 'align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
    ov.innerHTML = '<div style="background:#1A1C22;border-radius:16px;width:100%;max-width:420px;padding:24px;font-family:Montserrat,sans-serif;">'
      + '<div style="font-size:17px;font-weight:800;color:#E8E5DC;margin-bottom:16px;">Настройка плиток</div>'
      + '<p style="font-size:13px;color:#9D9A92;line-height:1.6;">Все 4 карточки отображаются в сетке 2×2.<br>Макет оптимизирован под WINTER ARC.</p>'
      + '<button id="ts-close" style="width:100%;margin-top:20px;padding:13px;background:#4A7CFF;border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:Montserrat,sans-serif;">OK</button>'
      + '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
    ov.querySelector('#ts-close').addEventListener('click', function(){ ov.remove(); });
  });

  /* ── Slider Settings ── */
  document.getElementById('slider-settings-btn').addEventListener('click', function() {
    var ov = document.createElement('div');
    ov.className = 'tr-modal-overlay';
    ov.style.cssText = 'align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
    ov.innerHTML = '<div style="background:#1A1C22;border-radius:16px;width:100%;max-width:420px;padding:24px;font-family:Montserrat,sans-serif;">'
      + '<div style="font-size:17px;font-weight:800;color:#E8E5DC;margin-bottom:16px;">Настройки</div>'
      + '<p style="font-size:13px;color:#9D9A92;line-height:1.6;">Главный экран переключился на дизайн WINTER ARC.<br>Баннер вверху показывает прогресс целей.</p>'
      + '<button id="ss-close" style="width:100%;margin-top:20px;padding:13px;background:linear-gradient(135deg,#A855F7,#EC4899);border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:Montserrat,sans-serif;">Понятно</button>'
      + '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
    ov.querySelector('#ss-close').addEventListener('click', function(){ ov.remove(); });
  });

  /* ── Анимация блика при касании ── */
  (function() {
    var grid = mount.querySelector('.wa-grid');
    if(!grid) return;
    var glow = document.createElement('div');
    glow.style.cssText = 'position:absolute;width:180px;height:180px;border-radius:50%;pointer-events:none;z-index:3;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(255,255,255,0.07) 0%,transparent 70%);filter:blur(24px);left:50%;top:50%;transition:left 2s cubic-bezier(.25,.46,.45,.94),top 2s cubic-bezier(.25,.46,.45,.94);';
    grid.appendChild(glow);
    var t = 0;
    setInterval(function() {
      t += 0.007;
      var px = 50 + Math.sin(t * 0.8) * 22 + Math.sin(t * 0.35) * 10;
      var py = 50 + Math.cos(t * 0.65) * 20 + Math.cos(t * 0.45) * 8;
      glow.style.left = px + '%';
      glow.style.top  = py + '%';
    }, 60);
    grid.addEventListener('mousemove', function(e) {
      var r = grid.getBoundingClientRect();
      glow.style.left = ((e.clientX - r.left) / r.width * 100) + '%';
      glow.style.top  = ((e.clientY - r.top)  / r.height * 100) + '%';
    });
    grid.addEventListener('touchmove', function(e) {
      var r = grid.getBoundingClientRect();
      glow.style.left = ((e.touches[0].clientX - r.left) / r.width * 100) + '%';
      glow.style.top  = ((e.touches[0].clientY - r.top)  / r.height * 100) + '%';
    }, {passive:true});
  })();
};
