/* ============================================================
   SERVICE WORKER — офлайн кеш
   ============================================================ */
const CACHE = 'nik-system-v117';

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
  './css/coach-home.css',
  './css/sections.css',
  './css/finance.css',
  './css/tochka.css',
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
  './js/screens/training-chat.js',
  './js/screens/training-insights.js',
  './js/screens/habits.js',
  './js/screens/finance.js',
  './js/screens/finance-piggy.js',
  './js/screens/finance-spend.js',
  './js/screens/goals.js',
];

/* Установка — кешируем всё */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

/* Активация — чистим старый кеш */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Запросы — сначала сеть, при ошибке — кеш */
self.addEventListener('fetch', e => {
  /* Firebase запросы — только через сеть */
  if (e.request.url.includes('firebase') || e.request.url.includes('googleapis')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        /* Обновляем кеш свежим ответом */
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./')))
  );
});
