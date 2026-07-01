/* ============================================================
   FINANCE SCREEN — style example (navy vault + gold)
   ============================================================ */

window.Screens = window.Screens || {};

const FINANCE_DEMO_ROWS = [
  { date: '01', amount: 3500, other: false },
  { date: '02', amount: 3000, other: false },
  { date: '07', amount: 1000, other: true },
  { date: '15', amount: 30000, other: false },
  { date: '16', amount: 3000, other: false },
  { date: '22', amount: 3000, other: true },
];

window.Screens.finance = function (mount) {
  const role = Auth.role();
  const total = FINANCE_DEMO_ROWS.reduce((s, r) => s + r.amount, 0);

  mount.innerHTML = `
    <div class="fin-screen">
      <div class="fin-header">
        <div style="display:flex; align-items:center; gap:10px;">
          <button class="fin-back" id="fin-back"><i class="ti ti-arrow-left"></i></button>
          <p class="fin-title">Финансы</p>
        </div>
        <button class="fin-back" id="fin-logout"><i class="ti ti-logout"></i></button>
      </div>
      <div class="fin-tabs">
        <button class="fin-tab active" data-tab="month">Июнь 2026</button>
        <button class="fin-tab" data-tab="year">Этот год</button>
        <button class="fin-tab" data-tab="history">Прошлые года</button>
        <button class="fin-tab" data-tab="total">Всего</button>
      </div>
      <div class="fin-body" id="fin-content"></div>
    </div>
  `;

  const content = document.getElementById('fin-content');
  content.innerHTML = `
    <div class="fin-card">
      <div class="fin-card-title">Итог месяца</div>
      <div class="fin-metric-grid">
        <div class="fin-metric">
          <div class="fin-metric-label">Доход, июнь</div>
          <div class="fin-metric-value gold">${total.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div class="fin-metric">
          <div class="fin-metric-label">Профит к июню 2025</div>
          <div class="fin-metric-value green">+15.9%</div>
        </div>
        <div class="fin-metric">
          <div class="fin-metric-label">Средний доход / мес (2026)</div>
          <div class="fin-metric-value">137 917 ₽</div>
        </div>
      </div>
    </div>

    <div class="fin-card">
      <div class="fin-card-title">Приходы · июнь</div>
      ${FINANCE_DEMO_ROWS.map(r => `
        <div class="fin-row">
          <span class="fin-row-date">${r.date} июня</span>
          <span class="fin-row-amount ${r.other ? 'other-money' : ''}">${r.amount.toLocaleString('ru-RU')} ₽</span>
        </div>
      `).join('')}
    </div>
  `;

  document.getElementById('fin-back').addEventListener('click', () => Router.go('/home'));
  document.getElementById('fin-logout').addEventListener('click', () => { Auth.logout(); Router.go('/login'); });
};
