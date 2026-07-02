/* ============================================================
   GOALS SCREEN — style example (graphite + brass)
   ============================================================ */

window.Screens = window.Screens || {};

const GOALS_DEMO = [
  { name: 'Дом (ПВ)', amount: 3000000, done: false },
  { name: 'Ремонт дома', amount: 2000000, done: false },
  { name: 'Новая машина', amount: 1200000, done: false },
  { name: 'Ремонт кузова', amount: 60000, done: true },
  { name: 'Одежда', amount: 25000, done: true },
  { name: 'Ракетка', amount: 20000, done: false },
];

window.Screens.goals = function (mount) {
  const role = Auth.role();
  const total = GOALS_DEMO.reduce((s, g) => s + g.amount, 0);
  const doneSum = GOALS_DEMO.filter(g => g.done).reduce((s, g) => s + g.amount, 0);

  mount.innerHTML = `
    <div class="theme-dark">
      <div class="sec-header">
        <div style="display:flex; align-items:center; gap:10px;">
          <button class="sec-back" id="sec-back"><i class="ti ti-arrow-left"></i></button>
          <p class="sec-title">Цели</p>
        </div>
        <button class="sec-back" id="sec-logout"><i class="ti ti-logout"></i></button>
      </div>
      <div class="sec-tabs">
        <button class="sec-tab active" data-season="winter">Зима</button>
        <button class="sec-tab" data-season="spring">Весна</button>
        <button class="sec-tab" data-season="summer">Лето</button>
        <button class="sec-tab" data-season="autumn">Осень</button>
        <button class="sec-tab" data-season="december">Декабрь</button>
      </div>
      <div class="sec-body" id="goals-content"></div>
    </div>
  `;

  const content = document.getElementById('goals-content');
  content.innerHTML = `
    <div class="sec-card">
      <div class="sec-card-title">Цель года</div>
      <div class="sec-metric-grid">
        <div class="sec-metric">
          <div class="sec-metric-label">Общая цель</div>
          <div class="sec-metric-value accent">${total.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div class="sec-metric">
          <div class="sec-metric-label">Уже закрыто</div>
          <div class="sec-metric-value">${doneSum.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div class="sec-metric">
          <div class="sec-metric-label">Прогресс</div>
          <div class="sec-metric-value accent">${Math.round(doneSum / total * 100)}%</div>
        </div>
      </div>
    </div>

    <div class="sec-card">
      <div class="sec-card-title">Цели по направлениям</div>
      ${GOALS_DEMO.map(g => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-top:0.5px solid var(--steel-line);">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="habit-mark ${g.done ? 'done' : ''}" style="cursor:default;">${g.done ? '<i class=\"ti ti-check\"></i>' : ''}</span>
            <span style="font-size:14px; color:var(--bone); ${g.done ? 'text-decoration:line-through; color:var(--bone-faint);' : ''}">${g.name}</span>
          </div>
          <span class="num" style="font-size:14px; font-weight:600; color:var(--bone);">${g.amount.toLocaleString('ru-RU')} ₽</span>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('sec-back').addEventListener('click', () => Router.go('/home'));
  document.getElementById('sec-logout').addEventListener('click', () => { Auth.logout(); Router.go('/login'); });
};
