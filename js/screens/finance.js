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
        ${yearPct!==null && prevYearIncome > 0
          ? `<div class="tochka-hero-pct ${yearPct>=0?'pos':'neg'}">${yearPct>0?'+':''}${yearPct}% ${yearPct>0?'▲':yearPct<0?'▼':'–'} к ${vYear-1} (${finFmt(prevYearIncome)})</div>`
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

    const stored = Store.get().finance?.balance || {};
    const DEFAULT_CATS = [
      { id:'b1', name:'Оплата КВ + Ком',  minAmt:24000, color:'#7C3AED' },
      { id:'b2', name:'Продукты / Рест',   minAmt:30000, color:'#0EA5E9' },
      { id:'b3', name:'Спорт / Здоровье',  minAmt:18000, color:'#16A34A' },
      { id:'b4', name:'Подписки / Работа', minAmt:10000, color:'#F59E0B' },
      { id:'b5', name:'Разное / Бытовые',  minAmt:10000, color:'#EF4444' },
      { id:'b6', name:'Машина',            minAmt:5000,  color:'#6B7280' },
    ];
    /* Подушка/Цели — это остаток, не редактируется */
    const cats = (stored.categories || DEFAULT_CATS).map((c,i) => ({
      ...c, color: c.color || DEFAULT_CATS[i]?.color || '#6B7280'
    }));

    const mmKey = String(now.getMonth()+1).padStart(2,'0');
    const expenses = stored.expenses?.[now.getFullYear()]?.[mmKey] || {};

    const totalMin = cats.reduce((s,c)=>s+c.minAmt,0);
    const totalSpent = cats.reduce((s,c)=>s+(expenses[c.id]||0),0);

    /* Логика кассового разрыва:
       - Нужно отложить = сумма всех МИН по незакрытым категориям
       - Остаток = доход − уже потрачено − ещё нужно отложить
       - Подушка = то что осталось сверх минимумов */
    const alreadySpent = totalSpent;
    const stillNeed = cats.reduce((s,c) => {
      const spent = expenses[c.id]||0;
      return s + Math.max(0, c.minAmt - spent);
    }, 0);
    const cushion = monthIncome - totalMin; // свободные деньги сверх минимумов
    const toSet = monthIncome > 0 ? Math.max(0, totalMin - alreadySpent) : 0; // сколько ещё отложить

    function pct(amt) {
      return monthIncome>0 ? Math.round(amt/monthIncome*100) : 0;
    }

    /* Прогресс-бар расходов */
    const segs = cats.map(c => {
      const spent = expenses[c.id]||0;
      const w = monthIncome>0 ? Math.min(100, spent/monthIncome*100) : 0;
      return `<div class="bal-seg" style="flex:${w};background:${c.color};" title="${c.name}: ${finFmtFull(spent)}"></div>`;
    }).join('');
    const usedPct = monthIncome>0 ? Math.min(100, Math.round(alreadySpent/monthIncome*100)) : 0;

    content.innerHTML = `
      <div class="bal-hero">
        <div class="bal-hero-row">
          <div>
            <div class="bal-label">Доход месяца</div>
            <div class="bal-income">${finFmtFull(monthIncome)}</div>
          </div>
          <div style="text-align:right;">
            <div class="bal-label">Подушка / Цели</div>
            <div class="bal-cushion-big ${cushion>=0?'pos':'neg'}">${finFmtFull(cushion)}</div>
          </div>
        </div>

        <div class="bal-progress-track2">
          <div class="bal-progress-used" style="width:${usedPct}%;display:flex;">
            ${segs}
          </div>
        </div>
        <div class="bal-progress-labels">
          <span>Потрачено: ${finFmtFull(alreadySpent)} (${usedPct}%)</span>
          <span>Мин: ${finFmtFull(totalMin)}</span>
        </div>
      </div>

      <div class="bal-reserve-card ${toSet>0?'':'bal-reserve-ok'}">
        <div class="bal-reserve-icon">${toSet>0?'💰':'✅'}</div>
        <div style="flex:1;">
          <div class="bal-reserve-title">${toSet>0?'Нужно отложить от текущих приходов':'Минимум покрыт'}</div>
          <div class="bal-reserve-amt" style="${toSet>0?'':'color:#16A34A;'}">${toSet>0?finFmtFull(toSet):finFmtFull(cushion)}</div>
          <div class="bal-reserve-sub">${toSet>0
            ? `из ${finFmtFull(monthIncome)} дохода · остаток: ${finFmtFull(monthIncome-totalMin)}`
            : `свободных сверх минимума (${finFmtFull(totalMin)})`
          }</div>
        </div>
        ${toSet>0 ? `<div style="text-align:right;font-size:12px;color:#9CA3AF;">
          каждый приход<br>
          <strong style="font-size:16px;color:#F59E0B;">${pct(totalMin)}%</strong>
        </div>` : ''}
      </div>

      <div class="bal-table-wrap">
        <table class="bal-table">
          <thead>
            <tr>
              <th>Категория</th>
              <th style="text-align:right;">% дох.</th>
              <th style="text-align:right;">Мин.</th>
              <th style="text-align:right;">Факт</th>
              <th style="text-align:right;">Δ</th>
            </tr>
          </thead>
          <tbody>
            ${cats.map((c,ci)=>{
              const spent = expenses[c.id]||0;
              const spentPct = pct(spent);
              const delta = spent - c.minAmt;
              const deltaColor = delta >= 0 ? '#EF4444' : '#16A34A';
              const deltaSign = delta >= 0 ? '+' : '';
              return `<tr>
                <td>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <div style="width:10px;height:10px;border-radius:3px;background:${c.color};flex-shrink:0;"></div>
                    <span class="bal-cat-name">${c.name}</span>
                  </div>
                </td>
                <td class="bal-pct">${spentPct}%</td>
                <td class="bal-min">${finFmtFull(c.minAmt)}</td>
                <td class="bal-spent">
                  <button class="bal-add-expense" data-ci="${ci}" data-cid="${c.id}" style="color:${spent>0?'#111827':'#9CA3AF'};">
                    ${spent>0 ? finFmtFull(spent) : '+ Добавить'}
                  </button>
                </td>
                <td style="font-weight:700;color:${deltaColor};text-align:right;">${spent>0?deltaSign+finFmtFull(delta):'—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="background:#F9FAFB;">
              <td style="color:#6B7280;font-size:12px;padding:10px 16px;">Подушка / Цели</td>
              <td style="color:#6B7280;font-size:12px;text-align:right;">${pct(cushion)}%</td>
              <td style="color:#6B7280;font-size:12px;text-align:right;">???</td>
              <td style="text-align:right;"></td>
              <td style="font-weight:700;color:${cushion>=0?'#16A34A':'#EF4444'};text-align:right;">${finFmtFull(cushion)}</td>
            </tr>
            <tr class="bal-total-row">
              <td>Итого</td>
              <td>${pct(totalSpent)}%</td>
              <td>${finFmtFull(totalMin)}</td>
              <td>${finFmtFull(totalSpent)}</td>
              <td style="color:${totalSpent<=totalMin?'#16A34A':'#EF4444'};font-weight:800;">
                ${totalSpent<=totalMin ? '✓' : '+'+finFmtFull(totalSpent-totalMin)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <button id="bal-edit-cats" class="bal-edit-btn">
        <i class="ti ti-settings"></i> Настроить категории и минимумы
      </button>`;

    content.querySelectorAll('.bal-add-expense').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.stopPropagation();
        const ci=parseInt(btn.dataset.ci), cid=btn.dataset.cid, cat=cats[ci];
        const current=expenses[cid]||0;
        const overlay=document.createElement('div');
        overlay.className='tr-modal-overlay';
        overlay.innerHTML=`
          <div class="tr-modal">
            <p class="tr-modal-title">${cat.name}</p>
            <div style="margin-bottom:12px;padding:12px;background:#F9FAFB;border-radius:8px;font-size:13px;color:#6B7280;">
              Мин. сумма: <strong style="color:#111;">${finFmtFull(cat.minAmt)}</strong>
            </div>
            <div class="tr-modal-row">
              <label style="flex:1 1 100%">Реальный расход за месяц, ₽
                <input type="number" id="bal-exp-amt" value="${current||''}" inputmode="numeric" placeholder="0">
              </label>
            </div>
            <div class="tr-modal-actions">
              <button class="tr-modal-btn-secondary" id="bal-exp-cancel">Отмена</button>
              <button class="tr-modal-btn-primary" id="bal-exp-save">Сохранить</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
        overlay.querySelector('#bal-exp-cancel').addEventListener('click',()=>overlay.remove());
        overlay.querySelector('#bal-exp-save').addEventListener('click',()=>{
          const amt=parseFloat(overlay.querySelector('#bal-exp-amt').value)||0;
          Store.set(`finance.balance.expenses.${now.getFullYear()}.${mmKey}.${cid}`, amt);
          overlay.remove(); renderBalance();
        });
        setTimeout(()=>overlay.querySelector('#bal-exp-amt').focus(),100);
      });
    });

    document.getElementById('bal-edit-cats').addEventListener('click',()=>{
      const overlay=document.createElement('div');
      overlay.className='tr-modal-overlay';
      overlay.innerHTML=`
        <div class="tr-modal" style="max-height:80vh;overflow-y:auto;">
          <p class="tr-modal-title">Категории и минимумы</p>
          ${cats.map((c,i)=>`
            <div class="tr-modal-row" style="gap:8px;align-items:flex-end;">
              <label style="flex:1;">Категория<input type="text" class="bal-cat-name-inp" data-i="${i}" value="${c.name}"></label>
              <label style="width:110px;">Мин. сумма<input type="number" class="bal-cat-min-inp" data-i="${i}" value="${c.minAmt}" inputmode="numeric"></label>
            </div>`).join('')}
          <div class="tr-modal-actions">
            <button class="tr-modal-btn-secondary" id="bal-cats-cancel">Отмена</button>
            <button class="tr-modal-btn-primary" id="bal-cats-save">Сохранить</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
      overlay.querySelector('#bal-cats-cancel').addEventListener('click',()=>overlay.remove());
      overlay.querySelector('#bal-cats-save').addEventListener('click',()=>{
        overlay.querySelectorAll('.bal-cat-name-inp').forEach(inp=>{ cats[+inp.dataset.i].name=inp.value.trim()||cats[+inp.dataset.i].name; });
        overlay.querySelectorAll('.bal-cat-min-inp').forEach(inp=>{ cats[+inp.dataset.i].minAmt=parseFloat(inp.value)||0; });
        Store.set('finance.balance.categories', cats);
        overlay.remove(); renderBalance();
      });
    });
  }


  /* ═══ БЛИЖАЙШИЕ РАСХОДЫ ═══════════════════════ */
  function expGetList() {
    return Store.get().finance?.expensesList || [];
  }
  function expSave(list) {
    Store.set('finance.expensesList', list);
  }

  function expOpenModal(existing, onSave) {
    const isEdit = !!existing;
    const overlay = document.createElement('div');
    overlay.className = 'tr-modal-overlay';
    overlay.innerHTML = `
      <div class="tr-modal">
        <p class="tr-modal-title">${isEdit ? 'Редактировать' : 'Новый расход'}</p>
        <div class="tr-modal-row">
          <label style="flex:1 1 100%">Название
            <input type="text" id="exp-name" value="${existing?.name||''}" placeholder="Зубы, аренда…">
          </label>
        </div>
        <div class="tr-modal-row">
          <label style="flex:1 1 100%">Сумма, ₽
            <input type="number" id="exp-amount" value="${existing?.amount||''}" inputmode="numeric">
          </label>
        </div>
        <div class="tr-modal-row">
          <label style="flex:1 1 100%">Источник / комментарий
            <input type="text" id="exp-source" value="${existing?.source||''}" placeholder="Откуда деньги">
          </label>
        </div>
        <div class="tr-modal-actions">
          ${isEdit ? '<button class="tr-modal-btn-secondary" id="exp-del" style="color:#EF4444;">Удалить</button>' : '<button class="tr-modal-btn-secondary" id="exp-cancel">Отмена</button>'}
          <button class="tr-modal-btn-primary" id="exp-save">Сохранить</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    const cb = overlay.querySelector('#exp-cancel');
    if (cb) cb.addEventListener('click', () => overlay.remove());
    const db = overlay.querySelector('#exp-del');
    if (db) db.addEventListener('click', () => { onSave(null); overlay.remove(); });
    overlay.querySelector('#exp-save').addEventListener('click', () => {
      const name = overlay.querySelector('#exp-name').value.trim();
      const amount = parseFloat(overlay.querySelector('#exp-amount').value) || 0;
      const source = overlay.querySelector('#exp-source').value.trim();
      if (!name) return;
      onSave({ id: existing?.id || 'e_' + Date.now(), name, amount, source });
      overlay.remove();
    });
  }

  function renderExpenses() {
    const list = expGetList();
    const total = list.reduce((s, e) => s + (e.amount || 0), 0);

    content.innerHTML = `
      <div class="tochka-hero" style="margin-bottom:8px;">
        <div class="tochka-hero-label">Ближайшие расходы</div>
        <div class="tochka-hero-amount">${finFmtFull(total)}</div>
        <div class="tochka-hero-sub" style="color:#EF4444;">−${finFmtFull(total)}</div>
      </div>
      <div class="tochka-list">
        <div class="tochka-list-head">
          <span class="tochka-list-title">Список · тяни для сортировки</span>
          <button id="exp-add" class="tochka-add-btn"><i class="ti ti-plus"></i> Добавить</button>
        </div>
        <div id="exp-list">
          ${list.length === 0
            ? '<div class="tochka-empty">Нет расходов — добавьте первый</div>'
            : list.map((e, i) => `
              <div class="exp-row" data-idx="${i}" draggable="true">
                <div class="exp-drag-handle"><i class="ti ti-grip-vertical"></i></div>
                <div class="exp-info exp-edit" data-idx="${i}">
                  <div class="exp-name">${e.name}</div>
                  ${e.source ? `<div class="exp-source">${e.source}</div>` : ''}
                </div>
                <div class="exp-amount">−${finFmtFull(e.amount)}</div>
              </div>`).join('')}
        </div>
        ${list.length > 0 ? `
        <div class="exp-total-row">
          <span>Итого</span>
          <span style="font-weight:800;color:#EF4444;">−${finFmtFull(total)}</span>
        </div>` : ''}
      </div>`;

    document.getElementById('exp-add').addEventListener('click', () => {
      expOpenModal(null, result => {
        if (!result) return;
        const l = expGetList();
        l.push(result);
        expSave(l);
        renderExpenses();
      });
    });

    /* Edit on row click */
    content.querySelectorAll('.exp-edit').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        const l = expGetList();
        expOpenModal(l[idx], result => {
          if (result === null) l.splice(idx, 1);
          else l[idx] = result;
          expSave(l);
          renderExpenses();
        });
      });
    });

    /* Drag-and-drop reorder */
    const listEl = document.getElementById('exp-list');
    let dragIdx = null;
    listEl.querySelectorAll('.exp-row').forEach(row => {
      row.addEventListener('dragstart', () => {
        dragIdx = parseInt(row.dataset.idx);
        row.classList.add('exp-dragging');
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('exp-dragging');
        listEl.querySelectorAll('.exp-row').forEach(r => r.classList.remove('exp-drag-over'));
      });
      row.addEventListener('dragover', e => {
        e.preventDefault();
        const tgt = parseInt(row.dataset.idx);
        if (dragIdx === null || dragIdx === tgt) return;
        listEl.querySelectorAll('.exp-row').forEach(r => r.classList.remove('exp-drag-over'));
        row.classList.add('exp-drag-over');
      });
      row.addEventListener('drop', e => {
        e.preventDefault();
        const tgt = parseInt(row.dataset.idx);
        if (dragIdx === null || dragIdx === tgt) return;
        const l = expGetList();
        const [moved] = l.splice(dragIdx, 1);
        l.splice(tgt, 0, moved);
        expSave(l);
        dragIdx = null;
        renderExpenses();
      });

      /* Touch drag for mobile */
      let touchSrc = null, touchClone = null;
      row.querySelector('.exp-drag-handle').addEventListener('touchstart', te => {
        te.preventDefault();
        touchSrc = row;
        touchClone = row.cloneNode(true);
        touchClone.style.cssText = 'position:fixed;opacity:0.85;pointer-events:none;z-index:9999;width:'+row.offsetWidth+'px;background:#fff;border:1px solid #16A34A;border-radius:8px;';
        document.body.appendChild(touchClone);
        dragIdx = parseInt(row.dataset.idx);
        row.style.opacity = '0.4';
      }, { passive: false });

      document.addEventListener('touchmove', te => {
        if (!touchSrc) return;
        te.preventDefault();
        const t = te.touches[0];
        if (touchClone) { touchClone.style.left = (t.clientX - 20) + 'px'; touchClone.style.top = (t.clientY - 20) + 'px'; }
        touchClone && (touchClone.style.display = 'none');
        const under = document.elementFromPoint(t.clientX, t.clientY);
        touchClone && (touchClone.style.display = '');
        const tgtRow = under?.closest('.exp-row');
        listEl.querySelectorAll('.exp-row').forEach(r => r.classList.remove('exp-drag-over'));
        if (tgtRow && tgtRow !== touchSrc) tgtRow.classList.add('exp-drag-over');
      }, { passive: false });

      document.addEventListener('touchend', te => {
        if (!touchSrc) return;
        if (touchClone) { touchClone.remove(); touchClone = null; }
        touchSrc.style.opacity = '';
        const t = te.changedTouches[0];
        const under = document.elementFromPoint(t.clientX, t.clientY);
        const tgtRow = under?.closest('.exp-row');
        listEl.querySelectorAll('.exp-row').forEach(r => r.classList.remove('exp-drag-over'));
        if (tgtRow && tgtRow !== touchSrc) {
          const tgt = parseInt(tgtRow.dataset.idx);
          const l = expGetList();
          const [moved] = l.splice(dragIdx, 1);
          l.splice(tgt, 0, moved);
          expSave(l);
        }
        touchSrc = null; dragIdx = null;
        renderExpenses();
      });
    });
  }

  function render(){
    if(activeTab==='month')renderMonth();
    else if(activeTab==='expenses')renderExpenses();
    else if(activeTab==='balance')renderBalance();
    else if(activeTab==='year')renderYear();
    else renderAll();
  }
  render();
};
