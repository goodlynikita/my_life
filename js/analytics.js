/* ============================================================
   ANALYTICS — счётчики для админки, ошибки, «позови друга»,
   вопрос «порекомендуешь?». Никаких весов, денег и текстов:
   только какие разделы человек трогал и в какие дни.
   ============================================================ */
window.Analytics = (() => {
  const SECTIONS = { training: 'train', habits: 'habit', finance: 'fin', goals: 'goal', home: 'ui' };
  let pending = {}, timer = null;
  const esc = (t) => String(t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dayKey = () => { const d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
  const ready = () => !!(window.FirebaseSync && FirebaseSync.currentUser && FirebaseSync.currentUser() && !(FirebaseSync.isCoach && FirebaseSync.isCoach()));
  const isPwa = () => { try { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };

  function ev(name, n) { if (!/^[a-z]{2,12}$/.test(name)) return; pending[name] = (pending[name] || 0) + (n || 1); schedule(); }
  function schedule() { clearTimeout(timer); timer = setTimeout(flush, 30000); }
  function flush() {
    clearTimeout(timer);
    if (!ready()) return;
    const c = pending; pending = {};
    const day = dayKey(), extra = { pwa: isPwa() };
    /* d: дни, когда заходил; w: дни, когда что-то записал */
    if (Object.keys(c).some(k => k !== 'open')) extra['w/' + day] = 1;
    FirebaseSync.track(c, day, extra);
  }

  /* любое изменение данных = действие в разделе */
  function hookStore() {
    if (typeof Store === 'undefined' || !Store || Store.__an) return; Store.__an = true;
    const orig = Store.set;
    Store.set = function (path, val) {
      try { const p = String(path || ''); const sec = SECTIONS[p.split('.')[0]];
        /* служебные записи (подсказки, пересчёт AI) действием не считаем */
        if (sec && ready() && !/^(home\.tour|training\.ai$|home\.planBarVisible)/.test(p)) ev(sec); } catch (e) {}
      return orig.apply(this, arguments);
    };
  }

  /* ошибки: не больше 5 за сессию, шум браузеров пропускаем */
  function hookErrors() {
    const noise = /ResizeObserver|Script error|Load failed|NetworkError|Failed to fetch|AbortError|chrome-extension|moz-extension/i;
    const send = (msg, src) => { if (!msg || noise.test(msg) || noise.test(src || '') || !ready()) return; FirebaseSync.logError({ msg, src, scr: location.hash }); };
    window.addEventListener('error', (e) => send(e.message || (e.error && e.error.message), (e.filename || '').split('/').pop() + ':' + (e.lineno || '')));
    window.addEventListener('unhandledrejection', (e) => { const r = e.reason; send(r && (r.message || String(r)), 'promise'); });
  }

  /* ── Позови друга ── */
  function inviteLink() {
    const u = FirebaseSync.currentUser(); if (!u) return '';
    return location.href.split('#')[0].split('?')[0].replace(/index\.html$/, '') + 'start.html?ref=' + encodeURIComponent(u.uid);
  }
  async function copy(t) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(t); return true; } } catch (e) {}
    try { const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;top:-1000px;opacity:0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch (e) { return false; }
  }
  async function inviteFriend() {
    const link = inviteLink(); if (!link) return;
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay';
    ov.innerHTML = `<div class="tr-modal coach-modal tl-modal">
      <div class="coach-head"><div class="coach-ico"><i class="ti ti-gift"></i></div>
        <div><div class="tr-modal-title" style="margin:0">Позови друга</div><div class="coach-sub">Вместе тренироваться веселее</div></div></div>
      <button class="tl-key an-link" id="an-copy"><span style="font-size:13px;color:#C7D2FE;word-break:break-all">${esc(link)}</span><em class="tl-copy"><i class="ti ti-copy"></i> Скопировать</em></button>
      <div class="tl-list"><div><i class="ti ti-users"></i><span id="an-cnt">Считаю, сколько уже пришло…</span></div>
        <div><i class="ti ti-lock"></i><span>Друг увидит только своё. Твои данные остаются твоими</span></div></div>
      <div class="tr-modal-actions"><button class="tr-modal-btn-secondary" id="an-x">Закрыть</button><button class="tr-modal-btn-primary" id="an-share"><i class="ti ti-share"></i> Отправить</button></div></div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
    ov.querySelector('#an-x').onclick = () => ov.remove();
    ov.querySelector('#an-copy').onclick = async () => { const ok = await copy(link); const em = ov.querySelector('.tl-copy'); em.innerHTML = ok ? '<i class="ti ti-check"></i> Скопировано' : 'Выдели вручную'; em.classList.toggle('ok', ok); };
    ov.querySelector('#an-share').onclick = () => {
      const text = 'Я веду тренировки, привычки и деньги в YOU. Присоединяйся: ' + link;
      if (navigator.share) navigator.share({ text }).catch(() => {}); else copy(text);
    };
    const r = await FirebaseSync.myRefs(); const n = r ? Object.values(r).filter(x => x && x.kind === 'friend').length : null;
    const el = ov.querySelector('#an-cnt'); if (el) el.textContent = n == null ? 'Скинь ссылку, и друг сразу попадёт на страницу YOU' : n ? `По твоей ссылке уже пришло: ${n}` : 'Пока никто не пришёл. Скинь ссылку в чат с друзьями';
  }

  /* ── Порекомендуешь? Через 10+ дней и 3+ активных дня, один раз ── */
  async function maybeNps() {
    if (!ready()) return;
    const u = FirebaseSync.currentUser();
    const k = 'you_nps_' + u.uid; try { if (localStorage.getItem(k)) return; } catch (e) {}
    const created = u.metadata && u.metadata.creationTime ? new Date(u.metadata.creationTime) : null;
    if (!created || Date.now() - created < 10 * 864e5) return;
    const m = await FirebaseSync.getIndexMeta(); if (!m || m.nps != null) { try { if (m && m.nps != null) localStorage.setItem(k, '1'); } catch (e) {} return; }
    if (Object.keys(m.d || {}).length < 3) return;
    if (document.querySelector('.tr-modal-overlay, .fb-overlay, .cel-ov')) return;
    let score = null;
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay';
    ov.innerHTML = `<div class="tr-modal coach-modal tl-modal">
      <div class="coach-head"><div class="coach-ico"><i class="ti ti-heart-handshake"></i></div>
        <div><div class="tr-modal-title" style="margin:0">Один вопрос</div><div class="coach-sub">Займёт 5 секунд</div></div></div>
      <div class="an-q">Насколько вероятно, что ты посоветуешь YOU другу?</div>
      <div class="an-sc">${Array.from({ length: 11 }, (_, i) => `<button data-s="${i}">${i}</button>`).join('')}</div>
      <div class="an-lg"><span>точно нет</span><span>точно да</span></div>
      <textarea class="an-tx" id="an-tx" rows="3" placeholder="Что мешает или чего не хватает? Можно не писать" hidden></textarea>
      <div class="tr-modal-actions"><button class="tr-modal-btn-secondary" id="an-later">Не сейчас</button><button class="tr-modal-btn-primary" id="an-send" disabled>Отправить</button></div></div>`;
    document.body.appendChild(ov);
    const done = () => { try { localStorage.setItem(k, '1'); } catch (e) {} ov.remove(); };
    ov.querySelectorAll('.an-sc button').forEach(b => b.onclick = () => { score = +b.dataset.s; ov.querySelectorAll('.an-sc button').forEach(x => x.classList.toggle('on', x === b)); ov.querySelector('#an-tx').hidden = false; ov.querySelector('#an-send').disabled = false; });
    ov.querySelector('#an-later').onclick = () => { try { localStorage.setItem(k, 'later'); } catch (e) {} FirebaseSync.track({}, null, { nps: -1 }); ov.remove(); };
    ov.querySelector('#an-send').onclick = async () => {
      const text = ov.querySelector('#an-tx').value.trim();
      try { await FirebaseSync.sendFeedback({ type: 'nps', score, text: `Оценка ${score} из 10` + (text ? '\n' + text : '') }); } catch (e) {}
      FirebaseSync.track({}, null, { nps: score });
      done();
      const t = document.createElement('div'); t.className = 'ai-toast'; t.innerHTML = '<i class="ti ti-circle-check"></i> Спасибо! Это правда помогает';
      document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
    };
  }

  /* запоминаем, кто позвал: #/r/UID или start.html?ref=UID */
  function captureRef() {
    try {
      const q = new URLSearchParams(location.search); const r = q.get('ref');
      const h = (location.hash || '').match(/^#\/r\/([A-Za-z0-9_-]{2,64})/);
      const by = r || (h && h[1]);
      if (by && !localStorage.getItem('you_ref')) localStorage.setItem('you_ref', JSON.stringify({ by, kind: 'friend', at: Date.now() }));
      if (h) location.hash = '/register';
    } catch (e) {}
  }

  function init() {
    captureRef(); hookStore(); hookErrors();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    window.addEventListener('pagehide', flush);
    /* открыл приложение = активный день, даже если ничего не менял */
    setTimeout(() => { if (ready()) { pending.open = (pending.open || 0) + 1; flush(); } }, 4000);
    setTimeout(maybeNps, 25000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  return { ev, flush, inviteFriend, maybeNps, inviteLink };
})();
