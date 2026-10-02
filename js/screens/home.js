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
  var entries = typeof finEntries === 'function' ? finEntries(yr, now.getMonth()) : [];
  var monthIncome = entries.reduce(function(s,e){return s+(e && isFinite(+e.amount) ? +e.amount : 0);},0);

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
  var _tw = window.todayWorkoutInfo ? todayWorkoutInfo(store) : { text: 'Не задано', empty: true };
  var todayWorkout = _tw.empty ? '' : _tw.text;

  /* sliderCfg: interval, autoplay, hidden */
  var sliderCfg = (store.home && store.home.sliderCfg) || {};
  var sliderHidden = sliderCfg.hidden === true;

  /* Слайды всегда из Slides (порядок/вкл-выкл настраиваются) */
  var visSlides = window.Slides
    ? window.Slides.getSlides().filter(function(s){ return s && s.enabled !== false; })
        .map(function(s){ return window.Slides.renderSlide(s, store); })
    : [];
  if (!visSlides.length) sliderHidden = true;
  var n = visSlides.length || 1;

  var isLight = window.Theme && window.Theme.get() === 'light';

  mount.innerHTML = '<div class="home2-screen">'
    + '<div class="home2-header">'
    + (window.Feedback ? Feedback.buttonHtml('fb-envelope-home') : '')
    + (window.WinterArc ? WinterArc.html() : '')
    + '<button id="home-theme-btn" class="theme-toggle" data-mode="'+(isLight?'light':'dark')+'" aria-label="Тема: светлая / тёмная" title="Светлая / тёмная тема">'
    +   '<span class="tt-ico tt-sun">☀️</span><span class="tt-ico tt-moon">🌙</span><span class="tt-knob"></span>'
    + '</button>'
    + '<button id="home-menu-btn" class="home-menu-btn" aria-label="Меню"><span></span><span></span><span></span></button>'
    + '</div>'
    + (sliderHidden ? '' : '<div class="hero-slider" id="hero-slider">'
    + '<div class="hero-slides" id="hero-slides" style="width:'+(n*100)+'%">'
    + visSlides.join('')
    + '</div>'
    + (n > 1 ? '<div class="hero-dots">'
    + visSlides.map(function(_,i){ return '<div class="hero-dot'+(i===0?' active':'')+'" data-idx="'+i+'"></div>'; }).join('')
    + '</div>' : '')
    + '</div>')
    + '<div class="home2-grid tiles-v88">'
    + '<button class="home2-tile home2-tile-training" data-route="/training"><div class="home2-tile-content"><i class="ti ti-flame home2-tile-icon"></i><div class="home2-tile-name">Тренировки</div><div class="home2-tile-desc">'+String(todayWorkout||'Не задано').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];})+'</div></div></button>'
    + '<button class="home2-tile home2-tile-habits" data-route="/habits"><div class="home2-tile-content"><i class="ti ti-checklist home2-tile-icon"></i><div class="home2-tile-name">\u041f\u0440\u0438\u0432\u044b\u0447\u043a\u0438</div><div class="home2-tile-desc">'+todayDone+'/'+habList.length+' \u0441\u0435\u0433\u043e\u0434\u043d\u044f</div></div></button>'
    + '<button class="home2-tile home2-tile-finance" data-route="/finance"><div class="home2-tile-content"><i class="ti ti-chart-bar home2-tile-icon"></i><div class="home2-tile-name">\u0424\u0438\u043d\u0430\u043d\u0441\u044b</div><div class="home2-tile-desc">'+(monthIncome>0?fmt(monthIncome)+' / '+MONTHS[now.getMonth()]:'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0434\u043e\u0445\u043e\u0434')+'</div></div></button>'
    + '<button class="home2-tile home2-tile-goals" data-route="/goals"><div class="home2-tile-content"><i class="ti ti-target-arrow home2-tile-icon"></i><div class="home2-tile-name">\u0426\u0435\u043b\u0438</div><div class="home2-tile-desc">'+goalsPct+'% \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043e</div></div></button>'
    + '</div>'
    + '<div class="home2-footer"><div style="display:flex;align-items:center;justify-content:space-between;padding:6px 16px;">'

    + ''
    + '</div></div>'
    + '</div>';

  /* Slide widths */
  mount.querySelectorAll('.hero-slide').forEach(function(s){ s.style.width=(100/n)+'%'; s.style.flex='0 0 '+(100/n)+'%'; s.style.minWidth=(100/n)+'%'; });

  mount.querySelectorAll('[data-route]').forEach(function(el){
    el.addEventListener('click', function(){ Router.go(el.dataset.route); });
  });

  if (window.WinterArc) WinterArc.bind(mount);

  // Переключатель темы
  var themeBtn = document.getElementById('home-theme-btn');
  if (themeBtn) themeBtn.addEventListener('click', function() {
    var next = (window.Theme && window.Theme.get() === 'light') ? 'dark' : 'light';
    themeBtn.dataset.mode = next;
    setTimeout(function(){ window.Theme && window.Theme.set(next); }, 180);
  });

  // Единое меню
  var menuBtn = document.getElementById('home-menu-btn');
  if (menuBtn) menuBtn.addEventListener('click', function() {
    var ov = document.createElement('div');
    ov.className = 'tr-modal-overlay';
    ov.innerHTML = '<div style="background:#1C1E26;border-radius:16px;width:100%;max-width:340px;overflow:hidden;">'
      /* порядок по смыслу: люди → вид главной → помощь и выход */
      + '<div style="padding:16px 18px 6px;font-size:11px;font-weight:700;color:#6B7280;letter-spacing:.08em;text-transform:uppercase;">Тренер и друзья</div>'
      + (window._isTrainer ? '<button id="hm-coach" style="width:100%;padding:14px 18px;background:none;border:none;border-top:1px solid rgba(255,255,255,0.06);color:#C7D2FE;font-size:14px;font-family:Montserrat,sans-serif;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;"><i class="ti ti-users" style="font-size:18px;color:#8EA8FF;"></i>Кабинет тренера</button>' : '')
      + '<button id="hm-trainer" style="width:100%;padding:14px 18px;background:none;border:none;border-top:1px solid rgba(255,255,255,0.06);color:#E8E5DC;font-size:14px;font-family:Montserrat,sans-serif;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;"><i class="ti ti-user-star" style="font-size:18px;color:#9D9A92;"></i>' + (window.FirebaseSync && FirebaseSync.myTrainerCached && FirebaseSync.myTrainerCached() ? 'Мой тренер' : 'Подключить тренера') + '</button>'
      + '<button id="hm-friend" style="width:100%;padding:14px 18px;background:none;border:none;border-top:1px solid rgba(255,255,255,0.06);color:#C7D2FE;font-size:14px;font-family:Montserrat,sans-serif;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;"><i class="ti ti-gift" style="font-size:18px;color:#8EA8FF;"></i>Позови друга</button>'
      + '<div style="padding:14px 18px 6px;font-size:11px;font-weight:700;color:#6B7280;letter-spacing:.08em;text-transform:uppercase;border-top:1px solid rgba(255,255,255,0.06);">Внешний вид</div>'
      + (window.Palette ? Palette.rowHtml() : '')
      + '<button id="hm-slides" style="width:100%;padding:14px 18px;background:none;border:none;border-top:1px solid rgba(255,255,255,0.06);color:#E8E5DC;font-size:14px;font-family:Montserrat,sans-serif;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;"><i class="ti ti-layout" style="font-size:18px;color:#9D9A92;"></i>Редактор слайдов</button>'
      + '<button id="hm-settings" style="width:100%;padding:14px 18px;background:none;border:none;border-top:1px solid rgba(255,255,255,0.06);color:#E8E5DC;font-size:14px;font-family:Montserrat,sans-serif;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;"><i class="ti ti-adjustments-horizontal" style="font-size:18px;color:#9D9A92;"></i>Настройки слайдера</button>'
      + '<button id="hm-tiles" style="width:100%;padding:14px 18px;background:none;border:none;border-top:1px solid rgba(255,255,255,0.06);color:#E8E5DC;font-size:14px;font-family:Montserrat,sans-serif;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;"><i class="ti ti-layout-grid" style="font-size:18px;color:#9D9A92;"></i>Настройка плиток</button>'
      + '<div style="padding:14px 18px 6px;font-size:11px;font-weight:700;color:#6B7280;letter-spacing:.08em;text-transform:uppercase;border-top:1px solid rgba(255,255,255,0.06);">Ещё</div>'
      + '<button id="hm-tour" style="width:100%;padding:14px 18px;background:none;border:none;border-top:1px solid rgba(255,255,255,0.06);color:#E8E5DC;font-size:14px;font-family:Montserrat,sans-serif;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;"><i class="ti ti-help-circle" style="font-size:18px;color:#9D9A92;"></i>Подсказки по приложению</button>'
      + '<button id="hm-logout" style="width:100%;padding:14px 18px;background:none;border:none;border-top:1px solid rgba(255,255,255,0.06);color:#F87171;font-size:14px;font-family:Montserrat,sans-serif;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;"><i class="ti ti-logout" style="font-size:18px;"></i>Выйти</button>'
      + '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ if(e.target===ov) ov.remove(); });
    ov.querySelector('#hm-slides').addEventListener('click', function(){ ov.remove(); window.Slides && window.Slides.openEditor(); });
    ov.querySelector('#hm-tiles').addEventListener('click', function(){ ov.remove(); openTileSettings(); });
    ov.querySelector('#hm-settings').addEventListener('click', function(){ ov.remove(); openSliderSettings(); });
    var hc = ov.querySelector('#hm-coach'); if (hc) hc.addEventListener('click', function(){ location.href = 'coach.html'; });
    ov.querySelector('#hm-trainer').addEventListener('click', function(){ ov.remove(); if (!window.TrainerLink) return; if (FirebaseSync.myTrainerCached && FirebaseSync.myTrainerCached()) TrainerLink.info(); else TrainerLink.connect(); });
    ov.querySelector('#hm-friend').addEventListener('click', function(){ ov.remove(); window.Analytics && Analytics.inviteFriend(); });
    if (window.Palette) Palette.bind(ov);
    ov.querySelector('#hm-tour').addEventListener('click', function(){ ov.remove(); window.Tour && Tour.restart(); });
    ov.querySelector('#hm-logout').addEventListener('click', function(){ if (!confirm('Выйти из аккаунта?')) return; ov.remove(); Auth.logout().then(function(){ Router.go('/login'); }); });
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
          + 'user-select:none;">'
          + '<div class="se-move"><button class="tso-up" data-pos="'+pos+'" '+(pos===0?'disabled':'')+' aria-label="Выше"><i class="ti ti-chevron-up"></i></button><button class="tso-down" data-pos="'+pos+'" '+(pos===order.length-1?'disabled':'')+' aria-label="Ниже"><i class="ti ti-chevron-down"></i></button></div>'
          + '<span class="tso-handle" style="color:#555;font-size:18px;cursor:grab;touch-action:none;">⠿</span>'
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
        + '<div style="font-size:12px;color:#555;margin-bottom:10px;">Стрелками или перетащи за ⠿</div>'
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


    /* Drag-to-reorder */
    function rebind() {
      ov.querySelector('#tso-close').addEventListener('click', function() { ov.remove(); });
      /* Раньше после первой перерисовки клик по шаблону менял только порядок,
         а сетку — нет. Теперь меняет сетку и сохраняет текущий порядок */
      ov.querySelectorAll('.tso-tmpl').forEach(function(btn) {
        btn.addEventListener('click', function() {
          layout = TEMPLATES[parseInt(btn.dataset.tmpl)].id;
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

      ov.querySelectorAll('.tso-up,.tso-down').forEach(function(b){
        b.addEventListener('click', function(){
          var i = parseInt(b.dataset.pos), j = i + (b.classList.contains('tso-up') ? -1 : 1);
          if (j < 0 || j >= order.length) return;
          var x = order.splice(i, 1)[0]; order.splice(j, 0, x);
          ov.innerHTML = buildHtml(); rebind();
        });
      });
      var list = ov.querySelector('#tile-sort-list');
      var dragging = null, startY = 0, startIdx = 0;

      list.querySelectorAll('.tile-sort-item').forEach(function(item, idx) {
        item.addEventListener('pointerdown', function(e) {
          if (!e.target.closest('.tso-handle')) return;
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
      applyTileLayout();
    }

    rebind();
  }

  /* ── Применяем сохранённый порядок и сетку плиток при загрузке ── */
  /* Широкие плитки считаем в JS по ВИДИМЫМ плиткам.
     Раньше это делал CSS через :nth-child — но в грид добавляется слой-блик,
     и после любого сохранения порядок «съезжал» на одну позицию. */
  var WIDE_BY_LAYOUT = { '2x2': [], 'row': [0,1,2,3], 'bigfirst': [0,3], 'biglast': [2,3] };
  function applyTileLayout() {
    var h = Store.get().home || {};
    var savedOrder  = Array.isArray(h.tileOrder) ? h.tileOrder : (h.tileOrder ? Object.values(h.tileOrder) : null);
    var savedLayout = h.tileLayout || '2x2';
    var savedHidden = Array.isArray(h.tileHidden) ? h.tileHidden : (h.tileHidden ? Object.values(h.tileHidden) : []);
    var TILE_CLS = ['home2-tile-training','home2-tile-habits','home2-tile-finance','home2-tile-goals'];
    var LAYOUT_MAP = {'2x2':'layout-2x2','row':'layout-row','bigfirst':'layout-bigfirst','biglast':'layout-biglast'};
    var grid = mount.querySelector('.home2-grid');
    if (!grid) return;
    Object.values(LAYOUT_MAP).forEach(function(cls) { grid.classList.remove(cls); });
    grid.classList.add(LAYOUT_MAP[savedLayout] || 'layout-2x2');
    var order = (savedOrder && savedOrder.length === 4) ? savedOrder : [0,1,2,3];
    var tiles = order.map(function(ti){ return grid.querySelector('.'+TILE_CLS[ti]); }).filter(Boolean);
    var current = Array.from(grid.querySelectorAll('.home2-tile'));
    var sameOrder = current.length === tiles.length && current.every(function(el, i){ return el === tiles[i]; });
    if (!sameOrder) tiles.forEach(function(el){ grid.appendChild(el); });
    var wide = WIDE_BY_LAYOUT[savedLayout] || [];
    var vis = 0;
    tiles.forEach(function(el){
      var ti = TILE_CLS.findIndex(function(c){ return el.classList.contains(c); });
      var isHidden = savedHidden.indexOf(ti) !== -1;
      el.classList.toggle('tile-hidden', isHidden);
      el.classList.remove('tile-wide');
      if (!isHidden) { if (wide.indexOf(vis) !== -1) el.classList.add('tile-wide'); vis++; }
    });
    /* Плитка, оставшаяся одна в ряду, растягивается на всю ширину, чтобы не было дырки (в любом шаблоне) */
    var visTiles = tiles.filter(function(el){ return !el.classList.contains('tile-hidden'); });
    for (var k = 0; k < visTiles.length; k++) {
      if (visTiles[k].classList.contains('tile-wide')) continue;
      var nx = visTiles[k + 1];
      if (!nx || nx.classList.contains('tile-wide')) visTiles[k].classList.add('tile-wide'); else k++;
    }
    /* одна плитка: большая, на место всей сетки */
    grid.classList.toggle('tiles-solo', visTiles.length === 1);
    visTiles.forEach(function(el){ el.classList.toggle('tile-solo', visTiles.length === 1); });
    /* одна плитка занимает место сетки 2×2: две высоты обычной плитки плюс промежуток */
    var soloH = function(t, g){ t.style.removeProperty('min-height'); t.classList.remove('tile-solo'); var h = t.getBoundingClientRect().height; t.classList.add('tile-solo'); var gap = parseFloat(getComputedStyle(g).rowGap) || 12; return Math.round(h * 2 + gap); };
    var fitSolo = function(){ var t = grid.querySelector('.tile-solo'); tiles.forEach(function(el){ if (el !== t) el.style.removeProperty('min-height'); }); if (!t) return;
      t.style.setProperty('min-height', soloH(t, grid) + 'px', 'important'); };
    fitSolo();
    if (!window._homeSoloResize) { window._homeSoloResize = true; window.addEventListener('resize', function(){ var t = document.querySelector('.home2-grid.tiles-solo .tile-solo'); if (t) t.style.setProperty('min-height', soloH(t, t.parentElement) + 'px', 'important'); }); }
  }
  applyTileLayout();

  // Перерисовываем когда Firebase подгрузит данные
  if (window._homeTileUnsubscribe) window._homeTileUnsubscribe();
  window._homeTileUnsubscribe = Store.subscribe && Store.subscribe(function() {
    applyTileLayout();
  });

  /* ── Настройки слайдера: показать/скрыть, интервал, автолистание, порядок и видимость слайдов ── */
  function openSliderSettings() {
    var cfg2 = (Store.get().home && Store.get().home.sliderCfg) || {};
    var intVal = Math.round((cfg2.interval||4500)/1000);
    var autoOn = cfg2.autoplay !== false;
    var shownOn = cfg2.hidden !== true;
    var slides = window.Slides ? window.Slides.getSlides() : [];
    var SW = { 'slide-focus':'linear-gradient(135deg,#0a1e4a,#1a4a8a)', 'slide-finance':'linear-gradient(135deg,#072814,#165c2c)', 'slide-goals':'linear-gradient(135deg,#1e0d44,#420f7a)' };

    var ov = document.createElement('div');
    ov.className = 'tr-modal-overlay';

    function toggleHtml(id, on, extra) {
      return '<button '+(id?'id="'+id+'" ':'')+(extra||'')+' data-on="'+(on?'1':'0')+'" class="sl-tgl" aria-pressed="'+(on?'true':'false')+'"><i></i></button>';
    }
    function flip(btn) {
      var on = btn.dataset.on !== '1';
      btn.dataset.on = on ? '1' : '0'; btn.setAttribute('aria-pressed', on);
      return on;
    }
    function swatch(sl) {
      if (sl.cssClass && SW[sl.cssClass]) return SW[sl.cssClass];
      return sl.glowColor ? 'linear-gradient(135deg,'+(sl.color||'#111')+','+sl.glowColor+'66)' : (sl.color||'#1A1C22');
    }
    function slidesListHtml() {
      return slides.map(function(sl, i){
        var on = sl.enabled !== false;
        return '<div class="sl-row'+(on?'':' is-off')+'">'
          + '<div class="se-move"><button class="sl-up" data-i="'+i+'" '+(i===0?'disabled':'')+' aria-label="Выше"><i class="ti ti-chevron-up"></i></button>'
          + '<button class="sl-down" data-i="'+i+'" '+(i===slides.length-1?'disabled':'')+' aria-label="Ниже"><i class="ti ti-chevron-down"></i></button></div>'
          + '<span class="sl-swatch" style="background:'+swatch(sl)+'"></span>'
          + '<span class="sl-name">'+(sl.label||'Без названия')+'</span>'
          + toggleHtml('', on, 'data-slide="'+i+'"')
          + '</div>';
      }).join('');
    }

    ov.innerHTML = '<div style="background:#1A1C22;border-radius:16px;width:100%;max-width:480px;margin:0 auto;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;">'
      + '<div style="flex-shrink:0;padding:18px 20px 14px;border-bottom:1px solid #2A2D35;display:flex;align-items:center;justify-content:space-between;">'
      +   '<span style="font-size:17px;font-weight:800;color:#E8E5DC;">Слайдер</span>'
      +   '<button id="sl-close-x" style="background:#2A2D35;border:none;border-radius:50%;width:30px;height:30px;color:#9D9A92;cursor:pointer;font-size:18px;">×</button>'
      + '</div>'
      + '<div style="flex:1;min-height:0;overflow-y:auto;padding:16px 20px 20px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;background:#1C1E24;border-radius:14px;padding:14px 18px;margin-bottom:16px;">'
      +   '<div><div style="font-size:14px;font-weight:700;color:#E8E5DC;">Показывать слайдер</div><div style="font-size:11px;color:#555;margin-top:2px;">Выкл: на главном только плитки</div></div>'
      +   toggleHtml('sl-show-toggle', shownOn)
      + '</div>'
      + '<div id="sl-more" style="'+(shownOn?'':'opacity:.4;pointer-events:none;')+'">'
      + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#555;margin-bottom:8px;">Интервал переключения</div>'
      + '<div class="sl-iv" id="sl-iv"></div>'
      + '<div style="display:flex;align-items:center;justify-content:space-between;background:#1C1E24;border-radius:14px;padding:12px 18px;margin-bottom:18px;">'
      +   '<div><div style="font-size:14px;font-weight:600;color:#E8E5DC;">Автолистание</div><div style="font-size:11px;color:#555;margin-top:2px;">Выкл: листать вручную</div></div>'
      +   toggleHtml('sl-auto-toggle', autoOn)
      + '</div>'
      + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#555;margin-bottom:8px;">Слайды и порядок</div>'
      + '<div id="sl-list">'+slidesListHtml()+'</div>'
      + '</div>'
      + '<button id="sl-save" style="width:100%;margin-top:10px;padding:15px;background:#4A7CFF;border:none;border-radius:14px;color:#fff;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 4px 16px rgba(74,124,255,.35);">Сохранить</button>'
      + '</div></div>';
    document.body.appendChild(ov);

    function bindList() {
      ov.querySelectorAll('#sl-list [data-slide]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var i = parseInt(btn.dataset.slide);
          slides[i] = Object.assign({}, slides[i], { enabled: flip(btn) });
          btn.closest('.sl-row').classList.toggle('is-off', slides[i].enabled === false);
        });
      });
      function move(i, d) {
        var j = i + d; if (j < 0 || j >= slides.length) return;
        var x = slides.splice(i, 1)[0]; slides.splice(j, 0, x);
        ov.querySelector('#sl-list').innerHTML = slidesListHtml(); bindList();
      }
      ov.querySelectorAll('.sl-up').forEach(function(b){ b.addEventListener('click', function(){ move(parseInt(b.dataset.i), -1); }); });
      ov.querySelectorAll('.sl-down').forEach(function(b){ b.addEventListener('click', function(){ move(parseInt(b.dataset.i), 1); }); });
    }
    bindList();

    ov.addEventListener('click', function(e){ if (e.target===ov) ov.remove(); });
    ov.querySelector('#sl-close-x').addEventListener('click', function(){ ov.remove(); });
    ov.querySelector('#sl-show-toggle').addEventListener('click', function(){
      var on = flip(this);
      var more = ov.querySelector('#sl-more');
      more.style.opacity = on ? '' : '.4'; more.style.pointerEvents = on ? '' : 'none';
    });
    ov.querySelector('#sl-auto-toggle').addEventListener('click', function(){ flip(this); });
    function showInt() { var box = ov.querySelector('#sl-iv'); box.innerHTML = window.SlideKit.ivHtml(intVal); box.querySelectorAll('[data-iv]').forEach(function(b){ b.addEventListener('click', function(){ intVal = +b.dataset.iv; showInt(); }); }); }
    showInt();
    ov.querySelector('#sl-save').addEventListener('click', function(){
      Store.set('home.sliderCfg', {
        interval: intVal*1000,
        autoplay: ov.querySelector('#sl-auto-toggle').dataset.on==='1',
        hidden: ov.querySelector('#sl-show-toggle').dataset.on!=='1',
      });
      if (window.Slides) window.Slides.saveSlides(slides);
      ov.remove(); Router.render();
    });
  }

  /* ── Слайдер ── */
  var slidesEl = document.getElementById('hero-slides');
  var dotsEls  = mount.querySelectorAll('.hero-dot');
  if (slidesEl) {
    var cur=0, autoTimer=null;
    var interval = (sliderCfg.interval)||4500;
    function goTo(idx){ cur=((idx%n)+n)%n; slidesEl.style.transform='translateX(-'+(cur*(100/n))+'%)'; dotsEls.forEach(function(d,i){d.classList.toggle('active',i===cur);}); }
    /* Таймер один на всё приложение: при каждой перерисовке главной старый
       раньше не останавливался, и таймеры копились */
    function startAuto(){
      if (window._homeSliderTimer) clearInterval(window._homeSliderTimer);
      window._homeSliderTimer = null;
      if (n>1 && sliderCfg.autoplay!==false) window._homeSliderTimer = setInterval(function(){
        if (!document.body.contains(slidesEl)) { clearInterval(window._homeSliderTimer); window._homeSliderTimer = null; return; }
        goTo(cur+1);
      }, Math.max(2000, interval));
    }
    dotsEls.forEach(function(d){ d.addEventListener('click',function(e){e.stopPropagation();goTo(parseInt(d.dataset.idx));startAuto();}); });
    var sx=0;
    slidesEl.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;},{passive:true});
    slidesEl.addEventListener('touchend',function(e){var dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>40){goTo(dx<0?cur+1:cur-1);startAuto();}});
    startAuto();
  }

  /* Плитки: появление по очереди (анимация в CSS, тут только задержки) */
  mount.querySelectorAll('.home2-tile').forEach(function(t, i){ t.style.setProperty('--i', i); });
  var gridEl = mount.querySelector('.home2-grid');
  if (gridEl && !window._homeTilesShown) { gridEl.classList.add('tiles-enter-88'); window._homeTilesShown = true; }
};
