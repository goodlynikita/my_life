/* ============================================================
   THEME — светлая / тёмная тема
   Грузится в <head> до отрисовки, чтобы не было «вспышки».
   Светлая тема строится поверх тёмной (инверсия с сохранением
   оттенков), картинки и эмодзи возвращаются к исходным цветам.
   Минимал: home.theme. Winter Arc: home.waThemes по разделам.
   ============================================================ */
(function () {
  var KEY = 'nik_theme';
  var SECTIONS = ['training', 'habits', 'finance', 'goals', 'tasks', 'hero'];
  var winterChoices = {};
  function read() { try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; } catch (e) { return 'dark'; } }
  function isMode(value) { return value === 'light' || value === 'dark'; }
  function isWinter() { return !!(window.WinterArc && WinterArc.isOn()); }
  function section() { return document.documentElement.dataset.sec || 'home'; }
  function winterKey() { var sec = section(); return SECTIONS.indexOf(sec) >= 0 ? sec : 'default'; }
  function winterMode() {
    var choices = winterChoices;
    try { if (typeof Store !== 'undefined' && Store.get) choices = (Store.get().home || {}).waThemes || {}; } catch (e) {}
    var choice = choices[winterKey()];
    return isMode(choice) ? choice : isMode(choices.default) ? choices.default : 'dark';
  }
  function selected() { return isWinter() ? winterMode() : current; }
  function apply(mode) {
    var winter = isWinter();
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
    var mode = selected();
    document.querySelectorAll('.section-theme-toggle').forEach(function(button) {
      button.innerHTML = '<i class="ti ti-' + (mode === 'light' ? 'moon' : 'sun') + '"></i>';
      button.setAttribute('aria-label', mode === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему');
      button.title = button.getAttribute('aria-label');
      button.setAttribute('aria-pressed', String(mode === 'light'));
    });
    var homeButton = document.getElementById('home-theme-btn');
    if (homeButton) {
      homeButton.dataset.mode = mode;
      var winter = isWinter();
      homeButton.setAttribute('role', 'switch');
      homeButton.setAttribute('aria-checked', String(mode === 'light'));
      homeButton.setAttribute('aria-label', winter ? 'Светлая тема разделов по умолчанию' : 'Светлая тема');
      homeButton.title = (mode === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему') + (winter ? ' разделов по умолчанию' : '');
    }
  }
  function mountControls(root) {
    var winter = isWinter();
    var header = root.querySelector('.tr-header,.hab-header,.tochka-header,.goals-header,.tk-hdr,.gm-nav');
    if (header && !header.querySelector('.section-theme-toggle')) {
      var nativeButton = header.querySelector('#fin-theme,#tk-theme');
      if (!nativeButton || winter) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'section-theme-toggle';
        button.onclick = function() { window.Theme.set(selected() === 'light' ? 'dark' : 'light'); };
        if (nativeButton) nativeButton.replaceWith(button);
        else {
          var last = header.lastElementChild;
          if (last && (last.tagName === 'DIV' || last.tagName === 'SPAN')) last.prepend(button);
          else {
            var actions = document.createElement('div'); actions.className = 'section-header-actions';
            header.appendChild(actions); actions.appendChild(button);
            if (last) actions.appendChild(last);
          }
        }
      }
    }
    apply(selected());
  }
  var current = read();
  apply(current);
  window.Theme = {
    get: selected,
    mountControls: mountControls,
    set: function (mode, opts) {
      if (isWinter()) {
        var key = winterKey(), value = mode === 'light' ? 'light' : 'dark';
        winterChoices[key] = value;
        try {
          if (typeof Store !== 'undefined' && Store.get && ((Store.get().home || {}).waThemes || {})[key] !== value) Store.set('home.waThemes.' + key, value);
        } catch (e) {}
        apply(value);
        return;
      }
      current = mode === 'light' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, current); } catch (e) {}
      apply(current);
      if (!(opts && opts.silent) && typeof Store !== 'undefined' && Store.get) {
        try { if ((Store.get().home || {}).theme !== current) Store.set('home.theme', current); } catch (e) {}
      }
    },
    /* После загрузки данных — подхватить тему, выбранную на другом устройстве */
    syncFromStore: function () {
      winterChoices = {};
      try {
        var t = (Store.get().home || {}).theme;
        if (isMode(t) && t !== current) {
          current = t;
          try { localStorage.setItem(KEY, current); } catch (e) {}
        }
      } catch (e) {}
      apply(selected());
    }
  };
})();
