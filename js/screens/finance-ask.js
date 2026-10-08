/* ============================================================
   ПОМОЩНИК ПО ДЕНЬГАМ (вкладка «Помощник» в Финансах)
   Спрашиваешь своими словами: «сколько ухожу на кофе за год», «когда купить AirPods»,
   «потяну ли рассрочку 40 000 на 6 месяцев». Ответ считает AI по твоим данным.
   Сервер: та же функция ai-coach, mode: 'finance', общий лимит сообщений.
   Переписка: finance.aiChat (последние 30).
   ============================================================ */
window.FinAsk = (function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toArr = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).sort((a, b) => a - b).map(k => v[k]) : []);
  const cfg = () => window.APP_CONFIG || {};
  const rub = (n) => Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  const MON = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const QUICK = ['Куда уходят деньги в этом месяце?', 'Сколько я трачу на кафе и кофе за год?', 'Когда лучше купить что-то за 20 000?', 'Сколько месяцев копить на мои цели?'];
  let busy = false, draft = '', usage = null;

  function msgs() { return toArr((Store.get().finance || {}).aiChat).filter(m => m && m.text); }
  function saveMsgs(l) { Store.set('finance.aiChat', l.slice(-30)); }

  /* ── Данные для помощника: компактно, только цифры ── */
  function buildContext() {
    const FS = window.FinSpend; const L = [];
    const now = new Date();
    L.push('СЕГОДНЯ: ' + now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/\.$/, '') + '.');
    const fin = Store.get().finance || {};
    if (+fin.payday) L.push('Зарплата приходит ' + fin.payday + '-го числа.');
    /* доходы за 6 месяцев */
    const inc = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); let v = 0; try { v = toArr(finEntries(d.getFullYear(), d.getMonth())).reduce((s, e) => s + ((e && +e.amount) || 0), 0); } catch (e) {} inc.push(MON[d.getMonth()] + ' ' + rub(v)); }
    L.push('ДОХОДЫ по месяцам: ' + inc.join(', ') + '.');
    if (!FS) return L.join('\n');
    const b = FS.budget(); const catName = {}; b.cats.forEach(c => { catName[c.id] = c.name; });
    L.push('Категории бюджета (план в месяц): ' + (b.cats.map(c => `${c.name}${+c.amt ? ' ' + rub(+c.amt) : ''}${+c.day ? ' (платёж ' + c.day + '-го)' : ''}`).join('; ') || 'не настроены') + '.');
    L.push('В копилку откладывается ' + b.savePct + '% дохода.');
    try { if (window.FinPiggy && FinPiggy.compute) { const pg = FinPiggy.compute(b.savePct); L.push('Копилка сейчас: ' + rub(pg.balance) + '.'); } } catch (e) {}
    /* траты по месяцам и категориям, 3 месяца */
    const notes = {};
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1), ym = FS.ymKey(d);
      const raw = toArr((fin.spend || {})[ym]).filter(x => x && +x.amt > 0);
      const by = {}; let tot = 0;
      raw.forEach(x => { const k = x.once ? 'разовые платежи' : (catName[x.cat] || 'Другое'); by[k] = (by[k] || 0) + (+x.amt); tot += +x.amt;
        const n = String(x.note || '').trim().toLowerCase(); if (n) { notes[n] = notes[n] || { s: 0, c: 0 }; notes[n].s += +x.amt; notes[n].c++; } });
      L.push(`ТРАТЫ ${MON[d.getMonth()]}${i === 0 ? ' (идёт, ' + now.getDate() + ' дн.)' : ''}: всего ${rub(tot)}, записей ${raw.length}` + (tot ? '; ' + Object.entries(by).sort((a, b2) => b2[1] - a[1]).map(([k, v]) => k + ' ' + rub(v)).join(', ') : '') + '.');
    }
    const top = Object.entries(notes).sort((a, b2) => b2[1].s - a[1].s).slice(0, 25);
    if (top.length) L.push('Частые траты за 3 месяца (название: сумма, раз): ' + top.map(([n, v]) => `${n}: ${rub(v.s)}, ${v.c}`).join('; ') + '.');
    /* сейчас: свободно и норма */
    try { const c = FS.calc(now); L.push(`СЕЙЧАС: период до ${new Date(c.end - 864e5).toLocaleDateString('ru-RU')}, заработано ${rub(c.inc)}${c.est ? ' (оценка по прошлому месяцу)' : ''}, в копилку ${rub(c.save)}, потрачено ${rub(c.spent)}, свободно ${rub(c.free)}, дней осталось ${c.daysLeft}, норма в день ${rub(c.perDay)}.`);
      const pays = FS.payments(c, now).filter(p => !p.paid).slice(0, 15);
      if (pays.length) L.push('БЛИЖАЙШИЕ ПЛАТЕЖИ: ' + pays.map(p => `${p.name} ${rub(p.left)} ${p.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}${p.late ? ' (просрочен)' : ''}`).join('; ') + '.'); } catch (e) {}
    /* цели */
    try { const g = toArr((Store.get().goals || {}).directions).filter(x => x && !x.done && +x.amount > 0);
      if (g.length) L.push('ЦЕЛИ (не закрытые): ' + g.slice(0, 25).map(x => `${x.name} ${rub(x.amount)}${x.month ? ' на ' + MON[x.month - 1] : ''}${x.maybe ? ' (под вопросом)' : ''}`).join('; ') + '.'); } catch (e) {}
    return L.join('\n').slice(0, 13000);
  }

  async function call(payload) {
    const url = cfg().aiChatUrl; if (!url) throw { code: 'off' };
    const tok = window.FirebaseSync && FirebaseSync.idToken ? await FirebaseSync.idToken() : null; if (!tok) throw { code: 'auth' };
    let r; try { r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: tok, mode: 'finance', ...payload }) }); } catch (e) { throw { code: 'net' }; }
    let d = {}; try { d = await r.json(); } catch (e) {}
    if (!r.ok) throw { code: d.error || 'server', used: d.used, limit: d.limit };
    if (!payload.check && !String(d.text || '').trim()) throw { code: 'server' };
    return d;
  }
  function errText(e) {
    const c = e && e.code;
    return c === 'limit' ? `Лимит сообщений на этот месяц закончился (${e.limit || ''}). Новые откроются 1-го числа.`
      : c === 'net' ? 'Нет связи. Проверь интернет и спроси ещё раз.' : c === 'auth' ? 'Войди в аккаунт, чтобы спросить.'
      : c === 'billing' ? 'Помощник временно недоступен. Попробуй позже.' : 'Не получилось ответить. Спроси ещё раз.';
  }
  /* простое оформление: абзацы, списки, жирный */
  function fmt(t) {
    const lines = esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split(/\n/);
    let out = '', list = '';
    lines.forEach(l => { const m = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/); if (m) { list += '<li>' + m[1] + '</li>'; return; } if (list) { out += '<ul>' + list + '</ul>'; list = ''; } if (l.trim()) out += '<p>' + l + '</p>'; });
    if (list) out += '<ul>' + list + '</ul>';
    return out;
  }

  function render(content) {
    const list = msgs(); const off = !cfg().aiChatUrl;
    const left = usage ? Math.max(0, usage.limit - usage.used) : null;
    content.innerHTML = `<div class="ch-card fa-ch">
      <div class="ch-head"><div class="ai-hero-ico sm"><i class="ti ti-sparkles"></i></div><div class="ch-head-t"><b>Помощник</b><span>Считает по твоим тратам, доходам и целям</span></div><div class="ch-left${left === 0 ? ' zero' : ''}">${left == null ? '' : `<b>${left}</b><span>из ${usage.limit}</span>`}</div></div>
      <div class="ch-list" id="fa-list">${list.length ? list.map(m => `<div class="ch-msg ${m.role === 'user' ? 'me' : 'bot'}${m.err ? ' err' : ''}">${m.role === 'user' ? esc(m.text) : fmt(m.text)}</div>`).join('')
        : `<div class="ch-empty"><i class="ti ti-message-question"></i><b>Спроси о своих деньгах</b></div>`}${busy ? '<div class="ch-msg bot ch-typing"><span></span><span></span><span></span></div>' : ''}</div>
      ${list.length < 2 ? `<div class="ch-quick">${QUICK.map(q => `<button class="ch-q fa-q">${esc(q)}</button>`).join('')}</div>` : ''}
      <div class="ch-input"><textarea id="fa-text" rows="1" placeholder="${off ? 'Помощник скоро заработает' : 'Спроси о своих деньгах…'}" ${off || left === 0 ? 'disabled' : ''}></textarea>
        <button id="fa-send" aria-label="Спросить" ${off || left === 0 || busy ? 'disabled' : ''}><i class="ti ti-send"></i></button></div>
      <div class="ch-foot">${usage ? usage.limit + ' сообщений в месяц' : 'Общий лимит с чатом тренера'}${list.length ? ' · <button class="ch-clear" id="fa-clear">Очистить переписку</button>' : ''}</div>
    </div>`;
    const box = content.querySelector('#fa-list'); if (box) box.scrollTop = box.scrollHeight;
    const again = () => { if (content.isConnected && content.querySelector('#fa-list')) render(content); };
    const ta = content.querySelector('#fa-text');
    if (ta) { if (draft) ta.value = draft; ta.addEventListener('input', () => { draft = ta.value; ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(ta.value); } }); }
    const sb = content.querySelector('#fa-send'); if (sb) sb.onclick = () => send(ta.value);
    content.querySelectorAll('.fa-q').forEach(b => b.onclick = () => send(b.textContent));
    const cl = content.querySelector('#fa-clear'); if (cl) cl.onclick = () => { if (confirm('Очистить переписку?')) { saveMsgs([]); again(); } };
    async function send(text) {
      text = String(text || '').trim(); if (!text || busy || off) return;
      const l = msgs(); l.push({ role: 'user', text, at: Date.now() }); saveMsgs(l); draft = ''; busy = true; again();
      try { const d = await call({ context: buildContext(), messages: l.filter(m => !m.err).slice(-8).map(m => ({ role: m.role, text: m.text })) });
        usage = { used: d.used, limit: d.limit }; l.push({ role: 'assistant', text: d.text, at: Date.now() }); }
      catch (e) { if (e && e.code === 'limit') usage = { used: e.used || 0, limit: e.limit || 0 }; l.push({ role: 'assistant', text: errText(e), err: true, at: Date.now() }); }
      saveMsgs(l); busy = false; again();
    }
    if (!off && !usage) call({ check: true }).then(d => { usage = { used: d.used, limit: d.limit }; again(); }).catch(() => {});
  }

  return { render, buildContext };
})();
