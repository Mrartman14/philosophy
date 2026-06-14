# Offline F2 — изоморфный read-only рендер комментов (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Выделить чистый изоморфный read-only слой рендера комментов (`CommentNodeView`/`CommentTreeView` + shared-хелперы), чтобы офлайн `SavedLectureView` (slice L) рендерил дерево комментов из снимка IndexedDB БЕЗ серверных зависимостей, а онлайн `CommentNode` переиспользовал тот же вид (DRY, без дивергенции презентации).

**Architecture:** Container/view split. Презентация (badge/автор/дата/тело-`AstRender`/сводка реакций/статичный якорь) живёт в чистом `CommentNodeView` (изоморфен: без `getMe`/`canX`/server actions/`getBlock`). Серверный `CommentNode` остаётся async-контейнером: считает RBAC/схему, резолвит якорь, и инжектит интерактив через **слоты** (`anchorSlot`/`reactionsSlot`/`actionsSlot`). Офлайн `CommentTreeView` рендерит `CommentNodeView` без слотов (read-only).

**Tech Stack:** React 19 server/client components, Next 16 App Router, vitest 4 + @testing-library/react (jsdom, globals:false), TypeScript 6 strict.

---

## Контекст и текущее состояние (прочитать перед стартом)

**Зачем F2:** slice L (офлайн-чтение лекции с комментами) требует рендерить комменты из снимка в client-`SavedLectureView`. Текущий `CommentNode` (`src/features/comments/ui/comment-node.tsx`) — async server component: дёргает `getMe()`, RBAC-хелперы (`canEditComment`/`canDeleteComment`/`canReactToComment`), а якорь резолвит через `CommentAnchorContext`→`getBlock()` (сеть). Всё это недоступно офлайн. F2 вытаскивает чистую презентацию в переиспользуемый вид.

**Текущая структура рендера комментов (факты разведки):**
- `comment-node.tsx` — async server: `getMe`+`canX`, рендер meta+`AstRender(blocks)`+`CommentReactions`(client)+edit/delete/reply-формы(client)+`CommentAnchorContext`(async getBlock). Локальная `formatDate`.
- `comment-tree.tsx` — `CommentTree`(subtrees)→`Branch`(рекурсия)→`CommentNode`; приватная `groupByParent`.
- `comment-reactions.tsx` — `"use client"`, интерактив (toggle + `setReaction`/`removeReaction`); внутри чистые `axisCount`/`myValue`.
- `admin-comment-row.tsx` — server, дублирует `dateFmt` и meta+`AstRender`.
- `comment-type-badge.tsx` — чистая функция-компонент (`CommentTypeBadge`, `commentTypeLabel`).
- `AstRender` (`@/components/ast-render`) — УЖЕ изоморфен (без `use client`/`server-only`), картинки = native `<img>` (`images.unoptimized:true`). Переиспользуем как есть.
- Cross-feature: рендер комментов НЕ импортирует другие `@/features/*` (только `@/components`/`@/utils`). Хорошо — чистый вид останется без фич-зависимостей.

**Тип `Comment`** (= `components["schemas"]["comment.Comment"]`): `id, user_id, parent_id?, type, blocks?, author?{username}, created_at?, is_edited?, is_deleted?, reactions?(ReactionSummary), my_reactions?, anchor?{ target_entity_type, start_block_id?, exact? }`. `ReactionSummary`: `{ agreement?{positive,negative}, quality?{positive,negative}, insight?(number) }`.

**Конвенции (frontend-conventions.md):** слайс-структура (`api/actions/permissions/schemas/types/ui`); kebab-case имён файлов; изоморфный рендер из фикстуры-снимка — целевой тест (spec §234). Запретные зоны НЕ трогаем: `src/components/ui/*`, `src/components/{shared,app,permission}`, `src/api/schema.ts`, `eslint.config.mjs`, `vitest.config.ts`, `package.json`. **Все новые файлы — в `src/features/comments/`** (фича-слайс, не заморожен).

**Тестовая среда:** vitest `globals:false` → в каждом тесте ЯВНО импортировать `describe/it/expect` (+`afterEach`,`vi` по нужде); RTL auto-cleanup НЕ активен → `afterEach(cleanup)` обязателен. В тестах комментов действуют `testing-library`-правила (НЕ использовать `container`/node-access — только `screen`-queries; послабление есть только для `ast-render`/`canvas-render`/`ast-editor`). Импорт-порядок: `import/order` с `newlines-between: always`, группы builtin→external→parent→sibling.

**Параллельная работа:** в проекте работают другие агенты. Добавлять только свои файлы по имени (НЕ `git add -A`), не откатывать чужое, без деструктивных git-операций.

**Нет существующих UI-тестов комментов** (есть только `permissions.test.ts`/`reactions.test.ts`/`schemas.test.ts`). Значит новые тесты вида — основная страховочная сеть рефактора; онлайн-поведение `CommentNode` дополнительно держат `pnpm typecheck`/`pnpm build`.

**Out of scope (YAGNI):** не меняем интерактивный `CommentReactions`, формы (edit/reply/delete), `CommentAnchorContext`, `CommentSection`, server actions, RBAC. Не трогаем `AstRender`. `AdminCommentRow` НЕ переводим целиком на `CommentNodeView` (другой layout) — только дедуп даты.

**Downstream-контракт для slice L:** офлайн-снимок лекции хранит комменты как `RootSubtree[]` — это поле `.subtrees` из результата `getLectureComments` (он возвращает `CommentListResult { subtrees, total }`, НЕ голый массив; класть в снимок именно `.subtrees`). `SavedLectureView` живёт в `app/saved/**` (композиционный корень — ESLint разрешает импорт `@/features/comments`; в `src/features/lectures/*` это был бы запрещённый cross-feature импорт) и рендерит `<CommentTreeView subtrees={snapshot.comments} />`. Склейку всех страниц комментов (бэк пагинирует; §225 — при лимите предупреждение) делает lecture-`assemble`, НЕ view. Якорь офлайн — статичный сниппет `anchor.exact` (без `getBlock`, беднее онлайн-плашки — by design); реакции — read-only сводка из `comment.reactions`; интерактив (reply/edit/delete/toggle) офлайн отсутствует by design.

---

## Файловая структура

- **Create:** `src/features/comments/comment-format.ts` (+ `.test.ts`) — `formatCommentDate`.
- **Create:** `src/features/comments/comment-tree-utils.ts` (+ `.test.ts`) — `groupByParent`.
- **Create:** `src/features/comments/ui/comment-reaction-summary.tsx` (+ `.test.tsx`) — read-only сводка.
- **Create:** `src/features/comments/ui/comment-node-view.tsx` (+ `.test.tsx`) — чистый вид со слотами.
- **Create:** `src/features/comments/ui/comment-tree-view.tsx` (+ `.test.tsx`) — чистое дерево.
- **Modify:** `src/features/comments/ui/comment-tree.tsx` — импорт `groupByParent` из utils.
- **Modify:** `src/features/comments/ui/admin-comment-row.tsx` — `formatCommentDate` (дедуп).
- **Modify:** `src/features/comments/ui/comment-node.tsx` — контейнер через `CommentNodeView`+слоты.
- **Modify:** `src/features/comments/index.ts` — экспорт `CommentNodeView`/`CommentTreeView`/`CommentReactionSummary`.

---

## Task 1: Чистые shared-хелперы (formatCommentDate + groupByParent)

**Files:**
- Create: `src/features/comments/comment-format.ts`, `src/features/comments/comment-format.test.ts`
- Create: `src/features/comments/comment-tree-utils.ts`, `src/features/comments/comment-tree-utils.test.ts`
- Modify: `src/features/comments/ui/comment-tree.tsx`, `src/features/comments/ui/admin-comment-row.tsx`

- [ ] **Step 1: Падающие тесты**

Создать `src/features/comments/comment-format.test.ts`:

```ts
// src/features/comments/comment-format.test.ts
import { describe, it, expect } from "vitest";

import { formatCommentDate } from "./comment-format";

describe("formatCommentDate", () => {
  it("форматирует валидный ISO (UTC)", () => {
    const out = formatCommentDate("2026-06-14T10:30:00Z");
    expect(out).toContain("2026");
    expect(out).toContain("10:30");
  });
  it("пустой/undefined → пустая строка", () => {
    expect(formatCommentDate(undefined)).toBe("");
    expect(formatCommentDate("")).toBe("");
  });
  it("битую строку возвращает как есть", () => {
    expect(formatCommentDate("not-a-date")).toBe("not-a-date");
  });
});
```

Создать `src/features/comments/comment-tree-utils.test.ts`:

```ts
// src/features/comments/comment-tree-utils.test.ts
import { describe, it, expect } from "vitest";

import { groupByParent } from "./comment-tree-utils";
import type { Comment } from "./types";

// Фикстура с ОБЯЗАТЕЛЬНЫМИ полями comment.Comment (created_at/updated_at/lecture_id/id/type)
// — без `as Comment`, иначе tsc даёт TS2352 (overlap) / лишний каст. Если tsc сообщит о
// ещё одном required-поле — добавить его сюда.
function node(id: string, parent_id?: string): Comment {
  return {
    id,
    user_id: "u",
    lecture_id: "l",
    type: "claim",
    blocks: [],
    created_at: "2026-06-14T00:00:00Z",
    updated_at: "2026-06-14T00:00:00Z",
    ...(parent_id ? { parent_id } : {}),
  };
}

describe("groupByParent", () => {
  it("корни группируются под null, дети — под parent_id", () => {
    const map = groupByParent([node("r"), node("a", "r"), node("b", "r")]);
    expect(map.get(null)?.map((n) => n.id)).toEqual(["r"]);
    expect(map.get("r")?.map((n) => n.id)).toEqual(["a", "b"]);
  });
  it("сохраняет порядок вставки детей", () => {
    const map = groupByParent([node("a", "r"), node("b", "r"), node("c", "r")]);
    expect(map.get("r")?.map((n) => n.id)).toEqual(["a", "b", "c"]);
  });
  it("пустой вход → пустая map", () => {
    expect(groupByParent([]).size).toBe(0);
  });
});
```

- [ ] **Step 2: Прогон — падает**

Run: `pnpm exec vitest run src/features/comments/comment-format.test.ts src/features/comments/comment-tree-utils.test.ts`
Expected: FAIL — модули `./comment-format` / `./comment-tree-utils` не найдены.

- [ ] **Step 3: Реализация**

Создать `src/features/comments/comment-format.ts`:

```ts
// src/features/comments/comment-format.ts
// Чистое форматирование даты комментария (изоморфно, без серверных зависимостей).
// Единый источник — дублировалось в comment-node.tsx и admin-comment-row.tsx.

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "UTC",
});

/** ISO → "дд.мм.гггг, чч:мм" (UTC). Пустая → ""; неразбираемая → возвращается как есть. */
export function formatCommentDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}
```

Создать `src/features/comments/comment-tree-utils.ts`:

```ts
// src/features/comments/comment-tree-utils.ts
// Чистая сборка дерева комментов из плоского списка (изоморфно).
import type { Comment } from "./types";

/** map parent_id (или null для корней) → упорядоченный список детей. */
export function groupByParent(nodes: Comment[]): Map<string | null, Comment[]> {
  const map = new Map<string | null, Comment[]>();
  for (const n of nodes) {
    const key = n.parent_id ?? null;
    const arr = map.get(key) ?? [];
    arr.push(n);
    map.set(key, arr);
  }
  return map;
}
```

- [ ] **Step 4: Прогон — зелёный**

Run: `pnpm exec vitest run src/features/comments/comment-format.test.ts src/features/comments/comment-tree-utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Переключить comment-tree.tsx на общий groupByParent**

В `src/features/comments/ui/comment-tree.tsx` УДАЛИТЬ локальную `function groupByParent(...) {...}` (строки 6-16) и добавить импорт. Итоговая шапка файла:

```tsx
// src/features/comments/ui/comment-tree.tsx
import { groupByParent } from "../comment-tree-utils";
import type { Comment, CommentSchema, RootSubtree } from "../types";

import { CommentNode } from "./comment-node";
```

(Остальное в файле — `BranchProps`/`Branch`/`Props`/`CommentTree` — без изменений; они уже зовут `groupByParent`.)

- [ ] **Step 6: Дедуп даты в admin-comment-row.tsx**

В `src/features/comments/ui/admin-comment-row.tsx` УДАЛИТЬ локальный `const dateFmt = ...` (строки 9-13), добавить импорт и заменить инлайн-формат. Изменения:

Шапку импортов привести к:

```tsx
// src/features/comments/ui/admin-comment-row.tsx
import { AstRender } from "@/components/ast-render";

import { formatCommentDate } from "../comment-format";
import type { Comment } from "../types";

import { CommentDeleteButton } from "./comment-delete-button";
import { CommentTypeBadge } from "./comment-type-badge";
```

Строку даты заменить:

```tsx
          <span>{comment.created_at ? dateFmt.format(new Date(comment.created_at)) : ""}</span>
```

на:

```tsx
          <span>{formatCommentDate(comment.created_at)}</span>
```

- [ ] **Step 7: Гейт + коммит**

Run: `pnpm exec vitest run src/features/comments/ && pnpm lint && pnpm typecheck`
Expected: тесты PASS, lint 0, typecheck 0.

```bash
git add src/features/comments/comment-format.ts src/features/comments/comment-format.test.ts src/features/comments/comment-tree-utils.ts src/features/comments/comment-tree-utils.test.ts src/features/comments/ui/comment-tree.tsx src/features/comments/ui/admin-comment-row.tsx
git commit -m "refactor(comments): extract pure formatCommentDate + groupByParent (F2 task 1)"
```

---

## Task 2: Read-only сводка реакций (CommentReactionSummary)

**Files:**
- Create: `src/features/comments/ui/comment-reaction-summary.tsx`, `src/features/comments/ui/comment-reaction-summary.test.tsx`

- [ ] **Step 1: Падающий тест**

Создать `src/features/comments/ui/comment-reaction-summary.test.tsx`:

```tsx
// src/features/comments/ui/comment-reaction-summary.test.tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";

import { CommentReactionSummary } from "./comment-reaction-summary";

afterEach(cleanup);

describe("CommentReactionSummary", () => {
  it("рендерит сводку agreement (+pos / −neg)", () => {
    render(
      <CommentReactionSummary
        reactions={{ agreement: { positive: 3, negative: 1 } }}
      />,
    );
    expect(screen.getByText("+3 / −1")).toBeTruthy();
  });

  it("рендерит insight как ★ count", () => {
    render(<CommentReactionSummary reactions={{ insight: 5 }} />);
    expect(screen.getByText("★ 5")).toBeTruthy();
  });

  it("undefined reactions → ничего (null)", () => {
    render(<CommentReactionSummary reactions={undefined} />);
    expect(screen.queryByText(/./)).toBeNull();
  });

  it("пустая сводка (нули) → ничего", () => {
    render(
      <CommentReactionSummary
        reactions={{ agreement: { positive: 0, negative: 0 } }}
      />,
    );
    expect(screen.queryByText(/./)).toBeNull();
  });
});
```

> Используем `screen.queryByText(/./)` (а не `container`), чтобы не зависеть от `testing-library/no-container` (error для тестов комментов).

- [ ] **Step 2: Прогон — падает**

Run: `pnpm exec vitest run src/features/comments/ui/comment-reaction-summary.test.tsx`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализация**

Создать `src/features/comments/ui/comment-reaction-summary.tsx`:

```tsx
// src/features/comments/ui/comment-reaction-summary.tsx
// Чистая read-only сводка реакций (изоморфно, без интерактива/actions/схемы).
// Презентационный двойник интерактивного CommentReactions для офлайн-рендера.
import { REACTION_AXES, axisLabel } from "../reactions";
import type { ReactionAxis, ReactionSummary } from "../types";

function axisCount(summary: ReactionSummary, axis: ReactionAxis): string {
  if (axis === "insight") return summary.insight ? `★ ${summary.insight}` : "★";
  const c = axis === "agreement" ? summary.agreement : summary.quality;
  const pos = c?.positive ?? 0;
  const neg = c?.negative ?? 0;
  return `+${pos} / −${neg}`;
}

function hasData(summary: ReactionSummary, axis: ReactionAxis): boolean {
  if (axis === "insight") return (summary.insight ?? 0) > 0;
  const c = axis === "agreement" ? summary.agreement : summary.quality;
  return (c?.positive ?? 0) > 0 || (c?.negative ?? 0) > 0;
}

export function CommentReactionSummary({
  reactions,
}: {
  reactions: ReactionSummary | undefined;
}) {
  if (!reactions) return null;
  const axes = REACTION_AXES.filter((a) => hasData(reactions, a));
  if (axes.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-(--color-description)">
      {axes.map((axis) => (
        <span key={axis} className="flex items-center gap-1">
          <span>{axisLabel(axis)}:</span>
          <span>{axisCount(reactions, axis)}</span>
        </span>
      ))}
    </div>
  );
}
```

> Если `REACTION_AXES` типизирован `readonly ReactionAxis[]` — `.filter` вернёт `ReactionAxis[]`, `axisLabel(axis)`/`axisCount` принимают `ReactionAxis`. Если фактический union осей отличается — свериться с `../reactions` и `../types` (тип `ReactionAxis`).

- [ ] **Step 4: Прогон — зелёный + lint/typecheck**

Run: `pnpm exec vitest run src/features/comments/ui/comment-reaction-summary.test.tsx && pnpm lint && pnpm typecheck`
Expected: PASS, lint 0, typecheck 0.

- [ ] **Step 5: Коммит**

```bash
git add src/features/comments/ui/comment-reaction-summary.tsx src/features/comments/ui/comment-reaction-summary.test.tsx
git commit -m "feat(comments): read-only reaction summary view (F2 task 2)"
```

---

## Task 3: Чистый вид узла (CommentNodeView)

**Files:**
- Create: `src/features/comments/ui/comment-node-view.tsx`, `src/features/comments/ui/comment-node-view.test.tsx`

- [ ] **Step 1: Падающий тест**

Создать `src/features/comments/ui/comment-node-view.test.tsx`:

```tsx
// src/features/comments/ui/comment-node-view.test.tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";

import { CommentNodeView } from "./comment-node-view";
import type { Comment } from "../types";

afterEach(cleanup);

// Полная фикстура с обязательными полями comment.Comment — без `as` (иначе TS2352/лишний каст).
function base(over: Partial<Comment> = {}): Comment {
  return {
    id: "c1",
    user_id: "u1",
    lecture_id: "l1",
    type: "claim",
    blocks: [],
    author: { username: "alice" },
    created_at: "2026-06-14T10:30:00Z",
    updated_at: "2026-06-14T10:30:00Z",
    ...over,
  };
}

describe("CommentNodeView", () => {
  it("рендерит автора и дату", () => {
    render(<CommentNodeView comment={base()} />);
    expect(screen.getByText("alice")).toBeTruthy();
    expect(screen.getByText(/2026/)).toBeTruthy();
  });

  it("is_deleted → плашка, без тела", () => {
    render(<CommentNodeView comment={base({ is_deleted: true })} />);
    expect(screen.getByText("Комментарий удалён")).toBeTruthy();
    expect(screen.queryByText("alice")).toBeNull();
  });

  it("офлайн якорь: статичный сниппет anchor.exact (без слота)", () => {
    render(
      <CommentNodeView
        comment={base({
          anchor: {
            target_entity_type: "document",
            target_entity_id: "d1",
            exact: "цитата из текста",
          },
        })}
      />,
    );
    expect(screen.getByText("цитата из текста")).toBeTruthy();
  });

  it("офлайн реакции: read-only сводка (без слота)", () => {
    render(
      <CommentNodeView
        comment={base({ reactions: { agreement: { positive: 2, negative: 0 } } })}
      />,
    );
    expect(screen.getByText("+2 / −0")).toBeTruthy();
  });

  it("слоты переопределяют read-only части", () => {
    render(
      <CommentNodeView
        comment={base({
          anchor: {
            target_entity_type: "document",
            target_entity_id: "d1",
            exact: "static",
          },
          reactions: { agreement: { positive: 9, negative: 9 } },
        })}
        anchorSlot={<div>ANCHOR_SLOT</div>}
        reactionsSlot={<div>RXN_SLOT</div>}
        actionsSlot={<div>ACTIONS_SLOT</div>}
      />,
    );
    expect(screen.getByText("ANCHOR_SLOT")).toBeTruthy();
    expect(screen.getByText("RXN_SLOT")).toBeTruthy();
    expect(screen.getByText("ACTIONS_SLOT")).toBeTruthy();
    expect(screen.queryByText("static")).toBeNull();
    expect(screen.queryByText("+9 / −9")).toBeNull();
  });
});
```

- [ ] **Step 2: Прогон — падает**

Run: `pnpm exec vitest run src/features/comments/ui/comment-node-view.test.tsx`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализация**

Создать `src/features/comments/ui/comment-node-view.tsx`:

```tsx
// src/features/comments/ui/comment-node-view.tsx
// Чистый изоморфный read-only вид одного комментария: badge/автор/дата/якорь-сниппет/
// тело(AstRender)/сводка реакций. БЕЗ getMe/canX/actions/getBlock — рендерится и на
// сервере, и на клиенте (офлайн SavedLectureView из снимка). Интерактив и резолв якоря
// онлайн-контейнер (CommentNode) инжектит через слоты.
import type { ReactNode } from "react";

import { AstRender } from "@/components/ast-render";

import { formatCommentDate } from "../comment-format";
import type { Comment } from "../types";

import { CommentReactionSummary } from "./comment-reaction-summary";
import { CommentTypeBadge } from "./comment-type-badge";

interface Props {
  comment: Comment;
  /** Онлайн: резолвленный контекст якоря (CommentAnchorContext). Офлайн (undefined): статичный сниппет. */
  anchorSlot?: ReactNode;
  /** Онлайн: интерактивные реакции (CommentReactions). Офлайн (undefined): read-only сводка. */
  reactionsSlot?: ReactNode;
  /** Онлайн: кнопки edit/delete/reply. Офлайн: отсутствует. */
  actionsSlot?: ReactNode;
}

export function CommentNodeView({
  comment,
  anchorSlot,
  reactionsSlot,
  actionsSlot,
}: Props): ReactNode {
  if (comment.is_deleted) {
    return (
      <div className="rounded border border-dashed border-(--color-border) p-3 text-sm text-(--color-description)">
        Комментарий удалён
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-(--color-border) p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-(--color-description)">
        <CommentTypeBadge type={comment.type} />
        <span>{comment.author?.username ?? "—"}</span>
        <span>{formatCommentDate(comment.created_at)}</span>
        {comment.is_edited && <span>(изменён)</span>}
      </div>

      {anchorSlot ??
        (comment.anchor?.exact ? (
          <p className="border-l-2 border-(--color-border) pl-2 text-xs italic text-(--color-description)">
            {comment.anchor.exact}
          </p>
        ) : null)}

      <div className="prose prose-sm max-w-none">
        <AstRender blocks={comment.blocks ?? []} />
      </div>

      {reactionsSlot ?? <CommentReactionSummary reactions={comment.reactions} />}

      {actionsSlot}
    </div>
  );
}
```

> Свериться: поле текст-сниппета якоря в типе `Comment["anchor"]` — `exact` (как в `comment-anchor-context.tsx`). Если иначе — поправить обе ссылки (`comment.anchor?.exact`).

- [ ] **Step 4: Прогон — зелёный + lint/typecheck**

Run: `pnpm exec vitest run src/features/comments/ui/comment-node-view.test.tsx && pnpm lint && pnpm typecheck`
Expected: PASS, lint 0, typecheck 0.

- [ ] **Step 5: Коммит**

```bash
git add src/features/comments/ui/comment-node-view.tsx src/features/comments/ui/comment-node-view.test.tsx
git commit -m "feat(comments): pure isomorphic CommentNodeView with slots (F2 task 3)"
```

---

## Task 4: Контейнер CommentNode через CommentNodeView

Онлайн-поведение не меняется: контейнер считает RBAC/схему, резолвит якорь, инжектит интерактив в слоты. Презентация теперь единая (из `CommentNodeView`).

**Files:**
- Modify: `src/features/comments/ui/comment-node.tsx`

- [ ] **Step 1: Заменить comment-node.tsx целиком**

Полностью заменить содержимое `src/features/comments/ui/comment-node.tsx` на:

```tsx
// src/features/comments/ui/comment-node.tsx
import { getMe } from "@/utils/me";

import {
  canDeleteComment,
  canEditComment,
  canReactToComment,
} from "../permissions";
import { axisAllowedForType } from "../reactions";
import type { Comment, CommentSchema, ReactionAxis } from "../types";

import { CommentAnchorContext } from "./comment-anchor-context";
import { CommentDeleteButton } from "./comment-delete-button";
import { CommentEditForm } from "./comment-edit-form";
import { CommentNodeView } from "./comment-node-view";
import { CommentReactions } from "./comment-reactions";
import { CommentReplyForm } from "./comment-reply-form";

interface Props {
  comment: Comment;
  lectureId: string;
  schema: CommentSchema;
}

export async function CommentNode({ comment, lectureId, schema }: Props) {
  const me = await getMe();

  if (comment.is_deleted) {
    return <CommentNodeView comment={comment} />;
  }

  const type = comment.type;
  const allowedAxes = (schema.allowed_reactions?.[type] ?? []).filter(
    (a): a is ReactionAxis => axisAllowedForType(schema, type, a),
  );
  const childTypes = schema.allowed_children?.[type] ?? [];

  return (
    <CommentNodeView
      comment={comment}
      anchorSlot={
        comment.anchor ? <CommentAnchorContext anchor={comment.anchor} /> : undefined
      }
      reactionsSlot={
        <CommentReactions
          commentId={comment.id}
          type={type}
          reactions={comment.reactions}
          myReactions={comment.my_reactions}
          allowedAxes={allowedAxes}
          canReact={canReactToComment(me, comment)}
        />
      }
      actionsSlot={
        <div className="flex flex-wrap items-center gap-2">
          {canEditComment(me, comment) && (
            <CommentEditForm
              commentId={comment.id}
              lectureId={lectureId}
              initialBlocks={comment.blocks ?? []}
            />
          )}
          {canDeleteComment(me, comment) && (
            <CommentDeleteButton
              commentId={comment.id}
              admin={comment.user_id !== me?.id}
            />
          )}
          {me && (
            <CommentReplyForm
              lectureId={lectureId}
              parentId={comment.id}
              childTypes={childTypes}
            />
          )}
        </div>
      }
    />
  );
}
```

Заметки по эквивалентности (онлайн-поведение прежнее):
- meta/тело/якорь/реакции/кнопки рендерятся теми же компонентами и в том же порядке, что и раньше; разница лишь в том, что обёртка/meta вынесены в `CommentNodeView`.
- `CommentReactions` сам возвращает `null` при пустых `allowedAxes` — слот непустой (JSX-элемент), поэтому read-only сводка офлайн-фолбэка онлайн НЕ подмешивается. Поведение «нет осей → нет реакций» сохранено.
- `CommentTypeBadge` теперь рендерит `CommentNodeView` (импорт убран из контейнера) — функционально идентично.

- [ ] **Step 2: Гейт**

Run: `pnpm lint && pnpm typecheck && pnpm exec vitest run src/features/comments/`
Expected: lint 0, typecheck 0, тесты PASS.

- [ ] **Step 3: Смоук онлайн-эквивалентности (ОБЯЗАТЕЛЬНО)**

Новые view-тесты НЕ покрывают сборку слотов контейнером (`canReact`/`allowedAxes`/`childTypes`/`admin`), а UI-тестов `CommentNode` в проекте нет — единственная проверка RBAC-веток помимо code-review диффа. Открыть `/lectures/[id]` и убедиться, что онлайн-поведение прежнее: автору коммента видны edit+delete, не-автору с правами — delete, залогиненному — reply, реакции кликабельны; удалённый коммент — плашка «Комментарий удалён». Если среда без браузера — зафиксировать это ограничение в отчёте (не выдавать за проверенное).

- [ ] **Step 4: Коммит**

```bash
git add src/features/comments/ui/comment-node.tsx
git commit -m "refactor(comments): CommentNode container reuses CommentNodeView via slots (F2 task 4)"
```

---

## Task 5: Чистое дерево (CommentTreeView)

**Files:**
- Create: `src/features/comments/ui/comment-tree-view.tsx`, `src/features/comments/ui/comment-tree-view.test.tsx`

- [ ] **Step 1: Падающий тест**

Создать `src/features/comments/ui/comment-tree-view.test.tsx`:

```tsx
// src/features/comments/ui/comment-tree-view.test.tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";

import { CommentTreeView } from "./comment-tree-view";
import type { Comment, RootSubtree } from "../types";

afterEach(cleanup);

// Полная фикстура с обязательными полями comment.Comment — без `as`.
function node(id: string, username: string, parent_id?: string): Comment {
  return {
    id,
    user_id: "u",
    lecture_id: "l",
    type: "claim",
    blocks: [],
    author: { username },
    created_at: "2026-06-14T00:00:00Z",
    updated_at: "2026-06-14T00:00:00Z",
    ...(parent_id ? { parent_id } : {}),
  };
}

describe("CommentTreeView", () => {
  it("пусто → плашка", () => {
    render(<CommentTreeView subtrees={[]} />);
    expect(screen.getByText("Комментариев пока нет.")).toBeTruthy();
  });

  it("рендерит корень и потомков (read-only)", () => {
    const subtrees: RootSubtree[] = [
      {
        root: node("r", "root-author"),
        descendants: [node("a", "child-author", "r")],
      },
    ];
    render(<CommentTreeView subtrees={subtrees} />);
    expect(screen.getByText("root-author")).toBeTruthy();
    expect(screen.getByText("child-author")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Прогон — падает**

Run: `pnpm exec vitest run src/features/comments/ui/comment-tree-view.test.tsx`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализация**

Создать `src/features/comments/ui/comment-tree-view.tsx`:

```tsx
// src/features/comments/ui/comment-tree-view.tsx
// Чистое изоморфное read-only дерево комментов: рекурсивно рендерит CommentNodeView
// через groupByParent. Для офлайн-рендера снимка (slice L). Без серверных зависимостей.
import { groupByParent } from "../comment-tree-utils";
import type { Comment, RootSubtree } from "../types";

import { CommentNodeView } from "./comment-node-view";

function BranchView({
  node,
  childrenMap,
}: {
  node: Comment;
  childrenMap: Map<string | null, Comment[]>;
}) {
  const kids = childrenMap.get(node.id) ?? [];
  return (
    <li className="flex flex-col gap-2">
      <CommentNodeView comment={node} />
      {kids.length > 0 && (
        <ul className="ml-4 flex flex-col gap-2 border-l border-(--color-border) pl-3">
          {kids.map((kid) => (
            <BranchView key={kid.id} node={kid} childrenMap={childrenMap} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CommentTreeView({ subtrees }: { subtrees: RootSubtree[] }) {
  if (subtrees.length === 0) {
    return (
      <p className="text-sm text-(--color-description)">Комментариев пока нет.</p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {subtrees.flatMap((st) => {
        const root = st.root;
        if (!root) return [];
        const childrenMap = groupByParent([...(st.descendants ?? [])]);
        return [<BranchView key={root.id} node={root} childrenMap={childrenMap} />];
      })}
    </ul>
  );
}
```

- [ ] **Step 4: Прогон — зелёный + lint/typecheck**

Run: `pnpm exec vitest run src/features/comments/ui/comment-tree-view.test.tsx && pnpm lint && pnpm typecheck`
Expected: PASS, lint 0, typecheck 0.

- [ ] **Step 5: Коммит**

```bash
git add src/features/comments/ui/comment-tree-view.tsx src/features/comments/ui/comment-tree-view.test.tsx
git commit -m "feat(comments): pure isomorphic CommentTreeView for offline render (F2 task 5)"
```

---

## Task 6: Публичные экспорты для slice L

**Files:**
- Modify: `src/features/comments/index.ts`

- [ ] **Step 1: Добавить экспорты**

В `src/features/comments/index.ts` после строки `export { CommentTree } from "./ui/comment-tree";` добавить:

```ts
export { CommentNodeView } from "./ui/comment-node-view";
export { CommentTreeView } from "./ui/comment-tree-view";
export { CommentReactionSummary } from "./ui/comment-reaction-summary";
```

- [ ] **Step 2: Гейт**

Run: `pnpm lint && pnpm typecheck && pnpm exec vitest run src/features/comments/`
Expected: lint 0 (в т.ч. `import/no-cycle` — нет циклов: view-файлы зависят только от `../types`/`../reactions`/`../comment-format`/`@/components/ast-render`), typecheck 0, тесты PASS.

- [ ] **Step 3: Коммит**

```bash
git add src/features/comments/index.ts
git commit -m "feat(comments): export isomorphic comment views for offline (F2 task 6)"
```

---

## Финальная проверка (полный гейт)

- [ ] **Step 1: Прогон всего гейта**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected:
- `lint` — 0 ошибок.
- `typecheck` — 0 ошибок (учесть: ветка может содержать чужую правку `src/api/schema.ts` — если есть несвязанные с F2 ошибки в других фичах, зафиксировать отдельно, не как провал F2).
- `test` — все зелёные, +~14 тестов (format/tree-utils/reaction-summary/node-view/tree-view).
- `build` — успешная сборка (онлайн-страница лекции с `CommentSection` компилируется и рендерит контейнер `CommentNode` как прежде).

---

## Self-Review (автор плана)

**Покрытие F2 (spec §205, §184):**
- «вынос чистых хелперов рендера» → Task 1 (`formatCommentDate`, `groupByParent`), Task 2 (`CommentReactionSummary`).
- «рефактор CommentNode → контейнер/view» → Task 3 (`CommentNodeView`) + Task 4 (контейнер через слоты).
- «изоморфные `CommentTree`+`groupByParent`, read-only-двойники (`CommentNodeView`), якорь без фетча, сводка реакций» → Task 3/5 (`CommentNodeView`/`CommentTreeView`, статичный `anchor.exact`, `CommentReactionSummary`).

**Тип-консистентность:** имена едины во всех задачах — `formatCommentDate`, `groupByParent`, `CommentReactionSummary`, `CommentNodeView` (props `comment`/`anchorSlot`/`reactionsSlot`/`actionsSlot`), `CommentTreeView` (props `subtrees`). Слоты — `ReactNode`, `?? fallback` корректно (JSX-элемент непустой ⇒ берётся слот; `undefined` ⇒ read-only фолбэк).

**Плейсхолдеры:** нет — весь код дословный, команды с ожидаемым выводом.

**Риски/допущения (свёрено 5-агентным адверсариальным ревью):**
1. **`anchor.exact` ПОДТВЕРЖДЁН** (`schema.ts` `comment.Anchor.exact?: string`; используется в `comment-anchor-context.tsx`). `comment.Anchor` ТАКЖЕ требует `target_entity_id` — anchor-фикстуры тестов это учитывают.
2. **`REACTION_AXES`/`ReactionAxis` ПОДТВЕРЖДЕНЫ**: `REACTION_AXES: ReactionAxis[]` (mutable, НЕ readonly) = `agreement|quality|insight`; `ReactionSummary.insight?: number`. `.filter`/`axisLabel`/`axisCount` типобезопасны (прогнано реальным tsc/eslint).
3. **Тест-фикстуры** строятся с ОБЯЗАТЕЛЬНЫМИ полями `comment.Comment` (`id/user_id/lecture_id/type/created_at/updated_at`+`blocks`) БЕЗ `as Comment` — иначе `tsc` даёт TS2352 (overlap). Если tsc сообщит о ещё одном required-поле — добавить в фикстуру.
4. **Контекст форм НЕ ломается** переездом edit/reply в `actionsSlot`: JSX слотов создаётся в JSX серверного контейнера `CommentNode`, поэтому провайдеры-предки (`SchemaContextProvider` вокруг `CommentSection`) сохраняются; формы читают данные пропами (`childTypes`/`initialBlocks`), а не React-контекст. (Проверено ревью — Important снят.)
5. **Нет UI-тестов `CommentNode`** — RBAC-сборка слотов контейнером покрыта только обязательным смоуком (Task 4 Step 3) + typecheck/build; новые тесты покрывают сам `CommentNodeView`/`CommentTreeView`.
6. **Параллельные агенты** в `src/features/comments/` — только свои файлы по имени, без `git add -A`; перед правкой `comment-tree.tsx`/`admin-comment-row.tsx`/`comment-node.tsx` переснять номера строк (могли сдвинуться).
7. **Известные ограничения (эквивалентны текущему онлайн `CommentTree`, НЕ регресс F2 — бэклог):** орфаны (узел с отсутствующим среди обходимых `parent_id`) молча не рендерятся; циклы `parent_id` → бесконечная рекурсия (нет visited-set); дубли `id` → коллизия React-ключей. Учесть при отладке офлайн-снимка из IndexedDB в slice L.
8. **Слот-контракт:** для read-only-фолбэка передавать `undefined` (не `null`/`false`/`0`) — `??` трактует только nullish.
