/* ============================================================
   КЛИЕНТ ТРЕНЕРА — то, что видит ученик в «Тренировках»
   • галочка «Сделал» на прошедших днях → day.done = { by:'client'|'coach', at }
     (тренер ставит её сам в кабинете, если тренировал офлайн)
   • «Итоги недели от тренера» → training.coachWeekly
   Показываем только тем, у кого подключён тренер.
   ============================================================ */
window.TrainerClient = (function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DAY = 864e5;
  const on = () => !!(window.FirebaseSync && FirebaseSync.myTrainerCached && FirebaseSync.myTrainerCached()) && !window.__coachMode;

  /* ── Галочка «Сделал» ── */
  function doneBtn(day, plan, w, d) {
    if (!on() || !(day.sessions || []).some(s => s && s.type !== 'Отдых')) return '';
    const dt = window.TrainingAI ? TrainingAI.planDayDate(plan, day.date) : null; if (!dt) return '';
    const t0 = new Date(); t0.setHours(0, 0, 0, 0); if (dt > t0) return '';
    const dn = day.done;
    return `<button class="tr-day-done${dn ? ' on' : ''}" data-done="${w}:${d}" title="${dn ? (dn.by === 'coach' ? 'Отметил тренер' : 'Сделано') + '. Нажми, чтобы снять' : 'Отметить: тренировка сделана'}"><i class="ti ti-${dn ? 'circle-check-filled' : 'circle-check'}"></i>${dn ? '<span>' + (dn.by === 'coach' ? 'тренер' : 'сделал') + '</span>' : ''}</button>`;
  }

  /* ── Итоги недели от тренера ── */
  function weeklyHtml() {
    if (!on()) return '';
    const cw = (Store.get().training || {}).coachWeekly;
    if (!cw || !cw.at || Date.now() - cw.at > 10 * DAY) return '';
    let seen = null; try { seen = localStorage.getItem('you_cw_seen'); } catch (e) {}
    if (seen && +seen >= cw.at) return '';
    const grew = (cw.grew || []).slice(0, 4);
    return `<div class="tr-cweek">
      <div class="tr-cweek-h"><i class="ti ti-user-star"></i><div><b>Итоги недели от тренера</b><span>${esc(cw.trainer || '')} · ${esc(cw.range || '')}</span></div>
        <button class="tr-cweek-x" aria-label="Скрыть"><i class="ti ti-x"></i></button></div>
      <div class="tr-cweek-k"><div><b>${cw.count || 0}</b><span>тренировок</span></div><div><b>${cw.tons != null ? String(cw.tons).replace('.', ',') : '–'}</b><span>тонн поднято</span></div><div><b>${cw.delta == null ? '–' : (cw.delta > 0 ? '+' : '') + cw.delta + '%'}</b><span>к прошлой</span></div></div>
      ${grew.length ? `<div class="tr-cweek-g">${grew.map(g => `<div><i class="ti ti-trending-up"></i>${esc(g)}</div>`).join('')}</div>` : ''}
      ${(cw.body || []).length ? `<div class="tr-cweek-g">${cw.body.map(g => `<div><i class="ti ti-ruler-measure" style="color:#67E8F9"></i>${esc(g)}</div>`).join('')}</div>` : ''}
      ${cw.text ? `<div class="tr-cweek-t">${esc(cw.text).replace(/\n/g, '<br>')}</div>` : ''}
    </div>`;
  }

  function bind(content, plan, rerender) {
    content.querySelectorAll('[data-done]').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const [w, d] = b.dataset.done.split(':').map(Number);
      const day = plan.weeks[w].days[d], idx = trGetPlans().findIndex(p => p.id === plan.id);
      const v = day.done ? null : { by: 'client', at: Date.now() };
      if (v) day.done = v; else delete day.done;
      Store.set('training.plans.' + idx + '.weeks.' + w + '.days.' + d + '.done', v);
      rerender && rerender();
    }));
    const x = content.querySelector('.tr-cweek-x');
    if (x) x.onclick = () => { try { localStorage.setItem('you_cw_seen', String((Store.get().training.coachWeekly || {}).at || Date.now())); } catch (e) {} x.closest('.tr-cweek').remove(); };
  }

  return { weeklyHtml, doneBtn, bind };
})();
