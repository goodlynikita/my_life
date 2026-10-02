/* ============================================================
   ОБЩИЕ ШАБЛОНЫ ПЛАНОВ
   Автор (блогер, тренер, обычный человек) делится своим планом ссылкой
   you-app.ru/#/t/КОД. По ссылке видно, что внутри, и кнопка «Взять себе»:
   план встаёт с понедельника, веса берутся из своей истории, иначе пустые.
   Данные: FirebaseSync.shareTemplate / getShared / markSharedUse / mySharedList.
   ============================================================ */
window.ShareTpl = (function () {
  const PENDING = 'you_tpl';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toArr = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map(k => v[k]) : []);
  const pl = (n, a, b, c) => { const x = n % 10, y = n % 100; return x === 1 && y !== 11 ? a : x >= 2 && x <= 4 && (y < 12 || y > 14) ? b : c; };
  const DOWN = { 'пн': 'Пн', 'вт': 'Вт', 'ср': 'Ср', 'чт': 'Чт', 'пт': 'Пт', 'сб': 'Сб', 'вс': 'Вс' };
  const linkOf = (code) => 'https://you-app.ru/#/t/' + code;
  const toast = (t) => { if (window.TrainingAI && TrainingAI.toast) TrainingAI.toast(t); else alert(t); };

  function modal(html) {
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay';
    ov.innerHTML = `<div class="tr-modal st-modal" role="dialog">${html}</div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    return ov;
  }
  function activePlan() {
    const plans = toArr((Store.get().training || {}).plans).filter(Boolean);
    return plans.find(p => p.status === 'active') || plans[plans.length - 1] || null;
  }
  function meta(t) { const w = t.weeksCount || toArr(t.weeks).length, s = t.sessions || 0; return `${w} ${pl(w, 'неделя', 'недели', 'недель')} · ${s} ${pl(s, 'тренировка', 'тренировки', 'тренировок')}`; }
  function send(code, name) {
    const url = linkOf(code), text = `Мой план тренировок «${name}» в YOU. Забирай себе: ${url}`;
    if (navigator.share) navigator.share({ title: name, text, url }).catch(() => {});
    else { try { navigator.clipboard.writeText(text); toast('Ссылка скопирована'); } catch (e) { prompt('Скопируй ссылку', url); } }
  }

  /* ── Поделиться своим планом ── */
  async function shareModal() {
    const p = activePlan();
    const probe = p && window.CoachDash ? CoachDash.templateFrom(p, 'x') : null;
    let author = ''; try { author = localStorage.getItem('you_tpl_author') || ''; } catch (e) {}
    if (!author) { const u = FirebaseSync.currentUser && FirebaseSync.currentUser(); author = (u && u.displayName) || ''; }
    const ov = modal(`<p class="tr-modal-title">Поделиться планом</p>
      ${probe && probe.sessions ? `<div class="st-cur"><i class="ti ti-barbell"></i><span><b>План №${esc(p.number)}</b><small>${meta(probe)}</small></span></div>
      <div class="tr-modal-row"><label style="flex:1 1 100%">Название<input type="text" id="st-name" maxlength="60" placeholder="Например: Масса, 3 раза в неделю" value="${esc(p.tpl || '')}"></label></div>
      <div class="tr-modal-row"><label style="flex:1 1 100%">Автор<input type="text" id="st-author" maxlength="60" placeholder="Имя или ник" value="${esc(author)}"></label></div>
      <p class="st-err" id="st-err"></p>
      <button class="tr-modal-btn-primary st-wide" id="st-make"><i class="ti ti-link"></i> Создать ссылку</button>`
      : `<p class="st-empty">В плане пока нет тренировок. Заполни план, и им можно будет поделиться.</p>`}
      <div class="st-mine" id="st-mine"></div>
      <div class="tr-modal-actions"><button class="tr-modal-btn-secondary" id="st-close" style="flex:1">Закрыть</button></div>`);
    ov.querySelector('#st-close').onclick = () => ov.remove();
    const mine = ov.querySelector('#st-mine');
    const drawMine = async () => {
      let list = []; try { list = await FirebaseSync.mySharedList(); } catch (e) {}
      mine.innerHTML = list.length ? `<div class="st-h">Мои ссылки</div>` + list.map(x => `<div class="st-row" data-c="${esc(x.code)}">
          <span class="st-row-m"><b>${esc(x.name || 'План')}</b><small>взяли ${x.uses} · код ${esc(x.code)}</small></span>
          <button class="st-ib" data-send="${esc(x.code)}" aria-label="Отправить"><i class="ti ti-share"></i></button>
          <button class="st-ib" data-del="${esc(x.code)}" aria-label="Удалить ссылку"><i class="ti ti-trash"></i></button></div>`).join('') : '';
      mine.querySelectorAll('[data-send]').forEach(b => b.onclick = () => { const x = list.find(y => y.code === b.dataset.send); send(x.code, x.name || 'План'); });
      mine.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Удалить ссылку? Кто уже взял план, у того он останется.')) return; await FirebaseSync.removeShared(b.dataset.del).catch(() => {}); drawMine(); });
    };
    drawMine();
    const mk = ov.querySelector('#st-make'); if (!mk) return;
    mk.onclick = async () => {
      const name = ov.querySelector('#st-name').value.trim(), au = ov.querySelector('#st-author').value.trim();
      if (!name) { ov.querySelector('#st-err').textContent = 'Придумай название'; ov.querySelector('#st-name').focus(); return; }
      try { localStorage.setItem('you_tpl_author', au); } catch (e) {}
      mk.disabled = true; mk.textContent = 'Создаю…';
      try {
        const t = CoachDash.templateFrom(activePlan(), name);
        const code = await FirebaseSync.shareTemplate(t, au);
        mk.outerHTML = `<div class="st-link"><span>${esc(linkOf(code))}</span></div>
          <div class="st-btns"><button class="tr-modal-btn-primary" id="st-send"><i class="ti ti-share"></i> Отправить</button><button class="tr-modal-btn-secondary" id="st-copy"><i class="ti ti-copy"></i> Скопировать</button></div>`;
        ov.querySelector('#st-send').onclick = () => send(code, name);
        ov.querySelector('#st-copy').onclick = () => { try { navigator.clipboard.writeText(linkOf(code)); toast('Ссылка скопирована'); } catch (e) { prompt('Скопируй ссылку', linkOf(code)); } };
        drawMine();
      } catch (e) {
        mk.disabled = false; mk.innerHTML = '<i class="ti ti-link"></i> Создать ссылку';
        ov.querySelector('#st-err').textContent = /PERMISSION/i.test(String(e && (e.code || e.message))) ? 'Нет доступа. Похоже, не обновлены правила базы' : 'Не получилось. Проверь интернет';
      }
    };
  }

  /* ── Открыли ссылку: что внутри и «Взять себе» ── */
  async function open(codeArg) {
    const code = String(codeArg || localStorage.getItem(PENDING) || '').trim().toUpperCase();
    try { localStorage.removeItem(PENDING); } catch (e) {}
    if (!code || !window.FirebaseSync || !FirebaseSync.getShared) return;
    let t = null; try { t = await FirebaseSync.getShared(code); } catch (e) {}
    if (!t) { alert('План по ссылке «' + code + '» не найден. Возможно, автор его удалил.'); return; }
    const mine = FirebaseSync.currentUser && FirebaseSync.currentUser() && FirebaseSync.currentUser().uid === t.authorUid;
    const weeks = toArr(t.weeks);
    const w1 = weeks[0] ? toArr(weeks[0].days).filter(d => d && toArr(d.sessions).some(s => s && s.type !== 'Отдых')) : [];
    const mon = CoachDash.monday(new Date()), next = new Date(+mon + 7 * 864e5), F = CoachDash.fmtD;
    let start = 'next';
    const ov = modal(`<div class="st-hero"><div class="st-ico"><i class="ti ti-template"></i></div><div><p class="tr-modal-title" style="margin:0">${esc(t.name)}</p>
        <div class="st-by">${esc(t.authorName || 'Автор')} · ${meta(t)}${t.uses ? ` · взяли ${t.uses}` : ''}</div></div></div>
      <div class="st-week"><div class="st-h">Первая неделя</div>${w1.map(d => `<div class="st-day"><b>${esc(DOWN[String(d.dow || '').slice(0, 2)] || d.dow || '')}</b><div>${toArr(d.sessions).filter(s => s && s.type !== 'Отдых').map(s => `<div class="st-ses">${esc(toArr(s.groups).join(' + ') || s.type || 'Тренировка')}</div>
          <ul>${toArr(s.exercises).filter(Boolean).map(e => `<li>${esc(e.name)}${e.sets && e.reps ? ` <em>${esc(e.sets)}×${esc(e.reps)}</em>` : ''}</li>`).join('')}</ul>`).join('')}</div></div>`).join('') || '<div class="st-empty">Первая неделя пустая</div>'}
        ${weeks.length > 1 ? `<div class="st-more">и ещё ${weeks.length - 1} ${pl(weeks.length - 1, 'неделя', 'недели', 'недель')}</div>` : ''}</div>
      <div class="st-h">Начать</div>
      <div class="st-chips"><button class="st-chip" data-s="this">Этот понедельник, ${F(mon)}</button><button class="st-chip on" data-s="next">Следующий, ${F(next)}</button></div>
      <div class="tr-modal-actions"><button class="tr-modal-btn-secondary" id="st-no">Не сейчас</button><button class="tr-modal-btn-primary" id="st-take">${mine ? 'Взять ещё раз' : 'Взять себе'}</button></div>`);
    ov.querySelectorAll('.st-chip').forEach(b => b.onclick = () => { start = b.dataset.s; ov.querySelectorAll('.st-chip').forEach(x => x.classList.toggle('on', x === b)); });
    ov.querySelector('#st-no').onclick = () => ov.remove();
    ov.querySelector('#st-take').onclick = async () => {
      ov.remove();
      const from = start === 'next' ? next : mon;
      let weights = {}; try { weights = CoachDash.clientWeights(CoachDash.analyze(Store.get().training || {})); } catch (e) {}
      const r = CoachDash.applyTemplate(t, from, weights, false);
      r.weeks.forEach(w => w.days.forEach(d => d.sessions.forEach(s => { delete s.byCoach; })));
      if (typeof trSnapshotBeforeChange === 'function') trSnapshotBeforeChange();
      const plans = trGetPlans();
      const wasActive = plans.filter(p => p && p.status === 'active');
      wasActive.forEach(p => { p.status = 'archived'; });
      let weeks = r.weeks;
      /* старт со следующего понедельника: текущая неделя первой неделей нового плана, её тренировки переезжают из старого,
         иначе сегодняшняя неделя пропадёт из «Плана» */
      if (start === 'next') {
        const DOWS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
        const w0 = { weekNum: 1, range: F(mon) + ' – ' + F(new Date(+mon + 6 * 864e5)), days: DOWS.map((dw, i) => ({ date: F(new Date(+mon + i * 864e5)), dow: dw, sessions: [] })) };
        wasActive.forEach(op => toArr(op.weeks).forEach(w => toArr(w && w.days).forEach(d => {
          if (!d || typeof trDayDateOf !== 'function') return; const dt = trDayDateOf(op, d.date); if (!dt || dt < mon || dt >= next) return;
          if (typeof trMigrateDayToSessions === 'function') trMigrateDayToSessions(d);
          if (!toArr(d.sessions).length && !d.comment) return;
          const nd = w0.days.find(x => x.date === d.date); if (!nd) return;
          nd.sessions = nd.sessions.concat(toArr(d.sessions)); if (d.comment && !nd.comment) nd.comment = d.comment; if (d.done) nd.done = d.done;
          d.sessions = []; delete d.comment; delete d.done;
        })));
        weeks = [w0].concat(r.weeks).map((w, i) => Object.assign(w, { weekNum: i + 1 }));
      }
      const num = plans.reduce((m, p) => Math.max(m, +(p && p.number) || 0), 0) + 1;
      plans.push({ id: 'p' + Date.now().toString(36), number: num, startDate: (start === 'next' ? mon : from).toISOString(), status: 'active', nutrition: {}, weeks, tpl: t.name, sharedFrom: t.code, sharedBy: t.authorName || '' });
      trSavePlans(plans);
      if (!mine) FirebaseSync.markSharedUse(t.code);
      Router.go('/training'); if (Router.currentPath() === '/training') Router.render();
      setTimeout(() => toast(`План «${t.name}» добавлен${r.fromClient ? '. Веса из твоей истории: ' + r.fromClient : ''}${r.empty ? '. Без веса: ' + r.empty + ', подбери в зале или спроси AI' : ''}`), 400);
    };
  }

  return { shareModal, open, PENDING };
})();
