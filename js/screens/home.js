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

  /* Плановые расходы — берём из категорий финансов автоматически */
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
          /* Из sessions берём группы мышц */
          sessions.filter(function(s){return s&&s.type!=='Отдых'&&s.type!=='10k';}).forEach(function(s){
            if(s.groups&&s.groups.length) todayGroups = todayGroups.concat(s.groups);
            else if(s.type) todayGroups.push(s.type);
          });
          /* Если exercises есть — тренировка не пустая */
          if(!todayGroups.length && exercises.length>0) {
            todayWorkout = 'Тренировка';
          }
          // Отдых не показываем — оставляем пустым → будет «Не задано»
        }
      });
    });
    if(todayGroups.length) todayWorkout = todayGroups.join(' + ');
  }

  var tagHtml = todayGroups.map(function(g){ return '<span class="hero-tag">'+g+'</span>'; }).join('');

  /* ── Оригинальные слайды ── */
  var slide1 = '<div class="hero-slide slide-focus" data-route="/training">'
    + '<div class="hero-slide-label">ФОКУС ДНЯ</div>'
    + '<div class="hero-slide-main">'
    + (todayGroups.length ? '<div class="hero-tag-row">'+tagHtml+'</div>' : '')
    + '<div class="hero-big-text'+(todayWorkout?'':' hero-dim')+'">'+(todayWorkout||'Не задано')+'</div>'
    + '</div>'
    + '<div class="hero-slide-sub"><div class="hero-stat-row">'
    + '<div class="hero-stat-box"><div class="hero-stat-num">'+todayDone+'<span class="hero-stat-of">/'+habList.length+'</span></div><div class="hero-stat-lbl">привычек сегодня</div></div>'
    + '<div class="hero-stat-sep"></div>'
    + '<div class="hero-stat-box"><div class="hero-stat-num">'+now.getDate()+'</div><div class="hero-stat-lbl">'+MONTHS[now.getMonth()].toLowerCase()+'</div></div>'
    + '</div></div>'
    + '<div class="hero-slide-glow slide-glow-blue"></div>'
    + '</div>';

  var curMonth = now.getMonth();
  var curSeason = curMonth<=7 ? 'summer' : curMonth<=10 ? 'autumn' : 'december';
  var seasonGoals = goals.filter(function(g){return g.season===curSeason;});
  var seasonTotal = seasonGoals.reduce(function(s,g){return s+(g.amount||0);},0);
  var seasonDone  = seasonGoals.filter(function(g){return g.done;}).reduce(function(s,g){return s+(g.amount||0);},0);
  var seasonLeft  = seasonTotal - seasonDone;
  var seasonNames = {summer:'Лето',autumn:'Осень',december:'Декабрь'};

  var slide2 = '<div class="hero-slide slide-finance" data-route="/finance">'
    + '<div class="hero-slide-label">ФИНАНСОВЫЙ ПУЛЬС</div>'
    + '<div class="hero-slide-main">'
    + '<div class="hero-big-text">'+(monthIncome>0?fmt(monthIncome):'Нет данных')+'</div>'
    + '<div class="hero-sub-text">'+MONTHS[now.getMonth()]+' '+yr+'</div>'
    + '</div>'
    + '<div class="hero-slide-sub"><div class="hero-stat-row">'
    + '<div class="hero-stat-box" id="home-cushion-box" style="cursor:pointer;"><div class="hero-stat-num" style="color:'+(cushion>=0?'#4ADE80':'#F87171')+'">'+fmt(Math.abs(cushion))+'</div><div class="hero-stat-lbl">'+(cushion>=0?'подушка':'не хватает')+'<span style="font-size:8px;color:rgba(255,255,255,0.3);"> (план '+fmt(plannedExpenses)+')</span></div></div>'
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

  /* sliderCfg нужен всегда — объявляем до условия */
  var sliderCfg = (store.home && store.home.sliderCfg) || {};

  /* Слайды через Slides.js если есть кастомные, иначе дефолт */
  var _customSlides = window.Slides ? window.Slides.getSlides() : null;
  var visSlides;
  if (_customSlides && _customSlides.length && window.Slides.DEFAULT_SLIDES &&
      JSON.stringify(_customSlides) !== JSON.stringify(window.Slides.DEFAULT_SLIDES)) {
    visSlides = _customSlides.filter(function(s){ return s.enabled !== false; })
      .map(function(s){ return window.Slides.renderSlide(s, store); });
    if (!visSlides.length) visSlides = [slide1, slide2, slide3];
  } else {
    var allSlides  = [slide1, slide2, slide3];
    var shown      = [sliderCfg.s0!==false, sliderCfg.s1!==false, sliderCfg.s2!==false];
    visSlides = allSlides.filter(function(_,i){ return shown[i]; });
    if (!visSlides.length) visSlides = allSlides;
  }
  var n = visSlides.length;

  mount.innerHTML = '<div class="home2-screen">'
    + '<div class="home2-header" style="justify-content:flex-end;">'
    + '<button id="home-menu-btn" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:8px 16px;color:rgba(255,255,255,0.7);cursor:pointer;font-size:14px;letter-spacing:4px;line-height:1;display:flex;align-items:center;">···</button>'
    + '</div>'
    + '<div class="hero-slider" id="hero-slider">'
    + '<div class="hero-slides" id="hero-slides" style="width:'+(n*100)+'%">'
    + visSlides.map(function(s){ return typeof s === 'string' ? s.replace('flex:0 0 33.333%','') : ''; }).join('')
    + '</div>'
    + '<div class="hero-dots">'
    + visSlides.map(function(_,i){ return '<div class="hero-dot'+(i===0?' active':'')+'" data-idx="'+i+'"></div>'; }).join('')
    + '</div></div>'
    + '<div class="home2-grid">'
    + '<button class="home2-tile home2-tile-training" data-route="/training"><div class="home2-tile-content"><i class="ti ti-flame home2-tile-icon"></i><div class="home2-tile-name">Тренировки</div><div class="home2-tile-desc">'+(todayWorkout||'Не задано')+'</div></div></button>'
    + '<button class="home2-tile home2-tile-habits" data-route="/habits"><div class="home2-tile-content"><i class="ti ti-checklist home2-tile-icon"></i><div class="home2-tile-name">\u041f\u0440\u0438\u0432\u044b\u0447\u043a\u0438</div><div class="home2-tile-desc">'+todayDone+'/'+habList.length+' \u0441\u0435\u0433\u043e\u0434\u043d\u044f</div></div></button>'
    + '<button class="home2-tile home2-tile-finance" data-route="/finance"><div class="home2-tile-content"><i class="ti ti-chart-bar home2-tile-icon"></i><div class="home2-tile-name">\u0424\u0438\u043d\u0430\u043d\u0441\u044b</div><div class="home2-tile-desc">'+(monthIncome>0?fmt(monthIncome)+' / '+MONTHS[now.getMonth()]:'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0434\u043e\u0445\u043e\u0434')+'</div></div></button>'
    + '<button class="home2-tile home2-tile-goals" data-route="/goals"><div class="home2-tile-content"><i class="ti ti-target-arrow home2-tile-icon"></i><div class="home2-tile-name">\u0426\u0435\u043b\u0438</div><div class="home2-tile-desc">'+goalsPct+'% \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e</div></div></button>'
    + '</div>'
    + '<div class="home2-footer"><div style="display:flex;align-items:center;justify-content:space-between;padding:6px 16px;">'
    + '<div id="sync-status" style="font-size:11px;color:#9D9A92;"></div>'
    + ''
    + '</div></div>'
    + '</div>';

  /* Slide widths */
  mount.querySelectorAll('.hero-slide').forEach(function(s){ s.style.width=(100/n)+'%'; s.style.flex='0 0 '+(100/n)+'%'; s.style.minWidth=(100/n)+'%'; });

  mount.querySelectorAll('[data-route]').forEach(function(el){
    el.addEventListener('click', function(){ Router.go(el.dataset.route); });
  });

  // Единое меню
  var menuBtn = document.getElementById('home-menu-btn');
  if (menuBtn) menuBtn.addEventListener('click', function() {
    var ov = document.createElement('div');
    ov.className = 'tr-modal-overlay';
    ov.innerHTML = '<div style="background:#1C1E26;border-radius:16px;width:100%;max-width:340px;overflow:hidden;">'
      + '<div style="padding:16px 18px 8px;font-size:11px;font-weight:700;color:#555;letter-spacing:.08em;text-transform:uppercase;">Меню</div>'
      + '<button id="hm-slides" style="width:100%;padding:14px 18px;background:none;border:none;border-top:1px solid rgba(255,255,255,0.06);color:#E8E5DC;font-size:14px;font-family:Montserrat,sans-serif;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;"><i class="ti ti-layout" style="font-size:18px;color:#9D9A92;"></i>Редактор слайдов</button>'
      + '<button id="hm-tiles" style="width:100%;padding:14px 18px;background:none;border:none;border-top:1px solid rgba(255,255,255,0.06);color:#E8E5DC;font-size:14px;font-family:Montserrat,sans-serif;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;"><i class="ti ti-layout-grid" style="font-size:18px;color:#9D9A92;"></i>Настройка плиток</button>'
      + '<button id="hm-settings" style="width:100%;padding:14px 18px;background:none;border:none;border-top:1px solid rgba(255,255,255,0.06);color:#E8E5DC;font-size:14px;font-family:Montserrat,sans-serif;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;"><i class="ti ti-settings" style="font-size:18px;color:#9D9A92;"></i>Настройки</button>'
      + '<button id="hm-logout" style="width:100%;padding:14px 18px;background:none;border:none;border-top:1px solid rgba(255,255,255,0.06);color:#F87171;font-size:14px;font-family:Montserrat,sans-serif;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;"><i class="ti ti-logout" style="font-size:18px;"></i>Выйти</button>'
      + '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
    ov.querySelector('#hm-slides').addEventListener('click', function(){ ov.remove(); window.Slides && window.Slides.openEditor(); });
    ov.querySelector('#hm-tiles').addEventListener('click', function(){ ov.remove(); openTileSettings(); });
    ov.querySelector('#hm-settings').addEventListener('click', function(){ ov.remove(); openSliderSettings(); });
    ov.querySelector('#hm-logout').addEventListener('click', function(){ ov.remove(); Auth.logout().then(function(){ Router.go('/login'); }); });
  });

  /* ── Подушка считается автоматически из финансов ── */
  var cushionBox = document.getElementById('home-cushion-box');
  if (cushionBox) {
    cushionBox.addEventListener('click', function(e){
      e.stopPropagation();
      Router.go('/finance');
    });
  }




  /* ── Настройки плиток ── */
  function openTileSettings() {
    var TILES = [
      { key: 'training', label: 'Тренировки', icon: 'ti-flame',        cls: 'home2-tile-training' },
      { key: 'habits',   label: 'Привычки',   icon: 'ti-checklist',    cls: 'home2-tile-habits'   },
      { key: 'finance',  label: 'Финансы',    icon: 'ti-chart-bar',    cls: 'home2-tile-finance'  },
      { key: 'goals',    label: 'Цели',       icon: 'ti-target-arrow', cls: 'home2-tile-goals'    },
    ];

    var TEMPLATES = [
      {
        id: '2x2', label: '2×2', layout: 'layout-2x2', order: [0,1,2,3],
        svg: '<svg width="52" height="40" viewBox="0 0 52 40"><rect x="1" y="1" width="23" height="17" rx="3" fill="#4ADE8033" stroke="#4ADE80" stroke-width="1.5"/><rect x="28" y="1" width="23" height="17" rx="3" fill="#4ADE8033" stroke="#4ADE80" stroke-width="1.5"/><rect x="1" y="22" width="23" height="17" rx="3" fill="#4ADE8033" stroke="#4ADE80" stroke-width="1.5"/><rect x="28" y="22" width="23" height="17" rx="3" fill="#4ADE8033" stroke="#4ADE80" stroke-width="1.5"/></svg>'
      },
      {
        id: 'row', label: 'В строку', layout: 'layout-row', order: [0,1,2,3],
        svg: '<svg width="52" height="40" viewBox="0 0 52 40"><rect x="1" y="1" width="50" height="7" rx="3" fill="#60A5FA33" stroke="#60A5FA" stroke-width="1.5"/><rect x="1" y="12" width="50" height="7" rx="3" fill="#60A5FA33" stroke="#60A5FA" stroke-width="1.5"/><rect x="1" y="23" width="50" height="7" rx="3" fill="#60A5FA33" stroke="#60A5FA" stroke-width="1.5"/><rect x="1" y="34" width="50" height="7" rx="3" fill="#60A5FA33" stroke="#60A5FA" stroke-width="1.5"/></svg>'
      },
      {
        id: 'bigfirst', label: 'Акцент 1', layout: 'layout-bigfirst', order: [0,1,2,3],
        svg: '<svg width="52" height="40" viewBox="0 0 52 40"><rect x="1" y="1" width="50" height="11" rx="3" fill="#F59E0B33" stroke="#F59E0B" stroke-width="1.5"/><rect x="1" y="16" width="23" height="10" rx="3" fill="#F59E0B33" stroke="#F59E0B" stroke-width="1.5"/><rect x="28" y="16" width="23" height="10" rx="3" fill="#F59E0B33" stroke="#F59E0B" stroke-width="1.5"/><rect x="1" y="30" width="50" height="9" rx="3" fill="#F59E0B33" stroke="#F59E0B" stroke-width="1.5"/></svg>'
      },
      {
        id: 'biglast', label: 'Акцент 2', layout: 'layout-biglast', order: [0,1,2,3],
        svg: '<svg width="52" height="40" viewBox="0 0 52 40"><rect x="1" y="1" width="23" height="11" rx="3" fill="#C084FC33" stroke="#C084FC" stroke-width="1.5"/><rect x="28" y="1" width="23" height="11" rx="3" fill="#C084FC33" stroke="#C084FC" stroke-width="1.5"/><rect x="1" y="16" width="50" height="10" rx="3" fill="#C084FC33" stroke="#C084FC" stroke-width="1.5"/><rect x="1" y="30" width="50" height="9" rx="3" fill="#C084FC33" stroke="#C084FC" stroke-width="1.5"/></svg>'
      },
    ];

    var savedLayout = (Store.get().home && Store.get().home.tileLayout) || '2x2';
    var savedOrder  = (Store.get().home && Store.get().home.tileOrder)  || [0,1,2,3];
    var savedHidden = (Store.get().home && Store.get().home.tileHidden) || [];
    var layout  = savedLayout;
    var order   = savedOrder.slice();
    var hidden  = savedHidden.slice();

    var ov = document.createElement('div');
    ov.className = 'tr-modal-overlay';
    ov.style.cssText = 'align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';

    function buildHtml() {
      var tileItems = order.map(function(ti, pos) {
        var t = TILES[ti];
        return '<div class="tile-sort-item" data-ti="'+ti+'" style="'
          + 'display:flex;align-items:center;gap:12px;padding:12px 16px;'
          + 'background:#1C1E24;border-radius:10px;border:1px solid #2A2D35;'
          + 'cursor:grab;user-select:none;touch-action:none;">'
          + '<span style="color:#555;font-size:18px;cursor:grab;">⠿</span>'
          + '<span style="font-size:20px;"><i class="ti '+t.icon+'"></i></span>'
          + '<span style="flex:1;font-size:14px;font-weight:600;color:#E8E5DC;">'+t.label+'</span>'
          + '<span style="color:#555;font-size:12px;">#'+(pos+1)+'</span>'
          + '</div>';
      }).join('');

      var tmplBtns = TEMPLATES.map(function(tmpl, i) {
        var isActive = layout === tmpl.id;
        return '<button class="tso-tmpl" data-tmpl="'+i+'" style="'
          + 'flex:1;min-width:0;padding:10px 4px 8px;background:#1C1E24;'
          + 'border:2px solid '+(isActive?'#4ADE80':'#2A2D35')+';'
          + 'border-radius:10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;">'
          + tmpl.svg
          + '<div style="font-size:10px;color:'+(isActive?'#4ADE80':'#9D9A92')+';font-weight:600;white-space:nowrap;">'+tmpl.label+'</div>'
          + '</button>';
      }).join('');

      return '<div style="background:#13151A;border-radius:16px;width:100%;max-width:480px;margin:0 auto;max-height:85vh;overflow-y:auto;-webkit-overflow-scrolling:touch;">'
        + '<div style="position:sticky;top:0;background:#13151A;padding:18px 20px 14px;border-bottom:1px solid #1E2028;border-radius:16px 16px 0 0;display:flex;align-items:center;justify-content:space-between;">'
        + '<span style="font-size:17px;font-weight:800;color:#E8E5DC;">Настройка плиток</span>'
        + '<button id="tso-close" style="background:#1E2028;border:none;border-radius:50%;width:30px;height:30px;color:#9D9A92;cursor:pointer;font-size:18px;">×</button>'
        + '</div>'
        + '<div style="padding:16px 20px;">'
        + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#555;letter-spacing:.06em;margin-bottom:10px;">Сетка</div>'
        + '<div style="display:flex;gap:8px;margin-bottom:20px;">' + tmplBtns + '</div>'
        + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#555;letter-spacing:.06em;margin-bottom:6px;">Порядок</div>'
        + '<div style="font-size:12px;color:#555;margin-bottom:10px;">Перетащи за ⠿ чтобы изменить</div>'
        + '<div id="tile-sort-list" style="display:flex;flex-direction:column;gap:8px;">' + tileItems + '</div>'
        + '<div style="margin-top:16px;">'
        + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#555;letter-spacing:.06em;margin-bottom:8px;">Показывать</div>'
        + TILES.map(function(t, i) {
            var isHidden = hidden.includes(i);
            return '<label style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;">'
              + '<input type="checkbox" class="tile-vis-cb" data-ti="'+i+'" '+(isHidden?'':'checked')+' style="width:16px;height:16px;accent-color:#4ADE80;cursor:pointer;">'
              + '<i class="ti '+t.icon+'" style="font-size:16px;color:#9D9A92;"></i>'
              + '<span style="font-size:14px;color:#E8E5DC;">'+t.label+'</span>'
              + '</label>';
          }).join('')
        + '</div>'
        + '<button id="tso-save" style="width:100%;margin-top:20px;padding:14px;background:linear-gradient(135deg,#14532D,#16A34A);border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:Montserrat,sans-serif;">Сохранить</button>'
        + '</div></div>';
    }

    ov.innerHTML = buildHtml();
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e) { if (e.target===ov) ov.remove(); });
    ov.querySelector('#tso-close').addEventListener('click', function() { ov.remove(); });

    /* Шаблоны */
    var TMPL_ORDERS = [[0,1,2,3],[0,1,2,3],[0,1,2,3],[0,1,2,3]];
    ov.querySelectorAll('.tso-tmpl').forEach(function(btn) {
      btn.addEventListener('click', function() {
        layout = TEMPLATES[parseInt(btn.dataset.tmpl)].id;
        order = TMPL_ORDERS[parseInt(btn.dataset.tmpl)].slice();
        ov.innerHTML = buildHtml(); rebind();
      });
    });

    /* Drag-to-reorder */
    function rebind() {
      ov.querySelector('#tso-close').addEventListener('click', function() { ov.remove(); });
      ov.querySelectorAll('.tso-tmpl').forEach(function(btn) {
        btn.addEventListener('click', function() {
          order = TMPL_ORDERS[parseInt(btn.dataset.tmpl)].slice();
          ov.innerHTML = buildHtml(); rebind();
        });
      });
      ov.querySelector('#tso-save').addEventListener('click', saveTiles);
      ov.querySelectorAll('.tile-vis-cb').forEach(function(cb) {
        cb.addEventListener('change', function() {
          var ti = parseInt(cb.dataset.ti);
          if (cb.checked) { hidden = hidden.filter(function(h){return h!==ti;}); }
          else { if (!hidden.includes(ti)) hidden.push(ti); }
        });
      });

      var list = ov.querySelector('#tile-sort-list');
      var dragging = null, startY = 0, startIdx = 0;

      list.querySelectorAll('.tile-sort-item').forEach(function(item, idx) {
        item.addEventListener('pointerdown', function(e) {
          dragging = item; startY = e.clientY; startIdx = idx;
          item.style.opacity = '0.7'; item.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
          item.setPointerCapture(e.pointerId);
          e.preventDefault();
        });
        item.addEventListener('pointermove', function(e) {
          if (!dragging || dragging !== item) return;
          var dy = e.clientY - startY;
          item.style.transform = 'translateY('+dy+'px)';
          /* Определяем куда перетаскиваем */
          var items = Array.from(list.querySelectorAll('.tile-sort-item'));
          var targetIdx = startIdx;
          items.forEach(function(other, i) {
            if (other === item) return;
            var r = other.getBoundingClientRect();
            if (e.clientY > r.top && e.clientY < r.bottom) targetIdx = i;
          });
          if (targetIdx !== startIdx) {
            var newOrder = order.slice();
            var moved = newOrder.splice(startIdx, 1)[0];
            newOrder.splice(targetIdx, 0, moved);
            order = newOrder; startIdx = targetIdx;
            ov.innerHTML = buildHtml(); rebind();
          }
        });
        item.addEventListener('pointerup', function() {
          if (dragging) { dragging.style.opacity='1'; dragging.style.transform=''; dragging.style.boxShadow=''; dragging=null; }
        });
      });
    }

    function saveTiles() {
      Store.set('home.tileOrder', order);
      Store.set('home.tileLayout', layout);
      Store.set('home.tileHidden', hidden);
      ov.remove();
      var grid = mount.querySelector('.home2-grid');
      if (grid) {
        grid.classList.remove('layout-2x2','layout-row','layout-bigfirst','layout-biglast');
        var tmpl = TEMPLATES.find(function(t){return t.id===layout;});
        if (tmpl) grid.classList.add(tmpl.layout);
        var tileEls = Array.from(grid.querySelectorAll('.home2-tile'));
        // Apply order
        var sorted = order.map(function(ti) { return tileEls.find(function(el){return el.classList.contains(TILES[ti].cls);}); }).filter(Boolean);
        sorted.forEach(function(el) { grid.appendChild(el); });
        // Apply visibility
        tileEls.forEach(function(el, i) {
          TILES.forEach(function(t, ti) {
            if (el.classList.contains(t.cls)) {
              el.classList.toggle('tile-hidden', hidden.includes(ti));
            }
          });
        });
      }
    }

    ov.querySelector('#tso-save').addEventListener('click', saveTiles);
    rebind();
  }

  /* ── Применяем сохранённый порядок и сетку плиток при загрузке ── */
  function applyTileLayout() {
    var savedOrder  = Store.get().home && Store.get().home.tileOrder;
    var savedLayout = Store.get().home && Store.get().home.tileLayout;
    var savedHidden = (Store.get().home && Store.get().home.tileHidden) || [];
    var TILE_CLS = ['home2-tile-training','home2-tile-habits','home2-tile-finance','home2-tile-goals'];
    var LAYOUT_MAP = {'2x2':'layout-2x2','row':'layout-row','bigfirst':'layout-bigfirst','biglast':'layout-biglast'};
    var grid = mount.querySelector('.home2-grid');
    if (!grid) return;
    // Сброс layout классов
    Object.values(LAYOUT_MAP).forEach(function(cls) { grid.classList.remove(cls); });
    if (savedLayout && LAYOUT_MAP[savedLayout]) grid.classList.add(LAYOUT_MAP[savedLayout]);
    if (savedOrder && savedOrder.length) {
      var tileEls = Array.from(grid.querySelectorAll('.home2-tile'));
      var sorted = savedOrder.map(function(ti) { return tileEls.find(function(el){return el.classList.contains(TILE_CLS[ti]);}); }).filter(Boolean);
      sorted.forEach(function(el) { grid.appendChild(el); });
    }
    TILE_CLS.forEach(function(cls) {
      var el = grid.querySelector('.'+cls);
      if (el) el.classList.remove('tile-hidden');
    });
    savedHidden.forEach(function(ti) {
      var el = grid.querySelector('.'+TILE_CLS[ti]);
      if (el) el.classList.add('tile-hidden');
    });
  }
  applyTileLayout();

  // Перерисовываем когда Firebase подгрузит данные
  if (window._homeTileUnsubscribe) window._homeTileUnsubscribe();
  window._homeTileUnsubscribe = Store.subscribe && Store.subscribe(function() {
    applyTileLayout();
  });

  /* ── Настройки слайдера ── */
  function openSliderSettings() {
    var cfg2 = (Store.get().home && Store.get().home.sliderCfg) || {};
    var intVal = Math.round((cfg2.interval||4500)/1000);
    var autoOn = cfg2.autoplay !== false;
    var ov = document.createElement('div');
    ov.className = 'tr-modal-overlay';
    ov.style.cssText = 'align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
    ov.innerHTML = '<div style="background:#1A1C22;border-radius:16px;width:100%;max-width:480px;margin:0 auto;max-height:85vh;overflow-y:auto;padding:0 0 36px;">'
      + '<div style="padding:18px 20px 14px;border-bottom:1px solid #2A2D35;display:flex;align-items:center;justify-content:space-between;">'
      +   '<span style="font-size:17px;font-weight:800;color:#E8E5DC;font-family:Montserrat,sans-serif;">Слайдер</span>'
      +   '<button id="sl-close-x" style="background:#2A2D35;border:none;border-radius:50%;width:30px;height:30px;color:#9D9A92;cursor:pointer;font-size:18px;">×</button>'
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
      + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#555;margin-bottom:8px;">Показывать слайды</div>'
      + ['Фокус дня','Финансовый пульс','Прогресс целей'].map(function(name,i){
          var on = cfg2['s'+i]!==false;
          return '<div style="display:flex;align-items:center;justify-content:space-between;background:#1C1E24;border-radius:12px;padding:12px 16px;margin-bottom:8px;">'
            + '<span style="font-size:14px;font-weight:600;color:'+(on?'#E8E5DC':'#555')+';font-family:Montserrat,sans-serif;" class="sl-slide-label-'+i+'">'+name+'</span>'
            + '<button class="sl-slide-toggle" data-slide="'+i+'" data-on="'+(on?'1':'0')+'" style="flex-shrink:0;width:48px;height:28px;border-radius:14px;border:none;cursor:pointer;background:'+(on?'#4A7CFF':'#2A2D35')+';position:relative;transition:background .25s;">'
            +   '<div style="position:absolute;top:4px;left:'+(on?'23px':'4px')+';width:20px;height:20px;border-radius:50%;background:#fff;transition:left .25s;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>'
            + '</button>'
            + '</div>';
        }).join('')
      + '<button id="sl-save" style="width:100%;padding:16px;background:#4A7CFF;border:none;border-radius:14px;color:#fff;font-size:15px;font-weight:800;cursor:pointer;font-family:Montserrat,sans-serif;box-shadow:0 4px 16px rgba(74,124,255,.4);">Сохранить</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){if(e.target===ov)ov.remove();});
    ov.querySelector('#sl-close-x').addEventListener('click', function(){ov.remove();});
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
    ov.querySelectorAll('.sl-slide-toggle').forEach(function(btn){
      btn.addEventListener('click', function(){
        var on=btn.dataset.on==='1'; on=!on;
        btn.dataset.on=on?'1':'0'; btn.style.background=on?'#4A7CFF':'#2A2D35';
        btn.querySelector('div').style.left=on?'23px':'4px';
        var label=ov.querySelector('.sl-slide-label-'+btn.dataset.slide);
        if(label) label.style.color=on?'#E8E5DC':'#555';
      });
    });
    ov.querySelector('#sl-save').addEventListener('click', function(){
      Store.set('home.sliderCfg',{
        interval: intVal*1000,
        autoplay: ov.querySelector('#sl-auto-toggle').dataset.on==='1',
        s0: ov.querySelector('[data-slide="0"]').dataset.on==='1',
        s1: ov.querySelector('[data-slide="1"]').dataset.on==='1',
        s2: ov.querySelector('[data-slide="2"]').dataset.on==='1',
      });
      ov.remove(); Router.go('/home');
    });
  }

  /* ── Слайдер ── */
  var slidesEl = document.getElementById('hero-slides');
  var dotsEls  = mount.querySelectorAll('.hero-dot');
  if (slidesEl) {
    var cur=0, autoTimer=null;
    var interval = (sliderCfg.interval)||4500;
    function goTo(idx){ cur=((idx%n)+n)%n; slidesEl.style.transform='translateX(-'+(cur*(100/n))+'%)'; dotsEls.forEach(function(d,i){d.classList.toggle('active',i===cur);}); }
    function startAuto(){ if(autoTimer)clearInterval(autoTimer); if(n>1&&sliderCfg.autoplay!==false) autoTimer=setInterval(function(){goTo(cur+1);},interval); }
    dotsEls.forEach(function(d){ d.addEventListener('click',function(e){e.stopPropagation();goTo(parseInt(d.dataset.idx));startAuto();}); });
    var sx=0;
    slidesEl.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;},{passive:true});
    slidesEl.addEventListener('touchend',function(e){var dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>40){goTo(dx<0?cur+1:cur-1);startAuto();}});
    startAuto();
  }

  /* ── Тихий блик дрейфует по плиткам ── */
  (function() {
    var grid = mount.querySelector('.home2-grid');
    if (!grid) return;
    var tiles = Array.from(grid.querySelectorAll('.home2-tile'));

    // Мягкий блик
    var glow = document.createElement('div');
    glow.style.cssText = 'position:absolute;width:220px;height:220px;border-radius:50%;pointer-events:none;z-index:0;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(255,255,255,0.06) 0%,transparent 70%);filter:blur(28px);left:50%;top:50%;transition:left 2.5s cubic-bezier(.25,.46,.45,.94),top 2.5s cubic-bezier(.25,.46,.45,.94);';
    grid.appendChild(glow);

    // Shimmer на каждой плитке с разными фазами
    var phases = [0, 1.1, 2.2, 3.3];
    tiles.forEach(function(tile, i) {
      tile.style.position = 'relative';
      var spot = document.createElement('div');
      spot.style.cssText = 'position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:0;background:radial-gradient(circle at 50% 0%,rgba(255,255,255,0.04) 0%,transparent 65%);animation:tile-shimmer 5s ease-in-out infinite;animation-delay:' + phases[i] + 's;';
      tile.appendChild(spot);
    });

    // Автодрейф
    var t = 0;
    setInterval(function() {
      t += 0.006;
      var px = 50 + Math.sin(t * 0.9) * 20 + Math.sin(t * 0.4) * 8;
      var py = 50 + Math.cos(t * 0.7) * 18 + Math.cos(t * 0.5) * 6;
      glow.style.left = px + '%';
      glow.style.top  = py + '%';
    }, 60);

    grid.addEventListener('touchmove', function(e) {
      var r = grid.getBoundingClientRect();
      glow.style.left = ((e.touches[0].clientX - r.left) / r.width * 100) + '%';
      glow.style.top  = ((e.touches[0].clientY - r.top)  / r.height * 100) + '%';
    }, {passive: true});
    grid.addEventListener('mousemove', function(e) {
      var r = grid.getBoundingClientRect();
      glow.style.left = ((e.clientX - r.left) / r.width * 100) + '%';
      glow.style.top  = ((e.clientY - r.top)  / r.height * 100) + '%';
    });
  })();
};
