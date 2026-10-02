/* ============================================================
   КОПИЛКА — блок во вкладке «Баланс»
   Store → finance.piggy = {
     startMonth: 'YYYY-MM',   с какого месяца считаем отчисления
     initial:    число,        сколько уже было на старте
     ops: [{ id, type: 'withdraw'|'deposit'|'reset', amount, date:'YYYY-MM-DD', note, cat }]
   }
   Автоматическое пополнение за месяц = доход месяца × % копилки.
   ============================================================ */

window.FinPiggy = (function () {
  const WITHDRAW_CATS = [
    { id: 'health', label: 'Здоровье',      icon: 'ti-heart-rate-monitor' },
    { id: 'repair', label: 'Поломка/ремонт', icon: 'ti-tool' },
    { id: 'car',    label: 'Машина',        icon: 'ti-car' },
    { id: 'docs',   label: 'Налоги/штрафы', icon: 'ti-file-invoice' },
    { id: 'work',   label: 'Для работы',    icon: 'ti-briefcase' },
    { id: 'other',  label: 'Другое',        icon: 'ti-dots' },
  ];

  const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const mk = (y, m) => y + '-' + String(m + 1).padStart(2, '0');
  const nowMk = () => { const d = new Date(); return mk(d.getFullYear(), d.getMonth()); };
  const parseMk = (k) => { const [y, m] = k.split('-').map(Number); return { y, m: m - 1 }; };
  const fmt = (n) => (n < 0 ? '−' : '') + finFmtFull(Math.abs(Math.round(n)));
  const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const niceDate = (iso) => { const [y, m, d] = String(iso).split('-'); return d + '.' + m + '.' + y; };

  function get() {
    const p = (Store.get().finance || {}).piggy || {};
    let ops = p.ops || [];
    if (!Array.isArray(ops)) ops = Object.values(ops);
    return { startMonth: p.startMonth || null, initial: +p.initial || 0, ops: ops.filter(Boolean) };
  }
  function save(p) { Store.set('finance.piggy', { startMonth: p.startMonth, initial: p.initial || 0, ops: p.ops || [] }); }

  /* Список месяцев от старта до текущего включительно */
  function monthsRange(start) {
    const out = []; let { y, m } = parseMk(start); const end = nowMk();
    for (let i = 0; i < 240; i++) { const k = mk(y, m); out.push(k); if (k >= end) break; m++; if (m > 11) { m = 0; y++; } }
    return out;
  }

  /* Полный расчёт: баланс, помесячная раскладка */
  function compute(pct) {
    const p = get();
    if (!p.startMonth) { p.startMonth = nowMk(); save(p); }
    let running = p.initial;
    const months = monthsRange(p.startMonth).map(k => {
      const { y, m } = parseMk(k);
      const income = finSum(finEntries(y, m));
      const auto = Math.round(income * pct / 100);
      const mOps = p.ops.filter(o => String(o.date || '').slice(0, 7) === k);
      const manual = mOps.filter(o => o.type === 'deposit').reduce((s, o) => s + (+o.amount || 0), 0);
      const out = mOps.filter(o => o.type === 'withdraw').reduce((s, o) => s + (+o.amount || 0), 0);
      const reset = mOps.filter(o => o.type === 'reset').reduce((s, o) => s + (+o.amount || 0), 0);
      running += auto + manual - out + reset;
      return { k, y, m, income, auto, manual, out, reset, end: running };
    });
    /* операции, записанные раньше стартового месяца, тоже учитываем */
    const early = p.ops.filter(o => String(o.date || '').slice(0, 7) < p.startMonth);
    const earlyNet = early.reduce((s, o) => s + (o.type === 'withdraw' ? -o.amount : +o.amount || 0), 0);
    const balance = running + earlyNet;
    const cur = months[months.length - 1];
    const withdrawnTotal = p.ops.filter(o => o.type === 'withdraw').reduce((s, o) => s + (+o.amount || 0), 0);
    const avgAuto = months.length ? Math.round(months.reduce((s, x) => s + x.auto, 0) / months.length) : 0;
    return { p, months, balance, cur, withdrawnTotal, avgAuto };
  }

  let activeView = 'months';

  function html(pct) {
    const c = compute(pct);
    const { p, months, balance, cur } = c;
    const start = parseMk(p.startMonth);

    const monthsHtml = months.slice().reverse().map(x => `
      <div class="pg-row">
        <div class="pg-row-main">
          <div class="pg-row-title">${FIN_MONTHS[x.m]} ${x.y}</div>
          <div class="pg-row-sub">${x.income ? pct + '% от поступлений' : 'поступлений не было'}</div>
        </div>
        <div class="pg-row-side">
          <div class="pg-plus">+${finFmtFull(x.auto + x.manual)}</div>
          ${x.out ? `<div class="pg-minus">−${finFmtFull(x.out)} снято</div>` : ''}
          ${x.reset ? `<div class="pg-muted">обнулено</div>` : ''}
          <div class="pg-muted">итого ${fmt(x.end)}</div>
        </div>
      </div>`).join('');

    const ops = p.ops.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
    const opsHtml = ops.length ? ops.map(o => {
      const cat = WITHDRAW_CATS.find(x => x.id === o.cat);
      const icon = o.type === 'withdraw' ? (cat ? cat.icon : 'ti-arrow-down-right') : o.type === 'deposit' ? 'ti-plus' : 'ti-refresh';
      const title = o.type === 'withdraw' ? (o.note || 'Снятие') : o.type === 'deposit' ? (o.note || 'Пополнение') : 'Обнуление копилки';
      const sub = niceDate(o.date) + (o.type === 'withdraw' && cat ? ' · ' + cat.label : '');
      const amtCls = o.type === 'withdraw' ? 'pg-minus' : o.type === 'deposit' ? 'pg-plus' : 'pg-muted';
      const amt = o.type === 'withdraw' ? '−' + finFmtFull(o.amount) : o.type === 'deposit' ? '+' + finFmtFull(o.amount) : fmt(o.amount);
      return `<div class="pg-row">
        <div class="pg-op-ico pg-op-${o.type}"><i class="ti ${icon}"></i></div>
        <div class="pg-row-main"><div class="pg-row-title">${esc(title)}</div><div class="pg-row-sub">${sub}</div></div>
        <div class="pg-row-side"><div class="${amtCls}">${amt}</div></div>
        <button class="pg-op-del" data-id="${o.id}" aria-label="Удалить операцию"><i class="ti ti-x"></i></button>
      </div>`;
    }).join('') : `<div class="pg-empty">Операций пока нет. Снятия, ручные пополнения и обнуления будут здесь.</div>`;

    return `
      <div class="pg-card">
        <div class="pg-glow"></div>
        <div class="pg-top">
          <div class="pg-label"><i class="ti ti-pig-money"></i> Копилка · ${pct}%</div>
          <button class="pg-gear" id="pg-settings" aria-label="Настройки копилки"><i class="ti ti-adjustments-horizontal"></i></button>
        </div>
        <div class="pg-balance">${fmt(balance)}</div>
        <div class="pg-sub">${cur && cur.auto ? '+' + finFmtFull(cur.auto) + ' за ' + FIN_MONTHS[cur.m].toLowerCase() : 'В этом месяце доходов ещё нет'}
          <span class="pg-dot">·</span> считаю с ${MONTHS_GEN[start.m]} ${start.y}</div>
        <div class="pg-actions">
          <button class="pg-btn pg-btn-out" id="pg-withdraw"><i class="ti ti-arrow-down-right"></i> Снять</button>
          <button class="pg-btn" id="pg-deposit"><i class="ti ti-plus"></i> Пополнить</button>
          <button class="pg-btn pg-btn-ghost" id="pg-reset" aria-label="Обнулить копилку" title="Обнулить копилку"><i class="ti ti-refresh"></i></button>
        </div>
      </div>
      <div class="pg-list-card">
        <div class="pg-seg">
          <button class="pg-seg-btn${activeView === 'months' ? ' on' : ''}" data-v="months">По месяцам</button>
          <button class="pg-seg-btn${activeView === 'ops' ? ' on' : ''}" data-v="ops">Операции${p.ops.length ? ' · ' + p.ops.length : ''}</button>
        </div>
        <div class="pg-list">${activeView === 'months' ? monthsHtml : opsHtml}</div>
      </div>`;
  }

  /* ── Модалки ── */
  function sheet(inner) {
    const ov = document.createElement('div');
    ov.className = 'tr-modal-overlay pg-overlay';
    ov.innerHTML = `<div class="pg-sheet">${inner}</div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    ov.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => ov.remove()));
    return ov;
  }
  function currentSeason() { const m = new Date().getMonth(); return m <= 1 || m === 11 ? 'winter' : m <= 4 ? 'spring' : m <= 7 ? 'summer' : 'autumn'; }

  function openWithdraw(pct, done) {
    const c = compute(pct);
    let step = 1, amount = 0, cat = 'other', note = '';
    const ov = sheet('');
    const box = ov.querySelector('.pg-sheet');

    function render() {
      if (step === 1) {
        box.innerHTML = `
          <div class="pg-sheet-head"><span>Снять из копилки</span><button class="pg-x" data-close>×</button></div>
          <div class="pg-avail">Доступно: <b>${fmt(c.balance)}</b></div>
          <label class="pg-field">Сумма
            <input id="pg-amt" type="number" inputmode="numeric" placeholder="0" value="${amount || ''}">
          </label>
          <div class="pg-field-lbl">На что</div>
          <div class="pg-cats">${WITHDRAW_CATS.map(x => `<button class="pg-cat${x.id === cat ? ' on' : ''}" data-cat="${x.id}"><i class="ti ${x.icon}"></i>${x.label}</button>`).join('')}</div>
          <label class="pg-field">Что именно
            <input id="pg-note" type="text" placeholder="Например: стоматолог, замена колодок" value="${esc(note)}">
          </label>
          <div class="pg-err" id="pg-err"></div>
          <div class="pg-sheet-actions">
            <button class="pg-sbtn pg-sbtn-ghost" data-close>Отмена</button>
            <button class="pg-sbtn pg-sbtn-main" id="pg-next">Дальше</button>
          </div>`;
        box.querySelectorAll('.pg-cat').forEach(b => b.addEventListener('click', () => {
          cat = b.dataset.cat; box.querySelectorAll('.pg-cat').forEach(x => x.classList.toggle('on', x === b));
        }));
        box.querySelector('#pg-next').addEventListener('click', () => {
          amount = Math.round(parseFloat(box.querySelector('#pg-amt').value) || 0);
          note = box.querySelector('#pg-note').value.trim();
          const err = box.querySelector('#pg-err');
          if (amount <= 0) { err.textContent = 'Укажи сумму'; return; }
          if (!note) { err.textContent = 'Напиши, на что именно: так проще честно оценить трату'; return; }
          step = 2; render();
        });
        setTimeout(() => box.querySelector('#pg-amt').focus(), 50);
      } else {
        const share = c.balance > 0 ? Math.round(amount / c.balance * 100) : 100;
        const monthsOfSaving = c.avgAuto > 0 ? (amount / c.avgAuto) : 0;
        const over = amount > c.balance;
        box.innerHTML = `
          <div class="pg-sheet-head"><span>Точно важная трата?</span><button class="pg-x" data-close>×</button></div>
          <div class="pg-warn">
            <div class="pg-warn-amt">−${finFmtFull(amount)}</div>
            <div class="pg-warn-txt">${esc(note)}<br>
              Это <b>${share}%</b> копилки${monthsOfSaving >= 0.5 ? ' и примерно <b>' + (Math.round(monthsOfSaving * 10) / 10).toString().replace('.', ',') + ' мес.</b> накоплений' : ''}.
              ${over ? '<br><b>Больше, чем есть в копилке.</b>' : ''}
            </div>
          </div>
          <div class="pg-field-lbl">Отметь, если это правда так:</div>
          <label class="pg-check"><input type="checkbox" class="pg-q"><span>Это <b>нужно</b>, а не просто «хочу»</span></label>
          <label class="pg-check"><input type="checkbox" class="pg-q"><span>Если не потратить, будут <b>проблемы</b> (здоровье, работа, поломка, штраф)</span></label>
          <label class="pg-check"><input type="checkbox" class="pg-q"><span>Это <b>не импульс</b>: я бы купил это и через неделю</span></label>
          <div class="pg-impulse" id="pg-impulse">Похоже на желание, а не на срочную трату. Копилка для непредвиденного. Лучше поставь это в цели и накопи отдельно.</div>
          <div class="pg-sheet-actions pg-col">
            <button class="pg-sbtn pg-sbtn-danger" id="pg-confirm" disabled>Снять ${finFmtFull(amount)}</button>
            <button class="pg-sbtn pg-sbtn-soft" id="pg-to-goal"><i class="ti ti-target-arrow"></i> Не снимать, добавить в цели</button>
            <button class="pg-sbtn pg-sbtn-ghost" id="pg-back">← Назад</button>
          </div>`;
        const qs = [...box.querySelectorAll('.pg-q')];
        const conf = box.querySelector('#pg-confirm');
        const imp = box.querySelector('#pg-impulse');
        const upd = () => {
          const n = qs.filter(q => q.checked).length;
          conf.disabled = n < qs.length;
          imp.style.display = (n < qs.length && qs.some(q => q.dataset.touched)) ? '' : 'none';
        };
        qs.forEach(q => q.addEventListener('change', () => { q.dataset.touched = '1'; upd(); }));
        upd();
        box.querySelector('#pg-back').addEventListener('click', () => { step = 1; render(); });
        conf.addEventListener('click', () => {
          const p = get();
          p.ops.push({ id: 'pg_' + Date.now(), type: 'withdraw', amount, date: today(), note, cat });
          save(p); ov.remove(); done();
        });
        box.querySelector('#pg-to-goal').addEventListener('click', () => {
          try {
            const list = typeof goalsGet === 'function' ? goalsGet() : ((Store.get().goals || {}).directions || []).filter(Boolean);
            list.push({ id: 'g_' + Date.now(), cat: 'Желание', name: note, amount, done: false, season: currentSeason(), month: new Date().getMonth() + 1 });
            if (typeof goalsSave === 'function') goalsSave(list); else Store.set('goals.directions', list);
          } catch (e) { console.error(e); }
          box.innerHTML = `<div class="pg-done"><i class="ti ti-circle-check"></i><div><b>«${esc(note)}»</b> добавлено в цели.<br>Копилка не тронута 💪</div>
            <button class="pg-sbtn pg-sbtn-main" data-close>Отлично</button></div>`;
          box.querySelector('[data-close]').addEventListener('click', () => { ov.remove(); done(); });
        });
      }
      box.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => ov.remove()));
    }
    render();
  }

  function openDeposit(done) {
    const ov = sheet(`
      <div class="pg-sheet-head"><span>Пополнить копилку</span><button class="pg-x" data-close>×</button></div>
      <div class="pg-hint">Отчисления с доходов добавляются сами. Здесь можно добавить, если отложил что-то сверху.</div>
      <label class="pg-field">Сумма<input id="pg-amt" type="number" inputmode="numeric" placeholder="0"></label>
      <label class="pg-field">Комментарий<input id="pg-note" type="text" placeholder="Необязательно"></label>
      <div class="pg-err" id="pg-err"></div>
      <div class="pg-sheet-actions">
        <button class="pg-sbtn pg-sbtn-ghost" data-close>Отмена</button>
        <button class="pg-sbtn pg-sbtn-main" id="pg-ok">Пополнить</button>
      </div>`);
    setTimeout(() => ov.querySelector('#pg-amt').focus(), 50);
    ov.querySelector('#pg-ok').addEventListener('click', () => {
      const amount = Math.round(parseFloat(ov.querySelector('#pg-amt').value) || 0);
      if (amount <= 0) { ov.querySelector('#pg-err').textContent = 'Укажи сумму'; return; }
      const p = get();
      p.ops.push({ id: 'pg_' + Date.now(), type: 'deposit', amount, date: today(), note: ov.querySelector('#pg-note').value.trim() });
      save(p); ov.remove(); done();
    });
  }

  function openReset(pct, done) {
    const c = compute(pct);
    const ov = sheet(`
      <div class="pg-sheet-head"><span>Обнулить копилку?</span><button class="pg-x" data-close>×</button></div>
      <div class="pg-warn"><div class="pg-warn-amt">${fmt(c.balance)} → 0₽</div>
        <div class="pg-warn-txt">Баланс станет нулевым, отчисления со следующих доходов продолжат копиться. История месяцев и операций сохранится.</div></div>
      <label class="pg-check"><input type="checkbox" id="pg-sure"><span>Да, я перевёл/потратил эти деньги и хочу начать заново</span></label>
      <div class="pg-sheet-actions">
        <button class="pg-sbtn pg-sbtn-ghost" data-close>Отмена</button>
        <button class="pg-sbtn pg-sbtn-danger" id="pg-ok" disabled>Обнулить</button>
      </div>`);
    const ok = ov.querySelector('#pg-ok');
    ov.querySelector('#pg-sure').addEventListener('change', e => { ok.disabled = !e.target.checked; });
    ok.addEventListener('click', () => {
      const p = get();
      p.ops.push({ id: 'pg_' + Date.now(), type: 'reset', amount: -Math.round(c.balance), date: today(), note: '' });
      save(p); ov.remove(); done();
    });
  }

  function openSettings(done) {
    const p = get();
    const d = new Date(); let opts = '';
    for (let i = 0; i < 36; i++) {
      let m = d.getMonth() - i, y = d.getFullYear();
      while (m < 0) { m += 12; y--; }
      const k = mk(y, m);
      opts += `<option value="${k}" ${k === p.startMonth ? 'selected' : ''}>${FIN_MONTHS[m]} ${y}</option>`;
    }
    const ov = sheet(`
      <div class="pg-sheet-head"><span>Настройки копилки</span><button class="pg-x" data-close>×</button></div>
      <label class="pg-field">Считать отчисления с месяца<select id="pg-start">${opts}</select></label>
      <label class="pg-field">Уже было в копилке на старте, ₽<input id="pg-init" type="number" inputmode="numeric" value="${p.initial || ''}" placeholder="0"></label>
      <div class="pg-hint">Процент отчислений меняется в «Настроить расходы и цель» ниже.</div>
      <div class="pg-sheet-actions">
        <button class="pg-sbtn pg-sbtn-ghost" data-close>Отмена</button>
        <button class="pg-sbtn pg-sbtn-main" id="pg-ok">Сохранить</button>
      </div>`);
    ov.querySelector('#pg-ok').addEventListener('click', () => {
      const q = get();
      q.startMonth = ov.querySelector('#pg-start').value;
      q.initial = Math.round(parseFloat(ov.querySelector('#pg-init').value) || 0);
      save(q); ov.remove(); done();
    });
  }

  function bind(root, pct, rerender) {
    const $ = (s) => root.querySelector(s);
    if (!$('.pg-card')) return;
    $('#pg-withdraw').addEventListener('click', () => openWithdraw(pct, rerender));
    $('#pg-deposit').addEventListener('click', () => openDeposit(rerender));
    $('#pg-reset').addEventListener('click', () => openReset(pct, rerender));
    $('#pg-settings').addEventListener('click', () => openSettings(rerender));
    root.querySelectorAll('.pg-seg-btn').forEach(b => b.addEventListener('click', () => { activeView = b.dataset.v; rerender(); }));
    root.querySelectorAll('.pg-op-del').forEach(b => b.addEventListener('click', () => {
      if (!confirm('Удалить эту операцию? Баланс пересчитается.')) return;
      const p = get(); p.ops = p.ops.filter(o => o.id !== b.dataset.id); save(p); rerender();
    }));
  }

  return { html, bind, compute };
})();
