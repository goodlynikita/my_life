/* ============================================================
   THEME — светлая / тёмная тема
   Грузится в <head> до отрисовки, чтобы не было «вспышки».
   Светлая тема строится поверх тёмной (инверсия с сохранением
   оттенков), картинки и эмодзи возвращаются к исходным цветам.
   Выбор хранится на устройстве + в Firebase (home.theme).
   ============================================================ */
(function () {
  var KEY = 'nik_theme';
  function read() { try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; } catch (e) { return 'dark'; } }
  function apply(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'light' ? '#EEEBE3' : '#11141C');
  }
  var current = read();
  apply(current);
  window.Theme = {
    get: function () { return current; },
    set: function (mode, opts) {
      current = mode === 'light' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, current); } catch (e) {}
      apply(current);
      if (!(opts && opts.silent) && window.Store && Store.get) {
        try { if ((Store.get().home || {}).theme !== current) Store.set('home.theme', current); } catch (e) {}
      }
    },
    /* После загрузки данных — подхватить тему, выбранную на другом устройстве */
    syncFromStore: function () {
      try { var t = (Store.get().home || {}).theme; if (t && t !== current) this.set(t, { silent: true }); } catch (e) {}
    }
  };
})();
