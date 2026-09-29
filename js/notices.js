/* ============================================================
   ОБЪЯВЛЕНИЯ И ЛИЧНЫЕ СООБЩЕНИЯ ОТ КОМАНДЫ
   Личное: userIndex/{uid}/notice (из админки) → показываем один раз.
   Общее: settings/announcement {active, text, at} → один раз на устройстве.
   ============================================================ */
window.Notices = (function () {
  let shownThisSession = false;
  const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function modal(title, text, onOk) {
    const ov = document.createElement('div');
    ov.className = 'tr-modal-overlay fb-overlay';
    ov.innerHTML = `<div class="fb-sheet nt-sheet">
      <div class="fb-head"><div class="fb-head-ico nt-ico"><i class="ti ti-speakerphone"></i></div>
        <div class="fb-head-txt"><div class="fb-title">${esc(title)}</div><div class="fb-sub">от команды YOU</div></div></div>
      <div class="nt-text">${esc(text).replace(/\n/g, '<br>')}</div>
      <button class="fb-send" id="nt-ok">Понятно</button>
      <button class="fb-link" id="nt-reply"><i class="ti ti-message-reply"></i> Ответить</button>
    </div>`;
    document.body.appendChild(ov);
    const close = () => { ov.remove(); onOk && onOk(); };
    ov.querySelector('#nt-ok').addEventListener('click', close);
    ov.querySelector('#nt-reply').addEventListener('click', () => { close(); window.Feedback && Feedback.open({ type: 'question' }); });
  }

  async function check() {
    if (shownThisSession || !window.FirebaseSync || !FirebaseSync.currentUser) return;
    const user = FirebaseSync.currentUser();
    if (!user) return;
    const personal = FirebaseSync.getNotice ? await FirebaseSync.getNotice(user) : null;
    if (personal) {
      shownThisSession = true;
      modal('Сообщение для тебя', personal.text, () => FirebaseSync.markNoticeSeen(user, personal.at));
      return;
    }
    if (FirebaseSync.loadSettings) await FirebaseSync.loadSettings();
    const a = FirebaseSync.getAnnouncement ? FirebaseSync.getAnnouncement() : null;
    let seen = ''; try { seen = localStorage.getItem('nt_seen') || ''; } catch (e) {}
    if (a && a.at !== seen) {
      shownThisSession = true;
      modal('Объявление', a.text, () => { try { localStorage.setItem('nt_seen', a.at); } catch (e) {} });
    }
  }
  return { check };
})();
