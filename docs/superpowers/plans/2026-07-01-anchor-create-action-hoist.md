# Hoist page-level create-anchor действий из per-scope компонентов — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Вынести selection-driven действия создания якоря (`id="annotation"`, `id="comment-anchor"`) из множимых per-scope компонентов в один page-level маунт на страницу, устранив латентный баг «первый unmount убирает действие для всех» и N× register-churn.

**Architecture:** Действие уже опирается только на `draft.scope` (скоуп выделения), не на пропсы компонента — значит оно page-level по природе. Регистрацию (`useStableAnchorAction`) + владение composer-диалогом переносим в новые self-contained client-компоненты (`AnnotationSelectionComposer`, `CommentAnchorSelectionComposer`), которые монтируются один раз на страницу через server-ассемблеры (`AnnotationCreateAffordance`, `CommentAnchorCreateAffordance`, зеркалят стиль `DocumentAnnotations`/`DocumentComments`). Per-scope `AnnotationScope`/`CommentAnchorScope` оставляют только законно-множимое: rail-регистрацию (ключ по скоупу), fallback-рендер и document-only тулбар (тумблер подсветки + «add unanchored» со своим локальным композером).

**Tech Stack:** Next 16 (RSC + server components), React 19, TypeScript, Vitest + @testing-library/react, pnpm, next-intl (`useT`/`getT`), Base UI kit.

## Global Constraints

- Общаться с пользователем на русском; именование файлов в `src/` — kebab-case.
- Параллельные агенты: НЕ `git add -A`/`.`; НЕ деструктивные git-операции; коммитить только свои файлы по имени (`git add <path> && git commit --only <path>`). Страницы `src/app/**/page.tsx` — hot-файлы: перед коммитом `git status`, коммитить по имени.
- RBAC: право на создание — плоские капабилити `canCreateAnnotation(me) = can(me, "annotation.create")`, `canCreateComment(me) = can(me, "comment.create")`. `permissions.ts` — `server-only`, зовутся только из server-компонентов.
- Guardrail 4 (client-safe слайс-файлы): client-коннекторы импортят только pure-фасады (`../anchor`, `../types`), движок (`@/components/anchor-engine`), kit (`@/components/ui`), `@/i18n/client`, локальные композеры — НЕ `server-only` (`api`/`actions`/`permissions`/`schema-server`).
- Перед завершением ветки зелёными: `pnpm lint && pnpm test && pnpm build`.
- Один действующий контекст: `id="annotation"` регистрируется РОВНО один раз на страницу; `id="comment-anchor"` — ровно один раз. Rail-ключи неизменны: `annotation:<type>:<id>`, `comment:document:<id>`.

---

### Task 1: `AnnotationSelectionComposer` (client, self-contained action + composer)

Переносит логику `annotation-create-action.tsx` (регистрация действия + маршрутизация `onCreate` по `draft.scope`) и composer-владение внутрь одного client-компонента. Пока НИЧЕГО не удаляем — дерево остаётся зелёным (аддитивно; временно два регистранта `id="annotation"`, реестр идемпотентен по id).

**Files:**
- Create: `src/features/annotations/ui/annotation-selection-composer.tsx`
- Test: `src/features/annotations/ui/annotation-selection-composer.test.tsx`

**Interfaces:**
- Consumes: `useStableAnchorAction`, `type AnchorDraft` из `@/components/anchor-engine`; `fromEngineAnchor` из `../anchor`; `PARENT_ENTITY_TYPES`, `type Anchor`, `type ParentEntityType` из `../types`; `AnnotationComposerDialog` из `./annotation-composer-dialog`; `useT` из `@/i18n/client`.
- Produces: `export function AnnotationSelectionComposer(): JSX.Element` — без пропов; регистрирует `id="annotation"` (`enabled: true`, `appliesTo` = любой скоуп), открывает `AnnotationComposerDialog` с parent/anchor из `draft.scope`.

- [ ] **Step 1: Write the failing test**

`src/features/annotations/ui/annotation-selection-composer.test.tsx`:

```tsx
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnchorDraft } from "@/components/anchor-engine";

import { AnnotationSelectionComposer } from "./annotation-selection-composer";

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

// jsdom не даёт живого Selection → перехватываем cfg, который компонент
// регистрирует через useStableAnchorAction, и зовём onCreate синтетическим драфтом.
let captured: { onCreate: (d: AnchorDraft) => void } | null = null;
const registerSpy = vi.fn();
vi.mock("@/components/anchor-engine", () => ({
  useStableAnchorAction: (cfg: { onCreate: (d: AnchorDraft) => void }) => {
    registerSpy(cfg);
    captured = cfg;
  },
}));

// Композер-диалог мокаем: выносим props в data-атрибуты для ассерта.
vi.mock("./annotation-composer-dialog", () => ({
  AnnotationComposerDialog: ({
    parentEntityType,
    parentId,
    open,
    anchor,
  }: {
    parentEntityType?: string;
    parentId: string;
    open: boolean;
    anchor?: { exact?: string };
  }) =>
    open ? (
      <div
        data-testid="composer"
        data-parent-entity-type={parentEntityType}
        data-parent-id={parentId}
        data-anchor-exact={anchor?.exact ?? ""}
      />
    ) : null,
}));

function draftIn(entityType: string, entityId: string): AnchorDraft {
  return {
    anchor: {
      startBlockId: "b1",
      startNodeId: "b1",
      endBlockId: "b1",
      endNodeId: "b1",
      startChar: 0,
      endChar: 5,
      exact: "hello",
    },
    rect: { top: 0, left: 0, width: 0, height: 0 } as DOMRect,
    scope: { entityType, entityId },
  };
}

afterEach(() => {
  cleanup();
  captured = null;
  registerSpy.mockClear();
});

function onCreate(): (d: AnchorDraft) => void {
  if (!captured) throw new Error("AnnotationSelectionComposer не зарегистрировал действие");
  return captured.onCreate;
}

describe("AnnotationSelectionComposer", () => {
  it("регистрирует ровно одно действие через useStableAnchorAction", () => {
    render(<AnnotationSelectionComposer />);
    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(registerSpy).toHaveBeenCalledWith(expect.objectContaining({ id: "annotation" }));
  });

  it("открывает композер с parent/anchor ИЗ ДРАФТА (document)", () => {
    render(<AnnotationSelectionComposer />);
    act(() => {
      onCreate()(draftIn("document", "doc-7"));
    });
    const composer = screen.getByTestId("composer");
    expect(composer.getAttribute("data-parent-entity-type")).toBe("document");
    expect(composer.getAttribute("data-parent-id")).toBe("doc-7");
    expect(composer.getAttribute("data-anchor-exact")).toBe("hello");
  });

  it("маршрутизирует на comment-скоуп из драфта (не из пропа — пропов нет)", () => {
    render(<AnnotationSelectionComposer />);
    act(() => {
      onCreate()(draftIn("comment", "cmt-42"));
    });
    const composer = screen.getByTestId("composer");
    expect(composer.getAttribute("data-parent-entity-type")).toBe("comment");
    expect(composer.getAttribute("data-parent-id")).toBe("cmt-42");
  });

  it("не открывает композер, если скоуп не является UI-parent аннотации", () => {
    render(<AnnotationSelectionComposer />);
    act(() => {
      // "banner" — валидный backend parent, но НЕ из UI-набора PARENT_ENTITY_TYPES.
      onCreate()(draftIn("banner", "ban-1"));
    });
    expect(screen.queryByTestId("composer")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/features/annotations/ui/annotation-selection-composer.test.tsx`
Expected: FAIL — `Failed to resolve import "./annotation-selection-composer"` (файл ещё не создан).

- [ ] **Step 3: Write minimal implementation**

`src/features/annotations/ui/annotation-selection-composer.tsx`:

```tsx
"use client";
// src/features/annotations/ui/annotation-selection-composer.tsx
// ЕДИНСТВЕННЫЙ page-level маунт действия «аннотировать»: регистрирует id="annotation"
// в движке ОДИН раз на страницу (монтируется server-ассемблером AnnotationCreateAffordance
// под AnchorScopeProvider) и владеет composer-диалогом. onCreate берёт parent/anchor из
// draft.scope (скоуп выделения), поэтому одно действие корректно обслуживает ВСЕ скоупы
// (документ + каждый комментарий). Раньше это регистрировалось из каждого AnnotationScope
// → N дублей одного id + латентный баг (первый unmount убирал действие для всех).
// Guardrail 4: только pure-фасады (../anchor, ../types) + движок + i18n/client + композер.
import { useState } from "react";

import { type AnchorDraft, useStableAnchorAction } from "@/components/anchor-engine";
import { useT } from "@/i18n/client";

import { fromEngineAnchor } from "../anchor";
import { PARENT_ENTITY_TYPES, type Anchor, type ParentEntityType } from "../types";

import { AnnotationComposerDialog } from "./annotation-composer-dialog";

// Type-guard на границе движок→слайс: draft.scope.entityType это string; сужаем к
// ParentEntityType по рантайм-набору (document/glossary/media/comment).
function isParentEntityType(value: string): value is ParentEntityType {
  return (PARENT_ENTITY_TYPES as readonly string[]).includes(value);
}

// Стабильная module-scope ссылка предиката (defense-in-depth: движок ref-стабилизирует
// appliesTo, но передаём константу, чтобы слайс физически не мог переинтродьюсить инлайн).
const APPLIES_TO_ANY = () => true; // аннотировать можно любой AST-скоуп

export function AnnotationSelectionComposer() {
  const t = useT("annotations");
  const [composer, setComposer] = useState<{
    open: boolean;
    anchor?: Anchor;
    parentId: string;
    parentEntityType: ParentEntityType;
  }>({ open: false, parentId: "", parentEntityType: "document" });

  useStableAnchorAction({
    id: "annotation",
    label: t("marginAddButton"),
    enabled: true,
    appliesTo: APPLIES_TO_ANY,
    onCreate: (d: AnchorDraft) => {
      if (!isParentEntityType(d.scope.entityType)) return;
      setComposer({
        open: true,
        anchor: fromEngineAnchor(d.anchor),
        parentId: d.scope.entityId,
        parentEntityType: d.scope.entityType,
      });
    },
  });

  return (
    <AnnotationComposerDialog
      parentEntityType={composer.parentEntityType}
      parentId={composer.parentId}
      open={composer.open}
      onOpenChange={(open) => {
        setComposer((c) => ({ ...c, open }));
      }}
      anchor={composer.anchor}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/features/annotations/ui/annotation-selection-composer.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/annotations/ui/annotation-selection-composer.tsx src/features/annotations/ui/annotation-selection-composer.test.tsx
git commit --only src/features/annotations/ui/annotation-selection-composer.tsx src/features/annotations/ui/annotation-selection-composer.test.tsx -m "feat(annotations): AnnotationSelectionComposer — page-level действие аннотации + композер"
```

---

### Task 2: `AnnotationCreateAffordance` (server) + монтаж на страницах

Server-ассемблер, который считает право + грузит AST-схему и монтирует client-композер один раз на страницу. Аддитивно: страницы получают page-level регистрацию `id="annotation"` (per-scope пока тоже регистрирует — идемпотентно, снимем в Task 3).

**Files:**
- Create: `src/features/annotations/ui/annotation-create-affordance.tsx`
- Modify: `src/features/annotations/index.ts` (добавить экспорт)
- Modify: `src/app/lectures/[id]/page.tsx` (импорт + маунт)
- Modify: `src/app/documents/[id]/page.tsx` (импорт + маунт)

**Interfaces:**
- Consumes: `getMe` из `@/utils/me`; `canCreateAnnotation` из `../permissions`; `getAstSchema` из `@/components/ast-editor/schema-server`; `SchemaContextProvider` из `@/components/ast-editor/schema-context`; `AnnotationSelectionComposer` (Task 1).
- Produces: `export async function AnnotationCreateAffordance(): Promise<JSX.Element | null>` — `null` при `!canCreateAnnotation(me)`; иначе client-композер под `SchemaContextProvider`. Экспортируется из `@/features/annotations`.

- [ ] **Step 1: Write the implementation (server component, без юнит-теста)**

Server-ассемблеры в этом слайсе (`DocumentAnnotations`) юнит-тестами не покрыты (async RSC + fetch) — проверяем сборкой/типами. `src/features/annotations/ui/annotation-create-affordance.tsx`:

```tsx
// src/features/annotations/ui/annotation-create-affordance.tsx
// Server-ассемблер page-level действия «аннотировать»: считает право (плоская капа
// annotation.create) и серверно грузит AST-схему (композер монтирует AstEditor для
// тела аннотации), затем монтирует client-композер ОДИН раз на страницу под
// SchemaContextProvider. Зеркалит стиль DocumentAnnotations (связка движок↔домен).
import { SchemaContextProvider } from "@/components/ast-editor/schema-context";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import { getMe } from "@/utils/me";

import { canCreateAnnotation } from "../permissions";

import { AnnotationSelectionComposer } from "./annotation-selection-composer";

export async function AnnotationCreateAffordance() {
  const me = await getMe();
  if (!canCreateAnnotation(me)) return null;
  // getAstSchema — unstable_cache: дедупится с загрузками в DocumentAnnotations/
  // CommentSection, нового HTTP нет.
  const astSchema = await getAstSchema();
  return (
    <SchemaContextProvider initial={astSchema}>
      <AnnotationSelectionComposer />
    </SchemaContextProvider>
  );
}
```

- [ ] **Step 2: Export from slice barrel**

В `src/features/annotations/index.ts` рядом с `export { DocumentAnnotations } from "./ui/document-annotations";` добавить строку:

```ts
export { AnnotationCreateAffordance } from "./ui/annotation-create-affordance";
```

- [ ] **Step 3: Mount on lecture page**

В `src/app/lectures/[id]/page.tsx`:

Заменить импорт аннотаций
```ts
import { DocumentAnnotations } from "@/features/annotations";
```
на
```ts
import { AnnotationCreateAffordance, DocumentAnnotations } from "@/features/annotations";
```

Затем сразу после `<SelectionAffordanceHost />` (строка ~88) добавить:

```tsx
      <SelectionAffordanceHost />
      {/* Единственный page-level маунт действия «аннотировать» (id=annotation):
          регистрирует действие ОДИН раз, независимо от числа скоупов. Suspense/null —
          аффорданс невидим до выделения. */}
      <Suspense fallback={null}>
        <AnnotationCreateAffordance />
      </Suspense>
```

(`Suspense` уже импортирован на странице — `import { Suspense } from "react";`.)

- [ ] **Step 4: Mount on document page**

В `src/app/documents/[id]/page.tsx`:

Заменить импорт
```ts
import { DocumentAnnotations } from "@/features/annotations";
```
на
```ts
import { AnnotationCreateAffordance, DocumentAnnotations } from "@/features/annotations";
```

Затем сразу после `<SelectionAffordanceHost />` (строка ~67) добавить:

```tsx
      <SelectionAffordanceHost />
      {/* Единственный page-level маунт действия «аннотировать» (id=annotation). */}
      <Suspense fallback={null}>
        <AnnotationCreateAffordance />
      </Suspense>
```

(`Suspense` уже импортирован.)

- [ ] **Step 5: Typecheck + lint + build the changes**

Run: `pnpm exec vitest run src/features/annotations && pnpm lint`
Expected: PASS (существующие тесты зелёные; ESLint без ошибок — новый server-компонент не нарушает Guardrail 4, т.к. он server, не client-коннектор).

- [ ] **Step 6: Commit**

```bash
git status   # убедиться, что page.tsx не изменены другим агентом с момента правки
git add src/features/annotations/ui/annotation-create-affordance.tsx src/features/annotations/index.ts src/app/lectures/[id]/page.tsx src/app/documents/[id]/page.tsx
git commit --only src/features/annotations/ui/annotation-create-affordance.tsx src/features/annotations/index.ts src/app/lectures/[id]/page.tsx src/app/documents/[id]/page.tsx -m "feat(annotations): смонтировать AnnotationCreateAffordance один раз на страницу"
```

---

### Task 3: Снять действие+selection-композер с `AnnotationScope`; удалить старый компонент; регрессия

Теперь `id="annotation"` регистрируется ТОЛЬКО page-level (Task 1-2). Убираем регистрацию из per-scope `AnnotationScope`, оставляя rail + fallback + document-only тулбар (тумблер + «add unanchored» со СВОИМ локальным композером, только под `showToolbar`). Удаляем `annotation-create-action.tsx` и устаревшие тесты; добавляем регресс-страж.

**Files:**
- Modify: `src/features/annotations/ui/annotation-scope.tsx`
- Delete: `src/features/annotations/ui/annotation-create-action.tsx`
- Delete: `src/features/annotations/ui/annotation-create-action.test.tsx`
- Delete: `src/features/annotations/ui/annotation-scope-cross-scope.test.tsx`
- Test: `src/features/annotations/ui/annotation-scope-no-action.test.tsx` (create)

**Interfaces:**
- Consumes: `AnnotationComposerDialog` (для unanchored-пути), `useRegisterRailScope`/`useWide`/`anchorScopeSelector`/`AnchoredNote` из движка.
- Produces: `AnnotationScope` с прежней сигнатурой пропов (`parentEntityType`, `parentId`, `notes`, `canCreate`, `showToolbar?`), но БЕЗ регистрации anchor-действия; composer рендерится только под `showToolbar` для unanchored (без `anchor`).

- [ ] **Step 1: Write the failing regression test**

`src/features/annotations/ui/annotation-scope-no-action.test.tsx`:

```tsx
// src/features/annotations/ui/annotation-scope-no-action.test.tsx
// Регресс структурного hoist: AnnotationScope (множимый per-scope компонент — 1 на
// документ + 1 на каждый комментарий) НЕ должен регистрировать anchor-действие. Иначе
// возвращается баг «N синглтонов на один id + первый unmount убирает действие для всех».
// Действие живёт ТОЛЬКО в page-level AnnotationSelectionComposer.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

const useStableAnchorAction = vi.fn();
vi.mock("@/components/anchor-engine", () => ({
  useStableAnchorAction,
  useRegisterRailScope: (): void => undefined,
  useWide: (): boolean => false,
  anchorScopeSelector: (type: string, id: string): string =>
    `[data-anchor-scope="${type}:${id}"]`,
}));

// Композер-диалог мокаем в no-op (в этом тесте важна только регистрация действия).
vi.mock("./annotation-composer-dialog", () => ({
  AnnotationComposerDialog: () => null,
}));

import { AnnotationScope } from "./annotation-scope";

afterEach(() => {
  cleanup();
  useStableAnchorAction.mockClear();
});

describe("AnnotationScope: не регистрирует anchor-действие", () => {
  it("comment-скоуп (per-comment) не зовёт useStableAnchorAction", () => {
    render(<AnnotationScope parentEntityType="comment" parentId="cmt-1" notes={[]} canCreate />);
    expect(useStableAnchorAction).not.toHaveBeenCalled();
  });

  it("document-скоуп с тулбаром не зовёт useStableAnchorAction", () => {
    render(
      <AnnotationScope parentEntityType="document" parentId="doc-1" notes={[]} canCreate showToolbar />,
    );
    expect(useStableAnchorAction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/features/annotations/ui/annotation-scope-no-action.test.tsx`
Expected: FAIL — `useStableAnchorAction` вызывается (AnnotationScope ещё рендерит `AnnotationCreateAction`, который его зовёт).

- [ ] **Step 3: Strip the action + selection composer from `AnnotationScope`**

В `src/features/annotations/ui/annotation-scope.tsx`:

(a) Удалить импорт (строка 26):
```ts
import { AnnotationCreateAction, type AnnotationComposerOpen } from "./annotation-create-action";
```

(b) Заменить composer-state + большой комментарий про «следует за выделением» (строки 53-66) на простой boolean (композер теперь только для unanchored, parent = пропсы скоупа):
```tsx
  // Композер ТОЛЬКО для unanchored-пути (кнопка «Добавить аннотацию» в document-тулбаре).
  // Selection-driven создание живёт в page-level AnnotationSelectionComposer.
  const [composerOpen, setComposerOpen] = useState(false);
```

(c) Кнопка «add unanchored» (строки ~159-169): заменить `onClick` на новый сеттер:
```tsx
          {canCreate && (
            <Button
              type="button"
              compact
              tone="primary"
              onClick={() => {
                setComposerOpen(true);
              }}
            >
              {t("marginAddUnanchored")}
            </Button>
          )}
```

(d) Удалить блок `<AnnotationCreateAction ... />` целиком (строки ~186-196).

(e) Заменить хвостовой `<AnnotationComposerDialog ... />` (строки ~198-206) на гейт под `showToolbar`, без `anchor` (всегда unanchored, parent = пропсы скоупа):
```tsx
      {showToolbar && (
        <AnnotationComposerDialog
          parentEntityType={parentEntityType}
          parentId={parentId}
          open={composerOpen}
          onOpenChange={setComposerOpen}
        />
      )}
```

Импорт `AnnotationComposerDialog` (строка 25) — ОСТАВИТЬ.

- [ ] **Step 4: Delete the obsolete component + tests**

```bash
git rm src/features/annotations/ui/annotation-create-action.tsx \
       src/features/annotations/ui/annotation-create-action.test.tsx \
       src/features/annotations/ui/annotation-scope-cross-scope.test.tsx
```

(`annotation-create-action.test.tsx` покрывал маршрутизацию `onCreate` — перенесена в `annotation-selection-composer.test.tsx` (Task 1). `annotation-scope-cross-scope.test.tsx` проверял, что композер AnnotationScope берёт parent из драфта — эта ответственность ушла в page-level композер, где скоуп-пропов нет вовсе.)

- [ ] **Step 5: Run the regression test + full slice suite**

Run: `pnpm exec vitest run src/features/annotations`
Expected: PASS — `annotation-scope-no-action.test.tsx` зелёный; удалённые тесты не ищутся; остальные тесты слайса проходят.

- [ ] **Step 6: Lint (Guardrail 4 + unused imports)**

Run: `pnpm lint`
Expected: PASS — нет неиспользуемых импортов в `annotation-scope.tsx` (`AnnotationCreateAction`/`AnnotationComposerOpen` удалены), Guardrail 4 не нарушен.

- [ ] **Step 7: Commit**

```bash
git add src/features/annotations/ui/annotation-scope.tsx src/features/annotations/ui/annotation-scope-no-action.test.tsx
git commit --only src/features/annotations/ui/annotation-scope.tsx src/features/annotations/ui/annotation-scope-no-action.test.tsx src/features/annotations/ui/annotation-create-action.tsx src/features/annotations/ui/annotation-create-action.test.tsx src/features/annotations/ui/annotation-scope-cross-scope.test.tsx -m "refactor(annotations): AnnotationScope больше не регистрирует anchor-действие (hoist в page-level); +регресс"
```

(`git rm` уже застейджил удаления; `--only` перечисляет и новые/изменённые, и удалённые пути.)

---

### Task 4: `CommentAnchorSelectionComposer` (client, self-contained action + composer)

Зеркалит Task 1 для комментов: переносит `CommentAnchorCreateAction` (регистрация `id="comment-anchor"`, `appliesTo` document-only, маршрутизация) + composer-владение в один client-компонент. Аддитивно (пока не удаляем старое).

**Files:**
- Create: `src/features/comments/ui/comment-anchor-selection-composer.tsx`
- Test: `src/features/comments/ui/comment-anchor-selection-composer.test.tsx`

**Interfaces:**
- Consumes: `useStableAnchorAction`, `type AnchorDraft` из `@/components/anchor-engine`; `buildCommentTextAnchor` из `../anchor`; `type Anchor`, `type CommentType` из `../types`; `CommentComposerDialog` из `./comment-composer-dialog`; `useT` из `@/i18n/client`.
- Produces: `export function CommentAnchorSelectionComposer(props: { lectureId: string; rootTypes: CommentType[] }): JSX.Element` — регистрирует `id="comment-anchor"` (`enabled: true`, `appliesTo`: `t === "document"`), открывает `CommentComposerDialog` с `anchor = buildCommentTextAnchor(draft.anchor, draft.scope.entityId)`.

- [ ] **Step 1: Write the failing test**

`src/features/comments/ui/comment-anchor-selection-composer.test.tsx`:

```tsx
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnchorDraft } from "@/components/anchor-engine";

import { CommentAnchorSelectionComposer } from "./comment-anchor-selection-composer";

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

let captured: {
  onCreate: (d: AnchorDraft) => void;
  appliesTo?: (t: string) => boolean;
} | null = null;
const registerSpy = vi.fn();
vi.mock("@/components/anchor-engine", () => ({
  useStableAnchorAction: (cfg: {
    onCreate: (d: AnchorDraft) => void;
    appliesTo?: (t: string) => boolean;
  }) => {
    registerSpy(cfg);
    captured = cfg;
  },
}));

vi.mock("./comment-composer-dialog", () => ({
  CommentComposerDialog: ({
    open,
    anchor,
    lectureId,
  }: {
    open: boolean;
    anchor?: { exact?: string };
    lectureId: string;
  }) =>
    open ? (
      <div data-testid="composer" data-lecture-id={lectureId} data-anchor-exact={anchor?.exact ?? ""} />
    ) : null,
}));

function draftIn(entityType: string, entityId: string): AnchorDraft {
  return {
    anchor: {
      startBlockId: "b1",
      startNodeId: "b1",
      endBlockId: "b1",
      endNodeId: "b1",
      startChar: 0,
      endChar: 5,
      exact: "hello",
    },
    rect: { top: 0, left: 0, width: 0, height: 0 } as DOMRect,
    scope: { entityType, entityId },
  };
}

afterEach(() => {
  cleanup();
  captured = null;
  registerSpy.mockClear();
});

function reg(): { onCreate: (d: AnchorDraft) => void; appliesTo?: (t: string) => boolean } {
  if (!captured) throw new Error("CommentAnchorSelectionComposer не зарегистрировал действие");
  return captured;
}

describe("CommentAnchorSelectionComposer", () => {
  it("регистрирует ровно одно действие comment-anchor", () => {
    render(<CommentAnchorSelectionComposer lectureId="lec-1" rootTypes={[]} />);
    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(registerSpy).toHaveBeenCalledWith(expect.objectContaining({ id: "comment-anchor" }));
  });

  it("применимо к document-скоупу, не применимо к comment-скоупу (v1)", () => {
    render(<CommentAnchorSelectionComposer lectureId="lec-1" rootTypes={[]} />);
    const applies = reg().appliesTo;
    expect(applies?.("document")).toBe(true);
    expect(applies?.("comment")).toBe(false);
  });

  it("открывает композер с anchor из драфта документа", () => {
    render(<CommentAnchorSelectionComposer lectureId="lec-1" rootTypes={[]} />);
    act(() => {
      reg().onCreate(draftIn("document", "doc-7"));
    });
    const composer = screen.getByTestId("composer");
    expect(composer.getAttribute("data-lecture-id")).toBe("lec-1");
    expect(composer.getAttribute("data-anchor-exact")).toBe("hello");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/features/comments/ui/comment-anchor-selection-composer.test.tsx`
Expected: FAIL — `Failed to resolve import "./comment-anchor-selection-composer"`.

- [ ] **Step 3: Write minimal implementation**

`src/features/comments/ui/comment-anchor-selection-composer.tsx`:

```tsx
"use client";
// src/features/comments/ui/comment-anchor-selection-composer.tsx
// ЕДИНСТВЕННЫЙ page-level маунт действия «заякоренный комментарий» (id=comment-anchor):
// регистрирует действие ОДИН раз на страницу (монтируется server-ассемблером
// CommentAnchorCreateAffordance под AnchorScopeProvider) и владеет composer-диалогом.
// appliesTo: только document-скоуп (v1). onCreate строит якорь из draft.scope.entityId.
// Раньше это регистрировалось из каждого CommentAnchorScope. Зеркалит AnnotationSelectionComposer.
// Guardrail 4: только pure-фасады (../anchor, ../types) + движок + i18n/client + композер.
import { useState } from "react";

import { type AnchorDraft, useStableAnchorAction } from "@/components/anchor-engine";
import { useT } from "@/i18n/client";

import { buildCommentTextAnchor } from "../anchor";
import type { Anchor, CommentType } from "../types";

import { CommentComposerDialog } from "./comment-composer-dialog";

// Стабильная module-scope ссылка предиката (defense-in-depth).
const APPLIES_TO_DOCUMENT = (t: string) => t === "document"; // v1: якорь коммента только в документ

export function CommentAnchorSelectionComposer({
  lectureId,
  rootTypes,
}: {
  lectureId: string;
  rootTypes: CommentType[];
}) {
  const t = useT("comments");
  const [composer, setComposer] = useState<{ open: boolean; anchor?: Anchor }>({ open: false });

  useStableAnchorAction({
    id: "comment-anchor",
    label: t("marginCommentAdd"),
    enabled: true,
    appliesTo: APPLIES_TO_DOCUMENT,
    onCreate: (d: AnchorDraft) => {
      setComposer({
        open: true,
        anchor: buildCommentTextAnchor(d.anchor, d.scope.entityId),
      });
    },
  });

  return (
    <CommentComposerDialog
      lectureId={lectureId}
      rootTypes={rootTypes}
      open={composer.open}
      onOpenChange={(open) => {
        setComposer((c) => ({ ...c, open }));
      }}
      anchor={composer.anchor}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/features/comments/ui/comment-anchor-selection-composer.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/comments/ui/comment-anchor-selection-composer.tsx src/features/comments/ui/comment-anchor-selection-composer.test.tsx
git commit --only src/features/comments/ui/comment-anchor-selection-composer.tsx src/features/comments/ui/comment-anchor-selection-composer.test.tsx -m "feat(comments): CommentAnchorSelectionComposer — page-level действие заякоренного коммента + композер"
```

---

### Task 5: `CommentAnchorCreateAffordance` (server) + монтаж на странице лекции

Server-ассемблер комментов: право `comment.create` + `getCommentSchema().allowed_roots` (rootTypes) + `getAstSchema()`, монтирует client-композер один раз на странице лекции. Комментов на standalone-документе нет — на `documents/[id]` НЕ монтируем.

**Files:**
- Create: `src/features/comments/ui/comment-anchor-create-affordance.tsx`
- Modify: `src/features/comments/index.ts` (экспорт)
- Modify: `src/app/lectures/[id]/page.tsx` (импорт + маунт)

**Interfaces:**
- Consumes: `getMe` (`@/utils/me`); `canCreateComment` (`../permissions`); `getCommentSchema` (`../api`); `getAstSchema` (`@/components/ast-editor/schema-server`); `SchemaContextProvider` (`@/components/ast-editor/schema-context`); `CommentAnchorSelectionComposer` (Task 4).
- Produces: `export async function CommentAnchorCreateAffordance(props: { lectureId: string }): Promise<JSX.Element | null>` — `null` при `!canCreateComment(me)` или `!schema`; иначе client-композер под `SchemaContextProvider`. Экспортируется из `@/features/comments`.

- [ ] **Step 1: Write the implementation (server component)**

`src/features/comments/ui/comment-anchor-create-affordance.tsx`:

```tsx
// src/features/comments/ui/comment-anchor-create-affordance.tsx
// Server-ассемблер page-level действия «заякоренный комментарий»: право (comment.create),
// rootTypes из схемы комментов + AST-схема (композер монтирует AstEditor), монтирует
// client-композер ОДИН раз на странице лекции под SchemaContextProvider. Зеркалит стиль
// DocumentComments. На standalone-документе комментов нет → там не монтируется.
import { SchemaContextProvider } from "@/components/ast-editor/schema-context";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import { getMe } from "@/utils/me";

import { getCommentSchema } from "../api";
import { canCreateComment } from "../permissions";

import { CommentAnchorSelectionComposer } from "./comment-anchor-selection-composer";

export async function CommentAnchorCreateAffordance({ lectureId }: { lectureId: string }) {
  const me = await getMe();
  if (!canCreateComment(me)) return null;
  const [schema, astSchema] = await Promise.all([getCommentSchema(), getAstSchema()]);
  if (!schema) return null;
  return (
    <SchemaContextProvider initial={astSchema}>
      <CommentAnchorSelectionComposer lectureId={lectureId} rootTypes={schema.allowed_roots ?? []} />
    </SchemaContextProvider>
  );
}
```

- [ ] **Step 2: Export from slice barrel**

В `src/features/comments/index.ts` рядом с `export { DocumentComments } from "./ui/document-comments";` добавить:

```ts
export { CommentAnchorCreateAffordance } from "./ui/comment-anchor-create-affordance";
```

- [ ] **Step 3: Mount on lecture page**

В `src/app/lectures/[id]/page.tsx`:

Заменить импорт комментов
```ts
import { CommentSection, DocumentComments } from "@/features/comments";
```
на
```ts
import { CommentAnchorCreateAffordance, CommentSection, DocumentComments } from "@/features/comments";
```

Затем добавить маунт рядом с `<AnnotationCreateAffordance />` (после него, под тем же блоком Suspense-маунтов, строка ~90):

```tsx
      <Suspense fallback={null}>
        <AnnotationCreateAffordance />
      </Suspense>
      {/* Единственный page-level маунт действия «заякоренный комментарий» (id=comment-anchor). */}
      <Suspense fallback={null}>
        <CommentAnchorCreateAffordance lectureId={id} />
      </Suspense>
```

- [ ] **Step 4: Lint + slice suite**

Run: `pnpm exec vitest run src/features/comments && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git status
git add src/features/comments/ui/comment-anchor-create-affordance.tsx src/features/comments/index.ts src/app/lectures/[id]/page.tsx
git commit --only src/features/comments/ui/comment-anchor-create-affordance.tsx src/features/comments/index.ts src/app/lectures/[id]/page.tsx -m "feat(comments): смонтировать CommentAnchorCreateAffordance один раз на странице лекции"
```

---

### Task 6: Снять действие+композер с `CommentAnchorScope`; упростить `document-comments`; регрессия

Теперь `id="comment-anchor"` регистрируется только page-level. Сводим `CommentAnchorScope` к rail + fallback (пропы `{ documentId, notes }`), убираем из него `CommentAnchorCreateAction`/композер/`useStableAnchorAction`. `document-comments.tsx` больше не нужен `SchemaContextProvider`/`getAstSchema`/`getCommentSchema` (композер ушёл на page-level). Удаляем старый тест; добавляем регресс.

**Files:**
- Modify: `src/features/comments/ui/comment-anchor-scope.tsx`
- Modify: `src/features/comments/ui/document-comments.tsx`
- Delete: `src/features/comments/ui/comment-anchor-create.test.tsx`
- Test: `src/features/comments/ui/comment-anchor-scope-no-action.test.tsx` (create)

**Interfaces:**
- Consumes: `anchorScopeSelector`, `AnchoredNote`, `useRegisterRailScope`, `useWide` из движка; `coordsToEngineAnchor` из `@/utils/text-anchor`; `type Anchor` из `../types`.
- Produces: `export function CommentAnchorScope(props: { documentId: string; notes: CommentAnchorNote[] }): JSX.Element` — только rail-регистрация (`comment:document:<id>`) + fallback-рендер. Экспорт `CommentAnchorCreateAction` УДАЛЁН. `export interface CommentAnchorNote` сохраняется.
- `DocumentComments` — сигнатура пропов не меняется (`{ lectureId, documentId, token? }`); внутри рендерит `<CommentAnchorScope documentId={documentId} notes={notes} />`.

- [ ] **Step 1: Write the failing regression test**

`src/features/comments/ui/comment-anchor-scope-no-action.test.tsx`:

```tsx
// src/features/comments/ui/comment-anchor-scope-no-action.test.tsx
// Регресс структурного hoist: CommentAnchorScope (per-document rail-коннектор) НЕ должен
// регистрировать anchor-действие. Действие живёт ТОЛЬКО в page-level
// CommentAnchorSelectionComposer.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

const useStableAnchorAction = vi.fn();
vi.mock("@/components/anchor-engine", () => ({
  useStableAnchorAction,
  useRegisterRailScope: (): void => undefined,
  useWide: (): boolean => false,
  anchorScopeSelector: (type: string, id: string): string =>
    `[data-anchor-scope="${type}:${id}"]`,
}));

import { CommentAnchorScope } from "./comment-anchor-scope";

afterEach(() => {
  cleanup();
  useStableAnchorAction.mockClear();
});

describe("CommentAnchorScope: не регистрирует anchor-действие", () => {
  it("не зовёт useStableAnchorAction", () => {
    render(<CommentAnchorScope documentId="doc-1" notes={[]} />);
    expect(useStableAnchorAction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/features/comments/ui/comment-anchor-scope-no-action.test.tsx`
Expected: FAIL — либо `useStableAnchorAction` вызывается (scope ещё регистрирует), либо type-ошибка на пропах (`lectureId`/`rootTypes`/`canCreate` ещё обязательны). Оба состояния — «красный».

- [ ] **Step 3: Rewrite `comment-anchor-scope.tsx` — rail + fallback only**

Полностью заменить содержимое `src/features/comments/ui/comment-anchor-scope.tsx` на:

```tsx
"use client";
// src/features/comments/ui/comment-anchor-scope.tsx
// Client-коннектор заякоренных комментариев → левая rail (tone "comment"). ТОЛЬКО
// позиционирование: находит корень тела документа [data-anchor-scope="document:<id>"],
// регистрирует заякоренные превью в rail (wide-гейт: на narrow превью текут inline под
// телом, в rail — только на wide). Действие создания (id=comment-anchor) вынесено в
// page-level CommentAnchorSelectionComposer (структурный hoist) — здесь его больше нет.
// renderNote зависит от РАЗРЕШЁННОЙ строки orphanLabel (анти-register-цикл), entry мемоизирован.
// Guardrail 4: только pure-фасады (../anchor, ../types), движок, i18n/client, text-anchor util.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  anchorScopeSelector,
  type AnchoredNote,
  useRegisterRailScope,
  useWide,
} from "@/components/anchor-engine";
import { useT } from "@/i18n/client";
import { coordsToEngineAnchor } from "@/utils/text-anchor";

import type { Anchor } from "../types";

export interface CommentAnchorNote {
  id: string;
  anchor: Anchor;
  preview: ReactNode;
}

export function CommentAnchorScope({
  documentId,
  notes,
}: {
  documentId: string;
  notes: CommentAnchorNote[];
}) {
  const t = useT("comments");

  // Корень = тело документа (скоуп document:<id>). Один retry через rAF: узел может ещё
  // не быть в DOM при стриминге (документ/CommentSection под Suspense).
  const [rootEl, setRootEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const find = () =>
      document.querySelector<HTMLElement>(anchorScopeSelector("document", documentId));
    const el = find();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-mount discovery of server-rendered scope root by unique id; entry rebuilds when found
    if (el) setRootEl(el);
    else if (typeof requestAnimationFrame === "function") {
      const raf = requestAnimationFrame(() => {
        setRootEl(find());
      });
      return () => {
        cancelAnimationFrame(raf);
      };
    }
  }, [documentId]);
  const ready = rootEl !== null;

  const wide = useWide();

  const engineNotes = useMemo<AnchoredNote[]>(
    () =>
      notes.flatMap((n) => {
        const engine = coordsToEngineAnchor(n.anchor);
        return engine ? [{ id: n.id, anchor: engine }] : [];
      }),
    [notes],
  );
  const previewById = useMemo(() => new Map(notes.map((n) => [n.id, n.preview])), [notes]);
  const engineIds = new Set(engineNotes.map((n) => n.id));
  const ssrOnly = notes.filter((n) => !engineIds.has(n.id));

  // renderNote зависит от РАЗРЕШЁННОЙ строки (не идентичности t) — анти-register-цикл.
  const orphanLabel = t("marginOrphanLabel");
  const renderNote = useCallback(
    (n: AnchoredNote, orphan: boolean): ReactNode => (
      <>
        {orphan && <p className="text-xs text-(--color-fg-muted)">{orphanLabel}</p>}
        {previewById.get(n.id) ?? null}
      </>
    ),
    [previewById, orphanLabel],
  );

  const entry = useMemo(
    () =>
      rootEl && wide
        ? {
            key: `comment:document:${documentId}`,
            rootEl,
            tone: "comment" as const,
            notes: engineNotes,
            renderNote,
          }
        : null,
    [rootEl, wide, documentId, engineNotes, renderNote],
  );
  useRegisterRailScope(entry);

  return (
    <div className="flex flex-col gap-4" aria-label={t("marginColumnLabel")}>
      {ssrOnly.map((n) => (
        <div key={n.id}>{n.preview}</div>
      ))}
      {(!ready || !wide) && engineNotes.map((n) => <div key={n.id}>{previewById.get(n.id)}</div>)}
    </div>
  );
}
```

(Удалены: `CommentAnchorCreateAction`, `CommentAnchorComposerOpen`, composer-state, `CommentComposerDialog`-рендер, импорты `AnchorDraft`/`useStableAnchorAction`/`buildCommentTextAnchor`/`CommentComposerDialog`/`CommentType`. Пропы `lectureId`/`rootTypes`/`canCreate` убраны.)

- [ ] **Step 4: Simplify `document-comments.tsx`**

Полностью заменить содержимое `src/features/comments/ui/document-comments.tsx` на:

```tsx
// src/features/comments/ui/document-comments.tsx
// Server-сборщик левого поля: заякоренные на текущий документ комментарии → превью-карточки
// → client-коннектор (CommentAnchorScope → rail tone "comment"). Композер создания ушёл на
// page-level (CommentAnchorCreateAffordance) → здесь больше НЕ нужен SchemaContextProvider/
// AST-схема: rail рендерит только read-превью. Заякоренные комменты видны и в нижнем треде —
// это поле лишь подсветка+позиционирование+выноски (доп. доступ).
import { getMe } from "@/utils/me";

import { selectAnchoredRoots } from "../anchored";
import { getLectureComments } from "../api";
import { canCreateComment } from "../permissions";

import { CommentAnchorScope, type CommentAnchorNote } from "./comment-anchor-scope";
import { CommentPreviewCard } from "./comment-preview-card";

export async function DocumentComments({
  lectureId,
  documentId,
  token,
}: {
  lectureId: string;
  documentId: string;
  /** ?token= (share-link) — доступ к комментариям приватной лекции. */
  token?: string | undefined;
}) {
  const [me, list] = await Promise.all([
    getMe(),
    getLectureComments(lectureId, token ? { token } : {}),
  ]);

  const anchored = selectAnchoredRoots(list.subtrees, documentId);
  // Пустое поле без права создавать нечего показывать. При наличии права колонку
  // держим (page-level композер положит новые заякоренные комменты сюда после ревалидации).
  if (anchored.length === 0 && !canCreateComment(me)) return null;

  const notes: CommentAnchorNote[] = anchored.map((a) => ({
    id: a.id,
    anchor: a.anchor,
    preview: <CommentPreviewCard comment={a.root} replyCount={a.replyCount} />,
  }));

  return <CommentAnchorScope documentId={documentId} notes={notes} />;
}
```

(Удалены: `SchemaContextProvider`, `getAstSchema`, `getCommentSchema`, `schema.allowed_roots`, пропы `lectureId`/`rootTypes`/`canCreate` у `CommentAnchorScope`. Сигнатура `DocumentComments` не изменилась — страница правок не требует.)

- [ ] **Step 5: Delete the obsolete test**

```bash
git rm src/features/comments/ui/comment-anchor-create.test.tsx
```

(Покрывал `CommentAnchorCreateAction` — applicability + routing перенесены в `comment-anchor-selection-composer.test.tsx`, Task 4.)

- [ ] **Step 6: Run regression + slice suite**

Run: `pnpm exec vitest run src/features/comments`
Expected: PASS — `comment-anchor-scope-no-action.test.tsx` зелёный; остальные тесты слайса проходят.

- [ ] **Step 7: Lint**

Run: `pnpm lint`
Expected: PASS — нет неиспользуемых импортов в `comment-anchor-scope.tsx`/`document-comments.tsx`; Guardrail 4 не нарушен.

- [ ] **Step 8: Commit**

```bash
git add src/features/comments/ui/comment-anchor-scope.tsx src/features/comments/ui/document-comments.tsx src/features/comments/ui/comment-anchor-scope-no-action.test.tsx
git commit --only src/features/comments/ui/comment-anchor-scope.tsx src/features/comments/ui/document-comments.tsx src/features/comments/ui/comment-anchor-scope-no-action.test.tsx src/features/comments/ui/comment-anchor-create.test.tsx -m "refactor(comments): CommentAnchorScope больше не регистрирует anchor-действие (hoist в page-level); +регресс"
```

---

### Task 7: Финальная верификация гейта

Полный прогон гейта проекта + метка на ручной браузер-QA.

**Files:** нет правок кода.

- [ ] **Step 1: Full lint**

Run: `pnpm lint`
Expected: PASS (0 ошибок).

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: PASS — включает `test:eslint-config` (`node eslint.config.test.mjs`) и `vitest run`; все прежние + новые регресс-тесты зелёные; удалённые тест-файлы отсутствуют.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: успешная сборка (генерация SW/токенов + `next build`) без TS-ошибок.

- [ ] **Step 4: Manual QA note (не блокирует, вне автотестов)**

jsdom не даёт живого `Selection`/`getBoundingClientRect` — визуальный аффорданс автотестами не проверяется. Ручной чек в браузере (`pnpm dev`, порт 3001; бэк `:8090`):
1. Лекция с инлайн-документом + несколькими комментами. Выделить текст **в теле документа** → появляются обе кнопки («Аннотация» + «Заякоренный комментарий»); создать обе — уходят на нужные роуты.
2. Выделить текст **в теле комментария** → только «Аннотация»; создаётся аннотация к коммену.
3. **Регресс-сценарий бага:** свернуть/удалить один комментарий, затем снова выделить текст в документе → кнопка «Аннотация» ВСЁ ЕЩЁ появляется (раньше исчезала).
4. «Добавить аннотацию» (unanchored, тулбар поля документа) — открывает композер, создаёт аннотацию уровня документа.

---

## Self-Review

**1. Spec coverage** (сверка со спекой `2026-07-01-anchor-create-action-hoist-design.md`):
- Новые annotations-компоненты (`AnnotationCreateAffordance` server, `AnnotationSelectionComposer` client) → Task 1-2. ✓
- Новые comments-компоненты (`CommentAnchorCreateAffordance` server, `CommentAnchorSelectionComposer` client) → Task 4-5. ✓
- `annotation-scope.tsx` (снять действие+selection-композер, оставить rail/fallback/document-тулбар с unanchored под showToolbar) → Task 3. ✓
- `comment-anchor-scope.tsx` (свести к rail+fallback) → Task 6. ✓
- Барел-экспорты → Task 2 (step 2), Task 5 (step 2). ✓
- Маунт на `lectures/[id]` (оба) + `documents/[id]` (только annotations) → Task 2 (steps 3-4), Task 5 (step 3). ✓
- Свёрнутые/удалённые `annotation-create-action.tsx`, `CommentAnchorCreateAction` → Task 3 (step 4), Task 6 (step 3). ✓
- Тесты: новый регресс (scope не регистрирует действие) → Task 3, Task 6; переселение routing/applicability → Task 1, Task 4; `anchor-actions.test.tsx` оставлен без изменений (в плане не трогается — идемпотентность реестра сохраняется). ✓
- Гейт `pnpm lint && pnpm test && pnpm build` → Task 7. ✓
- Вне объёма (ref-counting, rail/выноски/подсветка, «add unanchored», Guardrail-2 seam, `comments/[id]`) — не трогаются планом. ✓

**2. Placeholder scan:** плейсхолдеров нет — весь код и команды приведены дословно.

**3. Type consistency:**
- `AnnotationSelectionComposer` — без пропов (Task 1) ↔ монтируется без пропов (Task 2). ✓
- `CommentAnchorSelectionComposer({ lectureId, rootTypes })` (Task 4) ↔ `CommentAnchorCreateAffordance` передаёт `lectureId` + `schema.allowed_roots` (Task 5). ✓
- `CommentAnchorScope({ documentId, notes })` (Task 6) ↔ `DocumentComments` рендерит `<CommentAnchorScope documentId={documentId} notes={notes} />` (Task 6 step 4). ✓
- `CommentAnchorNote` остаётся экспортом `comment-anchor-scope.tsx` (Task 6) ↔ импортируется в `document-comments.tsx`. ✓
- `useStableAnchorAction`/`AnchorDraft`/`useRegisterRailScope`/`useWide`/`anchorScopeSelector`/`AnchoredNote` — имена сверены с `@/components/anchor-engine` barrel. ✓
- `fromEngineAnchor` (annotations/anchor.ts), `buildCommentTextAnchor` (comments/anchor.ts), `coordsToEngineAnchor` (@/utils/text-anchor), `PARENT_ENTITY_TYPES` (annotations/types) — сверены. ✓
