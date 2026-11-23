/* ============================================================
   SERVICE WORKER — офлайн кеш
   ============================================================ */
const CACHE = 'nik-system-v329';
const HERO_MEDIA_CACHE = 'nik-hero-media-v1';

const STATIC = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './favicon.ico',
  './img/fav/tab-32.png',
  './img/fav/icon-192.png',
  './css/app-fonts.css',
  './css/winter-fonts.css',
  './css/vendor/tabler-icons-3.48.0.css',
  './fonts/montserrat/cyrillic-ext.woff2',
  './fonts/montserrat/cyrillic.woff2',
  './fonts/montserrat/vietnamese.woff2',
  './fonts/montserrat/latin-ext.woff2',
  './fonts/montserrat/latin.woff2',
  './fonts/unbounded/cyrillic-ext.woff2',
  './fonts/unbounded/cyrillic.woff2',
  './fonts/unbounded/vietnamese.woff2',
  './fonts/unbounded/latin-ext.woff2',
  './fonts/unbounded/latin.woff2',
  './fonts/tabler-3.48.0/app-icons.woff2',
  './fonts/tabler-3.48.0/tabler-icons.woff2',
  './js/vendor/firebase-10.12.0/firebase-app.js',
  './js/vendor/firebase-10.12.0/firebase-auth.js',
  './js/vendor/firebase-10.12.0/firebase-database.js',
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
  './js/moved.js',
  './js/hi.js',
  './js/palette.js',
  './js/config.js',
  './js/store.js',
  './js/startup-network.js',
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
  './img/wa/props.webp',
  './img/wa/ice-icons.webp',
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

/* Сборка подставляет SHA-256 готовых файлов после сжатия кода, до gzip. */
const STATIC_HASHES = null;

/* Старые страницы и кабинет по-прежнему могут обращаться к CDN.
   Их уже загруженные библиотеки сохраняем; запуск YOU использует локальные версии из STATIC. */
const CDN_CACHE = 'nik-cdn-v1';

async function matchesHash(response, expected) {
  if (!response || !response.ok || !expected) return false;
  const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('') === expected;
}

/* Неизменившийся файл переносим из установленной версии после проверки содержимого.
   Новая версия активируется только целиком; при ошибке прежняя продолжает работать. */
async function installStatic() {
  const cache = await caches.open(CACHE);
  const keys = (await caches.keys()).filter(k => /^nik-system-v\d+$/.test(k) && k !== CACHE).sort((a, b) => Number(b.split('-v').pop()) - Number(a.split('-v').pop()));
  const previous = await Promise.all(keys.map(k => caches.open(k)));
  let next = 0;
  async function fill() {
    while (next < STATIC.length) {
      const path = STATIC[next++], request = new Request(new URL(path, self.location.href), { cache: 'no-cache' });
      const expected = STATIC_HASHES && STATIC_HASHES[path];
      let response = null;
      if (expected) for (const source of [cache, ...previous]) {
        const candidate = await source.match(request);
        if (await matchesHash(candidate, expected)) { response = candidate; break; }
      }
      if (!response) {
        response = await fetch(request);
        if (!response.ok || (expected && !await matchesHash(response, expected))) throw new Error('Incomplete app update: ' + path);
      }
      await cache.put(request, response);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, STATIC.length) }, fill));
}

/* Установка больше не ждёт внешние CDN. Все необходимые YOU ресурсы уже в STATIC. */
self.addEventListener('install', e => {
  e.waitUntil(
    installStatic().then(() => self.skipWaiting())
  );
});

/* Активация: чистим старый кеш */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== CDN_CACHE && k !== HERO_MEDIA_CACHE).map(k => caches.delete(k)))
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
  /* Новые версии графики персонажа и ледяных шаров грузятся после открытия экрана, не задерживая установку.
     Их отдельный кэш переживает обновления приложения и остаётся доступен без сети. */
  const parsed = new URL(url);
  if (parsed.origin === self.location.origin && /\/img\/(?:hero\/(?:looks|props|scenes)|wa\/habit-orbs)-v\d+\.webp$/.test(parsed.pathname)) {
    e.respondWith(caches.open(HERO_MEDIA_CACHE).then(async cache => {
      const hit = await cache.match(req, { ignoreSearch: true }); if (hit) return hit;
      const response = await fetch(req); if (response.ok) await cache.put(req, response.clone()); return response;
    }));
    return;
  }
  if (req.mode === 'navigate') {
    const page = new URL(url), base = new URL('./', self.location.href);
    /* Оболочка приложения и её скрипты берутся из одной установленной версии.
       Новую версию целиком загружает install, проверка SW остаётся фоновой. */
    if (page.origin === base.origin && (page.pathname === base.pathname || page.pathname === base.pathname + 'index.html')) {
      e.respondWith(mine().then(c => c.match(req, { ignoreSearch: true }).then(hit => hit || c.match('./index.html')).then(hit => hit || fetch(req))));
      return;
    }
    /* Другие страницы: сеть с ожиданием до 3 секунд, затем кеш своей версии. */
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
