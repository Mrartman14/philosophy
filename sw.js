self.addEventListener("install", function (event) {
	console.log('[SW] - install event', event)
});

self.addEventListener("activate", function (event) {
	console.log('[SW] - activate event', event)
});

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
    // event.waitUntil(clients.openWindow('<https://your-website.com>'))
})

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
})