# Дизайн: фундамент фронтенда для параллельной работы агентов

**Дата:** 2026-04-26
**Контекст:** бекенд `philosophy-api` (Go) живёт в отдельном воркт ри, фронт `philosophy/` фактически greenfield (последний коммит обнулил `src/features/`). Нужен фундамент, на котором несколько агентов смогут параллельно реализовывать фичи в отдельных воркт ри без конфликтов и с общими паттернами.

## Цели

- **Изоляция параллельной работы:** один агент = одна папка-слайс = ноль перекрытий по файлам.
- **Единые паттерны:** агенты не изобретают форму, таблицу, тост, RBAC-проверку заново.
- **SSR-first:** server components по умолчанию, server actions для мутаций, минимум client-кода.
- **Безопасность RBAC:** capability-чеки через `requireCapability` в actions, доменные `canX` хелперы в UI.
- **Дешёвые регрессии:** тесты на критичные точки (permissions, Zod-схемы) обязательны.

## Архитектура: облегчённый Feature-Sliced Design ("B+")

### Слои и направление импортов

```text
src/
  app/                    # Next.js App Router — роуты, layouts, error.tsx, loading.tsx
  api/                    # openapi-fetch клиент + сгенерированная schema.ts + tags.ts
  components/             # Shared UI и крупные shared-виджеты
    ui/                   # UI-kit (тонкие обёртки над Base UI)
    shared/               # одноразовые shared-компоненты
    markdown-editor/      # большой self-contained виджет
    permission/           # RBAC UI-хелперы
    app/                  # app-level (providers, layout-helpers)
    yandex-metrika/
  features/               # слайсы по сущностям (1 entity = 1 папка = 1 агент)
  hooks/                  # client-хуки общего назначения (PWA и т.п.)
  utils/                  # createAction, permissions, dates, форматтеры, revalidate
  services/               # фоновые сервисы (push)
```

**Правила импортов:**

- `app/` импортит `features/`, `components/`, `utils/`, `hooks/`.
- `features/<X>` импортит `components/`, `utils/`, `hooks/`, `services/`, `api/`.
- `features/<X>` **никогда** не импортит `features/<Y>`. Если данные нужны от другой сущности — идут через бекенд.
- Внешние потребители фичи импортят **только** через `features/<X>` (через `index.ts`). Глубокие импорты типа `features/comments/ui/comment-form` запрещены ESLint'ом.

### Шаблон одного слайса

```text
src/features/<entity>/
  index.ts          # Public API — единственная точка входа извне
  api.ts            # "server-only". Серверные fetchers (getX, getXById)
  actions.ts        # "server-only". Server actions через createAction/createFormAction
  permissions.ts    # canCreateX, canDeleteX, ... (вызываются из UI и actions)
  schemas.ts        # Zod-схемы для FormData → импортятся и в actions, и в формах
  types.ts          # Сужения/перегон типов из @/api/schema
  ui/
    *.tsx           # server и client components. "use client" — только где нужен
  model/            # опционально — клиентские хуки/контексты
```

Когда `ui/` распухает (>5–7 файлов) — режется по подповерхностям: `ui/admin/`, `ui/reader/` или по форме (`ui/list/`, `ui/form/`). Граница admin/public идёт **внутри** слайса; RBAC уже определяет доступ через capabilities, а не через структуру папок.

В каждом `api.ts`/`actions.ts`/`permissions.ts` первая строка — `import "server-only";`.

В `index.ts` экспортируется только то, что нужно снаружи. `types.ts`, `schemas.ts`, `model/*` — приватные по умолчанию.

## Shared kernel и UI-kit

### `src/components/ui/` — pre-kit (собирается до старта параллельных фич)

Тонкие обёртки поверх Base UI с едиными Tailwind-токенами:

| Файл | Назначение |
|---|---|
| `button.tsx` | `Button` + варианты (primary/secondary/ghost/danger) |
| `icon-button.tsx` | Иконочная кнопка |
| `text-input.tsx` | `<input>` с едиными стилями и error state |
| `textarea.tsx` | Многострочный ввод |
| `select.tsx` | На основе `base-ui` Select |
| `checkbox.tsx` | Чекбокс |
| `form.tsx` | Client-обёртка над `base-ui` Form + `useActionState` |
| `form-field.tsx` | Label + control slot + error message по `name` из `ActionResult.fieldErrors` |
| `submit-button.tsx` | Client. `useFormStatus` → pending state + spinner |
| `dialog.tsx` | `base-ui` Dialog обёртка |
| `confirm-dialog.tsx` | Типовой confirm с `onConfirm` action |
| `table.tsx` | Минимум: `Table`, `Thead`, `Tbody`, `Tr`, `Th`, `Td` (без сортировки/фильтров) |
| `empty-state.tsx` | Пустое состояние списка |
| `pagination.tsx` | На основе URL `searchParams` (offset/limit) |
| `toast.tsx`, `toaster.tsx` | `base-ui` Toast обёртка + global `<Toaster />` в root layout |
| `skeleton.tsx` | Переезжает из `components/shared/` |

**Правило "extract on second use":** если две фичи начали делать похожий компонент — поднимаем в `components/ui/` отдельным быстрым "foundation update" PR.

### Расширения `src/utils/`

- `create-action.ts` — расширить `ActionResult` до:

  ```ts
  export type ActionResult<T = void> =
    | { success: true; data: T }
    | { success: false; error: string; code?: "forbidden" | "validation"; fieldErrors?: Record<string, string> };
  ```

  Добавить `parseFormData(zodSchema, formData)` хелпер: при `ZodError` бросает `ZodValidationError`, который `createFormAction` ловит отдельной веткой и возвращает `{ success: false, error, code: "validation", fieldErrors }`.

- `revalidate.ts` — новый файл:

  ```ts
  import { revalidateTag } from "next/cache";
  export function revalidateEntity(entity: string, id?: string) {
    revalidateTag(entity);
    if (id) revalidateTag(`${entity}:${id}`);
  }
  ```

- `permissions.ts`, `me.ts` — без изменений.

### `src/api/`

- `client.ts`, `schema.ts` — без изменений (schema регенерируется в foundation PR).
- `tags.ts` — новый файл, реестр строковых тегов для `revalidateTag` (защита от typo).

## SSR-first паттерны

### Чтение данных

Всегда в server components через `features/<X>/api.ts`. Никаких client-side fetchers, React Query, SWR.

```ts
// features/comments/api.ts
import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
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

- `cache()` дедуплицирует вызовы внутри одного запроса.
- Для стабильных данных — `unstable_cache` с тегами `["comments"]` или `["comments:${id}"]`.
- Ошибки бросаем — ближайший `error.tsx` отрендерит фолбэк.

### Страницы

```tsx
// app/admin/comments/page.tsx
import { getMe } from "@/utils/me";
import { canManageComments, getComments, CommentsAdminTable } from "@/features/comments";

export default async function Page({ searchParams }) {
  const me = await getMe();
  if (!canManageComments(me)) forbidden();
  const { offset } = await searchParams;
  const comments = await getComments({ offset: Number(offset) || 0 });
  return <CommentsAdminTable comments={comments.data} />;
}
```

### Мутации

Server actions через `createFormAction`/`createAction` + `requireCapability` + `revalidateEntity`.

```ts
// features/comments/actions.ts
"use server";
import "server-only";
import { createFormAction, parseFormData } from "@/utils/create-action";
import { requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";
import { canCreateComment } from "./permissions";
import { CommentCreateSchema } from "./schemas";

export const createComment = createFormAction(async (formData) => {
  const me = await getMe();
  const input = parseFormData(CommentCreateSchema, formData);
  requireCapability(me, canCreateComment);
  const api = await createApiClient();
  const { data, error } = await api.POST("/comments", { body: input });
  if (error) throw new Error(error.message);
  revalidateEntity("comments");
  return data;
});
```

### Формы (client islands)

Base UI `Form` + `useActionState`. Контролы Base UI клиентские, поэтому форма целиком — client component.

```tsx
// features/comments/ui/comment-create-form.tsx
"use client";
import { Form } from "@base-ui/react/form";
import { useActionState } from "react";
import { FormField, SubmitButton } from "@/components/ui";
import { createComment } from "../actions";

export function CommentCreateForm({ lectureId }: { lectureId: string }) {
  const [state, action] = useActionState(createComment, { success: true, data: undefined });
  const fieldErrors = !state.success ? state.fieldErrors ?? {} : {};

  return (
    <Form action={action} errors={fieldErrors}>
      <input type="hidden" name="lecture_id" value={lectureId} />
      <FormField name="text" label="Комментарий">
        <textarea name="text" />
      </FormField>
      {!state.success && state.code === "forbidden" && (
        <p role="alert">У вас нет прав на добавление комментария.</p>
      )}
      <SubmitButton>Отправить</SubmitButton>
    </Form>
  );
}
```

### Поиск/фильтры/пагинация

Только через URL `searchParams`. Server component читает их, делает fetch, рендерит. Клиентский UI обновляет URL: `<Link>` для пагинации, `useRouter().push()` для фильтров (единственное место для client island в табличных view).

### Инвалидация кеша

Только через `revalidateTag` (не `revalidatePath`) — теги стабильнее при перепланировке роутов. В `unstable_cache` для list-fetchers ставим `["<entity>"]`, для item — `["<entity>:${id}"]`.

## Политика конфликт-зон

| Зона | Кто пишет | Правило |
|---|---|---|
| `src/api/schema.ts` | Foundation update PR | Регенерация `npm run generate:api` только координированно. Если бекенд меняется во время фичи — отдельный PR обновляет схему до старта/продолжения фичи. |
| `src/app/admin/layout.tsx` (sidebar) | Foundation PR | Все ожидаемые пункты заводятся сразу. Видимость гейтится `canX(me)`. Агенты не трогают. |
| `src/app/layout.tsx`, providers, `globals.css` | Foundation PR | Заморожены. Изменения — отдельный PR. |
| `src/components/ui/*` | Foundation PR + foundation update | Существующие — менять только координированно. Новые — добавление нового файла можно в фиче-PR, но при риске коллизии с другой фичей лучше через update PR. |
| `src/components/{shared, app, permission, ...}` | Foundation PR | Заморожены после foundation. |
| `src/utils/*`, `src/hooks/*`, `src/services/*` | Foundation update PR | Изменения — координированные. |
| `package.json`, `package-lock.json` | Foundation update PR | Новые зависимости — только координированно. |
| `src/app/<entity>/...`, `src/app/admin/<entity>/...` | Один агент-владелец | Каждая сущность = свой подкаталог `app/`. Конфликтов нет по построению. |
| `src/features/<entity>/*` | Один агент-владелец | Полностью принадлежит одному агенту. |

**Главный принцип:** при параллельной работе агент пишет **только** в свой `features/<entity>/` и в свой `app/<entity>/...`. Любые изменения shared — отдельный coordinated PR.

## ESLint guardrails

```js
// eslint.config.mjs (фрагмент)
{
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        { group: ["@/features/*/!(index)", "@/features/*/*/**"],
          message: "Импортируй фичу через её index.ts" },
      ],
    }],
  },
  overrides: [
    {
      files: ["src/features/*/**"],
      rules: {
        "no-restricted-imports": ["error", {
          patterns: [{ group: ["@/features/*"],
            message: "Cross-feature импорты запрещены — данные ходят через бекенд" }],
        }],
      },
    },
    {
      files: ["src/features/*/api.ts", "src/features/*/actions.ts", "src/features/*/permissions.ts"],
      rules: {
        "no-restricted-imports": ["error", {
          paths: [{ name: "react-dom/client", message: "Этот файл server-only" }],
        }],
      },
    },
  ],
}
```

Плюс runtime-защита: в каждом `api.ts`/`actions.ts`/`permissions.ts` — `import "server-only";` первой строкой.

## Тесты

**Стек:** Vitest + jsdom + Zod.

**Что покрываем (обязательно для каждой фичи):**

1. **`features/<X>/permissions.ts`** — каждая `canXxx` тестируется на матрице ролей/статусов/ownership. RBAC-регрессии = security bug, поэтому тесты обязательны при code review.
2. **`features/<X>/schemas.ts`** — каждая Zod-схема имеет хотя бы 1 тест на success + 1 на failure. Помогает не разойтись с серверной схемой Go.
3. **`utils/`** — `create-action.ts` (особенно `parseFormData`), `revalidate.ts`, `permissions.ts`. Один раз в foundation, дальше живут.

**Что не покрываем на старте:**

- UI-компоненты (server и client) — App Router server components в Vitest тестировать дорого.
- API-фетчеры — тонкая обёртка над openapi-fetch, тестировать нечего.
- Server actions целиком — мокать `cookies()`, `revalidateTag`, openapi-fetch дорого; правильность гарантируется тестами permissions + schemas + типизацией.
- E2E — на старте нет. Поднимем (Playwright + docker-compose) отдельной инициативой при необходимости.

**Конвенция размещения:** `*.test.ts` рядом с тестируемым файлом (не в отдельной `__tests__/`).

**Скрипты в `package.json`:**

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

**CI gate:** `npm run lint && npm run test && npm run build` — должно зелёным проходить перед мержем.

## Состав foundation PR

Делается один раз последовательно перед открытием параллельной работы.

1. **Регенерация API-схемы** — `npm run generate:api` (свежая `src/api/schema.ts`).
2. **Расширение `src/utils/`** — `create-action.ts` (`fieldErrors` + `parseFormData`), `revalidate.ts` (новый), `src/api/tags.ts` (новый).
3. **UI-kit `src/components/ui/`** — примитивы из таблицы выше. Под env-флагом — smoke-страничка `app/_dev/ui/page.tsx` для визуальной проверки (удаляется после foundation).
4. **App layout и navigation** — финализированный `src/app/layout.tsx` с `<Toaster />`. `src/app/admin/layout.tsx` с сайдбаром, заранее содержащим все пункты админки, гейтнутые `canX(me)`.
5. **ESLint guardrails** — обновление `eslint.config.mjs` с правилами выше; шаблон файлов слайса включает `import "server-only";`.
6. **Vitest setup** — `vitest.config.ts`, скрипты в `package.json`, зависимости (`vitest`, `@vitest/coverage-v8`, `jsdom`, `zod`), 1 канареечный тест на `parseFormData`.
7. **Удаление сломанных страниц** — `src/app/admin/lectures/`, `src/app/admin/comments/`, `src/app/admin/annotations/`, `src/app/admin/users/` и т.п. с битыми импортами удаляются. Роуты заводятся заново в фиче-PR.
8. **Документация конвенций** — `docs/frontend-conventions.md` (или дополнение к `CLAUDE.md`): шаблон слайса, правила импортов, паттерны данные/мутации/формы, обязательные тесты. Один файл, который агент читает в начале своего worktree.
9. **Шаблон слайса** — `features/_template/` с заглушками файлов (`index.ts`, `api.ts`, `actions.ts`, `permissions.ts`, `schemas.ts`, `types.ts`, `ui/`). Агент копирует и заменяет содержимое.

## Worktree workflow

1. Foundation PR смержён в `main`.
2. На каждую фичу — отдельный worktree (`git worktree add ../philosophy-comments -b feat/comments`).
3. Агент в воркт ри:
   - читает `docs/frontend-conventions.md`,
   - копирует `features/_template/` в `features/<entity>/`,
   - реализует `api`, `actions`, `permissions`, `schemas`, `ui`,
   - добавляет тесты для permissions и schemas,
   - заводит роуты в `app/<entity>/` и `app/admin/<entity>/`,
   - локально гоняет `npm run lint && npm run test && npm run build`.
4. PR в `main`. Code review (опционально через `superpowers:requesting-code-review`).
5. Если по ходу фичи нужны изменения в shared — отдельный foundation update PR. После мержа агент делает `git merge origin/main` в воркт ри.
6. После мержа любой фичи — остальные агенты подтягивают `main`.

**Конфликтов по построению нет**, кроме трёх индикаторов нарушения правил: `app/admin/layout.tsx`, `package-lock.json`, `schema.ts`. Если такой файл изменён в фиче-PR — это сигнал code review остановиться и переоформить как foundation update.

Уже зафиксировано в `CLAUDE.md`:

- запрет деструктивных git-операций (`stash`, `reset`, `checkout .`, `clean`),
- запрет `git add -A` / `git add .`,
- передача этих требований субагентам.

## Out of scope этого дизайна

- Конкретный список фич и их приоритет (это план следующей итерации).
- Playwright e2e-тесты (поднимем отдельной инициативой при необходимости).
- Storybook / визуальное тестирование UI-kit'а.
- Развитый DataTable (сортировка/фильтры/выбор строк) — поднимется в `components/ui/` по правилу "extract on second use".
- Replicate/Combobox/DatePicker/FileUpload — добавятся в UI-kit при первом реальном кейсе.
- Server actions для ситуаций без формы (button-triggered) — обработаются через обычный `createAction` без расширения паттерна.
