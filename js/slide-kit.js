/* ============================================================
   SLIDE KIT — общее для слайдеров YOU и кабинета тренера:
   виды блоков (число, полоска, кольцо, график), раскладки,
   значок и подпись, редактор с живым превью, шаблоны
   ============================================================ */
window.SlideKit = (() => {
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const VIEW_NAMES = { num: 'Число', bar: 'Полоска', ring: 'Кольцо', spark: 'График' };
  const ICONS = ['ti-sun', 'ti-flame', 'ti-barbell', 'ti-run', 'ti-heart', 'ti-checklist', 'ti-wallet', 'ti-coin', 'ti-target-arrow', 'ti-trophy', 'ti-bolt', 'ti-moon', 'ti-book', 'ti-brain', 'ti-rocket', 'ti-star', 'ti-users', 'ti-calendar-event'];
  const LAYOUTS = [
    { id: 'auto', name: 'Главная + строка', svg: '<rect x="3" y="4" width="30" height="7" rx="2"/><rect x="3" y="16" width="9" height="5" rx="1.5"/><rect x="14" y="16" width="9" height="5" rx="1.5"/><rect x="25" y="16" width="9" height="5" rx="1.5"/>' },
    { id: 'center', name: 'По центру', svg: '<rect x="9" y="4" width="18" height="10" rx="2"/><rect x="8" y="17" width="9" height="4" rx="1.5"/><rect x="19" y="17" width="9" height="4" rx="1.5"/>' },
    { id: 'cols', name: 'Две колонки', svg: '<rect x="3" y="4" width="14" height="8" rx="2"/><rect x="19" y="4" width="14" height="8" rx="2"/><rect x="3" y="14" width="14" height="8" rx="2"/><rect x="19" y="14" width="14" height="8" rx="2"/>' },
    { id: 'list', name: 'Список', svg: '<rect x="3" y="4" width="30" height="4" rx="1.5"/><rect x="3" y="11" width="30" height="4" rx="1.5"/><rect x="3" y="18" width="30" height="4" rx="1.5"/>' },
  ];
  const iconHtml = (ic) => !ic ? '' : /^ti-[a-z0-9-]+$/.test(ic) ? `<i class="ti ${ic} hs-ico"></i>` : `<span class="hs-ico hs-emo">${esc(ic)}</span>`;

  /* какие виды доступны блоку по его данным d = { v, max, text, lbl, series } */
  function viewsFor(d) { const v = ['num']; if (d && d.max) v.push('bar', 'ring'); if (d && d.series) v.push('spark'); return v; }
  /* блок в выбранном виде; белым, чтобы читался на любом цвете слайда */
  /* цвет акцента слайда: для полосок, колец и графика «под цвет слайда» */
  const ACCENT = { 'slide-focus': '#7DB3FF', 'slide-finance': '#5EE89A', 'slide-goals': '#C9A0FF', 'slide-amber': '#FBBF24', 'slide-crimson': '#FB8A8A', 'slide-pink': '#F59AD0',
    'slide-teal': '#4FE3CF', 'slide-indigo': '#A0A8FF', 'slide-orange': '#FDA65C', 'slide-lime': '#B7F04F', 'slide-slate': '#AFC0D6', 'slide-red': '#F87171', 'slide-midnight': '#7DB3FF', 'slide-jade': '#5EE6B0' };
  const accentOf = (cfg) => !cfg || cfg.accent !== 'slide' ? null : (ACCENT[cfg.cssClass] || cfg.glowColor || '#A0A8FF');
  function viewHtml(d, view, color) {
    if (!d || !view || view === 'num') return null;
    const c = color || 'rgba(255,255,255,.92)';
    const pct = d.max ? Math.max(0, Math.min(100, Math.round(d.v / d.max * 100))) : 0;
    if (view === 'bar' && d.max) return `<div class="skv skv-bar"><div class="hero-stat-num">${d.text}</div><div class="skv-track"><i style="width:${pct}%;background:${c}"></i></div><div class="hero-stat-lbl">${esc(d.lbl)}</div></div>`;
    if (view === 'ring' && d.max) { const L = 2 * Math.PI * 17;
      return `<div class="skv skv-ring"><div class="skv-ring-c"><svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="17" class="skv-ring-bg"/><circle cx="21" cy="21" r="17" class="skv-ring-fg" style="stroke:${c};stroke-dasharray:${(L * pct / 100).toFixed(1)} ${L.toFixed(1)}"/></svg><b${String(d.text).replace(/<[^>]+>/g, '').length > 3 ? ' class="sm"' : ''}>${d.text}</b></div><div class="hero-stat-lbl">${esc(d.lbl)}</div></div>`; }
    if (view === 'spark' && d.series) { const mx = Math.max(1, ...d.series);
      return `<div class="skv skv-spark"><div class="hero-stat-num">${d.text}</div><div class="skv-sp">${d.series.map(x => `<i style="height:${Math.max(6, Math.round(x / mx * 100))}%;background:${x ? c : 'rgba(255,255,255,.18)'}"></i>`).join('')}</div><div class="hero-stat-lbl">${esc(d.lbl)}</div></div>`; }
    return null;
  }

  /* шапка и тело слайда по раскладке; rendered = [{ name, html }] */
  function headHtml(cfg) {
    return `<div class="hero-slide-label">${iconHtml(cfg.icon)}${esc(cfg.label || '')}</div>${cfg.motto ? `<div class="hero-slide-motto">${esc(cfg.motto)}</div>` : ''}`;
  }
  function bodyHtml(cfg, rendered) {
    const layout = cfg.layout || 'auto';
    let h = '';
    if (layout === 'cols') h = `<div class="hero-slide-sub"><div class="hs-cols">${rendered.map(b => `<div class="sb-block">${b.html}</div>`).join('')}</div></div>`;
    else if (layout === 'list') h = `<div class="hero-slide-sub"><div class="hs-list">${rendered.map(b => `<div class="hs-li"><span class="hs-li-n">${esc(b.name)}</span><div class="hs-li-v">${b.html}</div></div>`).join('')}</div></div>`;
    else if (layout === 'center') { const rest = rendered.slice(1);
      h = (rendered[0] ? `<div class="hero-slide-main hs-center">${rendered[0].html}</div>` : '')
        + (rest.length ? `<div class="hero-slide-sub"><div class="hero-stat-row hs-center-row stats-${Math.min(rest.length, 4)}">${rest.map(b => `<div class="sb-block">${b.html}</div>`).join('<div class="hero-stat-sep"></div>')}</div></div>` : ''); }
    else { const stats = rendered.slice(1);
      h = (rendered[0] ? `<div class="hero-slide-main">${rendered[0].html}</div>` : '')
        + (stats.length ? `<div class="hero-slide-sub"><div class="hero-stat-row stats-${Math.min(stats.length, 4)}${stats.length >= 4 ? ' stats-grid' : ''}">${stats.map(b => `<div class="sb-block">${b.html}</div>`).join('<div class="hero-stat-sep"></div>')}</div></div>` : ''); }
    return `<div class="hs-body hs-lay-${layout}">${h}</div>`;
  }

  /* ── Редактор одного слайда ──
     o = { draft, blocks:[{id,name,desc,sec}], sections:[...], colors:[{cssClass,glowClass,val,glow,bg,name}],
           routes:[[value,label]], preview(draft)->html, views(bid)->[...], cfgHtml(bid,cfg)->html, onSave(draft), onCancel() } */
  function form(body, o) {
    const draft = JSON.parse(JSON.stringify(o.draft || {}));
    draft.blocks = (draft.blocks || []).slice(); draft.views = draft.views || {}; draft.blockCfgs = draft.blockCfgs || {}; draft.layout = draft.layout || 'auto';
    const lbl = (t) => `<div class="sf-lbl">${t}</div>`;
    const secs = o.sections || [...new Set(o.blocks.map(b => b.sec))];
    body.innerHTML = `<div class="sf">
      <div class="sf-prev" id="sf-prev"></div>
      ${lbl('Название и значок')}
      <div class="sf-row"><button class="sf-icon-btn" id="sf-icon-btn" aria-label="Значок"></button><input type="text" id="se-label" class="sf-in" value="${esc(draft.label || '')}" placeholder="СЕГОДНЯ" maxlength="24"></div>
      <div class="sf-icons" id="sf-icons" hidden>
        <button data-ic="" class="sf-ic-none">без</button>
        ${ICONS.map(ic => `<button data-ic="${ic}"><i class="ti ${ic}"></i></button>`).join('')}
        <input type="text" id="sf-emoji" maxlength="2" placeholder="😀" aria-label="Эмодзи">
      </div>
      ${lbl('Подпись под названием')}
      <input type="text" id="sf-motto" class="sf-in" value="${esc(draft.motto || '')}" placeholder="Например: шаг за шагом" maxlength="40">
      ${lbl('Цвет')}
      <div class="sf-colors">${o.colors.map((c, i) => `<button class="se-color-btn" data-i="${i}" style="background:${c.bg || c.val}" title="${esc(c.name)}"></button>`).join('')}</div>
      ${lbl('Цвет полосок и колец')}
      <div class="sf-acc"><button data-acc="white"><i style="background:#fff"></i>Белый</button><button data-acc="slide"><i id="sf-acc-sw"></i>Под цвет слайда</button></div>
      ${lbl('Раскладка')}
      <div class="sf-lays">${LAYOUTS.map(l => `<button data-lay="${l.id}"><svg viewBox="0 0 36 26">${l.svg}</svg><span>${l.name}</span></button>`).join('')}</div>
      ${lbl('Блоки на слайде')}
      <div class="sf-hint">Порядок меняй стрелками или перетаскивай за <i class="ti ti-grip-vertical"></i>. Первый блок самый крупный</div>
      <div class="sf-order" id="sf-order"></div>
      <details class="sf-add"><summary><i class="ti ti-plus"></i> Добавить блок <i class="ti ti-chevron-down"></i></summary>
        ${secs.map(sec => { const bs = o.blocks.filter(b => b.sec === sec); return bs.length ? `<div class="sf-sec">${esc(sec)}</div>` + bs.map(b => `<label class="sf-cb"><input type="checkbox" class="se-block-cb" data-bid="${b.id}"><div><b>${esc(b.name)}</b><span>${esc(b.desc || '')}</span></div></label>`).join('') : ''; }).join('')}
      </details>
      ${lbl('Куда ведёт нажатие')}
      <select id="se-route" class="sf-in">${o.routes.map(r => `<option value="${esc(r[0])}">${esc(r[1])}</option>`).join('')}</select>
      <div class="sf-btns"><button class="sf-cancel" id="sf-cancel">Отмена</button><button class="sf-save" id="se-save-slide">Сохранить</button></div>
    </div>`;
    body.scrollTop = 0;
    const $ = (q) => body.querySelector(q);
    $('#se-route').value = draft.route || '';
    const colorIdx = () => o.colors.findIndex(c => (draft.cssClass && c.cssClass === draft.cssClass) || (!draft.cssClass && draft.color && c.val === draft.color));
    const drawPreview = () => {
      $('#sf-prev').innerHTML = o.preview(draft);
      $('#sf-icon-btn').innerHTML = draft.icon ? iconHtml(draft.icon) : '<i class="ti ti-mood-plus"></i>';
      const ci = colorIdx(); body.querySelectorAll('.se-color-btn').forEach(b => b.classList.toggle('on', +b.dataset.i === ci));
      body.querySelectorAll('.sf-lays button').forEach(b => b.classList.toggle('on', b.dataset.lay === draft.layout));
      body.querySelectorAll('.sf-acc button').forEach(b => b.classList.toggle('on', b.dataset.acc === (draft.accent === 'slide' ? 'slide' : 'white')));
      $('#sf-acc-sw').style.background = accentOf({ ...draft, accent: 'slide' });
      body.querySelectorAll('.sf-icons [data-ic]').forEach(b => b.classList.toggle('on', (b.dataset.ic || '') === (draft.icon || '')));
    };
    const drawOrder = () => {
      const box = $('#sf-order');
      box.innerHTML = draft.blocks.length ? draft.blocks.map((bid, i) => {
        const def = o.blocks.find(b => b.id === bid); if (!def) return '';
        const vs = o.views ? o.views(bid) : ['num'], cur = draft.views[bid] || 'num';
        return `<div class="sf-blk" data-i="${i}">
          <div class="sf-blk-h"><span class="sf-grip" data-i="${i}"><i class="ti ti-grip-vertical"></i></span><b>${esc(def.name)}</b>
            <button data-mv="-1" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Выше"><i class="ti ti-chevron-up"></i></button>
            <button data-mv="1" data-i="${i}" ${i === draft.blocks.length - 1 ? 'disabled' : ''} aria-label="Ниже"><i class="ti ti-chevron-down"></i></button>
            <button data-rm="${i}" aria-label="Убрать"><i class="ti ti-x"></i></button></div>
          ${vs.length > 1 ? `<div class="sf-views">${vs.map(v => `<button data-bid="${bid}" data-v="${v}" class="${v === cur ? 'on' : ''}">${VIEW_NAMES[v]}</button>`).join('')}</div>` : ''}
          ${o.cfgHtml ? o.cfgHtml(bid, draft.blockCfgs[bid] || {}) : ''}
        </div>`;
      }).join('') : '<div class="sf-empty">Пока пусто. Добавь блок ниже</div>';
      body.querySelectorAll('.se-block-cb').forEach(cb => { cb.checked = draft.blocks.includes(cb.dataset.bid); });
      box.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => { const i = +b.dataset.i, j = i + +b.dataset.mv; [draft.blocks[i], draft.blocks[j]] = [draft.blocks[j], draft.blocks[i]]; drawOrder(); drawPreview(); });
      box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { draft.blocks.splice(+b.dataset.rm, 1); drawOrder(); drawPreview(); });
      box.querySelectorAll('.sf-views button').forEach(b => b.onclick = () => { draft.views[b.dataset.bid] = b.dataset.v; drawOrder(); drawPreview(); });
      box.querySelectorAll('[data-cfg]').forEach(inp => inp.addEventListener('input', () => { const c = draft.blockCfgs[inp.dataset.bid] = draft.blockCfgs[inp.dataset.bid] || {}; c[inp.dataset.cfg] = inp.value; drawPreview(); }));
      /* перетаскивание за ручку: пальцем и мышкой */
      box.querySelectorAll('.sf-grip').forEach(g => g.addEventListener('pointerdown', (e) => {
        e.preventDefault(); const from = +g.dataset.i; const items = [...box.querySelectorAll('.sf-blk')]; items[from].classList.add('drag'); let to = from;
        const mvH = (ev) => { const y = ev.clientY; to = items.findIndex(it => { const r = it.getBoundingClientRect(); return y < r.top + r.height / 2; }); if (to < 0) to = items.length;
          items.forEach((it, k) => { it.classList.toggle('drop-before', k === to && k !== from && k !== from + 1); it.classList.toggle('drop-after', to === items.length && k === items.length - 1 && k !== from); }); };
        const upH = () => { document.removeEventListener('pointermove', mvH); document.removeEventListener('pointerup', upH);
          if (to !== from && to !== from + 1) { const [x] = draft.blocks.splice(from, 1); draft.blocks.splice(to > from ? to - 1 : to, 0, x); }
          drawOrder(); drawPreview(); };
        document.addEventListener('pointermove', mvH); document.addEventListener('pointerup', upH);
      }));
    };
    body.querySelectorAll('.se-block-cb').forEach(cb => cb.addEventListener('change', () => {
      const bid = cb.dataset.bid;
      if (cb.checked && !draft.blocks.includes(bid)) draft.blocks.push(bid);
      if (!cb.checked) draft.blocks = draft.blocks.filter(x => x !== bid);
      drawOrder(); drawPreview();
    }));
    $('#se-label').addEventListener('input', (e) => { draft.label = e.target.value.toUpperCase(); drawPreview(); });
    $('#sf-motto').addEventListener('input', (e) => { draft.motto = e.target.value; drawPreview(); });
    $('#se-route').addEventListener('change', (e) => { draft.route = e.target.value; });
    $('#sf-icon-btn').onclick = () => { const ic = $('#sf-icons'); ic.hidden = !ic.hidden; };
    body.querySelectorAll('.sf-icons [data-ic]').forEach(b => b.onclick = () => { draft.icon = b.dataset.ic; $('#sf-emoji').value = ''; drawPreview(); });
    $('#sf-emoji').addEventListener('input', (e) => { const v = e.target.value.trim(); if (v) { draft.icon = [...v].slice(0, 2).join(''); drawPreview(); } });
    body.querySelectorAll('.se-color-btn').forEach(b => b.onclick = () => { const c = o.colors[+b.dataset.i];
      draft.cssClass = c.cssClass || ''; draft.glowClass = c.glowClass || ''; draft.color = c.val || ''; draft.glowColor = c.glow || ''; drawPreview(); });
    body.querySelectorAll('.sf-lays button').forEach(b => b.onclick = () => { draft.layout = b.dataset.lay; drawPreview(); });
    body.querySelectorAll('.sf-acc button').forEach(b => b.onclick = () => { draft.accent = b.dataset.acc; drawPreview(); });
    $('#sf-cancel').onclick = () => o.onCancel && o.onCancel();
    $('#se-save-slide').onclick = () => o.onSave({ ...draft, label: (draft.label || '').toUpperCase() });
    drawOrder(); drawPreview();
  }

  /* ── Выбор шаблона нового слайда ──
     o = { templates:[{id,name,desc,slide}], preview(slide)->html, onPick(slide), onBack() } */
  function templates(body, o) {
    body.innerHTML = `<div class="sf-hint" style="margin-bottom:10px">Выбери основу, потом поправишь всё под себя</div>
      <div class="sf-tpls">${o.templates.map(t => `<button class="sf-tpl" data-t="${t.id}"><div class="sf-tpl-prev">${o.preview(t.slide)}</div><div class="sf-tpl-n"><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></div></button>`).join('')}</div>
      <div class="sf-btns"><button class="sf-cancel" id="sf-cancel">Назад</button></div>`;
    body.scrollTop = 0;
    body.querySelector('#sf-cancel').onclick = () => o.onBack && o.onBack();
    body.querySelectorAll('.sf-tpl').forEach(b => b.onclick = () => { const t = o.templates.find(x => x.id === b.dataset.t); o.onPick(JSON.parse(JSON.stringify(t.slide))); });
  }

  return { esc, accentOf, VIEW_NAMES, ICONS, LAYOUTS, iconHtml, viewsFor, viewHtml, headHtml, bodyHtml, form, templates };
})();
