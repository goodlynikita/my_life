/* ============================================================
   НАСТРОЙКА ВКЛАДОК: порядок и скрытие
   В Финансах, Целях, Привычках и Тренировках вкладки можно переставить
   и спрятать лишние. Хранится в home.tabs.<раздел> = { order:[id], hidden:[id] },
   поэтому одинаково на всех устройствах.
   TabsCustom.apply(bar, key, attr, onChange) расставляет вкладки и добавляет кнопку настройки.
   ============================================================ */
window.TabsCustom = (function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const arr = (v) => Array.isArray(v) ? v.filter(x => typeof x === 'string') : (v && typeof v === 'object' ? Object.values(v).filter(x => typeof x === 'string') : []);
  function get(key) { const t = ((Store.get().home || {}).tabs || {})[key] || {}; return { order: arr(t.order), hidden: arr(t.hidden) }; }
  function save(key, cfg) { Store.set('home.tabs.' + key, { order: cfg.order, hidden: cfg.hidden.length ? cfg.hidden : null }); }
  const items = (bar, attr) => [...bar.querySelectorAll(':scope > [' + attr + ']')];
  const label = (el) => (el.querySelector('.tt-lg') || el).textContent.trim();

  function apply(bar, key, attr, onChange) {
    if (!bar) return [];
    const list = items(bar, attr); if (!list.length) return [];
    const cfg = get(key);
    const byId = {}; list.forEach(el => { byId[el.getAttribute(attr)] = el; });
    const ids = list.map(el => el.getAttribute(attr));
    const ord = cfg.order.filter(id => byId[id]).concat(ids.filter(id => !cfg.order.includes(id)));
    const anchor = list[list.length - 1].nextSibling;
    ord.forEach(id => bar.insertBefore(byId[id], anchor));
    let vis = ord.filter(id => !cfg.hidden.includes(id));
    if (!vis.length) vis = [ord[0]];
    ord.forEach(id => byId[id].classList.toggle('tc-hidden', !vis.includes(id)));
    let btn = bar.querySelector(':scope > .tc-edit');
    if (!btn) { btn = document.createElement('button'); btn.type = 'button'; btn.className = 'tc-edit'; btn.setAttribute('aria-label', 'Настроить вкладки'); btn.title = 'Настроить вкладки'; btn.innerHTML = '<i class="ti ti-adjustments-horizontal"></i>'; bar.appendChild(btn); }
    btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); editor(bar, key, attr, onChange); };
    /* активная вкладка спрятана: открываем первую видимую */
    const act = list.find(el => el.classList.contains('active'));
    if (act && act.classList.contains('tc-hidden')) byId[vis[0]].click();
    return vis;
  }

  function editor(bar, key, attr, onChange) {
    const list = items(bar, attr);
    const cfg = get(key);
    let order = list.map(el => el.getAttribute(attr));
    const names = {}; list.forEach(el => { names[el.getAttribute(attr)] = label(el); });
    let hidden = cfg.hidden.filter(id => names[id]);
    const ov = document.createElement('div'); ov.className = 'tr-modal-overlay tc-ov';
    const draw = () => {
      ov.innerHTML = `<div class="tr-modal tc-modal"><p class="tr-modal-title">Вкладки</p>
        <div class="tc-list">${order.map((id, i) => `<div class="tc-row${hidden.includes(id) ? ' off' : ''}">
          <button class="tc-eye" data-eye="${esc(id)}" aria-label="${hidden.includes(id) ? 'Показать' : 'Скрыть'}"><i class="ti ti-${hidden.includes(id) ? 'eye-off' : 'eye'}"></i></button>
          <span>${esc(names[id])}</span>
          <button class="tc-mv" data-up="${i}" ${i ? '' : 'disabled'} aria-label="Выше"><i class="ti ti-chevron-up"></i></button>
          <button class="tc-mv" data-dn="${i}" ${i < order.length - 1 ? '' : 'disabled'} aria-label="Ниже"><i class="ti ti-chevron-down"></i></button></div>`).join('')}</div>
        <div class="tr-modal-actions"><button class="tr-modal-btn-secondary" data-reset>Как было</button><button class="tr-modal-btn-primary" data-ok>Готово</button></div></div>`;
      ov.querySelectorAll('[data-eye]').forEach(b => b.onclick = () => { const id = b.dataset.eye;
        if (hidden.includes(id)) hidden = hidden.filter(x => x !== id);
        else if (order.filter(x => !hidden.includes(x)).length > 1) hidden.push(id);
        draw(); });
      ov.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { const i = +b.dataset.up; [order[i - 1], order[i]] = [order[i], order[i - 1]]; draw(); });
      ov.querySelectorAll('[data-dn]').forEach(b => b.onclick = () => { const i = +b.dataset.dn; [order[i + 1], order[i]] = [order[i], order[i + 1]]; draw(); });
      ov.querySelector('[data-reset]').onclick = () => { Store.set('home.tabs.' + key, null); location.reload(); };
      ov.querySelector('[data-ok]').onclick = () => { save(key, { order, hidden }); ov.remove(); apply(bar, key, attr, onChange); onChange && onChange(); };
    };
    draw();
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
  }

  /* первая видимая вкладка для старта экрана */
  function firstVisible(key, ids) { const c = get(key); const ord = c.order.filter(id => ids.includes(id)).concat(ids.filter(id => !c.order.includes(id))); return ord.find(id => !c.hidden.includes(id)) || ids[0]; }
  function isHidden(key, id) { return get(key).hidden.includes(id); }

  return { apply, editor, firstVisible, isHidden };
})();
