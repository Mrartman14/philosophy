# AST Heading Navigation (оглавление документа) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать читателю навигацию по заголовкам документа в левом поле лейаута (скрыта на узких экранах), построенную из существующего AST и агностичную к роду сущности.

**Architecture:** Новый изолированный компонент `src/components/ast-toc/` извлекает заголовки из `AstBlock[]` (чистая `extractHeadings`) и рендерит клиентский `<AstToc>` с якорными ссылками + scroll-spy. Рендерер `ast-render` учится проставлять `id` заголовкам (общий источник правды `heading.ts`), так что ссылки оглавления и DOM-заголовки делят один backend-owned `block.id` (UUID).

**Tech Stack:** TypeScript, React 19 (Server + Client Components, Next.js App Router), Vitest + @testing-library/react (jsdom), Tailwind v4 (логические утилиты), next-intl за фасадом `@/i18n`.

Спека: [docs/superpowers/specs/2026-06-24-ast-heading-navigation-design.md](../specs/2026-06-24-ast-heading-navigation-design.md)

## Global Constraints

- **Параллельные агенты:** НЕ `git add -A`/`.`, НЕ деструктивные git-операции. В каждом коммите `git add` перечисляет ТОЛЬКО свои файлы по имени. Перед коммитом hot-файлов (`ast-render.tsx`, снапшот, `page.tsx`, каталоги i18n, `layout.css`) ОБЯЗАТЕЛЬНО `git status --short` — рабочее дерево живое, другие агенты могут трогать те же файлы. Для снапшота/общих файлов при наличии чужих незакоммиченных правок — стейджить только свои ханки (`git add -p`) или `git commit --only <файлы>`; чужое не откатывать и не приписывать себе (см. память `parallel-commit-hot-files`).
- **Коммит-сообщения** — на русском, conventional commits; завершать строкой `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. НЕ пушить (push за пользователем).
- **Якорь = `block.id`** (backend-owned UUID), FE НЕ кует slug. Фолбэк по индексу — помеченный стопгап.
- **RTL:** только логические утилиты/свойства (`ps/pe`, `paddingInlineStart`, `border-block-end`); физические (`pl/pr`, `left/right`, `paddingLeft`) запрещены ESLint Guardrail 10.
- **Kit-only (Guardrail 7):** нативные `<button>/<select>/<form>/<fieldset>/<legend>/<textarea>` вне `ui/` запрещены. Нативные `<a>/<nav>/<ul>/<li>` — РАЗРЕШЕНЫ (их уже использует `ast-render`).
- **i18n:** строки только через каталоги; компонент `ast-toc` строк НЕ заводит (получает `label` пропом). Добавлять ключ во ВСЕ локали (`ru/en/ar/zh`) — иначе падает parity-тест; псевдо `en-XA` генерится из `en` автоматически.
- **Гейт перед PR:** `pnpm lint && pnpm test && pnpm build` — зелёные. Тулчейн — `pnpm` (НЕ npm).
- **Субагенты:** диспатчить на opus.

## File Structure

**Новые:**
- `src/components/ast-render/heading.ts` — общий источник правды: `readHeadingLevel`, `headingDomId`.
- `src/components/ast-render/heading.test.ts` — юнит-тест к нему.
- `src/components/ast-toc/extract-headings.ts` — чистая `extractHeadings(blocks) → HeadingEntry[]` + тип `HeadingEntry`.
- `src/components/ast-toc/extract-headings.test.ts`.
- `src/components/ast-toc/ast-toc.tsx` — клиентский `<AstToc>` (нав + scroll-spy + smooth-scroll).
- `src/components/ast-toc/ast-toc.test.tsx`.
- `src/components/ast-toc/index.ts` — публичный API (`AstToc`, `extractHeadings`, `HeadingEntry`).

**Изменяемые:**
- `src/components/ast-render/block-renderer.tsx` — `id` на заголовке через `headingDomId`; `BlockRenderer` принимает `index`.
- `src/components/ast-render/ast-render.tsx` — проброс `index={i}` в `BlockRenderer`.
- `src/components/ast-render/ast-render.test.tsx` — тесты на `id` заголовка; обновление combo-снапшота.
- `src/components/ast-render/index.ts` — реэкспорт `heading.ts`.
- `src/i18n/messages/{ru,en,ar,zh}/pages.ts` — ключ `documentToc`.
- `src/styles/layout.css` — вариант-класс `.margin-nav--hide-narrow` (foundation-touch).
- `src/app/documents/[id]/page.tsx` — подключение `<AstToc>`.

---

### Task 1: Общий источник правды по id/уровню заголовка (`heading.ts`)

Выносим `readHeadingLevel` из `block-renderer.tsx` в отдельный модуль и добавляем `headingDomId`, чтобы рендерер и оглавление вычисляли id/уровень одинаково. Рефактор без изменения поведения рендера.

**Files:**
- Create: `src/components/ast-render/heading.ts`
- Test: `src/components/ast-render/heading.test.ts`
- Modify: `src/components/ast-render/block-renderer.tsx` (импорт `readHeadingLevel` из нового модуля, удаление локальной копии)
- Modify: `src/components/ast-render/index.ts` (реэкспорт)

**Interfaces:**
- Produces:
  - `readHeadingLevel(attrs: AstBlock["attrs"]): 1 | 2 | 3 | 4 | 5 | 6`
  - `headingDomId(block: AstBlock, index: number): string`

- [ ] **Step 1: Написать падающий тест**

Создать `src/components/ast-render/heading.test.ts`:

```ts
// src/components/ast-render/heading.test.ts
import { describe, it, expect } from "vitest";

import { readHeadingLevel, headingDomId } from "./heading";

describe("readHeadingLevel", () => {
  it("возвращает число 1–6 как есть", () => {
    expect(readHeadingLevel({ level: 1 })).toBe(1);
    expect(readHeadingLevel({ level: 6 })).toBe(6);
  });
  it("дефолт 2 при отсутствии level", () => {
    expect(readHeadingLevel(undefined)).toBe(2);
    expect(readHeadingLevel({})).toBe(2);
  });
  it("дефолт 2 при выходе за диапазон", () => {
    expect(readHeadingLevel({ level: 0 })).toBe(2);
    expect(readHeadingLevel({ level: 7 })).toBe(2);
  });
  it("дефолт 2 при нечисловом level", () => {
    expect(readHeadingLevel({ level: "3" as unknown as number })).toBe(2);
  });
});

describe("headingDomId", () => {
  it("использует block.id когда он есть", () => {
    expect(headingDomId({ id: "blk-uuid", type: "heading" }, 0)).toBe("blk-uuid");
  });
  it("фолбэк heading-{index} когда block.id отсутствует", () => {
    expect(headingDomId({ type: "heading" }, 4)).toBe("heading-4");
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm test src/components/ast-render/heading.test.ts`
Expected: FAIL — `Cannot find module "./heading"`.

- [ ] **Step 3: Реализовать `heading.ts`**

Создать `src/components/ast-render/heading.ts`:

```ts
// src/components/ast-render/heading.ts
// Единый источник правды по уровню и DOM-id заголовка. Зовётся и рендерером
// (block-renderer), и оглавлением (ast-toc) → id заголовка в DOM и якорь в
// навигации гарантированно совпадают. id = backend-owned block.id (UUID,
// см. docs/domain/anchors.md); фолбэк по индексу — стопгап на редкий missing-id.
import type { AstBlock } from "./types";

export function readHeadingLevel(attrs: AstBlock["attrs"]): 1 | 2 | 3 | 4 | 5 | 6 {
  const raw = (attrs as { level?: unknown } | undefined)?.level;
  if (typeof raw !== "number") return 2;
  if (raw < 1 || raw > 6) return 2;
  return raw as 1 | 2 | 3 | 4 | 5 | 6;
}

export function headingDomId(block: AstBlock, index: number): string {
  return block.id ?? `heading-${index}`;
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm test src/components/ast-render/heading.test.ts`
Expected: PASS (6 тестов).

- [ ] **Step 5: Рефактор `block-renderer.tsx` — использовать общий модуль**

В `src/components/ast-render/block-renderer.tsx`:

1. Добавить импорт после строки `import { ImageNode } from "./nodes/image";`:

```ts
import { readHeadingLevel } from "./heading";
```

2. Удалить локальную функцию `readHeadingLevel` (строки 128–133):

```ts
function readHeadingLevel(attrs: AstBlock["attrs"]): 1 | 2 | 3 | 4 | 5 | 6 {
  const raw = (attrs as { level?: unknown } | undefined)?.level;
  if (typeof raw !== "number") return 2;
  if (raw < 1 || raw > 6) return 2;
  return raw as 1 | 2 | 3 | 4 | 5 | 6;
}
```

(Кейс `heading` продолжает звать `readHeadingLevel(block.attrs)` — теперь импортированную.)

- [ ] **Step 6: Реэкспорт из `index.ts`**

В `src/components/ast-render/index.ts` добавить после строки `export { AstRender } from "./ast-render";`:

```ts
export { readHeadingLevel, headingDomId } from "./heading";
```

- [ ] **Step 7: Прогнать ast-render тесты — поведение не изменилось**

Run: `pnpm test src/components/ast-render`
Expected: PASS (все существующие тесты зелёные, combo-снапшот без изменений — рефактор чистый).

- [ ] **Step 8: Коммит**

```bash
git add src/components/ast-render/heading.ts src/components/ast-render/heading.test.ts src/components/ast-render/block-renderer.tsx src/components/ast-render/index.ts
git commit -m "$(cat <<'EOF'
refactor(ast-render): вынести readHeadingLevel + добавить headingDomId в heading.ts

Общий источник правды по уровню/DOM-id заголовка для рендерера и будущего
оглавления. Поведение рендера не меняется.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Рендерер проставляет `id` заголовку

`BlockRenderer` начинает эмитить `id={headingDomId(block, index)}` на `<hN>`. Для этого пробрасываем индекс блока в `BlockRenderer` со всех call-site'ов.

**Files:**
- Modify: `src/components/ast-render/block-renderer.tsx`
- Modify: `src/components/ast-render/ast-render.tsx`
- Modify: `src/components/ast-render/ast-render.test.tsx` (новые тесты + обновление combo-снапшота)

**Interfaces:**
- Consumes: `headingDomId` (Task 1).
- Produces: `<hN id="…">` в выводе `AstRender`.

- [ ] **Step 1: Написать падающие тесты на id**

В `src/components/ast-render/ast-render.test.tsx`, в блок `describe("AstRender — heading", …)` (после теста про `<h2>`, ~строка 88) добавить:

```ts
  it("проставляет id заголовку из block.id", () => {
    const { container } = render(<AstRender blocks={[HEADING_LEVEL_1]} />);
    expect(container.querySelector("h1")?.id).toBe("h1");
  });

  it("без block.id проставляет фолбэк-id heading-{index}", () => {
    const block: import("./types").AstBlock = {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Без id" }],
    };
    const { container } = render(<AstRender blocks={[block]} />);
    expect(container.querySelector("h2")?.id).toBe("heading-0");
  });
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test src/components/ast-render/ast-render.test.tsx -t "проставляет id"`
Expected: FAIL — `expected '' to be 'h1'` (у `<h1>` без `id`-атрибута `.id` возвращает пустую строку, не null).

- [ ] **Step 3: Добавить `index` в Props и call-site'ы `BlockRenderer`**

В `src/components/ast-render/block-renderer.tsx` заменить интерфейс `Props` (строки 10–13):

```ts
interface Props {
  block: AstBlock;
  ctx: AstRenderContext;
  index: number;
}
```

Сигнатуру функции (строка 15) — на:

```ts
export function BlockRenderer({ block, ctx, index }: Props): ReactNode {
```

Кейс `heading` (строки 19–24) — на:

```ts
    case "heading": {
      const level = readHeadingLevel(block.attrs);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- tsc requires the literal union for the dynamic JSX tag; ESLint mis-flags it as a no-op
      const Tag = (`h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6");
      return <Tag id={headingDomId(block, index)}><InlineRenderer nodes={block.content} ctx={ctx} /></Tag>;
    }
```

Добавить импорт `headingDomId` (в строке импорта из Task 1):

```ts
import { readHeadingLevel, headingDomId } from "./heading";
```

В рекурсивных call-site'ах того же файла добавить `index={i}`:

- кейс `list` (строка ~32): `<BlockRenderer key={child.id ?? i} block={child} ctx={ctx} index={i} />`
- кейс `list_item` (строка ~44): `<BlockRenderer key={child.id ?? i} block={child} ctx={ctx} index={i} />`
- кейс `blockquote` (строка ~68): `<BlockRenderer key={child.id ?? i} block={child} ctx={ctx} index={i} />`

- [ ] **Step 4: Пробросить `index` в верхнеуровневом `ast-render.tsx`**

В `src/components/ast-render/ast-render.tsx` заменить `.map` (строки 9–11):

```tsx
      {blocks.map((block, i) => (
        <BlockRenderer key={block.id ?? i} block={block} ctx={effectiveCtx} index={i} />
      ))}
```

- [ ] **Step 5: Запустить новые тесты — должны пройти**

Run: `pnpm test src/components/ast-render/ast-render.test.tsx -t "id"`
Expected: PASS (оба новых теста).

- [ ] **Step 6: Обновить combo-снапшот**

Combo-снапшот теперь содержит `<h1 id="h1">`. Сначала проверить git-статус снапшота (параллельные агенты могут трогать тот же файл):

Run: `git status --short src/components/ast-render/__snapshots__/ast-render.test.tsx.snap`

Регенерировать снапшот (`-u` перезаписывает ВЕСЬ файл, не частично):

Run: `pnpm test src/components/ast-render/ast-render.test.tsx -u`

Посмотреть diff:

Run: `git diff src/components/ast-render/__snapshots__/ast-render.test.tsx.snap`
Expected: единственная дельта от ЭТОЙ задачи — добавление `id="h1"` к `<h1>` в combo-снапшоте.

ВАЖНО (параллельные агенты): если на Step 6 `git status` показал, что снапшот уже изменён ДРУГИМ агентом, на Step 8 стейджить ТОЛЬКО свой ханк (`git add -p` → принять только строку с `id="h1"`), а не файл целиком — иначе в коммит затянется чужое. Если файл был чист — обычный `git add <file>` безопасен.

- [ ] **Step 7: Полный прогон ast-render**

Run: `pnpm test src/components/ast-render`
Expected: PASS (все).

- [ ] **Step 8: Коммит**

```bash
git add src/components/ast-render/block-renderer.tsx src/components/ast-render/ast-render.tsx src/components/ast-render/ast-render.test.tsx src/components/ast-render/__snapshots__/ast-render.test.tsx.snap
git commit -m "$(cat <<'EOF'
feat(ast-render): проставлять id заголовкам (= block.id) для якорной навигации

Заголовки получают DOM-id из общего headingDomId → deep-link на любой
заголовок + опора для оглавления. Индекс блока проброшен в BlockRenderer.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Чистое извлечение заголовков (`extract-headings.ts`)

Чистая функция, превращающая `AstBlock[]` в лёгкий сериализуемый список заголовков. Server-safe, без React.

**Files:**
- Create: `src/components/ast-toc/extract-headings.ts`
- Test: `src/components/ast-toc/extract-headings.test.ts`

**Interfaces:**
- Consumes: `readHeadingLevel`, `headingDomId`, `AstBlock` (из `@/components/ast-render`).
- Produces:
  - `interface HeadingEntry { id: string; level: number; text: string }`
  - `extractHeadings(blocks: AstBlock[]): HeadingEntry[]`

- [ ] **Step 1: Написать падающий тест**

Создать `src/components/ast-toc/extract-headings.test.ts`:

```ts
// src/components/ast-toc/extract-headings.test.ts
import { describe, it, expect } from "vitest";

import type { AstBlock } from "@/components/ast-render";

import { extractHeadings } from "./extract-headings";

describe("extractHeadings", () => {
  it("извлекает заголовки с id, level, text; пропускает не-заголовки", () => {
    const blocks: AstBlock[] = [
      { id: "h-a", type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Введение" }] },
      { id: "p", type: "paragraph", content: [{ type: "text", text: "абзац" }] },
      { id: "h-b", type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Глава" }] },
    ];
    expect(extractHeadings(blocks)).toEqual([
      { id: "h-a", level: 1, text: "Введение" },
      { id: "h-b", level: 2, text: "Глава" },
    ]);
  });

  it("предпочитает предвычисленный block.text", () => {
    const blocks: AstBlock[] = [
      { id: "h", type: "heading", attrs: { level: 2 }, text: "Готовый", content: [{ type: "text", text: "игнор" }] },
    ];
    expect(extractHeadings(blocks)).toEqual([{ id: "h", level: 2, text: "Готовый" }]);
  });

  it("собирает текст из вложенных inline-нод, когда block.text отсутствует", () => {
    const blocks: AstBlock[] = [
      {
        id: "h",
        type: "heading",
        attrs: { level: 3 },
        content: [
          { type: "text", text: "Тех" },
          { type: "text", text: "ника", marks: [{ type: "bold" }] },
        ],
      },
    ];
    expect(extractHeadings(blocks)[0]).toEqual({ id: "h", level: 3, text: "Техника" });
  });

  it("дефолт уровня 2 без attrs.level", () => {
    const blocks: AstBlock[] = [
      { id: "h", type: "heading", content: [{ type: "text", text: "X" }] },
    ];
    expect(extractHeadings(blocks)[0]?.level).toBe(2);
  });

  it("фолбэк-id берёт позицию в ПОЛНОМ массиве (паритет с рендером)", () => {
    const blocks: AstBlock[] = [
      { type: "paragraph", content: [{ type: "text", text: "intro" }] },
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "H" }] },
    ];
    expect(extractHeadings(blocks)[0]?.id).toBe("heading-1");
  });

  it("пустой ввод → []", () => {
    expect(extractHeadings([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test src/components/ast-toc/extract-headings.test.ts`
Expected: FAIL — `Cannot find module "./extract-headings"`.

- [ ] **Step 3: Реализовать `extract-headings.ts`**

Создать `src/components/ast-toc/extract-headings.ts`:

```ts
// src/components/ast-toc/extract-headings.ts
// Чистое извлечение оглавления из AST. Агностично к роду сущности — на входе
// только AstBlock[]. Сериализуемый результат уходит в клиентский <AstToc>.
import { readHeadingLevel, headingDomId, type AstBlock, type AstNode } from "@/components/ast-render";

export interface HeadingEntry {
  id: string;
  level: number;
  text: string;
}

/** Рекурсивно собирает текст inline-нод (фолбэк, когда block.text не задан). */
function inlineText(nodes: AstNode[] | undefined): string {
  if (!nodes) return "";
  let out = "";
  for (const n of nodes) {
    if (typeof n.text === "string") out += n.text;
    if (n.content) out += inlineText(n.content);
  }
  return out;
}

/**
 * Возвращает заголовки top-level блоков в порядке документа. `index` — позиция
 * в ПОЛНОМ массиве (не среди заголовков): так фолбэк-id совпадает с тем, что
 * проставляет BlockRenderer на тот же блок.
 */
export function extractHeadings(blocks: AstBlock[]): HeadingEntry[] {
  const out: HeadingEntry[] = [];
  blocks.forEach((block, index) => {
    if (block.type !== "heading") return;
    out.push({
      id: headingDomId(block, index),
      level: readHeadingLevel(block.attrs),
      text: typeof block.text === "string" && block.text.length > 0
        ? block.text
        : inlineText(block.content),
    });
  });
  return out;
}
```

- [ ] **Step 4: Запустить — должно пройти**

Run: `pnpm test src/components/ast-toc/extract-headings.test.ts`
Expected: PASS (6 тестов).

- [ ] **Step 5: Коммит**

```bash
git add src/components/ast-toc/extract-headings.ts src/components/ast-toc/extract-headings.test.ts
git commit -m "$(cat <<'EOF'
feat(ast-toc): чистая extractHeadings(blocks) → HeadingEntry[]

Агностичное к сущности извлечение оглавления из AST (top-level заголовки,
уровень/текст/стабильный id). Server-safe, без React.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Клиентский компонент `<AstToc>` + барель `index.ts`

Рендерит навигацию (нав + ссылки с отступом по уровню), scroll-spy подсветку активного заголовка и плавный скролл по клику (с уважением к оси motion). Пустой список → `null`.

**Files:**
- Create: `src/components/ast-toc/ast-toc.tsx`
- Test: `src/components/ast-toc/ast-toc.test.tsx`
- Create: `src/components/ast-toc/index.ts`

**Interfaces:**
- Consumes: `HeadingEntry` (Task 3), `useReducedMotion` (из `@/components/appearance`).
- Produces: `<AstToc headings={HeadingEntry[]} label={string} maxLevel?={number} />`; барель экспортит `AstToc`, `extractHeadings`, `HeadingEntry`.

- [ ] **Step 1: Написать падающий тест**

Создать `src/components/ast-toc/ast-toc.test.tsx`:

```tsx
// src/components/ast-toc/ast-toc.test.tsx
import { render, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import type { HeadingEntry } from "./extract-headings";
import { AstToc } from "./ast-toc";

// useReducedMotion завязан на AppearanceProvider-контекст; в юнит-тесте мокаем
// его как чистую функцию. Значение управляется через мутабельный контейнер,
// поднятый vi.hoisted (vi.mock-фабрика не может ссылаться на обычные let).
const mock = vi.hoisted(() => ({ reduced: false }));
vi.mock("@/components/appearance", () => ({
  useReducedMotion: () => mock.reduced,
}));

// jsdom не реализует IntersectionObserver — подменяем, захватывая колбэк.
class MockIO {
  static last: MockIO | null = null;
  cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    MockIO.last = this;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

const HEADINGS: HeadingEntry[] = [
  { id: "h-a", level: 1, text: "Введение" },
  { id: "h-b", level: 2, text: "Детали" },
];

beforeEach(() => {
  mock.reduced = false;
  MockIO.last = null;
  (globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver })
    .IntersectionObserver = MockIO as unknown as typeof IntersectionObserver;
  Element.prototype.scrollIntoView = vi.fn();
});

// Конфиг проекта: globals:false без restoreMocks → авто-cleanup RTL НЕ работает.
// Чистим вручную: размонтируем деревья, чистим body (appended <h2>), снимаем
// стаб scrollIntoView с прототипа и глобал IntersectionObserver (jsdom их не
// имеет по умолчанию — иначе течь в другие тест-файлы воркера).
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
  vi.restoreAllMocks();
});

function fireIO(entries: { isIntersecting: boolean; target: { id: string } }[]) {
  act(() => {
    MockIO.last?.cb(
      entries as unknown as IntersectionObserverEntry[],
      MockIO.last as unknown as IntersectionObserver,
    );
  });
}

describe("AstToc", () => {
  it("пустой список заголовков → ничего не рендерит", () => {
    const { container } = render(<AstToc headings={[]} label="Содержание" />);
    expect(container.firstChild).toBeNull();
  });

  it("рендерит <nav>, помеченный видимым заголовком через aria-labelledby (без дубля aria-label)", () => {
    const { container } = render(<AstToc headings={HEADINGS} label="Содержание" />);
    const nav = container.querySelector("nav")!;
    expect(nav.getAttribute("aria-label")).toBeNull();
    const labelledby = nav.getAttribute("aria-labelledby");
    expect(labelledby).toBeTruthy();
    const title = container.querySelector("p");
    expect(title?.id).toBe(labelledby);
    expect(title?.textContent).toBe("Содержание");
  });

  it("рендерит якорные ссылки с href и текстом", () => {
    const { container } = render(<AstToc headings={HEADINGS} label="Содержание" />);
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(2);
    expect(links[0]?.getAttribute("href")).toBe("#h-a");
    expect(links[1]?.getAttribute("href")).toBe("#h-b");
    expect(links[1]?.textContent).toBe("Детали");
  });

  it("отступ нормализуется на минимальный уровень в наборе (логический paddingInlineStart)", () => {
    // Набор начинается с level 2 → базовый отступ всё равно 0 (нормализация на minLevel, не на 1).
    const deep: HeadingEntry[] = [
      { id: "x", level: 2, text: "A" },
      { id: "y", level: 3, text: "B" },
    ];
    const { container } = render(<AstToc headings={deep} label="Содержание" />);
    const links = container.querySelectorAll<HTMLAnchorElement>("a");
    expect(links[0]?.style.paddingInlineStart).toBe("0rem");
    expect(links[1]?.style.paddingInlineStart).toBe("0.75rem");
  });

  it("maxLevel ограничивает показанные уровни", () => {
    const { container } = render(<AstToc headings={HEADINGS} label="Содержание" maxLevel={1} />);
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe("#h-a");
  });

  it("scroll-spy: при нескольких видимых активен первый по порядку документа", () => {
    const { container } = render(<AstToc headings={HEADINGS} label="Содержание" />);
    fireIO([
      { isIntersecting: true, target: { id: "h-a" } },
      { isIntersecting: true, target: { id: "h-b" } },
    ]);
    expect(container.querySelector('a[aria-current="location"]')?.getAttribute("href")).toBe("#h-a");
  });

  it("scroll-spy: уход первого заголовка переключает активный на следующий видимый", () => {
    const { container } = render(<AstToc headings={HEADINGS} label="Содержание" />);
    fireIO([
      { isIntersecting: true, target: { id: "h-a" } },
      { isIntersecting: true, target: { id: "h-b" } },
    ]);
    fireIO([{ isIntersecting: false, target: { id: "h-a" } }]);
    expect(container.querySelector('a[aria-current="location"]')?.getAttribute("href")).toBe("#h-b");
  });

  it("клик: плавный скролл при обычном motion", () => {
    document.body.appendChild(Object.assign(document.createElement("h2"), { id: "h-b" }));
    const { container } = render(<AstToc headings={HEADINGS} label="Содержание" />);
    const link = container.querySelector<HTMLAnchorElement>('a[href="#h-b"]')!;
    act(() => { link.click(); });
    const target = document.getElementById("h-b")!;
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("клик: мгновенный скролл при reduced motion", () => {
    mock.reduced = true;
    document.body.appendChild(Object.assign(document.createElement("h2"), { id: "h-a" }));
    const { container } = render(<AstToc headings={HEADINGS} label="Содержание" />);
    const link = container.querySelector<HTMLAnchorElement>('a[href="#h-a"]')!;
    act(() => { link.click(); });
    const target = document.getElementById("h-a")!;
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });

  it("клик переносит фокус на целевой заголовок (a11y)", () => {
    document.body.appendChild(Object.assign(document.createElement("h2"), { id: "h-b" }));
    const { container } = render(<AstToc headings={HEADINGS} label="Содержание" />);
    const link = container.querySelector<HTMLAnchorElement>('a[href="#h-b"]')!;
    act(() => { link.click(); });
    expect(document.activeElement).toBe(document.getElementById("h-b"));
  });
});
```

- [ ] **Step 2: Запустить — убедиться, что падает**

Run: `pnpm test src/components/ast-toc/ast-toc.test.tsx`
Expected: FAIL — `Cannot find module "./ast-toc"`.

- [ ] **Step 3: Реализовать `ast-toc.tsx`**

Создать `src/components/ast-toc/ast-toc.tsx`:

```tsx
// src/components/ast-toc/ast-toc.tsx
"use client";
import { useEffect, useId, useState } from "react";

import { useReducedMotion } from "@/components/appearance";

import type { HeadingEntry } from "./extract-headings";

interface Props {
  headings: HeadingEntry[];
  /** Переведённый лейбл (= aria-labelledby + видимый заголовок навигации).
   *  Передаёт потребитель — компонент i18n-агностичен. */
  label: string;
  /** Опциональный потолок уровня (по умолчанию показываем все). */
  maxLevel?: number;
}

const INDENT_REM_PER_LEVEL = 0.75;

export function AstToc({ headings, label, maxLevel }: Props) {
  const items = maxLevel ? headings.filter((h) => h.level <= maxLevel) : headings;
  const reduced = useReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (items.length === 0) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        const first = items.find((h) => visible.has(h.id));
        if (first) setActiveId(first.id);
      },
      // Зона «активного» — верхние ~30% вьюпорта (заголовок «доезжает» до верха).
      { rootMargin: "0px 0px -70% 0px" },
    );
    for (const h of items) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }
    return () => { observer.disconnect(); };
    // items пересоздаётся на каждый рендер, но после гидрейта стабилен по содержимому.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((h) => h.id).join(",")]);

  if (items.length === 0) return null;

  const minLevel = Math.min(...items.map((h) => h.level));

  function onClick(e: React.MouseEvent, id: string) {
    const el = document.getElementById(id);
    if (!el) return; // нет цели → пусть нативный якорь сработает сам
    e.preventDefault();
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    // A11y: перенести фокус на целевой заголовок. Нативный якорь на
    // не-фокусируемый <hN> фокус НЕ двигает → клавиатура/скринридер «теряются»
    // (следующий Tab продолжит из навигации, а не из раздела). tabindex=-1 —
    // программно-фокусируемый, вне tab-order; preventScroll — скролл уже сделан.
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
    history.replaceState(null, "", `#${id}`);
    setActiveId(id);
  }

  return (
    <nav aria-labelledby={titleId}>
      <p id={titleId} className="mb-2 text-sm font-medium text-(--color-fg-muted)">{label}</p>
      <ul className="flex flex-col gap-1">
        {items.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              title={h.text}
              aria-current={activeId === h.id ? "location" : undefined}
              onClick={(e) => { onClick(e, h.id); }}
              style={{ paddingInlineStart: `${(h.level - minLevel) * INDENT_REM_PER_LEVEL}rem` }}
              className={
                activeId === h.id
                  ? "block break-words text-sm text-(--color-link)"
                  : "block break-words text-sm text-(--color-fg-muted) hover:text-(--color-fg)"
              }
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

A11y/UX-решения: `aria-labelledby` (вместо `aria-label` + видимый текст → одно
озвучивание лейбла, без дубля для скринридера); перенос фокуса на заголовок в
`onClick`; `title={h.text}` + `break-words` — на узкое поле (длинный текст не
переполняет колонку).

- [ ] **Step 4: Запустить тесты — должны пройти**

Run: `pnpm test src/components/ast-toc/ast-toc.test.tsx`
Expected: PASS (6 тестов).

- [ ] **Step 5: Создать барель `index.ts`**

Создать `src/components/ast-toc/index.ts`:

```ts
// src/components/ast-toc/index.ts
export { AstToc } from "./ast-toc";
export { extractHeadings } from "./extract-headings";
export type { HeadingEntry } from "./extract-headings";
```

- [ ] **Step 6: Прогнать весь слайс ast-toc**

Run: `pnpm test src/components/ast-toc`
Expected: PASS (extract-headings + ast-toc).

- [ ] **Step 7: Коммит**

```bash
git add src/components/ast-toc/ast-toc.tsx src/components/ast-toc/ast-toc.test.tsx src/components/ast-toc/index.ts
git commit -m "$(cat <<'EOF'
feat(ast-toc): клиентский <AstToc> — нав по заголовкам + scroll-spy

Якорные ссылки с отступом по уровню, IntersectionObserver-подсветка
активного заголовка, плавный скролл по клику (auto при reduced motion).
Пустой список → null. Лейбл — пропом (i18n-агностичен).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: i18n-строка `tocLabel` во всех локалях

**Files:**
- Modify: `src/i18n/messages/ru/pages.ts`
- Modify: `src/i18n/messages/en/pages.ts`
- Modify: `src/i18n/messages/ar/pages.ts`
- Modify: `src/i18n/messages/zh/pages.ts`

**Interfaces:**
- Produces: ключ `pages.tocLabel` во всех локалях (потребляется страницей документа в Task 6).

- [ ] **Step 1: Добавить ключ в каждую локаль**

В `src/i18n/messages/ru/pages.ts` в секции `// ─── /documents/[id] ───`, рядом с `documentMarginHint`, добавить строку:

```ts
  documentToc: "Содержание",
```

В `src/i18n/messages/en/pages.ts` (аналогичная секция `/documents/[id]`):

```ts
  documentToc: "On this page",
```

В `src/i18n/messages/ar/pages.ts`:

```ts
  documentToc: "في هذه الصفحة",
```

В `src/i18n/messages/zh/pages.ts`:

```ts
  documentToc: "目录",
```

(Ключ назван `documentToc` — консистентно с префиксом `document*` в секции `/documents/[id]`.)

- [ ] **Step 2: Проверить parity/компиляцию каталогов**

Run: `pnpm test src/i18n`
Expected: PASS — parity-тест видит ключ во всех локалях; `en-XA` псевдо-каталог генерится из `en` (ничего вручную не добавляем).

- [ ] **Step 3: Коммит**

```bash
git add src/i18n/messages/ru/pages.ts src/i18n/messages/en/pages.ts src/i18n/messages/ar/pages.ts src/i18n/messages/zh/pages.ts
git commit -m "$(cat <<'EOF'
i18n(pages): ключ documentToc (лейбл оглавления документа) во всех локалях

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Размещение в лейауте + подключение на странице документа

CSS-вариант «скрыть нав на узком экране» + проводка `<AstToc>` в левое поле страницы документа.

**Files:**
- Modify: `src/styles/layout.css` (foundation-touch)
- Modify: `src/app/documents/[id]/page.tsx`

**Interfaces:**
- Consumes: `AstToc`, `extractHeadings` (барель `@/components/ast-toc`); `pages.documentToc` (Task 5).

- [ ] **Step 1: Добавить вариант-класс в `layout.css`**

В `src/styles/layout.css`, сразу ПОСЛЕ блока `@media (min-width: theme(--breakpoint-xl)) { .margin-nav { … } }` (после строки 112, закрывающей `}`), добавить:

```css
/* Вариант нав-сайдбара: на узких экранах (< xl) ПОЛНОСТЬЮ скрыт (а не падает
   полосой сверху, как базовый .margin-nav). Для оглавления документа: на ≥xl —
   sticky в левом поле (правила .margin-nav), ниже — нет. */
@media (width < theme(--breakpoint-xl)) {
  .margin-nav--hide-narrow { display: none; }
}

/* Длинное оглавление не должно уходить за нижнюю кромку sticky-сайдбара —
   собственный скролл вместо обрезки нижних пунктов. Логические свойства
   (max-block-size/overflow) — RTL/writing-mode-safe. */
@media (min-width: theme(--breakpoint-xl)) {
  .margin-nav--hide-narrow {
    max-block-size: calc(100dvh - var(--layout-sticky-top) - 1rem);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
}

/* Якорь заголовка встаёт с «воздухом» под sticky-шапкой. Глобальный
   `* { scroll-margin-top: var(--spacing-header) }` (globals.css) = РОВНО высота
   шапки → заголовок впритык. Для заголовков контента поднимаем до
   --layout-sticky-top (= шапка + 1rem), как у прочих sticky-навов проекта.
   Логический scroll-margin-block-start; специфичность .content :is(...) бьёт `*`.
   Бонус: корректнее встают и deep-link-якори на любой заголовок. */
.content :is(h1, h2, h3, h4, h5, h6) {
  scroll-margin-block-start: var(--layout-sticky-top);
}
```

- [ ] **Step 2: Подключить `<AstToc>` на странице документа**

В `src/app/documents/[id]/page.tsx`:

1. Добавить импорт (рядом с прочими `@/components/...`, после строки 5):

```ts
import { AstToc, extractHeadings } from "@/components/ast-toc";
```

2. Внутри компонента, после `if (!document) notFound();` (строка 39), вычислить заголовки:

```ts
  const tocHeadings = extractHeadings(document.blocks ?? []);
```

3. В возвращаемом фрагменте, сразу после закрывающего `</div>` контент-блока (строка 118) и ПЕРЕД `<MarginNote side="end">`, вставить нав в левом поле. `<AstToc>` рендерит `<nav>`, поэтому оборачиваем его в `<aside>` с классом размещения (прямой потомок `.page-grid`). Класс `.margin-nav` сам задаёт `grid-column: margin-start / content-start` на ≥xl — поэтому `col-margin-start` НЕ нужен (был бы избыточен; на <xl `.margin-nav--hide-narrow` всё равно прячет):

```tsx
      <aside className="margin-nav margin-nav--hide-narrow">
        <AstToc headings={tocHeadings} label={t("documentToc")} />
      </aside>
```

(Итоговый порядок прямых детей фрагмента: контент-`<div>`, затем `<aside>` оглавления (левое поле), затем `<MarginNote side="end">` (правое поле). `AstToc` сам вернёт `null`, если заголовков нет — `<aside>` останется пустым и невидимым.)

- [ ] **Step 3: Линт затронутых файлов**

Run: `pnpm lint`
Expected: PASS — нет нарушений (логические классы, нативные `<a>/<nav>/<aside>` разрешены).

- [ ] **Step 4: Полный гейт**

Run: `pnpm test && pnpm build`
Expected: PASS — все тесты зелёные, прод-сборка успешна.

- [ ] **Step 5: Коммит**

```bash
git add src/styles/layout.css src/app/documents/[id]/page.tsx
git commit -m "$(cat <<'EOF'
feat(documents): оглавление по заголовкам в левом поле страницы документа

<AstToc> из AST в левом поле (sticky на ≥xl, скрыт < xl через
.margin-nav--hide-narrow, свой скролл при длинном оглавлении). Заголовки
получают воздух под sticky-шапкой. Заголовков нет → ничего не показываем.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Ручная браузер-QA (вне TDD, отметить как открытый пункт)**

Открыть `/documents/<id>` документа с несколькими заголовками (`pnpm dev`, фронт :3001, бэк :8090):
- ≥xl: оглавление в левом поле, sticky под шапкой; клик → плавный скролл к заголовку; заголовок встаёт с зазором под шапкой (не впритык); активный пункт подсвечивается при скролле.
- **A11y:** после клика по пункту фокус на целевом заголовке (Tab продолжает из раздела, не из навигации); скринридер озвучивает лейбл навигации один раз (нет дубля).
- **Длинное оглавление** (документ с 25+ заголовками): нижние пункты достижимы — у сайдбара свой скролл, не обрезаются.
- Длинный текст заголовка: не переполняет узкое поле (перенос), полный текст в `title` по ховеру.
- < xl (≤1279px): оглавление полностью скрыто (нет в tab-order).
- Документ без заголовков: левое поле пустое, лейаут не съезжает.
- RTL (сменить локаль на `ar`): нав зеркалится, отступы по уровню — со стороны inline-start.
- reduced motion (Настройки → движение → reduced): скролл по клику мгновенный.

- [ ] **Step 7: Выдать бэк-аск пользователю (FE/BE-разделение)**

Сообщить пользователю открытый бэк-вопрос (он передаст бэку): в OpenAPI
`ast.Block.id` типизирован опционально (`id?`), а FE теперь использует его как
DOM-якорь заголовка. Нужно подтверждение, что **каждый heading-блок** в GET-ответе
документа всегда несёт `id` (UUID). При подтверждении — снять FE-фолбэк-стопгап
`heading-${index}` (в `headingDomId`, Task 1). Правило проекта «флаговать корень
бэка, а не маскировать» (AGENTS.md).

---

## Self-Review

**1. Spec coverage:**
- Цель (оглавление из AST, левое поле, скрыто < xl, агностичность) → Tasks 3,4,6. ✓
- `heading.ts` единый источник id/уровня → Task 1. ✓
- Рендерер проставляет `id` → Task 2. ✓
- `extractHeadings` чистая, top-level, фолбэк-id по полному индексу → Task 3. ✓
- `<AstToc>` клиентский: ссылки, вложенность, scroll-spy, smooth+reduced, пустой→null, label-проп, maxLevel → Task 4. ✓
- A11y: `aria-labelledby` (без дубля), перенос фокуса на заголовок, `aria-current` → Task 4 (+ тесты). ✓
- Размещение в левом поле (`.margin-nav`, без избыточного `col-margin-start`) + sticky ≥xl + скрыт < xl + свой скролл длинного оглавления → Task 6 (CSS) + проводка страницы. ✓
- `scroll-margin` заголовков: глобальный достаточен, но добавлен «воздух» (`--layout-sticky-top`) для контент-заголовков → Task 6; globals.css не трогаем. ✓
- i18n label во всех локалях (`documentToc`), компонент агностичен → Task 5 + проп. ✓
- Тестирование (extract, snapshot+id, ast-toc, scroll-spy ordering/delete, smooth/reduced, focus, maxLevel, teardown) → Tasks 1–4. ✓
- Граничные случаи (нет/один заголовок, missing id, дубли текста, длинный текст/оглавление) → покрыты тестами Task 3/4 + CSS + фолбэк. ✓
- Открытый бэк-флаг (`ast.Block.id` опционален) → фолбэк реализован + явный бэк-аск (Task 6 Step 7). ✓

**2. Placeholder scan:** плейсхолдеров нет — весь код приведён целиком, команды и ожидаемый вывод указаны.

**3. Type consistency:** `HeadingEntry {id,level,text}` определён в Task 3, потребляется идентично в Task 4 и тестах. `headingDomId(block,index)` / `readHeadingLevel(attrs)` — сигнатуры из Task 1 совпадают во всех использованиях (Task 2 рендерер, Task 3 extract). Барель `@/components/ast-toc` экспортит `AstToc`/`extractHeadings`/`HeadingEntry` (Task 4), импортится в Task 6. Ключ i18n — `documentToc` единообразно в Task 5 и Task 6. ✓
