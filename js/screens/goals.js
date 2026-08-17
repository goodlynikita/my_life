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
  if (s && Array.isArray(s) && s.filter(Boolean).length > 0) return s.filter(Boolean);
  return GOALS_INITIAL;
}
function goalsSave(list) {
  list.forEach((g,i) => Store.set(`goals.directions.${i}`, g));
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
  overlay.innerHTML = `
    <div class="tr-modal">
      <p class="tr-modal-title">${isEdit?'Редактировать':'Новая цель'}</p>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Название<input type="text" id="g-name" value="${existing?.name||''}"></label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Сумма, ₽<input type="number" id="g-amount" value="${existing?.amount||''}" inputmode="numeric"></label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Категория<input type="text" id="g-cat" value="${existing?.cat||''}"></label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Сезон
          <select id="g-season" class="tr-color-select">
            <option value="all" ${existing?.season==='all'?'selected':''}>Без сезона / Цель</option>
            <option value="spring" ${existing?.season==='spring'?'selected':''}>Весна</option>
            <option value="summer" ${existing?.season==='summer'?'selected':''}>Лето</option>
            <option value="autumn" ${existing?.season==='autumn'?'selected':''}>Осень</option>
            <option value="december" ${existing?.season==='december'?'selected':''}>Декабрь</option>
          </select>
        </label>
      </div>
      <div class="tr-modal-row" style="align-items:center;gap:10px;">
        <input type="checkbox" id="g-done" ${existing?.done?'checked':''} style="width:auto;">
        <label for="g-done" style="font-size:13px;color:#E8E5DC;margin:0;">Закрыто ✓</label>
      </div>
      <div class="tr-modal-actions">
        ${isEdit?'<button class="tr-modal-btn-secondary" id="g-del" style="color:#FF5C5C;">Удалить</button>':'<button class="tr-modal-btn-secondary" id="g-cancel">Отмена</button>'}
        <button class="tr-modal-btn-primary" id="g-save">Сохранить</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  const cb=overlay.querySelector('#g-cancel');if(cb)cb.addEventListener('click',()=>overlay.remove());
  const db=overlay.querySelector('#g-del');if(db)db.addEventListener('click',()=>{if(!confirm('Удалить?'))return;onSave(null);overlay.remove();});
  overlay.querySelector('#g-save').addEventListener('click',()=>{
    const name=overlay.querySelector('#g-name').value.trim();if(!name)return;
    onSave({id:existing?.id||'g_'+Date.now(),name,amount:parseFloat(overlay.querySelector('#g-amount').value)||0,cat:overlay.querySelector('#g-cat').value.trim()||'Разное',season:overlay.querySelector('#g-season').value,done:overlay.querySelector('#g-done').checked});
    overlay.remove();
  });
}

window.Screens.goals = function(mount) {
  let activeSeason = 'all';

  mount.innerHTML = `
    <div class="goals-screen">
      <div class="goals-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <button class="goals-back" id="gb"><i class="ti ti-arrow-left"></i></button>
          <p class="goals-screen-title">Цели 2026</p>
        </div>
        <button class="goals-back" id="gl"><i class="ti ti-logout"></i></button>
      </div>
      <div class="goals-season-tabs" id="goals-tabs"></div>
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
      render();
    });
    tabsEl.appendChild(btn);
  });

  const content = document.getElementById('goals-content');

  function render() {
    const all = goalsGet();
    const season = GOALS_SEASONS.find(s=>s.key===activeSeason);
    const color = season.color;
    const bg = season.bg;

    const items = activeSeason==='all' ? all : all.filter(g=>g.season===activeSeason);
    const monthsLeft = goalsMonthsLeft(activeSeason);
    const totalAmt = items.filter(g=>g.season!=='all').reduce((s,g)=>s+g.amount,0);
    const doneAmt = items.filter(g=>g.done).reduce((s,g)=>s+g.amount,0);
    const remainAmt = totalAmt - doneAmt;
    const perMonth = monthsLeft && remainAmt>0 ? Math.round(remainAmt/monthsLeft) : 0;
    const doneCnt = items.filter(g=>g.done).length;
    const pct = items.length ? Math.round(doneCnt/items.length*100) : 0;

    /* ── Группы ── */
    const ALL_CATS = ['Цель','Бизнес','Бытовые','Бытовые моменты','Машина','Техника','Лыжный комплект','Здоровье','Разное','Закрытые'];
    const catOrder = activeSeason==='all'
      ? ALL_CATS
      : [...new Set(items.map(g=>g.cat))];
    /* В "Всё" показываем все цели из всех сезонов */
    const catSource = activeSeason==='all' ? all : items;
    const cats = catOrder.filter(cat=>catSource.some(g=>g.cat===cat));

    /* ── Hero ── */
    let heroHtml = '';
    if (activeSeason==='all') {
      const goalItems = all.filter(g=>g.cat==='Цель');
      const goalTotal = goalItems.reduce((s,g)=>s+g.amount,0);
      const otherItems = all.filter(g=>g.cat!=='Цель'&&g.season!=='all');
      const otherTotal = otherItems.reduce((s,g)=>s+g.amount,0);
      const grandTotal = goalTotal + otherTotal;
      const allDone = all.filter(g=>g.done).length;
      const allPct = all.length ? Math.round(allDone/all.length*100) : 0;
      const doneOtherTotal = all.filter(g=>g.done&&g.season!=='all').reduce((s,g)=>s+g.amount,0);
      heroHtml = `
        <div class="goals-hero-all" style="--season-color:${color};">
          <div class="goals-hero-eyebrow">ЦЕЛИ 2026</div>
          <div class="goals-hero-big">${goalsFmt(grandTotal)}</div>
          <div class="goals-hero-sub" style="display:flex;gap:16px;flex-wrap:wrap;margin-top:4px;">
            <span>На год: ${goalsFmt(otherTotal)}</span>
            <span style="color:#A8C97F;">Закрыто: ${goalsFmt(doneOtherTotal)}</span>
            <span style="color:#9D9A92;">Осталось: ${goalsFmt(otherTotal-doneOtherTotal)}</span>
          </div>
          <div class="goals-all-progress"><div class="goals-all-bar" style="width:${allPct}%;background:${color};"></div></div>
          <div class="goals-all-stats"><span>${allDone} из ${all.length} закрыто</span><span style="color:${color};">${allPct}%</span></div>
        </div>`;
    } else if (activeSeason==='spring') {
      heroHtml = `
        <div class="goals-hero-season" style="--season-bg:${bg};background:${bg};border-color:${color}55;">
          <div class="goals-season-badge" style="background:${color};color:#fff;">✓ Весна закрыта</div>
          <div class="goals-hero-season-amount" style="color:${color};">Всё выполнено</div>
          <div class="goals-season-sub" style="color:${color}99;">${doneCnt} пунктов закрыто</div>
        </div>`;
    } else {
      heroHtml = `
        <div class="goals-hero-season" style="--season-bg:${bg};background:${bg};border-color:${color}55;">
          <div class="goals-hero-season-row">
            <div>
              <div class="goals-season-badge" style="background:${color}22;color:${color};">${season.label}</div>
              <div class="goals-hero-season-amount" style="color:#F0EDE5;">${goalsFmt(totalAmt)}</div>
            </div>
            <div class="goals-ring" style="--pct:${pct};--c:${color};">
              <span style="color:${color};">${pct}%</span>
            </div>
          </div>
          ${monthsLeft ? `
          <div class="goals-season-stats">
            <div class="goals-season-stat">
              <div class="goals-sstat-label">Осталось</div>
              <div class="goals-sstat-val" style="color:#F0EDE5;">${goalsFmt(remainAmt)}</div>
            </div>
            <div class="goals-season-stat">
              <div class="goals-sstat-label">Месяцев</div>
              <div class="goals-sstat-val" style="color:${color};">${monthsLeft}</div>
            </div>
            <div class="goals-season-stat">
              <div class="goals-sstat-label">В месяц</div>
              <div class="goals-sstat-val" style="color:${color};">${goalsFmt(perMonth)}</div>
            </div>
          </div>
          <div class="goals-season-bar-track">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.5s;"></div>
          </div>` : ''}
        </div>`;
    }

    /* ── Категории ── */
    const catsHtml = cats.map(cat=>{
      const catItems = catSource.filter(g=>g.cat===cat);
      const catTotal = catItems.reduce((s,g)=>s+g.amount,0);
      const isGoal = cat==='Цель';
      const catColor = isGoal ? '#9333EA' : color;
      return `
        <div class="goals-cat-v3 ${isGoal?'goals-cat-main':''}" style="--cat-color:${catColor};">
          <div class="goals-cat-v3-head">
            <span class="goals-cat-v3-title">${isGoal?'🎯 ':''} ${cat}</span>
            <span class="goals-cat-v3-total" style="color:${catColor};">${goalsFmt(catTotal)}</span>
          </div>
          ${catItems.map(g=>{
            const idx = goalsGet().findIndex(x=>x.id===g.id);
            const sInfo = GOALS_SEASONS.find(s=>s.key===g.season)||GOALS_SEASONS[0];
            const itemColor = activeSeason==='all' ? sInfo.color : catColor;
            const seasonDot = activeSeason==='all' && g.season!=='all'
              ? `<span style="width:6px;height:6px;border-radius:50%;background:${sInfo.color};flex-shrink:0;display:inline-block;margin-right:2px;"></span>` : '';
            return `<div class="goals-item-v3 ${g.done?'done':''}" data-idx="${idx}">
              <div class="goals-check-v3 ${g.done?'checked':''}" data-idx="${idx}" style="${g.done?'background:'+itemColor+';border-color:'+itemColor+';':'border-color:'+itemColor+'44;'}">
                ${g.done?'<i class="ti ti-check" style="color:#fff;font-size:11px;"></i>':''}
              </div>
              ${seasonDot}
              <span class="goals-item-v3-name">${g.name}</span>
              <span class="goals-item-v3-amt" style="${g.done?'color:'+itemColor+';':''}">${g.amount>0?goalsFmt(g.amount):'✓'}</span>
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
        const idx=parseInt(el.dataset.idx);
        const list=goalsGet();
        list[idx].done=!list[idx].done;
        goalsSave(list);
        render();
      });
    });

    /* Редактирование */
    content.querySelectorAll('.goals-item-v3').forEach(el=>{
      el.addEventListener('click',()=>{
        const idx=parseInt(el.dataset.idx);
        const list=goalsGet();
        goalsOpenModal(list[idx],result=>{
          if(result===null)list.splice(idx,1);
          else list[idx]=result;
          goalsSave(list);
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
