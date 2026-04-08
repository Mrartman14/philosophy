# PWA Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Довести PWA до production-качества — исправить баги, добавить офлайн-чтение, install/update UI, background sync инфраструктуру, клиентскую push-инфраструктуру.

**Architecture:** Ручной SW без библиотек. Build-скрипт генерирует `sw.js` и `manifest.webmanifest` из шаблонов с подстановкой `basePath`. React-хуки для SW lifecycle, install prompt, push. SyncQueue в IDB для будущей серверной синхронизации.

**Tech Stack:** Next.js 16 (SSG), TypeScript, IDB (`idb` library), Service Worker API, Push API, Cache API.

**Примечание:** В проекте нет тестового фреймворка. Верификация — ручная через `npm run build` + проверка сгенерированных файлов + DevTools.

---

### Task 1: Build-скрипт для генерации SW и манифеста

**Files:**
- Create: `scripts/generate-sw-assets.mjs`
- Create: `src/sw.template.js` (перенос из `public/sw.js` с плейсхолдерами)
- Create: `src/manifest.template.json` (перенос из `public/manifest.webmanifest`)
- Modify: `package.json:6` (скрипт build)
- Delete: ничего (public/sw.js и public/manifest.webmanifest будут перезаписываться скриптом)

**Step 1: Создать шаблон SW**

Скопировать `public/sw.js` → `src/sw.template.js`, заменив хардкод на плейсхолдеры:

```js
const BASE_PATH = '__BASE_PATH__';
const SW_VERSION = '__SW_VERSION__';

const CACHE_PREFIX = 'flbz';
const STATIC_CACHE = `${CACHE_PREFIX}-static-${SW_VERSION}`;
const NEXT_ASSETS_CACHE = `${CACHE_PREFIX}-next-${SW_VERSION}`;
const PAGE_DATA_CACHE = `${CACHE_PREFIX}-pagedata-${SW_VERSION}`;
const LECTURES_PAGE_CACHE = `${CACHE_PREFIX}-lectures-${SW_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${SW_VERSION}`;

const ALL_CACHES = [STATIC_CACHE, NEXT_ASSETS_CACHE, PAGE_DATA_CACHE, LECTURES_PAGE_CACHE, IMAGE_CACHE];

const STATIC_ASSETS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/logo.png`,
  `${BASE_PATH}/favicon.ico`,
  `${BASE_PATH}/offline.html`,
  `${BASE_PATH}/manifest.webmanifest`,
];
```

**Step 2: Создать шаблон манифеста**

`src/manifest.template.json`:
```json
{
  "name": "Философия ликбез",
  "short_name": "ФЛБЗ",
  "description": "Архив занятий курса Философия-ликбез",
  "start_url": "__BASE_PATH__/",
  "display": "standalone",
  "theme_color": "#f8f8f8",
  "background_color": "#111a20",
  "icons": [
    {
      "src": "./web-app-manifest-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "./web-app-manifest-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "./web-app-manifest-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "./web-app-manifest-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

**Step 3: Создать build-скрипт**

`scripts/generate-sw-assets.mjs`:
```js
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const version = Date.now().toString(36);

// Generate sw.js
const swTemplate = readFileSync(resolve(root, 'src/sw.template.js'), 'utf-8');
const sw = swTemplate
  .replaceAll('__BASE_PATH__', basePath)
  .replaceAll('__SW_VERSION__', version);
writeFileSync(resolve(root, 'public/sw.js'), sw);

// Generate manifest.webmanifest
const manifestTemplate = readFileSync(resolve(root, 'src/manifest.template.json'), 'utf-8');
const manifest = manifestTemplate.replaceAll('__BASE_PATH__', basePath);
writeFileSync(resolve(root, 'public/manifest.webmanifest'), manifest);

console.log(`[generate-sw-assets] basePath="${basePath}" version="${version}"`);
```

**Step 4: Обновить build-скрипт в package.json**

```json
"build": "node scripts/generate-sw-assets.mjs && next build",
```

**Step 5: Верификация**

```bash
NEXT_PUBLIC_BASE_PATH="/philosophy" npm run build
```

Проверить: `public/sw.js` содержит `const BASE_PATH = '/philosophy';`, `public/manifest.webmanifest` содержит `"start_url": "/philosophy/"`.

**Step 6: Commit**

```bash
git add scripts/generate-sw-assets.mjs src/sw.template.js src/manifest.template.json package.json
git commit -m "feat(pwa): add build script for SW and manifest generation with basePath"
```

---

### Task 2: Переписать SW — кэш-стратегии, версионирование, баг-фиксы

**Files:**
- Modify: `src/sw.template.js` (полная переработка)

**Step 1: Переписать SW целиком**

Полный контент `src/sw.template.js` (заменяет всё содержимое):

```js
const BASE_PATH = '__BASE_PATH__';
const SW_VERSION = '__SW_VERSION__';

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
```

**Step 2: Верификация**

```bash
NEXT_PUBLIC_BASE_PATH="/philosophy" node scripts/generate-sw-assets.mjs
```

Проверить `public/sw.js`: все пути содержат `/philosophy`, `ALL_CACHES` включает все кэши, `OFFLINE_URL` = `/philosophy/offline.html`.

**Step 3: Commit**

```bash
git add src/sw.template.js
git commit -m "feat(pwa): rewrite SW — proper cache strategies, versioning, basePath, LRU"
```

---

### Task 3: Хук `useRegisterSW`

**Files:**
- Create: `src/hooks/use-register-sw.ts`

**Step 1: Реализовать хук**

```ts
"use client";

import { useEffect, useRef, useState } from "react";

type UseRegisterSWReturn = {
  needsUpdate: boolean;
  applyUpdate: () => void;
};

export function useRegisterSW(): UseRegisterSWReturn {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

    navigator.serviceWorker
      .register(`${basePath}/sw.js`, {
        scope: `${basePath}/`,
        updateViaCache: "none",
      })
      .then((registration) => {
        // Check if there's already a waiting SW
        if (registration.waiting) {
          waitingRef.current = registration.waiting;
          setNeedsUpdate(true);
        }

        // Listen for new SW installing
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              waitingRef.current = newWorker;
              setNeedsUpdate(true);
            }
          });
        });
      })
      .catch((err) => console.error("[SW] registration failed:", err));

    // Reload on controller change (after SKIP_WAITING)
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  const applyUpdate = () => {
    waitingRef.current?.postMessage({ type: "SKIP_WAITING" });
  };

  return { needsUpdate, applyUpdate };
}
```

**Step 2: Commit**

```bash
git add src/hooks/use-register-sw.ts
git commit -m "feat(pwa): add useRegisterSW hook — registration + update detection"
```

---

### Task 4: Компонент `UpdatePrompt`

**Files:**
- Create: `src/components/app/update-prompt.tsx`

**Step 1: Реализовать компонент**

```tsx
"use client";

import { useRegisterSW } from "@/hooks/use-register-sw";

export const UpdatePrompt: React.FC = () => {
  const { needsUpdate, applyUpdate } = useRegisterSW();

  if (!needsUpdate) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-(--text-pane) border border-(--border) shadow-lg">
      <span className="text-sm">Доступно обновление</span>
      <button
        onClick={applyUpdate}
        className="text-sm font-medium px-3 py-1 rounded bg-(--foreground) text-(--background) hover:opacity-80"
      >
        Обновить
      </button>
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add src/components/app/update-prompt.tsx
git commit -m "feat(pwa): add UpdatePrompt component"
```

---

### Task 5: Хук `useInstallPrompt`

**Files:**
- Create: `src/hooks/use-install-prompt.ts`

**Step 1: Реализовать хук**

```ts
"use client";

import { useEffect, useRef, useState } from "react";

type UseInstallPromptReturn = {
  canInstall: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  promptInstall: () => Promise<void>;
};

export function useInstallPrompt(): UseInstallPromptReturn {
  const [canInstall, setCanInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const promptInstall = async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setCanInstall(false);
    }
    deferredPromptRef.current = null;
  };

  return { canInstall, isIOS, isStandalone, promptInstall };
}

// Type augmentation for BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}
```

**Step 2: Commit**

```bash
git add src/hooks/use-install-prompt.ts
git commit -m "feat(pwa): add useInstallPrompt hook"
```

---

### Task 6: Компонент `InstallBanner`

**Files:**
- Create: `src/components/app/install-banner.tsx`

**Step 1: Реализовать компонент**

```tsx
"use client";

import { useInstallPrompt } from "@/hooks/use-install-prompt";

export const InstallBanner: React.FC = () => {
  const { canInstall, isIOS, isStandalone, promptInstall } =
    useInstallPrompt();

  if (isStandalone) return null;

  if (canInstall) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-(--border) bg-(--text-pane)">
        <span className="text-sm">Установить приложение на устройство</span>
        <button
          onClick={promptInstall}
          className="text-sm font-medium px-3 py-1 rounded bg-(--foreground) text-(--background) hover:opacity-80 shrink-0"
        >
          Установить
        </button>
      </div>
    );
  }

  if (isIOS) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 border-b border-(--border) bg-(--text-pane) text-sm text-(--description)">
        Нажмите «Поделиться» ⎋ → «На экран Домой» + чтобы установить
      </div>
    );
  }

  return null;
};
```

**Step 2: Commit**

```bash
git add src/components/app/install-banner.tsx
git commit -m "feat(pwa): add InstallBanner component"
```

---

### Task 7: Интеграция в layout — UpdatePrompt, InstallBanner, удаление SWProvider

**Files:**
- Modify: `src/app/layout.tsx`
- Delete logic: `<SWProvider />` из layout

**Step 1: Обновить layout**

В `src/app/layout.tsx`:
- Убрать `import { SWProvider }` и `<SWProvider />`
- Добавить `import { UpdatePrompt }` и `<UpdatePrompt />` внутрь `<body>`
- Добавить `import { InstallBanner }` и `<InstallBanner />` перед `<main>`

Результирующая структура body:
```tsx
<body className={...}>
  <AppPageProvider>
    <AppHeader />
    <InstallBanner />
    <main className={...}>
      {children}
    </main>
    <AppFooter />
  </AppPageProvider>
  <UpdatePrompt />
  <Suspense>
    <YandexMetrika />
  </Suspense>
</body>
```

**Step 2: Верификация**

```bash
npm run build
```

Сборка проходит без ошибок.

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(pwa): integrate UpdatePrompt + InstallBanner, remove SWProvider from layout"
```

---

### Task 8: Push-сервис

**Files:**
- Create: `src/services/push-service/push-service.ts`

**Step 1: Реализовать сервис**

```ts
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

class PushService {
  async getSubscription(): Promise<PushSubscription | null> {
    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
  }

  async subscribe(): Promise<PushSubscription> {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    await this.sendSubscriptionToServer(subscription);
    return subscription;
  }

  async unsubscribe(): Promise<void> {
    const subscription = await this.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      // TODO: notify server about unsubscription
    }
  }

  getPermission(): NotificationPermission {
    return Notification.permission;
  }

  /** TODO: implement when backend is ready */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async sendSubscriptionToServer(_sub: PushSubscription): Promise<void> {
    // Will POST subscription to backend endpoint
  }
}

export const pushService = new PushService();
```

**Step 2: Commit**

```bash
git add src/services/push-service/push-service.ts
git commit -m "feat(pwa): add push service layer with server stub"
```

---

### Task 9: Хук `usePushSubscription`

**Files:**
- Create: `src/hooks/use-push-subscription.ts`

**Step 1: Реализовать хук**

```ts
"use client";

import { useEffect, useState } from "react";
import { pushService } from "@/services/push-service/push-service";

type UsePushSubscriptionReturn = {
  isSupported: boolean;
  permission: NotificationPermission;
  subscription: PushSubscription | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
};

export function usePushSubscription(): UsePushSubscriptionReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      pushService.getSubscription().then(setSubscription);
    }
  }, []);

  const subscribe = async () => {
    const sub = await pushService.subscribe();
    setSubscription(sub);
    setPermission(Notification.permission);
  };

  const unsubscribe = async () => {
    await pushService.unsubscribe();
    setSubscription(null);
  };

  return { isSupported, permission, subscription, subscribe, unsubscribe };
}
```

**Step 2: Commit**

```bash
git add src/hooks/use-push-subscription.ts
git commit -m "feat(pwa): add usePushSubscription hook"
```

---

### Task 10: Рефакторинг страницы `/push`

**Files:**
- Modify: `src/app/push/page.tsx` (полная переработка)

**Step 1: Переписать страницу**

```tsx
"use client";

import { Tractate } from "@/components/shared/tractate/tractate";
import { usePushSubscription } from "@/hooks/use-push-subscription";

function PushNotificationManager() {
  const { isSupported, permission, subscription, subscribe, unsubscribe } =
    usePushSubscription();

  if (!isSupported) {
    return (
      <p className="text-(--description)">
        Push-уведомления не поддерживаются в этом браузере.
      </p>
    );
  }

  if (permission === "denied") {
    return (
      <p className="text-(--description)">
        Уведомления заблокированы. Разрешите их в настройках браузера.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p>
        {subscription
          ? "Вы подписаны на уведомления."
          : "Вы не подписаны на уведомления."}
      </p>
      {subscription ? (
        <button
          className="self-start px-4 py-2 rounded border border-(--border) hover:bg-(--text-pane)"
          onClick={unsubscribe}
        >
          Отписаться
        </button>
      ) : (
        <button
          className="self-start px-4 py-2 rounded border border-(--border) hover:bg-(--text-pane)"
          onClick={subscribe}
        >
          Подписаться
        </button>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Tractate>
      <h1 className="text-2xl font-bold mb-4">Уведомления</h1>
      <PushNotificationManager />
    </Tractate>
  );
}
```

**Step 2: Верификация**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/push/page.tsx
git commit -m "refactor(pwa): rewrite /push page — hooks instead of SWProvider, Russian text"
```

---

### Task 11: SyncQueue — инфраструктура для background sync

**Files:**
- Create: `src/services/sync-queue/sync-queue.ts`

**Step 1: Реализовать SyncQueue**

```ts
import { openDB } from "idb";

const DB_NAME = "syncQueueDB";
const STORE_NAME = "actions";
const DB_VERSION = 1;

export type SyncAction = {
  id?: number;
  action: "fav_toggle" | "mark_viewed";
  lectureId: string;
  timestamp: number;
};

const getDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    },
  });
};

class SyncQueue {
  async push(action: Omit<SyncAction, "id" | "timestamp">): Promise<void> {
    const db = await getDB();
    await db.add(STORE_NAME, {
      ...action,
      timestamp: Date.now(),
    });
  }

  async drain(): Promise<SyncAction[]> {
    const db = await getDB();
    const all = await db.getAll(STORE_NAME);
    return all;
  }

  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear(STORE_NAME);
  }

  /** TODO: вызывается из SW при sync event, когда бэкенд будет готов */
  async processSyncQueue(): Promise<void> {
    const actions = await this.drain();
    if (actions.length === 0) return;

    // TODO: POST actions to backend
    // await fetch(`${API_URL}/sync`, { method: 'POST', body: JSON.stringify(actions) });
    // await this.clear();
  }
}

export const syncQueue = new SyncQueue();
```

**Step 2: Commit**

```bash
git add src/services/sync-queue/sync-queue.ts
git commit -m "feat(pwa): add SyncQueue service for background sync infrastructure"
```

---

### Task 12: Интеграция SyncQueue в LectureService

**Files:**
- Modify: `src/services/lecture-service/lecture-service.ts`

**Step 1: Добавить запись в очередь при мутациях**

Добавить импорт в начало файла:
```ts
import { syncQueue } from "@/services/sync-queue/sync-queue";
```

В метод `setFavLectureId` после `await db.put(...)` добавить:
```ts
await syncQueue.push({ action: "fav_toggle", lectureId: id });
```

В метод `setLastViewedLectureId` после `await db.put(...)` добавить:
```ts
await syncQueue.push({ action: "mark_viewed", lectureId: id });
```

**Step 2: Верификация**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/services/lecture-service/lecture-service.ts
git commit -m "feat(pwa): integrate SyncQueue into LectureService mutations"
```

---

### Task 13: Улучшение страницы `/offline`

**Files:**
- Modify: `src/app/offline/page.tsx`

**Step 1: Переписать offline-страницу**

```tsx
"use client";

import { useEffect, useState } from "react";
import { GoBack } from "@/components/shared/go-back";
import { OfflineIcon } from "@/assets/icons/offline-icon";
import { lectureService } from "@/services/lecture-service/lecture-service";

export default function Page() {
  const [viewedIds, setViewedIds] = useState<string[]>([]);

  useEffect(() => {
    lectureService.getLastViewedLectureIds().then(setViewedIds);
  }, []);

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return (
    <div className="w-full h-full flex items-center justify-center flex-col gap-6 p-4">
      <h1 className="text-5xl font-bold flex items-center gap-4">
        Нет сети <OfflineIcon />
      </h1>

      {viewedIds.length > 0 && (
        <div className="w-full max-w-md flex flex-col gap-2">
          <p className="text-(--description) text-sm">
            Недавно просмотренные лекции могут быть доступны из кэша:
          </p>
          <ul className="flex flex-col gap-1">
            {viewedIds.map((id) => (
              <li key={id}>
                <a
                  href={`${basePath}/lectures/${id}`}
                  className="text-blue-500 hover:underline"
                >
                  {id}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <GoBack />
    </div>
  );
}
```

**Step 2: Верификация**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/offline/page.tsx
git commit -m "feat(pwa): enhance offline page — show cached lectures list"
```

---

### Task 14: Удаление старого SWProvider

**Files:**
- Delete: `src/app/_providers/sw-provider.tsx`
- Verify: никто кроме `/push` (уже рефакторнутой) не импортирует SWProvider

**Step 1: Проверить зависимости**

```bash
grep -r "sw-provider\|SWProvider" src/ --include="*.ts" --include="*.tsx"
```

Ожидаемый результат: 0 совпадений (push page уже рефакторнута, layout уже обновлён).

**Step 2: Удалить файл**

```bash
rm src/app/_providers/sw-provider.tsx
```

**Step 3: Верификация**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add -u src/app/_providers/sw-provider.tsx
git commit -m "refactor(pwa): remove deprecated SWProvider"
```

---

### Task 15: Финальная верификация

**Step 1: Полная сборка**

```bash
NEXT_PUBLIC_BASE_PATH="/philosophy" npm run build
```

**Step 2: Проверить сгенерированные файлы**

- `public/sw.js` — basePath `/philosophy` во всех путях
- `public/manifest.webmanifest` — `start_url: "/philosophy/"`, 4 иконки, `description`
- `out/offline.html` — существует

**Step 3: Lighthouse PWA audit** (вручную в DevTools)

- Installability
- PWA Optimized
- Service Worker

**Step 4: Commit**

```bash
git add public/sw.js public/manifest.webmanifest
git commit -m "chore(pwa): regenerate SW and manifest for verification"
```
