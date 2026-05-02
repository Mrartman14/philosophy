# Дизайн фичи «Глоссарий» (фронтенд)

**Дата:** 2026-05-02
**Статус:** Approved
**Скоуп:** Один PR — admin CRUD + публичные read-only страницы + shared AST-рендер.

---

## 1. Цель и скоуп

Сделать на фронте полный потребительский путь работы с глоссарием:

- Админу — создавать, редактировать (только тело, AST-блоки), удалять термины.
- Гостям и активным пользователям — читать список терминов и страницу отдельного термина.
- Заодно вынести в shared переиспользуемый read-only AST-рендер, который пригодится во многих местах фронта (лекции, документы, баннеры).

Не входит в этот PR (явно отложено):

- `POST /api/glossary/suggest` — подсветка терминов в чужих текстах.
- История ревизий (`GET /api/glossary/{id}/revisions`).
- Popover для mark `glossary_ref` в текстах лекций (контракт-точка расширения заложена в `AstRender`, но реализация — отдельный PR).
- Группировка списка по первой букве.
- Markdown / .txt экспорт.

---

## 2. Контекст и предпосылки

**Бэкенд** (`internal/glossary/`) уже полностью реализован:

- `Term { id, title, blocks (AST), created_at, updated_at }`.
- `GET /api/glossary?offset&limit&q` — list (доступ без auth).
- `GET /api/glossary/{id}` — single.
- `POST /api/admin/glossary` — create (cap `glossary.create`). Тело: `{ title (1..300), blocks (1..400) }`. Блоки **должны идти с пустыми ID** (бэк сам генерит UUID).
- `PUT /api/admin/glossary/{id}/blocks` — update тела (cap `glossary.update`). Bulk-replace blocks. **Title immutable после создания (инвариант I4).**
- `DELETE /api/admin/glossary/{id}` — delete (cap `glossary.delete`).

Domain-error коды на update / delete:

- 422 `BLOCKS_EMPTY`, `BLOCKS_INVALID`, `BLOCK_ID_UNKNOWN`, `DUPLICATE_BLOCK_ID`, `REF_NOT_FOUND`.
- 409 `BLOCKS_HAVE_ANCHORS`, `BLOCK_REFERENCED`.

**Фронт** уже содержит:

- `src/features/lectures/` — образец слайса CRUD-фичи с AST-телом.
- `src/components/ast-editor/` — TipTap-редактор. Поддерживает `editable={false}`, но визуально через `opacity-50 pointer-events-none` (для read-only страниц не годится).
- `src/components/ast-editor/pickers/glossary-picker.tsx` + action `searchGlossary` — для вставки `glossary_ref` mark в редакторе. Этот код **не трогаем**.
- В RBAC уже есть `glossary.create | glossary.update | glossary.delete`.
- `_template/` слайс — стартовая точка по конвенции (`docs/frontend-conventions.md`).

---

## 3. Общая архитектура

PR делится на три зоны, каждая верифицируется независимо:

### 3.1. Зона A — shared infrastructure (foundation)

- `src/components/ast-render/` — новый read-only AST→JSX server-component рендерер.
- `src/api/tags.ts` — добавить константу `GLOSSARY: "glossary"`.
- `src/utils/permissions.ts` (`Capability` union) — добавить `"glossary.create" | "glossary.update" | "glossary.delete"`. Без этого `can(me, "glossary.create")` не компилируется (тип уже на фронте, бэк отдаёт capability-строку, фронт сужает через TS-union для type-safety).
- `src/app/admin/layout.tsx` (`buildNavItems`) — пункт «Глоссарий», гейт по any-of `glossary.create|update|delete`. Помечается отдельным коммитом «foundation update».

### 3.2. Зона B — слайс `src/features/glossary/`

Стандартная структура по `_template`. Подробности — раздел 5.

### 3.3. Зона C — pages

- Публичные: `src/app/glossary/page.tsx`, `src/app/glossary/[id]/page.tsx`.
- Админские: `src/app/admin/glossary/page.tsx`, `src/app/admin/glossary/[id]/edit/page.tsx`.

**Запретные зоны.** Из списка `frontend-conventions.md` §6 в этом PR трогаются осознанно:

- `src/app/admin/layout.tsx` (расширение `buildNavItems`) — foundation update в этом же PR (не просто хак, а штатная точка для регистрации новой фичи).

Не трогаются: `src/api/schema.ts`, root layout, `globals.css`, `package.json`, `eslint.config.mjs`, `src/components/ui/*`.

---

## 4. AST-рендер (`src/components/ast-render/`)

### 4.1. Решение: server-component без ProseMirror

Не используем `<AstEditor editable={false}>` на read-only страницах. Вместо этого — отдельный shared server-component, который мапит `ast.Block[]` → JSX напрямую.

**Почему так:**

- **SSR + SEO.** Публичные страницы отдаются HTML-ом без TipTap-бандла (~200 kb). Ожидается, что компонент пойдёт в публичные страницы лекций / документов / баннеров.
- **Никаких визуальных компромиссов** (`opacity-50 pointer-events-none`).
- **Нет нужды в общих хуках с редактором.** Единственное общее — TS-типы из `@/api/schema` (`ast.Block`). Логика редактора (TipTap extensions, NodeView'ы) — для редактирования; логика рендера — статический маппинг.
- **Контроль drift'а** — round-trip тесты на фикстурах + exhaustive switch по `block.type`.

### 4.2. Структура

```text
src/components/ast-render/
  ast-render.tsx         # <AstRender blocks ctx?> — server component
  block-renderer.tsx     # switch по block.type → JSX
  inline-renderer.tsx    # text-runs + marks
  marks/
    link.tsx
    glossary-ref.tsx
    lecture-ref.tsx
    document-ref.tsx
  nodes/
    image.tsx
  types.ts
  ast-render.test.tsx
  __fixtures__/
    blocks.ts
  index.ts
```

### 4.3. Public API

```ts
// src/components/ast-render/index.ts
export { AstRender } from "./ast-render";
export type { AstRenderProps, AstRenderContext, RefLinkRenderer } from "./types";
```

```ts
// types.ts
export interface AstRenderProps {
  blocks: ast.Block[];
  ctx?: AstRenderContext;
}

export interface AstRenderContext {
  /** Override how `glossary_ref` mark is rendered. Default: <a href="/glossary/{id}">{label}</a> */
  renderGlossaryRef?: RefLinkRenderer;
  renderLectureRef?: RefLinkRenderer;
  renderDocumentRef?: RefLinkRenderer;
}

export type RefLinkRenderer = (props: { id: string; label: string }) => React.ReactNode;
```

В этом PR используются только дефолты. Контракт `ctx` нужен сразу, чтобы будущая интеграция в страницы лекций (popover для `glossary_ref`) делалась без правок shared-компонента.

### 4.4. Поддерживаемый набор в первой итерации

Целевой набор (точные имена сверить при реализации с OpenAPI `ast.Block` и `ast.MarkType` — известно, что `MarkType` включает `bold | italic | code | link | glossary_ref | lecture_ref | document_ref | comment_ref | media_ref | canvas_ref`):

| Блоки | Marks | Nodes |
| --- | --- | --- |
| `paragraph` | `bold` | `image` (server `<img>`) |
| `heading` (level 1..6) | `italic` | |
| списки (bullet/ordered/item) | `code` | |
| `code_block` | `link` | |
| | `glossary_ref`, `lecture_ref`, `document_ref` | |

**Не поддерживается** в этом PR (fallback — рендер plain text + `data-unsupported` атрибут + `console.warn` в dev): `comment_ref`, `media_ref`, `canvas_ref` marks; canvas / media nodes если такие есть. Это не «дыра» — `<AstRender>` корректно отрисует текст, просто не подсветит / не залинкует неподдержанный mark. Терминам глоссария они и не нужны.

### 4.5. Защита от drift'а

- `block-renderer.tsx` — exhaustive switch с `block satisfies never` в default. Появление нового типа в схеме → TS-ошибка компиляции.
- Snapshot-тесты на фикстурах `__fixtures__/blocks.ts` через `AstRender` → snapshot DOM.
- Сравнение с `AstEditor` через ProseMirror в jsdom **сознательно не делаем**: монтаж TipTap в Vitest флейкий, а exhaustive switch + snapshot уже закрывают регрессии типов и разметки. Если drift всплывёт в ручной приёмке — добавим точечный тест.

### 4.6. Безопасность

- Никакого `dangerouslySetInnerHTML`. Любой текст → React-children (auto-escape).
- `link.href` валидируется: разрешены только `http(s):` и относительные `/...`. Невалидный `href` → mark рендерится как plain text.
- `glossary_ref` / `lecture_ref` / `document_ref` с пустым `id` → plain text.

---

## 5. Слайс `src/features/glossary/`

### 5.1. Структура

```text
src/features/glossary/
  index.ts
  api.ts
  actions.ts
  permissions.ts
  schemas.ts
  types.ts
  permissions.test.ts
  schemas.test.ts
  ui/
    glossary-list.tsx
    glossary-search-form.tsx
    glossary-detail.tsx
    glossary-admin-row.tsx
    glossary-create-form.tsx
    glossary-edit-form.tsx
    glossary-delete-button.tsx
```

### 5.2. types.ts

```ts
import type { components } from "@/api/schema";
export type Term = components["schemas"]["glossary.Term"];
```

### 5.3. api.ts

```ts
import "server-only";
import { cache } from "react";
import { createApiClient } from "@/api/client";
import type { Term } from "./types";

export interface TermListFilter { q?: string; offset?: number; limit?: number }
export interface TermListResult { items: Term[]; total: number; offset: number; limit: number }

export const getTerms = cache(async (filter: TermListFilter = {}): Promise<TermListResult> => {
  /* ... */
});

export const getTermById = cache(async (id: string): Promise<Term | null> => {
  // 404 → null, остальные ошибки → throw
});
```

Cache теги: `glossary` для list, `glossary:<id>` для item. Расширяем `src/api/tags.ts`.

### 5.4. permissions.ts

```ts
import "server-only";
import type { MaybeMe } from "@/utils/me";
import { can } from "@/utils/permissions";

export function canCreateTerm(me: MaybeMe): boolean { return can(me, "glossary.create"); }
export function canUpdateTerm(me: MaybeMe): boolean { return can(me, "glossary.update"); }
export function canDeleteTerm(me: MaybeMe): boolean { return can(me, "glossary.delete"); }
```

Owner-логики нет — у термина нет `owner_id` (на бэке — глобальная capability, не per-resource).

### 5.5. schemas.ts

```ts
import "server-only";
import { z } from "zod";

export const TermCreateSchema = z.object({
  title: z.string().trim().min(1, "Введите название").max(300, "До 300 символов"),
});

export const TermBlocksUpdateSchema = z.object({
  id: z.string().uuid("Некорректный id термина"),
  blocks: z
    .string()
    .min(1, "Тело не может быть пустым")
    .transform((s, ctx) => {
      try {
        const parsed = JSON.parse(s);
        if (!Array.isArray(parsed)) throw new Error("not array");
        return parsed as unknown[];
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Битый JSON в теле формы" });
        return z.NEVER;
      }
    }),
});

export const TermIdSchema = z.object({
  id: z.string().uuid("Некорректный id термина"),
});
```

`blocks` приходит из формы как сериализованный JSON (см. §5.7 — паттерн `AstEditor` + hidden input). Schema парсит JSON в `transform` и сама ловит битый JSON как `fieldErrors.blocks`. Тяжёлую AST-валидацию (структура, ID-инварианты, ссылки) делает бэк.

### 5.6. actions.ts

```ts
"use server";
import "server-only";
import { createApiClient } from "@/api/client";
import { createAction, createFormAction, parseFormData } from "@/utils/create-action";
import { getMe } from "@/utils/me";
import { ForbiddenError, requireCapability } from "@/utils/permissions";
import { revalidateEntity } from "@/utils/revalidate";
import { canCreateTerm, canUpdateTerm, canDeleteTerm } from "./permissions";
import { TermCreateSchema, TermBlocksUpdateSchema, TermIdSchema } from "./schemas";
import type { Term } from "./types";

type ApiError = { code?: string; error?: string };

function rethrowApiError(err: ApiError | undefined): never {
  if (err?.code === "forbidden") throw new ForbiddenError("role", err.error);
  switch (err?.code) {
    case "BLOCKS_EMPTY": throw new Error("Тело термина не может быть пустым.");
    case "BLOCKS_HAVE_ANCHORS": throw new Error("Нельзя удалить блок с привязанными комментариями. Удалите комментарии или оставьте блок.");
    case "BLOCK_REFERENCED": throw new Error("На блок ссылаются другие материалы. Удалите ссылки или оставьте блок.");
    case "REF_NOT_FOUND": throw new Error("Одна из ссылок указывает на несуществующий объект.");
  }
  throw new Error(err?.error ?? "Ошибка сервера");
}

export const createTerm = createFormAction(async (formData) => {
  const me = await getMe();
  const input = parseFormData(TermCreateSchema, formData);
  requireCapability(me, canCreateTerm);
  const api = await createApiClient();
  const { data, error } = await api.POST("/api/admin/glossary", {
    body: { title: input.title, blocks: [/* пустой paragraph-stub, форма по фикстуре */] },
  });
  if (error) rethrowApiError(error);
  revalidateEntity("glossary");
  return (data?.data ?? null) as Term | null;
});

export const updateTermBlocks = createFormAction(async (formData) => {
  const me = await getMe();
  const input = parseFormData(TermBlocksUpdateSchema, formData);
  requireCapability(me, canUpdateTerm);
  const api = await createApiClient();
  const { data, error } = await api.PUT("/api/admin/glossary/{id}/blocks", {
    params: { path: { id: input.id } },
    body: { blocks: input.blocks }, // schema уже распарсила JSON
  });
  if (error) rethrowApiError(error);
  revalidateEntity("glossary", input.id);
  revalidateEntity("glossary");
  return (data?.data ?? null) as Term | null;
});

export const deleteTerm = createAction(async (rawId: string) => {
  const me = await getMe();
  const { id } = TermIdSchema.parse({ id: rawId });
  requireCapability(me, canDeleteTerm);
  const api = await createApiClient();
  const { error } = await api.DELETE("/api/admin/glossary/{id}", {
    params: { path: { id } },
  });
  if (error) rethrowApiError(error);
  revalidateEntity("glossary");
  return undefined;
});
```

**Двухстадийное создание.** `createTerm` после успеха возвращает `Term | null`. Редирект на `/admin/glossary/[id]/edit` делает client-форма по `useEffect(() => { if (state.success && state.data) router.replace(...) })` — паттерн `lectures`, чтобы не словить `redirect()` внутри `createFormAction`.

**Точная форма пустого `paragraph`-stub** сверится при реализации с `src/components/ast-editor/__fixtures__/sample-blocks.ts` и Go-структурой `ast.Block` (важно: `id` шлём как `""`, бэк сам генерит UUID — см. invariant из `request.go`).

### 5.7. UI-компоненты

| Файл | Роль | server / client |
| --- | --- | --- |
| `glossary-list.tsx` | Публичный список, ссылки на `/glossary/[id]` | server |
| `glossary-search-form.tsx` | Форма `?q=` через `router.replace` | client |
| `glossary-detail.tsx` | Публичная детальная: `<h1>{title}</h1>` + `<AstRender>` + дата | server |
| `glossary-admin-row.tsx` | Строка в `/admin/glossary` с булевыми пропами `canEdit`, `canDelete` | server |
| `glossary-create-form.tsx` | Title + submit; редирект на edit по успеху | client |
| `glossary-edit-form.tsx` | Обёртка `<AstEditor defaultValue={blocks}>` + submit (см. ниже) | client |
| `glossary-delete-button.tsx` | `ConfirmDialog` + try/catch + toast + redirect на `/admin/glossary` | client |

**Паттерн «AstEditor в форме» — новый для проекта.** В `lectures` редактируются только `title/description/date` (string-поля); тело AST там не редактируется. AstEditor сейчас используется только в `dev/ui` smoke-странице. Значит, в этом PR придётся придумать и закрепить паттерн интеграции AstEditor с server action. Базовая идея:

```tsx
"use client";
export function GlossaryEditForm({ term }: { term: Term }) {
  const [blocks, setBlocks] = useState<ast.Block[]>(term.blocks ?? []);
  const [state, action] = useActionState(updateTermBlocks, { success: true, data: undefined });
  return (
    <Form action={action}>
      <input type="hidden" name="id" value={term.id} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
      <AstEditor defaultValue={term.blocks ?? []} onChange={setBlocks} />
      <SubmitButton>Сохранить</SubmitButton>
    </Form>
  );
}
```

Открытые вопросы при имплементации (зафиксированы в §8):

- Точная сигнатура `AstEditor.onChange` (массив блоков или сырое ProseMirror state).
- Поведение при `JSON.stringify` больших AST (есть ли там циклы / non-serializable).
- Reset формы / dirty-state / disable submit при отсутствии изменений — на первом этапе можно опустить.

### 5.8. index.ts (public API наружу)

```ts
export { getTerms, getTermById } from "./api";
export { createTerm, updateTermBlocks, deleteTerm } from "./actions";
export { canCreateTerm, canUpdateTerm, canDeleteTerm } from "./permissions";
export {
  GlossaryList, GlossarySearchForm, GlossaryDetail,
  GlossaryAdminRow, GlossaryCreateForm, GlossaryEditForm, GlossaryDeleteButton,
} from "./ui";
export type { Term } from "./types";
```

---

## 6. Pages

### 6.1. Публичные

`src/app/glossary/page.tsx` (server):

```ts
interface Props { searchParams: Promise<{ q?: string; offset?: string }> }
export default async function GlossaryIndexPage({ searchParams }: Props) {
  const { q, offset } = await searchParams;
  const result = await getTerms({ q, offset: offset ? Number(offset) : 0, limit: 50 });
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold">Глоссарий</h1>
      <GlossarySearchForm defaultQ={q ?? ""} />
      <GlossaryList items={result.items} total={result.total} />
    </main>
  );
}
export const metadata = { title: "Глоссарий" };
```

Никаких capability-чеков: страница доступна гостям.

`src/app/glossary/[id]/page.tsx` (server) — `getTermById` → `notFound()` или `<GlossaryDetail term={term} />`.

Сортировка — алфавитная по `title`. Фронт всегда сортирует `result.items` на сервере перед рендером (один проход), независимо от того, что отдаёт бэк — это идемпотентно и убирает зависимость от незафиксированного контракта list-эндпойнта.

### 6.2. Админские

`src/app/admin/glossary/page.tsx` (server):

- Layer-3 гейт: `if (!canCreateTerm(me) && !canUpdateTerm(me) && !canDeleteTerm(me)) forbidden();`
- Рендер: `<GlossaryCreateForm />` если `canCreateTerm`, `<GlossarySearchForm />`, список `<GlossaryAdminRow>` с пропами `canEdit / canDelete`.

`src/app/admin/glossary/[id]/edit/page.tsx` (server):

- Layer-3 гейт: `if (!canUpdateTerm(me) && !canDeleteTerm(me)) forbidden();`
- `getTermById` → `notFound()` если `null`.
- Title рендерится как plain text (не `<input disabled>` — у поля нет смысла существовать в форме).
- `<GlossaryEditForm term={term} />` если `canUpdateTerm`.
- `<GlossaryDeleteButton id={term.id} />` если `canDeleteTerm` (вне формы редактирования blocks).

### 6.3. Sidebar update

В `buildNavItems` (`src/app/admin/layout.tsx`):

```ts
if (can(me, "glossary.create") || can(me, "glossary.update") || can(me, "glossary.delete")) {
  items.push({ href: "/admin/glossary", label: "Глоссарий" });
}
```

Помечается отдельным коммитом в этом PR: `feat(glossary): foundation update — admin sidebar entry`.

---

## 7. Тесты

### 7.1. Юнит-тесты (Vitest, обязательно зелёные)

`src/features/glossary/permissions.test.ts`:

- `canCreateTerm | canUpdateTerm | canDeleteTerm`: гость → false, suspended → false, active без cap → false, active с cap → true. Минимум один success + один failure на хелпер.

`src/features/glossary/schemas.test.ts`:

- `TermCreateSchema`: ok (валидный title), fail (пустой, >300 символов).
- `TermBlocksUpdateSchema`: ok, fail (битый uuid, пустой blocks).
- `TermIdSchema`: ok, fail.

`src/components/ast-render/ast-render.test.tsx`:

- Рендер каждой фикстуры из `__fixtures__/blocks.ts` через `AstRender` → snapshot.
- Документирующий `// @ts-expect-error` тест на exhaustive switch.
- Безопасность: `link` mark с `href="javascript:..."` → plain text.
- Ref-marks с пустым `id` → plain text.
- Drift с редактором: тот же AST через `AstEditor` deserializer + ProseMirror-DOM, сравнение семантики (теги, текст, href'ы) через `data-testid`-якоря.

### 7.2. Что не тестим юнитами (по `frontend-conventions.md` §5)

- UI-компоненты (`*.tsx`).
- Server actions (требуют интеграции).
- API-клиент.

### 7.3. Acceptance — вручную перед PR

1. **Гость**: `/glossary` ок, `/glossary/[id]` ок, `/admin/glossary` → forbidden.
2. **Active user без glossary-cap**: `/admin/glossary` → forbidden.
3. **Admin с `glossary.create + update + delete`**:
   - В sidebar появился пункт «Глоссарий».
   - Создание термина (title only) → редирект на edit.
   - На edit: title как plain text, AST-редактор с одним пустым параграфом, набор и сохранение.
   - Перечитка edit-страницы — изменения видны.
   - На публичной `/glossary/[id]` — то же тело отрендерено через `AstRender`.
   - Поиск `?q=` фильтрует список (admin + public).
   - Удаление → ConfirmDialog → успех → редирект на `/admin/glossary`.
   - Domain-ошибка: попытка удалить блок с external content_ref → понятное сообщение «На блок ссылаются другие материалы…».
4. `npm run lint && npm test && npm run build` — зелёные.

---

## 8. Риски и нерешённое

- **Паттерн «AstEditor в форме» — новый.** В проекте AstEditor сейчас не используется в реальных страницах (только smoke `dev/ui`). Этот PR закрепляет паттерн: hidden input с `JSON.stringify(blocks)`, синхронизация через локальный state. Если в процессе выяснится, что AstEditor.onChange отдаёт несериализуемое или несовместимое с целевым форматом представление — придётся править интерфейс компонента или сделать тонкую обёртку. Заложен буфер времени.
- **Точная форма пустого `paragraph`-stub** для `createTerm` — определяется при реализации (фикстура `src/components/ast-editor/__fixtures__/sample-blocks.ts` + Go-модель `internal/ast`). Известно: `id` шлём как `""` (бэк генерит UUID).
- **Набор block-типов и mark-типов в §4.4** указан целевым; точные имена/наличие списков и code_block в `ast.Block` сверяются при реализации с актуальной OpenAPI-схемой.
- **Сортировка list-эндпойнта** — формально не зафиксирована в OpenAPI; решено всегда сортировать на фронте перед рендером (см. §6.1).
- **Drift `AstRender` ↔ `AstEditor`** закрывается exhaustive switch'ем + snapshot'ами. В первой версии набор поддерживаемых block/mark-типов в `AstRender` меньше, чем в редакторе — фоллбек на plain text безопасен, в dev-режиме `console.warn` помогает ловить регрессии раньше тестов.
- **Размер бандла на edit-странице.** `AstEditor` уже есть как зависимость; добавление одной точки использования не тянет новых тяжёлых пакетов. Публичная детальная страница `AstEditor` не использует — только `AstRender` (server-only).

---

## 9. Чеклист PR

- [ ] `src/components/ast-render/` создан, тесты проходят.
- [ ] `src/api/tags.ts` расширен `GLOSSARY`.
- [ ] `src/utils/permissions.ts::Capability` расширен `glossary.*` (foundation update коммит).
- [ ] Слайс `src/features/glossary/` создан из `_template`, README-чеклист пройден.
- [ ] Pages созданы (4 шт.), Layer-3 гейты работают.
- [ ] Sidebar обновлён отдельным коммитом «foundation update».
- [ ] Юнит-тесты зелёные.
- [ ] Acceptance-сценарии (раздел 7.3) пройдены вручную.
- [ ] `npm run lint && npm test && npm run build` зелёные.
- [ ] Запретные зоны не затронуты, кроме осознанной правки `admin/layout.tsx`.
