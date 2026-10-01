/* ============================================================
   ТРЕНЕР КЛИЕНТА — подключение по коду / ссылке, плашка в тренировках
   Ссылка тренера: index.html#/join/КОД
   Тренер видит и ведёт ТОЛЬКО тренировки. Финансы, привычки и цели закрыты.
   ============================================================ */
window.TrainerLink = (function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PENDING = 'you_join';
  let offered = false;

  function toast(text) {
    const t = document.createElement('div'); t.className = 'ai-toast'; t.innerHTML = '<i class="ti ti-circle-check"></i> ' + esc(text);
    document.body.appendChild(t); setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3000);
  }

  /* ── Экран подключения ── */
  async function offer(codeArg) {
    const code = String(codeArg || localStorage.getItem(PENDING) || '').trim().toUpperCase();
    if (!code || !window.FirebaseSync || !FirebaseSync.findInvite) return;
    if (offered && !codeArg) return; offered = true;
    let inv = null, cur = null;
    try { inv = await FirebaseSync.findInvite(code); cur = await FirebaseSync.myTrainer(); } catch (e) {}
    localStorage.removeItem(PENDING);
    if (!inv) { alert('Код тренера «' + code + '» не найден. Проверь ссылку или попроси тренера прислать новую.'); return; }
    if (cur && cur.trainerUid === inv.trainerUid) { toast('Тебя уже ведёт ' + (inv.name || 'этот тренер')); return; }
    const ov = document.createElement('div');
    ov.className = 'tr-modal-overlay';
    ov.innerHTML = `<div class="tr-modal coach-modal tl-modal">
      <div class="coach-head"><div class="coach-ico"><i class="ti ti-user-star"></i></div>
        <div><div class="tr-modal-title" style="margin:0">Подключиться к тренеру</div><div class="coach-sub">${esc(inv.name || 'Тренер')} приглашает тебя</div></div></div>
      ${cur ? `<div class="coach-status off"><i class="ti ti-alert-triangle"></i> Сейчас тебя ведёт ${esc(cur.name)}. После подключения у него пропадёт доступ.</div>` : ''}
      <div class="tl-list">
        <div><i class="ti ti-eye"></i><span>Тренер видит <b>только тренировки</b>: план, веса, повторы и прогресс</span></div>
        <div><i class="ti ti-lock"></i><span>Финансы, привычки и цели ему <b>закрыты</b></span></div>
        <div><i class="ti ti-edit"></i><span>Тренер составляет план, а ты отмечаешь выполнение. AI-тренер помогает ему, а не заменяет</span></div>
        <div><i class="ti ti-plug-connected-x"></i><span>Отключиться можно в любой момент в разделе «Тренировки»</span></div>
      </div>
      ${nameFields()}
      <div class="tr-modal-actions">
        <button class="tr-modal-btn-secondary" id="tl-no">Не сейчас</button>
        <button class="tr-modal-btn-primary" id="tl-yes">Подключить</button>
      </div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    ov.querySelector('#tl-no').onclick = () => ov.remove();
    ov.querySelector('#tl-yes').onclick = async () => {
      const fn = readName(ov); if (!fn) return;
      const b = ov.querySelector('#tl-yes'); b.disabled = true; b.textContent = 'Подключаю…';
      try {
        await FirebaseSync.connectTrainer(code, fn);
        ov.remove(); toast('Тренер ' + (inv.name || '') + ' подключён');
        celebrate({ trainerUid: inv.trainerUid, name: inv.name });
        if (window.Router) Router.render({ keepScroll: true });
      } catch (e) {
        b.disabled = false; b.textContent = 'Подключить';
        alert(({ self: 'Это твой собственный код тренера.', full: 'У тренера закончились бесплатные места. Напиши ему.', 'not-found': 'Код не найден.' })[e && e.code] || 'Не получилось подключиться. Попробуй ещё раз.');
      }
    };
  }

  /* ── Фамилия и имя: чтобы тренер понимал, кто это ── */
  function savedName() { try { return JSON.parse(localStorage.getItem('you_fullname') || 'null') || {}; } catch (e) { return {}; } }
  function nameFields() {
    const n = savedName();
    return `<div class="tl-name"><div class="tl-name-l">Как тебя увидит тренер</div>
      <div class="tl-name-r"><input class="tr-modal-input" id="tl-last" placeholder="Фамилия" value="${esc(n.last || '')}" autocomplete="family-name">
      <input class="tr-modal-input" id="tl-first" placeholder="Имя" value="${esc(n.first || '')}" autocomplete="given-name"></div>
      <div class="tl-name-e" id="tl-name-e"></div></div>`;
  }
  function readName(ov) {
    const last = ov.querySelector('#tl-last').value.trim(), first = ov.querySelector('#tl-first').value.trim();
    if (!last || !first) { ov.querySelector('#tl-name-e').textContent = 'Укажи фамилию и имя'; (last ? ov.querySelector('#tl-first') : ov.querySelector('#tl-last')).focus(); return null; }
    try { localStorage.setItem('you_fullname', JSON.stringify({ last, first })); } catch (e) {}
    return last + ' ' + first;
  }

  /* ── Подключение: выдать ключ или ввести код тренера ── */
  function connect() {
    const cur = FirebaseSync.myTrainerCached ? FirebaseSync.myTrainerCached() : null;
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay';
    ov.innerHTML = `<div class="tr-modal coach-modal tl-modal">
      <div class="coach-head"><div class="coach-ico"><i class="ti ti-user-star"></i></div>
        <div><div class="tr-modal-title" style="margin:0">Подключить тренера</div><div class="coach-sub">Тренер будет видеть и вести только тренировки</div></div></div>
      ${cur ? `<div class="coach-status off"><i class="ti ti-alert-triangle"></i> Сейчас тебя ведёт ${esc(cur.name)}. Новый тренер его заменит.</div>` : ''}
      <button class="tl-way" id="tl-key"><i class="ti ti-key"></i><span><b>Выдать ключ доступа</b><small>Создашь ключ и отправишь тренеру. Он введёт его в своём кабинете</small></span><i class="ti ti-chevron-right"></i></button>
      <button class="tl-way" id="tl-code"><i class="ti ti-link"></i><span><b>У меня есть код тренера</b><small>Тренер прислал ссылку или 6 символов</small></span><i class="ti ti-chevron-right"></i></button>
      <div class="tr-modal-actions"><button class="tr-modal-btn-secondary" id="tl-x">Закрыть</button></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    ov.querySelector('#tl-x').onclick = () => ov.remove();
    ov.querySelector('#tl-key').onclick = () => { ov.remove(); keyModal(); };
    ov.querySelector('#tl-code').onclick = () => { ov.remove(); askCode(); };
  }

  /* копирование: Clipboard API, а если браузер не даёт, через скрытое поле */
  async function copyText(t) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(t); return true; } } catch (e) {}
    try { const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, t.length); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch (e) { return false; }
  }
  /* ── Ключ доступа ── */
  let keyOv = null;
  function keyModal() {
    const k = FirebaseSync.myAccessKey();
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay'; keyOv = ov;
    const left = (t) => { const m = Math.max(0, Math.round((t - Date.now()) / 60000)); return m >= 60 ? Math.floor(m / 60) + ' ч' + (m % 60 ? ' ' + (m % 60) + ' мин' : '') : m + ' мин'; };
    const fmtKey = (c) => c.slice(0, 4) + '-' + c.slice(4);
    function draw(k) {
      ov.innerHTML = `<div class="tr-modal coach-modal tl-modal">
        <div class="coach-head"><div class="coach-ico"><i class="ti ti-key"></i></div>
          <div><div class="tr-modal-title" style="margin:0">Ключ для тренера</div><div class="coach-sub">${k ? 'Отправь его тренеру' : 'Тренер введёт его в своём кабинете'}</div></div></div>
        ${k ? `<button class="tl-key" id="tl-copy" title="Скопировать"><b>${fmtKey(k.code)}</b><span>${esc(k.name || '')} · действует ещё ${left(k.expiresAt)}</span><em class="tl-copy"><i class="ti ti-copy"></i> Скопировать</em></button>
          <div class="tl-list">
            <div><i class="ti ti-shield-check"></i><span>Ключ одноразовый. После подключения он сгорает</span></div>
            <div><i class="ti ti-eye"></i><span>Тренер увидит <b>только тренировки</b>. Финансы, привычки и цели закрыты</span></div>
            <div><i class="ti ti-bell"></i><span>Когда тренер подключится, здесь появится уведомление</span></div>
          </div>
          <div class="tr-modal-actions">
            <button class="tr-modal-btn-secondary coach-del" id="tl-rev">Отозвать</button>
            <button class="tr-modal-btn-primary" id="tl-send"><i class="ti ti-share"></i> Отправить</button>
          </div>`
        : `${nameFields()}
          <div class="tl-list">
            <div><i class="ti ti-clock"></i><span>Ключ действует 24 часа и подходит одному тренеру</span></div>
            <div><i class="ti ti-eye"></i><span>Тренер увидит <b>только тренировки</b></span></div>
          </div>
          <div class="tr-modal-actions">
            <button class="tr-modal-btn-secondary" id="tl-x">Отмена</button>
            <button class="tr-modal-btn-primary" id="tl-mk">Создать ключ</button>
          </div>`}
      </div>`;
      const x = ov.querySelector('#tl-x'); if (x) x.onclick = close;
      const mk = ov.querySelector('#tl-mk'); if (mk) mk.onclick = async () => {
        const fn = readName(ov); if (!fn) return;
        mk.disabled = true; mk.textContent = 'Создаю…';
        try { draw(await FirebaseSync.createAccessKey(fn)); }
        catch (e) { mk.disabled = false; mk.textContent = 'Создать ключ'; alert('Не получилось создать ключ. Проверь интернет.'); }
      };
      const rev = ov.querySelector('#tl-rev'); if (rev) rev.onclick = async () => { await FirebaseSync.revokeAccessKey(); toast('Ключ отозван'); draw(null); };
      const cp = ov.querySelector('#tl-copy'); if (cp) cp.onclick = async () => {
        const ok = await copyText(fmtKey(k.code));
        const em = cp.querySelector('.tl-copy'); em.innerHTML = ok ? '<i class="ti ti-check"></i> Скопировано' : 'Не получилось, выдели вручную'; em.classList.toggle('ok', ok);
        setTimeout(() => { if (em.isConnected) { em.innerHTML = '<i class="ti ti-copy"></i> Скопировать'; em.classList.remove('ok'); } }, 1800);
      };
      const sb = ov.querySelector('#tl-send'); if (sb) sb.onclick = () => {
        const text = `Мой ключ доступа для тренера в YOU: ${fmtKey(k.code)}\nВведи его в кабинете тренера: ${location.href.split('#')[0].replace(/index\.html$/, '')}coach.html`;
        if (navigator.share) navigator.share({ text }).catch(() => {});
        else copyText(text).then(ok => toast(ok ? 'Скопировано' : 'Не получилось скопировать'));
      };
    }
    function close() { ov.remove(); keyOv = null; }
    draw(k);
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
  }

  /* ── Ввести код вручную ── */
  function askCode() {
    const v = prompt('Код тренера (6 символов). Его даёт тренер вместе со ссылкой');
    if (v && v.trim()) offer(v.trim());
  }

  /* ── Плашка «Тренер: …» в шапке тренировок ── */
  function decorate() {
    const t = window.FirebaseSync && FirebaseSync.myTrainerCached ? FirebaseSync.myTrainerCached() : null;
    const head = document.querySelector('.tr-header');
    if (!head || head.querySelector('.tl-chip')) return;
    if (!t) return;
    const chip = document.createElement('button');
    chip.className = 'tl-chip'; chip.title = 'Мой тренер';
    chip.innerHTML = `<i class="ti ti-user-star"></i><span>${esc(t.name || 'Тренер')}</span>`;
    chip.onclick = info;
    const title = head.querySelector('.tr-title');
    (title && title.parentElement ? title.parentElement : head).appendChild(chip);
    tips();
  }
  /* Подсказки для ученика тренера: один раз, отдельно от общего тура */
  let tipTimer = null;
  const TIPS = [
    { id: 'chip', sel: '.tl-chip', t: 'Твой тренер', d: 'План ведёт тренер: его правки появляются здесь сами. Нажми, чтобы посмотреть или отключить.' },
    { id: 'week', sel: '.tr-cweek', t: 'Итоги недели', d: 'Сюда тренер присылает разбор недели: что выросло и на что обратить внимание.' },
    { id: 'done', sel: '.tr-day-done', t: 'Отметка тренировки', d: 'После тренировки нажми галочку, чтобы тренер видел, что ты был. Если занимались вместе в зале, отметит он сам.' },
  ];
  function tips() {
    const u = FirebaseSync.currentUser && FirebaseSync.currentUser(); if (!u || !window.Tour || !Tour.play) return;
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => {
      if (document.querySelector('.tour-root, .tr-modal-overlay')) return;
      let seen = {}; try { seen = JSON.parse(localStorage.getItem('you_tltips_' + u.uid) || '{}') || {}; } catch (e) { return; }
      const vis = (sel) => [...document.querySelectorAll(sel)].some(el => el.getBoundingClientRect().width > 4);
      const steps = TIPS.filter(x => !seen[x.id] && vis(x.sel));
      if (!steps.length) return;
      steps.forEach(x => { seen[x.id] = 1; });
      try { localStorage.setItem('you_tltips_' + u.uid, JSON.stringify(seen)); } catch (e) {}
      Tour.play(steps, 'trainer-client');
    }, 1200);
  }
  /* неделю раскрыли, появилась галочка → покажем про неё */
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.tr-week-head, .tr-week-toggle') && FirebaseSync.myTrainerCached && FirebaseSync.myTrainerCached()) tips(); }, true);

  function info() {
    const t = FirebaseSync.myTrainerCached(); if (!t) return;
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay';
    ov.innerHTML = `<div class="tr-modal coach-modal tl-modal">
      <div class="coach-head"><div class="coach-ico"><i class="ti ti-user-star"></i></div>
        <div><div class="tr-modal-title" style="margin:0">${esc(t.name || 'Тренер')}</div><div class="coach-sub">Ведёт твои тренировки с ${new Date(t.since || Date.now()).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</div></div></div>
      <div class="coach-status on"><i class="ti ti-circle-check"></i> Тренер видит только тренировки</div>
      <div class="coach-note" style="margin:0 0 14px">План составляет тренер. Когда он что-то меняет, план у тебя обновляется сам.</div>
      <div class="tr-modal-actions">
        <button class="tr-modal-btn-secondary coach-del" id="tl-off">Отключить тренера</button>
        <button class="tr-modal-btn-primary" id="tl-ok">Понятно</button>
      </div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    ov.querySelector('#tl-ok').onclick = () => ov.remove();
    ov.querySelector('#tl-off').onclick = async () => {
      if (!confirm('Отключить тренера? Он сразу потеряет доступ к твоим тренировкам. План и записи останутся у тебя.')) return;
      await FirebaseSync.disconnectTrainer(); ov.remove(); toast('Тренер отключён');
      if (window.Router) Router.render({ keepScroll: true });
    };
  }

  /* Тренер поменял план → обновляем экран тренировок, если ничего не редактируется */
  window.addEventListener('coach-plan-update', (e) => {
    const a = document.activeElement;
    const editing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT');
    if (!editing && !document.querySelector('.tr-modal-overlay') && window.Router) Router.render({ keepScroll: true });
    toast(e.detail && e.detail.conflict ? 'Тренер только что обновил план, показываю его версию' : 'Тренер обновил план');
  });

  /* Тренер подключился по ключу (или связь пропала) */
  window.addEventListener('trainer-link-change', (e) => {
    const t = e.detail && e.detail.trainer;
    if (t && keyOv) { keyOv.remove(); keyOv = null; }
    if (t && t.akey) { try { const u = FirebaseSync.currentUser && FirebaseSync.currentUser(); if (u) localStorage.removeItem('you_akey_' + u.uid); } catch (x) {} toast('Тренер ' + (t.name || '') + ' подключён'); }
    if (t) celebrate(t);
    if (window.Router && !document.querySelector('.tr-modal-overlay')) Router.render({ keepScroll: true });
  });

  /* один раз: видео-плашка «союз заключён» */
  function celebrate(t) {
    if (!window.Celebrate || !t || !t.trainerUid) return;
    const u = FirebaseSync.currentUser && FirebaseSync.currentUser();
    Celebrate.once('cl_' + (u ? u.uid : 'me') + '_' + t.trainerUid, {
      kicker: 'Тренер в команде', title: (t.name || 'Тренер') + ' с тобой',
      sub: 'Теперь тренер видит твои тренировки и ведёт план. Ты тренируешься, <b>прогресс под контролем</b>',
      btn: 'Погнали',
    });
  }
  return { offer, askCode, connect, keyModal, decorate, info, PENDING };
})();
