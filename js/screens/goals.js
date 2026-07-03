/* ============================================================
   GOALS SCREEN — полная реализация с Firebase
   Структура: Store → goals.directions[{id,name,amount,done,season}]
   Сезоны: winter, spring, summer, autumn, december
   ============================================================ */

window.Screens = window.Screens || {};

const SEASONS = [
  { key: 'winter',   label: 'Зима' },
  { key: 'spring',   label: 'Весна' },
  { key: 'summer',   label: 'Лето' },
  { key: 'autumn',   label: 'Осень' },
  { key: 'december', label: 'Декабрь' },
];

function goalsGet() {
  return Store.get().goals?.directions || [];
}

function goalsSave(list) {
  list.forEach((g, i) => Store.set(`goals.directions.${i}`, g));
  /* Если список стал короче — обнуляем хвост */
  const prev = Store.get().goals?.directions || [];
  for (let i = list.length; i < prev.length; i++) {
    Store.set(`goals.directions.${i}`, null);
  }
}

function goalsFmt(n) {
  return n.toLocaleString('ru-RU') + ' ₽';
}

function goalsOpenModal(existing, onSave) {
  const isEdit = !!existing;
  const overlay = document.createElement('div');
  overlay.className = 'tr-modal-overlay';
  overlay.innerHTML = `
    <div class="tr-modal">
      <p class="tr-modal-title">${isEdit ? 'Редактировать цель' : 'Новая цель'}</p>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Название
          <input type="text" id="g-name" value="${existing?.name || ''}" placeholder="Например: Новая машина">
        </label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Сумма, ₽
          <input type="number" id="g-amount" value="${existing?.amount || ''}" inputmode="numeric" placeholder="0">
        </label>
      </div>
      <div class="tr-modal-row">
        <label style="flex:1 1 100%">Сезон
          <select id="g-season" class="tr-color-select">
            ${SEASONS.map(s => `<option value="${s.key}" ${(existing?.season || 'winter') === s.key ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="tr-modal-row" style="align-items:center; gap:10px;">
        <input type="checkbox" id="g-done" ${existing?.done ? 'checked' : ''} style="width:auto;">
        <label for="g-done" style="font-size:13px; color:#E8E5DC; margin:0;">Закрыто</label>
      </div>
      <div class="tr-modal-actions">
        ${isEdit ? '<button class="tr-modal-btn-secondary" id="g-delete" style="color:#FF5C5C;">Удалить</button>' : '<button class="tr-modal-btn-secondary" id="g-cancel">Отмена</button>'}
        <button class="tr-modal-btn-primary" id="g-save">Сохранить</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  const cancelBtn = overlay.querySelector('#g-cancel');
  if (cancelBtn) cancelBtn.addEventListener('click', () => overlay.remove());

  const deleteBtn = overlay.querySelector('#g-delete');
  if (deleteBtn) deleteBtn.addEventListener('click', () => {
    if (!confirm(`Удалить цель "${existing.name}"?`)) return;
    onSave(null);
    overlay.remove();
  });

  overlay.querySelector('#g-save').addEventListener('click', () => {
    const name = overlay.querySelector('#g-name').value.trim();
    const amount = parseFloat(overlay.querySelector('#g-amount').value) || 0;
    const season = overlay.querySelector('#g-season').value;
    const done = overlay.querySelector('#g-done').checked;
    if (!name) return;
    onSave({ id: existing?.id || 'g_' + Date.now(), name, amount, season, done });
    overlay.remove();
  });
}

window.Screens.goals = function (mount) {
  let activeSeason = 'winter';

  mount.innerHTML = `
    <div class="theme-dark">
      <div class="sec-header">
        <div style="display:flex; align-items:center; gap:10px;">
          <button class="sec-back" id="sec-back"><i class="ti ti-arrow-left"></i></button>
          <p class="sec-title">Цели</p>
        </div>
        <button class="sec-back" id="sec-logout"><i class="ti ti-logout"></i></button>
      </div>
      <div class="sec-tabs" style="position:sticky; top:0; z-index:10;">
        ${SEASONS.map(s => `<button class="sec-tab ${s.key === activeSeason ? 'active' : ''}" data-season="${s.key}">${s.label}</button>`).join('')}
      </div>
      <div class="sec-body" id="goals-content"></div>
    </div>`;

  document.getElementById('sec-back').addEventListener('click', () => Router.go('/home'));
  document.getElementById('sec-logout').addEventListener('click', () => { Auth.logout(); Router.go('/login'); });

  mount.querySelectorAll('.sec-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      mount.querySelectorAll('.sec-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeSeason = btn.dataset.season;
      render();
    });
  });

  const content = document.getElementById('goals-content');

  function render() {
    const all = goalsGet().filter(g => g); /* убираем null */
    const seasonGoals = all.filter(g => g.season === activeSeason);
    const total = seasonGoals.reduce((s, g) => s + (g.amount || 0), 0);
    const doneSum = seasonGoals.filter(g => g.done).reduce((s, g) => s + (g.amount || 0), 0);
    const pct = total > 0 ? Math.round(doneSum / total * 100) : 0;

    /* Общая цель по всем сезонам */
    const allTotal = all.reduce((s, g) => s + (g.amount || 0), 0);
    const allDone = all.filter(g => g.done).reduce((s, g) => s + (g.amount || 0), 0);
    const allPct = allTotal > 0 ? Math.round(allDone / allTotal * 100) : 0;

    content.innerHTML = `
      <div class="sec-card">
        <div class="sec-card-title">Итог года</div>
        <div class="sec-metric-grid">
          <div class="sec-metric">
            <div class="sec-metric-label">Общая цель</div>
            <div class="sec-metric-value accent">${goalsFmt(allTotal)}</div>
          </div>
          <div class="sec-metric">
            <div class="sec-metric-label">Закрыто</div>
            <div class="sec-metric-value">${goalsFmt(allDone)}</div>
          </div>
          <div class="sec-metric">
            <div class="sec-metric-label">Прогресс</div>
            <div class="sec-metric-value accent">${allPct}%</div>
          </div>
        </div>
        <div style="height:6px; background:#2A2D35; border-radius:3px; margin-top:12px;">
          <div style="height:100%; width:${allPct}%; background:#C8A84B; border-radius:3px; transition:width 0.4s;"></div>
        </div>
      </div>

      <div class="sec-card">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
          <div>
            <div class="sec-card-title" style="margin-bottom:2px;">
              ${SEASONS.find(s => s.key === activeSeason)?.label}
            </div>
            ${seasonGoals.length > 0 ? `<div style="font-size:12px; color:#9D9A92;">${goalsFmt(doneSum)} из ${goalsFmt(total)} · ${pct}%</div>` : ''}
          </div>
          <button id="goals-add" style="background:#C8A84B22; border:0.5px solid #C8A84B; color:#C8A84B; border-radius:6px; padding:5px 10px; cursor:pointer; font-size:13px;">
            <i class="ti ti-plus"></i> Добавить
          </button>
        </div>

        ${seasonGoals.length === 0
          ? '<div style="padding:24px; text-align:center; color:#555; font-size:13px;">Нет целей на этот период</div>'
          : seasonGoals.map((g, i) => `
            <div class="goals-row goals-edit-btn" data-id="${g.id}" style="display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-top:0.5px solid #2A2D35; cursor:pointer;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span class="habit-mark ${g.done ? 'done' : ''}" style="pointer-events:none;">${g.done ? '<i class="ti ti-check"></i>' : ''}</span>
                <span style="font-size:14px; color:${g.done ? '#555' : 'var(--bone)'}; ${g.done ? 'text-decoration:line-through;' : ''}">${g.name}</span>
              </div>
              <span style="font-size:14px; font-weight:600; color:${g.done ? '#555' : '#C8A84B'};">${goalsFmt(g.amount || 0)}</span>
            </div>`).join('')
        }

        ${seasonGoals.length > 0 ? `
          <div style="height:4px; background:#2A2D35; border-radius:2px; margin-top:12px;">
            <div style="height:100%; width:${pct}%; background:#C8A84B; border-radius:2px; transition:width 0.4s;"></div>
          </div>` : ''}
      </div>`;

    document.getElementById('goals-add').addEventListener('click', () => {
      goalsOpenModal({ season: activeSeason }, result => {
        if (!result) return;
        const list = goalsGet().filter(g => g);
        list.push(result);
        goalsSave(list);
        render();
      });
    });

    content.querySelectorAll('.goals-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const list = goalsGet().filter(g => g);
        const idx = list.findIndex(g => g.id === id);
        if (idx === -1) return;
        goalsOpenModal(list[idx], result => {
          if (result === null) list.splice(idx, 1);
          else list[idx] = result;
          goalsSave(list);
          render();
        });
      });
    });
  }

  render();
};
