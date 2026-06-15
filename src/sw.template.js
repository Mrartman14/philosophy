/* global selectCachesToDelete, isOfflineFileRequest, isSavedShellNavigation, OFFLINE_IMAGE_CACHE, SAVED_SHELL_CACHE, PRESERVED_CACHES */
const BASE_PATH = '__BASE_PATH__';
const SW_VERSION = '__SW_VERSION__';

const CACHE_PREFIX = 'flbz';
const STATIC_CACHE = `${CACHE_PREFIX}-static-${SW_VERSION}`;
const NEXT_ASSETS_CACHE = `${CACHE_PREFIX}-next-${SW_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-${SW_VERSION}`;
// Картинки НЕ кешируются оппортунистически: образы хранятся только для явно
// сохранённых лекций — в OFFLINE_IMAGE_CACHE (flbz-offline-images, sw-logic.ts).

const ALL_CACHES = [STATIC_CACHE, NEXT_ASSETS_CACHE, API_CACHE];

const STATIC_ASSETS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/logo.png`,
  `${BASE_PATH}/offline.html`,
  `${BASE_PATH}/manifest.webmanifest`,
];

const OFFLINE_URL = `${BASE_PATH}/offline.html`;

// Чистая маршрутизация/очистка кэшей инлайнится из src/services/offline/sw/sw-logic.ts
// на этапе build (scripts/generate-sw-assets.mjs). Здесь НЕ редактировать.
//__SW_LOGIC__

self.addEventListener('install', (event) => {
  // НЕ вызываем self.skipWaiting() здесь: новый SW должен оставаться в состоянии
  // `waiting`, чтобы UI ([UpdatePrompt]) показал «Доступно обновление» и пользователь
  // сам применил его кнопкой. skipWaiting() триггерится только из обработчика message
  // 'SKIP_WAITING' ниже (по клику → applyUpdate в use-register-sw.ts).
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch((e) => console.error('[SW] install error:', e))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          selectCachesToDelete(keys, ALL_CACHES).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .catch((e) => console.error('[SW] activate error:', e))
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Навигация в офлайн-раздел /saved — network-first в сохраняемый shell-кэш (app-shell).
  // RSC-fetch'и (mode !== 'navigate') сюда не попадают — клиентскую навигацию не ломаем.
  if (isSavedShellNavigation(request.mode, url.pathname)) {
    event.respondWith(navigationNetworkFirst(request, SAVED_SHELL_CACHE));
    return;
  }

  // API requests — network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Сохранённые офлайн-файлы (content-addressed, без расширения) — из офлайн-бакета.
  if (isOfflineFileRequest(url.pathname)) {
    event.respondWith(offlineFileFirst(request));
    return;
  }

  // Next.js static chunks — cache-first
  if (url.pathname.includes('/_next/static/')) {
    event.respondWith(cacheFirst(request, NEXT_ASSETS_CACHE));
    return;
  }

  // Precached static assets — cache-first
  if (STATIC_ASSETS.some((asset) => url.pathname === asset || url.pathname + '/' === asset)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Картинки НЕ кешируем оппортунистически: образы хранятся только для явно
  // сохранённых лекций (offlineFileFirst → OFFLINE_IMAGE_CACHE). Просмотренные
  // онлайн картинки идут в сеть через общий fallback ниже.

  // Everything else — network with offline fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE_URL))
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || caches.match(OFFLINE_URL);
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(OFFLINE_URL);
  }
}

async function offlineFileFirst(request) {
  // Сохранённый офлайн-файл — из бакета явных сохранений; иначе из сети без
  // кеширования (оппортунистического browsed-кэша больше нет).
  const offlineCache = await caches.open(OFFLINE_IMAGE_CACHE);
  const saved = await offlineCache.match(request);
  if (saved) return saved;
  try {
    return await fetch(request);
  } catch {
    // Для картинки возвращаем 504, а не offline.html (HTML в <img> бессмыслен).
    return new Response(null, { status: 504, statusText: 'Offline' });
  }
}

async function navigationNetworkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    // Не кэшируем редиректы (redirected Response в навигации может бросить в respondWith).
    if (response && response.status === 200 && !response.redirected) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || caches.match(OFFLINE_URL);
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: data.icon || `${BASE_PATH}/logo.png`,
    vibrate: [100, 50, 100],
    data: {
      url: data.url || `${BASE_PATH}/`,
    },
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || `${self.location.origin}${BASE_PATH}/`;
  event.waitUntil(clients.openWindow(url));
});
