/* ============================================================
   FINANCE SCREEN — полная реализация с Firebase
   Структура: Store → finance.years.{YYYY}.{MM}.entries[{date,amount,label,type}]
   type: 'income' | 'expense'
   ============================================================ */

window.Screens = window.Screens || {};

function finGetYear(year) {
  return Store.get().finance?.years?.[year] || {};
}

function finGetMonth(year, month) {
  const mm = String(month + 1).padStart(2, '0');
  return Store.get().finance?.years?.[year]?.[mm]?.entries || [];
}

function finSaveMonth(year, month, entries) {
  const mm = String(month + 1).padStart(2, '0');
  Store.set(`finance.years.${year}.${mm}.entries`, entries);
}

function finMonthTotal(entries, type) {
  return entries.filter(e => e.type === type).reduce((s, e) => s + (e.amount || 0), 0);
}

function finFmt(n) {
  return n.toLocaleString('ru-RU') + ' ₽';
}

function finMonthLabel(month) {
  return ['Январь','Февраль','Март','Апрель','Май','Июнь',
          'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][month];
}

function finOpenEntryModal(existing, onSave) {
  const isEdit = !!existing;
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';
  overlay.innerHTML = `
    <div class="tr-modal">
      <p class="tr-modal-title">${isEdit ? 'Редактировать' : 'Новая запись'}</p>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Тип
          <select id="fin-type" class="tr-color-select">
            <option value="income" ${(!existing || existing.type === 'income') ? 'selected' : ''}>Приход</option>
            <option value="expense" ${existing?.type === 'expense' ? 'selected' : ''}>Расход</option>
          </select>
        </label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Описание
          <input type="text" id="fin-label" value="${existing?.label || ''}" placeholder="Клиент, проект…">
        </label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Сумма, ₽
          <input type="number" id="fin-amount" value="${existing?.amount || ''}" inputmode="numeric" placeholder="0">
        </label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Дата (ДД.ММ.ГГГГ)
          <input type="text" id="fin-date" value="${existing?.date || ''}" placeholder="${new Date().toLocaleDateString('ru-RU')}">
        </label>
      </div>
      <div class="tr-modal-actions">
        ${isEdit ? '<button class="tr-modal-btn-secondary" id="fin-delete" style="color:#FF5C5C;">Удалить</button>' : '<button class="tr-modal-btn-secondary" id="fin-cancel">Отмена</button>'}
        <button class="tr-modal-btn-primary" id="fin-save">Сохранить</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  const cancelBtn = overlay.querySelector('#fin-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', () => overlay.remove());

  const deleteBtn = overlay.querySelector('#fin-delete');
  if (deleteBtn) deleteBtn.addEventListener('click', () => {
    onSave(null);
    overlay.remove();
  });

  overlay.querySelector('#fin-save').addEventListener('click', () => {
    const amount = parseFloat(overlay.querySelector('#fin-amount').value) || 0;
    const label = overlay.querySelector('#fin-label').value.trim();
    const date = overlay.querySelector('#fin-date').value.trim() ||
      new Date().toLocaleDateString('ru-RU');
    const type = overlay.querySelector('#fin-type').value;
    if (!amount) return;
    onSave({ id: existing?.id || 'f_' + Date.now(), date, amount, label, type });
    overlay.remove();
  });
}

window.Screens.finance = function (mount) {
  const now = new Date();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();
  let activeTab = 'month';

  mount.innerHTML = `
    <div class="fin-screen">
      <div class="fin-header">
        <div style="display:flex; align-items:center; gap:10px;">
          <button class="fin-back" id="fin-back"><i class="ti ti-arrow-left"></i></button>
          <p class="fin-title">Финансы</p>
        </div>
        <button class="fin-back" id="fin-logout"><i class="ti ti-logout"></i></button>
      </div>
      <div class="fin-tabs" style="position:sticky; top:0; z-index:10;">
        <button class="fin-tab active" data-tab="month">Месяц</button>
        <button class="fin-tab" data-tab="year">Год</button>
        <button class="fin-tab" data-tab="all">Всего</button>
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

  function renderMonth() {
    const entries = finGetMonth(viewYear, viewMonth);
    const income = finMonthTotal(entries, 'income');
    const expense = finMonthTotal(entries, 'expense');
    const profit = income - expense;
    const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

    /* Сравнение с прошлым годом */
    const prevEntries = finGetMonth(viewYear - 1, viewMonth);
    const prevIncome = finMonthTotal(prevEntries, 'income');
    const growthPct = prevIncome > 0 ? Math.round((income - prevIncome) / prevIncome * 100) : null;

    const sorted = [...entries].sort((a, b) => {
      const da = a.date.split('.').reverse().join('');
      const db = b.date.split('.').reverse().join('');
      return da.localeCompare(db);
    });

    content.innerHTML = `
      <div class="fin-card">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
          <div class="fin-card-title" style="margin:0;">${finMonthLabel(viewMonth)} ${viewYear}</div>
          <div style="display:flex; gap:6px; align-items:center;">
            <button id="fin-prev" class="fin-back" style="width:28px;height:28px;"><i class="ti ti-chevron-left"></i></button>
            <button id="fin-next" class="fin-back" style="width:28px;height:28px;" ${isCurrentMonth ? 'disabled style="opacity:0.3;"' : ''}><i class="ti ti-chevron-right"></i></button>
          </div>
        </div>
        <div class="fin-metric-grid">
          <div class="fin-metric">
            <div class="fin-metric-label">Приход</div>
            <div class="fin-metric-value gold">${finFmt(income)}</div>
          </div>
          <div class="fin-metric">
            <div class="fin-metric-label">Расход</div>
            <div class="fin-metric-value" style="color:#FF5C5C;">${finFmt(expense)}</div>
          </div>
          <div class="fin-metric">
            <div class="fin-metric-label">Профит</div>
            <div class="fin-metric-value ${profit >= 0 ? 'green' : ''}" style="${profit < 0 ? 'color:#FF5C5C;' : ''}">${finFmt(profit)}</div>
          </div>
          ${growthPct !== null ? `<div class="fin-metric">
            <div class="fin-metric-label">К ${viewYear-1}</div>
            <div class="fin-metric-value ${growthPct >= 0 ? 'green' : ''}" style="${growthPct < 0 ? 'color:#FF5C5C;' : ''}">${growthPct > 0 ? '+' : ''}${growthPct}%</div>
          </div>` : ''}
        </div>
      </div>

      <div class="fin-card">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
          <div class="fin-card-title" style="margin:0;">Записи</div>
          <button id="fin-add" style="background:#2E7FD420; border:0.5px solid #2E7FD4; color:#2E7FD4; border-radius:6px; padding:5px 10px; cursor:pointer; font-size:13px;"><i class="ti ti-plus"></i> Добавить</button>
        </div>
        ${sorted.length === 0 ? '<div style="padding:20px; text-align:center; color:#555; font-size:13px;">Нет записей — добавьте первую</div>' :
          sorted.map((e, i) => `
            <div class="fin-entry-row fin-edit-btn" data-idx="${entries.indexOf(e)}" style="cursor:pointer;">
              <div>
                <div style="font-size:13px;">${e.label || (e.type === 'income' ? 'Приход' : 'Расход')}</div>
                <div style="font-size:11px; color:#9D9A92;">${e.date}</div>
              </div>
              <div style="font-size:14px; font-weight:600; color:${e.type === 'income' ? '#C8A84B' : '#FF5C5C'};">
                ${e.type === 'income' ? '+' : '−'}${finFmt(e.amount)}
              </div>
            </div>`).join('')
        }
      </div>`;

    document.getElementById('fin-add').addEventListener('click', () => {
      finOpenEntryModal(null, result => {
        if (!result) return;
        const list = finGetMonth(viewYear, viewMonth);
        list.push(result);
        finSaveMonth(viewYear, viewMonth, list);
        render();
      });
    });

    content.querySelectorAll('.fin-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const list = finGetMonth(viewYear, viewMonth);
        finOpenEntryModal(list[idx], result => {
          if (result === null) list.splice(idx, 1);
          else list[idx] = result;
          finSaveMonth(viewYear, viewMonth, list);
          render();
        });
      });
    });

    document.getElementById('fin-prev').addEventListener('click', () => {
      viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } render();
    });
    const nb = document.getElementById('fin-next');
    if (nb && !nb.disabled) nb.addEventListener('click', () => {
      viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } render();
    });
  }

  function renderYear() {
    const months = Array.from({length: 12}, (_, m) => {
      const entries = finGetMonth(viewYear, m);
      return {
        label: finMonthLabel(m),
        income: finMonthTotal(entries, 'income'),
        expense: finMonthTotal(entries, 'expense'),
      };
    });
    const totalIncome = months.reduce((s, m) => s + m.income, 0);
    const totalExpense = months.reduce((s, m) => s + m.expense, 0);
    const avgIncome = Math.round(totalIncome / Math.max(1, months.filter(m => m.income > 0).length));

    const isCurrentYear = viewYear === now.getFullYear();

    content.innerHTML = `
      <div class="fin-card">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
          <div class="fin-card-title" style="margin:0;">${viewYear}</div>
          <div style="display:flex; gap:6px;">
            <button id="fin-prev-y" class="fin-back" style="width:28px;height:28px;"><i class="ti ti-chevron-left"></i></button>
            <button id="fin-next-y" class="fin-back" style="width:28px;height:28px;" ${isCurrentYear ? 'disabled style="opacity:0.3;"' : ''}><i class="ti ti-chevron-right"></i></button>
          </div>
        </div>
        <div class="fin-metric-grid">
          <div class="fin-metric"><div class="fin-metric-label">Приход за год</div><div class="fin-metric-value gold">${finFmt(totalIncome)}</div></div>
          <div class="fin-metric"><div class="fin-metric-label">Расход за год</div><div class="fin-metric-value" style="color:#FF5C5C;">${finFmt(totalExpense)}</div></div>
          <div class="fin-metric"><div class="fin-metric-label">Профит</div><div class="fin-metric-value green">${finFmt(totalIncome - totalExpense)}</div></div>
          <div class="fin-metric"><div class="fin-metric-label">Средний / мес</div><div class="fin-metric-value">${finFmt(avgIncome)}</div></div>
        </div>
      </div>
      <div class="fin-card">
        <div class="fin-card-title">По месяцам</div>
        ${months.map((m, mi) => m.income === 0 && m.expense === 0 ? '' : `
          <div class="fin-entry-row fin-month-link" data-month="${mi}" style="cursor:pointer;">
            <span style="font-size:13px;">${m.label}</span>
            <div style="display:flex; gap:12px; align-items:center;">
              <span style="font-size:12px; color:#A8C97F;">+${finFmt(m.income)}</span>
              ${m.expense > 0 ? `<span style="font-size:12px; color:#FF5C5C;">−${finFmt(m.expense)}</span>` : ''}
            </div>
          </div>`).join('')}
      </div>`;

    document.getElementById('fin-prev-y').addEventListener('click', () => { viewYear--; render(); });
    const ny = document.getElementById('fin-next-y');
    if (ny && !ny.disabled) ny.addEventListener('click', () => { viewYear++; render(); });

    content.querySelectorAll('.fin-month-link').forEach(btn => {
      btn.addEventListener('click', () => {
        viewMonth = parseInt(btn.dataset.month);
        activeTab = 'month';
        mount.querySelectorAll('.fin-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'month'));
        render();
      });
    });
  }

  function renderAll() {
    /* Собираем все годы из данных */
    const yearsData = Store.get().finance?.years || {};
    const years = Object.keys(yearsData).sort((a, b) => b - a);
    if (years.length === 0) {
      content.innerHTML = '<div style="padding:40px; text-align:center; color:#555; font-size:13px;">Нет данных</div>';
      return;
    }

    let totalIncome = 0, totalExpense = 0;
    const yearRows = years.map(y => {
      const yData = yearsData[y];
      let yi = 0, ye = 0;
      Object.values(yData).forEach(mData => {
        (mData.entries || []).forEach(e => {
          if (e.type === 'income') yi += e.amount || 0;
          else ye += e.amount || 0;
        });
      });
      totalIncome += yi;
      totalExpense += ye;
      return { year: y, income: yi, expense: ye };
    });

    content.innerHTML = `
      <div class="fin-card">
        <div class="fin-card-title">За всё время</div>
        <div class="fin-metric-grid">
          <div class="fin-metric"><div class="fin-metric-label">Всего приход</div><div class="fin-metric-value gold">${finFmt(totalIncome)}</div></div>
          <div class="fin-metric"><div class="fin-metric-label">Всего расход</div><div class="fin-metric-value" style="color:#FF5C5C;">${finFmt(totalExpense)}</div></div>
          <div class="fin-metric"><div class="fin-metric-label">Чистый профит</div><div class="fin-metric-value green">${finFmt(totalIncome - totalExpense)}</div></div>
        </div>
      </div>
      <div class="fin-card">
        <div class="fin-card-title">По годам</div>
        ${yearRows.map(r => `
          <div class="fin-entry-row fin-year-link" data-year="${r.year}" style="cursor:pointer;">
            <span style="font-size:14px; font-weight:500;">${r.year}</span>
            <div style="display:flex; gap:12px;">
              <span style="color:#A8C97F; font-size:13px;">+${finFmt(r.income)}</span>
              ${r.expense > 0 ? `<span style="color:#FF5C5C; font-size:13px;">−${finFmt(r.expense)}</span>` : ''}
            </div>
          </div>`).join('')}
      </div>`;

    content.querySelectorAll('.fin-year-link').forEach(btn => {
      btn.addEventListener('click', () => {
        viewYear = parseInt(btn.dataset.year);
        activeTab = 'year';
        mount.querySelectorAll('.fin-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'year'));
        render();
      });
    });
  }

  function render() {
    if (activeTab === 'month') renderMonth();
    else if (activeTab === 'year') renderYear();
    else renderAll();
  }

  render();
};
