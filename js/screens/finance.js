/* ============================================================
   FINANCE SCREEN
   Вкладки: Месяц / Год / Всё время
   Профит = % к тому же месяцу/году прошлого года
   ============================================================ */

window.Screens = window.Screens || {};

const FIN_MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                    'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

function finGetEntries(year, month) {
  const mm = String(month + 1).padStart(2,'0');
  return Store.get().finance?.years?.[year]?.[mm]?.entries || [];
}

function finSaveEntries(year, month, entries) {
  const mm = String(month + 1).padStart(2,'0');
  Store.set(`finance.years.${year}.${mm}.entries`, entries);
}

function finIncome(entries) {
  return entries.filter(e => e.type === 'income').reduce((s,e) => s + (e.amount||0), 0);
}

function finFmt(n) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + '₽';
}

function finProfit(cur, prev) {
  if (!prev) return null;
  return Math.round((cur - prev) / prev * 100);
}

function finProfitBadge(pct) {
  if (pct === null) return '';
  const sign = pct > 0 ? '+' : '';
  const color = pct > 0 ? '#A8C97F' : pct < 0 ? '#FF5C5C' : '#9D9A92';
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '–';
  return `<span style="font-size:12px; color:${color}; font-weight:600;">${sign}${pct}% ${arrow}</span>`;
}

function finOpenModal(existing, defaultYear, defaultMonth, onSave) {
  const isEdit = !!existing;
  const now = new Date();
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';
  overlay.innerHTML = `
    <div class="tr-modal">
      <p class="tr-modal-title">${isEdit ? 'Редактировать' : 'Новый приход'}</p>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Описание
          <input type="text" id="fin-label" value="${existing?.label||''}" placeholder="Клиент, проект…">
        </label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Сумма, ₽
          <input type="number" id="fin-amount" value="${existing?.amount||''}" inputmode="numeric">
        </label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Дата
          <input type="text" id="fin-date" value="${existing?.date||now.toLocaleDateString('ru-RU')}" placeholder="дд.мм.гггг">
        </label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Цвет метки
          <select id="fin-color" class="tr-color-select">
            <option value="" ${!existing?.color?'selected':''}>— стандарт (золото)</option>
            <option value="blue" ${existing?.color==='blue'?'selected':''}>Синий (другой источник)</option>
            <option value="green" ${existing?.color==='green'?'selected':''}>Зелёный</option>
            <option value="red" ${existing?.color==='red'?'selected':''}>Красный</option>
          </select>
        </label>
      </div>
      <div class="tr-modal-actions">
        ${isEdit?'<button class="tr-modal-btn-secondary" id="fin-del" style="color:#FF5C5C;">Удалить</button>':'<button class="tr-modal-btn-secondary" id="fin-cancel">Отмена</button>'}
        <button class="tr-modal-btn-primary" id="fin-save">Сохранить</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target===overlay) overlay.remove(); });
  const cb = overlay.querySelector('#fin-cancel');
  if (cb) cb.addEventListener('click', () => overlay.remove());
  const db = overlay.querySelector('#fin-del');
  if (db) db.addEventListener('click', () => { onSave(null); overlay.remove(); });
  overlay.querySelector('#fin-save').addEventListener('click', () => {
    const amount = parseFloat(overlay.querySelector('#fin-amount').value)||0;
    const label = overlay.querySelector('#fin-label').value.trim();
    const date = overlay.querySelector('#fin-date').value.trim();
    const color = overlay.querySelector('#fin-color').value;
    if (!amount) return;
    onSave({ id: existing?.id||'f_'+Date.now(), date, amount, label, type:'income', color: color||undefined });
    overlay.remove();
  });
}

const FIN_COLORS = {
  '':      '#C8A84B',
  'blue':  '#2E7FD4',
  'green': '#A8C97F',
  'red':   '#FF5C5C',
};

window.Screens.finance = function(mount) {
  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();
  let activeTab = 'month';

  mount.innerHTML = `
    <div class="fin-screen">
      <div class="fin-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <button class="fin-back" id="fin-back"><i class="ti ti-arrow-left"></i></button>
          <p class="fin-title">Финансы</p>
        </div>
        <button class="fin-back" id="fin-logout"><i class="ti ti-logout"></i></button>
      </div>
      <div class="fin-tabs" style="position:sticky;top:0;z-index:10;">
        <button class="fin-tab active" data-tab="month">Месяц</button>
        <button class="fin-tab" data-tab="year">Год</button>
        <button class="fin-tab" data-tab="all">Всё время</button>
      </div>
      <div class="fin-body" id="fin-content"></div>
    </div>`;

  document.getElementById('fin-back').addEventListener('click', () => Router.go('/home'));
  document.getElementById('fin-logout').addEventListener('click', () => { Auth.logout(); Router.go('/login'); });
  mount.querySelectorAll('.fin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      mount.querySelectorAll('.fin-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      render();
    });
  });

  const content = document.getElementById('fin-content');

  /* ── МЕСЯЦ ──────────────────────────────────────── */
  function renderMonth() {
    const entries = finGetEntries(viewYear, viewMonth);
    const prevEntries = finGetEntries(viewYear-1, viewMonth);
    const income = finIncome(entries);
    const prevIncome = finIncome(prevEntries);
    const pct = finProfit(income, prevIncome || null);
    const isNow = viewYear === now.getFullYear() && viewMonth === now.getMonth();

    const sorted = [...entries].sort((a,b) => {
      const pa = a.date.split('.'), pb = b.date.split('.');
      return (pa[2]+pa[1]+pa[0]).localeCompare(pb[2]+pb[1]+pb[0]);
    });

    content.innerHTML = `
      <div class="fin-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div class="fin-card-title" style="margin:0;">${FIN_MONTHS[viewMonth]} ${viewYear}</div>
          <div style="display:flex;gap:6px;">
            <button id="fp" class="fin-back" style="width:28px;height:28px;"><i class="ti ti-chevron-left"></i></button>
            <button id="fn" class="fin-back" style="width:28px;height:28px;" ${isNow?'disabled style="opacity:.3;"':''}><i class="ti ti-chevron-right"></i></button>
          </div>
        </div>
        <div class="fin-metric-grid">
          <div class="fin-metric">
            <div class="fin-metric-label">Доход</div>
            <div class="fin-metric-value gold">${finFmt(income)}</div>
          </div>
          <div class="fin-metric">
            <div class="fin-metric-label">К ${viewYear-1}</div>
            <div class="fin-metric-value">${pct!==null ? finProfitBadge(pct) : '<span style="color:#555">—</span>'}</div>
            ${prevIncome ? `<div style="font-size:11px;color:#555;">${finFmt(prevIncome)} в ${viewYear-1}</div>` : ''}
          </div>
        </div>
      </div>

      <div class="fin-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div class="fin-card-title" style="margin:0;">Приходы</div>
          <button id="fin-add" style="background:#C8A84B22;border:0.5px solid #C8A84B;color:#C8A84B;border-radius:6px;padding:5px 10px;cursor:pointer;font-size:13px;"><i class="ti ti-plus"></i> Добавить</button>
        </div>
        ${sorted.length===0
          ? '<div style="padding:20px;text-align:center;color:#555;font-size:13px;">Нет записей</div>'
          : sorted.map((e,i) => {
              const color = FIN_COLORS[e.color||''] || FIN_COLORS[''];
              return `<div class="fin-entry-row fin-edit" data-idx="${entries.indexOf(e)}" style="cursor:pointer;">
                <div>
                  <div style="font-size:13px;">${e.label||'Приход'}</div>
                  <div style="font-size:11px;color:#9D9A92;">${e.date}</div>
                </div>
                <span style="font-size:14px;font-weight:600;color:${color};">+${finFmt(e.amount)}</span>
              </div>`;
            }).join('')
        }
      </div>`;

    document.getElementById('fin-add').addEventListener('click', () => {
      finOpenModal(null, viewYear, viewMonth, result => {
        if (!result) return;
        const list = finGetEntries(viewYear, viewMonth);
        list.push(result);
        finSaveEntries(viewYear, viewMonth, list);
        render();
      });
    });
    content.querySelectorAll('.fin-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const list = finGetEntries(viewYear, viewMonth);
        const idx = parseInt(btn.dataset.idx);
        finOpenModal(list[idx], viewYear, viewMonth, result => {
          if (result===null) list.splice(idx,1);
          else list[idx]=result;
          finSaveEntries(viewYear, viewMonth, list);
          render();
        });
      });
    });
    document.getElementById('fp').addEventListener('click', () => {
      viewMonth--; if (viewMonth<0){viewMonth=11;viewYear--;} render();
    });
    const fn=document.getElementById('fn');
    if (fn&&!fn.disabled) fn.addEventListener('click',()=>{
      viewMonth++; if(viewMonth>11){viewMonth=0;viewYear++;} render();
    });
  }

  /* ── ГОД ─────────────────────────────────────────── */
  function renderYear() {
    const isNow = viewYear === now.getFullYear();
    const months = Array.from({length:12},(_,m)=>{
      const inc = finIncome(finGetEntries(viewYear,m));
      const prev = finIncome(finGetEntries(viewYear-1,m));
      return { label: FIN_MONTHS[m], income: inc, prev, pct: finProfit(inc, prev||null) };
    });
    const totalIncome = months.reduce((s,m)=>s+m.income,0);
    const prevYearIncome = Array.from({length:12},(_,m)=>finIncome(finGetEntries(viewYear-1,m))).reduce((s,v)=>s+v,0);
    const yearPct = finProfit(totalIncome, prevYearIncome||null);
    const activeMths = months.filter(m=>m.income>0).length;
    const avg = activeMths ? Math.round(totalIncome/activeMths) : 0;

    content.innerHTML = `
      <div class="fin-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div class="fin-card-title" style="margin:0;">${viewYear}</div>
          <div style="display:flex;gap:6px;">
            <button id="fy-p" class="fin-back" style="width:28px;height:28px;"><i class="ti ti-chevron-left"></i></button>
            <button id="fy-n" class="fin-back" style="width:28px;height:28px;" ${isNow?'disabled style="opacity:.3;"':''}><i class="ti ti-chevron-right"></i></button>
          </div>
        </div>
        <div class="fin-metric-grid">
          <div class="fin-metric"><div class="fin-metric-label">За год</div><div class="fin-metric-value gold">${finFmt(totalIncome)}</div></div>
          <div class="fin-metric"><div class="fin-metric-label">К ${viewYear-1}</div><div class="fin-metric-value">${yearPct!==null?finProfitBadge(yearPct):'—'}</div></div>
          <div class="fin-metric"><div class="fin-metric-label">Средняя / мес</div><div class="fin-metric-value">${finFmt(avg)}</div></div>
        </div>
      </div>
      <div class="fin-card">
        <div class="fin-card-title">По месяцам</div>
        ${months.map((m,mi)=>m.income===0?'':`
          <div class="fin-entry-row fin-month-go" data-m="${mi}" style="cursor:pointer;">
            <span style="font-size:13px;">${m.label}</span>
            <div style="display:flex;align-items:center;gap:10px;">
              ${m.pct!==null?finProfitBadge(m.pct):''}
              <span style="font-size:14px;font-weight:600;color:#C8A84B;">${finFmt(m.income)}</span>
            </div>
          </div>`).join('')}
      </div>`;

    document.getElementById('fy-p').addEventListener('click',()=>{viewYear--;render();});
    const fyn=document.getElementById('fy-n');
    if(fyn&&!fyn.disabled)fyn.addEventListener('click',()=>{viewYear++;render();});
    content.querySelectorAll('.fin-month-go').forEach(btn=>{
      btn.addEventListener('click',()=>{
        viewMonth=parseInt(btn.dataset.m);
        activeTab='month';
        mount.querySelectorAll('.fin-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab==='month'));
        render();
      });
    });
  }

  /* ── ВСЁ ВРЕМЯ ──────────────────────────────────── */
  function renderAll() {
    const yearsData = Store.get().finance?.years || {};
    const years = Object.keys(yearsData).map(Number).sort((a,b)=>b-a);
    if (!years.length){
      content.innerHTML='<div style="padding:40px;text-align:center;color:#555;">Нет данных</div>';
      return;
    }

    let grandTotal=0;
    const rows = years.map(y=>{
      const inc = Array.from({length:12},(_,m)=>finIncome(finGetEntries(y,m))).reduce((s,v)=>s+v,0);
      const prevInc = Array.from({length:12},(_,m)=>finIncome(finGetEntries(y-1,m))).reduce((s,v)=>s+v,0);
      grandTotal+=inc;
      return {year:y, income:inc, pct:finProfit(inc,prevInc||null)};
    });

    content.innerHTML=`
      <div class="fin-card">
        <div class="fin-card-title">За всё время</div>
        <div class="fin-metric-grid">
          <div class="fin-metric"><div class="fin-metric-label">Всего заработано</div><div class="fin-metric-value gold" style="font-size:20px;">${finFmt(grandTotal)}</div></div>
          <div class="fin-metric"><div class="fin-metric-label">Средняя / год</div><div class="fin-metric-value">${finFmt(grandTotal/Math.max(1,rows.filter(r=>r.income>0).length))}</div></div>
        </div>
      </div>
      <div class="fin-card">
        <div class="fin-card-title">По годам</div>
        ${rows.map(r=>r.income===0?'':`
          <div class="fin-entry-row fin-year-go" data-y="${r.year}" style="cursor:pointer;">
            <span style="font-size:15px;font-weight:600;">${r.year}</span>
            <div style="display:flex;align-items:center;gap:10px;">
              ${r.pct!==null?finProfitBadge(r.pct):''}
              <span style="font-size:15px;font-weight:600;color:#C8A84B;">${finFmt(r.income)}</span>
            </div>
          </div>`).join('')}
      </div>`;

    content.querySelectorAll('.fin-year-go').forEach(btn=>{
      btn.addEventListener('click',()=>{
        viewYear=parseInt(btn.dataset.y);
        activeTab='year';
        mount.querySelectorAll('.fin-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab==='year'));
        render();
      });
    });
  }

  function render(){
    if(activeTab==='month') renderMonth();
    else if(activeTab==='year') renderYear();
    else renderAll();
  }
  render();
};
