/* ============================================================
   GOALS SCREEN v2 — полная реализация с Firebase
   Данные: Store → goals.directions[], goals.items[]
   ============================================================ */

window.Screens = window.Screens || {};

const GOALS_SEASONS = [
  { key: 'all',      label: 'Всё',     months: [] },
  { key: 'summer',   label: 'Лето',    months: [6,7,8],   end: [2026,8,31] },
  { key: 'autumn',   label: 'Осень',   months: [9,10,11], end: [2026,11,30] },
  { key: 'december', label: 'Декабрь', months: [12],      end: [2026,12,31] },
];

/* Данные из таблицы — хранятся в Firebase, начальные значения для restore */
const GOALS_INITIAL = [
  /* ── ЦЕЛЬ (главное) ── */
  { id:'g_dom',    cat:'Цель', name:'Дом (ПВ)',      amount:3000000, done:false, season:'all' },
  { id:'g_rem',    cat:'Цель', name:'Ремонт дома',   amount:2000000, done:false, season:'all' },
  { id:'g_car',    cat:'Цель', name:'Новая машина',  amount:1200000, done:false, season:'all' },
  /* ── ЛЕТО ── */
  { id:'g_b1',  cat:'Бизнес',          name:'Рассрочка',        amount:130000, done:false, season:'summer' },
  { id:'g_b2',  cat:'Бизнес',          name:'Налог (1-2 КВ)',   amount:28695,  done:false, season:'summer' },
  { id:'g_b3',  cat:'Бизнес',          name:'Налог 3 КВ',       amount:12375,  done:false, season:'summer' },
  { id:'g_b4',  cat:'Бизнес',          name:'Налог 4 КВ',       amount:12375,  done:false, season:'summer' },
  { id:'g_b5',  cat:'Бизнес',          name:'Налог УСН',        amount:20000,  done:false, season:'summer' },
  { id:'g_b6',  cat:'Бизнес',          name:'Налог АВТО',       amount:8500,   done:false, season:'summer' },
  { id:'g_b7',  cat:'Бизнес',          name:'Налог',            amount:0,      done:true,  season:'summer' },
  { id:'g_by1', cat:'Бытовые моменты', name:'Диван',            amount:25000,  done:false, season:'summer' },
  { id:'g_by2', cat:'Бытовые моменты', name:'Обои, стены, откос', amount:8000, done:false, season:'summer' },
  { id:'g_m1',  cat:'Машина',          name:'Ремонт кузова',    amount:60000,  done:false, season:'summer' },
  { id:'g_m2',  cat:'Машина',          name:'Резина на лето',   amount:0,      done:true,  season:'summer' },
  { id:'g_h1',  cat:'Здоровье',        name:'Чек-ап организма', amount:15000,  done:false, season:'summer' },
  { id:'g_h2',  cat:'Здоровье',        name:'Удаление мудрости (низ)', amount:2000, done:false, season:'summer' },
  { id:'g_h3',  cat:'Здоровье',        name:'Удаление мудрости (верх)', amount:0, done:true, season:'summer' },
  /* ── ОСЕНЬ ── */
  { id:'g_t1',  cat:'Техника',  name:'Наушники',       amount:0,      done:true,  season:'autumn' },
  { id:'g_t2',  cat:'Техника',  name:'Айфон',          amount:50000,  done:false, season:'autumn' },
  { id:'g_t3',  cat:'Техника',  name:'Новый мак',      amount:139000, done:false, season:'autumn' },
  { id:'g_h4',  cat:'Здоровье', name:'Брекетты (верх)',      amount:0,     done:true,  season:'autumn' },
  { id:'g_h5',  cat:'Здоровье', name:'Лечение зубов (верх)', amount:0,     done:true,  season:'autumn' },
  { id:'g_h6',  cat:'Здоровье', name:'Лечение зубов (низ)',  amount:24000, done:false, season:'autumn' },
  { id:'g_h7',  cat:'Здоровье', name:'Брекетты (низ)',       amount:55000, done:false, season:'autumn' },
  { id:'g_r1',  cat:'Разное',  name:'Кроссовки NB',         amount:0,     done:true,  season:'autumn' },
  { id:'g_r2',  cat:'Разное',  name:'Одежда Tradeinn',       amount:25000, done:false, season:'autumn' },
  { id:'g_r3',  cat:'Разное',  name:'Одежда минимум',        amount:7000,  done:false, season:'autumn' },
  { id:'g_r4',  cat:'Разное',  name:'Ракетка',               amount:15000, done:false, season:'autumn' },
  { id:'g_r5',  cat:'Разное',  name:'Парфюм Roja',           amount:0,     done:true,  season:'autumn' },
  { id:'g_r6',  cat:'Разное',  name:'Парфюм Tygar',          amount:0,     done:true,  season:'autumn' },
  { id:'g_r7',  cat:'Разное',  name:'Vibrato',               amount:18000, done:false, season:'autumn' },
  { id:'g_r8',  cat:'Разное',  name:'Torino 21',             amount:0,     done:true,  season:'autumn' },
  { id:'g_r9',  cat:'Разное',  name:'Парфюм зима+весна',     amount:25000, done:false, season:'autumn' },
  { id:'g_r10', cat:'Разное',  name:'Одежда на осень-зиму',  amount:40000, done:false, season:'autumn' },
  /* ── ДЕКАБРЬ ── */
  { id:'g_l1',  cat:'Лыжный комплект', name:'Палки',            amount:8000,  done:false, season:'december' },
  { id:'g_l2',  cat:'Лыжный комплект', name:'Вторая маска',     amount:8500,  done:false, season:'december' },
  { id:'g_l3',  cat:'Лыжный комплект', name:'Штаны горнолыжные',amount:13000, done:false, season:'december' },
  { id:'g_l4',  cat:'Лыжный комплект', name:'Носки',            amount:2500,  done:false, season:'december' },
  { id:'g_l5',  cat:'Лыжный комплект', name:'Балаклава',        amount:2000,  done:false, season:'december' },
  { id:'g_l6',  cat:'Лыжный комплект', name:'Стельки',          amount:1500,  done:false, season:'december' },
  { id:'g_l7',  cat:'Лыжный комплект', name:'Перчатки тонкие',  amount:4500,  done:false, season:'december' },
  { id:'g_l8',  cat:'Лыжный комплект', name:'Перчатки кожа',    amount:8000,  done:false, season:'december' },
  { id:'g_l9',  cat:'Лыжный комплект', name:'Термобелье',       amount:8000,  done:false, season:'december' },
  { id:'g_l10', cat:'Лыжный комплект', name:'Рации',            amount:4000,  done:false, season:'december' },
];

const SEASON_COLORS = {
  summer:   '#3B82F6',
  autumn:   '#F59E0B',
  december: '#8B5CF6',
  all:      '#6B7280',
};

const SEASON_END_DATES = {
  summer:   new Date(2026, 7, 31),  // 31 авг
  autumn:   new Date(2026, 10, 30), // 30 ноя
  december: new Date(2026, 11, 31), // 31 дек
};

function goalsGet() {
  const stored = Store.get().goals?.directions;
  if (stored && Array.isArray(stored) && stored.filter(Boolean).length > 0) {
    return stored.filter(Boolean);
  }
  return GOALS_INITIAL;
}

function goalsSave(list) {
  list.forEach((g,i) => Store.set(`goals.directions.${i}`, g));
}

function goalsFmt(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ') + '₽';
}

function goalsMonthsLeft(season) {
  const end = SEASON_END_DATES[season];
  if (!end) return null;
  const now = new Date();
  const diff = (end.getFullYear()-now.getFullYear())*12 + end.getMonth()-now.getMonth();
  return Math.max(1, diff+1);
}

function goalsSeasonPct(items) {
  if (!items.length) return 100;
  const doneAmt = items.filter(i=>i.done).reduce((s,i)=>s+i.amount,0);
  const totalAmt = items.reduce((s,i)=>s+i.amount,0);
  if (!totalAmt) return items.filter(i=>i.done).length===items.length ? 100 : 0;
  return Math.round(doneAmt/totalAmt*100);
}

function goalsOpenModal(existing, onSave) {
  const isEdit = !!existing;
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';
  overlay.innerHTML = `
    <div class="tr-modal">
      <p class="tr-modal-title">${isEdit?'Редактировать':'Новая цель'}</p>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Название
          <input type="text" id="g-name" value="${existing?.name||''}">
        </label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Сумма, ₽
          <input type="number" id="g-amount" value="${existing?.amount||''}" inputmode="numeric">
        </label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Категория
          <input type="text" id="g-cat" value="${existing?.cat||''}" placeholder="Бизнес, Техника…">
        </label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Сезон
          <select id="g-season" class="tr-color-select">
            <option value="summer"   ${existing?.season==='summer'  ?'selected':''}>Лето</option>
            <option value="autumn"   ${existing?.season==='autumn'  ?'selected':''}>Осень</option>
            <option value="december" ${existing?.season==='december'?'selected':''}>Декабрь</option>
            <option value="all"      ${existing?.season==='all'     ?'selected':''}>Без сезона / Цель</option>
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
  const cb=overlay.querySelector('#g-cancel');
  if(cb)cb.addEventListener('click',()=>overlay.remove());
  const db=overlay.querySelector('#g-del');
  if(db)db.addEventListener('click',()=>{if(!confirm('Удалить?'))return;onSave(null);overlay.remove();});
  overlay.querySelector('#g-save').addEventListener('click',()=>{
    const name=overlay.querySelector('#g-name').value.trim();
    if(!name)return;
    onSave({
      id:existing?.id||'g_'+Date.now(),
      name,
      amount:parseFloat(overlay.querySelector('#g-amount').value)||0,
      cat:overlay.querySelector('#g-cat').value.trim()||'Разное',
      season:overlay.querySelector('#g-season').value,
      done:overlay.querySelector('#g-done').checked,
    });
    overlay.remove();
  });
}

window.Screens.goals = function(mount) {
  let activeSeason = 'all';

  mount.innerHTML = `
    <div class="theme-dark">
      <div class="sec-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <button class="sec-back" id="gb"><i class="ti ti-arrow-left"></i></button>
          <p class="sec-title">Цели 2026</p>
        </div>
        <button class="sec-back" id="gl"><i class="ti ti-logout"></i></button>
      </div>
      <div class="sec-tabs goals-tabs" style="position:sticky;top:0;z-index:10;">
        ${GOALS_SEASONS.map(s=>`<button class="sec-tab ${s.key==='all'?'active':''}" data-season="${s.key}">${s.label}</button>`).join('')}
      </div>
      <div class="sec-body" id="goals-content"></div>
    </div>`;

  document.getElementById('gb').addEventListener('click',()=>Router.go('/home'));
  document.getElementById('gl').addEventListener('click',()=>{Auth.logout();Router.go('/login');});
  mount.querySelectorAll('.sec-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      mount.querySelectorAll('.sec-tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      activeSeason=btn.dataset.season;
      render();
    });
  });

  const content=document.getElementById('goals-content');

  function renderSeason(season) {
    const all = goalsGet();
    const items = season==='all' ? all : all.filter(g=>g.season===season);
    const color = SEASON_COLORS[season]||'#6B7280';
    const monthsLeft = goalsMonthsLeft(season);
    const totalAmt = items.filter(g=>g.season!=='all').reduce((s,g)=>s+g.amount,0);
    const doneAmt = items.filter(g=>g.season!=='all'&&g.done).reduce((s,g)=>s+g.amount,0);
    const remainAmt = totalAmt - doneAmt;
    const perMonth = monthsLeft && remainAmt>0 ? Math.round(remainAmt/monthsLeft) : 0;
    const pct = goalsSeasonPct(items.filter(g=>g.season!=='all'));

    /* Группируем по категории */
    const catOrder = season==='all'
      ? ['Цель','Бизнес','Бытовые моменты','Машина','Техника','Лыжный комплект','Здоровье','Разное']
      : [...new Set(items.map(g=>g.cat))];

    const cats = catOrder.filter(cat=>items.some(g=>g.cat===cat));

    let heroHtml = '';
    if (season==='all') {
      const goalItems = all.filter(g=>g.cat==='Цель');
      const goalTotal = goalItems.reduce((s,g)=>s+g.amount,0);
      const goalDone = goalItems.filter(g=>g.done).reduce((s,g)=>s+g.amount,0);
      const otherItems = all.filter(g=>g.cat!=='Цель'&&g.season!=='all');
      const otherTotal = otherItems.reduce((s,g)=>s+g.amount,0);
      const grandTotal = goalTotal + otherTotal;
      heroHtml = `
        <div class="goals-hero goals-hero-all">
          <div class="goals-hero-label">Общая сумма целей</div>
          <div class="goals-hero-amount">${goalsFmt(grandTotal)}</div>
          <div class="goals-hero-sub">из них на текущий год: ${goalsFmt(otherTotal)}</div>
        </div>`;
    } else {
      const seasonLabel = GOALS_SEASONS.find(s=>s.key===season)?.label||'';
      heroHtml = `
        <div class="goals-hero" style="border-top:3px solid ${color};">
          <div class="goals-hero-row">
            <div>
              <div class="goals-hero-label">${seasonLabel}</div>
              <div class="goals-hero-amount">${goalsFmt(totalAmt)}</div>
            </div>
            <div class="goals-pct-ring" style="--pct:${pct};--color:${color};">
              <span>${pct}%</span>
            </div>
          </div>
          ${monthsLeft ? `
          <div class="goals-stats-row">
            <div class="goals-stat">
              <div class="goals-stat-label">Осталось</div>
              <div class="goals-stat-val">${goalsFmt(remainAmt)}</div>
            </div>
            <div class="goals-stat">
              <div class="goals-stat-label">Месяцев</div>
              <div class="goals-stat-val">${monthsLeft}</div>
            </div>
            <div class="goals-stat">
              <div class="goals-stat-label">В месяц</div>
              <div class="goals-stat-val" style="color:${color};">${goalsFmt(perMonth)}</div>
            </div>
          </div>
          <div class="goals-progress-bar">
            <div style="width:${pct}%;background:${color};height:100%;border-radius:4px;transition:width 0.5s;"></div>
          </div>` : ''}
        </div>`;
    }

    const catsHtml = cats.map(cat=>{
      const catItems = items.filter(g=>g.cat===cat);
      const catTotal = catItems.reduce((s,g)=>s+g.amount,0);
      const catDone = catItems.filter(g=>g.done).length;
      const isGoal = cat==='Цель';

      return `
        <div class="goals-cat-card ${isGoal?'goals-cat-goal':''}">
          <div class="goals-cat-head">
            <div class="goals-cat-title">${isGoal?'🎯 ':''} ${cat}</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:11px;color:#9D9A92;">${catDone}/${catItems.length}</span>
              <span class="goals-cat-total">${goalsFmt(catTotal)}</span>
            </div>
          </div>
          ${catItems.map((g,gi)=>{
            const realIdx = goalsGet().findIndex(x=>x.id===g.id);
            return `<div class="goals-item ${g.done?'goals-done':''} goals-item-edit" data-idx="${realIdx}">
              <div style="display:flex;align-items:center;gap:10px;flex:1;">
                <span class="goals-check ${g.done?'checked':''}" data-idx="${realIdx}">
                  ${g.done?'<i class="ti ti-check"></i>':''}
                </span>
                <span class="goals-item-name">${g.name}</span>
              </div>
              <span class="goals-item-amount">${g.amount>0?goalsFmt(g.amount):'✓'}</span>
            </div>`;
          }).join('')}
          <button class="goals-add-item" data-cat="${cat}" data-season="${season}">
            <i class="ti ti-plus"></i> Добавить
          </button>
        </div>`;
    }).join('');

    content.innerHTML = heroHtml + catsHtml + `
      <button id="goals-add-cat" class="goals-new-cat-btn">
        <i class="ti ti-plus"></i> Новая цель
      </button>`;

    /* Клик по чекбоксу */
    content.querySelectorAll('.goals-check').forEach(el=>{
      el.addEventListener('click', e=>{
        e.stopPropagation();
        const idx=parseInt(el.dataset.idx);
        const list=goalsGet();
        list[idx].done=!list[idx].done;
        goalsSave(list);
        render();
      });
    });

    /* Клик по строке — редактирование */
    content.querySelectorAll('.goals-item-edit').forEach(el=>{
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

    /* Добавить в категорию */
    content.querySelectorAll('.goals-add-item').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const cat=btn.dataset.cat;
        const s=btn.dataset.season;
        goalsOpenModal({cat,season:s==='all'?'all':s},result=>{
          if(!result)return;
          const list=goalsGet();
          list.push(result);
          goalsSave(list);
          render();
        });
      });
    });

    document.getElementById('goals-add-cat').addEventListener('click',()=>{
      goalsOpenModal({season:season==='all'?'all':season},result=>{
        if(!result)return;
        const list=goalsGet();
        list.push(result);
        goalsSave(list);
        render();
      });
    });
  }

  function render(){renderSeason(activeSeason);}
  render();
};
