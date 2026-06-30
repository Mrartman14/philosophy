# Формы как тип вложения лекции — дизайн

**Дата:** 2026-06-30
**Статус:** утверждён, готов к плану реализации
**Слайсы:** `src/features/lectures`, страницы лекции (public + admin edit), i18n

## Контекст

Бэкенд расширил attachment-систему: к лекции теперь можно прикреплять **формы**
наряду с `document | media | canvas`. Схема API перегенерирована
(`src/api/schema.ts`). На фронте уже полноценно поддержаны три прежних типа —
задача в том, чтобы добавить `form` четвёртым, зеркаля существующий
canvas-паттерн (read-only список со ссылками), и дать владельцу управлять
прикреплением форм на странице редактирования лекции.

### Что пришло с регеном (контракт)

- `attachment.EntityType` и `composition.Kind` теперь включают `"form"`.
- Attach/detach/reorder-ручки (`POST/DELETE/PATCH /api/lectures/{lectureID}/attachments…`)
  принимают `entityType=form`.
- **Новый** `GET /api/lectures/{id}/forms` → `httputil.ListResponse & { data: form.Form[] }`,
  где `form.Form.is_entry` помечает основную форму лекции (populated только этим
  листингом, как у канвасов).
- `GET /api/forms/{id}/attachments` (обратная связь: к каким контейнерам
  прикреплена форма) — **вне объёма** v1.
- `form.Form` и `form.FormListItem` имеют `id?`, `title?`, `owner?`; `form.Form`
  дополнительно `is_entry?`.

### Форсит-функция: сборка уже красная

В `src/features/lectures/schemas.ts:89` есть drift-гард:

```ts
const ENTITY_TYPE_SET = {
  document: true,
  media: true,
  canvas: true,
} as const satisfies Record<AttachmentEntityType, true>;
```

Поскольку `AttachmentEntityType` (производный от схемы) теперь включает `"form"`,
`satisfies Record<AttachmentEntityType, true>` **не компилируется** до добавления
`form: true`. `pnpm typecheck`/`pnpm build` сейчас падают именно здесь — это
ожидаемый сигнал, что фронт отстал от контракта.

## Цель и не-цели

**Цель:** форма становится полноправным четвёртым типом вложения лекции:
- владелец прикрепляет/откручивает/переупорядочивает формы на странице
  редактирования лекции (как документы/медиа);
- читатель видит секцию «Формы лекции» на публичной странице — список
  заголовков-ссылок на `/forms/{id}` с бейджем основной формы.

**Не-цели (сознательно вне объёма, с обоснованием):**

- **Inline-заполнение формы на странице лекции.** Отвергнуто продуктовым
  выбором: показываем список со ссылками (как канвасы). Заполнение/отправка —
  на выделенной странице формы `/forms/[id]`, которая уже несёт весь flow
  (FormFill, submit, idempotency, after-submit, results, share).
- **Нотификации.** `notification.TargetType = document | lecture | canvas` —
  значения `form` нет, добавлять роут-кейс некуда.
- **Офлайн-снимок лекции.** Формы интерактивны (submit требует сети), офлайн
  ссылка на форму бесполезна; не добавляем `getLectureForms` в
  `lecture-descriptor`.
- **Canvas entity-ref пикер `form`.** «Форма как узел канваса» — отдельная фича;
  `SEGMENTS/LABELS/ENTITY_TYPES/i18n` для form там уже есть, attachment её не
  касается.
- **`GET /api/forms/{id}/attachments`.** Обратный список не нужен для этой задачи.
- **Прикрепление форм при создании лекции (Вариант A).** Аналог
  `attach_document_ids` оставляем только документам; формы прикрепляются на
  странице редактирования. YAGNI.

## Архитектура

Зеркалим существующий **canvas-паттерн**: лёгкий read-only листинг + ссылки.
Видимость форм (черновик/приватность/share-token) — ответственность **бэка**:
эндпоинт отдаёт то, что viewer вправе видеть; FE рендерит как есть и линкует на
`/forms/{id}`, который сам гейтит. FE не фильтрует по `published_at`/visibility.

### Поток данных

```
Public:  /lectures/[id]/page.tsx
           getLectureForms(id, token)  ──GET /api/lectures/{id}/forms──▶ form.Form[]
           └─▶ <LectureFormList forms token heading entryBadge untitledLabel/>
                 └─ <RouterLink href=/forms/{id}[?token]> + is_entry badge

Admin:   /admin/lectures/[id]/edit/page.tsx   (owner-only, canManage)
           getLectureForms(id) ─▶ ManagedAttachment[] (entityType:"form")
           formFetcher(q,offset,limit) ─▶ searchFormsForAttach
           └─▶ <LectureAttachmentsManager pickerEntityType="form" …/>
                 onAttach/onDetach/onReorder ─▶ attachToLecture/detach/reorder
                   (entity_type:"form")
```

## Изменения по компонентам

### Слайс `lectures` (фича)

**`types.ts`** — добавить:
```ts
/** Форма, прикреплённая к лекции (GET /api/lectures/{id}/forms). Лёгкий листинг;
 *  is_entry помечает основную форму лекции и выставляется только этим листингом. */
export type LectureFormItem = components["schemas"]["form.Form"];
```

**`schemas.ts`** — `form: true` в `ENTITY_TYPE_SET` (чинит сборку; drift-гард
снова зелёный). `makeLectureAttachSchema/Detach/Reorder` начинают принимать
`entity_type:"form"` автоматически (через общий `ENTITY_TYPE`).

**`api.ts`** — `getLectureForms` по образцу `getLectureCanvases`:
```ts
export const getLectureForms = cache(
  async (id: string, token?: string): Promise<LectureFormItem[]> => {
    const api = await createApiClient();
    const { data, error, response } = await api.GET("/api/lectures/{id}/forms", {
      params: { path: { id }, ...(token ? { query: { token } } : {}) },
    });
    if (response.status === 404) return [];
    if (error) throw new Error(error.error ?? (await getT("lectures"))("api.loadFormsFailed"));
    return unwrap(data) ?? [];
  },
);
```

**`actions.ts`** — `searchFormsForAttach` (стопгап под отсутствие `q` на бэке):
```ts
export const searchFormsForAttach = createAction(
  async (raw: { q: string; offset: number; limit: number }) => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/me/forms");
    if (error) rethrowApiError(error, ERRORS);
    const all = (data.data ?? [])
      .filter((f): f is typeof f & { id: string } => Boolean(f.id))
      .map((f) => ({ id: f.id, label: f.title ?? f.id }));
    const q = raw.q.trim().toLowerCase();
    const filtered = q
      ? all.filter((f) => f.label.toLowerCase().includes(q))
      : all;
    const page = filtered.slice(raw.offset, raw.offset + raw.limit);
    return { data: page, total: filtered.length };
  },
  "searchFormsForAttach",
);
```
Источник — `/api/me/forms` (формы владельца): attach owner-only, прикрепляют свои
формы. У эндпоинта есть `offset`/`limit`, но нет серверного `q` → q-фильтр обязан
быть клиентским, поэтому фильтр по `title` и срез `offset/limit`
делаем в action. См. «Флаг бэку».

**`ui/lecture-form-list.tsx`** — новый компонент, близнец `LectureCanvasList`:
```tsx
interface Props {
  forms: LectureFormItem[];
  token?: string | undefined;
  heading: string;
  entryBadge: string;
  untitledLabel: string;
}
```
Рендер: `<section aria-label={heading}>` + `<h2>` + `<ul>` ссылок на
`/forms/{id}` (token-passthrough через `?token=`), бейдж при `is_entry`, фолбэк
`untitledLabel` при пустом `title.trim()`. Пустой список → `return null`.
Порядок — детерминированный **entry-first**: чистая функция-хелпер
`orderLectureForms(forms)` (близнец `orderLectureCanvases`) ставит `is_entry`
вперёд, сохраняя относительный порядок бэка для остальных (стабильная
сортировка). Хелпер — отдельный модуль `order-forms.ts` с юнит-тестом.

**`ui/lecture-attachments-manager.tsx`** — расширить:
- `pickerEntityType: "document" | "media" | "form"`;
- href-ветка в маппинге `items`: `a.entityType === "form" → { href: `/forms/${a.entityId}` }`;
- плейсхолдер пикера: заменить тернарник на маленькую карту
  `document→searchDocumentPlaceholder`, `media→searchMediaPlaceholder`,
  `form→searchFormPlaceholder`.

**`index.ts`** — экспортировать `getLectureForms`, `searchFormsForAttach`,
`LectureFormList`, тип `LectureFormItem`.

### Страницы

**`app/lectures/[id]/page.tsx`** (public):
- добрать `getLectureForms(id, token)` в `Promise.all`;
- после `<LectureCanvasList>` отрендерить
  ```tsx
  <LectureFormList
    forms={forms}
    token={token}
    heading={t("lectureFormsHeading")}
    entryBadge={t("lectureFormEntryBadge")}
    untitledLabel={t("lectureFormUntitled")}
  />
  ```

**`app/admin/lectures/[id]/edit/page.tsx`** (owner-only):
- добрать `getLectureForms(id)` в `Promise.all` под `canManage` (как docs/media);
- `formItems: ManagedAttachment[]` (entityType:"form", label = title ?? id ?? fallback);
- `formFetcher` (server-action-обёртка над `searchFormsForAttach`, как docFetcher);
- третий `<LectureAttachmentsManager pickerEntityType="form" targetFetcher={formFetcher}
  title={t("attachmentsFormsSectionTitle")}>` после медиа.

### i18n (ru/en/ar/zh; псевдо `en-XA` генерируется)

- `pages`: `lectureFormsHeading` («Формы лекции»), `lectureFormEntryBadge`
  («Основная» — женский род, отдельно от canvas «Основной»),
  `lectureFormUntitled` («Без названия»).
- `lectures`: `searchFormPlaceholder` («Поиск формы…»),
  `api.loadFormsFailed` («Не удалось загрузить формы лекции»).
- `admin`: `attachmentsFormsSectionTitle` («Формы лекции»).

`detachForbidden/reorderForbidden/attachForbidden`, `attachmentsEmpty` —
переиспользуем существующие (доменно-нейтральны).

## Флаг бэку

`/api/me/forms` имеет `offset`/`limit`, но НЕ имеет серверного `q`, тогда как
attach-пикеры документов и медиа опираются на `GET /api/documents` и
`GET /api/media` с `q`/`offset`/`limit`. Это асимметрия контракта: для
единообразия желателен `GET /api/forms` (picker, requiredAuth) с
`q`/`offset`/`limit`, либо добавить `q` на `/api/me/forms`. Пока
корень не выровнен — FE-стопгап (фильтр+срез в `searchFormsForAttach`); когда
бэк добавит серверный поиск, стопгап убрать. Источник `/api/me/forms` отдаёт все
формы владельца разом (ограниченный набор), так что in-memory фильтр приемлем.

## RBAC

Без изменений в модели. Attach/detach/reorder — owner-only (existing
`canAttachToLecture`/`canManageAttachments`), форма как тип сущности проходит
через те же гейты. Публичная секция форм — read-only, видимость на бэке.

## Тестирование (TDD)

- `schemas.test.ts` — attach/detach/reorder Zod-схемы принимают `entity_type:"form"`,
  и drift-гард `ENTITY_TYPE_SET` покрывает все 4 ключа.
- `api`/`actions` — `getLectureForms` (happy + 404→[]); `searchFormsForAttach`
  (q-фильтр по title, срез offset/limit, total = размер отфильтрованного,
  пропуск форм без id).
- `lecture-form-list.test.tsx` — ссылки на `/forms/{id}`, бейдж при `is_entry`,
  фолбэк `untitledLabel` для пустого title, пустой список → ничего не рендерит,
  token-passthrough в href, is_entry-first порядок (если сортируем).
- `lecture-attachments-manager` — form-href в items, form-плейсхолдер пикера.

Перед PR зелёные: `pnpm lint && pnpm test && pnpm build`.

## Открытые приёмки (ручные)

- Браузер-QA: секция «Формы лекции» на публичной странице, ссылки, бейдж
  основной формы; attach/detach/reorder форм на странице редактирования.
- ar/zh вычитка новых строк носителем (как для прочих i18n-добавлений).
