# Дизайн: страница admin-модерации медиа (`/admin/media`)

**Дата:** 2026-06-22
**Статус:** на ревью
**Тип:** feature-слайс (`src/features/media/` + `src/app/admin/media/`) с одним admin-shell-смежным касанием (`admin-access.ts`) и foundation-касанием i18n-сообщений

## Проблема и контекст

Бэкенд добавил в `src/api/schema.ts` (последний реген) **новую ручку с нулевым
фронтендом**:

```
GET /api/admin/media — список НЕприватных медиа по ВСЕМ владельцам для admin-модерации.
```

Это закрывает пробел: до сих пор у медиа не было admin-списка
(см. комментарий в `src/features/media/actions.ts:43-45` — «admin-списка нет,
§10.3»). Теперь он есть, и нужен UI-фронт по образцу остальных admin-модераций
(аннотации, комментарии, документы, формы, share-ссылки).

Цель — дать админу (capability `media.delete_any`) одну страницу:
просмотреть чужие публичные медиа, отфильтровать по автору, удалить нарушающее.
Никаких новых семантик: повторяем устоявшийся паттерн
`src/app/admin/annotations/` максимально близко.

## Контракт бэкенда (verbatim из schema.ts)

`GET /api/admin/media` (`src/api/schema.ts:2836-2903`):

```
query:
  offset?: number     // Смещение
  limit?:  number     // Лимит
  owner_id?: string   // Фильтр по автору

200: components["schemas"]["httputil.ListResponse"] & { data?: media.Media[] }
401: httputil.ErrorResponse   // Unauthorized
403: httputil.ErrorResponse   // Forbidden
```

Doc-аннотация ручки: «Non-private media across all owners for the admin
moderation UI. Private media is never listed (admins have no window into other
users' private drafts). Gated by `media.delete_any`.»

`media.Media` (`src/api/schema.ts:16165-16173`):

```ts
{
  created_at: string;                      // ОБЯЗАТЕЛЬНОЕ (RFC3339)
  filename:   string;                      // ОБЯЗАТЕЛЬНОЕ
  id:         string;                      // ОБЯЗАТЕЛЬНОЕ
  owner_id?:  string;                      // ОПЦИОНАЛЬНОЕ (UUID автора)
  type:       "video" | "audio";           // ОБЯЗАТЕЛЬНОЕ (media.FileType)
  url?:       string;                      // ОПЦИОНАЛЬНОЕ (подписанный URL)
  visibility?: "private" | "public";       // ОПЦИОНАЛЬНОЕ (access.Visibility)
}
```

### Критический факт контракта: DELETE-ручки нет

**`DELETE /api/admin/media/{id}` НЕ существует.** Подтверждено: в блоке
`/api/admin/media` (`schema.ts:2896-2902`) `put/post/delete/patch` — все `never`.

Admin-удаление **переиспользует существующий** `deleteMedia(id)` server action
(`src/features/media/actions.ts:46-59`), который бьёт в `DELETE
/api/media/{media_id}` и уже owner-aware через
`requireCapability(me, (m) => canDeleteMedia(m, media))`, где
`canDeleteMedia = ownerOrCap(me, media.owner_id, "media.delete_any")`
(`src/features/media/permissions.ts:29-31`). Для админа с `media.delete_any`
это даёт удаление чужого медиа независимо от видимости (комментарий §6.2 там же).
Никакого нового action писать не нужно.

Это отличие от аннотаций: у тех admin-удаление идёт через ОТДЕЛЬНУЮ ручку
`DELETE /api/admin/annotations/{id}` (`adminDeleteAnnotation`). У медиа —
переиспользуем основной `deleteMedia`. Поэтому в строке списка медиа мы
**не вводим** аналог `canAdminDeleteAnnotation` для гейтинга кнопки: кнопка
видна, когда `canDeleteMedia(me, media)` (owner-or-cap), а на этой странице
актор — всегда админ с `media.delete_any`, так что для любого листингового
медиа кнопка показывается.

## Дизайн-решения и обоснование

### 1. Маршрут `src/app/admin/media/page.tsx` — зеркало `admin/annotations`

Layer-3 gate (`AGENTS.md` RBAC, §Layer-3): `getMe()` + `canModerateMedia(me)` +
`forbidden()` из `next/navigation`. Парсинг `offset` (default 0) и опционального
`owner_id` из `searchParams` через `parseNonNegativeInt` (`src/utils/paging.ts`).
Фетч через новый `getAdminMedia({offset, limit, owner_id})`. Рендер:
заголовок + total + опциональный фильтр-форма по автору + список
`MediaAdminRow` + `Pagination` (с пробросом `searchParams`, чтобы фильтр
сохранялся при пагинации) + пустое состояние.

`LIMIT = 20` — как в аннотациях. `generateMetadata` отдаёт `t("mediaMetaTitle")`
(зеркало `annotationsMetaTitle`).

### 2. `permissions.ts`: `canModerateMedia`

```ts
export function canModerateMedia(me: MaybeMe): boolean {
  return can(me, "media.delete_any");
}
```

Зеркало `canModerateAnnotations`. Гейтит и Layer-3 страницы, и nav-итем.

> Примечание: `canDeleteAnyMedia` (уже существует,
> `src/features/media/permissions.ts:20-22`) семантически идентичен
> (`can(me, "media.delete_any")`), но **не используется** (экспортируется «для
> симметрии UI-веток»). Сознательно вводим отдельный `canModerateMedia` —
> чтобы имя совпадало с конвенцией остальных модераций (`canModerateAnnotations`,
> `canModerateX`) и читалось как «доступ к admin-списку», а не «может удалить
> любое». Это разные намерения с одинаковой реализацией сегодня; разводим по
> именам ради читаемости call-site (страница/nav гейтятся `canModerateMedia`,
> а не `canDeleteAnyMedia`). `canDeleteAnyMedia` остаётся как есть (не трогаем).

### 3. `api.ts`: `getAdminMedia(filter)`

Server-only, `createApiClient`, GET `/api/admin/media`, `unwrapList`. Зеркало
`getAdminAnnotations` (`src/features/annotations/api.ts:130-166`), но проще —
у медиа единственный фильтр `owner_id` (typed `string` в схеме, кастов не нужно):

```ts
export const getAdminMedia = cache(
  async (filter: {
    owner_id?: string;
    offset?: number;
    limit?: number;
  } = {}): Promise<MyMediaResult> => {
    const api = await createApiClient();
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 20;
    const { data, error } = await api.GET("/api/admin/media", {
      params: {
        query: {
          offset,
          limit,
          ...(filter.owner_id ? { owner_id: filter.owner_id } : {}),
        },
      },
    });
    if (error) {
      throw new Error(error.error ?? (await getT("media"))("api.loadAdminFailed"));
    }
    return unwrapList(data, { offset, limit });
  },
);
```

Возвращаемый тип — существующий `MyMediaResult`
(`{ items: Media[]; total; offset; limit }`, `src/features/media/api.ts:19-24`):
переиспользуем, не плодим близнеца. Имя ошибки `api.loadAdminFailed` — новый
ключ в namespace `media` (ru+en).

### 4. `ui/media-admin-row.tsx`: async server-компонент строки

Зеркало `AnnotationAdminRow`. Показывает: владелец (`owner_id`), filename, type
(локализованный label video/audio как в `MediaCard`), visibility (бейдж
public/private как в `MediaCard`), created_at (через `getServerFmt`), и кнопку
удаления. Кнопка — **существующий** `MediaDeleteButton`
(`src/features/media/ui/media-delete-button.tsx`, props `{ id, isAdminDelete }`)
с `isAdminDelete` → даёт admin-текст подтверждения (`deleteDescriptionAdmin`) и
вызывает существующий `deleteMedia`.

Дата создания — таймстемп; форматируем через `getServerFmt()` (зона
пользователя; см. user-timezone), а не хардкодом UTC. Это server-компонент,
`getServerFmt` доступен.

Поскольку на этой странице актор всегда админ с `media.delete_any`, а листинг
не приватный, кнопка показывается для каждого `media.id` без доп. гейта строки
(в отличие от `canAdminDeleteAnnotation`, который у медиа не нужен — см.
«Критический факт контракта»). Гард `media.id &&` всё же ставим (тип `id`
обязателен, но защищаемся от пустой строки симметрично аннотациям).

### 5. `index.ts`: новые экспорты

Добавить `getAdminMedia`, `canModerateMedia`, `MediaAdminRow` (и
тип-реэкспорт не нужен — `MyMediaResult` уже экспортируется). `Media` уже
экспортируется.

### 6. Фильтр по автору (`owner_id`) — client-форма

Зеркало `AnnotationAdminFilterForm`, но не Select (у автора нет конечного
списка значений — это UUID), а текстовое поле + submit, обновляющее URL
`?owner_id=...` и сбрасывающее `offset`. Реализуем как `MediaAdminFilterForm`
(client component): `TextInput` + `Button`, on-submit пишет/чистит
`owner_id` в `searchParams` через `router.replace`. Это последняя задача плана
и помечена как «по образцу, если ложится чисто» — ложится чисто (паттерн
URL-фильтра уже есть), поэтому делаем полноценную форму, а не просто ссылку.

### 7. Nav-итем (единственное admin-shell-смежное касание)

В `buildNavItems` (`src/app/admin/admin-access.ts`) добавить рядом с
annotations-веткой:

```ts
if (can(me, "media.delete_any")) {
  items.push({ href: "/admin/media", labelKey: "nav.media" });
}
```

> ⚠️ **Флаг admin-shell.** `src/app/admin/admin-sidebar.tsx` — **замороженная
> зона** (`AGENTS.md`, «Запретные зоны»). Но `admin-access.ts::buildNavItems` —
> это намеренная capability-гейтнутая точка расширения админ-навигации (сам
> сайдбар лишь рендерит результат `buildNavItems`, резолвя `labelKey` в
> namespace `admin`). Добавление гейтнутого пункта — штатное расширение, не
> касание самого frozen-файла. Это **единственное** admin-shell-смежное
> изменение в PR; явно отмечено в плане (Task 5). `media.delete_any` — это
> RoleAdmin-capability (НЕ входит в RoleUser), поэтому инвариант теста
> «нав-cap ∩ RoleUser = ∅» (`admin-access.test.ts:80-96`) не нарушается.

Порядок вставки — после `annotations`, перед `users` (косметически рядом с
остальными контент-модерациями; точная позиция фиксируется обновлением
ассерта в `admin-access.test.ts`).

### 8. i18n (foundation-флаг)

Добавить ключи в **оба** файла `src/i18n/messages/ru/admin.ts` и
`src/i18n/messages/en/admin.ts`:

- `nav.media` (внутри блока `nav`)
- `mediaTitle`, `mediaDescription`, `mediaEmpty`, `mediaTotal`
- `mediaOwnerLabel`, `mediaFilterOwnerLabel`, `mediaFilterApply`,
  `mediaFilterClear` (для строки и фильтра)
- `mediaMetaTitle` (для `generateMetadata`)

Плюс один ключ в namespace `media` (оба языка): `api.loadAdminFailed`.

Admin-страницы используют `getT("admin")` / `useT("admin")`; namespace `media`
для строки — `getT("media")` (как `MediaCard`). Соблюдаем ключ-parity ru↔en
(`satisfies Messages` / ICU-parity тест её форсит).

> **Флаг foundation-зоны.** `src/i18n/messages/*` — общий i18n-каталог. По
> `AGENTS.md` i18n-фасад относится к запретным для feature-слайсов зонам; для
> сообщений правило мягче (ключи добавляются вместе с фичей), но раз это может
> трактоваться как foundation — отмечаем явно. Параллельные агенты часто пишут
> в `messages/*/admin.ts` — коммитить **только свои ключи**, через
> `git add <file> && git commit --only <file>`, сверяясь с `git status`
> (см. memory «Parallel commit hot-files»).

## Карта переиспользования (reuse map)

| Нужное | Источник | Сигнатура / факт |
|---|---|---|
| Паттерн страницы | `src/app/admin/annotations/page.tsx` | Layer-3 gate + offset + `Pagination` + empty |
| Форма admin-фильтра | `src/features/annotations/ui/annotation-admin-filter-form.tsx` | URL-фильтр, сброс offset, `router.replace` |
| API admin-списка | `src/features/annotations/api.ts:130-166` (`getAdminAnnotations`) | `cache` + `createApiClient.GET` + `unwrapList` |
| Удаление | `deleteMedia` (`src/features/media/actions.ts:46-59`) | `(rawId: string) => ActionResult`; owner-or-`media.delete_any` |
| Гейт удаления | `canDeleteMedia` (`src/features/media/permissions.ts:29-31`) | `ownerOrCap(me, media.owner_id, "media.delete_any")` |
| Кнопка удаления | `src/features/media/ui/media-delete-button.tsx` | props `{ id: string; isAdminDelete?: boolean }` |
| Бейджи type/visibility | `src/features/media/ui/media-card.tsx` | `typeLabel[type]`, `t("statusPublic"/"statusPrivate")` |
| Результат списка | `MyMediaResult` (`src/features/media/api.ts:19-24`) | `{ items: Media[]; total; offset; limit }` |
| Пагинация | `src/components/ui/pagination.tsx` | props `basePath, offset, limit, total, searchParams, labels` |
| Labels пагинации | `src/components/ui/pagination.server.ts` | `getPaginationLabels(): Promise<PaginationLabels>` |
| Парсинг paging | `src/utils/paging.ts` | `parseNonNegativeInt(value, fallback)` |
| Unwrap envelope | `src/utils/api-unwrap.ts` | `unwrapList(data, { offset, limit })` |
| `can` / `forbidden`-gate | `src/utils/permissions.ts`, `next/navigation` | `can(me, cap)`, `forbidden()` |
| Формат даты | `getServerFmt` (`@/i18n`) | `.dateTime(value, opts)`; зона пользователя |
| Текущий юзер | `src/utils/me.ts` | `getMe(): Promise<MaybeMe>` |

## FE/BE-разделение и backend-asks

(`AGENTS.md` §«Дефекты бэкенда — флаговать корень». Эти аски — для пользователя,
чтобы он передал бэку. Фронт реализуется со стопгапом, корень чинит бэк.)

### Ask 1 (значимый): нет человекочитаемого автора в листинге

`media.Media` отдаёт владельца **только как `owner_id` (UUID)**
(`schema.ts:16169`). Для модерации показывать сырой UUID — плохой UX: админ не
видит, чьё это медиа, и не может осмысленно фильтровать «по автору» (нужно
заранее знать UUID). Аналогичная боль есть и в `AnnotationAdminRow`
(`owner_id` сырой), но для модерации медиа это особенно мешает.

**Что FE ждёт от бэка (одно из):**
- добавить в `media.Media` (или хотя бы в ответ `/api/admin/media`) поле
  `owner_username` / `owner_handle` — короткий человекочитаемый идентификатор
  автора; **или**
- предоставить resolve-путь (batch-ручку `id → username`), которую FE дёрнет
  для отрисованных строк.

**Стопгап FE:** рендерим `owner_id` как есть (truncate/`title`), фильтр
`owner_id` принимает UUID-строку. Когда бэк добавит имя — заменим отображение и
расширим фильтр на поиск по username.

### Ask 2 (проверочный): полнота полей строки

Подтвердить, что для строки модерации `/api/admin/media` стабильно отдаёт
`visibility`, `created_at`, `filename`, `type`, `owner_id`. По схеме:
`created_at`/`filename`/`type`/`id` — **required**; `owner_id`/`visibility` —
**optional**. Для admin-списка `owner_id` и `visibility` фактически всегда
осмысленны (листинг — про чужих авторов и непривválное), но в типе они
опциональны.

**Что FE ждёт:** либо подтверждение, что в этом ответе `owner_id` и
`visibility` всегда присутствуют (тогда можно ужесточить ожидания), либо
оставить как опциональные.

**Стопгап FE:** строка graceful к отсутствию — `owner_id` пустой → дефис/прочерк,
`visibility` пустой → бейдж не рисуем (или «—»). Тип `Media` не сужаем (frozen
schema).

### Ask 3 (минорный, проверочный): сортировка/дефолт лимита

Контракт не описывает порядок сортировки и максимум `limit`. У `/api/me/media`
бэк-дефолт `limit=20`, max 100 (`src/features/media/api.ts:13`). Предполагаем
тот же для admin-ручки. Подтвердить max-limit и порядок (ожидаем
created_at desc — свежие сверху).

## Вне объёма (YAGNI)

- Не вводим admin-смену видимости медиа (бэк: видимость меняет только владелец,
  `canChangeMediaVisibility` admin-override не даёт — `permissions.ts:39-43`).
- Не вводим bulk-удаление / выбор нескольких — строки удаляются по одной
  (как аннотации).
- Не показываем приватные медиа (бэк их не листит — by design).
- Не делаем preview/проигрывание медиа в строке модерации — только метаданные
  и удаление (можно добавить ссылку на `/media/{id}` позже).
- Не трогаем `canDeleteAnyMedia` (остаётся неиспользуемым, не наша зона).

## Стратегия тестирования

- `permissions.test.ts` (дополнить существующий): `canModerateMedia` — гость
  false, admin с `media.delete_any` true, suspended admin false, user без cap
  false. Зеркало блока `canModerateAnnotations`/`canDeleteAnyMedia`.
- `api.test.ts` (дополнить существующий): `getAdminMedia` — пробрасывает
  `owner_id` в query когда задан и не пробрасывает когда пустой; pagination
  defaults через `unwrapList`; throw при error-ответе. Мок `createApiClient`
  (паттерн уже в файле: `getMock`, `apiResult`).
- `media-admin-row.test.tsx` (новый): рендерит `owner_id`, `filename`,
  локализованный тип, бейдж visibility; рендерит `MediaDeleteButton`. Async
  server-компонент → паттерн `render(await MediaAdminRow({ media }))` (как
  тестируются прочие async server-rows; если в репо нет — рендерим через
  `await` результат).
- `admin-access.test.ts` (обновить ассерт): добавить `/admin/media` в
  ожидаемый список hrefs админа в правильной позиции; инвариант
  «нав-cap ∩ RoleUser = ∅» остаётся зелёным (т.к. `media.delete_any` ∉ RoleUser).
- Страничный тест для `page.tsx` не пишем (в репо нет page-тестов admin-страниц,
  `admin-access.test.ts` — единственный; покрытие — через unit api/permissions/row
  и e2e-смоук вне объёма). Верификация страницы — через `pnpm build` (тип-чек
  Layer-3 + пропсы) и существующие интеграционные пути.
- i18n: ключ-parity ru↔en форсится `satisfies Messages` на этапе `pnpm build`;
  отдельный тест не нужен.
- Финал: зелёные `pnpm lint && pnpm test && pnpm build`.

## Файлы

**Новые:**
- `src/features/media/ui/media-admin-row.tsx` (+ `media-admin-row.test.tsx`)
- `src/features/media/ui/media-admin-filter-form.tsx`
- `src/app/admin/media/page.tsx`

**Изменяемые:**
- `src/features/media/permissions.ts` (+ `permissions.test.ts`)
- `src/features/media/api.ts` (+ `api.test.ts`)
- `src/features/media/index.ts`
- `src/app/admin/admin-access.ts` (+ `admin-access.test.ts`) — **admin-shell-смежное**
- `src/i18n/messages/ru/admin.ts`, `src/i18n/messages/en/admin.ts` — **foundation i18n**
- `src/i18n/messages/ru/media.ts`, `src/i18n/messages/en/media.ts` — ключ `api.loadAdminFailed`

> `src/i18n/messages/*` и касание `admin-access.ts` — координируемые зоны.
> Этот PR держит их минимальными и явно флагует (Task 5).
