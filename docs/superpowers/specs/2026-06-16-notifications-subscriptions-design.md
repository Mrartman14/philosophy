# Дизайн: In-app уведомления + подписки на документы

**Дата:** 2026-06-16
**Слайс:** `src/features/notifications/` (новый)
**Связано:** web-push (`preferences` slice) уже реализован — это транспорт доставки, не входит в скоуп.

---

## 1. Контекст и границы

Бэкенд добавил три связанные поверхности. Одна уже закрыта на фронте:

| Поверхность | Эндпоинты | Статус |
|---|---|---|
| **Web-push (транспорт)** | `POST /api/push/subscribe`, `POST /api/push/unsubscribe`, `GET /api/push/vapid-key` | ✅ готово (`src/features/preferences/`) — **не трогаем** |
| **(N) Инбокс уведомлений** | `GET /api/me/notifications` (offset/limit), `GET /api/me/notifications/counts`, `POST /api/me/notifications/read-all`, `POST /api/me/notifications/seen-all`, `POST /api/me/notifications/{id}/read` | ⛔ строим |
| **(S) Подписки на документы** | `POST /api/documents/{id}/subscribe`, `DELETE /api/documents/{id}/subscribe`, `GET /api/me/subscriptions` (offset/limit) | ⛔ строим |

N и S — один домен бэка (`notification.*`) и связаны причинно (подписка → уведомления), поэтому живут в **одном слайсе** `notifications`. Push остаётся в `preferences`.

### Типы из схемы (`src/api/schema.ts`)

```ts
"notification.Counts":        { unread?: number; unseen?: number }
"notification.Notification":  { id?, type?, reason?, actor_id?, target_id?,
                                target_type?, target_version?, group_count?,
                                read_at?, seen_at?, created_at?, updated_at? }   // type/reason/target_type — свободные строки
"notification.Subscription":  { id?, user_id?, target_id?, target_type?, created_at? }
```

`httputil.ListResponse` отдаёт `{ data, pagination: { total, offset, limit } }`.

---

## 2. Решения (зафиксированы с пользователем)

1. **Live-бейдж — лёгкий polling.** Хедер server-рендерит начальные `counts`; клиентский островок опрашивает `/counts` каждые ~45–60с и на focus/visibility. Realtime у бэка нет; push даёт ОС-нотификацию параллельно.
2. **Поверхность ленты — поповер + страница.** Из колокольчика выпадает поповер с последними N + ссылка на полную `/notifications` (пагинация, mark-all).
3. **Рендеринг текста — generic-резистентный.** Реестр `type → шаблон` с мягким fallback по `target_type`; неизвестный тип не роняет UI. Известные типы добавляются по мере сверки с бэком.
4. **Управление подписками — секция в `/settings`.** Кнопка subscribe на странице документа + список «Мои подписки» рядом с push-тоглом.

### Семантика двух счётчиков (контракт UI)

- `unseen` → **бейдж** на колокольчике (новые с последнего открытия). Открытие поповера → `POST /seen-all` → бейдж гаснет.
- `unread` → состояние конкретного элемента (`read_at == null`, жирный/точка). Клик по элементу → `POST /{id}/read`; кнопка «Прочитать все» → `POST /read-all`.

То есть «увидел» (badge dismiss) и «прочитал» (per-item) — независимы, как и на бэке.

---

## 3. Структура слайса

Стартуем копией `src/features/_template/` (см. `docs/frontend-conventions.md`, `_template/README.md`).

```
src/features/notifications/
  api.ts                      # server-only fetchers (React.cache)
  actions.ts                  # "use server": мутации + read-actions для клиента
  permissions.ts              # canUseNotifications, canManageSubscriptions
  types.ts                    # сужения notification.{Notification,Counts,Subscription}
  notification-content.ts     # ЧИСТЫЙ резистентный рендерер (type,target_type)→{text,href}
  schemas.ts                  # минимальный Zod для id-инпутов (опционально)
  ui/
    notification-bell.tsx         # "use client" — островок хедера (badge + popover trigger)
    notification-popover.tsx      # "use client" — последние N + seen-all on open
    notification-item.tsx         # один элемент (рендерер + read-on-click)
    notifications-list.tsx        # полная страница с пагинацией
    document-subscribe-button.tsx # "use client" — toggle на странице документа
    subscriptions-section.tsx     # секция «Мои подписки» для /settings
  index.ts                    # server-вход
  client.ts                   # client-safe вход (islands + рендерер + типы) — если нужен client-консьюмеру
  permissions.test.ts
  notification-content.test.ts
```

### 3.1. `api.ts` (server-only)

```ts
import "server-only";
import { cache } from "react";
import { createApiClient } from "@/api/client";
```

- `getNotifications(offset, limit)` → `{ items, total, offset, limit }` (ListResponse).
- `getNotificationCounts()` → `{ unread, unseen }`.
- `getSubscriptions(offset, limit)` → `{ items, total, offset, limit }`.
- `getDocumentSubscription(documentId)` → `boolean` — сканирует `/api/me/subscriptions` на `target_type === "document" && target_id === documentId`. См. §6 (known-limitation + backend-ask).

**Кеширование:** только `React.cache` (per-request dedup). **НЕ** `unstable_cache` — данные per-user и волатильны (cross-request leak/staleness). Инвалидация после мутаций — `revalidateEntity(Tags.NOTIFICATIONS)` / `Tags.SUBSCRIPTIONS`.

### 3.2. `actions.ts` (`"use server"`)

Мутации через `createAction` (`@/utils/create-action`), гейт `requireActive`/доменный хелпер, ошибки через `rethrowApiError`:

- `markRead(id)` → `POST /{id}/read`; `revalidateEntity(Tags.NOTIFICATIONS)`.
- `markAllRead()` → `POST /read-all`.
- `markAllSeen()` → `POST /seen-all`.
- `subscribeDocument(documentId)` → `POST /api/documents/{id}/subscribe`; `revalidateEntity(Tags.SUBSCRIPTIONS)` (+ `:id`).
- `unsubscribeDocument(documentId)` → `DELETE …`.

Read-actions для клиентского островка (тоже `createAction`, делегируют в `api.ts`):

- `fetchCounts()` → `ActionResult<Counts>` (polling).
- `fetchNotifications(offset, limit)` → `ActionResult<{ items, total, … }>` (загрузка/пагинация поповера).

> Read-action вызывается из обработчика события (не через `<form action>`) → router-revalidate не триггерится: чистый дата-фетч. Мутации сами зовут `revalidateEntity`.

### 3.3. `permissions.ts`

`/api/me/*` и subscribe не имеют отдельной capability в `rbac.Capability`. Гейт = **аутентифицирован + active**:

- `canUseNotifications(me)` → `me != null` (чтение своих; suspended может читать — бэк решит, фронт не блокирует жёстко).
- `canManageSubscriptions(me)` → `me != null && me.status === "active"` (или `requireActive` в actions).

В UI островки рендерим при `me != null`; 403 с бэка → бренд-текст «У вас нет прав…».

### 3.4. `notification-content.ts` (резистентный рендерер)

Чистая функция, без React/server-зависимостей (тестируема, переиспользуема в client.ts):

```ts
type Rendered = { text: string; href: string | null };
// реестр известных типов
const REGISTRY: Record<string, (n: Notification) => Rendered> = { … };
export function renderNotification(n: Notification): Rendered;
```

- Маппинг по `type`; при отсутствии — fallback по `target_type` (ссылка на сущность: document/lecture/annotation/comment) + нейтральный текст (`reason` или «Новое уведомление»).
- Учитывает `group_count` («…и ещё N»).
- Известные типы — **provisional** (засеять `comment.created`, `document.updated`, `annotation.created`, reply/mention), помечены TODO на сверку с бэком; неизвестный `type` **не роняет** UI.

---

## 4. Поток данных и UI

### 4.1. Колокольчик (`notification-bell.tsx`, client)

- Хедер (server) при `me != null`: `getNotificationCounts()` → `<NotificationBell initialCounts={…} />`.
- Островок: `useState(initialCounts)`, `setInterval(fetchCounts, ~45–60s)` + слушатель `visibilitychange`/`focus`. Бейдж = `unseen` (скрыт при 0).
- Иконка — из существующих `@/assets/icons`; если подходящей нет — собрать инлайном из имеющегося (зависимостей **не** добавляем, `components/ui/*` не трогаем).

### 4.2. Поповер (`notification-popover.tsx`, client)

- На открытии: `fetchNotifications(0, 10)` + один раз `markAllSeen()` (бейдж гаснет, локально обнуляем `unseen`).
- Элемент (`notification-item.tsx`): текст из `renderNotification`; непрочитанный — выделен; клик → `markRead(id)` затем переход по `href`.
- Низ: «Все уведомления» → `/notifications`.

### 4.3. Страница `/notifications` (`src/app/notifications/page.tsx`, server)

- `getMe()`; гость → redirect на `/login?next=/notifications`.
- `getNotifications(offset, limit)` из `searchParams` (паттерн §3.5 conventions).
- Список (`notifications-list.tsx`) + пагинация + кнопки «Прочитать все» (`markAllRead`) / «Отметить просмотренными» (`markAllSeen`).

### 4.4. Подписки на документ (S)

- `<DocumentSubscribeButton documentId initialSubscribed>` — в шапке `src/app/documents/[id]/page.tsx` рядом с `ShareButton`, только при `me != null`. Оптимистичный toggle → `subscribeDocument` / `unsubscribeDocument`; при ошибке — откат + тост.
- `initialSubscribed` считает server-страница через `getDocumentSubscription(id)` (только при `me != null`).
- Секция «Мои подписки» (`subscriptions-section.tsx`) в `src/app/settings/page.tsx`: `getSubscriptions()` + список с «Отписаться».

---

## 5. RBAC (по CLAUDE.md / §4 conventions)

- В actions: `requireActive(me)` (или `requireCapability(me, canManageSubscriptions)`) до обращения к бэку.
- В server-components: доменные `canX(me)`, в client — только boolean-пропы (не объект `me`).
- 403 (`FORBIDDEN`/`SUSPENDED`/`BANNED`) обрабатывает `rethrowApiError`; UI показывает бренд-текст, не raw error. `BANNED` → `createAction` редиректит на `/auth/forced-logout`.

---

## 6. Затрагиваемые foundation/чужие файлы (осознанно, минимально)

| Файл | Изменение | Примечание |
|---|---|---|
| `src/components/app/app-header/app-header.tsx` | монтаж `<NotificationBell>` + `getNotificationCounts()` | **заморожен** → отдельный foundation-concern в плане, только монтаж |
| `src/app/documents/[id]/page.tsx` | кнопка + `initialSubscribed` | страница документа (не заморожена) |
| `src/app/settings/page.tsx` | секция «Мои подписки» | не заморожена |
| `src/api/tags.ts` | `NOTIFICATIONS`, `SUBSCRIPTIONS` | разрешено («дополняй при создании api.ts») |
| `src/app/notifications/page.tsx` | новый маршрут | — |

**Не трогаем:** `schema.ts`, `globals.css`, `components/ui/*`, `package.json`/lock, `eslint.config.mjs`, `admin/*`.

### Known-limitation + backend-ask

`getDocumentSubscription` сканирует `/api/me/subscriptions` (N+1 при большом числе подписок). Interim приемлем (только для залогиненного, на странице документа). **Backend-ask** (в стиле существующих ask-ов проекта): добавить `subscribed: bool` в detail документа **или** дешёвую HEAD-пробу `/api/documents/{id}/subscribe`. Низкий приоритет, деградирует мягко.

---

## 7. Тесты (§5 conventions, Vitest/jsdom)

- `permissions.test.ts` — `canUseNotifications`/`canManageSubscriptions`: гость → false, active → true, suspended → (по правилу) false для записи.
- `notification-content.test.ts` — `renderNotification`: известный тип, неизвестный тип (fallback), недостающие поля, `group_count`.
- `schemas.test.ts` — если `schemas.ts` появится (минимум 1 success + 1 failure).

Перед PR зелёные: `pnpm lint && pnpm test && pnpm build`.

---

## 8. Фазировка реализации

1. **Каркас данных** — slice scaffold, `api.ts`, `actions.ts`, `types.ts`, `permissions.ts`, `notification-content.ts`, теги, тесты. Без UI.
2. **Инбокс (N)** — `notification-bell` + `notification-popover` + `notification-item` + `notifications-list` + страница `/notifications`; монтаж в хедер (foundation-concern).
3. **Подписки (S)** — `document-subscribe-button` на странице документа + `subscriptions-section` в `/settings` + фиксация backend-ask.

Каждая фаза — зелёные lint/test/build перед переходом к следующей.
