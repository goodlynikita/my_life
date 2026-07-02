/* ============================================================
   HABITS SCREEN — style example (graphite + brass)
   ============================================================ */

window.Screens = window.Screens || {};

const HABITS_DEMO = [
  { name: 'Ответственность', icon: 'ti-star', target: 5, marks: ['done','done','done','done','missed','','done','done','done','done','done'] },
  { name: 'Дисциплина', icon: 'ti-bolt', target: 5, marks: ['done','done','done','done','done','','done','done','missed','missed','done'] },
  { name: 'Питание', icon: 'ti-apple', target: 5, marks: ['done','done','missed','missed','missed','','done','done','missed','done',''] },
  { name: 'Касания / Блог', icon: 'ti-device-mobile', target: 5, marks: ['missed','missed','missed','missed','missed','','missed','missed','missed','missed','missed'] },
  { name: 'Тренировки', icon: 'ti-barbell', target: 3, marks: ['missed','','missed','','done','','missed','','done','done','done'] },
];

function habitPct(marks, target) {
  const weeks = Math.ceil(marks.length / 7) || 1;
  const done = marks.filter(m => m === 'done').length;
  const goal = target * weeks;
  return goal > 0 ? Math.round((done / goal) * 100) : 0;
}

function habitMarkSymbol(m) {
  if (m === 'done') return '<i class="ti ti-check"></i>';
  if (m === 'missed') return '<i class="ti ti-x"></i>';
  return '';
}

window.Screens.habits = function (mount) {
  const role = Auth.role();
  mount.innerHTML = `
    <div class="theme-dark">
      <div class="sec-header">
        <div style="display:flex; align-items:center; gap:10px;">
          <button class="sec-back" id="sec-back"><i class="ti ti-arrow-left"></i></button>
          <p class="sec-title">Привычки</p>
        </div>
        <button class="sec-back" id="sec-logout"><i class="ti ti-logout"></i></button>
      </div>
      <div class="sec-tabs">
        <button class="sec-tab active" data-tab="month">Июнь 2026</button>
        <button class="sec-tab" data-tab="history">История</button>
      </div>
      <div class="sec-body" id="habits-content"></div>
    </div>
  `;

  const content = document.getElementById('habits-content');
  const overallPct = Math.round(HABITS_DEMO.reduce((s, h) => s + habitPct(h.marks, h.target), 0) / HABITS_DEMO.length);

  content.innerHTML = `
    <div class="sec-card">
      <div class="sec-card-title">Итог месяца</div>
      <div class="sec-metric-grid">
        <div class="sec-metric">
          <div class="sec-metric-label">Общий прогресс</div>
          <div class="sec-metric-value accent">${overallPct}%</div>
        </div>
        <div class="sec-metric">
          <div class="sec-metric-label">Лучшая привычка</div>
          <div class="sec-metric-value">Ответственность</div>
        </div>
        <div class="sec-metric">
          <div class="sec-metric-label">Требует внимания</div>
          <div class="sec-metric-value">Касания / Блог</div>
        </div>
      </div>
    </div>

    <div class="sec-card">
      <div class="sec-card-title">Сетка дисциплины</div>
      <div style="overflow-x:auto;">
        <table class="habit-table">
          <thead>
            <tr>
              <th></th>
              ${[1,2,3,4,5,6,7,8,9,10,11].map(d => `<th style="font-size:10.5px; color:var(--bone-faint); font-weight:500;">${d}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${HABITS_DEMO.map(h => `
              <tr>
                <td class="habit-row-label"><i class="${h.icon}" style="font-size:13px; color:var(--brass); margin-right:6px;"></i>${h.name}</td>
                ${h.marks.map(m => `<td class="habit-cell"><span class="habit-mark ${m}">${habitMarkSymbol(m)}</span></td>`).join('')}
              </tr>
              <tr><td colspan="12" style="padding-bottom:10px;">
                <div class="habit-progress-row">
                  <span style="font-size:11px; color:var(--bone-faint);">цель ${h.target}/нед</span>
                  <div class="habit-progress-track"><div class="habit-progress-fill" style="width:${habitPct(h.marks, h.target)}%"></div></div>
                  <span class="habit-progress-pct">${habitPct(h.marks, h.target)}%</span>
                </div>
              </td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('sec-back').addEventListener('click', () => Router.go('/home'));
  document.getElementById('sec-logout').addEventListener('click', () => { Auth.logout(); Router.go('/login'); });
};
