/* ============================================================
   ОБРАТНАЯ СВЯЗЬ — кнопка-конверт и окно «Связаться с нами»
   Отправка: Firebase → feedback/{id}. Если не удалось (нет сети /
   правил) — текст копируется и открывается бот поддержки в Telegram.
   ============================================================ */
window.Feedback = (function () {
  const TYPES = [
    { id: 'idea',     label: 'Идея',        icon: 'ti-bulb' },
    { id: 'bug',      label: 'Ошибка',      icon: 'ti-bug' },
    { id: 'question', label: 'Вопрос',      icon: 'ti-help-circle' },
    { id: 'invite',   label: 'Нужен инвайт', icon: 'ti-ticket' },
  ];
  const supportUrl = () => (window.APP_CONFIG && window.APP_CONFIG.supportUrl) || 'https://t.me/help_youvsyou';
  const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function buttonHtml(extraClass) {
    return `<button class="fb-envelope ${extraClass || ''}" data-feedback aria-label="Обратная связь" title="Обратная связь"><i class="ti ti-mail"></i></button>`;
  }

  function openTelegram() { window.open(supportUrl(), '_blank', 'noopener'); }

  function open(opts) {
    opts = opts || {};
    let type = opts.type || 'idea';
    const user = window.FirebaseSync && FirebaseSync.currentUser ? FirebaseSync.currentUser() : null;
    const ov = document.createElement('div');
    ov.className = 'tr-modal-overlay fb-overlay';
    ov.innerHTML = `
      <div class="fb-sheet">
        <div class="fb-head">
          <div class="fb-head-ico"><i class="ti ti-mail"></i></div>
          <div class="fb-head-txt"><div class="fb-title">Связаться с нами</div><div class="fb-sub">Идеи, ошибки, доработки. Читаем всё</div></div>
          <button class="fb-x" data-close aria-label="Закрыть">×</button>
        </div>
        <button class="fb-tg" id="fb-tg"><i class="ti ti-brand-telegram"></i><span><b>Написать в Telegram</b><small>Лично в поддержку, ответим там</small></span><i class="ti ti-chevron-right fb-tg-arrow"></i></button>
        <div class="fb-or"><span>или оставь сообщение здесь</span></div>
        <div class="fb-types">${TYPES.map(t => `<button class="fb-type${t.id === type ? ' on' : ''}" data-type="${t.id}"><i class="ti ${t.icon}"></i>${t.label}</button>`).join('')}</div>
        <textarea id="fb-text" class="fb-input fb-textarea" placeholder="Что улучшить, что сломалось, чего не хватает…">${esc(opts.text || '')}</textarea>
        <div class="fb-contacts">
          <label class="fb-tg-field"><i class="ti ti-brand-telegram"></i><span>@</span><input id="fb-telegram" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ник в Telegram" value="${esc(localStorage.getItem('fb_tg') || '')}"></label>
          <input id="fb-contact" class="fb-input" type="email" inputmode="email" placeholder="Email" value="${esc(opts.contact || (user && user.email) || '')}">
        </div>
        <div class="fb-err" id="fb-err"></div>
        <button class="fb-send" id="fb-send"><i class="ti ti-send"></i> Отправить</button>
      </div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov) close(); });
    ov.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    ov.querySelector('#fb-tg').addEventListener('click', openTelegram);
    ov.querySelectorAll('.fb-type').forEach(b => b.addEventListener('click', () => {
      type = b.dataset.type; ov.querySelectorAll('.fb-type').forEach(x => x.classList.toggle('on', x === b));
    }));
    const tgIn = ov.querySelector('#fb-telegram');
    tgIn.addEventListener('input', () => { const v = tgIn.value.replace(/^https?:\/\/t\.me\//i, '').replace(/^@+/, '').replace(/\s/g, ''); if (v !== tgIn.value) tgIn.value = v; });
    setTimeout(() => { const t = ov.querySelector('#fb-text'); if (t && !opts.noFocus) t.focus(); }, 80);

    ov.querySelector('#fb-send').addEventListener('click', async () => {
      const text = ov.querySelector('#fb-text').value.trim();
      const contact = ov.querySelector('#fb-contact').value.trim();
      const telegram = ov.querySelector('#fb-telegram').value.trim().replace(/^@+/, '').replace(/^https?:\/\/t\.me\//i, '');
      try { localStorage.setItem('fb_tg', telegram); } catch (x) {}
      const err = ov.querySelector('#fb-err');
      if (text.length < 3) { err.textContent = 'Напиши пару слов 🙂'; return; }
      const btn = ov.querySelector('#fb-send');
      btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2 fb-spin"></i> Отправляю…';
      const label = (TYPES.find(t => t.id === type) || {}).label || '';
      try {
        if (!window.FirebaseSync || !FirebaseSync.sendFeedback) throw new Error('no sync');
        await FirebaseSync.sendFeedback({ type, text, contact, telegram });
        ov.querySelector('.fb-sheet').innerHTML = `
          <div class="fb-done"><i class="ti ti-circle-check"></i>
            <div class="fb-title">Спасибо, получили!</div>
            <div class="fb-sub">Если нужен быстрый ответ, напиши в Telegram.</div>
            <button class="fb-send" data-close>Готово</button>
            <button class="fb-link" id="fb-tg2">Открыть Telegram</button></div>`;
      } catch (e) {
        /* Не получилось сохранить — копируем текст и открываем бота */
        const msg = `[${label}] ${text}${telegram ? '\nTelegram: @' + telegram : ''}${contact ? '\nEmail: ' + contact : ''}`;
        try { await navigator.clipboard.writeText(msg); } catch (x) {}
        ov.querySelector('.fb-sheet').innerHTML = `
          <div class="fb-done"><i class="ti ti-clipboard-check"></i>
            <div class="fb-title">Текст скопирован</div>
            <div class="fb-sub">Отправить отсюда не вышло. Открой поддержку в Telegram и вставь сообщение, ответим там.</div>
            <button class="fb-send" id="fb-tg2"><i class="ti ti-brand-telegram"></i> Открыть Telegram</button>
            <button class="fb-link" data-close>Закрыть</button></div>`;
      }
      ov.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
      const tg2 = ov.querySelector('#fb-tg2'); if (tg2) tg2.addEventListener('click', openTelegram);
    });
  }

  /* Делегирование: любой элемент с data-feedback открывает окно */
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-feedback]');
    if (b) { e.preventDefault(); open({ type: b.dataset.feedbackType }); }
  });

  return { open, buttonHtml, openTelegram, supportUrl };
})();
