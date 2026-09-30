/* Привет тем, кто полез смотреть код 😏 */
(function () {
  try {
    var rows = ["          ▄▄█████▄▄", "         ███████████", "         ▀████▄████▀", "          █████████", "          █████████", "          █████████", "          █████████", "          █████████", "          █████████", "          █████████", "     ▄▄███████████████▄▄  ", "   ███████████ ███████████", "   ███████████ ███████████", "    ▀███████▀   ▀███████▀ "];
    var from = [110, 151, 255], to = [240, 171, 252], fmt = '', css = [];
    rows.forEach(function (r, i) {
      var k = i / (rows.length - 1), c = from.map(function (a, j) { return Math.round(a + (to[j] - a) * k); });
      fmt += '%c' + r + '\n';
      css.push('color:rgb(' + c.join(',') + ');font:bold 15px/1.05 Menlo,Consolas,monospace;text-shadow:0 0 12px rgba(' + c.join(',') + ',.55)');
    });
    console.log.apply(console, ['\n' + fmt].concat(css));
    console.log('%c YOU %c Код смотришь? Держи 😏 ',
      'color:#fff;background:#0B0E17;border:1px solid #8B5CF6;font:900 16px Montserrat,sans-serif;padding:8px 12px;border-radius:10px 0 0 10px',
      'color:#fff;background:linear-gradient(90deg,#4A7CFF,#8B5CF6,#EC4899);font:900 16px Montserrat,sans-serif;padding:8px 14px;border-radius:0 10px 10px 0');
    console.log('%cЗдесь ничего интересного. Лучше иди потренируйся 💪', 'color:#A0A9C4;font:600 13px Montserrat,sans-serif;padding:6px 0');
  } catch (e) {}
})();
