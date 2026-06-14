/* global selectCachesToDelete, isOfflineFileRequest, isSavedShellNavigation, OFFLINE_IMAGE_CACHE, SAVED_SHELL_CACHE, PRESERVED_CACHES */
const BASE_PATH = '';
const SW_VERSION = 'mqe6pd9l';

const CACHE_PREFIX = 'flbz';
const STATIC_CACHE = `${CACHE_PREFIX}-static-${SW_VERSION}`;
const NEXT_ASSETS_CACHE = `${CACHE_PREFIX}-next-${SW_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-${SW_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${SW_VERSION}`;

const ALL_CACHES = [STATIC_CACHE, NEXT_ASSETS_CACHE, API_CACHE, IMAGE_CACHE];

const STATIC_ASSETS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/logo.png`,
  `${BASE_PATH}/offline.html`,
  `${BASE_PATH}/manifest.webmanifest`,
];

const OFFLINE_URL = `${BASE_PATH}/offline.html`;
const IMAGE_CACHE_LIMIT = 100;

// Чистая маршрутизация/очистка кэшей инлайнится из src/services/offline/sw/sw-logic.ts
// на этапе build (scripts/generate-sw-assets.mjs). Здесь НЕ редактировать.
// src/services/offline/sw/sw-logic.ts
// Чистые (без SW-глобалов и без import) решения маршрутизации и очистки кэшей
// для Service Worker. ИНЛАЙНИТСЯ в public/sw.js на этапе build: генератор
// (scripts/generate-sw-assets.mjs) транспилирует этот файл через ts.transpileModule,
// срезает import/export и вставляет на место маркера SW-логики в src/sw.template.js.
// Поэтому ЗДЕСЬ ЗАПРЕЩЕНЫ: import'ы, SW-глобалы (self/caches/fetch), enum, template-imports.
// ВАЖНО: имена объявляемых здесь const НЕ должны совпадать с константами шаблона
// (там уже есть CACHE_PREFIX/IMAGE_CACHE/…) — иначе двойной `const` в собранном SW =
// SyntaxError, и SW не зарегистрируется. Поэтому локальный префикс назван FLBZ_PREFIX.
// Только чистые функции и строковые константы. Покрыто sw-logic.test.ts (вкл. сверку
// OFFLINE_IMAGE_CACHE с contract/storage.ts и запрет top-level import).
const FLBZ_PREFIX = "flbz";
/** Неверсионируемый бакет Cache Storage для офлайн-картинок (= contract/storage.ts OFFLINE_IMAGE_CACHE). */
const OFFLINE_IMAGE_CACHE = "flbz-offline-images";
/** Неверсионируемый бакет app-shell офлайн-раздела /saved. */
const SAVED_SHELL_CACHE = "flbz-shell";
/** Кэши, которые activate-cleanup НЕ должен удалять (живут под persist(), не версионируются). */
const PRESERVED_CACHES = [OFFLINE_IMAGE_CACHE, SAVED_SHELL_CACHE];
/**
 * Какие существующие кэши удалить при активации нового SW: только наши (`flbz-*`),
 * не входящие в активный версионированный набор и не из preserved-набора.
 */
function selectCachesToDelete(existing, active, preserved = PRESERVED_CACHES) {
    return existing.filter((name) => name.startsWith(FLBZ_PREFIX) &&
        !active.includes(name) &&
        !preserved.includes(name));
}
/** Запрос к сохранённому офлайн-файлу (content-addressed, без расширения): /static/files/{key}. */
function isOfflineFileRequest(pathname) {
    return pathname.startsWith("/static/files/");
}
/**
 * Навигация (hard-load документа) в офлайн-раздел /saved (app-shell).
 * BASE_PATH в этом деплое = "" (см. generate-sw-assets.mjs), поэтому проверяем
 * абсолютный префикс пути. Клиентские RSC-fetch'и имеют mode !== "navigate" и сюда не попадают.
 */
function isSavedShellNavigation(mode, pathname) {
    return (mode === "navigate" &&
        (pathname === "/saved" || pathname.startsWith("/saved/")));
}


self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
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

  // Images — cache-first with LRU
  if (url.pathname.match(/\.(jpeg|jpg|png|webp)$/)) {
    event.respondWith(cacheFirstWithLimit(request, IMAGE_CACHE, IMAGE_CACHE_LIMIT));
    return;
  }

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

async function cacheFirstWithLimit(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
      trimCache(cacheName, limit);
    }
    return response;
  } catch {
    return caches.match(OFFLINE_URL);
  }
}

async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const excess = keys.length - limit;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}

async function offlineFileFirst(request) {
  const offlineCache = await caches.open(OFFLINE_IMAGE_CACHE);
  const saved = await offlineCache.match(request);
  if (saved) return saved;
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const lru = await caches.open(IMAGE_CACHE);
      lru.put(request, response.clone());
      trimCache(IMAGE_CACHE, IMAGE_CACHE_LIMIT);
    }
    return response;
  } catch {
    // Для картинки возвращаем 504, а не offline.html (HTML в <img> бессмыслен).
    return new Response(null, { status: 504, statusText: 'Offline' });
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
