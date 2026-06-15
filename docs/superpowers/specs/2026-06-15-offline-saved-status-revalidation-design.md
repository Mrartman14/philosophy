# Дизайн: фоновая ревалидация статуса сохранённой лекции (офлайн SWR)

**Дата:** 2026-06-15
**Источник требования:** `philosophy-api/docs/frontend/offline-saved-status.md`
**Контекст:** офлайн-чтение лекций замкнуто end-to-end (см. [2026-06-14-offline-mode-design.md](2026-06-14-offline-mode-design.md)). Сохранённая лекция показывается из локального снимка (`SavedBundleRecord` в IndexedDB). Снимок гарантирует **доступность**, но не **свежесть**: автор мог лекцию обновить или удалить, и читатель об этом не узнает. Нужна фоновая сверка с бэкендом — по паттерну stale-while-revalidate.

## Цели

- При открытии сохранённой лекции **показывать копию немедленно** (офлайн или онлайн), без ожидания сети.
- Если онлайн — **в фоне** сверить статус лекции на платформе; показ при этом не блокировать.
- Изменилась → пометить «доступна обновлённая версия» (без авто-перекачки).
- Удалена/недоступна на платформе → пометить, но **копию НЕ стирать**.
- Best-effort: вечно-офлайн читатель копию и пометки не увидит — это ожидаемо, не баг.

## Не-цели (вне объёма)

- **Условный GET с `If-None-Match`/304.** ETag для `GET /api/lectures/{id}` на бэке ещё не выкачен (подтверждено по `src/api/schema.ts`: эндпоинт не принимает `If-None-Match`, не отдаёт 304). Реализуем **ленивый вариант** из спеки: обычный GET + сравнение `updated_at`. Полный условный GET — отдельной итерацией вместе с optimistic-locking.
- **Реакция на бан (гранулярная очистка / сохранение публичной библиотеки).** Спека-источник содержит секцию «Реакция на бан», но её посылка («токен и библиотека лежат оба в browser storage») **не относится к нашему фронту**: токен живёт в httpOnly-cookie `token`, а библиотека — в IndexedDB/Cache Storage; они разделимы. Текущее «стираем всё при бане» (`Clear-Site-Data: "cookies", "storage"` + `wipeOfflineData`) безопасно, просто сверх-консервативно — корректностного бага нет. Гранулярная очистка требует новой метадаты public/private на каждый bundle (которой нет) и ослабляет defense-in-depth на общих устройствах. Ведётся отдельной спекой ([2026-06-15-banned-user-forced-logout-design.md](2026-06-15-banned-user-forced-logout-design.md)).
- **Авто-перекачка снимка при изменении.** На `present && changed` показываем плашку, перекачку инициирует читатель кнопкой «Обновить» (продуктовое решение: не тянуть все картинки без спроса на лимитной сети).
- **Обобщение на другие сущности.** Сейчас офлайн-сохраняются только лекции; ревалидация — лекция-специфична. Обобщение через дескрипторы — при появлении второй сохраняемой сущности (YAGNI).
- **Детект изменений вложенного контента.** Probe сверяет только `lecture.updated_at`. Если автор изменил документы/теги/комментарии, не сдвинув `updated_at` самой лекции, фоновая сверка этого не заметит («ложный fresh»). Это осознанная плата за лёгкий probe; полное покрытие — вместе с ETag/version бэка.

## Контракт (stale-while-revalidate, ленивый вариант)

1. Открыли сохранённую лекцию → рендерим локальный снимок немедленно (показ не зависит от сети).
2. Если `navigator.onLine` → в фоне лёгкий GET лекции:

   | Результат GET | Значение | Действие |
   |---|---|---|
   | лекция, `updated_at` совпадает | не изменилась | снять пометку (свежо) |
   | лекция, `updated_at` отличается | изменилась | пометить `"stale"` |
   | `404` (`getLectureById` → `null`) | удалена/недоступна | пометить `"gone"`, копию НЕ стирать |
   | бросок (сеть/5xx/forbidden) | сверить не удалось | ничего (best-effort) |

3. Если офлайн → просто показали копию; сверим при следующем онлайн-открытии.

Ревалидация **всегда фоновая** и **никогда не предусловие показа**.

## Модель данных

В `SavedBundleRecord` (`src/services/offline/contract/storage.ts`) добавляется опциональное поле:

```ts
/** Результат последней фоновой сверки с платформой. Отсутствует = свежо или ещё не сверяли. */
remoteStatus?: "stale" | "gone";
```

- Обратносовместимо: старые записи без поля трактуются как свежие.
- **Бамп `OFFLINE_SCHEMA_VERSION` не нужен** — форма снимка (`snapshot`) не меняется, меняется только служебная метадата записи; добавление опционального поля не ломает чтение старых записей.
- `SavedBundlePatch` автоматически включает новое поле (`Partial<Omit<SavedBundleRecord, …>>`).
- Поле служебное (слой персистентности), к `snapshot` отношения не имеет.

## Компоненты

### 1. Probe — server action (новый файл `src/app/_offline/probe-lecture-action.ts`)

Лёгкая сверка: тянет **только лекцию**, без tags/documents/всех комментов/картинок (в отличие от тяжёлого `assembleOfflineBundle`).

```ts
"use server";
import "server-only";
// createAction(...) поверх getLectureById(id) из @/features/lectures
// (app/_offline — композиционный корень, импорт из features разрешён)

type LectureProbe =
  | { status: "present"; updatedAt: string }
  | { status: "gone" };

// getLectureById → null (404)  ⇒ { status: "gone" }
// getLectureById → lecture     ⇒ { status: "present", updatedAt: lecture.updated_at }
// бросок (сеть/5xx)            ⇒ createAction вернёт { success: false } ⇒ caller трактует как «пропустить»
```

> `updated_at` — required `string` в схеме, поэтому `updatedAt: string` (без `?? null`). Строгий eslint (`no-unnecessary-condition`) запрещает мёртвую защиту от `null`; если бэк сделает поле опциональным — реген + гейт заставят обновить здесь.

- Переиспользуем `getLectureById` (единый источник истины: токен из httpOnly-cookie, share-token, error-семантика). `getLectureById` схлопывает 404 → `null`.
- 410 бэк не отдаёт (только 404 по схеме); если появится — бросок → «пропустить». Добавить маппинг 410→gone тривиально позже.
- RBAC/доступ — внутри `getLectureById` (optional-auth GET). Потеря доступа к приватной лекции у бэка проявляется как 404 → `"gone"` (нейтральная формулировка плашки это покрывает).

### 2. Оркестратор — клиентский (новый файл `src/app/_offline/revalidate-saved-lecture.ts`)

```ts
"use client";
type RevalidateOutcome = "fresh" | "stale" | "gone" | "skip";

async function revalidateSavedLecture(id: string): Promise<RevalidateOutcome>;
```

Логика:
1. Читает текущий bundle (`getSavedBundle("lectures", id)`); нет / не `complete` / не валидный снимок → `"skip"` (нечего сверять).
2. Зовёт probe-action.
   - `{ success: false }` → `"skip"` (сеть/ошибка — best-effort, ничего не трогаем).
   - `status: "gone"` → `updateSavedBundle("lectures", id, { remoteStatus: "gone" })` → `"gone"`.
   - `status: "present"`:
     - `updatedAt !== snapshot.lecture.updated_at` → `updateSavedBundle(…, { remoteStatus: "stale" })` → `"stale"`.
     - иначе → снять пометку (если была) → `"fresh"`.
3. Никогда не бросает (best-effort): внутренние ошибки → `"skip"`.

### 3. UI — `src/app/saved/saved-lecture-view.tsx`

- `LoadState.ready` расширяется полем `remoteStatus?: "stale" | "gone"` (читается в `loadState`).
- В существующем эффекте загрузки, **после** `setState(ready)` (снимок уже отрисован): если `navigator.onLine` — `void revalidateSavedLecture(id)`; при исходе `"stale" | "gone"` — перечитать `loadState(id)` и `setState`, чтобы показать плашку. Ревалидация запускается **один раз на `id`** (внутри того же эффекта, после показа снимка) и не блокирует первый рендер.
- Плашки (неразрушающие, над `<article>`):
  - `gone` → «Эта лекция удалена с платформы. У вас осталась сохранённая копия.» Снимок рендерится как обычно. Кнопку «Обновить» **скрываем** (обновлять нечего; ручной `saveOffline` всё равно вернул бы ошибку «недоступна»).
  - `stale` → «Доступна обновлённая версия.» рядом с существующей кнопкой «Обновить».
- Кнопка «Обновить» (ручная, уже есть) при успехе перезаписывает запись через `putSavedBundle` (полный снимок без `remoteStatus`) → **пометка снимается автоматически**.

## Поток данных

```text
открытие /saved/[id]
  → whenIdentityReconciled()           (как сейчас, защита от чужого снимка)
  → loadState(id) → setState(ready)    ← СНИМОК ПОКАЗАН (не зависит от сети)
  → if navigator.onLine:
       revalidateSavedLecture(id)
         → probe-action → getLectureById(id)   (лёгкий GET)
         → updateSavedBundle({ remoteStatus })  (только пометка, снимок цел)
       → если stale|gone: loadState(id) → setState  ← ПЛАШКА ПОКАЗАНА
```

## Обработка ошибок

- Сеть недоступна / 5xx / forbidden при probe → `"skip"`, пометок нет, копия показана. Сверка повторится при следующем онлайн-открытии.
- `navigator.onLine === false` → ревалидация не запускается вовсе.
- `updateSavedBundle` на отсутствующей записи (гонка с удалением/wipe) → best-effort, ошибку глотаем, исход `"skip"`.
- Размонтирование компонента во время ревалидации → guard `cancelled` (как в текущем эффекте) предотвращает `setState` после unmount.

## Тестирование (TDD)

- **`revalidate-saved-lecture.test.ts`** (новый): моки probe-action + fake-indexeddb. Кейсы: `gone` (404 → пометка `"gone"`, снимок цел), `stale` (изменён `updated_at` → `"stale"`), `fresh` (совпал `updated_at` → пометка снята), `skip` (`success:false` → запись не тронута), отсутствующий/incomplete bundle → `"skip"`.
- **`probe-lecture-action.test.ts`** (новый): мок `getLectureById` → `null`/lecture/throw → `gone`/`present`/`{success:false}`.
- **`saved-lecture-view.test.tsx`** (обновить): снимок показывается до завершения ревалидации (не блокируется); плашка `gone` (кнопка «Обновить» скрыта, снимок виден); плашка `stale` (кнопка видна); офлайн (`navigator.onLine=false`) — ревалидация не зовётся; ручной «Обновить» снимает пометку.

Паттерн как в существующих тестах: `globalThis.indexedDB = new IDBFactory()` в `beforeEach`, `vi.hoisted` + `vi.mock`, seed bundle в IDB → render → assert.

## Затрагиваемые файлы

| Файл | Изменение |
|---|---|
| `src/services/offline/contract/storage.ts` | +поле `remoteStatus?` в `SavedBundleRecord` |
| `src/app/_offline/probe-lecture-action.ts` | новый — server action probe |
| `src/app/_offline/revalidate-saved-lecture.ts` | новый — клиентский оркестратор |
| `src/app/saved/saved-lecture-view.tsx` | ревалидация в эффекте + плашки stale/gone |
| `src/app/_offline/revalidate-saved-lecture.test.ts` | новый |
| `src/app/_offline/probe-lecture-action.test.ts` | новый |
| `src/app/saved/saved-lecture-view.test.tsx` | обновить |

**Характер изменения:** offline-foundation (не feature-слайс). Затрагивает `src/services/offline/contract/storage.ts` — координированно, в рамках офлайн-инициативы (добавление опционального служебного поля, обратносовместимо).

## Критерии готовности

- `pnpm lint && pnpm test && pnpm build` — зелёные.
- Открытие сохранённой лекции онлайн: снимок виден мгновенно; при изменении на платформе появляется плашка «доступна обновлённая версия»; при удалении — плашка «удалена», копия на месте.
- Офлайн: снимок виден, сетевых запросов и плашек нет.
- Ручной «Обновить» свежим снимком снимает пометку.
