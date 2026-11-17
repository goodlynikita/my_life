/* Предпросмотр оформления на сайте не меняет выбор внутри приложения. */
(function () {
  var section = document.getElementById('winter-arc');
  if (!section) return;
  var buttons = Array.from(section.querySelectorAll('[data-preview-theme]'));
  var caption = section.querySelector('.winter-caption');
  function select(theme, focus) {
    section.dataset.preview = theme;
    buttons.forEach(function (button) {
      var active = button.dataset.previewTheme === theme;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      document.getElementById(button.getAttribute('aria-controls')).hidden = !active;
      if (active && focus) button.focus();
    });
    caption.textContent = 'Пример главного экрана · ' + (theme === 'wa' ? 'Winter Arc' : 'Минимал');
  }
  buttons.forEach(function (button, index) {
    button.addEventListener('click', function () { select(button.dataset.previewTheme); });
    button.addEventListener('keydown', function (event) {
      var target = event.key === 'ArrowRight' ? (index + 1) % buttons.length : event.key === 'ArrowLeft' ? (index + buttons.length - 1) % buttons.length : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : -1;
      if (target < 0) return;
      event.preventDefault();
      select(buttons[target].dataset.previewTheme, true);
    });
  });
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) { section.classList.toggle('winter-visible', entries[0].isIntersecting); }, { threshold: 0 }).observe(section);
  } else section.classList.add('winter-visible');
  function visibility() { section.classList.toggle('winter-paused', document.hidden); }
  document.addEventListener('visibilitychange', visibility);
  visibility();
})();
