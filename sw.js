const STATIC_CACHE = 'static-v1';
const NEXT_ASSETS_CACHE = 'next-assets-v1';
const DOCX_CACHE = 'docx-v1';
// const PAGE_DATA_CACHE = 'page-data-v1';
const LECTURES_PAGE_CACHE = 'lecture-pages-v1';

const STATIC_ASSETS = [
  '/',
  '/logo.png',
  '/page-data.json',
  '/favicon.ico',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
];

// Кэшируем только статические ассеты при установке
self.addEventListener('install', event => {
  console.log('[SW] - install event', event)

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch((e) => console.error(e))
  );
});

// Очищаем устаревшие кэши при активации
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => ![STATIC_CACHE, NEXT_ASSETS_CACHE, DOCX_CACHE].includes(key))
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
      .catch((e) => console.error(e))
  );

  console.log('[SW] - activate event', event)
});

// Основная обработка fetch-запросов
self.addEventListener('fetch', event => {
  const { request } = event;

  // -1. lectures page content
  if (request.url.includes('/lectures') && (request.url.endsWith('.html') || request.url.endsWith('.txt'))) {
    event.respondWith(staleWhileRevalidate(request, LECTURES_PAGE_CACHE));
    return;
  }

  // 0. page-data: stale-while-revalidate
  // включить это когда получение жсона будет осуществляться не через файловую систему а через фетч
  // if (request.url.endsWith('page-data.json')) {
  //   event.respondWith(staleWhileRevalidate(request, PAGE_DATA_CACHE));
  //   return;
  // }

  // 1. DOCX-файлы: stale-while-revalidate
  if (request.url.endsWith('.docx')) {
    event.respondWith(staleWhileRevalidate(request, DOCX_CACHE));
    return;
  }

  // 2. Next.js чанки: динамическое кэширование, stale-while-revalidate
  if (request.url.includes('/_next/static/')) {
    event.respondWith(staleWhileRevalidate(request, NEXT_ASSETS_CACHE));
    return;
  }

  // 3. Статика: cache-first
  if (STATIC_ASSETS.some(asset => request.url.endsWith(asset))) {
    event.respondWith(
      caches.match(request)
        .then(response => response || fetch(request).catch(() => caches.match('/offline.html')))
    );
    return;
  }

  // 4. Все остальные запросы: сеть с fallback
  event.respondWith(
    fetch(request).catch(() => caches.match('/offline.html'))
  );
});

// Реализация stale-while-revalidate для docx
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const networkFetch = fetch(request)
    .then(networkResponse => {
      if (networkResponse && networkResponse.status === 200) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  // Если есть кэш — отдаём сразу, параллельно обновляем
  if (cachedResponse) {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    networkFetch; // не await, просто запускаем
    return cachedResponse;
  }

  // Если кэша нет — ждём сеть, если неудача — fallback
  const networkResponse = await networkFetch;
  return networkResponse || caches.match('/offline.html');
}

/** PUSHES */
self.addEventListener('push', function (event) {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: data.icon || '/icon.png',
      // badge: '/icon.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2',
      },
    }
    event.waitUntil(self.registration.showNotification(data.title, options))
  }
})
 
self.addEventListener('notificationclick', function (event) {
  console.log('Notification click received.')
  event.notification.close()
  event.waitUntil(clients.openWindow(process.env.NEXT_PUBLIC_BASE_URL))
})