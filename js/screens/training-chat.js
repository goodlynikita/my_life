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
    'Почему у меня встал рабочий вес?',
    'Чем заменить упражнение, если тренажёр занят?',
    'Что добавить, чтобы спина росла лучше?',
    'Сегодня мало времени, 40 минут. Как сократить тренировку?',
    'Как понять, что пора разгрузочная неделя?',
  ];
  let usage = null, busy = false;

  function msgs() { return toArr((Store.get().training || {}).aiChat).filter(m => m && m.text); }
  function saveMsgs(list) { Store.set('training.aiChat', list.slice(-40)); }

  /* Простое форматирование ответа: абзацы, списки, жирный */
  function fmt(t) {
    const lines = esc(t).split(/\n/);
    let html = '', inList = false;
    lines.forEach(l => {
      const li = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)/);
      if (li) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + li[1] + '</li>'; return; }
      if (inList) { html += '</ul>'; inList = false; }
      if (l.trim()) html += '<p>' + l + '</p>';
    });
    if (inList) html += '</ul>';
    return html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
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
    return d;
  }

  function errText(e) {
    return ({
      off: 'Чат с тренером скоро заработает.',
      auth: 'Войди в аккаунт заново, чтобы написать тренеру.',
      net: 'Нет связи с тренером. Проверь интернет и попробуй ещё раз.',
      limit: `Лимит на этот месяц исчерпан: ${LIMIT()} из ${LIMIT()}. Новые сообщения откроются 1-го числа.`,
      billing: 'Тренер отдыхает, скоро вернётся. Попробуй позже.',
    })[e && e.code] || 'Тренер не ответил. Попробуй ещё раз чуть позже.';
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
          ${list.length ? list.map(m => `<div class="ch-msg ${m.role === 'user' ? 'me' : 'bot'}${m.err ? ' err' : ''}">${m.role === 'user' ? esc(m.text).replace(/\n/g, '<br>') : fmt(m.text)}</div>`).join('')
            : `<div class="ch-empty"><i class="ti ti-sparkles"></i><b>Спроси о своих тренировках</b><span>Почему встал вес, чем заменить упражнение, как перестроить тренировку под самочувствие. Тренер видит твою историю и отвечает по ней.</span></div>`}
          ${busy ? '<div class="ch-msg bot ch-typing"><span></span><span></span><span></span></div>' : ''}
        </div>
        ${list.length < 2 ? `<div class="ch-quick">${QUICK.map(q => `<button class="ch-q">${esc(q)}</button>`).join('')}</div>` : ''}
        <div class="ch-input">
          <textarea id="ch-text" rows="1" placeholder="${off ? 'Чат скоро заработает' : 'Спроси тренера…'}" ${off || left === 0 ? 'disabled' : ''}></textarea>
          <button id="ch-send" aria-label="Отправить" ${off || left === 0 || busy ? 'disabled' : ''}><i class="ti ti-send"></i></button>
        </div>
        <div class="ch-foot">${off ? 'Чат подключается' : `Бесплатно ${LIMIT()} сообщений в месяц${list.length ? ' · <button class="ch-clear" id="ch-clear">Очистить переписку</button>' : ''}`}</div>
      </div>
    </div>`;
    bindTabs && bindTabs();
    const box = content.querySelector('#ch-list'); if (box) box.scrollTop = box.scrollHeight;
    const ta = content.querySelector('#ch-text');
    const again = () => render(content, plan, h, tabsHtml, bindTabs);
    if (ta) {
      ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(ta.value); } });
    }
    const sb = content.querySelector('#ch-send'); if (sb) sb.addEventListener('click', () => send(ta.value));
    content.querySelectorAll('.ch-q').forEach(b => b.addEventListener('click', () => send(b.textContent)));
    const cl = content.querySelector('#ch-clear'); if (cl) cl.addEventListener('click', () => { if (confirm('Очистить переписку? Лимит сообщений не восстановится.')) { saveMsgs([]); again(); } });

    async function send(text) {
      text = String(text || '').trim();
      if (!text || busy || off) return;
      const l = msgs().filter(m => !m.err); l.push({ role: 'user', text, at: Date.now() }); saveMsgs(l);
      busy = true; again();
      try {
        const context = TrainingAI.buildContext(h.getPlans(), plan);
        const d = await call({ context, messages: l.slice(-8).map(m => ({ role: m.role, text: m.text })) });
        usage = { used: d.used, limit: d.limit };
        l.push({ role: 'assistant', text: d.text, at: Date.now() });
      } catch (e) {
        if (e && e.code === 'limit') usage = { used: e.used || LIMIT(), limit: e.limit || LIMIT() };
        l.push({ role: 'assistant', text: errText(e), err: true, at: Date.now() });
      }
      saveMsgs(l); busy = false; again();
    }

    /* узнаём остаток лимита один раз */
    if (!off && !usage) call({ check: true }).then(d => { usage = { used: d.used, limit: d.limit }; again(); }).catch(() => {});
  }

  return { render };
})();
