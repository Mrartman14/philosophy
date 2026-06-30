# Формы как тип вложения лекции — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать `form` четвёртым полноправным типом вложения лекции — read-only список форм со ссылками на публичной странице лекции и attach/detach/reorder форм на странице редактирования (зеркало canvas-паттерна).

**Architecture:** Зеркалим существующий путь `canvas`: новый эндпоинт `GET /api/lectures/{id}/forms` → лёгкий листинг `form.Form[]` с `is_entry`; компонент-список со ссылками на `/forms/{id}`. На стороне владельца — третий `LectureAttachmentsManager` через generic-панель привязок. Видимость форм — ответственность бэка; FE рендерит, что вернул эндпоинт.

**Tech Stack:** Next.js (App Router, server components + server actions), TypeScript, Zod, vitest + @testing-library/react, next-intl (i18n за фасадом `@/i18n`), openapi-typescript (`src/api/schema.ts`).

## Global Constraints

- Общение и UI-копирайт — русский; реальные строки только через i18n-каталоги (`src/i18n/messages/<locale>/<namespace>.ts`), 4 локали ru/en/ar/zh обязаны иметь идентичный набор ключей (enforced `messages.test.ts`); псевдо `en-XA` генерируется автоматически — не трогать.
- Имена файлов в `src/` — kebab-case.
- НЕ трогать `src/api/schema.ts` (уже перегенерирован пользователем), `src/components/ui/*`, `src/components/attachments/*` (generic-панель достаточно гибкая), `src/app/layout.tsx`/глобальные shell-файлы.
- Параллельные агенты: НИКАКИХ `git stash/reset/checkout .`/`clean`, НЕ `git add -A`/`git add .` — добавлять только перечисленные в задаче файлы по имени. Передать это требование любым субагентам.
- RBAC без изменений: attach/detach/reorder owner-only через существующие `canAttachToLecture`/`canManageAttachments`; форма проходит те же гейты.
- Перед финалом зелёные: `pnpm lint && pnpm test && pnpm build`. Тулчейн — **pnpm** (не npm).
- Спека: `docs/superpowers/specs/2026-06-30-lecture-form-attachments-design.md`.

---

### Task 1: Чиним сборку — drift-гард + Zod-схемы принимают `form`

Реген добавил `"form"` в `AttachmentEntityType`, из-за чего `satisfies Record<AttachmentEntityType, true>` в `schemas.ts` не компилируется. Это TDD-точка: тест на приём `entity_type:"form"` падает (z.enum строится из ключей `ENTITY_TYPE_SET`, где `form` пока нет), добавление `form: true` чинит и тест, и сборку.

**Files:**
- Modify: `src/features/lectures/schemas.test.ts:201-250` (расширить наборы на `form`)
- Modify: `src/features/lectures/schemas.ts:89-93` (`form: true`)

**Interfaces:**
- Consumes: ничего нового.
- Produces: `ENTITY_TYPE_SET` теперь покрывает `document|media|canvas|form`; `makeLectureAttachSchema/Detach/Reorder` принимают `entity_type:"form"`.

- [ ] **Step 1: Обновить тесты схем — добавить `form` в принимаемые значения**

В `src/features/lectures/schemas.test.ts` замени массив в тесте «принимает document/media/canvas» (строка ~202-203) и заголовок:

```ts
  it("принимает document/media/canvas/form", () => {
    for (const t of ["document", "media", "canvas", "form"] as const) {
      const r = LectureAttachSchema.safeParse({
        lecture_id: "550e8400-e29b-41d4-a716-446655440000",
        entity_id: "11111111-1111-1111-1111-111111111111",
        entity_type: t,
      });
      expect(r.success).toBe(true);
    }
  });
```

И добавь отдельный кейс в `describe("LectureDetachSchema")` (после существующего «принимает валидную тройку»):

```ts
  it("принимает entity_type=form", () => {
    const r = LectureDetachSchema.safeParse({
      lecture_id: "550e8400-e29b-41d4-a716-446655440000",
      entity_id: "11111111-1111-1111-1111-111111111111",
      entity_type: "form",
    });
    expect(r.success).toBe(true);
  });
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm exec vitest run src/features/lectures/schemas.test.ts -t "form"`
Expected: FAIL — `form` отклоняется (`r.success === false`), т.к. `ENTITY_TYPE_SET` пока без `form`.

- [ ] **Step 3: Добавить `form: true` в drift-гард**

В `src/features/lectures/schemas.ts` (строки 89-93):

```ts
const ENTITY_TYPE_SET = {
  document: true,
  media: true,
  canvas: true,
  form: true,
} as const satisfies Record<AttachmentEntityType, true>;
```

- [ ] **Step 4: Тесты схем зелёные + сборка-тип чинится**

Run: `pnpm exec vitest run src/features/lectures/schemas.test.ts`
Expected: PASS (все кейсы, включая `form`).
Run: `pnpm typecheck`
Expected: PASS — `satisfies Record<AttachmentEntityType, true>` больше не падает (ранее это была единственная регрессия типов от регена; если всплывут другие — зафиксировать и решить отдельной задачей).

- [ ] **Step 5: Commit**

```bash
git add src/features/lectures/schemas.ts src/features/lectures/schemas.test.ts
git commit -m "fix(lectures): drift-гард ENTITY_TYPE_SET принимает form (чинит сборку после регена)"
```

---

### Task 2: Хелпер `orderLectureForms` (entry-first)

Чистая функция-партиция: `is_entry` вперёд, стабильно; отбрасывает элементы без `id`. Близнец `order-canvases.ts`.

**Files:**
- Create: `src/features/lectures/order-forms.ts`
- Create: `src/features/lectures/order-forms.test.ts`

**Interfaces:**
- Produces: `orderLectureForms<T extends { id?: string; is_entry?: boolean }>(forms: T[]): (T & { id: string })[]`

- [ ] **Step 1: Написать падающий тест**

Create `src/features/lectures/order-forms.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { orderLectureForms } from "./order-forms";

describe("orderLectureForms", () => {
  it("ставит основную форму (is_entry) первой, сохраняя порядок остальных", () => {
    const ordered = orderLectureForms([
      { id: "a" },
      { id: "b", is_entry: true },
      { id: "c" },
    ]);
    expect(ordered.map((f) => f.id)).toEqual(["b", "a", "c"]);
  });

  it("без is_entry сохраняет исходный порядок", () => {
    const ordered = orderLectureForms([{ id: "a" }, { id: "b" }, { id: "c" }]);
    expect(ordered.map((f) => f.id)).toEqual(["a", "b", "c"]);
  });

  it("отфильтровывает элементы без id", () => {
    const ordered = orderLectureForms([{ id: "a" }, {}, { id: "b" }]);
    expect(ordered.map((f) => f.id)).toEqual(["a", "b"]);
  });

  it("несколько is_entry (дрейф контракта) — все вперёд, стабильно", () => {
    const ordered = orderLectureForms([
      { id: "a" },
      { id: "b", is_entry: true },
      { id: "c", is_entry: true },
    ]);
    expect(ordered.map((f) => f.id)).toEqual(["b", "c", "a"]);
  });

  it("пустой список → пустой", () => {
    expect(orderLectureForms([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/features/lectures/order-forms.test.ts`
Expected: FAIL — модуль `./order-forms` не найден.

- [ ] **Step 3: Реализовать хелпер**

Create `src/features/lectures/order-forms.ts`:

```ts
// src/features/lectures/order-forms.ts

/**
 * Формы лекции с основной (is_entry) первой; остальные — в исходном порядке.
 * Отбрасывает элементы без id (нечего линковать). Стабильная партиция, а не
 * sort — несколько is_entry (дрейф контракта) сохраняют взаимный порядок.
 *
 * is_entry выставляется ТОЛЬКО листингом GET /api/lectures/{id}/forms
 * («основная форма»). Лёгкий листинг — поля формы здесь не рендерятся,
 * заполнение остаётся на странице /forms/{id}.
 */
export function orderLectureForms<T extends { id?: string; is_entry?: boolean }>(
  forms: T[],
): (T & { id: string })[] {
  const withId = forms.filter((f): f is T & { id: string } => Boolean(f.id));
  const entries = withId.filter((f) => f.is_entry);
  const rest = withId.filter((f) => !f.is_entry);
  return [...entries, ...rest];
}
```

- [ ] **Step 4: Запустить — зелёный**

Run: `pnpm exec vitest run src/features/lectures/order-forms.test.ts`
Expected: PASS (5 кейсов).

- [ ] **Step 5: Commit**

```bash
git add src/features/lectures/order-forms.ts src/features/lectures/order-forms.test.ts
git commit -m "feat(lectures): хелпер orderLectureForms (entry-first, близнец orderLectureCanvases)"
```

---

### Task 3: Тип `LectureFormItem`, API `getLectureForms`, экспорты

Тонкая типизированная обвязка (cache()-врапер + тип + ре-экспорт). По соглашению слайса cache()-врапперы листингов не покрываются юнит-тестом (ср. `getLectureCanvases` — теста нет); верификация — `pnpm typecheck` и интеграция на странице (Task 8).

**Files:**
- Modify: `src/features/lectures/types.ts` (добавить `LectureFormItem`)
- Modify: `src/features/lectures/api.ts` (импорт типа + `getLectureForms`)
- Modify: `src/features/lectures/index.ts` (экспорт `getLectureForms`, тип `LectureFormItem`)

**Interfaces:**
- Consumes: `unwrap` (`@/utils/api-unwrap`), `createApiClient`, `getT`.
- Produces:
  - `type LectureFormItem = components["schemas"]["form.Form"]`
  - `getLectureForms(id: string, token?: string): Promise<LectureFormItem[]>` (404 → `[]`)

- [ ] **Step 1: Добавить тип `LectureFormItem`**

В `src/features/lectures/types.ts` после блока `LectureCanvasItem` (строка ~31):

```ts
/**
 * Форма, прикреплённая к лекции (GET /api/lectures/{id}/forms). Лёгкий листинг —
 * поля формы не рендерятся в листинге; is_entry помечает основную форму лекции
 * и выставляется только этим листингом.
 */
export type LectureFormItem = components["schemas"]["form.Form"];
```

- [ ] **Step 2: Добавить `getLectureForms` в api.ts**

В `src/features/lectures/api.ts` расширь импорт типов и добавь функцию в конец файла. Импорт (строки 9-14) — добавь `LectureFormItem`:

```ts
import type {
  Lecture,
  LectureCanvasItem,
  LectureDocument,
  LectureFormItem,
  LectureMediaItem,
} from "./types";
```

В конец файла:

```ts
/** GET /api/lectures/{id}/forms — формы лекции (лёгкий листинг). is_entry
 *  помечает основную форму. 404 → [].
 *  token (?token=) для приватных лекций через share-link. */
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

- [ ] **Step 3: Экспортировать из index.ts**

В `src/features/lectures/index.ts` добавь `getLectureForms` к экспорту функций api и `LectureFormItem` к экспорту типов (рядом с `getLectureCanvases` / `LectureCanvasItem` соответственно). Если в файле есть строки вида `getLectureCanvases,` и `LectureCanvasItem,` — добавь parallel-строки `getLectureForms,` и `LectureFormItem,`.

- [ ] **Step 4: Проверить типы**

Run: `pnpm typecheck`
Expected: PASS — `getLectureForms` типизирован, `api.loadFormsFailed` пока отсутствует в каталоге, но это строковый ключ (рантайм), tsc не падает; ключ добавим в Task 4.

- [ ] **Step 5: Commit**

```bash
git add src/features/lectures/types.ts src/features/lectures/api.ts src/features/lectures/index.ts
git commit -m "feat(lectures): тип LectureFormItem + getLectureForms (GET /api/lectures/{id}/forms)"
```

---

### Task 4: i18n-ключи для форм лекции (ru/en/ar/zh × 3 namespace)

Парити-тест требует идентичных наборов ключей во всех 4 локалях. Добавляем во все. `en-XA` (псевдо) — автоген, не трогаем. ar/zh — лучшая оценка, помечаем на вычитку носителем.

**Files:**
- Modify: `src/i18n/messages/{ru,en,ar,zh}/pages.ts` (3 ключа)
- Modify: `src/i18n/messages/{ru,en,ar,zh}/lectures.ts` (2 ключа: `searchFormPlaceholder` + `api.loadFormsFailed`)
- Modify: `src/i18n/messages/{ru,en,ar,zh}/admin.ts` (1 ключ)

**Interfaces:**
- Produces ключи: `pages.lectureFormsHeading`, `pages.lectureFormEntryBadge`, `pages.lectureFormUntitled`, `lectures.searchFormPlaceholder`, `lectures.api.loadFormsFailed`, `admin.attachmentsFormsSectionTitle`.

- [ ] **Step 1: pages.ts — рядом с `lectureCanvasUntitled` (строка ~110) во ВСЕХ 4 локалях**

ru (`src/i18n/messages/ru/pages.ts`):
```ts
  lectureFormsHeading: "Формы лекции",
  lectureFormEntryBadge: "Основная",
  lectureFormUntitled: "Без названия",
```
en (`src/i18n/messages/en/pages.ts`):
```ts
  lectureFormsHeading: "Lecture forms",
  lectureFormEntryBadge: "Primary",
  lectureFormUntitled: "Untitled",
```
ar (`src/i18n/messages/ar/pages.ts`):
```ts
  lectureFormsHeading: "نماذج المحاضرة",
  lectureFormEntryBadge: "الرئيسية",
  lectureFormUntitled: "بدون عنوان",
```
zh (`src/i18n/messages/zh/pages.ts`):
```ts
  lectureFormsHeading: "讲座表单",
  lectureFormEntryBadge: "主表单",
  lectureFormUntitled: "未命名",
```

- [ ] **Step 2: lectures.ts — `searchFormPlaceholder` рядом с `searchMediaPlaceholder`, во ВСЕХ 4 локалях**

ВНИМАНИЕ: ключ `api.loadFormsFailed` УЖЕ добавлен в Task 3 (коммит 4ed3ad77) во все 4 локали — `getT` строго типизирует ключи, без него не компилировался api.ts. НЕ добавляй его повторно (дубль/конфликт). Здесь добавляем ТОЛЬКО `searchFormPlaceholder`.

ru: `searchFormPlaceholder: "Поиск формы…",`
en: `searchFormPlaceholder: "Search form…",`
ar: `searchFormPlaceholder: "ابحث عن نموذج…",`
zh: `searchFormPlaceholder: "搜索表单…",`

- [ ] **Step 3: admin.ts — `attachmentsFormsSectionTitle` рядом с `attachmentsMediaSectionTitle`, во ВСЕХ 4 локалях**

ru: `attachmentsFormsSectionTitle: "Формы лекции",`
en: `attachmentsFormsSectionTitle: "Lecture forms",`
ar: `attachmentsFormsSectionTitle: "نماذج المحاضرة",`
zh: `attachmentsFormsSectionTitle: "讲座表单",`

- [ ] **Step 4: Парити-тест зелёный**

Run: `pnpm exec vitest run src/i18n/messages/messages.test.ts src/i18n/messages/icu-parity.test.ts`
Expected: PASS — наборы ключей ru/en/ar/zh совпадают.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/messages/ru/pages.ts src/i18n/messages/en/pages.ts src/i18n/messages/ar/pages.ts src/i18n/messages/zh/pages.ts src/i18n/messages/ru/lectures.ts src/i18n/messages/en/lectures.ts src/i18n/messages/ar/lectures.ts src/i18n/messages/zh/lectures.ts src/i18n/messages/ru/admin.ts src/i18n/messages/en/admin.ts src/i18n/messages/ar/admin.ts src/i18n/messages/zh/admin.ts
git commit -m "i18n(lectures): ключи секции форм лекции (ru/en/ar/zh; ar/zh — на вычитку)"
```

---

### Task 5: Компонент `LectureFormList` (read-only список со ссылками)

Близнец `LectureCanvasList`: секция со ссылками на `/forms/{id}`, бейдж `is_entry`, фолбэк title, token-passthrough, пустой список → `null`. Порядок — через `orderLectureForms`.

**Files:**
- Create: `src/features/lectures/ui/lecture-form-list.tsx`
- Create: `src/features/lectures/ui/lecture-form-list.test.tsx`
- Modify: `src/features/lectures/index.ts` (экспорт `LectureFormList`)

**Interfaces:**
- Consumes: `orderLectureForms` (Task 2), `LectureFormItem` (Task 3), `RouterLink` (`@/components/ui`).
- Produces: `LectureFormList(props: { forms: LectureFormItem[]; token?: string; heading: string; entryBadge: string; untitledLabel: string }): JSX.Element | null`

- [ ] **Step 1: Написать падающий тест**

Create `src/features/lectures/ui/lecture-form-list.test.tsx`:

```tsx
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LectureFormList } from "./lecture-form-list";

afterEach(cleanup);

const labels = {
  heading: "Формы лекции",
  entryBadge: "Основная",
  untitledLabel: "Без названия",
};

describe("LectureFormList", () => {
  it("ссылки на /forms/{id}; основная первой с бейджем; токен в href", () => {
    render(
      <LectureFormList
        forms={[
          { id: "f1", title: "Опрос" },
          { id: "f2", title: "Регистрация", is_entry: true },
        ]}
        token="TOK"
        {...labels}
      />,
    );
    expect(screen.getByRole("region", { name: "Формы лекции" })).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Регистрация", "Опрос"]);
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/forms/f2?token=TOK",
      "/forms/f1?token=TOK",
    ]);
    expect(screen.getByText("Основная")).toBeInTheDocument();
  });

  it("без токена — чистый href; форма без названия → фолбэк-лейбл", () => {
    render(<LectureFormList forms={[{ id: "f1" }]} {...labels} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/forms/f1");
    expect(link).toHaveTextContent("Без названия");
  });

  it("пустой список → ничего не рендерит", () => {
    const { container } = render(<LectureFormList forms={[]} {...labels} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/features/lectures/ui/lecture-form-list.test.tsx`
Expected: FAIL — модуль `./lecture-form-list` не найден.

- [ ] **Step 3: Реализовать компонент**

Create `src/features/lectures/ui/lecture-form-list.tsx`:

```tsx
// src/features/lectures/ui/lecture-form-list.tsx
import { RouterLink } from "@/components/ui";

import { orderLectureForms } from "../order-forms";
import type { LectureFormItem } from "../types";

interface Props {
  forms: LectureFormItem[];
  token?: string | undefined;
  heading: string;
  entryBadge: string;
  untitledLabel: string;
}

/**
 * Секция форм лекции: ссылки на /forms/{id}. Лёгкий листинг
 * (GET /api/lectures/{id}/forms) — поля формы не рендерятся, заполнение/отправка
 * на странице /forms/{id}. Основная форма (is_entry) первой, с бейджем.
 * token (?token=) пробрасывается для приватных лекций (share-link). Пустой
 * список → секция не рендерится.
 */
export function LectureFormList({
  forms,
  token,
  heading,
  entryBadge,
  untitledLabel,
}: Props) {
  const ordered = orderLectureForms(forms);
  if (ordered.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-label={heading}>
      <h2 className="text-lg font-semibold">{heading}</h2>
      <ul className="flex flex-col gap-2">
        {ordered.map((f) => {
          const href = token
            ? `/forms/${f.id}?token=${encodeURIComponent(token)}`
            : `/forms/${f.id}`;
          const trimmed = f.title?.trim() ?? "";
          return (
            <li key={f.id} className="flex items-center gap-2">
              <RouterLink href={href} className="text-(--color-link) hover:underline">
                {trimmed.length > 0 ? trimmed : untitledLabel}
              </RouterLink>
              {f.is_entry && (
                <span className="rounded bg-(--color-surface-subtle) px-1.5 py-0.5 text-xs text-(--color-fg-muted)">
                  {entryBadge}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Экспортировать + тест зелёный**

В `src/features/lectures/index.ts` добавь рядом с `LectureCanvasList`:
```ts
export { LectureFormList } from "./ui/lecture-form-list";
```
Run: `pnpm exec vitest run src/features/lectures/ui/lecture-form-list.test.tsx`
Expected: PASS (3 кейса).

- [ ] **Step 5: Commit**

```bash
git add src/features/lectures/ui/lecture-form-list.tsx src/features/lectures/ui/lecture-form-list.test.tsx src/features/lectures/index.ts
git commit -m "feat(lectures): компонент LectureFormList (read-only список форм со ссылками)"
```

---

### Task 6: Server action `searchFormsForAttach`

Источник пикера — `/api/me/forms` (формы владельца). У эндпоинта есть `offset`/`limit`, но нет серверного `q` → q-фильтр обязан быть клиентским → FE-стопгап: фильтр по `title` подстрокой + срез `offset/limit` в action. Возвращает `{ data: {id,label}[], total }` — контракт `AttachTargetPicker`.

**Files:**
- Modify: `src/features/lectures/actions.ts` (добавить `searchFormsForAttach`)
- Create: `src/features/lectures/search-forms-for-attach.test.ts`
- Modify: `src/features/lectures/index.ts` (экспорт `searchFormsForAttach`)

**Interfaces:**
- Consumes: `createApiClient`, `createAction`, `rethrowApiError`, `ERRORS` (существующие в actions.ts).
- Produces: `searchFormsForAttach({ q: string; offset: number; limit: number }): Promise<ActionResult<{ data: { id: string; label: string }[]; total: number }>>` (через `createAction` — `{ success, data }`).

- [ ] **Step 1: Написать падающий тест**

Create `src/features/lectures/search-forms-for-attach.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/api/client", () => ({
  createApiClient: () => Promise.resolve({ GET: get }),
}));
vi.mock("@/i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n")>();
  return { ...actual, getT: () => Promise.resolve((key: string) => key) };
});

import { searchFormsForAttach } from "./actions";

beforeEach(() => {
  get.mockReset();
});

const FORMS = [
  { id: "f1", title: "Опрос после лекции" },
  { id: "f2", title: "Регистрация на семинар" },
  { id: "f3", title: "Обратная связь" },
  { id: "nope" }, // без title → label = id; без id отфильтровывается (см. ниже)
];

describe("searchFormsForAttach", () => {
  it("фильтрует по подстроке title (без учёта регистра) и режет offset/limit", async () => {
    get.mockResolvedValue({ data: { data: FORMS }, error: undefined });
    const r = await searchFormsForAttach({ q: "опрос", offset: 0, limit: 10 });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.data).toEqual([{ id: "f1", label: "Опрос после лекции" }]);
    expect(r.data.total).toBe(1);
  });

  it("пустой q → все формы (с id); total = размер набора; пагинация работает", async () => {
    get.mockResolvedValue({ data: { data: FORMS }, error: undefined });
    const r = await searchFormsForAttach({ q: "", offset: 1, limit: 2 });
    expect(r.success).toBe(true);
    if (!r.success) return;
    // 4 формы, у "nope" нет title → label="nope"; формы без id отбрасываются (тут все с id)
    expect(r.data.total).toBe(4);
    expect(r.data.data.map((f) => f.id)).toEqual(["f2", "f3"]);
  });

  it("формы без id отбрасываются", async () => {
    get.mockResolvedValue({ data: { data: [{ title: "no id" }, { id: "f1", title: "ok" }] }, error: undefined });
    const r = await searchFormsForAttach({ q: "", offset: 0, limit: 10 });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.data).toEqual([{ id: "f1", label: "ok" }]);
    expect(r.data.total).toBe(1);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm exec vitest run src/features/lectures/search-forms-for-attach.test.ts`
Expected: FAIL — `searchFormsForAttach` не экспортируется из `./actions`.

- [ ] **Step 3: Реализовать action**

В `src/features/lectures/actions.ts` после `searchMediaForAttach` (после строки ~366) добавь:

```ts
/**
 * Поиск форм владельца для attach-пикера. Источник — GET /api/me/forms (формы
 * текущего пользователя; attach owner-only, прикрепляют свои формы).
 *
 * СТОПГАП: у /api/me/forms нет q/пагинации (в отличие от /api/documents и
 * /api/media). Фильтруем по title подстрокой и режем offset/limit здесь. Когда
 * бэк добавит серверный поиск форм (GET /api/forms?q= …) — заменить на него.
 */
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
    return {
      data: filtered.slice(raw.offset, raw.offset + raw.limit),
      total: filtered.length,
    };
  },
  "searchFormsForAttach",
);
```

- [ ] **Step 4: Экспортировать + тест зелёный**

В `src/features/lectures/index.ts` добавь `searchFormsForAttach` рядом с `searchMediaForAttach`.
Run: `pnpm exec vitest run src/features/lectures/search-forms-for-attach.test.ts`
Expected: PASS (3 кейса).

- [ ] **Step 5: Commit**

```bash
git add src/features/lectures/actions.ts src/features/lectures/search-forms-for-attach.test.ts src/features/lectures/index.ts
git commit -m "feat(lectures): searchFormsForAttach (пикер форм из /api/me/forms; FE-стопгап под отсутствие q)"
```

---

### Task 7: Расширить `LectureAttachmentsManager` на `form`

Виджет — тонкий адаптер generic-панели; покрыт типами + существующим `attachments-panel.test.tsx`. Меняем: тип `pickerEntityType`, href-ветку `form→/forms/{id}`, плейсхолдер пикера (тернарник → карта). Верификация — `pnpm typecheck` + Task 9 (страница) + ручной QA.

**Files:**
- Modify: `src/features/lectures/ui/lecture-attachments-manager.tsx`

**Interfaces:**
- Consumes: `searchFormPlaceholder` (Task 4).
- Produces: `LectureAttachmentsManager` принимает `pickerEntityType: "document" | "media" | "form"`; form-item получает `href: /forms/{id}`.

- [ ] **Step 1: Расширить `pickerEntityType` (строка ~36)**

```ts
  /** Тип прикрепляемых сущностей для пикера (документы, медиа или формы). */
  pickerEntityType: "document" | "media" | "form";
```

- [ ] **Step 2: Добавить form-ветку в маппинг href (строки ~67-71)**

```ts
    ...(a.entityType === "document"
      ? { href: `/documents/${a.entityId}` }
      : a.entityType === "media"
        ? { href: `/media/${a.entityId}` }
        : a.entityType === "form"
          ? { href: `/forms/${a.entityId}` }
          : {}),
```

- [ ] **Step 3: Заменить плейсхолдер пикера на карту (в `renderTargetPicker`, строки ~161-165)**

```tsx
          placeholder={
            pickerEntityType === "document"
              ? tL("searchDocumentPlaceholder")
              : pickerEntityType === "media"
                ? tL("searchMediaPlaceholder")
                : tL("searchFormPlaceholder")
          }
```

- [ ] **Step 4: Проверить типы и существующий тест панели**

Run: `pnpm typecheck`
Expected: PASS.
Run: `pnpm exec vitest run src/components/attachments/attachments-panel.test.tsx`
Expected: PASS (поведение панели не изменилось).

- [ ] **Step 5: Commit**

```bash
git add src/features/lectures/ui/lecture-attachments-manager.tsx
git commit -m "feat(lectures): attachments-manager поддерживает pickerEntityType=form (href /forms/{id})"
```

---

### Task 8: Подключить `LectureFormList` на публичную страницу лекции

**Files:**
- Modify: `src/app/lectures/[id]/page.tsx`

**Interfaces:**
- Consumes: `getLectureForms`, `LectureFormList` (Tasks 3, 5); ключи `lectureFormsHeading/lectureFormEntryBadge/lectureFormUntitled` (Task 4).

- [ ] **Step 1: Импорт + добор данных**

В импортах из `@/features/lectures` (строки 11-23) добавь `getLectureForms,` и `LectureFormList,`.
В `Promise.all` (строки 48-55) добавь шестым элементом:

```ts
  const [me, lecture, tags, documents, media, canvases, forms] = await Promise.all([
    getMe(),
    getLectureById(id, token),
    getLectureTags(id),
    getLectureDocuments(id, token),
    getLectureMedia(id, token),
    getLectureCanvases(id, token),
    getLectureForms(id, token),
  ]);
```

- [ ] **Step 2: Отрендерить секцию после `<LectureCanvasList>` (после строки ~150)**

```tsx
        <LectureFormList
          forms={forms}
          token={token}
          heading={t("lectureFormsHeading")}
          entryBadge={t("lectureFormEntryBadge")}
          untitledLabel={t("lectureFormUntitled")}
        />
```

- [ ] **Step 3: Проверить типы и сборку страницы**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Прогнать связанные тесты слайса**

Run: `pnpm exec vitest run src/features/lectures`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/lectures/[id]/page.tsx
git commit -m "feat(lectures): секция «Формы лекции» на публичной странице лекции"
```

---

### Task 9: Подключить attach-менеджер форм на страницу редактирования лекции

**Files:**
- Modify: `src/app/admin/lectures/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `getLectureForms`, `searchFormsForAttach` (Tasks 3, 6); `attachmentsFormsSectionTitle` (Task 4); существующие `ManagedAttachment`, `LectureAttachmentsManager`.

- [ ] **Step 1: Импорты**

В импортах из `@/features/lectures` добавь `getLectureForms,` и `searchFormsForAttach,`.

- [ ] **Step 2: Догрузить формы под `canManage` (строки 59-61)**

```ts
  const [docs, media, forms] = canManage
    ? await Promise.all([getLectureDocuments(id), getLectureMedia(id), getLectureForms(id)])
    : [null, null, null];
```

- [ ] **Step 3: Собрать `formItems` (после `mediaItems`, строка ~76)**

```ts
  const formItems: ManagedAttachment[] = (forms ?? []).map((f, i) => ({
    entityId: f.id ?? "",
    entityType: "form",
    label: f.title ?? f.id ?? t("attachmentsFormsSectionTitle"),
    sortOrder: i,
  }));
```

- [ ] **Step 4: Добавить `formFetcher` (после `mediaFetcher`, строка ~88)**

```ts
  async function formFetcher(q: string, offset: number, limit: number) {
    "use server";
    const r = await searchFormsForAttach({ q, offset, limit });
    return r.success ? r.data : { data: [], total: null };
  }
```

- [ ] **Step 5: Третий `LectureAttachmentsManager` (после медиа-менеджера, строка ~141)**

```tsx
          <LectureAttachmentsManager
            lectureId={id}
            attachments={formItems}
            canAttach={canAttach}
            pickerEntityType="form"
            targetFetcher={formFetcher}
            title={t("attachmentsFormsSectionTitle")}
          />
```

- [ ] **Step 6: Проверить типы + прогнать тесты слайса**

Run: `pnpm typecheck`
Expected: PASS.
Run: `pnpm exec vitest run src/features/lectures`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/lectures/[id]/edit/page.tsx
git commit -m "feat(lectures): attach/detach/reorder форм на странице редактирования лекции"
```

---

### Task 10: Полный гейт + заметки на ручную приёмку

**Files:** нет правок кода (только запуск гейта).

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: PASS (без ошибок ESLint, в т.ч. гарды cross-feature/deep-import).

- [ ] **Step 2: Тесты целиком**

Run: `pnpm test`
Expected: PASS — включая `eslint.config.test.mjs` и весь vitest (схемы, order-forms, list, action, i18n-парити).

- [ ] **Step 3: Сборка**

Run: `pnpm build`
Expected: PASS — `next build` зелёный (типов-регрессий от регена не осталось).

- [ ] **Step 4: Финальный коммит (если гейт что-то досгенерил, иначе пропустить)**

```bash
git status   # убедиться, что нет незакоммиченных правок своих файлов
```

- [ ] **Step 5: Зафиксировать открытые приёмки (для пользователя, не код)**

Ручной браузер-QA: публичная страница лекции с прикреплёнными формами — секция «Формы лекции», ссылки на `/forms/{id}`, бейдж основной формы, token-passthrough для приватной лекции через share-link; страница редактирования — прикрепить/открепить/переупорядочить форму через пикер (поиск по `/api/me/forms`).
Флаг бэку (из спеки): `/api/me/forms` имеет `offset`/`limit`, но без серверного `q` — желателен `GET /api/forms` (picker) с `q`/`offset`/`limit` (или добавить `q` на `/api/me/forms`) для единообразия с документами/медиа; пока работает FE-стопгап.
ar/zh — вычитка новых i18n-строк носителем.

---

## Self-Review (выполнено при написании плана)

- **Покрытие спеки:** drift-гард → T1; `getLectureForms` → T3; `LectureFormList` + entry-first (`orderLectureForms`) → T2/T5; `searchFormsForAttach` + стопгап → T6; расширение менеджера → T7; публичная страница → T8; страница редактирования → T9; i18n (3 namespace × 4 локали) → T4; non-goals (нотификации/офлайн/inline-fill/обратный attachments/Вариант A) — не включены сознательно (раздел спеки «Не-цели»); флаг бэку → T10 step 5.
- **Плейсхолдеры:** нет — каждый шаг содержит конкретный код/команду/ожидаемый вывод.
- **Согласованность типов:** `LectureFormItem` (T3) используется в T5/T8/T9; `orderLectureForms` (T2) — в T5; `searchFormsForAttach` сигнатура `{q,offset,limit}` (T6) совпадает с `formFetcher` (T9) и контрактом `targetFetcher`; `pickerEntityType:"form"` (T7) совпадает с использованием в T9; i18n-ключи (T4) совпадают с потребителями в T5(через пропы)/T7/T8/T9.
