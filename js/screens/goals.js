/* ============================================================
   GOALS SCREEN v3 — мотивирующий дизайн + правильные данные
   ============================================================ */

window.Screens = window.Screens || {};

const GOALS_SEASONS = [
  { key: 'all',      label: 'Всё',     color: '#A78BFA', bg: '#1E1B2E' },
  { key: 'spring',   label: 'Весна',   color: '#38BDF8', bg: '#0C1A2E', end: new Date(2026,4,31) },
  { key: 'summer',   label: 'Лето',    color: '#A78BFA', bg: '#1A1528', end: new Date(2026,7,31) },
  { key: 'autumn',   label: 'Осень',   color: '#FB7185', bg: '#2A1020', end: new Date(2026,10,30) },
  { key: 'december', label: 'Декабрь', color: '#60A5FA', bg: '#0C1525', end: new Date(2026,11,31) },
];

const GOALS_INITIAL = [
  {"id":"g_dom","cat":"Цель","name":"Дом (ПВ)","amount":3000000,"done":false,"season":"all"},
  {"id":"g_rem","cat":"Цель","name":"Ремонт дома","amount":2000000,"done":false,"season":"all"},
  {"id":"g_car_goal","cat":"Цель","name":"Новая машина","amount":1200000,"done":false,"season":"all"},
  {"id":"g_b1","cat":"Бизнес","name":"Рассрочка","amount":130000,"done":false,"season":"all"},
  {"id":"g_b2","cat":"Бытовые","name":"Диван","amount":25000,"done":false,"season":"all"},
  {"id":"g_b3","cat":"Бытовые","name":"Обои, стены, откос","amount":8000,"done":false,"season":"all"},
  {"id":"g_v1","cat":"Закрытые","name":"Налог","amount":0,"done":true,"season":"spring"},
  {"id":"g_v2","cat":"Закрытые","name":"Резина на лето","amount":0,"done":true,"season":"spring"},
  {"id":"g_v3","cat":"Закрытые","name":"Наушники","amount":0,"done":true,"season":"spring"},
  {"id":"g_v4","cat":"Закрытые","name":"Удаление мудрости (верх)","amount":0,"done":true,"season":"spring"},
  {"id":"g_v5","cat":"Закрытые","name":"Брекетты (верх)","amount":0,"done":true,"season":"spring"},
  {"id":"g_v6","cat":"Закрытые","name":"Лечение зубов (верх)","amount":0,"done":true,"season":"spring"},
  {"id":"g_v7","cat":"Закрытые","name":"Парфюм Roja","amount":0,"done":true,"season":"spring"},
  {"id":"g_v8","cat":"Закрытые","name":"Парфюм Tygar","amount":0,"done":true,"season":"spring"},
  {"id":"g_l1","cat":"Бизнес","name":"Налог (1-2 КВ)","amount":28695,"done":false,"season":"summer"},
  {"id":"g_l2","cat":"Машина","name":"Ремонт кузова","amount":60000,"done":false,"season":"summer"},
  {"id":"g_l3","cat":"Здоровье","name":"Удаление мудрости (низ)","amount":2000,"done":false,"season":"summer"},
  {"id":"g_l4","cat":"Здоровье","name":"Лечение зубов (низ)","amount":24000,"done":false,"season":"summer"},
  {"id":"g_l5","cat":"Здоровье","name":"Брекетты (низ)","amount":55000,"done":false,"season":"summer"},
  {"id":"g_l6","cat":"Разное","name":"Кроссовки NB","amount":0,"done":true,"season":"summer"},
  {"id":"g_l7","cat":"Разное","name":"Одежда Tradeinn","amount":25000,"done":false,"season":"summer"},
  {"id":"g_l8","cat":"Разное","name":"Одежда минимум","amount":7000,"done":false,"season":"summer"},
  {"id":"g_l9","cat":"Разное","name":"Ракетка","amount":15000,"done":false,"season":"summer"},
  {"id":"g_l10","cat":"Разное","name":"Vibrato","amount":18000,"done":false,"season":"summer"},
  {"id":"g_l11","cat":"Разное","name":"Torino 21","amount":0,"done":true,"season":"summer"},
  {"id":"g_o1","cat":"Бизнес","name":"Налог 3 КВ","amount":12375,"done":false,"season":"autumn"},
  {"id":"g_o2","cat":"Техника","name":"Айфон","amount":50000,"done":false,"season":"autumn"},
  {"id":"g_o3","cat":"Техника","name":"Новый мак","amount":139000,"done":false,"season":"autumn"},
  {"id":"g_o4","cat":"Лыжный комплект","name":"Палки","amount":8000,"done":false,"season":"autumn"},
  {"id":"g_o5","cat":"Лыжный комплект","name":"Вторая маска","amount":8500,"done":false,"season":"autumn"},
  {"id":"g_o6","cat":"Лыжный комплект","name":"Штаны горнолыжные","amount":13000,"done":false,"season":"autumn"},
  {"id":"g_o7","cat":"Лыжный комплект","name":"Носки","amount":2500,"done":false,"season":"autumn"},
  {"id":"g_o8","cat":"Лыжный комплект","name":"Балаклава","amount":2000,"done":false,"season":"autumn"},
  {"id":"g_o9","cat":"Лыжный комплект","name":"Стельки","amount":1500,"done":false,"season":"autumn"},
  {"id":"g_o10","cat":"Лыжный комплект","name":"Перчатки тонкие","amount":4500,"done":false,"season":"autumn"},
  {"id":"g_o11","cat":"Лыжный комплект","name":"Перчатки кожа","amount":8000,"done":false,"season":"autumn"},
  {"id":"g_o12","cat":"Лыжный комплект","name":"Термобелье","amount":8000,"done":false,"season":"autumn"},
  {"id":"g_o13","cat":"Лыжный комплект","name":"Рации","amount":4000,"done":false,"season":"autumn"},
  {"id":"g_o14","cat":"Здоровье","name":"Чек-ап организма","amount":15000,"done":false,"season":"autumn"},
  {"id":"g_o15","cat":"Разное","name":"Одежда на осень-зиму","amount":40000,"done":false,"season":"autumn"},
  {"id":"g_d1","cat":"Бизнес","name":"Налог 4 КВ","amount":12375,"done":false,"season":"december"},
  {"id":"g_d2","cat":"Бизнес","name":"Налог УСН","amount":20000,"done":false,"season":"december"},
  {"id":"g_d3","cat":"Бизнес","name":"Налог АВТО","amount":8500,"done":false,"season":"december"},
  {"id":"g_d4","cat":"Разное","name":"Парфюм зима+весна","amount":25000,"done":false,"season":"december"},
];

function goalsGet() {
  const s = Store.get().goals?.directions;
  if (s) {
    const arr = Array.isArray(s) ? s : Object.values(s);
    const clean = arr.filter(Boolean);
    if (clean.length > 0) return clean;
  }
  return GOALS_INITIAL;
}
function goalsSave(list) {
  /* ВАЖНО: пишем весь массив одним set, иначе старые индексы остаются в Firebase */
  Store.set('goals.directions', list.filter(Boolean));
}
function goalsFmt(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ') + '₽';
}
function goalsMonthsLeft(season) {
  const s = GOALS_SEASONS.find(x=>x.key===season);
  if (!s?.end) return null;
  const now = new Date();
  /* Считаем только месяцы внутри сезона начиная со следующего.
     Лето: июн-авг, Осень: сен-ноя, Декабрь: дек
     Если сейчас июль — до конца лета 1 мес (август), осень 3 (сен+окт+ноя), декабрь 1 */
  const SEASON_MONTHS = {
    summer:   [5,6,7],   // июн=5, июл=6, авг=7
    autumn:   [8,9,10],  // сен=8, окт=9, ноя=10
    december: [11],      // дек=11
  };
  const sMths = SEASON_MONTHS[season];
  if (!sMths) return null;
  const curMonth = now.getMonth();
  // Считаем месяцы сезона >= текущего месяца
  const left = sMths.filter(m => m >= curMonth).length;
  return Math.max(1, left);
}

function goalsOpenModal(existing, onSave) {
  const isEdit = !!existing;
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';
  const existingCats = [...new Set(goalsGet().map(g=>g.cat))].sort();
  const catOpts = existingCats.map(c=>`<option value="${c}"${existing?.cat===c?' selected':''}>${c}</option>`).join('');
  const isNewCat = existing?.cat && !existingCats.includes(existing.cat);
  overlay.innerHTML = `
    <div class="goals-modal">
      <div class="goals-modal-header">
        <span class="goals-modal-title">${isEdit?'Редактировать':'Новая цель'}</span>
        ${isEdit?'<button class="goals-modal-del" id="g-del">✕ Удалить</button>':''}
      </div>
      <div class="goals-modal-field">
        <div class="goals-modal-label">Название</div>
        <input class="goals-modal-input" type="text" id="g-name" value="${existing?.name||''}" placeholder="Название цели">
      </div>
      <div class="goals-modal-field">
        <div class="goals-modal-label">Сумма, ₽</div>
        <input class="goals-modal-input" type="number" id="g-amount" value="${existing?.amount||''}" inputmode="numeric" placeholder="0">
      </div>
      <div class="goals-modal-field">
        <div class="goals-modal-label">Категория</div>
        <select class="goals-modal-select" id="g-cat-sel">
          ${catOpts}
          <option value="_new"${isNewCat?' selected':''}>+ Новая категория…</option>
        </select>
        <input class="goals-modal-input" type="text" id="g-cat" value="${isNewCat?existing?.cat||'':''}" placeholder="Название новой категории" style="margin-top:8px;display:${isNewCat?'block':'none'};">
      </div>
      <div class="goals-modal-2col">
        <div class="goals-modal-field">
          <div class="goals-modal-label">Сезон</div>
          <select class="goals-modal-select" id="g-season">
            <option value="all"${existing?.season==='all'?' selected':''}>Без сезона</option>
            <option value="spring"${existing?.season==='spring'?' selected':''}>Весна</option>
            <option value="summer"${existing?.season==='summer'?' selected':''}>Лето</option>
            <option value="autumn"${existing?.season==='autumn'?' selected':''}>Осень</option>
            <option value="december"${existing?.season==='december'?' selected':''}>Декабрь</option>
          </select>
        </div>
        <div class="goals-modal-field">
          <div class="goals-modal-label">Приоритет</div>
          <select class="goals-modal-select" id="g-priority">
            <option value="1"${(existing?.priority||2)===1?' selected':''}>🔴 Высокий</option>
            <option value="2"${(existing?.priority||2)===2?' selected':''}>🟡 Средний</option>
            <option value="3"${(existing?.priority||2)===3?' selected':''}>🟢 Низкий</option>
          </select>
        </div>
      </div>
      <div class="goals-modal-field">
        <div class="goals-modal-label">Статус</div>
        <div class="goals-modal-statuses">
          <button class="gm-status ${!existing?.done&&!existing?.maybe?'sel':''}" data-val="active">☐ Активная</button>
          <button class="gm-status ${existing?.done?'sel':''}" data-val="done">✓ Закрыта</button>
          <button class="gm-status ${existing?.maybe?'sel':''}" data-val="maybe">? Вопрос</button>
        </div>
      </div>
      <div class="goals-modal-actions">
        <button class="goals-modal-cancel" id="g-cancel">Отмена</button>
        <button class="goals-modal-save" id="g-save">Сохранить</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  overlay.querySelector('#g-cancel')?.addEventListener('click',()=>overlay.remove());
  overlay.querySelector('#g-del')?.addEventListener('click',()=>{if(!confirm('Удалить?'))return;onSave(null);overlay.remove();});

  /* Показать поле новой категории */
  overlay.querySelector('#g-cat-sel').addEventListener('change', function(){
    const inp = overlay.querySelector('#g-cat');
    inp.style.display = this.value==='_new'?'block':'none';
  });

  /* Статус кнопки */
  let selStatus = existing?.done?'done':existing?.maybe?'maybe':'active';
  overlay.querySelectorAll('.gm-status').forEach(btn=>{
    btn.addEventListener('click',()=>{
      selStatus=btn.dataset.val;
      overlay.querySelectorAll('.gm-status').forEach(b=>b.classList.remove('sel'));
      btn.classList.add('sel');
    });
  });

  overlay.querySelector('#g-save').addEventListener('click',()=>{
    const name=overlay.querySelector('#g-name').value.trim(); if(!name)return;
    const selCat=overlay.querySelector('#g-cat-sel').value;
    const newCat=overlay.querySelector('#g-cat').value.trim();
    const cat = selCat==='_new'?(newCat||'Разное'):selCat;
    onSave({
      id:existing?.id||'g_'+Date.now(), name,
      amount:parseFloat(overlay.querySelector('#g-amount').value)||0,
      cat, season:overlay.querySelector('#g-season').value,
      priority:parseInt(overlay.querySelector('#g-priority').value)||2,
      done:selStatus==='done', maybe:selStatus==='maybe'
    });
    overlay.remove();
  });
}

window.Screens.goals = function(mount) {
  let activeSeason = 'all';
  let activeMonth = 0;

  mount.innerHTML = `
    <div class="goals-screen">
      <div class="goals-header" style="position:sticky;top:0;z-index:16;">
        <div style="display:flex;align-items:center;gap:10px;">
          <button class="goals-back" id="gb"><i class="ti ti-arrow-left"></i></button>
          <p class="goals-screen-title">Цели 2026</p>
        </div>
        <button class="goals-back" id="gl"><i class="ti ti-logout"></i></button>
      </div>
      <div class="goals-season-tabs" id="goals-tabs" style="position:sticky;top:53px;z-index:15;"></div>
      <div id="goals-month-bar" style="display:none;position:sticky;top:97px;z-index:14;background:#1A1C22;border-bottom:1px solid #2A2D35;padding:6px 14px;"></div>
      <div class="goals-body" id="goals-content"></div>
    </div>`;

  document.getElementById('gb').addEventListener('click',()=>Router.go('/home'));
  document.getElementById('gl').addEventListener('click',()=>{Auth.logout();Router.go('/login');});

  const tabsEl = document.getElementById('goals-tabs');
  GOALS_SEASONS.forEach(s=>{
    const btn = document.createElement('button');
    btn.className = 'goals-season-tab' + (s.key==='all'?' active':'');
    btn.dataset.season = s.key;
    btn.style.setProperty('--season-color', s.color);
    btn.textContent = s.label;
    btn.addEventListener('click',()=>{
      tabsEl.querySelectorAll('.goals-season-tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      activeSeason = s.key;
      activeMonth = 0;
      render();
    });
    tabsEl.appendChild(btn);
  });

  const content = document.getElementById('goals-content');

  function renderMonthBar() {
    const bar = document.getElementById('goals-month-bar');
    if (!bar) return;
    if (activeSeason === 'all') { bar.style.display = 'none'; return; }
    const all = goalsGet();
    const seasonItems = all.filter(g => g.season === activeSeason);
    const months = [...new Set(seasonItems.filter(g => g.month).map(g => g.month))].sort((a,b)=>a-b);
    if (!months.length) { bar.style.display = 'none'; return; }
    bar.style.display = 'block';
    const MNAMES = ['','Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    const btns = [0, ...months].map(m => {
      const active = activeMonth === m;
      return '<button class="goals-mbar-btn' + (active?' active':'') + '" data-m="'+m+'" style="'
        + 'padding:5px 14px;border-radius:20px;border:1px solid '+(active?'#A78BFA':'#2A2D35')+';'
        + 'background:'+(active?'#A78BFA22':'none')+';color:'+(active?'#A78BFA':'#9D9A92')+';'
        + 'font-size:12px;font-weight:600;cursor:pointer;font-family:Montserrat,sans-serif;white-space:nowrap;">'
        + (m===0?'Все':MNAMES[m])+'</button>';
    }).join('');
    bar.innerHTML = '<div style="display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;">'+btns+'</div>';
    bar.querySelectorAll('.goals-mbar-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeMonth = parseInt(btn.dataset.m);
        renderMonthBar();
        render();
      });
    });
  }

  function render() {
    renderMonthBar();
    const all = goalsGet();
    const season = GOALS_SEASONS.find(s=>s.key===activeSeason);
    const color = season.color;
    const bg = season.bg;

    const items = activeSeason==='all' ? all : all.filter(g=>g.season===activeSeason);
    const monthsLeft = goalsMonthsLeft(activeSeason);
    /* totalAmt = все суммы сезона (включая закрытые) для показа общего */
    const totalAmt = filteredByMonth.filter(g=>g.season!=='all').reduce((s,g)=>s+g.amount,0);
    /* remainAmt = только активные (не закрытые, не под вопросом) */
    const remainAmt = filteredByMonth.filter(g=>g.season!=='all'&&!g.done&&!g.maybe).reduce((s,g)=>s+g.amount,0);
    const doneAmt = totalAmt - remainAmt;
    const perMonth = monthsLeft && remainAmt>0 ? Math.round(remainAmt/monthsLeft) : 0;
    const doneCnt = items.filter(g=>g.done).length;
    /* % от денег: закрыто/всего (исключаем нулевые суммы из подсчёта) */
    const seasonNonZero = items.filter(g=>g.season!=='all'&&g.amount>0);
    const seasonDoneAmt = seasonNonZero.filter(g=>g.done).reduce((s,g)=>s+g.amount,0);
    const seasonTotalAmt = seasonNonZero.reduce((s,g)=>s+g.amount,0);
    const pct = seasonTotalAmt>0 ? Math.round(seasonDoneAmt/seasonTotalAmt*100) : (doneCnt===items.length&&items.length>0?100:0);

    /* ── Группы ── */
    const ALL_CATS = ['Цель','Бизнес','Бытовые','Бытовые моменты','Машина','Техника','Лыжный комплект','Здоровье','Разное','Закрытые'];
    const catOrder = activeSeason==='all'
      ? ALL_CATS
      : [...new Set(items.map(g=>g.cat))];
    const catSource = activeSeason==='all' ? all : items;
    let cats = catOrder.filter(cat=>catSource.some(g=>g.cat===cat));
    /* Добавляем пользовательские категории которых нет в списке */
    [...new Set(catSource.map(g=>g.cat))].forEach(c=>{ if(!cats.includes(c)) cats.push(c); });
    /* В сезонах сортируем по приоритету категории */
    if (activeSeason !== 'all') {
      cats.sort((a,b)=>{
        const pa = Math.min(...(catSource.filter(g=>g.cat===a).map(g=>g.priority||2)));
        const pb = Math.min(...(catSource.filter(g=>g.cat===b).map(g=>g.priority||2)));
        return pa-pb;
      });
    }

    /* ── Hero ── */
    let heroHtml = '';
    if (activeSeason==='all') {
      const goalItems = all.filter(g=>g.cat==='Цель');
      const goalTotal = goalItems.filter(g=>!g.done).reduce((s,g)=>s+g.amount,0);
      const otherItems = all.filter(g=>g.cat!=='Цель'&&g.season!=='all');
      /* "На год" = все суммы незакрытых по сезонам */
      const otherTotal = otherItems.reduce((s,g)=>s+((g.done||g.maybe)?0:g.amount),0);
      /* grandTotal = незакрытые цели + незакрытые сезонные */
      const grandTotal = goalTotal + otherTotal;
      /* Закрыто = только сезонные закрытые (не цель) */
      const doneOtherTotal = all.filter(g=>g.done&&g.amount>0&&g.season!=='all').reduce((s,g)=>s+g.amount,0);
      /* Осталось не может быть отрицательным */
      const remainOther = Math.max(0, otherTotal - doneOtherTotal);
      const allDone = all.filter(g=>g.done).length;
      const allPct = all.length ? Math.round(allDone/all.length*100) : 0;
      heroHtml = `
        <div class="goals-hero-all" style="--season-color:${color};">
          <div class="goals-hero-eyebrow">ЦЕЛИ 2026</div>
          <div class="goals-hero-big">${goalsFmt(grandTotal)}</div>
          <div class="goals-hero-sub" style="display:flex;gap:16px;flex-wrap:wrap;margin-top:4px;">
            <span>На год: ${goalsFmt(otherTotal)}</span>
            <span style="color:#A8C97F;">Закрыто: ${goalsFmt(doneOtherTotal)}</span>
            <span style="color:#9D9A92;">Осталось: ${goalsFmt(remainOther)}</span>
          </div>
          <div class="goals-all-progress"><div class="goals-all-bar" style="width:${allPct}%;background:${color};"></div></div>
          <div class="goals-all-stats"><span>${allDone} из ${all.length} закрыто</span><span style="color:${color};">${allPct}%</span></div>
        </div>`;
    } else if (activeSeason==='spring') {
      {
        const stats1 = monthsLeft
          ? '<div class="goals-season-stats">'
            + '<div class="goals-season-stat"><div class="goals-sstat-label">ОСТАЛОСЬ</div><div class="goals-sstat-val goals-remain-val" style="color:#F0EDE5;">'+goalsFmt(remainAmt)+'</div></div>'
            + '<div class="goals-season-stat"><div class="goals-sstat-label">МЕСЯЦЕВ</div><div class="goals-sstat-val" style="color:'+color+';">'+monthsLeft+'</div></div>'
            + '<div class="goals-season-stat"><div class="goals-sstat-label">В МЕСЯЦ</div><div class="goals-sstat-val" style="color:'+color+';">'+goalsFmt(perMonth)+'</div></div>'
            + '</div><div class="goals-season-bar-track"><div style="height:100%;width:'+pct+'%;background:'+color+';border-radius:4px;transition:width 0.5s;"></div></div>'
          : '';
        heroHtml = '<div class="goals-hero-season" style="--season-bg:'+bg+';background:'+bg+';border-color:'+color+'55;">'
          + '<div class="goals-season-badge" style="background:'+color+'22;color:'+color+';">'+season.label+' · '+pct+'%</div>'
          + stats1 + '</div>';
      }
    } else {
      
      {
        const stats2 = monthsLeft
          ? '<div class="goals-season-stats">'
            + '<div class="goals-season-stat"><div class="goals-sstat-label">Осталось</div><div class="goals-sstat-val" style="color:#F0EDE5;">'+goalsFmt(remainAmt)+'</div></div>'
            + '<div class="goals-season-stat"><div class="goals-sstat-label">Месяцев</div><div class="goals-sstat-val" style="color:'+color+';">'+monthsLeft+'</div></div>'
            + '<div class="goals-season-stat"><div class="goals-sstat-label">В месяц</div><div class="goals-sstat-val" style="color:'+color+';">'+goalsFmt(perMonth)+'</div></div>'
            + '</div><div class="goals-season-bar-track"><div style="height:100%;width:'+pct+'%;background:'+color+';border-radius:4px;transition:width 0.5s;"></div></div>'
          : '';
        heroHtml = '<div class="goals-hero-season" style="--season-bg:'+bg+';background:'+bg+';border-color:'+color+'55;">'
          + '<div class="goals-hero-season-row">'
          +   '<div>'
          +     '<div class="goals-season-badge" style="background:'+color+'22;color:'+color+';">'+season.label+'</div>'
          +     '<div class="goals-hero-season-amount" style="color:#F0EDE5;">'+goalsFmt(totalAmt)+'</div>'
          +   '</div>'
          +   '<div class="goals-ring" style="--pct:'+pct+';--c:'+color+';">'
          +     '<span class="goals-hero-pct-val" style="color:'+color+';transition:all 0.4s;">'+pct+'%</span>'
          +   '</div>'
          + '</div>'
          + stats2 + '</div>';
      }
    }

    /* ── Категории ── */
    const catsHtml = cats.map(cat=>{
      const catItems = catSource.filter(g=>g.cat===cat);
      /* Итог = только активные (не закрытые и не под вопросом) */
      const catTotal = catItems.filter(g=>!g.done&&!g.maybe).reduce((s,g)=>s+g.amount,0);
      const isGoal = cat==='Цель';
      const catColor = isGoal ? '#9333EA' : color;
      return `
        <div class="goals-cat-v3 ${isGoal?'goals-cat-main':''}" style="--cat-color:${catColor};">
          <div class="goals-cat-v3-head">
            <span class="goals-cat-v3-title">${isGoal?'🎯 ':''} ${cat}</span>
            <span class="goals-cat-total goals-cat-v3-total" data-cat="${cat}" style="color:${catColor};transition:all 0.4s;">${goalsFmt(catTotal)}</span>
          </div>
          ${catItems.map(g=>{
            const idx = goalsGet().findIndex(x=>x.id===g.id);
            const sInfo = GOALS_SEASONS.find(s=>s.key===g.season)||GOALS_SEASONS[0];
            const itemColor = activeSeason==='all' ? sInfo.color : catColor;
            const seasonDot = activeSeason==='all' && g.season!=='all'
              ? '<span style="width:6px;height:6px;border-radius:50%;background:'+sInfo.color+';flex-shrink:0;display:inline-block;margin-right:2px;"></span>' : '';
            const gStatus = g.done?'done':g.maybe?'maybe':'active';
            const checkBg = g.done?itemColor:g.maybe?'#F59E0B':'transparent';
            const checkBorder = g.done||g.maybe?checkBg:(itemColor+'44');
            const checkIcon = g.done?'<i class="ti ti-check" style="color:#fff;font-size:11px;"></i>':g.maybe?'<span style="color:#fff;font-size:12px;font-weight:800;">?</span>':'';
            const amtDisplay = g.done
              ? '<i class="ti ti-check" style="color:'+itemColor+';font-size:16px;"></i>'
              : g.maybe
                ? '<span style="color:#F59E0B;font-size:13px;font-weight:700;">?</span>'
                : (g.amount>0?goalsFmt(g.amount):'');
            const rowOpacity = (g.done||g.maybe)?'0.6':'1';
            return `<div class="goals-item-v3 ${gStatus}" data-idx="${idx}" data-gid="${g.id}" style="opacity:${rowOpacity};transition:opacity 0.3s;">
              <div class="goals-check-v3 ${gStatus}" data-idx="${idx}" data-gid="${g.id}" style="background:${checkBg};border-color:${checkBorder};">
                ${checkIcon}
              </div>
              ${seasonDot}
              <span class="goals-item-v3-name" style="${g.done?'text-decoration:line-through;':''}">${g.priority===1?'🔴 ':''}${g.name}</span>
              <span class="goals-item-v3-amt">${amtDisplay}</span>
            </div>`;
          }).join('')}
          <button class="goals-add-v3" data-cat="${cat}" data-season="${activeSeason}">+ добавить</button>
        </div>`;
    }).join('');

    content.innerHTML = heroHtml + catsHtml + `
      <button id="goals-new" class="goals-new-v3" style="--season-color:${color};">
        <i class="ti ti-plus"></i> Новая цель
      </button>`;

    /* Чекбокс */
    content.querySelectorAll('.goals-check-v3').forEach(el=>{
      el.addEventListener('click',e=>{
        e.stopPropagation();
        const gid = el.dataset.gid;
        const list = goalsGet();
        const item = list.find(g=>g.id===gid);
        if (!item) return;
        /* Цикл: active → done → maybe → active */
        const cur = item.done?'done':item.maybe?'maybe':'active';
        if (cur==='active') { item.done=true; item.maybe=false; }
        else if (cur==='done') { item.done=false; item.maybe=true; }
        else { item.done=false; item.maybe=false; }
        goalsSave(list);
        window.dispatchEvent(new CustomEvent('goals-updated'));

        /* ── Анимация без перезагрузки ── */
        const isDone = list[idx].done;
        const itemColor = el.style.getPropertyValue('--item-color') || '#9333EA';

        /* Чекбокс */
        el.style.transition = 'all 0.25s cubic-bezier(.34,1.56,.64,1)';
        el.style.transform = 'scale(1.3)';
        el.style.background = isDone ? '#9333EA' : '#16181E';
        el.style.borderColor = isDone ? '#9333EA' : '#3A3D4544';
        el.innerHTML = isDone ? '<i class="ti ti-check" style="color:#fff;font-size:11px;"></i>' : '';
        setTimeout(() => { el.style.transform = 'scale(1)'; }, 200);

        /* Строка цели */
        const row = el.closest('.goals-item-v3');
        if (row) {
          row.style.transition = 'opacity 0.3s';
          row.style.opacity = isDone ? '0.5' : '1';
          if (isDone) row.classList.add('done'); else row.classList.remove('done');
          const nameEl = row.querySelector('.goals-item-v3-name');
          if (nameEl) nameEl.style.textDecoration = isDone ? 'line-through' : '';
          const amtEl = row.querySelector('.goals-item-v3-amt');
          if (amtEl) {
            amtEl.style.transition = 'all 0.3s';
            amtEl.innerHTML = isDone
              ? '<i class="ti ti-check" style="font-size:16px;transition:all 0.3s;"></i>'
              : (list[idx].amount > 0 ? goalsFmt(list[idx].amount) : '');
          }
        }

        /* Пересчёт суммы категории */
        const cat = list[idx].cat;
        const allList = goalsGet();
        const catItems = allList.filter(g => g.cat === cat && (activeSeason==='all' || g.season===activeSeason));
        const newCatTotal = catItems.filter(g => !g.done).reduce((s,g) => s + g.amount, 0);
        const catTotalEl = content.querySelector('.goals-cat-total[data-cat="'+cat+'"]');
        if (catTotalEl) {
          catTotalEl.style.transition = 'all 0.4s';
          catTotalEl.textContent = goalsFmt(newCatTotal);
        }

        /* Пересчёт hero суммы сезона */
        const seasonItems = allList.filter(g => activeSeason==='all' ? true : g.season===activeSeason);
        const newRemain = seasonItems.filter(g=>!g.done&&g.season!=='all').reduce((s,g)=>s+g.amount,0);
        const newDone = seasonItems.filter(g=>g.done).length;
        const newTotal = seasonItems.length;
        const newPct = newTotal ? Math.round(newDone/newTotal*100) : 0;

        const remainEl = content.querySelector('.goals-remain-val');
        if (remainEl) { remainEl.style.transition='all 0.4s'; remainEl.textContent=goalsFmt(newRemain); }
        const pctEl = content.querySelector('.goals-hero-pct-val');
        if (pctEl) { pctEl.style.transition='all 0.4s'; pctEl.textContent=newPct+'%'; }
        const fillEl = content.querySelector('.goals-all-bar, .hero-goals-fill');
        if (fillEl) { fillEl.style.transition='width 0.6s ease'; fillEl.style.width=newPct+'%'; }
      });
    });

    /* Редактирование по клику на имя/сумму */
    content.querySelectorAll('.goals-item-v3').forEach(el=>{
      el.addEventListener('click', e=>{
        if(e.target.closest('.goals-check-v3')) return;
        const gid = el.dataset.gid;
        const list = goalsGet();
        const item = list.find(g=>g.id===gid);
        if(!item) return;
        goalsOpenModal({...item}, result=>{
          const fresh = goalsGet(); /* берём свежий список */
          if(result===null) {
            const filtered = fresh.filter(g=>g.id!==gid);
            goalsSave(filtered);
          } else {
            const updated = fresh.map(g=>g.id===gid?result:g);
            goalsSave(updated);
          }
          render();
        });
      });
    });

    content.querySelectorAll('.goals-add-v3').forEach(btn=>{
      btn.addEventListener('click',()=>{
        goalsOpenModal({cat:btn.dataset.cat,season:btn.dataset.season==='all'?'all':btn.dataset.season},result=>{
          if(!result)return;
          const list=goalsGet();list.push(result);goalsSave(list);render();
        });
      });
    });

    document.getElementById('goals-new').addEventListener('click',()=>{
      goalsOpenModal({season:activeSeason==='all'?'all':activeSeason},result=>{
        if(!result)return;
        const list=goalsGet();list.push(result);goalsSave(list);render();
      });
    });
  }

  render();
};
