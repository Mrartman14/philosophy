# Просмотр статистики пользователя — дизайн

Дата: 2026-06-15
Статус: утверждён к реализации

## Цель

Дать залогиненному пользователю просмотр его собственной статистики. Статистика
делится на две независимые части:

1. **Производственная статистика (инвентарь)** — сколько живых сущностей создал
   пользователь, по типам и видимости. Read-only, **не регулируется**.
2. **Статистика просмотров** — что и сколько раз пользователь просматривал.
   **Регулируемая**: работает только при включённом трекинге, тоггл живёт в
   личном кабинете (`/settings`).

## Контракт с бекендом

Все эндпоинты self-only (`/api/me/*`), гейтятся только аутентификацией;
кросс-юзерного доступа нет.

### Производственная статистика
`GET /api/me/production` → `productionstats.Inventory`:

```
Inventory {
  by_type: EntityInventory[]   // в порядке регистрации на бэке
  totals:  Totals
}
EntityInventory {
  entity_type: lecture|document|canvas|form|trail|media|annotation|comment
  total:   number
  public?: number   // null/omitted для comment (бэк не различает видимость)
  private?: number  // null/omitted для comment
}
Totals { total, public, private }   // comment входит в total, но НЕ в public/private
```

Порядок типов в `by_type` (как на бэке): lecture, document, canvas, form, trail,
media, annotation, comment.

### Статистика просмотров
`GET /api/me/history/stats` → `history.Stats`:

```
Stats {
  total:         number
  count_by_type: { [target_type]: number }
  top:           StatItem[]   // максимум 50, ORDER BY count DESC, last_viewed DESC
}
StatItem {
  target_type:    lecture|document|trail|canvas|form
  target_id:      string
  title?:         string    // null, если цель недоступна
  available:      boolean   // false = удалена или больше не видна актору
  count:          number
  last_viewed_at: string    // ISO-время
}
```

Эндпоинт возвращает 200 даже при выключенном трекинге (история пуста → `total: 0`).

### Регулирование трекинга
- `GET /api/me/history/settings` → `history.Settings { tracking_enabled: boolean }`
- `PUT /api/me/history/settings` body `history.SetTrackingRequest { tracking_enabled: boolean }`
  → `history.Settings`

По умолчанию `tracking_enabled = false`.

**КРИТИЧНО:** выключение трекинга (`true → false`) на бэке вызывает
`DisableAndPurgeTx` — **безвозвратно удаляет всю историю просмотров** пользователя
в одной транзакции (`DELETE FROM user_view_history`). Это требует подтверждения в UI.

## Решения по UX (утверждены пользователем)

1. **Размещение**: просмотр статистики — отдельная страница `/me/stats`
   («Моя статистика», обе статистики). Тоггл трекинга — на `/settings` (личный
   кабинет).
2. **Выключение трекинга**: диалог-подтверждение (`ConfirmDialog`, `destructive`)
   с явным предупреждением о безвозвратном удалении истории.

## Архитектура: фича-слайс `src/features/statistics/`

Создаётся из `src/features/_template/` по [docs/frontend-conventions.md](../../frontend-conventions.md).

| Файл | Назначение |
|---|---|
| `api.ts` | server-only fetchers на `React.cache` (НЕ `unstable_cache` — данные пер-юзерные, cross-request кеш протёк бы между пользователями) |
| `actions.ts` | server action `setHistoryTracking` |
| `schemas.ts` | Zod-схема входа экшена |
| `types.ts` | алиасы на `components["schemas"][...]` |
| `permissions.ts` | доменные RBAC-хелперы |
| `ui/production-stats-table.tsx` | презентационный server-компонент |
| `ui/view-stats.tsx` | презентационный server-компонент |
| `ui/history-tracking-toggle.tsx` | `"use client"` тоггл + ConfirmDialog |
| `index.ts` | барьер фичи (экспорт всего, включая тоггл — как в `preferences`) |
| `permissions.test.ts`, `schemas.test.ts`, тесты компонентов | vitest |

### `types.ts`
```ts
import type { components } from "@/api/schema";

export type Inventory       = components["schemas"]["productionstats.Inventory"];
export type EntityInventory = components["schemas"]["productionstats.EntityInventory"];
export type ViewStats       = components["schemas"]["history.Stats"];
export type ViewStatItem    = components["schemas"]["history.StatItem"];
export type HistorySettings = components["schemas"]["history.Settings"];
```

### `api.ts`
Все три fetcher'а — `server-only` + `React.cache` (дедуп в рамках запроса),
вызывать только после `getMe() !== null`:

- `getProductionStats(): Promise<Inventory>` — `GET /api/me/production`, throw на error.
- `getViewStats(): Promise<ViewStats>` — `GET /api/me/history/stats`, throw на error.
- `getHistorySettings(): Promise<HistorySettings>` — `GET /api/me/history/settings`,
  throw на error.

Возвращаемые `data.data ?? {}`-фоллбеки как в `preferences/api.ts`.

### `permissions.ts`
```ts
import { isMutationAllowed } from "@/utils/permissions";

/** Изменение собственных настроек истории: любой active-пользователь.
 *  Бэк гейтит только RequireMutator (suspended → 403 SUSPENDED), спец-capability нет. */
export function canManageOwnHistory(me: MaybeMe): boolean {
  return isMutationAllowed(me);
}
```
Просмотр собственной статистики отдельной capability не требует — страница
гейтится `if (!me) redirect(...)` (Layer-3).

### `schemas.ts`
```ts
import { z } from "zod";
export const HistoryTrackingSchema = z.boolean();
```

### `actions.ts`
```ts
export const setHistoryTracking = createAction(async (raw: unknown) => {
  const me = await getMe();
  requireCapability(me, canManageOwnHistory);
  const enabled = HistoryTrackingSchema.parse(raw);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/me/history/settings", {
    body: { tracking_enabled: enabled },
  });
  if (error) rethrowApiError(error as ApiError);
  return (data.data ?? null) as HistorySettings | null;
});
```
`rethrowApiError`: `SUSPENDED → ForbiddenError`, `BAD_REQUEST/VALIDATION_ERROR →
Error(сообщение)`, остальное → `handleCommonApiError` (как в `preferences/actions.ts`).

Инвалидация кеша через `revalidateEntity` **не используется**: fetchers на
`React.cache` (не `unstable_cache`), revalidateTag для них no-op. Синхронизация
server-рендера после мутации — через `router.refresh()` в клиентском тоггле.
Новый Tag в `src/api/tags.ts` не добавляется.

## UI

### `ui/production-stats-table.tsx` (server, презентационный)
Принимает `inventory: Inventory`. Рендерит `Table` (`@/components/ui`):

| Тип | Всего | Публичных | Приватных |
|---|---|---|---|
| Лекции | total | public | private |
| … | | | |
| **Итого** | totals.total | totals.public | totals.private |

- Локализованные подписи типов (Лекции, Документы, Канвасы, Формы, Маршруты,
  Медиа, Аннотации, Комментарии).
- Для `comment` (public/private = null) в этих ячейках «—».
- Пустой инвентарь (`total: 0` везде) — `EmptyState` «Вы пока ничего не создали».

### `ui/view-stats.tsx` (server, презентационный)
Принимает `stats: ViewStats` и `trackingEnabled: boolean`.

- Если `trackingEnabled === false`: `EmptyState`/подсказка «Трекинг просмотров
  выключен» + `RouterLink` на `/settings` («Включить в настройках»). Список не показываем.
- Если трекинг включён, но `total === 0`: «Вы пока ничего не просматривали».
- Иначе: `total`, разбивка `count_by_type` (локализованные типы), и список `top`:
  - `available === true` → `RouterLink` на цель (путь по `target_type` + `target_id`)
    с `title`, счётчиком и датой последнего просмотра.
  - `available === false` → серый текст «Недоступно» + счётчик (без ссылки).

Хелпер путей по `target_type`: lecture→`/lectures/:id`, document→`/documents/:id`,
trail→`/trails/:id`, canvas→`/canvases/:id`, form→`/forms/:id` (сверить с реальными
маршрутами `src/app/*` на этапе реализации).

### `ui/history-tracking-toggle.tsx` (`"use client"`)
По образцу `preferences/ui/push-subscription-toggle.tsx`, на `Button`. Принимает
`initialEnabled: boolean`, `canManage: boolean` (результат `canManageOwnHistory(me)`
со страницы).

- Локальный `useState` для текущего состояния + `pending`.
- **Включение** (выкл → вкл): прямой вызов `setHistoryTracking(true)`.
- **Выключение** (вкл → выкл): кнопка обёрнута в `ConfirmDialog`
  (`destructive`, `confirmLabel="Выключить"`), `onConfirm` → `setHistoryTracking(false)`.
  Текст: «Выключить трекинг? Вся история просмотров будет удалена безвозвратно.»
- После успеха: `useToast` (успех) + `router.refresh()`.
- Ошибки: `result.code === "forbidden"` → «У вас нет прав…», иначе `result.error`.
- `disabled` при `!canManage` или `pending`.

## Страницы

### `src/app/me/stats/page.tsx` (server component)
```
const me = await getMe();
if (!me) redirect("/login?next=/me/stats");
const [inventory, viewStats, settings] = await Promise.all([
  getProductionStats(), getViewStats(), getHistorySettings(),
]);
```
`metadata = { title: "Моя статистика" }`. Две секции: «Что я создал»
(`ProductionStatsTable`) и «Мои просмотры» (`ViewStats` с
`trackingEnabled={settings.tracking_enabled ?? false}`).

### `src/app/settings/page.tsx` (изменение)
Добавить секцию **«История просмотров»**:
- `getHistorySettings()` (добавить в `Promise.all`).
- `<HistoryTrackingToggle initialEnabled={...} canManage={canManageOwnHistory(me)} />`.
- `RouterLink` «Посмотреть мою статистику →» на `/me/stats`.

## Навигация

Глобальная шапка `src/components/app/app-header` — **заморожена**, не трогаем.
Ссылку на `/me/stats` из шапки выносим как опциональный отдельный foundation-PR
(вне скоупа). Внутри фичи дискаверабилити обеспечивается ссылкой со страницы
`/settings`.

## Обработка ошибок

- Экшен: `forbidden` → бренд-текст «У вас нет прав на изменение настроек.»,
  прочее → `result.error` / `handleCommonApiError`.
- Fetchers кидают на error → ловит `src/app/error.tsx`.
- Пустые статистики (новый юзер, выключенный трекинг) — это не ошибки, а
  `EmptyState`/подсказки.

## Тестирование

- `permissions.test.ts`: `canManageOwnHistory` для active/suspended/null.
- `schemas.test.ts`: `HistoryTrackingSchema` (boolean / не-boolean).
- Компонент-тесты (vitest + RTL):
  - `ProductionStatsTable`: рендер строк, «—» для comment, итоги, пустой стейт.
  - `ViewStats`: трекинг выкл / пусто / список с available и недоступными целями.
  - `HistoryTrackingToggle`: включение без диалога; выключение через ConfirmDialog;
    forbidden-ветка. `setHistoryTracking` и `router.refresh` мокаются.

Перед PR зелёными должны быть: `pnpm lint && pnpm test && pnpm build`.

## Запретные зоны — не затрагиваются

`src/api/schema.ts`, `src/api/tags.ts`, `src/app/layout.tsx`,
`src/components/app/*` (включая шапку), `src/components/ui/*` (только импорт),
`src/utils/*`, `src/hooks/*`, `package.json`.

## Out of scope

- Beacon-трекинг просмотров (клиентская запись `POST /api/me/history`) — отдельная
  инициатива; здесь только просмотр статистики и тоггл.
- Удаление отдельных записей истории (`DELETE /api/me/history/{id}`), экспорт
  (`/api/me/history/export`).
- Ссылка на `/me/stats` в глобальной шапке.
