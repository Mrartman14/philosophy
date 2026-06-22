# Frontend conventions

Этот документ — единая точка входа для агента, начинающего новую фичу.
Архитектура, шаблон слайса, SSR-first паттерны, RBAC, тесты, запретные зоны.

Связанные документы:
- Дизайн фундамента: `docs/superpowers/specs/2026-04-26-frontend-foundation-design.md`
- Общие правила проекта: `CLAUDE.md` (русский язык, kebab-case, нет деструктивных git-операций)

---

## 1. Архитектура

Каждая сущность живёт в собственном слайсе `src/features/<entity>/`:

```
src/features/<entity>/
  index.ts          # public API: реэкспорт того, что нужно снаружи
  api.ts            # server-only fetchers (React.cache, опционально unstable_cache)
  actions.ts        # "use server" + server-only — мутации
  permissions.ts    # доменные can*-хелперы (server-only)
  schemas.ts        # Zod-схемы для FormData (server-only)
  types.ts          # сужения из @/api/schema
  ui/               # client- и server-компоненты слайса
  *.test.ts         # vitest: permissions.test.ts, schemas.test.ts
```

Жёсткие правила (enforced ESLint'ом, см. `eslint.config.mjs`):

- **Cross-feature импорты запрещены.** Один слайс не импортит другой.
  Общий код — в `@/components`, `@/utils`, `@/hooks`. Данные между слайсами
  ходят только через бекенд.
- **Deep-imports запрещены.** Снаружи слайс импортится только через
  `@/features/<entity>` (его `index.ts`).
- **`react-dom/client` не должен встречаться в server-only файлах слайса**
  (`api.ts`, `actions.ts`, `permissions.ts`, `schemas.ts`).

---

## 2. Шаблон слайса

Не пиши с нуля. Скопируй `src/features/_template/` в
`src/features/<entity>/`, переименуй и наполни. Чеклист — в
`src/features/_template/README.md`.

### 2.1. Client-safe entry фичи (RSC-граница)

Публичный `index.ts` фичи реэкспортит `./api`/`./actions` (server-only) — поэтому его НЕЛЬЗЯ импортировать из `"use client"`-кода: server-only утечёт в client-бандл и `next build` упадёт («server-only cannot be imported from a Client Component»). Для client-потребителей (офлайн-view в `app/saved/**` и т. п.) у фичи есть второй публичный вход:

- **`src/features/<entity>/client.ts`** — реэкспортит ТОЛЬКО изоморфные/client-safe view, чистые утилиты и типы. НЕ реэкспортит `./api`/`./actions`/`./permissions`/`./schemas` и НЕ делает cross-feature импортов (форсит Guardrail 4 в `eslint.config.mjs`).
- Импорт из client-кода: `import { XView } from "@/features/<entity>/client"`.
- **Слот-паттерн:** client-safe view не тянут server-данные/RBAC напрямую — server-контейнер инжектит их пропами/слотами (образец — `CommentNodeView` с `anchorSlot`/`reactionsSlot`/`actionsSlot`).
- server-страницы и server-композиция продолжают брать `getX`/actions из обычного `index.ts`.

---

## 3. Паттерны

### 3.1. Server fetcher

```ts
// src/features/comments/api.ts
import "server-only";
import { cache } from "react";
import { createApiClient } from "@/api/client";

export const getComments = cache(async (lectureId: string) => {
  const api = await createApiClient();
  const { data, error } = await api.GET("/comments", {
    params: { query: { lecture_id: lectureId } },
  });
  if (error) throw new Error(error.message);
  return data;
});
```

`React.cache()` дедуплицирует вызовы внутри одного запроса. Для cross-request
кеширования можно обернуть в `unstable_cache` с тегом из `@/api/tags`:

```ts
import { unstable_cache } from "next/cache";

export const getCommentsCached = unstable_cache(
  async (lectureId: string) => {
    const api = await createApiClient();
    const { data, error } = await api.GET("/comments", { params: { query: { lecture_id: lectureId } } });
    if (error) throw new Error(error.message);
    return data;
  },
  ["comments-by-lecture"],
  { tags: ["comments"] }
);
```

Сигнатура `unstable_cache(cb, keyParts?, options?)` подтверждена в Next 16
(`next/dist/server/web/spec-extension/unstable-cache.d.ts`). API стабильно,
но семантика требует осознанности — заворачивай только то, что реально стабильно.

### 3.2. Инвалидация кеша

Никогда не вызывай `revalidateTag` напрямую — в Next 16 он требует второй
аргумент `profile` (`string | CacheLifeConfig`). Используй обёртку
`revalidateEntity` из `@/utils/revalidate`, она передаёт `"default"` под капотом:

```ts
import { revalidateEntity } from "@/utils/revalidate";

revalidateEntity("comments");           // сбрасывает тег "comments"
revalidateEntity("comments", "abc-123"); // плюс "comments:abc-123"
```

Конвенция тегов: `<entity>` для list, `<entity>:<id>` для item. Реестр — в
`src/api/tags.ts`, дополняй при создании `api.ts` слайса.

### 3.3. Server action

```ts
// src/features/comments/actions.ts
"use server";
import "server-only";
import { createFormAction, parseFormData } from "@/utils/create-action";
import { requireCapability } from "@/utils/permissions";
import { rethrowApiError, type ApiErrorMessageKeys } from "@/utils/api-error";
import { revalidateEntity } from "@/utils/revalidate";
import { getMe } from "@/utils/me";
import { createApiClient } from "@/api/client";
import { Tags } from "@/api/tags";
import { canCreateComment } from "./permissions";
import { CommentCreateSchema } from "./schemas";

/** Доменные коды слайса → КЛЮЧ каталога errors (i18n-канал, декларативно, не
 * switch). Значение — ключ из src/i18n/messages/{ru,en}/errors.ts, НЕ готовый
 * текст. Общие 403/account-коды и дефолты (REF_NOT_FOUND, …) обрабатывает
 * rethrowApiError. */
const ERRORS: ApiErrorMessageKeys = {
  COMMENT_DELETED: "COMMENT_DELETED",
  MAX_DEPTH_EXCEEDED: "MAX_DEPTH_EXCEEDED",
};

export const createComment = createFormAction(async (formData) => {
  const me = await getMe();
  requireCapability(me, canCreateComment);        // гейт ДО парсинга (capability-only)
  const input = parseFormData(CommentCreateSchema, formData);
  const api = await createApiClient();
  const { data, error } = await api.POST("/comments", { body: input });
  if (error) rethrowApiError(error, ERRORS);      // доменные коды + общий fallback
  revalidateEntity(Tags.COMMENTS);                // тег из реестра, не литерал
  return data;
});
```

`createFormAction` ловит `ForbiddenError` и `ZodValidationError`, превращая
их в `ActionResult { success: false, code: "forbidden" | "validation", … }`.
Внутренние ошибки Next.js (`redirect()`, `notFound()`, `forbidden()`)
пробрасываются дальше.

**Порядок гейта и парсинга (канон).** Для **capability-only** мутаций
ставь `requireCapability(me, canX)` / `requireActive(me)` ДО `parseFormData`
(отказ дешевле без траты на парсинг). Для **owner-aware** мутаций сначала
`parseFormData` (нужен `id` из формы), затем загрузка сущности и
`requireCapability(me, () => canEditX(me, entity))`.

**Обработка ошибок бека.** Единая точка — `rethrowApiError(error, overrides?)`
из `@/utils/api-error`. Слайс описывает только свои доменные коды декларативной
картой `const ERRORS: ApiErrorMessageKeys = { CODE: "ERROR_KEY" }` (значение —
ключ каталога `errors` из `src/i18n/messages/{ru,en}/errors.ts`, НЕ готовый текст;
образец i18n-миграции — `docs/frontend-i18n.md`, Case 2) и передаёт её вторым
аргументом. Легаси-тип `ApiErrorMessages` (значение-текст) ещё принимается для
немигрированных слайсов, но в новом коде не используется. Сам `rethrowApiError`
обрабатывает по приоритету: `BANNED` → `BannedError` (форс-логаут на
`/auth/forced-logout`), role-403 (`FORBIDDEN`/`ATTACH_FORBIDDEN`/`UPLOAD_FOREIGN`
→ `ForbiddenError("role")`), account-код `SUSPENDED` → `ForbiddenError("status")`,
422 field-ошибки → `ZodValidationError`, дефолтные ключи общих кодов
(`REF_NOT_FOUND`, `BLOCKS_HAVE_ANCHORS`, optlock/idempotency/413 — в
`DEFAULT_MESSAGES`), и фоллбек: текст бэка `err.error` (если есть) → `Error(err.error)`, иначе `ApiMessageError("serverError")`.
Новый общий код добавляется в `DEFAULT_MESSAGES` ОДНОЙ строкой, а не копипастой по
слайсам. Тип ключа (код бека) — сгенерированный union `ApiErrorCode` (drift-guard:
удалённый на беке код краснеет после regen). Если у слайса есть распознавание
ошибок по тексту (без UPPER_SNAKE-кода) — оставь тонкую локальную обёртку, которая
в конце делегирует в `rethrowApiError` (см. `trails/actions.ts`).

### 3.4. Форма с `useActionState`

```tsx
// Иллюстрация паттерна; <entity>/EntityCreateFormInput — плейсхолдеры слайса.
"use client";
import { useActionState } from "react";
import { createTypedForm, Form, SubmitButton, TextInput } from "@/components/ui";
import { createEntity } from "@/features/<entity>";
import type { EntityCreateFormInput } from "@/features/<entity>/schemas";

const { Field, f, errors } = createTypedForm<EntityCreateFormInput>();

export function CreateEntityForm() {
  const [state, action] = useActionState(createEntity, { success: true, data: undefined });
  return (
    <Form action={action} errors={errors(state)}>
      <Field name="title" label="Заголовок" required>
        <TextInput />
      </Field>
      <SubmitButton>Создать</SubmitButton>
    </Form>
  );
}
```

`createTypedForm<z.input<schema>>()` (из `@/components/ui`) связывает `name`-пропы и
`errors` с ключами Zod-схемы на уровне типов. Тип импортируется **type-only** из
server-only `schemas.ts` (`import type { XFormInput } from "../schemas"`) — стирается
компилятором, рантайм-схема в клиент не попадает. Биндить к `z.input` (НЕ `z.infer`):
имена и required-ность берутся со входа схемы. `Field` форсит `required` для
required-ключей. Required-enforcement действует только на `<Field>` — hidden-инпуты
через `f()` (контекстные/инфра-поля) ему не подчиняются, by design. Поля вне схемы
(контекстный `lecture_id`, инфра-инпуты) — raw-строкой `name="…"`. Динамические формы
(`forms/**` builder/fill) — рантайм-острова, слой не применяется к их внутренним полям.

`name` пишется ОДИН раз — на `<Field>` (= Base UI `Field.Root`); контролы
наследуют его из контекста (Base UI `fieldName ?? nameProp`): текстовые
(`TextInput`/`Textarea`/`ColorInput`) — после перевода на `Field.Control` (эта
итерация), композитные (`Select`/`Checkbox`) — нативно (Base UI-контролы, и до
неё). `f("…")` нужен только для hidden-инпутов
(`idempotency`, JSON-острова), кастом-виджетов (AST-редактор) и standalone-контролов
вне `<Field>`. `aria-label` на контроле внутри `<Field>` избыточен — `Field.Label`
именует его через `aria-labelledby` (перебивает `aria-label`); не дублируй.
Перевод текстовых контролов на `Field.Control` попутно включает native-проводку:
`data-invalid` рамка, `aria-invalid`/`aria-describedby`, focus-on-error, `clearErrors`
при вводе (серверная валидация при этом не трогается — `Field.Root.validate` не задаём;
кастом-виджеты вроде AST-редактора в фокус-цикл не входят — нет зарегистрированного контрола).

`Form` из `@/components/ui` оборачивает Base UI `Form` и принимает
`errors: Record<string, string>` (Base UI допускает `string | string[]`,
наш wrapper упрощает до `string`).

**Cross-field ошибки.** Если Zod-схема использует `.refine()` / `.superRefine()`
без явного `path`, ошибка приходит с пустым путём. `parseFormData` маршрутит
такие ошибки в ключ `_form`. Рендерь их отдельным баннером:

```tsx
{state.success === false && state.code === "validation" && state.fieldErrors._form && (
  <p role="alert">{state.fieldErrors._form}</p>
)}
```

**`<ConfirmDialog>` не surface'ит ошибки `onConfirm`.** Если action может
упасть — оборачивай в try/catch и показывай тост сам:

```tsx
<ConfirmDialog
  trigger={<Button variant="danger">Удалить</Button>}
  title="Удалить?"
  onConfirm={async () => {
    const result = await deleteEntity(formData);
    if (!result.success) toast.add({ title: "Ошибка", description: result.error });
  }}
/>
```

### 3.4.1. Идемпотентность мутирующих форм (опционально)

Бекенд принимает заголовок `Idempotency-Key` на мутирующих ручках: повтор с тем же
ключом и **байт-идентичным** телом не применяется второй раз (Stripe-семантика).
Это backstop поверх анти-дабл-сабмита в UI — закрывает дыры, которые `disabled`
не закрывает: формы без JS, окно до гидрации, повтор после потери ответа.

**Это opt-in per-form, не глобально.** Не вешать на транспорт middleware: она минтит
свежий ключ на каждый запрос → нулевая защита. Ключ принадлежит «одному намерению»,
им владеет компонент формы.

**Как включить форму:**

1. В форму (`"use client"`) внутрь `<Form>` добавить `<IdempotencyField result={state} />`
   из `@/components/ui` (`state` — из `useActionState`). Он рендерит скрытое поле,
   держит ключ стабильным и ротирует его после успеха.
2. В server action принять второй аргумент `ctx` и пробросить заголовок:

   ```ts
   export const createX = createFormAction(async (formData, ctx) => {
     // …
     const { data, error } = await api.POST("/api/…", {
       params,
       body,
       headers: idempotencyHeaders(ctx.idempotencyKey), // @/utils/idempotency
     });
     // …
   });
   ```

   Для слайсов на прямом `fetch` (не openapi-fetch, напр. annotations) —
   разворачивать тот же объект в `headers`:
   `headers: { ...base, ...idempotencyHeaders(ctx.idempotencyKey) }`.

**Политика ключа** (в `<IdempotencyField>`): стабилен на время жизни формы (двойной
клик и повтор-после-ошибки шлют тот же ключ → реплей, не дубль); ротируется после
каждого успешного сабмита (иначе следующая, уже другая, мутация словит 422 REUSED).

**Ошибки** (тексты — централизованы в `rethrowApiError`): 409 `IDEMPOTENCY_KEY_IN_USE`
(параллельный запрос ещё в работе), 422 `IDEMPOTENCY_KEY_REUSED` (тот же ключ + другое
тело), 400 `IDEMPOTENCY_KEY_INVALID`.

**Известный edge:** success + потеря ответа + правка тела + повтор → 422 REUSED
(бэк уже закешировал первый success). Узкий (не-2xx не кэшируется), показывается
дружелюбным текстом — отдельной обработки в форме не требуется.

**Кому НЕ нужно:** PUT/DELETE-by-id уже идемпотентны по эффекту; ручки, которые бэк
ещё не покрыл (заголовок безвреден, но смысла нет — включать по мере покрытия).

**Вариант 3 — ручная `FormData` (без `<Form>`):** для client-компонентов, которые строят
`FormData` вручную и вызывают `createFormAction`-экшен напрямую (не через Base UI `<Form>`,
напр. `form-fill.tsx`), поле ставится вручную:

```ts
import { useIdempotencyKey } from "@/hooks/use-idempotency-key";
import { IDEMPOTENCY_FIELD } from "@/utils/idempotency";

const { key: idempotencyKey, rotate } = useIdempotencyKey();

// при сабмите:
fd.set(IDEMPOTENCY_FIELD, idempotencyKey);
const result = await submitForm(prev, fd);
if (result.success) rotate();  // ротировать только после успеха
```

### 3.4.2. Общие хелперы форм и политика фидбэка

Чтобы не плодить копипасту, в формах используем общие примитивы (НЕ переписывай
их разметку руками):

- **`initialActionState<T>(data)`** (`@/utils/action-state`) — начальный
  `{ success: true, data }` для `useActionState`. Тип-аргумент явно:
  `const initial = initialActionState<Entity | null>(null)`.
- **`<FormFeedback result={state} forbiddenAction={t("xForbiddenAction")} {...successText} />`**
  (`@/components/ui`) — единая отрисовка фидбэка под формой: success (зелёный
  `role="status"`), forbidden (branded через `errors.forbiddenAction`), validation
  `_form` и generic (`role="alert"`, токен `--color-danger`). НЕ рисуй ручные
  `<p className="text-red-600">`.
  - `forbiddenAction` — локализованное действие в родительном падеже из неймспейса
    фичи (напр. `createForbiddenAction: "создание маршрута"`).
  - `successText` гейтить по данным (exactOptionalPropertyTypes — нельзя передать
    `undefined`): `const successText = state.success && state.data ? { successText: t("saved") } : {}`,
    в JSX `{...successText}`. Иначе плашка успеха покажется на маунте (начальный
    `state.success === true`).
  - Полевые ошибки рисует `FormField` (Base UI `Field.Error`) из карты
    `<Form errors={errors(state)}>` — это отдельно от `FormFeedback`.
  - Исключения (фидбэк рисуют сами): формы с доменным маппингом серверных кодов
    (auth `ERROR_TEXT`) и императивные `useState`-флоу (uploads, optimistic-реакции).
- **`useActionRedirect(state, data => url)`** (`@/hooks/use-action-redirect`) —
  редирект после успешного create вместо ручного `useEffect`+`router.push`. Для
  `router.refresh()`-сценариев (in-place edit) хук не подходит — оставляй `useEffect`.
- **`<VersionField version={entity.version} />`** (`@/components/ui`) — скрытое поле
  optimistic-concurrency (412). Заменяет `<input type="hidden" name="version" …>`.

**toast vs inline.** Поверхность фидбэка выбираем по типу действия:

- **inline `FormFeedback`** — для форм-страниц и панелей редактирования, где
  результат логически принадлежит форме (create / edit / meta / visibility-формы).
  Ошибка/успех остаются рядом с полями.
- **toast** (`useToast` + `toastActionError` из `@/utils/action-toast`) — для
  действий-кнопок в списках/строках и over-the-content операций, где формы как
  поверхности нет либо она закрывается (canvas-операции, `ConfirmDialog.onConfirm`,
  `share-button`, `tokens-manager` create/revoke). Результат транзиентный → тост.

По этому правилу `share-button` и `tokens-manager` остаются на toast (действия в
управляющих списках, не формы-страницы) — ранее открытый вопрос «toast vs inline»
закрыт в пользу toast.

### 3.5. Filter / search через `searchParams`

Для списков используем server-side фильтрацию через URL. Page получает
`searchParams: Promise<Record<string, string | string[]>>`, парсит и передаёт
в fetcher. Client-компоненты обновляют URL через `useRouter().replace()` —
revalidation бесплатна, fetcher запускается заново.

---

## 4. RBAC

Источник истины — бэкенд. Фронт читает `getMe()` (`src/utils/me.ts`),
получает `{ role, status, capabilities: string[] }` или `null` (гость).

- **В server actions:** `requireCapability(me, canX)` — кидает
  `ForbiddenError`, ловится `createAction`/`createFormAction`.
- **В server-components:** вызывай доменные `canX(me, …)` из
  `features/<entity>/permissions.ts`, пробрасывай boolean пропами в client.
  `Me` и `MaybeMe` (из `@/utils/me`) — server-only типы; в client-компоненты
  передавай только готовые булевы / примитивы, не сам объект `me`.
- **В client UI:** показывай `result.code === "forbidden"` бренд-текстом
  «У вас нет прав на <действие>», не raw `result.error`.
- **Layer-3 гейт** на `src/app/admin/*/page.tsx` — доменный `canX` раздела:
  ```ts
  const me = await getMe();
  if (!canListAdminDocuments(me)) forbidden();
  ```
  **Admin-граница (Layer-1)** в `src/app/admin/layout.tsx` — `canAccessAdmin(me)`
  из `src/app/admin/admin-access.ts` («есть хотя бы один admin-нав-итем»).
  Отдельной capability `admin.access` НЕТ (была фантомом, удалена при переходе
  `Capability` на сгенерированный `rbac.Capability`).
- `can()` уже учитывает `status === "active"`, дублировать в доменных
  хелперах не нужно (для owner-aware — `isMutationAllowed` / `ownerOrCap`).

---

## 5. Тесты

Vitest с `jsdom`. Конфиг — `vitest.config.ts`. `server-only` алиасится на
`src/test/server-only-stub.ts`, потому что Next отдаёт пакет внутри своего
бандла, а не как top-level зависимость — без алиаса import-analysis падает.

Что обязательно покрываем:
- **`permissions.ts`** — каждый `canX` хелпер: гость → false, owner → true,
  not-owner без `*.delete_any` → false, suspended → false.
- **`schemas.ts`** — каждая схема: минимум 1 success + 1 failure.
- **Утилиты** — purely functional (`format-time`, `dates`, `revalidate`,
  `create-action`).

Что НЕ пишем здесь: e2e, скриншот-тесты, тесты UI-примитивов
(они покрываются использованием в `/dev/kit` smoke-page — dev-only).

`/dev/kit` (`src/app/dev/kit/page.tsx`) — визуальный smoke check для UI-kit,
только для dev (`notFound()` в проде). Удалится, когда фичи покроют примитивы
реальным использованием.

`/dev/ui` (`src/app/dev/ui/page.tsx`) — публичная витрина дизайн-системы
(APCA + appearance + motion), не smoke-страница.

---

## 6. Переиспользование стилей и токены

Когда один и тот же паттерн стилей повторяется — выноси. Но «куда» зависит от
того, **что именно** повторяется. Три механизма решают три разные задачи; не
путай их (особенно: design-токены — это про **значения**, а не про «место для
повторов»).

| Что повторяется | Куда выносить | Пример |
| --- | --- | --- |
| **UI-элемент с идентичностью** (структура + поведение + стиль) | **React-компонент** | `Button`, `Select`, `FormField` в `components/ui/*` |
| **Фрагмент стиля** поверх разных элементов (focus-ring, «оболочка» поверхности, длинный контент) | **Именованный рецепт**: class-строка-константа / `@utility` / `@layer components` | `SHELL_BASE`, `FOCUS_RING_*` в `components/ui/cn.ts`; слой `.content` |
| **Значение** (цвет / отступ / размер / тип) | **Semantic CSS-переменная (токен)** | `--color-surface`, `--color-fg-muted`, `--space-control-pad-x` |

**Правило выноса в React-компонент:** есть имя/идентичность, встречается в 3+
местах, инкапсулирует структуру+поведение — а не только класс-строку.

**Анти-паттерн:** компонент на каждое 2-строчное совпадение классов. Это плодит
обёртки, пропы-проксики и жёсткость — абстракция дороже повтора. Для чистого
повтора *классов* бери рецепт (константа / `@utility`), не компонент: он легче и
свободнее композится с Tailwind.

**Значения — только через semantic-токены.** Не хардкодь цвета/размеры в
компонентах и рецептах: и компонент, и рецепт ссылаются на одни и те же
semantic CSS-переменные (единый источник истины — фундамент стилизации,
`docs/superpowers/specs/2026-04-26-frontend-foundation-design.md` и
`…/2026-06-19-styling-foundation-design.md`). «Component-токены» (CSS-переменные,
скоупленные на компонент) — узкий опциональный ярус: заводи только когда
компоненту нужна своя ручка, которую semantic-токен не выражает. Они НЕ
замена выносу в компонент.

### 6.1. Focus appearance (видимость фокуса)

Любой фокусируемый элемент ОБЯЗАН иметь видимое `focus-visible`-кольцо.
`outline: none` / `outline-0` без явной замены — **запрещён** (убивает индикатор
клавиатурного фокуса).

- **Kit-контролы** (`Button`, `IconButton`, `Checkbox`, `TextInput`, `Textarea`,
  `Select`, `ColorInput`, `Toolbar`) уже несут кольцо — ничего не добавляй.
- **Фокусируемые элементы в фичах, которые НЕ kit-контролы** (карточка-ссылка на
  базе `RouterLink`, рукодельный `<input>`) — применяй рецепт из
  `@/components/ui`: `FOCUS_RING_CONTROL` (кнопки/кликабельные блоки, offset-2)
  или `FOCUS_RING_INPUT` (текстовые поля, offset-0). Не накостыливай свой фокус.
- **Инлайновые текст-ссылки** оставляют UA-дефолтный outline — не навешивай на них
  бокс-кольцо.

Почему это конформно WCAG 2.2:

- **2.4.7 Focus Visible (A)** — кольцо есть у всех фокусируемых элементов.
- **2.4.11 Focus Not Obscured (AA)** — `* { scroll-margin-top: var(--spacing-header) }`
  в `globals.css` не даёт липкой шапке закрыть сфокусированный элемент.
- **1.4.11 Non-text Contrast (AA)** / **2.4.13 Focus Appearance (AAA)** — контраст
  кольца гарантирует APCA CI-гейт (`ring` × `surface`, Lc≥45, см.
  `src/styles/tokens/apca-targets.ts`); 2px-кольцо даёт требуемую площадь и
  change-of-contrast.

---

## 7. Что нельзя трогать

Список запретных зон. Если кажется, что нужно — сначала спроси.

- **`src/api/schema.ts`** — генерируется из OpenAPI. Не редактируй вручную.

  **Регенерация типов (`pnpm generate:api`):**
  Скрипт запускает `swagger2openapi` (pinned devDep) → `openapi-typescript`.
  По умолчанию берёт `../philosophy-api/docs/swagger/swagger.json` (сиблинг-репо).
  Для другого источника: `SWAGGER_URL=http://localhost:8080/swagger.json pnpm generate:api`.
  `src/api/schema.ts` — **координированный/заморожен**: перегенерацию согласовывай
  с командой (бэк должен быть доступен, фронт-изменения — отдельным PR).

- **`src/app/layout.tsx`** (root layout) — Toaster, ThemeProvider и т.п.
  уже подключены, добавление — отдельной задачей.
- **`src/app/admin/layout.tsx`** и `admin-sidebar.tsx` — capability-gated
  навигация, изменения — через RBAC-апдейт, не локальные хаки.
- **`src/app/globals.css`** — токены и темы. Цветовые правки —
  исключительно через CSS-переменные.
- **`src/components/ui/*`** — UI-kit над Base UI. Новые примитивы —
  отдельной фичей, не «по дороге».
- **`package.json`** / `package-lock.json` — без явной задачи не добавляй
  зависимости.
- **`eslint.config.mjs`** — система guardrails, ослаблять нельзя. Полный список
  (нумерация — в комментариях конфига):
  - **G1** deep-imports: снаружи слайс — только через `@/features/<entity>`
    (index.ts) или `@/features/<entity>/client` (client-safe).
  - **G2** cross-feature импорты между слайсами запрещены (данные — через бэкенд,
    общий код — через `@/components`/`@/utils`/`@/hooks`).
  - **G3** server-only файлы слайса (`api`/`actions`/`permissions`/`schemas`) не
    импортят client-only пакеты (`react-dom/client`).
  - **G4** `client.ts` не реэкспортит server-only (`api`/`actions`/`permissions`/
    `schemas`).
  - **G5** `next-intl` — только через фасад `@/i18n` (исключение — `src/i18n/**`).
  - **G6** запрет `t.rich()`/`t.markup()` — каталог держит простое подмножество ICU
    ради дешёвого свопа i18n-библиотеки.
  - **G7** ноль прямых `@base-ui/react` и нативных интерактивных тегов
    (`button`/`select`/`form`/…) вне UI-kit.
  - **G8** «вид» kit-контролов закрыт: `className`/`variant`/`size` на styled-контроле
    запрещены (позиция — `Inline`/`Stack`, вид — `tone`/`compact`, либо `unstyled`-escape
    у `Button`).

См. также `CLAUDE.md`: запрет `git stash`, `git reset`, `git checkout .`,
`git clean`, `git add -A` / `git add .` (только по имени файла).

---

## 8. Чеклист агента

Перед открытием PR пройдись по `src/features/_template/README.md`. Локально
зелёные:

```bash
pnpm lint && pnpm test && pnpm build
```

Если красное — фикси, не комментируй и не отключай правила.
