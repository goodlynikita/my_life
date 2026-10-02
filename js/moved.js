/* Переезд со старого адреса goodlynikita.github.io на you-app.ru.
   В браузере сразу переадресуем. В установленной иконке (на рабочем столе) показываем,
   как поставить приложение с нового адреса: сама иконка адрес сменить не может. */
(function () {
  if (!/github\.io$/.test(location.hostname)) return;
  var to = 'https://you-app.ru' + location.pathname.replace(/^\/my_life/, '') + location.search + location.hash;
  var standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  if (!standalone) { location.replace(to); return; }
  function show() {
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#0B0E17;color:#F2F4F8;font-family:Montserrat,system-ui,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:32px 26px;gap:16px;overflow:auto';
    d.innerHTML = '<div style="font-size:26px;font-weight:800;line-height:1.2">YOU переехал на you-app.ru</div>'
      + '<div style="font-size:15px;line-height:1.6;color:#AEB8D8">Данные на месте, они в облаке. Поставь иконку с нового адреса:</div>'
      + '<ol style="margin:0;padding-left:20px;font-size:15px;line-height:1.75;color:#DDE3F5">'
      + '<li>Нажми кнопку ниже, откроется Safari</li><li>Войди в аккаунт</li><li>«Поделиться» → «На экран Домой»</li><li>Эту старую иконку удали</li></ol>'
      + '<a href="' + to + '" target="_blank" rel="noopener" style="margin-top:8px;display:flex;align-items:center;justify-content:center;height:52px;border-radius:14px;background:linear-gradient(135deg,#4A7CFF,#8B5CF6);color:#fff;font-weight:800;font-size:16px;text-decoration:none">Открыть you-app.ru</a>';
    document.body.appendChild(d);
  }
  if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
})();
