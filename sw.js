/* ============================================================
   SERVICE WORKER — офлайн кеш
   ============================================================ */
const CACHE = 'nik-system-v293';

const STATIC = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './favicon.ico',
  './img/fav/tab-32.png',
  './img/fav/icon-192.png',
  './css/winter-arc.css',
  './css/tokens.css',
  './css/home.css',
  './css/slides-kit.css',
  './css/training.css',
  './css/challenges.css',
  './css/coach-home.css',
  './css/sections.css',
  './css/finance.css',
  './css/tochka.css',
  './css/tasks.css',
  './css/game.css',
  './css/minimal.css',
  './css/tour.css',
  './css/light.css',
  './js/theme.js',
  './js/palette.js',
  './js/config.js',
  './js/store.js',
  './js/auth.js',
  './js/router.js',
  './js/firebase-sync.js',
  './js/features.js',
  './js/tabs-custom.js',
  './js/screens/finance-ask.js',
  './js/slide-kit.js',
  './js/slides.js',
  './js/feedback.js',
  './js/celebrate.js',
  './js/notices.js',
  './js/analytics.js',
  './js/tour.js',
  './js/trainer-link.js',
  './js/trainer-client.js',
  './js/body-progress.js',
  './js/winter-arc.js',
  './js/app.js',
  './js/screens/login.js',
  './js/screens/home.js',
  './js/screens/training.js',
  './js/screens/training-ai.js',
  './js/coach-dash.js',
  './js/share-tpl.js',
  './js/screens/training-chat.js',
  './js/screens/training-insights.js',
  './js/screens/training-challenges.js',
  './js/screens/habits.js',
  './js/screens/finance.js',
  './js/screens/finance-piggy.js',
  './js/screens/finance-spend.js',
  './js/inbox.js',
  './js/screens/goals.js',
  './js/screens/tasks.js',
  './js/game.js',
  './js/ai-kit.js',
  './img/wa/statue.webp',
  './img/wa/target.webp',
  './img/wa/focus.webp',
  './img/wa/peak1.webp',
  './img/wa/peak2.webp',
  './img/wa/peak3.webp',
  './img/wa/frost-shard.webp',
  './img/wa/frost-fern.webp',
  './img/wa/frost-flake.webp',
  './img/wa/frost-crack.webp',
  './img/wa/frost-feather.webp',
  './img/wa/frost.webp',
];

/* Библиотеки с CDN: без них приложение не стартует, поэтому тоже кешируем заранее (версии зафиксированы) */
/* библиотеки и шрифты с чужих адресов живут в отдельном кеше, который не сбрасывается при каждом обновлении (версии в адресах зафиксированы) */
const CDN_CACHE = 'nik-cdn-v1';
const CDN = [
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.48.0/dist/tabler-icons.min.css',
];

/* Установка: кешируем всё. CDN по одному, чтобы сбой одного не ломал установку */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => caches.open(CDN_CACHE)).then(c => Promise.all(CDN.map(u => c.match(u).then(h => h || c.add(new Request(u, { mode: 'cors' }))).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

/* Активация: чистим старый кеш */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== CDN_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Запросы к данным Firebase (база, вход) только через сеть, их не трогаем */
const LIVE = /firebaseio\.com|firebasedatabase\.app|identitytoolkit|securetoken|firebaseinstallations|apis\.google\.com|accounts\.google|functions\.yandexcloud|storage\.yandexcloud/;

/* ищем только в кеше своей версии: старые кеши других версий не подмешиваются */
const mine = () => caches.open(CACHE);
const isCdn = (u) => /^https:\/\/(www\.gstatic\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(u);
function putCache(req, res) {
  if (res && (res.ok || res.type === 'opaque') && req.method === 'GET') { const cl = res.clone(); caches.open(CACHE).then(c => c.put(req, cl)).catch(() => {}); }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request, url = req.url;
  if (req.method !== 'GET' || LIVE.test(url) || !/^https?:/.test(url)) return;
  /* Страница: свежая из сети (не дольше 3 секунд), иначе из кеша своей версии. Исправления доходят сразу */
  if (req.mode === 'navigate') {
    e.respondWith(mine().then(c => new Promise(resolve => {
      let done = false; const fromCache = () => c.match(req, { ignoreSearch: true }).then(r => r || c.match('./index.html')).then(r => r || c.match('./'));
      const t = setTimeout(() => fromCache().then(r => { if (r && !done) { done = true; resolve(r); } }), 3000);
      fetch(req).then(res => { if (!done) { done = true; clearTimeout(t); resolve(res); } })
        .catch(() => fromCache().then(r => { if (!done) { done = true; clearTimeout(t); resolve(r || Response.error()); } }));
    })));
    return;
  }
  if (isCdn(url)) {
    e.respondWith(caches.open(CDN_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()).catch(() => {}); return res; }))));
    return;
  }
  /* Скрипты, стили, иконки, шрифты: сразу из кеша (кеш свой у каждой версии, CACHE меняется при каждом обновлении), иначе сеть */
  e.respondWith(
    mine().then(c => c.match(req).then(hit => hit || fetch(req).then(res => putCache(req, res)).catch(() => c.match(req, { ignoreSearch: true }))))
  );
});
