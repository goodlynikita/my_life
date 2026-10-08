/* ============================================================
   ЧАТ С AI-ТРЕНЕРОМ — вкладка «AI» → «Чат с тренером»
   Приложение → облачная функция Yandex Cloud → YandexGPT.
   Тренер получает короткую сводку твоих тренировок и отвечает по ней.
   Лимит: APP_CONFIG.aiChatLimit сообщений в месяц (считает сервер).
   История переписки хранится в Store → training.aiChat.
   ============================================================ */
window.TrainingChat = (function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toArr = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map(k => v[k]) : []);
  const cfg = () => window.APP_CONFIG || {};
  const LIMIT = () => cfg().aiChatLimit || 20;
  const QUICK = [
    'Почему не растёт рабочий вес?',
    'Чем заменить упражнение, если тренажёр занят?',
    'Что добавить, чтобы спина росла лучше?',
    'Сегодня мало времени, 40 минут. Как сократить тренировку?',
    'Как понять, что пора разгрузочная неделя?',
  ];
  let usage = null, busy = false, draft = '', focusInput = false, toAnswer = false;

  function msgs() { return toArr((Store.get().training || {}).aiChat).filter(m => m && m.text); }
  function saveMsgs(list) { Store.set('training.aiChat', list.slice(-40)); }

  /* Форматирование ответа: заголовки, списки (маркированные и нумерованные), жирный, курсив, код */
  function fmt(t) {
    const lines = esc(t).split(/\n/);
    let html = '', list = null;
    const close = () => { if (list) { html += '</' + list + '>'; list = null; } };
    /* ссылки кликабельные: видео-поиск показываем коротко */
    const links = (x) => x.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)»])/g, (u) => `<a class="ch-link" href="${u}" target="_blank" rel="noopener">${/youtube\.com\/results/.test(u) ? '<i class="ti ti-brand-youtube"></i> Видео по технике' : u.replace(/^https?:\/\//, '').slice(0, 40)}</a>`);
    const inline = (x) => links(x).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
    lines.forEach(l => {
      const h = l.match(/^\s*#{1,6}\s+(.*)/);
      if (h) { close(); html += '<p class="ch-h">' + inline(h[1]) + '</p>'; return; }
      const ol = l.match(/^\s*\d+[.)]\s+(.*)/);
      const ul = !ol && l.match(/^\s*[-•*]\s+(.*)/);
      if (ol || ul) {
        const kind = ol ? 'ol' : 'ul';
        if (list !== kind) { close(); html += '<' + kind + '>'; list = kind; }
        html += '<li' + (/^\s{2,}/.test(l) ? ' class="sub"' : '') + '>' + inline((ol || ul)[1]) + '</li>';
        return;
      }
      close();
      if (l.trim()) html += '<p>' + inline(l) + '</p>';
    });
    close();
    return html;
  }

  async function call(payload) {
    const url = cfg().aiChatUrl;
    if (!url) throw { code: 'off' };
    const tok = window.FirebaseSync && FirebaseSync.idToken ? await FirebaseSync.idToken() : null;
    if (!tok) throw { code: 'auth' };
    let r;
    try {
      r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: tok, ...payload }) });
    } catch (e) { throw { code: 'net' }; }
    let d = {}; try { d = await r.json(); } catch (e) {}
    if (!r.ok) throw { code: d.error || 'server', used: d.used, limit: d.limit };
    if (!payload.check && !String(d.text || '').trim()) throw { code: 'server' }; /* пустой ответ не теряем молча */
    return d;
  }

  function errText(e) {
    return ({
      off: 'Чат с тренером скоро заработает.',
      auth: 'Войди в аккаунт заново, чтобы написать тренеру.',
      net: 'Нет связи с тренером. Проверь интернет и попробуй ещё раз.',
      limit: `Лимит на этот месяц исчерпан: ${LIMIT()} из ${LIMIT()}. Новые сообщения откроются 1-го числа.`,
      billing: 'Тренер отдыхает, скоро вернётся. Попробуй позже.',
      blocked: 'Доступ к тренеру закрыт. Напиши в поддержку.',
    })[e && e.code] || 'Тренер не ответил. Попробуй ещё раз чуть позже.';
  }

  /* в ответе тренера есть тренировка списком: «Жим лёжа: 3 подхода по 10 повторений, вес 60 кг» */
  function parseWorkout(text) {
    const out = [];
    String(text || '').split(/\n/).forEach(line => {
      const m = line.match(/^\s*(?:\d+[.)]|[-•*])\s*\**([^:*]{3,60}?)\**\s*[:—–-]\s*(.+)$/); if (!m) return;
      const rest = m[2];
      const sr = rest.match(/(\d+)\s*(?:подход\S*\s*(?:по\s*)?|[xх×]\s*)(\d+)/i); if (!sr) return;
      const w = rest.match(/(\d+(?:[.,]\d+)?)\s*кг/i);
      out.push({ name: m[1].trim().replace(/\s+/g, ' '), sets: +sr[1], reps: +sr[2], weight: w ? parseFloat(w[1].replace(',', '.')) : 0 });
    });
    return out.length >= 2 ? out : null;
  }
  function toPlanModal(exs, plan, h) {
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const DW = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'], MG = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const days = Array.from({ length: 10 }, (_, i) => { const d = new Date(t0); d.setDate(t0.getDate() + i); return d; });
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay';
    ov.innerHTML = `<div class="tr-modal"><p class="tr-modal-title">В какой день?</p>
      <div class="ch-plan-sum">${exs.map(e => `<div><span>${esc(e.name)}</span><b>${e.sets}×${e.reps}${e.weight ? ' · ' + String(e.weight).replace('.', ',') + ' кг' : ''}</b></div>`).join('')}</div>
      <div class="q-days">${days.map((d, i) => `<button data-i="${i}">${i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : DW[d.getDay()] + ', ' + d.getDate() + ' ' + MG[d.getMonth()]}${TrainingAI.dayHasWorkout(plan, d) ? '<em>есть тренировка</em>' : ''}</button>`).join('')}</div>
      <div class="tr-modal-actions"><button class="tr-modal-btn-secondary" data-x>Отмена</button></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    ov.querySelector('[data-x]').onclick = () => ov.remove();
    ov.querySelectorAll('[data-i]').forEach(b => b.onclick = () => {
      const d = days[+b.dataset.i];
      if (TrainingAI.dayHasWorkout(plan, d) && !confirm('На этот день уже есть тренировка. Добавить ещё одну?')) return;
      const r = TrainingAI.addFromChat(plan, h, d, exs);
      if (r === 'nodays') { alert('Этот день за пределами плана. Создай следующий план'); return; }
      ov.remove(); h.afterTransfer && h.afterTransfer(); TrainingAI.toast && TrainingAI.toast('Добавил в План: ' + b.childNodes[0].textContent.toLowerCase());
    });
  }

  function render(content, plan, h, tabsHtml, bindTabs) {
    if (!cfg().aiChatUrl) {
      content.innerHTML = `<div class="ai-wrap">${tabsHtml}
        <div class="ch-card ch-dev">
          <span class="ch-dev-badge"><i class="ti ti-tools"></i> В разработке</span>
          <div class="ai-hero-ico"><i class="ti ti-message-chatbot"></i></div>
          <b class="ch-dev-t">Чат с AI-тренером</b>
          <p class="ch-dev-d">Скоро здесь можно будет спросить тренера о своих тренировках. Он видит твою историю, веса и прогресс и отвечает по ним, а не общими советами.</p>
          <ul class="ch-dev-l">
            <li><i class="ti ti-help-circle"></i>«Почему встал жим?» Разбор по твоим цифрам</li>
            <li><i class="ti ti-arrows-exchange"></i>Замена упражнения, если тренажёр занят</li>
            <li><i class="ti ti-heartbeat"></i>Тренировка под самочувствие и время</li>
          </ul>
          <div class="ch-dev-f">Бесплатно ${LIMIT()} сообщений в месяц</div>
        </div></div>`;
      bindTabs && bindTabs();
      return;
    }
    const list = msgs();
    const left = usage ? Math.max(0, usage.limit - usage.used) : null;
    const off = !cfg().aiChatUrl;
    content.innerHTML = `<div class="ai-wrap">${tabsHtml}
      <div class="ch-card">
        <div class="ch-head">
          <div class="ai-hero-ico sm"><i class="ti ti-message-chatbot"></i></div>
          <div class="ch-head-t"><b>Чат с тренером</b><span>Знает твои тренировки, веса и прогресс</span></div>
          <div class="ch-left${left === 0 ? ' zero' : ''}" title="Бесплатно в этом месяце">${left == null ? '' : `<b>${left}</b><span>из ${usage.limit}</span>`}</div>
        </div>
        <div class="ch-list" id="ch-list">
          ${list.length ? list.map((m, i) => `<div class="ch-msg ${m.role === 'user' ? 'me' : 'bot'}${m.err ? ' err' : ''}">${m.role === 'user' ? esc(m.text).replace(/\n/g, '<br>') : fmt(m.text)}${m.role !== 'user' && !m.err && parseWorkout(m.text) ? `<button class="ch-toplan" data-wi="${i}"><i class="ti ti-calendar-plus"></i> В план</button>` : ''}</div>`).join('')
            : `<div class="ch-empty"><i class="ti ti-sparkles"></i><b>Спроси о своих тренировках</b></div>`}
          ${busy ? '<div class="ch-msg bot ch-typing"><span></span><span></span><span></span></div>' : ''}
        </div>
        ${list.length < 2 ? `<div class="ch-quick">${QUICK.map(q => `<button class="ch-q">${esc(q)}</button>`).join('')}</div>` : ''}
        <div class="ch-input">
          <textarea id="ch-text" rows="1" placeholder="${off ? 'Чат скоро заработает' : 'Спроси тренера…'}" ${off || left === 0 ? 'disabled' : ''}></textarea>
          <button id="ch-send" aria-label="Отправить" ${off || left === 0 || busy ? 'disabled' : ''}><i class="ti ti-send"></i></button>
        </div>
        <div class="ch-foot">${off ? 'Чат подключается' : `${usage ? usage.limit : LIMIT()} сообщений в месяц${list.length ? ' · <button class="ch-clear" id="ch-clear">Очистить переписку</button>' : ''}`}</div>
      </div>
    </div>`;
    bindTabs && bindTabs();
    const box = content.querySelector('#ch-list');
    if (box) {
      /* новый ответ тренера показываем с начала, остальное прокручиваем вниз */
      const bots = box.querySelectorAll('.ch-msg.bot:not(.ch-typing)');
      const last = bots[bots.length - 1];
      if (toAnswer && last) box.scrollTop = Math.max(0, last.offsetTop - box.offsetTop - 8); else box.scrollTop = box.scrollHeight;
      toAnswer = false;
    }
    const ta = content.querySelector('#ch-text');
    /* перерисовываем только если чат всё ещё открыт: иначе ответ лёг бы поверх другой вкладки */
    const again = () => { if (content.querySelector('#ch-list') && content.isConnected) render(content, plan, h, tabsHtml, bindTabs); };
    if (ta) {
      /* черновик и фокус переживают перерисовку */
      if (draft) { ta.value = draft; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; }
      if (focusInput && !ta.disabled) setTimeout(() => ta.focus(), 0);
      ta.addEventListener('focus', () => { focusInput = true; });
      ta.addEventListener('blur', () => { setTimeout(() => { if (document.activeElement !== ta) focusInput = false; }, 0); });
      ta.addEventListener('input', () => { draft = ta.value; ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(ta.value); } });
    }
    const sb = content.querySelector('#ch-send'); if (sb) sb.addEventListener('click', () => send(ta.value));
    content.querySelectorAll('.ch-q').forEach(b => b.addEventListener('click', () => send(b.textContent)));
    content.querySelectorAll('.ch-toplan').forEach(b => b.addEventListener('click', () => { const m = list[+b.dataset.wi]; const exs = m && parseWorkout(m.text); if (exs) toPlanModal(exs, plan, h); }));
    const cl = content.querySelector('#ch-clear'); if (cl) cl.addEventListener('click', () => { if (confirm('Очистить переписку? Лимит сообщений не восстановится.')) { saveMsgs([]); again(); } });

    async function send(text) {
      text = String(text || '').trim();
      if (!text || busy || off) return;
      const l = msgs(); l.push({ role: 'user', text, at: Date.now() }); saveMsgs(l);
      draft = ''; busy = true; again();
      try {
        const context = TrainingAI.buildContext(h.getPlans(), plan);
        const d = await call({ context, messages: l.filter(m => !m.err).slice(-8).map(m => ({ role: m.role, text: m.text })) });
        usage = { used: d.used, limit: d.limit };
        l.push({ role: 'assistant', text: d.text, at: Date.now() });
      } catch (e) {
        if (e && e.code === 'limit') usage = { used: e.used || LIMIT(), limit: e.limit || LIMIT() };
        l.push({ role: 'assistant', text: errText(e), err: true, at: Date.now() });
      }
      saveMsgs(l); busy = false; toAnswer = true; again();
    }

    /* узнаём остаток лимита один раз */
    if (!off && !usage) call({ check: true }).then(d => { usage = { used: d.used, limit: d.limit }; again(); }).catch(() => {});
  }

  return { render };
})();
