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
  var DOWS = ['вс','пн','вт','ср','чт','пт','сб'];

  function fmt(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ')+'₽'; }

  var yr = now.getFullYear();
  var mm = String(now.getMonth()+1).padStart(2,'0');
  var finYears = (store.finance && store.finance.years) || {};
  var entries = (finYears[yr] && finYears[yr][mm] && finYears[yr][mm].entries) || [];
  var monthIncome = entries.reduce(function(s,e){return s+((e&&e.amount)||0);},0);
  var cushion = monthIncome - 97000;

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
          sessions.filter(function(s){return s&&s.type!=='Отдых'&&s.type!=='10k';}).forEach(function(s){
            if(s.groups&&s.groups.length) todayGroups = todayGroups.concat(s.groups);
            else if(s.type) todayGroups.push(s.type);
          });
          if(!todayGroups.length && sessions.some(function(s){return s&&s.type==='Отдых';})) todayWorkout='Отдых';
        }
      });
    });
    if(todayGroups.length) todayWorkout = todayGroups.join(' + ');
  }

  var expList = (store.finance && store.finance.expensesList) || [];
  var nextExp = expList.filter(Boolean).find(function(e){return e.amount>0;});

  var tagHtml = todayGroups.map(function(g){ return '<span class="hero-tag">'+g+'</span>'; }).join('');

  var slide1 = '<div class="hero-slide slide-focus" data-route="/training">'
    + '<div class="hero-slide-label">ФОКУС ДНЯ</div>'
    + '<div class="hero-slide-main">'
    + (todayGroups.length ? '<div class="hero-tag-row">'+tagHtml+'</div>' : '')
    + '<div class="hero-big-text'+(todayWorkout?'':' hero-dim')+'">'+(todayWorkout||'Тренировка не запланирована')+'</div>'
    + '</div>'
    + '<div class="hero-slide-sub"><div class="hero-stat-row">'
    + '<div class="hero-stat-box"><div class="hero-stat-num">'+todayDone+'<span class="hero-stat-of">/'+habList.length+'</span></div><div class="hero-stat-lbl">привычек сегодня</div></div>'
    + '<div class="hero-stat-sep"></div>'
    + '<div class="hero-stat-box"><div class="hero-stat-num">'+now.getDate()+'</div><div class="hero-stat-lbl">'+MONTHS[now.getMonth()].toLowerCase()+'</div></div>'
    + '</div></div>'
    + '<div class="hero-slide-glow slide-glow-blue"></div>'
    + '</div>';

  /* Текущий сезон для финансового пульса */
  var curMonth = now.getMonth();
  var curSeason = curMonth<=7 ? 'summer' : curMonth<=10 ? 'autumn' : 'december';
  var seasonGoals = goals.filter(function(g){return g.season===curSeason;});
  var seasonTotal = seasonGoals.reduce(function(s,g){return s+(g.amount||0);},0);
  var seasonDone = seasonGoals.filter(function(g){return g.done;}).reduce(function(s,g){return s+(g.amount||0);},0);
  var seasonLeft = seasonTotal - seasonDone;
  var seasonNames = {summer:'Лето',autumn:'Осень',december:'Декабрь'};

  var slide2 = '<div class="hero-slide slide-finance" data-route="/finance">'
    + '<div class="hero-slide-label">ФИНАНСОВЫЙ ПУЛЬС</div>'
    + '<div class="hero-slide-main">'
    + '<div class="hero-big-text">'+(monthIncome>0?fmt(monthIncome):'Нет данных')+'</div>'
    + '<div class="hero-sub-text">'+MONTHS[now.getMonth()]+' '+yr+'</div>'
    + '</div>'
    + '<div class="hero-slide-sub"><div class="hero-stat-row">'
    + '<div class="hero-stat-box"><div class="hero-stat-num" style="color:'+(cushion>=0?'#4ADE80':'#F87171')+'">'+fmt(Math.abs(cushion))+'</div><div class="hero-stat-lbl">'+(cushion>=0?'подушка':'не хватает')+'</div></div>'
    + '<div class="hero-stat-sep"></div>'
    + '<div class="hero-stat-box"><div class="hero-stat-num" style="font-size:13px;color:#FCD34D;">'+fmt(seasonLeft)+'</div><div class="hero-stat-lbl">цели '+seasonNames[curSeason]+'</div></div>'
    + '</div></div>'
    + '<div class="hero-slide-glow slide-glow-green"></div>'
    + '</div>';

  var slide3 = '<div class="hero-slide slide-goals" data-route="/goals">'
    + '<div class="hero-slide-label">ПРОГРЕСС ЦЕЛЕЙ</div>'
    + '<div class="hero-slide-main">'
    + '<div class="hero-big-text">'+goalsPct+'%</div>'
    + '<div class="hero-goals-bar"><div class="hero-goals-fill" style="width:'+goalsPct+'%"></div></div>'
    + '</div>'
    + '<div class="hero-slide-sub"><div class="hero-stat-row">'
    + '<div class="hero-stat-box"><div class="hero-stat-num">'+doneCnt+'<span class="hero-stat-of">/'+totalCnt+'</span></div><div class="hero-stat-lbl">закрыто</div></div>'
    + '<div class="hero-stat-sep"></div>'
    + '<div class="hero-stat-box"><div class="hero-stat-num" style="font-size:14px;">'+fmt(yearAmt-doneYearAmt)+'</div><div class="hero-stat-lbl">осталось</div></div>'
    + '</div></div>'
    + '<div class="hero-slide-glow slide-glow-purple"></div>'
    + '</div>';

  mount.innerHTML = '<div class="home2-screen">'
    + '<div class="home2-header"><div>'
    + '<p class="home2-date">'+DOWS[now.getDay()]+', '+now.getDate()+' '+MONTHS[now.getMonth()]+'</p>'
    + '<h1 class="home2-title">NIK \u00b7 \u0421\u0438\u0441\u0442\u0435\u043c\u0430</h1>'
    + '</div><div style="display:flex;gap:8px;"><button class="home2-logout" id="slider-settings-btn" style="font-size:16px;"><i class="ti ti-settings"></i></button><button class="home2-logout" id="logout-btn"><i class="ti ti-logout"></i></button></div></div>'
    + '<div class="hero-slider" id="hero-slider">'
    + '<div class="hero-slides" id="hero-slides">'+slide1+slide2+slide3+'</div>'
    + '<div class="hero-dots">'
    + '<div class="hero-dot active" data-idx="0"></div>'
    + '<div class="hero-dot" data-idx="1"></div>'
    + '<div class="hero-dot" data-idx="2"></div>'
    + '</div></div>'
    + '<div class="home2-grid">'
    + '<button class="home2-tile home2-tile-training" data-route="/training"><div class="home2-tile-content"><i class="ti ti-flame home2-tile-icon"></i><div class="home2-tile-name">\u0422\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0438</div><div class="home2-tile-desc">'+(todayWorkout||'\u0417\u0430\u043f\u043e\u043b\u043d\u0438 \u043f\u043b\u0430\u043d')+'</div></div></button>'
    + '<button class="home2-tile home2-tile-habits" data-route="/habits"><div class="home2-tile-content"><i class="ti ti-checklist home2-tile-icon"></i><div class="home2-tile-name">\u041f\u0440\u0438\u0432\u044b\u0447\u043a\u0438</div><div class="home2-tile-desc">'+todayDone+'/'+habList.length+' \u0441\u0435\u0433\u043e\u0434\u043d\u044f</div></div></button>'
    + '<button class="home2-tile home2-tile-finance" data-route="/finance"><div class="home2-tile-content"><i class="ti ti-chart-bar home2-tile-icon"></i><div class="home2-tile-name">\u0424\u0438\u043d\u0430\u043d\u0441\u044b</div><div class="home2-tile-desc">'+(monthIncome>0?fmt(monthIncome)+' / '+MONTHS[now.getMonth()]:'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0434\u043e\u0445\u043e\u0434')+'</div></div></button>'
    + '<button class="home2-tile home2-tile-goals" data-route="/goals"><div class="home2-tile-content"><i class="ti ti-target-arrow home2-tile-icon"></i><div class="home2-tile-name">\u0426\u0435\u043b\u0438</div><div class="home2-tile-desc">'+goalsPct+'% \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e</div></div></button>'
    + '</div>'
    + '<div class="home2-footer"><div id="sync-status" style="font-size:11px;color:#9D9A92;text-align:center;padding:8px;"></div></div>'
    + '</div>';

  mount.querySelectorAll('[data-route]').forEach(function(el){
    el.addEventListener('click', function(){ Router.go(el.dataset.route); });
  });
  document.getElementById('logout-btn').addEventListener('click', function(){
    Auth.logout(); Router.go('/login');
  });

  /* Slider settings */
  var sliderCfg = Store.get().home?.sliderCfg || {interval: 4500};
  document.getElementById('slider-settings-btn').addEventListener('click', function(){
    var ov = document.createElement('div');
    ov.className = 'tr-modal-overlay';
    ov.innerHTML = '<div class="tr-modal">'
      + '<p class="tr-modal-title">Настройки слайдера</p>'
      + '<div class="tr-modal-row"><label style="flex:1">Интервал, сек<input type="number" id="sl-interval" value="'+(sliderCfg.interval/1000)+'" min="1" max="30" step="0.5" inputmode="decimal"></label></div>'
      + '<p style="font-size:12px;color:#9CA3AF;margin:8px 0 4px;">Слайды (отметь нужные):</p>'
      + '<div class="tr-modal-row" style="flex-direction:column;gap:6px;">'
      +   '<label style="display:flex;align-items:center;gap:8px;font-size:14px;"><input type="checkbox" id="sl-s0" '+(sliderCfg.s0!==false?'checked':'')+' style="width:auto;"> Фокус дня</label>'
      +   '<label style="display:flex;align-items:center;gap:8px;font-size:14px;"><input type="checkbox" id="sl-s1" '+(sliderCfg.s1!==false?'checked':'')+' style="width:auto;"> Финансовый пульс</label>'
      +   '<label style="display:flex;align-items:center;gap:8px;font-size:14px;"><input type="checkbox" id="sl-s2" '+(sliderCfg.s2!==false?'checked':'')+' style="width:auto;"> Прогресс целей</label>'
      + '</div>'
      + '<div class="tr-modal-actions">'
      +   '<button class="tr-modal-btn-secondary" id="sl-cancel">Отмена</button>'
      +   '<button class="tr-modal-btn-primary" id="sl-save">Сохранить</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click',function(e){if(e.target===ov)ov.remove();});
    ov.querySelector('#sl-cancel').addEventListener('click',function(){ov.remove();});
    ov.querySelector('#sl-save').addEventListener('click',function(){
      sliderCfg.interval = Math.max(1000, parseFloat(ov.querySelector('#sl-interval').value||4.5)*1000);
      sliderCfg.s0 = ov.querySelector('#sl-s0').checked;
      sliderCfg.s1 = ov.querySelector('#sl-s1').checked;
      sliderCfg.s2 = ov.querySelector('#sl-s2').checked;
      Store.set('home.sliderCfg', sliderCfg);
      ov.remove();
      /* Restart slider with new interval */
      if(autoTimer) clearInterval(autoTimer);
      autoTimer = setInterval(function(){ goTo(cur+1); }, sliderCfg.interval);
    });
  });

  var slidesEl = document.getElementById('hero-slides');
  var dotsEls = mount.querySelectorAll('.hero-dot');
  if (slidesEl) {
    var cur=0, autoTimer=null;
    function goTo(idx){ cur=((idx%3)+3)%3; slidesEl.style.transform='translateX(-'+(cur*33.333)+'%)'; dotsEls.forEach(function(d,i){d.classList.toggle('active',i===cur);}); }
    function startAuto(){ if(autoTimer)clearInterval(autoTimer); autoTimer=setInterval(function(){goTo(cur+1);},4500); }
    dotsEls.forEach(function(d){ d.addEventListener('click',function(e){e.stopPropagation();goTo(parseInt(d.dataset.idx));startAuto();}); });
    var sx=0;
    slidesEl.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;},{passive:true});
    slidesEl.addEventListener('touchend',function(e){var dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>40){goTo(dx<0?cur+1:cur-1);startAuto();}});
    startAuto();
  }
};
