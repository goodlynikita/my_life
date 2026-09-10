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
  var plannedExpenses = (window.Features && window.Features.isOn('home_planned_expenses'))
    ? ((Store.get().home && Store.get().home.plannedExpenses) || 97000)
    : 97000;
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

  /* ── Слайды через Slides.js ── */
  var slidesCfg = window.Slides ? window.Slides.getSlides() : [];
  var enabledSlides = slidesCfg.filter(function(s){ return s.enabled !== false; });
  if (!enabledSlides.length) enabledSlides = slidesCfg;
  var store4slides = Store.get();

  var slidesHtml = enabledSlides.map(function(s) {
    return window.Slides ? window.Slides.renderSlide(s, store4slides) : '';
  }).join('');

  mount.innerHTML = '<div class="home2-screen">'
    + '<div class="home2-header"><div>'
    + '<p class="home2-date">'+DOWS[now.getDay()]+', '+now.getDate()+' '+MONTHS[now.getMonth()]+'</p>'
    + '<h1 class="home2-title">NIK \u00b7 \u0421\u0438\u0441\u0442\u0435\u043c\u0430</h1>'
    + '</div><div style="display:flex;gap:8px;">'
    + '<button class="home2-logout" id="slides-edit-btn" title="Редактор слайдов" style="font-size:16px;"><i class="ti ti-layout"></i></button>'
    + '<button class="home2-logout" id="slider-settings-btn" title="Настройки" style="font-size:16px;"><i class="ti ti-settings"></i></button>'
    + '<button class="home2-logout" id="logout-btn"><i class="ti ti-logout"></i></button>'
    + '</div></div>'
    + '<div class="hero-slider" id="hero-slider">'
    + '<div class="hero-slides" id="hero-slides">'+slidesHtml+'</div>'
    + '<div class="hero-dots">'
    + enabledSlides.map(function(_,i){ return '<div class="hero-dot'+(i===0?' active':'')+'" data-idx="'+i+'"></div>'; }).join('')
    + '</div></div>'
    + '<div class="home2-grid">'
    + '<button class="home2-tile home2-tile-training" data-route="/training"><div class="home2-tile-content"><i class="ti ti-flame home2-tile-icon"></i><div class="home2-tile-name">\u0422\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0438</div><div class="home2-tile-desc">'+(todayWorkout||'\u0417\u0430\u043f\u043e\u043b\u043d\u0438 \u043f\u043b\u0430\u043d')+'</div></div></button>'
    + '<button class="home2-tile home2-tile-habits" data-route="/habits"><div class="home2-tile-content"><i class="ti ti-checklist home2-tile-icon"></i><div class="home2-tile-name">\u041f\u0440\u0438\u0432\u044b\u0447\u043a\u0438</div><div class="home2-tile-desc">'+todayDone+'/'+habList.length+' \u0441\u0435\u0433\u043e\u0434\u043d\u044f</div></div></button>'
    + '<button class="home2-tile home2-tile-finance" data-route="/finance"><div class="home2-tile-content"><i class="ti ti-chart-bar home2-tile-icon"></i><div class="home2-tile-name">\u0424\u0438\u043d\u0430\u043d\u0441\u044b</div><div class="home2-tile-desc">'+(monthIncome>0?fmt(monthIncome)+' / '+MONTHS[now.getMonth()]:'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0434\u043e\u0445\u043e\u0434')+'</div></div></button>'
    + '<button class="home2-tile home2-tile-goals" data-route="/goals"><div class="home2-tile-content"><i class="ti ti-target-arrow home2-tile-icon"></i><div class="home2-tile-name">\u0426\u0435\u043b\u0438</div><div class="home2-tile-desc">'+goalsPct+'% \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e</div></div></button>'
    + '</div>'
    + '<div class="home2-footer"><div style="display:flex;align-items:center;justify-content:space-between;padding:6px 16px;">'
    + '<div id="sync-status" style="font-size:11px;color:#9D9A92;"></div>'
    + '<button id="features-open-btn" style="font-size:11px;color:#A78BFA;background:none;border:none;cursor:pointer;font-family:Montserrat,sans-serif;font-weight:600;padding:4px 0;">⚙ Доработки (' + window.Features.all().filter(function(f){return f.enabled;}).length + '/' + window.Features.REGISTRY.length + ')</button>'
    + '</div></div>'
    + '</div>';

  mount.querySelectorAll('[data-route]').forEach(function(el){
    el.addEventListener('click', function(){ Router.go(el.dataset.route); });
  });

  /* ── Слайды: редактор ── */
  var slidesEditBtn = document.getElementById('slides-edit-btn');
  if (slidesEditBtn) slidesEditBtn.addEventListener('click', function(){ window.Slides && window.Slides.openEditor(); });

  /* ── Настройка плановых расходов ── */
  var cushionBox = document.getElementById('home-cushion-box');
  if (cushionBox) {
    cushionBox.addEventListener('click', function(e) {
      e.stopPropagation();
      var ov = document.createElement('div');
      ov.className = 'tr-modal-overlay';
      ov.innerHTML = '<div class="tr-modal">'
        + '<p class="tr-modal-title">Плановые расходы в месяц</p>'
        + '<div class="tr-modal-row"><label style="flex:1">Сумма, ₽<input type="number" id="plan-exp-input" value="'+plannedExpenses+'" inputmode="numeric" style="font-size:18px;font-weight:700;"></label></div>'
        + '<p style="font-size:11px;color:#9CA3AF;margin:4px 0 12px;">Подушка = Доходы − эта сумма</p>'
        + '<div class="tr-modal-actions"><button class="tr-modal-btn-secondary" id="plan-exp-cancel">Отмена</button><button class="tr-modal-btn-primary" id="plan-exp-save">Сохранить</button></div>'
        + '</div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function(e){if(e.target===ov)ov.remove();});
      ov.querySelector('#plan-exp-cancel').addEventListener('click', function(){ov.remove();});
      ov.querySelector('#plan-exp-save').addEventListener('click', function(){
        var v = parseFloat(ov.querySelector('#plan-exp-input').value)||97000;
        Store.set('home.plannedExpenses', v);
        ov.remove(); Router.go('/home');
      });
      setTimeout(function(){ ov.querySelector('#plan-exp-input').focus(); }, 100);
    });
  }

  /* ── Features panel ── */
  var sliderSettingsEl = document.getElementById('slider-settings-btn');
  if (sliderSettingsEl && window.Features && !window.Features.isOn('home_slider_settings')) {
    sliderSettingsEl.style.display = 'none';
  }
  var featBtn = document.getElementById('features-open-btn');
  if (featBtn) featBtn.addEventListener('click', function() { window.Features.openPanel(); });
  document.getElementById('logout-btn').addEventListener('click', function(){
    Auth.logout(); Router.go('/login');
  });

  /* ── Слайдер ── */
  (function() {
    var cfg = Store.get().home?.sliderCfg || {};
    var interval = cfg.interval || 4500;
    var n = enabledSlides.length;

    var slidesEl = document.getElementById('hero-slides');
    var dotsContainer = mount.querySelector('.hero-dots');
    if (!slidesEl || !dotsContainer) return;

    slidesEl.style.width = (n * 100) + '%';
    slidesEl.querySelectorAll('.hero-slide').forEach(function(s){ s.style.width = (100/n)+'%'; });

    slidesEl.querySelectorAll('[data-route]').forEach(function(el){
      el.addEventListener('click', function(){ Router.go(el.dataset.route); });
    });

    var dotsEls = dotsContainer.querySelectorAll('.hero-dot');
    var cur = 0;
    var autoTimer = null;

    function goTo(idx) {
      cur = ((idx % n) + n) % n;
      slidesEl.style.transform = 'translateX(-'+(cur * (100/n))+'%)';
      dotsEls.forEach(function(d,i){ d.classList.toggle('active', i===cur); });
    }
    function startAuto() {
      if (autoTimer) clearInterval(autoTimer);
      if (n > 1 && cfg.autoplay !== false) autoTimer = setInterval(function(){ goTo(cur+1); }, interval);
    }
    dotsEls.forEach(function(d){
      d.addEventListener('click', function(e){ e.stopPropagation(); goTo(parseInt(d.dataset.idx)); startAuto(); });
    });
    var sx = 0;
    slidesEl.addEventListener('touchstart', function(e){ sx = e.touches[0].clientX; }, {passive:true});
    slidesEl.addEventListener('touchend', function(e){
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) { goTo(dx < 0 ? cur+1 : cur-1); startAuto(); }
    });
    startAuto();

    /* Настройки слайдера */
    if (sliderSettingsEl) sliderSettingsEl.addEventListener('click', function(){
      var cfg2 = Store.get().home?.sliderCfg || {};
      var intVal = Math.round((cfg2.interval||4500)/1000);
      var ov = document.createElement('div');
      ov.className = 'tr-modal-overlay';
      ov.style.cssText = 'align-items:flex-end;padding:0;';
      var slideNames = enabledSlides.map(function(s){ return s.label||'Слайд'; });
      var autoOn = cfg2.autoplay !== false;
      ov.innerHTML = '<div style="background:#1A1C22;border-radius:20px 20px 0 0;width:100%;max-width:520px;margin:0 auto;max-height:90vh;overflow-y:auto;padding:0 0 36px;">'
        + '<div style="position:sticky;top:0;background:#1A1C22;padding:18px 20px 14px;border-bottom:1px solid #2A2D35;border-radius:20px 20px 0 0;display:flex;align-items:center;justify-content:space-between;">'
        +   '<span style="font-size:17px;font-weight:800;color:#E8E5DC;font-family:Montserrat,sans-serif;">Слайдер</span>'
        +   '<button id="sl-close-x" style="background:#2A2D35;border:none;border-radius:50%;width:30px;height:30px;color:#9D9A92;cursor:pointer;font-size:18px;line-height:1;">×</button>'
        + '</div>'
        + '<div style="padding:20px 20px 0;">'
        + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#555;margin-bottom:8px;">Интервал переключения</div>'
        + '<div style="display:flex;align-items:center;gap:16px;background:#1C1E24;border-radius:14px;padding:14px 18px;margin-bottom:8px;">'
        +   '<button id="sl-int-minus" style="width:36px;height:36px;border-radius:50%;border:1px solid #2A2D35;background:#2A2D35;color:#E8E5DC;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;">−</button>'
        +   '<span id="sl-int-val" style="flex:1;text-align:center;font-size:28px;font-weight:900;color:#E8E5DC;font-family:Montserrat,sans-serif;">'+intVal+'<span style="font-size:14px;color:#9D9A92;font-weight:500;"> сек</span></span>'
        +   '<button id="sl-int-plus" style="width:36px;height:36px;border-radius:50%;border:none;background:#4A7CFF;color:#fff;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(74,124,255,.4);">+</button>'
        + '</div>'
        + '<div style="display:flex;align-items:center;justify-content:space-between;background:#1C1E24;border-radius:14px;padding:14px 18px;margin-bottom:20px;">'
        +   '<div><div style="font-size:14px;font-weight:600;color:#E8E5DC;font-family:Montserrat,sans-serif;">Автолистание</div><div style="font-size:11px;color:#555;margin-top:2px;">Выкл — листать вручную</div></div>'
        +   '<button id="sl-auto-toggle" data-on="'+(autoOn?'1':'0')+'" style="flex-shrink:0;width:48px;height:28px;border-radius:14px;border:none;cursor:pointer;background:'+(autoOn?'#4A7CFF':'#2A2D35')+';position:relative;transition:background .25s;">'
        +     '<div style="position:absolute;top:4px;left:'+(autoOn?'23px':'4px')+';width:20px;height:20px;border-radius:50%;background:#fff;transition:left .25s;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>'
        +   '</button>'
        + '</div>'
        + '<div style="font-size:11px;color:#9D9A92;text-align:center;padding:8px 0;">Для управления слайдами нажми <i class="ti ti-layout"></i> в хедере</div>'
        + '<button id="sl-save" style="width:100%;margin-top:12px;padding:16px;background:#4A7CFF;border:none;border-radius:14px;color:#fff;font-size:15px;font-weight:800;cursor:pointer;font-family:Montserrat,sans-serif;box-shadow:0 4px 16px rgba(74,124,255,.4);">Сохранить</button>'
        + '</div></div>';
      document.body.appendChild(ov);
      ov.addEventListener('click', function(e){ if(e.target===ov)ov.remove(); });
      ov.querySelector('#sl-close-x').addEventListener('click', function(){ ov.remove(); });
      ov.querySelector('#sl-int-minus').addEventListener('click', function(){
        intVal=Math.max(1,intVal-1);
        var el=ov.querySelector('#sl-int-val');
        el.innerHTML=intVal+'<span style="font-size:14px;color:#9D9A92;font-weight:500;"> сек</span>';
      });
      ov.querySelector('#sl-int-plus').addEventListener('click', function(){
        intVal=Math.min(60,intVal+1);
        var el=ov.querySelector('#sl-int-val');
        el.innerHTML=intVal+'<span style="font-size:14px;color:#9D9A92;font-weight:500;"> сек</span>';
      });
      ov.querySelector('#sl-auto-toggle').addEventListener('click', function(){
        var on=this.dataset.on==='1'; on=!on;
        this.dataset.on=on?'1':'0'; this.style.background=on?'#4A7CFF':'#2A2D35';
        this.querySelector('div').style.left=on?'23px':'4px';
      });
      ov.querySelector('#sl-save').addEventListener('click', function(){
        Store.set('home.sliderCfg',{
          interval:intVal*1000,
          autoplay:ov.querySelector('#sl-auto-toggle').dataset.on==='1',
        });
        ov.remove(); Router.go('/home');
      });
    });
  })();
};
