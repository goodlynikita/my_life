/* ============================================================
   ПАЛИТРА: «Яркие» (как в YOU) или «Пастельные» (как в кабинете тренера)
   Выбор хранится на устройстве, отдельно для YOU и для кабинета:
   по умолчанию YOU яркий, кабинет пастельный.
   Переключатель живёт в меню «···».
   ============================================================ */
window.Palette = (function () {
  const isCoach = () => /coach\.html/.test(location.pathname);
  const KEY = () => isCoach() ? 'coach_pal' : 'you_pal';
  const DEF = () => isCoach() ? 'soft' : 'bright';
  function get() { try { return localStorage.getItem(KEY()) || DEF(); } catch (e) { return DEF(); } }
  function apply() {
    const h = document.documentElement;
    h.setAttribute('data-pal', get());
    if (isCoach()) h.setAttribute('data-app', 'coach');
  }
  function set(v) { try { localStorage.setItem(KEY(), v); } catch (e) {} apply(); }
  /* строка для меню: та же разметка, что у остальных пунктов */
  function rowHtml() {
    const p = get();
    const b = (v, t) => `<button data-pal-v="${v}" style="flex:1;height:32px;border:none;border-radius:9px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;${p === v ? 'background:linear-gradient(135deg,#2C4FA8,#3A62C9);color:#fff;' : 'background:none;color:#8E98B8;'}">${t}</button>`;
    return `<div class="pal-row" style="width:100%;box-sizing:border-box;padding:10px 18px 12px;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:12px;font-family:Montserrat,sans-serif;">
      <i class="ti ti-palette" style="font-size:18px;color:#9D9A92;"></i><span style="color:#E8E5DC;font-size:14px;flex:0 0 auto;">Цвета</span>
      <div style="margin-left:auto;display:flex;gap:3px;padding:3px;border-radius:12px;background:rgba(110,139,255,.08);border:1px solid rgba(110,139,255,.16);flex:0 1 196px;">${b('bright', 'Яркие')}${b('soft', 'Пастельные')}</div></div>`;
  }
  function bind(root) {
    root.querySelectorAll('[data-pal-v]').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      set(btn.dataset.palV);
      const row = btn.closest('.pal-row'); if (row) row.outerHTML = rowHtml();
      bind(root);
    }));
  }
  apply();
  return { get, set, apply, rowHtml, bind };
})();
