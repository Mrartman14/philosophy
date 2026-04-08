const BASE_PATH = '/philosophy';
const SW_VERSION = 'mnpvn50d';

/** Cache names */
const CACHE_PREFIX = 'flbz';
const STATIC_CACHE = `${CACHE_PREFIX}-static-${SW_VERSION}`;
const NEXT_ASSETS_CACHE = `${CACHE_PREFIX}-next-${SW_VERSION}`;
const PAGE_DATA_CACHE = `${CACHE_PREFIX}-pagedata-${SW_VERSION}`;
const LECTURES_PAGE_CACHE = `${CACHE_PREFIX}-lectures-${SW_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${SW_VERSION}`;

const ALL_CACHES = [
  STATIC_CACHE,
  NEXT_ASSETS_CACHE,
  PAGE_DATA_CACHE,
  LECTURES_PAGE_CACHE,
  IMAGE_CACHE,
];

const STATIC_ASSETS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/logo.png`,
  `${BASE_PATH}/favicon.ico`,
  `${BASE_PATH}/offline.html`,
  `${BASE_PATH}/manifest.webmanifest`,
];

const OFFLINE_URL = `${BASE_PATH}/offline.html`;
const IMAGE_CACHE_LIMIT = 100;

/** Install — precache static assets */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch((e) => console.error('[SW] install error:', e))
  );
});

/** Activate — clean old caches */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && !ALL_CACHES.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .catch((e) => console.error('[SW] activate error:', e))
  );
});

/** Fetch — route to cache strategies */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // page-data.json — stale-while-revalidate
  if (url.pathname.endsWith('page-data.json')) {
    event.respondWith(staleWhileRevalidate(request, PAGE_DATA_CACHE));
    return;
  }

  // Lecture page HTML — stale-while-revalidate
  if (url.pathname.includes('/lectures') && (url.pathname.endsWith('.html') || url.pathname.endsWith('.txt'))) {
    event.respondWith(staleWhileRevalidate(request, LECTURES_PAGE_CACHE));
    return;
  }

  // Next.js static chunks — cache-first (content-hashed)
  if (url.pathname.includes('/_next/static/')) {
    event.respondWith(cacheFirst(request, NEXT_ASSETS_CACHE));
    return;
  }

  // Preview images — cache-first with LRU
  if (url.pathname.match(/\.(jpeg|jpg|png|webp)$/)) {
    event.respondWith(cacheFirstWithLimit(request, IMAGE_CACHE, IMAGE_CACHE_LIMIT));
    return;
  }

  // Precached static assets — cache-first
  if (STATIC_ASSETS.some((asset) => url.pathname === asset || url.pathname + '/' === asset)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Everything else — network with offline fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE_URL))
  );
});

/** Cache-first strategy */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(OFFLINE_URL);
  }
}

/** Cache-first with LRU eviction */
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

/** Stale-while-revalidate strategy */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    networkFetch; // fire and forget
    return cached;
  }

  const networkResponse = await networkFetch;
  return networkResponse || caches.match(OFFLINE_URL);
}

/** LRU cache trimming */
async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > limit) {
    await cache.delete(keys[0]);
    trimCache(cacheName, limit);
  }
}

/** SKIP_WAITING message from client */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/** Push notification */
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

/** Notification click — open app */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || `${self.location.origin}${BASE_PATH}/`;
  event.waitUntil(clients.openWindow(url));
});
