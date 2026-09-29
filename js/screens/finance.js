/* ============================================================
   FINANCE SCREEN v2
   - Только приходы, без расходов
   - Профит = % к тому же периоду прошлого года
   - Выбор даты через date input
   - Цветные метки
   - Красивый дизайн
   ============================================================ */

window.Screens = window.Screens || {};

if (!window._finConsts) {
  window._finConsts = true;
  window.FIN_MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                      'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  window.FIN_MONTHS_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
  window.FIN_LABEL_COLORS = {
    '':       { hex: '#16A34A', name: 'Зелёный (осн.)' },
    'blue':   { hex: '#16A34A', name: 'Синий (другой источник)' },
    'purple': { hex: '#818CF8', name: 'Индиго' },
    'orange': { hex: '#F59E0B', name: 'Оранжевый' },
  };
}
var FIN_MONTHS = window.FIN_MONTHS;
var FIN_MONTHS_SHORT = window.FIN_MONTHS_SHORT;
var FIN_LABEL_COLORS = window.FIN_LABEL_COLORS;

function finEntries(year, month) {
  const mm = String(month+1).padStart(2,'0');
  return ((Store.get().finance||{}).years||{})[year] && (((Store.get().finance.years||{})[year]||{})[mm]||{}).entries || [];
}

function finSave(year, month, entries) {
  const mm = String(month+1).padStart(2,'0');
  Store.set(`finance.years.${year}.${mm}.entries`, entries);
}

function finSum(entries) {
  return entries.reduce((s,e) => s+(e.amount||0), 0);
}

function finFmt(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1).replace('.',',') + ' млн₽';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ') + '₽';
}

function finFmtFull(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ') + '₽';
}

function finPct(cur, prev) {
  if (!prev) return null;
  return Math.round((cur-prev)/prev*100);
}

function finPctBadge(pct, size) {
  if (pct===null) return '<span style="color:#555;">—</span>';
  const sign = pct>0?'+':'';
  const color = pct>0?'#A8C97F':pct<0?'#FF5C5C':'#9D9A92';
  const arrow = pct>0?'▲':pct<0?'▼':'';
  const fs = size||13;
  return `<span style="color:${color};font-size:${fs}px;font-weight:600;">${sign}${pct}% ${arrow}</span>`;
}

/* Дата из строки dd.mm.yyyy → Date */
function finParseDate(str) {
  if (!str || typeof str !== 'string') return new Date(0);
  const [d,m,y] = str.split('.');
  return new Date(+y,+m-1,+d);
}

/* Модалка добавления/редактирования */
function finOpenModal(existing, year, month, onSave) {
  const isEdit = !!existing;
  const now = new Date();
  const defaultDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  let existingDateISO = defaultDate;
  if (existing?.date) {
    const [d,m,y] = existing.date.split('.');
    existingDateISO = `${y}-${m}-${d}`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay modal-finance';
  overlay.innerHTML = `
    <div class="tr-modal">
      <p class="tr-modal-title" style="margin-bottom:16px;">${isEdit?'Редактировать приход':'Новый приход'}</p>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Сумма, ₽
          <input type="number" id="fin-amount" value="${existing?.amount||''}" inputmode="numeric" placeholder="0" style="font-size:18px;font-weight:600;">
        </label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Дата
          <input type="date" id="fin-date" value="${existingDateISO}">
        </label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Метка цвета
          <select id="fin-color" class="tr-color-select">
            ${Object.entries(FIN_LABEL_COLORS).map(([k,v])=>`
              <option value="${k}" ${(existing?.color||'')=== k?'selected':''}>${v.name}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="tr-modal-actions">
        ${isEdit?'<button class="tr-modal-btn-secondary" id="fin-del" style="color:#FF5C5C;">Удалить</button>':'<button class="tr-modal-btn-secondary" id="fin-cancel">Отмена</button>'}
        <button class="tr-modal-btn-primary" id="fin-save">Сохранить</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e=>{if(e.target===overlay)overlay.remove();});
  const cb=overlay.querySelector('#fin-cancel');
  if(cb)cb.addEventListener('click',()=>overlay.remove());
  const db=overlay.querySelector('#fin-del');
  if(db)db.addEventListener('click',()=>{onSave(null);overlay.remove();});

  overlay.querySelector('#fin-save').addEventListener('click',()=>{
    const amount = parseFloat(overlay.querySelector('#fin-amount').value)||0;
    if(!amount)return;
    const iso = overlay.querySelector('#fin-date').value; // yyyy-mm-dd
    const [y,m,d] = iso.split('-');
    const dateStr = `${d}.${m}.${y}`;
    const color = overlay.querySelector('#fin-color').value;
    onSave({id:existing?.id||'f_'+Date.now(), date:dateStr, amount, type:'income', color:color||undefined});
    overlay.remove();
  });
}

window.Screens.finance = function(mount) {
  const now = new Date();
  let vYear = now.getFullYear();
  let vMonth = now.getMonth();
  let activeTab = 'month';

  mount.innerHTML = `
    <div class="tochka-screen">
      <div class="tochka-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <button class="tochka-back-btn" id="fb"><i class="ti ti-arrow-left"></i></button>
          <p class="tochka-screen-title">Финансы</p>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="tochka-back-btn hidden-fin-owner" id="fin-theme" title="Светлые / тёмные финансы" style="display:none;"><i class="ti ti-sun"></i></button>
          <button class="tochka-back-btn" id="fl"><i class="ti ti-logout"></i></button>
        </div>
      </div>
      <div class="tochka-tabs" style="position:sticky;top:0;z-index:10;">
        <button class="tochka-tab active" data-tab="month">Месяц</button>
        <button class="tochka-tab" data-tab="expenses">Расходы</button>
        <button class="tochka-tab" data-tab="balance">Баланс</button>
        <button class="tochka-tab" data-tab="year">Год</button>
        <button class="tochka-tab" data-tab="all">Всё время</button>
      </div>
      <div class="tochka-body" id="fin-content"></div>
    </div>`;

  /* ── Тёмные финансы: у всех в тёмной теме; владелец может оставить светлые ── */
  function finIsOwner() {
    const u = window.FirebaseSync && FirebaseSync.currentUser ? FirebaseSync.currentUser() : null;
    const owner = (window.AUTH_CONFIG && AUTH_CONFIG.ownerEmail || '').toLowerCase();
    return !!(u && u.email && owner && u.email.toLowerCase() === owner);
  }
  function applyFinTheme() {
    const appDark = !window.Theme || Theme.get() !== 'light';
    const wantLight = finIsOwner() && (Store.get().finance || {}).lightScreen === true;
    /* Дизайн один и тот же. Светлые финансы = тот же тёмный дизайн, инвертированный по яркости */
    const inv = appDark && wantLight;
    const scr = mount.querySelector('.tochka-screen');
    if (scr) { scr.classList.add('fin-dark'); scr.classList.toggle('fin-inv', inv); }
    document.documentElement.classList.add('fin-dark-on');
    document.documentElement.classList.toggle('fin-inv-on', inv);
    const btn = document.getElementById('fin-theme');
    if (btn) {
      btn.style.display = finIsOwner() && appDark ? '' : 'none';
      btn.innerHTML = inv ? '<i class="ti ti-moon"></i>' : '<i class="ti ti-sun"></i>';
      btn.title = inv ? 'Сделать финансы тёмными' : 'Сделать финансы светлыми';
    }
  }
  applyFinTheme();
  document.getElementById('fin-theme').addEventListener('click', () => {
    Store.set('finance.lightScreen', !((Store.get().finance || {}).lightScreen === true));
    applyFinTheme();
  });

  document.getElementById('fb').addEventListener('click',()=>Router.go('/home'));
  document.getElementById('fl').addEventListener('click',()=>{Auth.logout();Router.go('/login');});
  /* Feature guard: tab styling */
  if (window.Features && !window.Features.isOn('finance_tabs_style')) {
    mount.querySelectorAll('.tochka-tab').forEach(function(t){
      t.style.fontSize='13px'; t.style.color='#6B7280'; t.style.fontWeight='600';
    });
  }
  mount.querySelectorAll('.tochka-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      mount.querySelectorAll('.tochka-tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      activeTab=btn.dataset.tab;
      render();
    });
  });

  const content = document.getElementById('fin-content');

  /* ═══ МЕСЯЦ ═══════════════════════════════════ */
  function renderMonth() {
    const entries = finEntries(vYear, vMonth);
    const prevEntries = finEntries(vYear-1, vMonth);
    const income = finSum(entries);
    const prevIncome = finSum(prevEntries);
    const pct = finPct(income, prevIncome||null);
    const isNow = vYear===now.getFullYear() && vMonth===now.getMonth();

    const sorted = [...entries].sort((a,b)=>finParseDate(a.date)-finParseDate(b.date));

    content.innerHTML = `
      <div class="tochka-hero">
        <div class="tochka-nav">
          <button id="fp" class="tochka-nav-btn"><i class="ti ti-chevron-left"></i></button>
          <span class="tochka-period">${FIN_MONTHS[vMonth]} ${vYear}</span>
          <button id="fn" class="tochka-nav-btn" ${isNow?'disabled':''}><i class="ti ti-chevron-right"></i></button>
        </div>
        <div class="tochka-hero-label">Доход за месяц</div>
        <div class="tochka-hero-amount">${finFmtFull(income)}</div>
        ${pct!==null
          ? `<div class="tochka-hero-pct ${pct>=0?'pos':'neg'}">${pct>0?'+':''}${pct}% ${pct>0?'▲':pct<0?'▼':'–'} к ${FIN_MONTHS_SHORT[vMonth]} ${vYear-1}</div>`
          : '<div class="tochka-hero-pct neu">Нет данных за прошлый год</div>'}
      </div>

      <div class="tochka-list">
        <div class="tochka-list-head">
          <span class="tochka-list-title">Приходы</span>
          <button id="fin-add" class="tochka-add-btn"><i class="ti ti-plus"></i> Добавить</button>
        </div>
        ${(()=>{
          if(!sorted.length) return '<div class="tochka-empty">Нет записей, добавь первую</div>';
          const grps={};sorted.forEach(e=>{if(!grps[e.date])grps[e.date]=[];grps[e.date].push(e);});
          return Object.entries(grps).map(([date,items])=>'<div class="tochka-date-group"><div class="tochka-date-label">'+date+'</div>'+items.map(e=>{const c=FIN_LABEL_COLORS[e.color||""]?.hex||"#1A9E6E";const i=entries.indexOf(e);return "<div class=\"tochka-row fin2-edit\" data-idx=\""+i+"\"><div class=\"tochka-row-left\"><div class=\"tochka-row-amount\" style=\"color:"+c+"\">+"+finFmtFull(e.amount)+"</div>"+(e.label?"<div class=\"tochka-row-label\">"+e.label+"</div>":"")+"</div><div class=\"tochka-row-icon\" style=\"background:"+c+"22;color:"+c+"\"><i class=\"ti ti-arrow-down-left\"></i></div></div>";}).join('')+'</div>').join('');
        })()}
      </div>`;

    document.getElementById('fin-add').addEventListener('click',()=>{
      finOpenModal(null,vYear,vMonth,result=>{
        if(!result)return;
        const list=finEntries(vYear,vMonth);
        list.push(result);
        finSave(vYear,vMonth,list);
        render();
      });
    });
    content.querySelectorAll('.fin2-edit').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const list=finEntries(vYear,vMonth);
        const idx=parseInt(btn.dataset.idx);
        finOpenModal(list[idx],vYear,vMonth,result=>{
          if(result===null)list.splice(idx,1);
          else list[idx]=result;
          finSave(vYear,vMonth,list);
          render();
        });
      });
    });
    document.getElementById('fp').addEventListener('click',()=>{vMonth--;if(vMonth<0){vMonth=11;vYear--;}render();});
    const fn=document.getElementById('fn');
    if(fn&&!fn.disabled)fn.addEventListener('click',()=>{vMonth++;if(vMonth>11){vMonth=0;vYear++;}render();});
  }

  /* ═══ ГОД ══════════════════════════════════════ */
  function renderYear() {
    const isNow = vYear===now.getFullYear();
    const curMonth = isNow ? now.getMonth() : 11;

    const months = Array.from({length:12},(_,m)=>{
      const inc = finSum(finEntries(vYear,m));
      const prev = finSum(finEntries(vYear-1,m));
      return {m, label:FIN_MONTHS[m], short:FIN_MONTHS_SHORT[m], income:inc, prev, pct:finPct(inc,prev||null)};
    });

    const yearIncome = months.reduce((s,m)=>s+m.income,0);
    const prevYearIncome = Array.from({length:12},(_,m)=>finSum(finEntries(vYear-1,m))).reduce((s,v)=>s+v,0);
    const yearPct = finPct(yearIncome, prevYearIncome||null);

    // Средняя зп: делим на кол-во прошедших месяцев с данными
    const passedMonths = months.filter((m,i)=>i<=curMonth && m.income>0);
    const avgIncome = passedMonths.length ? Math.round(yearIncome/passedMonths.length) : 0;

    content.innerHTML = `
      <div class="tochka-hero">
        <div class="tochka-nav">
          <button id="fy-p" class="tochka-nav-btn"><i class="ti ti-chevron-left"></i></button>
          <span class="tochka-period">${vYear}</span>
          <button id="fy-n" class="tochka-nav-btn" ${isNow?'disabled':''}><i class="ti ti-chevron-right"></i></button>
        </div>
        <div class="tochka-hero-label">Доход за год</div>
        <div class="tochka-hero-amount">${finFmtFull(yearIncome)}</div>
        ${yearPct!==null
          ? `<div class="tochka-hero-pct ${yearPct>=0?'pos':'neg'}">${yearPct>0?'+':''}${yearPct}% ${yearPct>0?'▲':yearPct<0?'▼':'–'} к ${vYear-1}</div>`
          : '<div class="tochka-hero-pct neu">Нет данных за прошлый год</div>'}
      </div>

      <div class="tochka-stats-row">
        <div class="tochka-stat">
          <div class="tochka-stat-label">Средняя / мес</div>
          <div class="tochka-stat-val">${finFmtFull(avgIncome)}</div>
          <div class="tochka-stat-sub">за ${passedMonths.length} мес.</div>
        </div>
        <div class="tochka-stat">
          <div class="tochka-stat-label">Лучший месяц</div>
          <div class="tochka-stat-val">${months.reduce((a,b)=>a.income>b.income?a:b).short}</div>
          <div class="tochka-stat-sub">${finFmt(Math.max(...months.map(m=>m.income)))}</div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;">
        ${months.filter(m=>m.income>0).map(m=>`
          <div class="fin2-year-card fin2-month-go" data-m="${m.m}">
            <div class="fin2-year-card-top">
              <span class="fin2-year-label">${m.label}</span>
              ${m.pct!==null ? `<span class="fin2-pct-badge ${m.pct>=0?'pos':'neg'}">${m.pct>0?'+':''}${m.pct}% ${m.pct>0?'▲':m.pct<0?'▼':'–'}</span>` : ''}
            </div>
            <div class="fin2-year-card-amount">${finFmtFull(m.income)}</div>
            ${m.pct!==null ? `<div class="fin2-year-card-bar"><div style="height:100%;width:${Math.min(100,Math.abs(m.pct)/2)}%;background:${m.pct>=0?'#C8A84B':'#FF5C5C'};border-radius:2px;transition:width 0.4s;"></div></div>` : ''}
          </div>`).join('')}
      </div>`;

    document.getElementById('fy-p').addEventListener('click',()=>{vYear--;render();});
    const fyn=document.getElementById('fy-n');
    if(fyn&&!fyn.disabled)fyn.addEventListener('click',()=>{vYear++;render();});
    content.querySelectorAll('.fin2-month-go').forEach(btn=>{
      btn.addEventListener('click',()=>{
        vMonth=parseInt(btn.dataset.m);
        activeTab='month';
        mount.querySelectorAll('.tochka-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab==='month'));
        render();
      });
    });
  }

  /* ═══ ВСЁ ВРЕМЯ ════════════════════════════════ */
  function renderAll() {
    const yearsData = Store.get().finance?.years||{};
    const years = Object.keys(yearsData).map(Number).sort((a,b)=>b-a);
    if(!years.length){content.innerHTML='<div class="fin2-empty">Нет данных</div>';return;}

    let grandTotal=0;
    const rows = years.map(y=>{
      const inc=Array.from({length:12},(_,m)=>finSum(finEntries(y,m))).reduce((s,v)=>s+v,0);
      const prev=Array.from({length:12},(_,m)=>finSum(finEntries(y-1,m))).reduce((s,v)=>s+v,0);
      grandTotal+=inc;
      return{year:y,income:inc,pct:finPct(inc,prev||null)};
    }).filter(r=>r.income>0);

    const activeYears = rows.length;
    const avgYear = activeYears ? Math.round(grandTotal/activeYears) : 0;

    content.innerHTML = `
      <div class="tochka-hero" style="text-align:center;">
        <div class="tochka-hero-label">За всё время</div>
        <div class="tochka-hero-amount">${finFmtFull(grandTotal)}</div>
        <div class="tochka-hero-pct neu">${activeYears} ${(n=>{const a=n%10,b=n%100;return a===1&&b!==11?'год':a>=2&&a<=4&&(b<12||b>14)?'года':'лет';})(activeYears)} · ср. ${finFmt(avgYear)}/год</div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;">
        ${rows.map(r=>`
          <div class="fin2-year-card fin2-year-go" data-y="${r.year}">
            <div class="fin2-year-card-top">
              <span class="fin2-year-label">${r.year}</span>
              ${r.pct!==null ? `<span class="fin2-pct-badge ${r.pct>=0?'pos':'neg'}">${r.pct>0?'+':''}${r.pct}% ${r.pct>0?'▲':r.pct<0?'▼':'–'}</span>` : ''}
            </div>
            <div class="fin2-year-card-amount">${finFmtFull(r.income)}</div>
            ${r.pct!==null ? `<div class="fin2-year-card-bar"><div style="height:100%;width:${Math.min(100,Math.abs(r.pct)/2)}%;background:${r.pct>=0?'#C8A84B':'#FF5C5C'};border-radius:2px;transition:width 0.4s;"></div></div>` : ''}
          </div>`).join('')}
      </div>`;

    content.querySelectorAll('.fin2-year-go').forEach(btn=>{
      btn.addEventListener('click',()=>{
        vYear=parseInt(btn.dataset.y);
        activeTab='year';
        mount.querySelectorAll('.tochka-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab==='year'));
        render();
      });
    });
  }

  /* ═══ БАЛАНС ══════════════════════════════════ */
  function renderBalance() {
    const now = new Date();
    const monthEntries = finEntries(now.getFullYear(), now.getMonth());
    const monthIncome = finSum(monthEntries);

    /* Настройки из Store */
    const stored = Store.get().finance?.balance || {};
    const GOAL_INCOME = stored.goalIncome || 291500;
    const SAVE_PCT = stored.savePct || 30;

    const DEFAULT_CATS = [
      /* Жильё */
      { id:'b1',  name:'Аренда / ипотека',          amt:30000, color:'#14B8A6' },
      { id:'b2',  name:'Коммунальные услуги',        amt:5000,  color:'#06B6D4' },
      /* Еда */
      { id:'b3',  name:'Продукты',                   amt:15000, color:'#10B981' },
      { id:'b4',  name:'Кафе и рестораны',           amt:8000,  color:'#34D399' },
      /* Транспорт */
      { id:'b5',  name:'Автомобиль (бензин, обсл.)', amt:8000,  color:'#6B7280' },
      { id:'b6',  name:'Такси / общественный транспорт', amt:3000, color:'#9CA3AF' },
      /* Здоровье */
      { id:'b7',  name:'Спорт / фитнес',             amt:5000,  color:'#16A34A' },
      { id:'b8',  name:'Медицина / аптека',           amt:3000,  color:'#F87171' },
      /* Развлечения */
      { id:'b9',  name:'Развлечения / хобби',         amt:5000,  color:'#F59E0B' },
      { id:'b10', name:'Подписки (стриминг, ПО)',     amt:2000,  color:'#8B5CF6' },
      /* Одежда и уход */
      { id:'b11', name:'Одежда и обувь',              amt:5000,  color:'#EC4899' },
      { id:'b12', name:'Красота / уход за собой',     amt:3000,  color:'#F472B6' },
      /* Связь */
      { id:'b13', name:'Телефон / интернет',          amt:1500,  color:'#60A5FA' },
      /* Прочее */
      { id:'b14', name:'Подарки',                     amt:3000,  color:'#FBBF24' },
      { id:'b15', name:'Непредвиденные расходы',      amt:5000,  color:'#EF4444' },
    ];
    const cats = stored.categories || DEFAULT_CATS;
    const totalBase = cats.reduce((s,c)=>s+(c.amt||0),0);

    /* Расчёт от реального дохода */
    const savingsAmt = Math.round(monthIncome * SAVE_PCT / 100);
    const afterSavings = monthIncome - savingsAmt;
    const freeAfterBase = afterSavings - totalBase;

    /* Цель: идеальный расклад */
    const goalSavings = Math.round(GOAL_INCOME * SAVE_PCT / 100);
    const goalForLife = GOAL_INCOME - goalSavings;

    /* Раскладка дохода: копилка / базовые / свободно */
    const inc = monthIncome || 0;
    const pctOf = (v) => inc > 0 ? Math.max(0, Math.round(v / inc * 100)) : 0;
    const freeAmt = Math.max(0, freeAfterBase);
    const shortAmt = freeAfterBase < 0 ? -freeAfterBase : 0;
    const segs = inc > 0
      ? [{ w: savingsAmt, c: '#16A34A' }].concat(cats.map(c => ({ w: c.amt || 0, c: c.color || '#9CA3AF' }))).concat([{ w: freeAmt, c: '#CBD5E1' }])
      : [];
    const segTotal = segs.reduce((s, x) => s + x.w, 0) || 1;
    const monthName = FIN_MONTHS[now.getMonth()];

    content.innerHTML = `
      <!-- Копилка -->
      <div class="pg-wrap">${window.FinPiggy ? FinPiggy.html(SAVE_PCT) : ''}</div>

      <!-- Как распределить доход -->
      <div class="plan-card">
        <div class="plan-head">
          <div>
            <div class="plan-title">Как распределить доход</div>
            <div class="plan-sub">${inc > 0 ? 'План на ' + monthName.toLowerCase() : 'В этом месяце доходов пока нет'}</div>
          </div>
          <button class="plan-gear" id="bal2-edit" aria-label="Настроить расходы"><i class="ti ti-adjustments-horizontal"></i></button>
        </div>

        ${inc > 0 ? `<div class="plan-bar">${segs.filter(x => x.w > 0).map(x => `<span style="flex:${x.w / segTotal};background:${x.c};"></span>`).join('')}</div>` : ''}

        ${!stored.categories ? `
        <div class="plan-demo">
          <i class="ti ti-bulb"></i>
          <div>
            <div class="plan-demo-title">Это пример бюджета</div>
            <div class="plan-demo-txt">Категории и суммы стоят для ориентира. Поменяй под свои расходы.</div>
            <div class="plan-demo-btns">
              <button id="fin-edit-demo-cats">Настроить</button>
              <button id="fin-clear-demo-cats" class="danger">Начать с нуля</button>
            </div>
          </div>
        </div>` : ''}

        <div class="plan-step">
          <div class="plan-ico" style="--c:#16A34A;"><i class="ti ti-pig-money"></i></div>
          <div class="plan-main">
            <div class="plan-name">Сразу в копилку</div>
            <div class="plan-desc">${SAVE_PCT}% с каждого поступления, без исключений</div>
          </div>
          <div class="plan-val"><b style="color:#16A34A;">${finFmtFull(savingsAmt)}</b><span>${SAVE_PCT}%</span></div>
        </div>

        <div class="plan-step plan-step-open">
          <div class="plan-ico" style="--c:#6366F1;"><i class="ti ti-home-dollar"></i></div>
          <div class="plan-main">
            <div class="plan-name">Базовые расходы</div>
            <div class="plan-desc">Оплачиваются в первую очередь</div>
          </div>
          <div class="plan-val"><b>${finFmtFull(totalBase)}</b><span>${pctOf(totalBase)}%</span></div>
        </div>
        <div class="plan-cats">
          ${cats.length ? cats.map(c => `
            <div class="plan-cat">
              <span class="plan-dot" style="background:${c.color || '#9CA3AF'};"></span>
              <span class="plan-cat-name">${c.name}</span>
              <span class="plan-cat-amt">${finFmtFull(c.amt || 0)}</span>
              <span class="plan-cat-pct">${pctOf(c.amt || 0)}%</span>
            </div>`).join('') : '<div class="plan-empty">Категорий нет. Добавь их в настройках</div>'}
        </div>

        <div class="plan-step">
          <div class="plan-ico" style="--c:${shortAmt ? '#DC2626' : '#0EA5E9'};"><i class="ti ${shortAmt ? 'ti-alert-triangle' : 'ti-target-arrow'}"></i></div>
          <div class="plan-main">
            <div class="plan-name">${shortAmt ? 'Не хватает на базу' : 'Свободно на цели'}</div>
            <div class="plan-desc">${shortAmt ? 'Доход меньше, чем копилка и базовые расходы' : 'Цели, желания, удовольствия'}</div>
          </div>
          <div class="plan-val"><b style="color:${shortAmt ? '#DC2626' : '#0EA5E9'};">${finFmtFull(shortAmt || freeAmt)}</b><span>${shortAmt ? '' : pctOf(freeAmt) + '%'}</span></div>
        </div>

        <div class="plan-step plan-step-last">
          <div class="plan-ico" style="--c:#F59E0B;"><i class="ti ti-umbrella"></i></div>
          <div class="plan-main">
            <div class="plan-name">Внеплановая трата</div>
            <div class="plan-desc">Берёшь из копилки, а не из свободного остатка</div>
          </div>
        </div>
      </div>
    `;

    if (window.FinPiggy) FinPiggy.bind(content, SAVE_PCT, renderBalance);
    document.getElementById('bal2-edit').addEventListener('click', ()=>{
      openBudgetEdit();
    });
    const demoCatsBtn = document.getElementById('fin-edit-demo-cats');
    if (demoCatsBtn) demoCatsBtn.addEventListener('click', () => openBudgetEdit());
    const clearDemoCatsBtn = document.getElementById('fin-clear-demo-cats');
    if (clearDemoCatsBtn) clearDemoCatsBtn.addEventListener('click', () => {
      if (!confirm('Удалить все демо-категории и начать с нуля?')) return;
      Store.set('finance.balance', { categories: [], goalIncome: GOAL_INCOME, savePct: SAVE_PCT });
      renderBalance();
    });

    function openBudgetEdit() {
      const ov = document.createElement('div');
      ov.className = 'tr-modal-overlay modal-finance';
      ov.innerHTML = `<div class="tr-modal" style="max-height:85vh;overflow-y:auto;">
        <p class="tr-modal-title">Настройки баланса</p>
        <div class="tr-modal-row">
          <label style="flex:1">Цель дохода, ₽<input type="number" id="bi-goal" value="${GOAL_INCOME}" inputmode="numeric"></label>
          <label style="width:80px;">Копилка %<input type="number" id="bi-pct" value="${SAVE_PCT}" min="0" max="100" inputmode="numeric"></label>
        </div>
        <p style="font-size:12px;color:#9CA3AF;margin:12px 0 6px;">Базовые расходы:</p>
        <div id="bi-cats-list">
        ${cats.map((c,i)=>`
          <div class="tr-modal-row" style="gap:8px;align-items:flex-end;">
            <label style="flex:1;">Категория<input type="text" class="bi-name" data-i="${i}" value="${c.name}"></label>
            <label style="width:110px;">Сумма, ₽<input type="number" class="bi-amt" data-i="${i}" value="${c.amt}" inputmode="numeric"></label>
            <button class="bi-del-cat" data-i="${i}" style="background:none;border:none;color:#EF4444;cursor:pointer;font-size:16px;padding:0 4px;margin-bottom:2px;">✕</button>
          </div>`).join('')}
        </div>
        <button id="bi-add-cat" style="background:none;border:1px dashed #D1D5DB;border-radius:8px;width:100%;padding:8px;color:#9CA3AF;cursor:pointer;margin-bottom:8px;">+ Добавить категорию</button>
        <div class="tr-modal-actions">
          <button class="tr-modal-btn-secondary" id="bi-cancel">Отмена</button>
          <button class="tr-modal-btn-primary" id="bi-save">Сохранить</button>
        </div>
      </div>`;
      document.body.appendChild(ov);
      ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
      ov.querySelector('#bi-cancel').addEventListener('click',()=>ov.remove());

      /* Удалить категорию */
      ov.addEventListener('click', e=>{
        if(e.target.classList.contains('bi-del-cat')){
          const i = parseInt(e.target.dataset.i);
          cats.splice(i,1);
          // Перерисовываем список
          const list = ov.querySelector('#bi-cats-list');
          list.querySelectorAll('.tr-modal-row').forEach((r,idx)=>{
            r.querySelectorAll('[data-i]').forEach(el=>el.dataset.i=idx);
          });
          e.target.closest('.tr-modal-row').remove();
        }
      });

      /* Добавить категорию */
      ov.querySelector('#bi-add-cat').addEventListener('click',()=>{
        cats.push({id:'b_'+Date.now(),name:'Новая категория',amt:0,color:'#9CA3AF'});
        const i = cats.length-1;
        const row = document.createElement('div');
        row.className = 'tr-modal-row';
        row.style.cssText = 'gap:8px;align-items:flex-end;';
        row.innerHTML = '<label style="flex:1;">Категория<input type="text" class="bi-name" data-i="'+i+'" value="Новая категория"></label>'
          +'<label style="width:110px;">Сумма, ₽<input type="number" class="bi-amt" data-i="'+i+'" value="0" inputmode="numeric"></label>'
          +'<button class="bi-del-cat" data-i="'+i+'" style="background:none;border:none;color:#EF4444;cursor:pointer;font-size:16px;padding:0 4px;margin-bottom:2px;">✕</button>';
        ov.querySelector('#bi-cats-list').appendChild(row);
      });
      ov.querySelector('#bi-save').addEventListener('click',()=>{
        ov.querySelectorAll('.bi-name').forEach(inp=>{ cats[+inp.dataset.i].name=inp.value.trim()||cats[+inp.dataset.i].name; });
        ov.querySelectorAll('.bi-amt').forEach(inp=>{ cats[+inp.dataset.i].amt=parseFloat(inp.value)||0; });
        const newGoal = parseFloat(ov.querySelector('#bi-goal').value)||GOAL_INCOME;
        const newPct = parseFloat(ov.querySelector('#bi-pct').value)||SAVE_PCT;
        Store.set('finance.balance', {categories:cats, goalIncome:newGoal, savePct:newPct});
        ov.remove();
        renderBalance();
      });
  } // end openBudgetEdit
  } // end renderBalance — раньше эта скобка отсутствовала, и render() оказывался внутри renderBalance → пустой экран


  /* ═══ РАСХОДЫ — хелперы ════════════════════════ */
  function expGetList() { return Store.get().finance?.expensesList || []; }
  function expSaveList(list) { Store.set('finance.expensesList', list.filter(Boolean)); }

  function expOpenModal(item, side, cb) {
    var isEdit = !!item;
    var isExpense = side === 'expense' || !side;
    var isSrc = side === 'source';
    var ov = document.createElement('div');
    ov.className = 'tr-modal-overlay modal-finance';
    var title = isSrc ? 'Потенциал' : isEdit ? 'Редактировать расход' : 'Новый расход';
    ov.innerHTML = '<div class="tr-modal">'
      + '<p class="tr-modal-title">'+title+'</p>'
      + (isSrc
        ? '<div class="tr-modal-row"><label style="flex:1 1 100%">Источник<input type="text" id="em-src" value="'+(item&&item.source||'')+'" placeholder="Клиент, проект…"></label></div>'
        + '<div class="tr-modal-row"><label style="flex:1 1 100%">Сумма потенциала, ₽<input type="number" id="em-srca" value="'+(item&&item.sourceAmt||'')+'" inputmode="numeric" placeholder="0"></label></div>'
        : '<div class="tr-modal-row"><label style="flex:1 1 100%">Вид расхода<input type="text" id="em-name" value="'+(item&&item.name||'')+'" placeholder="Название"></label></div>'
        + '<div class="tr-modal-row"><label style="flex:1 1 100%">Сумма, ₽<input type="number" id="em-amt" value="'+(item&&item.amount||'')+'" inputmode="numeric" placeholder="0"></label></div>')
      + '<div class="tr-modal-actions">'
      + (isEdit ? '<button class="tr-modal-btn-secondary" id="em-del" style="color:#EF4444;">Удалить</button>' : '<button class="tr-modal-btn-secondary" id="em-cancel">Отмена</button>')
      + '<button class="tr-modal-btn-primary" id="em-save">Сохранить</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){if(e.target===ov)ov.remove();});
    var cancBtn = ov.querySelector('#em-cancel'); if(cancBtn) cancBtn.addEventListener('click',function(){ov.remove();});
    var delBtn = ov.querySelector('#em-del'); if(delBtn) delBtn.addEventListener('click',function(){cb(null);ov.remove();});
    ov.querySelector('#em-save').addEventListener('click', function(){
      var base = item ? Object.assign({},item) : {id:'e_'+Date.now()};
      if(isSrc){
        var s = ov.querySelector('#em-src'); if(s) base.source = s.value.trim();
        var sa = ov.querySelector('#em-srca'); if(sa) base.sourceAmt = parseFloat(sa.value)||0;
      } else {
        var n = (ov.querySelector('#em-name')||{}).value||''; n=n.trim();
        if(!n) return;
        base.name = n;
        var a = ov.querySelector('#em-amt'); if(a) base.amount = parseFloat(a.value)||0;
      }
      cb(base); ov.remove();
    });
  }

  function renderExpenses() {
    var list = expGetList();
    var expTotal = list.reduce(function(s,e){return s+(e.amount||0);},0);
    var srcTotal = list.reduce(function(s,e){return s+(e.sourceAmt||0);},0);
    var balance = srcTotal - expTotal;

    var rows = list.map(function(e,i){
      return '<tr data-idx="'+i+'">'
        + '<td class="xp-drag exp-drag-l" data-idx="'+i+'" draggable="true"><i class="ti ti-grip-vertical"></i></td>'
        + '<td class="exp-cl xp-name" data-idx="'+i+'" data-side="expense">'+(e.name||'')+'</td>'
        + '<td class="exp-cl xp-amt xp-red" data-idx="'+i+'" data-side="expense">'+(e.amount?finFmtFull(e.amount):'')+'</td>'
        + '<td class="xp-sep"></td>'
        + '<td class="xp-drag exp-drag-r" data-idx="'+i+'" draggable="true"><i class="ti ti-grip-vertical"></i></td>'
        + '<td class="exp-cr xp-name xp-green" data-idx="'+i+'" data-side="source">'+(e.source||'')+'</td>'
        + '<td class="exp-cr xp-amt xp-green" data-idx="'+i+'" data-side="source">'+(e.sourceAmt?finFmtFull(e.sourceAmt):'')+'</td>'
        + '</tr>';
    }).join('');
    var pos = balance >= 0;

    content.innerHTML = '<div class="xp-card">'
      + '<div class="xp-head">'
      +   '<div><div class="xp-title">Ближайшие расходы</div><div class="xp-sub">Что предстоит оплатить и откуда закрыть</div></div>'
      +   '<div class="xp-btns">'
      +     '<button id="exp-add-l" class="xp-btn xp-btn-red"><i class="ti ti-plus"></i> Расход</button>'
      +     '<button id="exp-add-r" class="xp-btn xp-btn-green"><i class="ti ti-plus"></i> Потенциал</button>'
      +   '</div>'
      + '</div>'
      + '<div class="xp-sum">'
      +   '<div class="xp-sum-cell"><span>Расходы</span><b class="xp-red">'+finFmtFull(expTotal)+'</b></div>'
      +   '<div class="xp-sum-cell"><span>Потенциал</span><b class="xp-green">'+finFmtFull(srcTotal)+'</b></div>'
      +   '<div class="xp-sum-cell"><span>'+(pos?'Профит':'Дефицит')+'</span><b class="'+(pos?'xp-green':'xp-red')+'">'+(pos?'+':'')+finFmtFull(balance)+'</b></div>'
      + '</div>'
      + '<div class="xp-scroll">'
      + '<table class="xp-table">'
      + '<colgroup><col style="width:24px"><col><col style="width:110px"><col style="width:1px"><col style="width:24px"><col><col style="width:110px"></colgroup>'
      + '<thead><tr><th></th><th>Расход</th><th class="r">Сумма</th><th class="xp-sep"></th><th></th><th>Потенциал</th><th class="r">Сумма</th></tr></thead>'
      + '<tbody id="exp-body">'+(rows || '<tr class="xp-empty-row"><td colspan="7">Пока пусто. Добавь первый расход</td></tr>')+'</tbody>'
      + '<tfoot><tr><td></td><td>Итого</td><td class="r xp-red">'+finFmtFull(expTotal)+'</td><td class="xp-sep"></td><td></td>'
      +   '<td class="'+(pos?'xp-green':'xp-red')+'">'+(pos?'Профит':'Дефицит')+'</td>'
      +   '<td class="r '+(pos?'xp-green':'xp-red')+'">'+(pos?'+':'')+finFmtFull(balance)+'</td></tr></tfoot>'
      + '</table></div></div>';

    document.getElementById('exp-add-l').addEventListener('click',function(){
      expOpenModal(null,'expense',function(r){if(!r)return;var l=expGetList();l.push(r);expSaveList(l);renderExpenses();});
    });
    document.getElementById('exp-add-r').addEventListener('click',function(){
      var l=expGetList();
      if(!l.length){alert('Сначала добавь расход');return;}
      var i=l.findIndex(function(e){return !e.sourceAmt;});if(i<0)i=0;
      expOpenModal(Object.assign({},l[i]),'source',function(r){if(r!==null){l[i]=r;expSaveList(l);renderExpenses();}});
    });
    content.querySelectorAll('.exp-cl').forEach(function(el){
      el.addEventListener('click',function(){
        var i=parseInt(el.dataset.idx);var l=expGetList();
        expOpenModal(Object.assign({},l[i]),'expense',function(r){
          if(r===null)l.splice(i,1);else l[i]=r;expSaveList(l);renderExpenses();
        });
      });
    });
    content.querySelectorAll('.exp-cr').forEach(function(el){
      el.addEventListener('click',function(){
        var i=parseInt(el.dataset.idx);var l=expGetList();
        expOpenModal(Object.assign({},l[i]),'source',function(r){if(r!==null){l[i]=r;expSaveList(l);renderExpenses();}});
      });
    });

    /* Drag: LEFT reorders name/amount, RIGHT reorders source/sourceAmt — independently */
    var dragIdxL = null, dragIdxR = null;
    var tbody = document.getElementById('exp-body');

    content.querySelectorAll('.exp-drag-l').forEach(function(td){
      td.addEventListener('dragstart', function(e){
        dragIdxL = parseInt(td.dataset.idx); dragIdxR = null;
        e.dataTransfer.effectAllowed = 'move';
        tbody.querySelectorAll('tr').forEach(function(r){r.style.opacity = r.dataset.idx==dragIdxL?'0.4':'1';});
      });
    });
    if (window.Features && window.Features.isOn('finance_drag_columns')) {
    content.querySelectorAll('.exp-drag-r').forEach(function(td){
      td.addEventListener('dragstart', function(e){
        dragIdxR = parseInt(td.dataset.idx); dragIdxL = null;
        e.dataTransfer.effectAllowed = 'move';
        tbody.querySelectorAll('tr').forEach(function(r){r.style.opacity = r.dataset.idx==dragIdxR?'0.4':'1';});
      });
    });

    if (tbody) {
      tbody.querySelectorAll('tr').forEach(function(row){
        row.addEventListener('dragend', function(){
          tbody.querySelectorAll('tr').forEach(function(r){r.style.opacity='';r.classList.remove('xp-over-g','xp-over-r');});
          dragIdxL = null; dragIdxR = null;
        });
        row.addEventListener('dragover', function(e){
          e.preventDefault();
          tbody.querySelectorAll('tr').forEach(function(r){r.classList.remove('xp-over-g','xp-over-r');});
          row.classList.add(dragIdxR !== null ? 'xp-over-g' : 'xp-over-r');
        });
        row.addEventListener('drop', function(e){
          e.preventDefault();
          var tgt = parseInt(row.dataset.idx);
          var l = expGetList();
          if (dragIdxL !== null && dragIdxL !== tgt) {
            /* Shift only name+amount fields */
            var src = dragIdxL;
            var tmp = {name:l[src].name, amount:l[src].amount};
            var dir = src < tgt ? 1 : -1;
            for (var i=src; i!==tgt; i+=dir) {
              l[i].name=l[i+dir].name; l[i].amount=l[i+dir].amount;
            }
            l[tgt].name=tmp.name; l[tgt].amount=tmp.amount;
            expSaveList(l); renderExpenses();
          } else if (dragIdxR !== null && dragIdxR !== tgt) {
            /* Shift only source+sourceAmt fields */
            var src = dragIdxR;
            var tmp = {source:l[src].source, sourceAmt:l[src].sourceAmt};
            var dir = src < tgt ? 1 : -1;
            for (var i=src; i!==tgt; i+=dir) {
              l[i].source=l[i+dir].source; l[i].sourceAmt=l[i+dir].sourceAmt;
            }
            l[tgt].source=tmp.source; l[tgt].sourceAmt=tmp.sourceAmt;
            expSaveList(l); renderExpenses();
          }
        });
      });
    }
    } // end feature:finance_drag_columns
  }

  function render(){
    if(activeTab==='month')renderMonth();
    else if(activeTab==='expenses')renderExpenses();
    else if(activeTab==='balance')renderBalance();
    else if(activeTab==='year')renderYear();
    else renderAll();
  }
  render();
}; // window.Screens.finance end
