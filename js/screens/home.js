/* HOME SCREEN v3 */
window.Screens = window.Screens || {};

window.Screens.home = function(mount) {
  var goals = (Store.get().goals && Store.get().goals.directions || []).filter(Boolean);
  var allAmt = goals.reduce(function(s,g){return s+g.amount;},0);
  var yearAmt = goals.filter(function(g){return g.season!=='all';}).reduce(function(s,g){return s+g.amount;},0);
  var doneCnt = goals.filter(function(g){return g.done;}).length;
  var totalCnt = goals.length;
  var goalsPct = totalCnt ? Math.round(doneCnt/totalCnt*100) : 0;
  var doneYearAmt = goals.filter(function(g){return g.done&&g.season!=='all';}).reduce(function(s,g){return s+g.amount;},0);

  var now = new Date();
  var months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  var dows = ['вс','пн','вт','ср','чт','пт','сб'];

  function fmt(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ')+'₽';
  }

  var yr = now.getFullYear();
  var mm = String(now.getMonth()+1).padStart(2,'0');
  var entries = ((Store.get().finance||{}).years||{})[yr]&&
                ((Store.get().finance||{}).years||{})[yr][mm]&&
                ((Store.get().finance||{}).years||{})[yr][mm].entries || [];
  var monthIncome = entries.reduce(function(s,e){return s+(e.amount||0);},0);
  var cushion = Math.max(0, monthIncome-97000);

  var habList = ((Store.get().habits||{}).list||[]).filter(Boolean);
  var habMk = yr+'-'+mm;
  var habMarks = ((Store.get().habits||{}).months||{})[habMk]||{};
  var todayDone = habList.filter(function(h){return habMarks[h.id]&&habMarks[h.id][now.getDate()]==='done';}).length;

  var plans = ((Store.get().training)||{}).plans||[];
  var activePlan = plans.filter(Boolean).find(function(p){return p.status==='active';})||plans[plans.length-1];
  var todayWorkout = '';
  if (activePlan && activePlan.weeks) {
    activePlan.weeks.forEach(function(week){
      if(!week||!week.days) return;
      week.days.forEach(function(day){
        if(!day||!day.date) return;
        var parts = day.date.split('.');
        if(parseInt(parts[0])===now.getDate()&&parseInt(parts[1])===(now.getMonth()+1)){
          var sessions = day.sessions||[];
          var types = sessions.filter(function(s){return s&&s.type!=='Отдых';}).map(function(s){
            return s.groups&&s.groups.length?s.groups.join(' · '):s.type;
          });
          todayWorkout = types.join(', ')||(sessions.some(function(s){return s&&s.type==='Отдых';})?'Отдых':'');
        }
      });
    });
  }

  var expList = ((Store.get().finance)||{}).expensesList||[];
  var nextExp = expList.filter(Boolean).find(function(e){return e.amount>0;});

  var cushionColor = cushion>0?'#4ADE80':'#F87171';

  mount.innerHTML = [
    '<div class="home2-screen">',
    '<div class="home2-header">',
    '<div>',
    '<p class="home2-date">'+now.getDate()+' '+months[now.getMonth()]+' '+yr+'</p>',
    '<h1 class="home2-title">NIK · Система</h1>',
    '</div>',
    '<button class="home2-logout" id="logout-btn"><i class="ti ti-logout"></i></button>',
    '</div>',

    '<div class="hero-slider" id="hero-slider">',
    '<div class="hero-slides" id="hero-slides">',

    // Слайд 1
    '<div class="hero-slide slide-focus" data-route="/training">',
    '<div class="hero-slide-label">ФОКУС ДНЯ</div>',
    '<div class="hero-slide-main"><div class="hero-workout">',
    '<span class="hero-workout-icon">💪</span>',
    '<span class="hero-workout-text">'+(todayWorkout||'Заполни тренировку')+'</span>',
    '</div></div>',
    '<div class="hero-slide-sub">',
    '<div class="hero-stat"><span class="hero-stat-icon">✅</span><span>Привычки: <strong>'+todayDone+'/'+habList.length+'</strong> сегодня</span></div>',
    '<div class="hero-stat" style="margin-top:6px;"><span class="hero-stat-icon">📅</span><span>'+now.getDate()+' '+months[now.getMonth()]+', '+dows[now.getDay()]+'</span></div>',
    '</div>',
    '<div class="hero-slide-glow slide-glow-blue"></div>',
    '</div>',

    // Слайд 2
    '<div class="hero-slide slide-finance" data-route="/finance">',
    '<div class="hero-slide-label">ФИНАНСОВЫЙ ПУЛЬС</div>',
    '<div class="hero-slide-main">',
    '<div class="hero-amount">'+(monthIncome>0?fmt(monthIncome):'Добавь доход')+'</div>',
    '<div class="hero-amount-sub">'+months[now.getMonth()]+' '+yr+'</div>',
    '</div>',
    '<div class="hero-slide-sub">',
    '<div class="hero-stat"><span class="hero-stat-icon">🛡</span><span>Подушка: <strong style="color:'+cushionColor+'">'+fmt(cushion)+'</strong></span></div>',
    nextExp?'<div class="hero-stat" style="margin-top:6px;"><span class="hero-stat-icon">⚡</span><span>Ближайший: <strong>'+nextExp.name+' '+fmt(nextExp.amount)+'</strong></span></div>':'',
    '</div>',
    '<div class="hero-slide-glow slide-glow-green"></div>',
    '</div>',

    // Слайд 3
    '<div class="hero-slide slide-goals" data-route="/goals">',
    '<div class="hero-slide-label">ПРОГРЕСС ЦЕЛЕЙ</div>',
    '<div class="hero-slide-main">',
    '<div class="hero-goals-pct">'+goalsPct+'%</div>',
    '<div class="hero-goals-bar"><div class="hero-goals-fill" style="width:'+goalsPct+'%"></div></div>',
    '</div>',
    '<div class="hero-slide-sub">',
    '<div class="hero-stat"><span class="hero-stat-icon">🎯</span><span><strong>'+doneCnt+'</strong> из <strong>'+totalCnt+'</strong> закрыто</span></div>',
    '<div class="hero-stat" style="margin-top:6px;"><span class="hero-stat-icon">💎</span><span>Осталось: <strong>'+fmt(yearAmt-doneYearAmt)+'</strong></span></div>',
    '</div>',
    '<div class="hero-slide-glow slide-glow-purple"></div>',
    '</div>',

    '</div>',
    '<div class="hero-dots">',
    '<div class="hero-dot active" data-idx="0"></div>',
    '<div class="hero-dot" data-idx="1"></div>',
    '<div class="hero-dot" data-idx="2"></div>',
    '</div>',
    '</div>',

    '<div class="home2-grid">',
    '<button class="home2-tile home2-tile-training" data-route="/training"><div class="home2-tile-content"><i class="ti ti-flame home2-tile-icon"></i><div class="home2-tile-name">Тренировки</div><div class="home2-tile-desc">'+(todayWorkout||'Заполни тренировку')+'</div></div></button>',
    '<button class="home2-tile home2-tile-habits" data-route="/habits"><div class="home2-tile-content"><i class="ti ti-checklist home2-tile-icon"></i><div class="home2-tile-name">Привычки</div><div class="home2-tile-desc">Сегодня '+todayDone+'/'+habList.length+'</div></div></button>',
    '<button class="home2-tile home2-tile-finance" data-route="/finance"><div class="home2-tile-content"><i class="ti ti-chart-bar home2-tile-icon"></i><div class="home2-tile-name">Финансы</div><div class="home2-tile-desc">'+(monthIncome>0?fmt(monthIncome)+' / '+months[now.getMonth()]:'Добавить доход')+'</div></div></button>',
    '<button class="home2-tile home2-tile-goals" data-route="/goals"><div class="home2-tile-content"><i class="ti ti-target-arrow home2-tile-icon"></i><div class="home2-tile-name">Цели</div><div class="home2-tile-desc">'+goalsPct+'% выполнено</div></div></button>',
    '</div>',

    '<div class="home2-footer"><div id="sync-status" style="font-size:11px;color:#9D9A92;"></div></div>',
    '</div>'
  ].join('');

  mount.querySelectorAll('[data-route]').forEach(function(el){
    el.addEventListener('click', function(){ Router.go(el.dataset.route); });
  });
  document.getElementById('logout-btn').addEventListener('click', function(){
    Auth.logout(); Router.go('/login');
  });

  // Slider
  var slidesEl = document.getElementById('hero-slides');
  var dotsEls = mount.querySelectorAll('.hero-dot');
  if (slidesEl) {
    var cur = 0;
    var autoTimer = null;
    function goTo(idx) {
      cur = ((idx%3)+3)%3;
      slidesEl.style.transform = 'translateX(-'+(cur*100)+'%)';
      dotsEls.forEach(function(d,i){ d.classList.toggle('active', i===cur); });
    }
    function startAuto() {
      if(autoTimer) clearInterval(autoTimer);
      autoTimer = setInterval(function(){ goTo(cur+1); }, 4000);
    }
    dotsEls.forEach(function(d){
      d.addEventListener('click', function(e){
        e.stopPropagation();
        goTo(parseInt(d.dataset.idx));
        startAuto();
      });
    });
    var sx = 0;
    slidesEl.addEventListener('touchstart', function(e){ sx=e.touches[0].clientX; }, {passive:true});
    slidesEl.addEventListener('touchend', function(e){
      var dx = e.changedTouches[0].clientX - sx;
      if(Math.abs(dx)>40){ goTo(dx<0?cur+1:cur-1); startAuto(); }
    });
    startAuto();
  }
};
