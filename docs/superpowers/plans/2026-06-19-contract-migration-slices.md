# Контракт-миграция — Plan B (Слайсы) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Привести слайсы к новому контракту: optimistic locking (If-Match) на lectures и trails, перевод trails на документы, плюс новые возможности — подписка на лекции и «выйти со всех устройств». По завершении `pnpm lint && pnpm test && pnpm build` — зелёные.

**Architecture:** Опирается на Plan A (foundation). Optlock расширяет существующий хелпер `ifMatchHeader` (`src/utils/optimistic-lock.ts`) — паттерн уже работает в 7 слайсах. Trails переходит на `document_id`/`document_ids` с переиспользованием готового `DocumentPicker`. Подписка на лекции зеркалит подписку на документы. logout-all UI зеркалит `LogoutForm`.

**Tech Stack:** Next.js 16.1.4, TypeScript strict (`exactOptionalPropertyTypes`), openapi-fetch, Zod, Base UI Form, vitest, pnpm.

## Global Constraints

- Менеджер пакетов — **pnpm** (никогда npm).
- **Верификация КАЖДОЙ задачи (обязательно все три):** `pnpm typecheck`, `pnpm lint` (на затронутых файлах нет новых ошибок), `pnpm test <затронутые>` — зелёные. Vitest (esbuild) НЕ проверяет типы и не линтит — поэтому typecheck и lint прогонять отдельно.
- На старте Plan B `pnpm typecheck` имеет ровно 5 известных ошибок (trails ×4, lectures ×1) и `pnpm lint` — 1 (trails page.tsx:38). Каждая задача СНИЖАЕТ это число и НЕ добавляет новых. Финальный гейт (B5): 0 ошибок.
- Git: НЕ `git stash/reset/checkout .//clean`; НЕ `git add -A`/`git add .` — только свои файлы по имени. Не трогать `src/api/schema.ts` и чужие незакоммиченные изменения. Не пушить.
- Комментарии по-русски; имена файлов kebab-case. RBAC: в actions — `requireCapability`/`requireActive`, в UI — `canX()`/boolean-пропы.
- optlock-паттерн (канон): версия сущности (`entity.version`) → hidden `<input name="version" value={String(entity.version ?? "")}>` → action: `header: ifMatchHeader(formData, "<сущность в род.п.>")`. `ifMatchHeader` сам бросает 428-guard при отсутствии версии. Версию НЕ кладут в Zod-схему — её читает `ifMatchHeader` напрямую из FormData.
- Каждая задача завершается зелёными тестами своих файлов + отдельным коммитом.

---

## Файловая структура

- Modify: `src/features/lectures/actions.ts` (updateLecture +If-Match), `src/features/lectures/ui/lecture-edit-form.tsx` (hidden version). Test: `src/features/lectures/update-lecture-optlock.test.ts` (создать).
- Modify: `src/features/trails/{actions.ts, schemas.ts, types.ts, api.ts}`, `src/features/trails/ui/trail-items-editor.tsx`, `src/features/trails/ui/trail-meta-form.tsx`, `src/app/trails/[id]/page.tsx`, `src/features/trails/schemas.test.ts`. Test: `src/features/trails/set-items-optlock.test.ts` (создать).
- Create: `src/features/notifications/ui/lecture-subscribe-button.tsx`. Modify: `src/features/notifications/{actions.ts, api.ts, index.ts}`, `src/app/lectures/[id]/page.tsx`. Test: расширить `src/features/notifications/*` тесты.
- Create: `src/features/auth/ui/logout-all-form.tsx`. Modify: `src/features/auth/index.ts`, `src/app/me/settings/page.tsx`.

---

### Task 1: Lectures — optimistic locking (If-Match)

**Files:**
- Modify: `src/features/lectures/actions.ts` (`updateLecture`)
- Modify: `src/features/lectures/ui/lecture-edit-form.tsx`
- Test: `src/features/lectures/update-lecture-optlock.test.ts` (создать)

**Interfaces:**
- Consumes: `ifMatchHeader(formData, entity)` из `@/utils/optimistic-lock` → `{ "If-Match": '"<version>"' }`, бросает при отсутствии версии.
- Produces: `updateLecture` шлёт `If-Match`; форма редактирования несёт `version`.

- [ ] **Step 1: Написать падающий optlock-тест**

Создать `src/features/lectures/update-lecture-optlock.test.ts`, по образцу `src/features/comments/update-comment-blocks-optlock.test.ts` (прочитай его — там канон моков). Адаптация: мокать `@/api/client` (PUT), `@/utils/me` (getMe → active user), `./permissions` (`canUpdateLecture` → true), `@/utils/revalidate`, и гейт-загрузку лекции, которую зовёт `updateLecture` (`loadLectureForGate` — замокать, чтобы вернула объект лекции). Ключевые проверки:

```typescript
it("шлёт If-Match (версия в кавычках)", async () => {
  await updateLecture(initial, lectureForm({ version: "7" }));
  expect(put).toHaveBeenCalledWith(
    "/api/lectures/{id}",
    expect.objectContaining({ params: { path: { id: ID }, header: { "If-Match": '"7"' } } }),
  );
});
it("не шлёт PUT без версии (428-guard)", async () => {
  await updateLecture(initial, lectureForm({})); // без version
  expect(put).not.toHaveBeenCalled();
});
```
где `lectureForm` кладёт обязательные поля схемы (`id`, `title`, `description`, `date`) + опционально `version`.

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test src/features/lectures/update-lecture-optlock.test.ts`
Expected: FAIL (PUT вызывается без `header`, либо при отсутствии version PUT всё равно уходит).

- [ ] **Step 3: Добавить If-Match в updateLecture**

В `src/features/lectures/actions.ts`:
- добавить импорт: `import { ifMatchHeader } from "@/utils/optimistic-lock";`
- в вызове `api.PUT("/api/lectures/{id}", { params: {...} })` заменить `params` на:

```typescript
    params: {
      path: { id: input.id },
      header: ifMatchHeader(formData, "лекции"),
    },
```
(остальное — body, idempotencyHeaders — без изменений).

- [ ] **Step 4: Добавить hidden version в форму**

В `src/features/lectures/ui/lecture-edit-form.tsx` сразу после `<input type="hidden" name="id" value={lecture.id} />` добавить:

```tsx
        <input type="hidden" name="version" value={String(lecture.version ?? "")} />
```

- [ ] **Step 5: Запустить тест — зелёный**

Run: `pnpm test src/features/lectures/update-lecture-optlock.test.ts`
Expected: PASS.

- [ ] **Step 6: Верификация типов/линта**

Run: `pnpm typecheck` — ошибка `lectures/actions.ts(88)` про missing `header` ИСЧЕЗЛА (остаток ≤4, все trails).
Run: `pnpm exec eslint src/features/lectures/actions.ts src/features/lectures/ui/lecture-edit-form.tsx src/features/lectures/update-lecture-optlock.test.ts` — чисто.

- [ ] **Step 7: Коммит**

```bash
git add src/features/lectures/actions.ts src/features/lectures/ui/lecture-edit-form.tsx src/features/lectures/update-lecture-optlock.test.ts
git commit -m "feat(lectures): optimistic locking (If-Match) на обновлении лекции"
```

---

### Task 2: Trails — переход на документы + optimistic locking

Объединённая задача: оба PUT trails (`updateTrailMeta`, `setTrailItems`) правятся в одном `actions.ts`, и переход на документы затрагивает связанные файлы. Делается целиком, чтобы trails-слайс остался когерентным и зелёным.

**Files:**
- Modify: `src/features/trails/actions.ts`, `src/features/trails/schemas.ts`, `src/features/trails/types.ts`, `src/features/trails/api.ts`
- Modify: `src/features/trails/ui/trail-items-editor.tsx`, `src/features/trails/ui/trail-meta-form.tsx`
- Modify: `src/app/trails/[id]/page.tsx`, `src/features/trails/schemas.test.ts`
- Test: `src/features/trails/set-items-optlock.test.ts` (создать)

**Interfaces:**
- Consumes: `ifMatchHeader`, `DocumentPicker` (`@/components/ast-editor/pickers/document-picker`), `searchDocuments`.
- Produces: `getDocumentSummary(id): Promise<{ id; filename } | null>`; `DocumentIdsJsonSchema`; `TrailDocumentSummary`.

- [ ] **Step 1: schemas — lecture_ids → document_ids**

В `src/features/trails/schemas.ts`: переименовать `LectureIdsJsonSchema` → `DocumentIdsJsonSchema` (логика парсинга/валидации UUID-массива без дублей — без изменений), и в `TrailItemsSchema` поле `lecture_ids: LectureIdsJsonSchema` → `document_ids: DocumentIdsJsonSchema`.
В `src/features/trails/schemas.test.ts`: обновить тесты `lecture_ids` → `document_ids` (имя поля и сообщения), смысл проверок сохранить.

- [ ] **Step 2: types — TrailDocumentSummary + Visibility (уже access)**

В `src/features/trails/types.ts`: переименовать локальный тип `TrailLectureSummary { id; title }` → `TrailDocumentSummary { id; filename }` (поле `title`→`filename`). (Visibility уже `access.Visibility` из Plan A.)

- [ ] **Step 2 продолжение: api — getDocumentSummary**

В `src/features/trails/api.ts`: заменить `getLectureSummary` на `getDocumentSummary`:

```typescript
export const getDocumentSummary = cache(
  async (id: string): Promise<{ id: string; filename: string } | null> => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/documents/{id}", { params: { path: { id } } });
    if (error) return null;
    const doc = unwrap(data);
    if (!doc?.id) return null;
    return { id: doc.id, filename: doc.filename ?? doc.id };
  },
);
```
(Если у `getTrailById` есть share-token-аргумент — сохранить его поведение; здесь резолвим только видимые документы.)

- [ ] **Step 3: Написать падающий optlock-тест setTrailItems**

Создать `src/features/trails/set-items-optlock.test.ts` (образец — `comments/update-comment-blocks-optlock.test.ts`). Мокать `@/api/client` (PUT), `@/utils/me`, `@/utils/revalidate`. Проверки:

```typescript
it("шлёт document_ids и If-Match", async () => {
  await setTrailItems(initial, itemsForm({ version: "3", document_ids: JSON.stringify([DOC1, DOC2]) }));
  expect(put).toHaveBeenCalledWith(
    "/api/trails/{id}/items",
    expect.objectContaining({
      params: { path: { id: ID }, header: { "If-Match": '"3"' } },
      body: { document_ids: [DOC1, DOC2] },
    }),
  );
});
it("не шлёт PUT без версии (428-guard)", async () => {
  await setTrailItems(initial, itemsForm({ document_ids: JSON.stringify([DOC1]) }));
  expect(put).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: Запустить — падает**

Run: `pnpm test src/features/trails/set-items-optlock.test.ts`
Expected: FAIL.

- [ ] **Step 5: actions — If-Match на обоих PUT + document_ids + строки ошибок**

В `src/features/trails/actions.ts`:
- импорт: `import { ifMatchHeader } from "@/utils/optimistic-lock";`
- `updateTrailMeta`: в `api.PUT("/api/trails/{id}", ...)` добавить `header: ifMatchHeader(formData, "маршрута")` в `params`.
- `setTrailItems`: в `api.PUT("/api/trails/{id}/items", ...)` добавить `header: ifMatchHeader(formData, "маршрута")` в `params` и заменить `body: { lecture_ids: input.lecture_ids }` → `body: { document_ids: input.document_ids }`.
- `rethrowTrailApiError`: строковые проверки `"duplicate lecture_id"`→`"duplicate document_id"`, `"lecture not found"`→`"document not found"` (сверить актуальные коды/тексты бэка; если бэк отдаёт code, а не текст — оставить как есть).

- [ ] **Step 6: editor — DocumentPicker + document_ids + hidden version**

В `src/features/trails/ui/trail-items-editor.tsx`:
- импорт: `import { DocumentPicker } from "@/components/ast-editor/pickers/document-picker";` (убрать LecturePicker).
- `<LecturePicker onSelect={addLecture} />` → `<DocumentPicker onSelect={addDocument} />`; переименовать `addLecture`→`addDocument`, локальные `items` хранят `{ id, filename }` (рендерить `item.filename`).
- hidden-инпут `name="lecture_ids"` → `name="document_ids"` (значение — `JSON.stringify(orderedIds)`).
- добавить hidden `<input type="hidden" name="version" value={String(trailVersion ?? "")} />` — пробросить `version` пропом из родителя (значение `trail.version`).

- [ ] **Step 6 продолжение: trail-meta-form + page**

В `src/features/trails/ui/trail-meta-form.tsx`: добавить hidden `<input type="hidden" name="version" value={String(trail.version ?? "")} />` (для If-Match в `updateTrailMeta`); проброс `version` обеспечить из пропа `trail`.
В `src/app/trails/[id]/page.tsx:38`: `item.lecture_id` → `item.document_id`; `getLectureSummary(...)` → `getDocumentSummary(...)`; передать `version`/`filename` в editor/meta-form по их новым пропам.

- [ ] **Step 7: Тесты зелёные**

Run: `pnpm test src/features/trails`
Expected: PASS (`set-items-optlock`, `schemas.test`, `permissions.test`).

- [ ] **Step 8: Верификация типов/линта**

Run: `pnpm typecheck` — все trails-ошибки (page.tsx:38, actions.ts:78/94/95) ИСЧЕЗЛИ; остаток 0 (lectures уже закрыта в B1).
Run: `pnpm exec eslint <все изменённые файлы>` — чисто (в т.ч. ушла lint-ошибка page.tsx:38).

- [ ] **Step 9: Коммит**

```bash
git add src/features/trails/actions.ts src/features/trails/schemas.ts src/features/trails/schemas.test.ts src/features/trails/types.ts src/features/trails/api.ts src/features/trails/ui/trail-items-editor.tsx src/features/trails/ui/trail-meta-form.tsx src/features/trails/set-items-optlock.test.ts src/app/trails/[id]/page.tsx
git commit -m "feat(trails): переход на документы (document_ids) + optimistic locking"
```

---

### Task 3: Подписка на лекции (UI)

**Files:**
- Modify: `src/features/notifications/actions.ts` (subscribeLecture/unsubscribeLecture), `src/features/notifications/api.ts` (getLectureSubscription), `src/features/notifications/index.ts`
- Create: `src/features/notifications/ui/lecture-subscribe-button.tsx`
- Modify: `src/app/lectures/[id]/page.tsx`
- Test: расширить тесты notifications (actions/api), если есть; иначе — минимальный тест на actions.

**Interfaces:**
- Produces: `subscribeLecture(lectureId)`, `unsubscribeLecture(lectureId)`, `getLectureSubscription(lectureId): Promise<boolean>`, `<LectureSubscribeButton lectureId initialSubscribed />`.

- [ ] **Step 1: actions — зеркало document-подписки**

В `src/features/notifications/actions.ts` добавить (по образцу `subscribeDocument`/`unsubscribeDocument`):

```typescript
export const subscribeLecture = createAction(async (lectureId: string) => {
  const me = await getMe();
  requireActive(me);
  const api = await createApiClient();
  const { error } = await api.POST("/api/lectures/{id}/subscribe", { params: { path: { id: lectureId } } });
  if (error) rethrowApiError(error);
  return undefined;
}, "subscribeLecture");

export const unsubscribeLecture = createAction(async (lectureId: string) => {
  const me = await getMe();
  requireActive(me);
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/lectures/{id}/subscribe", { params: { path: { id: lectureId } } });
  if (error) rethrowApiError(error);
  return undefined;
}, "unsubscribeLecture");
```

- [ ] **Step 2: api — getLectureSubscription**

В `src/features/notifications/api.ts` добавить (зеркало `getDocumentSubscription`, фильтр по `target_type === "lecture"`):

```typescript
export const getLectureSubscription = cache(async (lectureId: string): Promise<boolean> => {
  try {
    const api = await createApiClient();
    const { data, error } = await api.GET("/api/me/subscriptions", { params: { query: { offset: 0, limit: 100 } } });
    if (error) return false;
    return (data.data ?? []).some((s) => s.target_type === "lecture" && s.target_id === lectureId);
  } catch {
    return false;
  }
});
```

- [ ] **Step 3: UI-кнопка — зеркало DocumentSubscribeButton**

Создать `src/features/notifications/ui/lecture-subscribe-button.tsx` по образцу `document-subscribe-button.tsx` (прочитай его), props `{ lectureId: string; initialSubscribed: boolean }`, вызывает `subscribeLecture`/`unsubscribeLecture`, оптимистичный toggle с откатом при `!result.success`.

- [ ] **Step 4: Экспорт + интеграция в страницу**

В `src/features/notifications/index.ts` добавить экспорт `subscribeLecture`, `unsubscribeLecture`, `getLectureSubscription`, `LectureSubscribeButton`.
В `src/app/lectures/[id]/page.tsx`: в `Promise.all` добавить `me && lecture.id ? getLectureSubscription(lecture.id) : Promise.resolve(false)`; в блоке действий (`flex justify-end`, рядом с SaveOfflineButton/ShareButton) рендерить при `me && lecture.id`:

```tsx
            <LectureSubscribeButton lectureId={lecture.id} initialSubscribed={subscribed} />
```

- [ ] **Step 5: Тест actions**

Добавить тест (если есть `notifications/actions.test.ts` — расширить; иначе создать `src/features/notifications/subscribe-lecture.test.ts`): `subscribeLecture` зовёт `POST /api/lectures/{id}/subscribe` c path id; `unsubscribeLecture` — DELETE. Мокать createApiClient/getMe/revalidate как в существующих тестах слайса.

- [ ] **Step 6: Верификация**

Run: `pnpm test src/features/notifications` — зелёное.
Run: `pnpm typecheck` — 0 ошибок; `pnpm exec eslint <изменённые>` — чисто.

- [ ] **Step 7: Коммит**

```bash
git add src/features/notifications/actions.ts src/features/notifications/api.ts src/features/notifications/index.ts src/features/notifications/ui/lecture-subscribe-button.tsx src/app/lectures/[id]/page.tsx src/features/notifications/subscribe-lecture.test.ts
git commit -m "feat(notifications): подписка на изменения лекции (UI + actions)"
```

---

### Task 4: «Выйти со всех устройств» (UI)

**Files:**
- Create: `src/features/auth/ui/logout-all-form.tsx`
- Modify: `src/features/auth/index.ts`, `src/app/me/settings/page.tsx`

**Interfaces:**
- Consumes: `logoutAllAction` (Plan A), `ConfirmDialog`, `wipeOfflineData`, `countSavedBundles`.
- Produces: `<LogoutAllForm />`.

- [ ] **Step 1: Компонент LogoutAllForm**

Создать `src/features/auth/ui/logout-all-form.tsx` по образцу `logout-form.tsx`. Текущее устройство тоже разлогинивается (logout-all отзывает все сессии, включая текущую) → перед `logoutAllAction()` чистим офлайн как и в обычном logout:

```tsx
"use client";
import { Button, ConfirmDialog } from "@/components/ui";
import { countSavedBundles } from "@/services/offline/store/saved-bundles";
import { wipeOfflineData } from "@/services/offline/wipe";
import { logoutAllAction } from "../actions";

export function LogoutAllForm() {
  async function doLogoutAll() {
    await wipeOfflineData();
    await logoutAllAction();
  }
  return (
    <ConfirmDialog
      trigger={<Button variant="ghost" size="sm">Выйти со всех устройств</Button>}
      title="Выйти со всех устройств?"
      description="Все активные сессии будут завершены на всех устройствах. Сохранённые офлайн-материалы будут удалены с этого устройства."
      destructive
      confirmLabel="Выйти везде"
      onConfirm={doLogoutAll}
    />
  );
}
```

- [ ] **Step 2: Экспорт + интеграция в настройки**

В `src/features/auth/index.ts` добавить `export { LogoutAllForm } from "./ui/logout-all-form";`.
В `src/app/me/settings/page.tsx`, в секции «Аккаунт» рядом с `<LogoutForm />`, добавить `<LogoutAllForm />`.

- [ ] **Step 3: Верификация**

Run: `pnpm typecheck` — 0; `pnpm exec eslint src/features/auth/ui/logout-all-form.tsx src/features/auth/index.ts src/app/me/settings/page.tsx` — чисто.
Run: `pnpm test src/features/auth` — зелёное.

- [ ] **Step 4: Коммит**

```bash
git add src/features/auth/ui/logout-all-form.tsx src/features/auth/index.ts src/app/me/settings/page.tsx
git commit -m "feat(auth): кнопка «выйти со всех устройств» в настройках"
```

---

### Task 5: Гейт волны + финальное ревью

- [ ] **Step 1: Полный гейт**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: ВСЁ зелёное — 0 lint-ошибок, 0 tsc-ошибок, тесты passed, build OK (включая `src/app/trails/[id]/page.tsx`). Если build спотыкается на сетевых флейках шрифтов — повторить.

- [ ] **Step 2: Дымовая проверка (опционально, при наличии стенда)**

С локальным бэком (:8090) и `pnpm dev` (:3001): создать/отредактировать маршрут (выбор документов через DocumentPicker, сохранение порядка); отредактировать лекцию (If-Match — параллельная правка в другой вкладке должна дать понятную ошибку «данные изменились»); подписаться/отписаться на лекции; «выйти со всех устройств» из настроек.

- [ ] **Step 3: Финальное whole-branch ревью**

Передать ревьюеру весь диапазон миграции (Plan A + Plan B) + накопленные Minor из ledger для триажа.

---

## Self-Review (выполняется автором плана)

**Спек-покрытие (оставшиеся секции спеки):**
- Optlock lectures/trails (секция 2 спеки, оставшиеся 2 слайса) → B1, B2. ✓
- Trail → документы (секция 3) → B2 (DocumentPicker, document_ids, getDocumentSummary, page). ✓
- Подписка на лекции (секция 6) → B3. ✓
- logout-all UI (секция 6) → B4. ✓
- Манифесты (секция 7) → Plan C (вне Plan B). ✓
- Все 5 tsc-ошибок + 1 lint закрываются: lectures If-Match (B1); trails actions ×2 + page + document_ids + lint page (B2). ✓

**Скан плейсхолдеров:** код новых функций (getDocumentSummary, subscribe*, getLectureSubscription, LogoutAllForm, optlock-правки) приведён дословно; тесты, зеркалящие существующие, ссылаются на конкретный файл-образец + дают ключевые проверки явным кодом — это не «TODO», а конкретный референс. ✓

**Согласованность типов:** `ifMatchHeader(formData, "...")` → `{ "If-Match": '"<version>"' }` единообразно (B1/B2); `version` hidden-field — общий паттерн; `TrailDocumentSummary { id; filename }` согласован между types/api/editor; `document_ids` согласован между schemas/actions/editor. ✓
