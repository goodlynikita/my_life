/* ============================================================
   SERVICE WORKER — офлайн кеш
   ============================================================ */
const CACHE = 'nik-system-v2';

const STATIC = [
  '/my_life/',
  '/my_life/index.html',
  '/my_life/manifest.json',
  '/my_life/icon.png',
  '/my_life/css/tokens.css',
  '/my_life/css/home.css',
  '/my_life/css/training.css',
  '/my_life/css/sections.css',
  '/my_life/css/finance.css',
  '/my_life/js/config.js',
  '/my_life/js/store.js',
  '/my_life/js/auth.js',
  '/my_life/js/router.js',
  '/my_life/js/firebase-sync.js',
  '/my_life/js/features.js',
  '/my_life/js/slides.js',
  '/my_life/js/app.js',
  '/my_life/js/screens/login.js',
  '/my_life/js/screens/home.js',
  '/my_life/js/screens/training.js',
  '/my_life/js/screens/habits.js',
  '/my_life/js/screens/finance.js',
  '/my_life/js/screens/goals.js',
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
      .catch(() => caches.match(e.request).then(r => r || caches.match('/my_life/')))
  );
});
