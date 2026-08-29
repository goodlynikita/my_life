/* ============================================================
   FINANCE SCREEN v2
   - Только приходы, без расходов
   - Профит = % к тому же периоду прошлого года
   - Выбор даты через date input
   - Цветные метки
   - Красивый дизайн
   ============================================================ */

window.Screens = window.Screens || {};

const FIN_MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                    'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const FIN_MONTHS_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

const FIN_LABEL_COLORS = {
  '':       { hex: '#16A34A', name: 'Зелёный (осн.)' },
  'blue':   { hex: '#16A34A', name: 'Синий (другой источник)' },
  'purple': { hex: '#9333EA', name: 'Фиолетовый' },
  'orange': { hex: '#F59E0B', name: 'Оранжевый' },
};

function finEntries(year, month) {
  const mm = String(month+1).padStart(2,'0');
  return Store.get().finance?.years?.[year]?.[mm]?.entries || [];
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
  overlay.className = 'tr-modal-overlay';
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
        <button class="tochka-back-btn" id="fl"><i class="ti ti-logout"></i></button>
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

  document.getElementById('fb').addEventListener('click',()=>Router.go('/home'));
  document.getElementById('fl').addEventListener('click',()=>{Auth.logout();Router.go('/login');});
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
          if(!sorted.length) return '<div class="tochka-empty">Нет записей — добавьте первую</div>';
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
        <div class="tochka-hero-pct neu">${activeYears} лет · ср. ${finFmt(avgYear)}/год</div>
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
      { id:'b1', name:'КВ',                    amt:24000, color:'#7C3AED' },
      { id:'b2', name:'Еда: продукты + рестораны', amt:30000, color:'#0EA5E9' },
      { id:'b3', name:'Зал + спортпит + тренер',  amt:15500, color:'#16A34A' },
      { id:'b4', name:'Подписки, работа',          amt:10000, color:'#F59E0B' },
      { id:'b5', name:'Всякое разное',             amt:10000, color:'#EF4444' },
      { id:'b6', name:'Машина',                    amt:5000,  color:'#6B7280' },
      { id:'b7', name:'Стрижка',                   amt:2500,  color:'#EC4899' },
      { id:'b8', name:'Стоматолог',                amt:6000,  color:'#14B8A6' },
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

    content.innerHTML = `
      <!-- Hero: доход и копилка -->
      <div class="bal2-hero">
        <div class="bal2-hero-row">
          <div>
            <div class="bal2-label">ДОХОД МЕСЯЦА</div>
            <div class="bal2-income">${finFmtFull(monthIncome || 0)}</div>
            <div class="bal2-goal-line">Цель: ${finFmtFull(GOAL_INCOME)}/мес</div>
          </div>
          <div style="text-align:right;">
            <div class="bal2-label">В КОПИЛКУ (${SAVE_PCT}%)</div>
            <div class="bal2-savings">${finFmtFull(savingsAmt)}</div>
            <div class="bal2-goal-line">Цель: ${finFmtFull(goalSavings)}</div>
          </div>
        </div>
        <div class="bal2-progress-track">
          <div class="bal2-progress-fill" style="width:${Math.min(100,Math.round(monthIncome/GOAL_INCOME*100))}%;"></div>
        </div>
        <div class="bal2-progress-labels">
          <span>На жизнь: ${finFmtFull(afterSavings)}</span>
          <span>${Math.min(100,Math.round(monthIncome/GOAL_INCOME*100))}% от цели</span>
        </div>
      </div>

      <!-- Система управления -->
      <div class="bal2-system">
        <div class="bal2-system-title">📋 Система управления деньгами</div>

        <div class="bal2-rule">
          <div class="bal2-rule-num">1</div>
          <div>
            <div class="bal2-rule-title">Сразу в копилку — ${SAVE_PCT}%</div>
            <div class="bal2-rule-desc">Любой приход → сразу ${finFmtFull(savingsAmt)} в копилку. Без исключений.</div>
          </div>
        </div>

        <div class="bal2-rule">
          <div class="bal2-rule-num">2</div>
          <div>
            <div class="bal2-rule-title">Приоритет базовых расходов</div>
            <div class="bal2-rule-desc">Оставшиеся ${finFmtFull(afterSavings)} трать в таком порядке:</div>
          </div>
        </div>

        <!-- Таблица расходов -->
        <div class="bal2-cats-table">
          <div class="bal2-cats-head">
            <span>Вид расхода</span>
            <span>Сумма</span>
            <span>% от дохода</span>
          </div>
          ${cats.map(c=>`
            <div class="bal2-cat-row">
              <div class="bal2-cat-dot-name">
                <div class="bal2-cat-dot" style="background:${c.color};"></div>
                <span class="bal2-cat-name">${c.name}</span>
              </div>
              <span class="bal2-cat-amt">${finFmtFull(c.amt)}</span>
              <span class="bal2-cat-pct" style="color:${c.color};">${monthIncome>0?Math.round(c.amt/monthIncome*100):0}%</span>
            </div>`).join('')}
          <div class="bal2-cat-total">
            <span>Итого базовые</span>
            <span>${finFmtFull(totalBase)}</span>
            <span>${monthIncome>0?Math.round(totalBase/monthIncome*100):0}%</span>
          </div>
        </div>

        <div class="bal2-rule">
          <div class="bal2-rule-num">3</div>
          <div>
            <div class="bal2-rule-title">Свободные деньги → цели</div>
            <div class="bal2-free ${freeAfterBase>=0?'pos':'neg'}">
              ${freeAfterBase>=0
                ? `<span>${finFmtFull(freeAfterBase)}</span><span class="bal2-free-label"> — на цели и желания</span>`
                : `<span>${finFmtFull(Math.abs(freeAfterBase))}</span><span class="bal2-free-label"> — не хватает на базу</span>`}
            </div>
          </div>
        </div>

        <div class="bal2-rule">
          <div class="bal2-rule-num">4</div>
          <div>
            <div class="bal2-rule-title">Внеплановые расходы</div>
            <div class="bal2-rule-desc">Неожиданная трата → берёшь из копилки, не из текущего остатка.</div>
          </div>
        </div>
      </div>

      <button id="bal2-edit" class="bal2-edit-btn">
        <i class="ti ti-settings"></i> Настроить расходы и цель
      </button>
    `;

    document.getElementById('bal2-edit').addEventListener('click', ()=>{
      const ov = document.createElement('div');
      ov.className = 'tr-modal-overlay';
      ov.innerHTML = `<div class="tr-modal" style="max-height:85vh;overflow-y:auto;">
        <p class="tr-modal-title">Настройки баланса</p>
        <div class="tr-modal-row">
          <label style="flex:1">Цель дохода, ₽<input type="number" id="bi-goal" value="${GOAL_INCOME}" inputmode="numeric"></label>
          <label style="width:80px;">Копилка %<input type="number" id="bi-pct" value="${SAVE_PCT}" min="0" max="100" inputmode="numeric"></label>
        </div>
        <p style="font-size:12px;color:#9CA3AF;margin:12px 0 6px;">Базовые расходы:</p>
        ${cats.map((c,i)=>`
          <div class="tr-modal-row" style="gap:8px;align-items:flex-end;">
            <label style="flex:1;">Категория<input type="text" class="bi-name" data-i="${i}" value="${c.name}"></label>
            <label style="width:110px;">Сумма, ₽<input type="number" class="bi-amt" data-i="${i}" value="${c.amt}" inputmode="numeric"></label>
          </div>`).join('')}
        <div class="tr-modal-actions">
          <button class="tr-modal-btn-secondary" id="bi-cancel">Отмена</button>
          <button class="tr-modal-btn-primary" id="bi-save">Сохранить</button>
        </div>
      </div>`;
      document.body.appendChild(ov);
      ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
      ov.querySelector('#bi-cancel').addEventListener('click',()=>ov.remove());
      ov.querySelector('#bi-save').addEventListener('click',()=>{
        ov.querySelectorAll('.bi-name').forEach(inp=>{ cats[+inp.dataset.i].name=inp.value.trim()||cats[+inp.dataset.i].name; });
        ov.querySelectorAll('.bi-amt').forEach(inp=>{ cats[+inp.dataset.i].amt=parseFloat(inp.value)||0; });
        const newGoal = parseFloat(ov.querySelector('#bi-goal').value)||GOAL_INCOME;
        const newPct = parseFloat(ov.querySelector('#bi-pct').value)||SAVE_PCT;
        Store.set('finance.balance', {categories:cats, goalIncome:newGoal, savePct:newPct});
        ov.remove();
        renderBalance();
      });
    });
  }

  function renderExpenses() {
    var list = expGetList();
    var expTotal = list.reduce(function(s,e){return s+(e.amount||0);},0);
    var srcTotal = list.reduce(function(s,e){return s+(e.sourceAmt||0);},0);
    var balance = srcTotal - expTotal;

    /* Начальные данные из скриншота если список пустой */
    if (list.length === 0) {
      list = [
        {id:'e1',name:'Зубы',amount:24000,sourceAmt:90000,source:''},
        {id:'e2',name:'Брекеты',amount:40000,sourceAmt:70000,source:''},
        {id:'e3',name:'Кроссы',amount:11000,sourceAmt:30000,source:''},
        {id:'e4',name:'Ракетка',amount:15000,sourceAmt:0,source:''},
        {id:'e5',name:'Карплей',amount:24000,sourceAmt:0,source:''},
        {id:'e6',name:'Тонер',amount:8500,sourceAmt:0,source:''},
        {id:'e7',name:'Кожа',amount:10000,sourceAmt:0,source:''},
        {id:'e8',name:'Пластик',amount:2500,sourceAmt:0,source:''},
        {id:'e9',name:'Мелочь',amount:10000,sourceAmt:0,source:''},
        {id:'e10',name:'Неприкосаемые',amount:40000,sourceAmt:0,source:''},
      ];
      expSaveList(list);
      expTotal = list.reduce(function(s,e){return s+(e.amount||0);},0);
      srcTotal = list.reduce(function(s,e){return s+(e.sourceAmt||0);},0);
      balance = srcTotal - expTotal;
    }

    var rowsHtml = list.map(function(e,i){
      return '<tr class="exp2-row" data-idx="'+i+'">'
        + '<td class="exp2-name exp2-left" data-idx="'+i+'" data-side="expense">'+e.name+'</td>'
        + '<td class="exp2-amt exp2-left" data-idx="'+i+'" data-side="expense">'+(e.amount?finFmtFull(e.amount):'')+'</td>'
        + '<td class="exp2-src exp2-right" data-idx="'+i+'" data-side="source">'+(e.sourceAmt?finFmtFull(e.sourceAmt):'')+'</td>'
        + '<td class="exp2-drag" draggable="true"><i class="ti ti-grip-vertical"></i></td>'
        + '</tr>';
    }).join('');

    content.innerHTML = '<div class="exp2-wrap">'
      + '<div class="exp2-header-bar">'
      +   '<span class="exp2-header-title">Ближайшие расходы</span>'
      +   '<button id="exp-add-btn" class="tochka-add-btn"><i class="ti ti-plus"></i> Добавить</button>'
      + '</div>'
      + '<table class="exp2-table">'
      +   '<thead><tr>'
      +     '<th class="exp2-th-name">Вид расхода</th>'
      +     '<th class="exp2-th-amt">Сумма</th>'
      +     '<th class="exp2-th-src">Потенциал</th>'
      +     '<th style="width:32px;"></th>'
      +   '</tr></thead>'
      +   '<tbody id="exp2-body">'+rowsHtml+'</tbody>'
      +   '<tfoot>'
      +     '<tr class="exp2-total">'
      +       '<td><strong>Итого</strong></td>'
      +       '<td><strong style="color:#EF4444;">'+finFmtFull(expTotal)+'</strong></td>'
      +       '<td><strong style="color:'+( balance>0?'#16A34A':balance<0?'#EF4444':'#6B7280' )+';">'+(balance>0?'+':'')+finFmtFull(balance)+'</strong></td>'
      +       '<td><span style="font-size:10px;color:#9CA3AF;">остаток</span></td>'
      +     '</tr>'
      +   '</tfoot>'
      + '</table>'
      + '</div>';

    /* Добавить */
    document.getElementById('exp-add-btn').addEventListener('click', function(){
      expOpenModal(null, null, function(r){
        if(!r) return;
        var l=expGetList(); l.push(r); expSaveList(l); renderExpenses();
      });
    });

    /* Клик по левой половине строки — расход */
    content.querySelectorAll('.exp2-left').forEach(function(el){
      el.addEventListener('click', function(){
        var idx=parseInt(el.dataset.idx);
        var l=expGetList();
        expOpenModal(Object.assign({},l[idx]), 'expense', function(r){
          if(r===null) l.splice(idx,1); else l[idx]=r;
          expSaveList(l); renderExpenses();
        });
      });
    });

    /* Клик по правой — потенциал/источник */
    content.querySelectorAll('.exp2-right').forEach(function(el){
      el.addEventListener('click', function(){
        var idx=parseInt(el.dataset.idx);
        var l=expGetList();
        expOpenModal(Object.assign({},l[idx]), 'source', function(r){
          if(r!==null) l[idx]=r;
          expSaveList(l); renderExpenses();
        });
      });
    });

    /* Drag-and-drop */
    var tbody = document.getElementById('exp2-body');
    var dragIdx = null;
    tbody.querySelectorAll('.exp2-row').forEach(function(row){
      row.addEventListener('dragstart', function(){ dragIdx=parseInt(row.dataset.idx); row.style.opacity='0.4'; });
      row.addEventListener('dragend', function(){ row.style.opacity=''; tbody.querySelectorAll('.exp2-row').forEach(function(r){r.style.background='';}); });
      row.addEventListener('dragover', function(e){ e.preventDefault(); tbody.querySelectorAll('.exp2-row').forEach(function(r){r.style.background='';}); row.style.background='#F0FDF4'; });
      row.addEventListener('drop', function(e){
        e.preventDefault();
        var tgt=parseInt(row.dataset.idx);
        if(dragIdx===null||dragIdx===tgt)return;
        var l=expGetList(); var m=l.splice(dragIdx,1)[0]; l.splice(tgt,0,m);
        expSaveList(l); dragIdx=null; renderExpenses();
      });
    });
  }
