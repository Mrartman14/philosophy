# PWA Overhaul — Design Document

## Контекст

Приложение «Философия-ликбез» — Next.js SSG (`output: "export"`), деплой на GitHub Pages. Уже есть основа PWA: manifest, service worker, offline-страница, push-подписка, IndexedDB. Но реализация содержит баги и незавершённые участки.

## Цель

Довести PWA до production-качества: исправить баги, добавить офлайн-чтение просмотренных лекций, install prompt, SW update UI, background sync инфраструктуру, клиентскую push-инфраструктуру.

## Подход

Ручной SW (без Workbox/Serwist). Обоснование: статический экспорт, простая структура, нулевой overhead, полный контроль.

---

## Секция 1: Баг-фиксы SW и манифест

### Манифест (`manifest.webmanifest`)
- `start_url` — сделать динамическим (генерация через build-скрипт или использование `basePath`)
- Добавить `description: "Архив занятий курса Философия-ликбез"`
- Добавить иконку 512x512 с `purpose: "any"` (сейчас только `maskable`)

### Service Worker (`sw.js`)
- `STATIC_ASSETS` — учитывать `basePath` в путях. Сейчас `/` и `/favicon.ico` не совпадают с реальными URL при `basePath: "/philosophy"`
- Offline fallback — `'/offline.html'` заменить на корректный путь, который генерирует Next.js static export (`/philosophy/offline/index.html` или аналог)
- `process.env.NEXT_PUBLIC_BASE_URL` в `notificationclick` — env-переменные не работают в plain JS. Решение: `self.location.origin + basePath` или генерация sw.js через build-скрипт
- Whitelist в `activate` — добавить `PAGE_DATA_CACHE` и `LECTURES_PAGE_CACHE` (сейчас удаляются при каждой активации)

### SWProvider — рефакторинг
- Убрать `SWProvider` как единый компонент
- SW-регистрация → хук `useRegisterSW()` в layout (fire-and-forget + update detection)
- Push-подписка → отдельный хук `usePushSubscription()`, используется локально на `/push`

---

## Секция 2: Кэш-стратегии

| Ресурс | Стратегия | Обоснование |
|---|---|---|
| `/_next/static/*` | Cache-first | Контент-хешированы, не меняются |
| `page-data.json` | Stale-while-revalidate | Данные обновляются, допустим stale |
| Превью-картинки (`.jpeg`) | Cache-first + LRU (max 100, 30 дней) | Редко меняются |
| HTML страниц лекций | Stale-while-revalidate | Контент может обновиться |
| Статика (favicon, manifest, logo) | Cache-first | Меняется только с деплоем |
| `.docx` | Не кэшируем | Парсится на билде, в рантайме нужен только для скачивания |

### Офлайн-контент
- Просмотренные лекции уже кэшируются через stale-while-revalidate (HTML + превью попадают в кэш при просмотре)
- Страница `/offline` — вместо «Нет сети» показывать список просмотренных лекций из IDB с пометкой, что они доступны для чтения

### Ограничение размера кэша
- Картинки: max 100 записей, LRU
- Общий лимит через ручную чистку в `activate`

---

## Секция 3: SW Lifecycle, Install Prompt, Update UI

### Хук `useRegisterSW()`
- Регистрирует SW при монтировании
- Слушает `controllerchange` (новый SW активировался)
- Возвращает `{ needsUpdate, applyUpdate }`

### Update UI
- Слушаем `statechange` на `registration.waiting`
- Toast/banner: «Доступно обновление» + кнопка «Обновить»
- По клику: `registration.waiting.postMessage({ type: 'SKIP_WAITING' })` → SW `self.skipWaiting()` → `controllerchange` → `location.reload()`
- Компонент `UpdatePrompt` в layout

### Install Prompt
- Хук `useInstallPrompt()` — перехватывает `beforeinstallprompt`
- Возвращает `{ canInstall, promptInstall }`
- Компонент `InstallBanner` — на главной или в хедере
- iOS: определяем через user agent + standalone check, текстовая инструкция
- Убираем текущий `InstallPrompt` со страницы `/push`

### Версионирование SW
- Единая переменная `SW_VERSION` в начале sw.js
- При деплое — новая версия → старые кэши чистятся в `activate`

---

## Секция 4: Background Sync

### Очередь синхронизации — `SyncQueue`
- Новый IDB store для отложенных действий
- Формат записи: `{ action: 'fav_toggle' | 'mark_viewed', lectureId: string, timestamp: number }`
- `LectureService` при мутациях пишет в очередь
- `LectureService` остаётся local-first (IDB = source of truth)

### Готовность к API
- Заглушка `processSyncQueue()` с TODO
- Когда появится бэкенд: SW слушает `sync` event → drain очереди → fetch на сервер
- Background Sync API регистрацию не добавляем сейчас (нет endpoint'а)

---

## Секция 5: Push-инфраструктура (клиентская)

### Три слоя

**1. SW push-обработчик** (существующий, чистим):
- `push` event → показать notification с payload `{ title, body, icon, url }`
- `notificationclick` → открыть приложение (фикс `process.env` бага)

**2. Push-сервис** — `src/services/push-service/push-service.ts`:
- `getSubscription()` — текущая подписка из SW registration
- `subscribe()` — запрос permission, `pushManager.subscribe()`, возврат `PushSubscription`
- `unsubscribe()`
- `sendSubscriptionToServer(sub)` — заглушка (no-op), потом один fetch на бэкенд
- VAPID public key из env-переменной

**3. UI-хук** — `usePushSubscription()`:
- Использует push-service
- Возвращает `{ isSupported, permission, subscription, subscribe, unsubscribe }`
- `permission`: `'default' | 'granted' | 'denied'`

### Страница `/push`
- Рефакторинг: убираем render-prop SWProvider, используем хук
- Убираем нерабочие server actions
- UI: статус подписки, кнопка подписки/отписки, состояние permission
- Текст на русском

### Что НЕ делаем
- Серверная часть (send notification, хранение подписок)
- `sendTestNotification` — без бэкенда не работает
- VAPID key пока в `.env`
