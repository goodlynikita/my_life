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
    var winter = window.WinterArc && WinterArc.isOn();
    var home = !document.documentElement.dataset.sec || document.documentElement.dataset.sec === 'home';
    if (winter && home) mode = 'dark';
    document.documentElement.setAttribute('data-theme', mode);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'light' ? '#EEEBE3' : '#11141C');
    if (winter && document.documentElement.dataset.sec === 'tasks') {
      document.querySelectorAll('.tk-app,.tk-ov,.tk-toast').forEach(function(el) { el.classList.toggle('tkl', mode === 'light'); el.classList.toggle('tkd', mode !== 'light'); });
      document.documentElement.classList.toggle('tk-on-light', mode === 'light');
    }
    if (winter) {
      document.documentElement.classList.remove('fin-inv-on');
      document.querySelectorAll('.tochka-screen.fin-inv').forEach(function(el) { el.classList.remove('fin-inv'); });
    }
    paintButtons();
  }
  function paintButtons() {
    document.querySelectorAll('.section-theme-toggle').forEach(function(button) {
      button.innerHTML = '<i class="ti ti-' + (current === 'light' ? 'moon' : 'sun') + '"></i>';
      button.setAttribute('aria-label', current === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему');
      button.title = button.getAttribute('aria-label');
      button.setAttribute('aria-pressed', String(current === 'light'));
    });
    var homeButton = document.getElementById('home-theme-btn');
    if (homeButton) {
      homeButton.dataset.mode = current;
      var winter = window.WinterArc && WinterArc.isOn();
      homeButton.title = winter ? 'Светлая / тёмная тема разделов' : 'Светлая / тёмная тема';
      homeButton.setAttribute('aria-label', homeButton.title);
    }
  }
  function mountControls(root) {
    var winter = window.WinterArc && WinterArc.isOn();
    var header = root.querySelector('.tr-header,.hab-header,.tochka-header,.goals-header,.tk-hdr');
    if (header && !header.querySelector('.section-theme-toggle')) {
      var nativeButton = header.querySelector('#fin-theme,#tk-theme');
      if (!nativeButton || winter) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'section-theme-toggle';
        button.onclick = function() { window.Theme.set(current === 'light' ? 'dark' : 'light'); };
        if (nativeButton) nativeButton.replaceWith(button);
        else {
          var last = header.lastElementChild;
          if (last && last.tagName === 'DIV') last.prepend(button);
          else {
            var actions = document.createElement('div'); actions.className = 'section-header-actions';
            header.appendChild(actions); actions.appendChild(button);
            if (last) actions.appendChild(last);
          }
        }
      }
    }
    apply(current);
  }
  var current = read();
  apply(current);
  window.Theme = {
    get: function () { return current; },
    mountControls: mountControls,
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
