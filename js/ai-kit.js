/* ============================================================
   AI-КИТ: общие вещи для помощников
   AIKit.call(payload)         запрос к облачной функции ai-coach (тот же лимит сообщений)
   AIKit.json(text)            достать JSON из ответа модели
   AIKit.pickImage()           выбрать скрин, сжать до jpeg (до 1600px), вернуть dataURL
   AIKit.importModal(opts)     окно «Вставь текст или прикрепи скрин» → разбор → предпросмотр → добавить
   ============================================================ */
window.AIKit = (function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cfg = () => window.APP_CONFIG || {};

  async function call(payload) {
    const url = cfg().aiChatUrl; if (!url) throw { code: 'off' };
    const tok = window.FirebaseSync && FirebaseSync.idToken ? await FirebaseSync.idToken() : null;
    if (!tok) throw { code: 'auth' };
    let r; try { r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ idToken: tok }, payload)) }); }
    catch (e) { throw { code: 'net' }; }
    let d = {}; try { d = await r.json(); } catch (e) {}
    if (!r.ok) throw { code: d.error || 'server', used: d.used, limit: d.limit };
    return d;
  }
  function errText(e) {
    return ({
      off: 'Помощник скоро заработает.', auth: 'Войди в аккаунт заново.', net: 'Нет связи. Проверь интернет.',
      limit: 'Сообщения AI на этот месяц закончились. Первого числа счётчик обновится.', billing: 'AI отдыхает, попробуй позже.',
      'ocr-access': 'Распознавание скринов ещё не включено. Пока вставь текст.', ocr: 'Не получилось прочитать скрин. Попробуй другой или вставь текст.',
      blocked: 'Доступ к AI закрыт.',
    })[e && e.code] || 'AI не ответил. Попробуй ещё раз.';
  }
  function json(text) {
    let t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b < a) return null;
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
  }
  function pickImage() {
    return new Promise((resolve) => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = () => {
        const f = inp.files && inp.files[0]; if (!f) { resolve(null); return; }
        const img = new Image(), url = URL.createObjectURL(f);
        img.onload = () => {
          const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      };
      inp.click();
    });
  }
  const todayInfo = () => { const d = new Date(), W = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    return 'СЕГОДНЯ: ' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + ', ' + W[d.getDay()]; };

  /* Окно импорта. opts: { title, kind: 'tasks'|'spend'|'workout'|'sched', hint, context, render(items) → html строк, toItems(data) → массив, apply(items) → текст тоста } */
  function importModal(opts) {
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay aik-ov ' + (opts.cls || '');
    let img = null, items = null;
    const draw = () => {
      ov.innerHTML = `<div class="tr-modal aik"><p class="tr-modal-title">${esc(opts.title)}</p>
        ${items ? `<div class="aik-list">${items.length ? items.map((it, i) => `<label class="aik-it"><input type="checkbox" data-i="${i}" checked><div>${opts.render(it)}</div></label>`).join('') : '<div class="aik-empty">Ничего не нашёл. Попробуй другой текст или скрин.</div>'}</div>
          <div class="tr-modal-actions"><button class="tr-modal-btn-secondary" data-back>Назад</button><button class="tr-modal-btn-primary" data-apply ${items.length ? '' : 'disabled'}>Добавить</button></div>`
        : `<textarea class="aik-text" rows="6" placeholder="${esc(opts.hint || 'Вставь текст')}"></textarea>
          <div class="aik-img">${img ? `<img src="${img}" alt=""><button class="aik-x" data-noimg aria-label="Убрать скрин"><i class="ti ti-x"></i></button>` : `<button class="aik-pick" data-pick><i class="ti ti-photo-scan"></i>Прикрепить скрин</button>`}</div>
          <div class="aik-msg"></div>
          <div class="tr-modal-actions"><button class="tr-modal-btn-secondary" data-close>Отмена</button><button class="tr-modal-btn-primary" data-go><i class="ti ti-sparkles"></i> Разобрать</button></div>`}
      </div>`;
      const $ = (q) => ov.querySelector(q);
      if ($('[data-close]')) $('[data-close]').onclick = () => ov.remove();
      if ($('[data-pick]')) $('[data-pick]').onclick = async () => { const t = $('.aik-text').value; const d = await pickImage(); if (d) { img = d; draw(); $('.aik-text').value = t; } };
      if ($('[data-noimg]')) $('[data-noimg]').onclick = () => { const t = $('.aik-text').value; img = null; draw(); $('.aik-text').value = t; };
      if ($('[data-back]')) $('[data-back]').onclick = () => { items = null; draw(); };
      if ($('[data-go]')) $('[data-go]').onclick = async () => {
        const text = $('.aik-text').value.trim(); if (!text && !img) { $('.aik-msg').textContent = 'Вставь текст или прикрепи скрин'; return; }
        const b = $('[data-go]'); b.disabled = true; b.innerHTML = '<i class="ti ti-loader-2 aik-spin"></i> Разбираю…';
        try {
          const d = await call({ mode: 'parse', kind: opts.kind, text, image: img || undefined, context: todayInfo() + (opts.context ? '\n' + opts.context() : ''), messages: [{ role: 'user', text: text || 'скрин' }] });
          const data = json(d.text); items = data ? opts.toItems(data) : [];
          draw();
        } catch (e) { b.disabled = false; b.innerHTML = '<i class="ti ti-sparkles"></i> Разобрать'; $('.aik-msg').textContent = errText(e); }
      };
      if ($('[data-apply]')) $('[data-apply]').onclick = () => {
        const pick = items.filter((_, i) => { const c = ov.querySelector(`[data-i="${i}"]`); return c && c.checked; });
        if (!pick.length) return; const msg = opts.apply(pick); ov.remove(); if (msg && opts.toast) opts.toast(msg);
      };
    };
    draw();
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
    const ta = ov.querySelector('.aik-text'); if (ta) setTimeout(() => ta.focus(), 50);
  }

  return { call, json, errText, pickImage, importModal, todayInfo, esc };
})();
