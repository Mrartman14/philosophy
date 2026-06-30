# Универсальные anchor-скоупы: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Развязать движок маргиналий от единого `data-ast-root`, чтобы аннотировать можно было любую отдельно стоящую AST-сущность на странице (в первую очередь каждый комментарий лекции), а карточки-аннотации из всех источников стекались в одну page-level рельсу-маргиналию.

**Architecture:** Вводим понятие **scope** — DOM-узел с `data-anchor-scope="<type>:<id>"`, несущий идентичность сущности; внутри блоки с `data-block-id`. Презентацию разводим в **rail** — один page-level агрегатор на сторону (правая=аннотации, левая=заякоренные комментарии), который собирает заметки из всех скоупов, резолвит геометрию каждой в её корне, делает глобальный стекинг и рисует одну колонку + выноски. Захват выделения становится scope-aware (находит ближайший `[data-anchor-scope]`), а действие создания маршрутизируется по `draft.scope`.

**Tech Stack:** Next.js (App Router, RSC + server actions), TypeScript, React 19, vitest + jsdom, Tailwind v4, Base UI (kit `@/components/ui`), pnpm, CSS Custom Highlight API.

## Global Constraints

- Общаться с пользователем на русском; именование файлов в `src/` — kebab-case.
- НЕ делать `git stash`/`reset`/`checkout .`/`clean`; НЕ `git add -A`/`git add .` — добавлять только свои файлы по имени; не откатывать чужое.
- Перед PR зелёные: `pnpm lint && pnpm test && pnpm build`.
- Это **foundation-уровень** (правка `src/components/anchor-engine/*` + страничных шеллов). Делается координированно, не внутри одной фичи. `src/api/schema.ts` НЕ трогать.
- RBAC: в server actions `requireCapability`, в UI `canX()`. Создание аннотации уже гейтится `canCreateAnnotation(me)`.
- Guardrail 4: client-коннекторы слайса импортят только pure-фасады (`../anchor`, `../types`), движок, kit, i18n/client, composer — НЕ server-only `api`/`actions`/`permissions`/`schemas`.
- Guardrail 7: в движке только kit-примитивы (`Button`/`Inline` из `@/components/ui`), без нативных интерактивных тегов / прямого base-ui.
- Каждый коммит заканчивается строкой:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Тестовый раннер: `pnpm vitest run <path>` (один файл), полный прогон `pnpm test`.

## Единицы файлов (что создаём/меняем)

Создаём в `src/components/anchor-engine/`:
- `scope-id.ts` — парс/сериализация `data-anchor-scope`, `nearestScope(node)`, `anchorScopeAttr(type,id)`.
- `scope-from-selection.ts` — выделение → `{scopeEl, scope}` (обе границы в одном скоупе).
- `use-rail-scopes.ts` — реестр scope-заметок (register/select по тону).
- `use-aggregated-anchor-ranges.ts` — мультикорневая геометрия (Range/rect/recompute по многим скоупам).
- `margin-rail.tsx` — page-level агрегатор-приёмник (geometry+highlight+column+connector).

Маркировка скоупа НЕ выделена в компонент-обёртку: тела сущностей рендерятся на сервере,
а `renderNote` — клиентская функция (не пересекает RSC-границу). Поэтому атрибут
`data-anchor-scope` ставится прямо в JSX (страница для документа, `comment-node-view` для
комментария) через хелпер `anchorScopeAttr`, а заметки регистрирует клиентский коннектор
слайса (`AnnotationScope`/`CommentAnchorScope`) через `useRegisterRailScope`, находя свой
корень по уникальному `[data-anchor-scope="<type>:<id>"]`.

Меняем в `src/components/anchor-engine/`:
- `types.ts` — `AnchorScopeId`, расширение `AnchorDraft` полем `scope`.
- `use-selection-capture.ts` — переход с `rootRef` на scope-from-selection.
- `anchor-actions.tsx` — `AnchorAction.appliesTo`, scope-aware `SelectionAffordanceHost`, новый scope-notes-реестр в провайдере; провайдер переименовать в `AnchorScopeProvider` (alias-экспорт совместимости не нужен — поправим импортёров).
- `index.ts` — экспорт новых публичных единиц (`AnchorScope`, `MarginRail`, `AnchorScopeProvider`).
- Удаляем `margin-anchor-layer.tsx` после миграции (его роли разъехались в scope + rail).

Меняем в слайсах:
- `src/features/annotations/ui/`: `document-annotation-layer.tsx` → `annotation-scope.tsx` (регистрация заметок без своей колонки) + новый `annotation-create-action.tsx` (регистрирует page-level действие).
- `src/features/comments/ui/`: `document-comment-layer.tsx` → `comment-anchor-scope.tsx`; `comment-node-view.tsx` (тело комментария → scope); `comment-node.tsx` (server: фетч аннотаций комментария).
- `src/app/lectures/[id]/page.tsx` и `src/app/documents/[id]/page.tsx` — провайдер + рельсы + scope на тело документа.

---

## Task 1: Scope-id примитивы

**Files:**
- Create: `src/components/anchor-engine/scope-id.ts`
- Test: `src/components/anchor-engine/scope-id.test.ts`

**Interfaces:**
- Produces: `interface AnchorScopeId { entityType: string; entityId: string }`;
  `formatScopeId(s: AnchorScopeId): string`; `parseScopeId(raw: string | null | undefined): AnchorScopeId | null`;
  `nearestScope(node: Node | null): { el: HTMLElement; scope: AnchorScopeId } | null`.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/anchor-engine/scope-id.test.ts
import { describe, expect, it } from "vitest";

import { formatScopeId, nearestScope, parseScopeId } from "./scope-id";

describe("scope-id", () => {
  it("format → parse round-trips", () => {
    const s = { entityType: "comment", entityId: "11111111-2222-3333-4444-555555555555" };
    expect(formatScopeId(s)).toBe("comment:11111111-2222-3333-4444-555555555555");
    expect(parseScopeId(formatScopeId(s))).toEqual(s);
  });

  it("parse rejects empty/malformed", () => {
    expect(parseScopeId(null)).toBeNull();
    expect(parseScopeId("")).toBeNull();
    expect(parseScopeId("nocolon")).toBeNull();
    expect(parseScopeId(":id")).toBeNull();
    expect(parseScopeId("type:")).toBeNull();
  });

  it("parse keeps only the first colon as separator (UUID has none, but be safe)", () => {
    expect(parseScopeId("document:a:b")).toEqual({ entityType: "document", entityId: "a:b" });
  });

  it("nearestScope climbs to the closest [data-anchor-scope]", () => {
    document.body.innerHTML =
      '<div data-anchor-scope="document:doc1"><p data-block-id="b1">hi <span id="t">x</span></p></div>';
    const span = document.getElementById("t")!;
    const found = nearestScope(span.firstChild); // text node
    expect(found?.scope).toEqual({ entityType: "document", entityId: "doc1" });
    expect(found?.el).toBe(document.querySelector("[data-anchor-scope]"));
  });

  it("nearestScope returns null outside any scope", () => {
    document.body.innerHTML = "<p>orphan</p>";
    expect(nearestScope(document.querySelector("p"))).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/anchor-engine/scope-id.test.ts`
Expected: FAIL with "Cannot find module './scope-id'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/anchor-engine/scope-id.ts
// Идентичность scope: пара (entityType, entityId), сериализуемая в атрибут
// data-anchor-scope="<type>:<id>". entityType и entityId (UUID) разделены ПЕРВЫМ
// двоеточием — остаток уходит в entityId (defensive, на случай ":"-в-id).
export interface AnchorScopeId {
  entityType: string;
  entityId: string;
}

export function formatScopeId(s: AnchorScopeId): string {
  return `${s.entityType}:${s.entityId}`;
}

export function parseScopeId(raw: string | null | undefined): AnchorScopeId | null {
  if (!raw) return null;
  const idx = raw.indexOf(":");
  if (idx <= 0 || idx === raw.length - 1) return null;
  return { entityType: raw.slice(0, idx), entityId: raw.slice(idx + 1) };
}

export function nearestScope(
  node: Node | null,
): { el: HTMLElement; scope: AnchorScopeId } | null {
  const start =
    node?.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : (node?.parentElement ?? null);
  const el = start?.closest<HTMLElement>("[data-anchor-scope]") ?? null;
  if (!el) return null;
  const scope = parseScopeId(el.getAttribute("data-anchor-scope"));
  return scope ? { el, scope } : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/anchor-engine/scope-id.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/anchor-engine/scope-id.ts src/components/anchor-engine/scope-id.test.ts
git commit -m "$(cat <<'EOF'
feat(anchor-engine): scope-id примитивы (data-anchor-scope parse/format/nearest)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `AnchorDraft.scope` + `scopeFromSelection`

**Files:**
- Modify: `src/components/anchor-engine/types.ts:18-21`
- Create: `src/components/anchor-engine/scope-from-selection.ts`
- Test: `src/components/anchor-engine/scope-from-selection.test.ts`

**Interfaces:**
- Consumes: `AnchorScopeId`, `nearestScope` (Task 1); `anchorFromSelection(sel, root)` (existing `anchor-from-selection.ts`).
- Produces: `AnchorDraft` now `{ anchor: TextAnchor; rect: DOMRect; scope: AnchorScopeId }`;
  `scopeFromSelection(sel: Selection | null): { scopeEl: HTMLElement; scope: AnchorScopeId } | null`.

- [ ] **Step 1: Write the failing test**

```ts
// src/components/anchor-engine/scope-from-selection.test.ts
import { describe, expect, it } from "vitest";

import { scopeFromSelection } from "./scope-from-selection";

function selectWithin(startId: string, endId: string): Selection {
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  const r = document.createRange();
  r.setStart(document.getElementById(startId)!.firstChild!, 0);
  r.setEnd(document.getElementById(endId)!.firstChild!, 1);
  sel.addRange(r);
  return sel;
}

describe("scopeFromSelection", () => {
  it("returns scope when both endpoints share one scope", () => {
    document.body.innerHTML =
      '<div data-anchor-scope="comment:c1"><p data-block-id="b1"><span id="a">alpha</span> <span id="b">beta</span></p></div>';
    const found = scopeFromSelection(selectWithin("a", "b"));
    expect(found?.scope).toEqual({ entityType: "comment", entityId: "c1" });
  });

  it("returns null when endpoints fall in different scopes", () => {
    document.body.innerHTML =
      '<div data-anchor-scope="comment:c1"><p data-block-id="b1"><span id="a">alpha</span></p></div>' +
      '<div data-anchor-scope="document:d1"><p data-block-id="b2"><span id="b">beta</span></p></div>';
    expect(scopeFromSelection(selectWithin("a", "b"))).toBeNull();
  });

  it("returns null for collapsed/empty selection", () => {
    document.body.innerHTML =
      '<div data-anchor-scope="document:d1"><p data-block-id="b1"><span id="a">x</span></p></div>';
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    expect(scopeFromSelection(sel)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/components/anchor-engine/scope-from-selection.test.ts`
Expected: FAIL with "Cannot find module './scope-from-selection'".

- [ ] **Step 3: Extend `AnchorDraft` then add the helper**

Edit `src/components/anchor-engine/types.ts` — replace the `AnchorDraft` block:

```ts
import type { AnchorScopeId } from "./scope-id";

export interface AnchorDraft {
  anchor: TextAnchor;
  rect: DOMRect; // вьюпорт-координаты выделения для тултипа
  scope: AnchorScopeId; // какой сущности принадлежит выделение (маршрутизация create)
}
```

Create `src/components/anchor-engine/scope-from-selection.ts`:

```ts
// src/components/anchor-engine/scope-from-selection.ts
// Выделение → scope: ближайший общий [data-anchor-scope] обеих границ. Если
// границы в разных скоупах (кросс-скоуп выделение) — null (аффорданс не показываем).
import { nearestScope, type AnchorScopeId } from "./scope-id";

export function scopeFromSelection(
  sel: Selection | null,
): { scopeEl: HTMLElement; scope: AnchorScopeId } | null {
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const a = nearestScope(sel.anchorNode);
  const f = nearestScope(sel.focusNode);
  if (!a || !f || a.el !== f.el) return null;
  return { scopeEl: a.el, scope: a.scope };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/anchor-engine/scope-from-selection.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/anchor-engine/types.ts src/components/anchor-engine/scope-from-selection.ts src/components/anchor-engine/scope-from-selection.test.ts
git commit -m "$(cat <<'EOF'
feat(anchor-engine): AnchorDraft.scope + scopeFromSelection (общий скоуп границ)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Scope-aware `useSelectionCapture`

Захват выделения перестаёт зависеть от единственного `rootRef`: scope находится из самого выделения, draft несёт `scope`.

**Files:**
- Modify: `src/components/anchor-engine/use-selection-capture.ts` (целиком)
- Test: `src/components/anchor-engine/use-selection-capture.test.tsx` (обновить под новый API)

**Interfaces:**
- Consumes: `scopeFromSelection` (Task 2), `anchorFromSelection` (existing).
- Produces: `useSelectionCapture({ enabled: boolean }): { draft: AnchorDraft | null; clear: () => void }` (БЕЗ `rootRef`).

- [ ] **Step 1: Update the test to the new API (failing)**

Replace the body of `src/components/anchor-engine/use-selection-capture.test.tsx` driver so it mounts a hook host with `enabled` only (no rootRef) and asserts the draft carries `scope`:

```tsx
// src/components/anchor-engine/use-selection-capture.test.tsx
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AnchorDraft } from "./types";
import { useSelectionCapture } from "./use-selection-capture";

function Host({ onDraft }: { onDraft: (d: AnchorDraft | null) => void }) {
  const { draft } = useSelectionCapture({ enabled: true });
  onDraft(draft);
  return null;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("useSelectionCapture (scope-aware)", () => {
  it("builds a draft carrying the selection's scope", () => {
    document.body.innerHTML =
      '<div data-anchor-scope="comment:c1"><p data-block-id="b1">hello world</p></div>';
    let latest: AnchorDraft | null = null;
    render(<Host onDraft={(d) => (latest = d)} />);

    const p = document.querySelector("[data-block-id]")!;
    const sel = window.getSelection()!;
    const r = document.createRange();
    r.setStart(p.firstChild!, 0);
    r.setEnd(p.firstChild!, 5);
    sel.removeAllRanges();
    sel.addRange(r);

    act(() => {
      document.dispatchEvent(new Event("pointerup"));
    });
    expect(latest?.scope).toEqual({ entityType: "comment", entityId: "c1" });
    expect(latest?.anchor.exact).toBe("hello");
  });
});
```

Run: `pnpm vitest run src/components/anchor-engine/use-selection-capture.test.tsx`
Expected: FAIL (hook still requires `rootRef`; `scope` absent).

- [ ] **Step 2: Rewrite `use-selection-capture.ts`**

```ts
"use client";
// src/components/anchor-engine/use-selection-capture.ts
import { useEffect, useRef, useState } from "react";

import { anchorFromSelection } from "./anchor-from-selection";
import { scopeFromSelection } from "./scope-from-selection";
import type { AnchorDraft } from "./types";

// Дебаунс пересчёта якоря после selectionchange (drag-выделение шлёт залп событий).
const SELECTION_DEBOUNCE_MS = 250;

export function useSelectionCapture({ enabled }: { enabled: boolean }) {
  const [draft, setDraft] = useState<AnchorDraft | null>(null);
  const suppress = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const recompute = () => {
      const sel = window.getSelection();
      // Scope-рамка: выделение должно целиком лежать в ОДНОМ [data-anchor-scope].
      // Кросс-скоуп / вне скоупа → drop (аффорданс не показываем).
      const found = scopeFromSelection(sel);
      if (!sel || !found) {
        setDraft(null);
        return;
      }
      const anchor = anchorFromSelection(sel, found.scopeEl);
      if (!anchor || sel.rangeCount === 0) {
        setDraft(null);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setDraft({ anchor, rect, scope: found.scope });
    };
    const onSelectionChange = () => {
      if (suppress.current) {
        suppress.current = false;
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(recompute, SELECTION_DEBOUNCE_MS);
    };
    const onPointerUp = () => {
      if (timer) clearTimeout(timer);
      recompute();
    };
    const onScrollResize = () => {
      setDraft(null);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("touchend", onPointerUp);
    window.addEventListener("scroll", onScrollResize, true);
    window.addEventListener("resize", onScrollResize);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("touchend", onPointerUp);
      window.removeEventListener("scroll", onScrollResize, true);
      window.removeEventListener("resize", onScrollResize);
    };
  }, [enabled]);

  const clear = () => {
    suppress.current = true;
    window.getSelection()?.removeAllRanges();
    setDraft(null);
  };
  return { draft, clear };
}
```

- [ ] **Step 3: Run the updated test to verify it passes**

Run: `pnpm vitest run src/components/anchor-engine/use-selection-capture.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/anchor-engine/use-selection-capture.ts src/components/anchor-engine/use-selection-capture.test.tsx
git commit -m "$(cat <<'EOF'
feat(anchor-engine): useSelectionCapture находит scope из выделения (без rootRef)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `AnchorAction.appliesTo` + scope-aware `SelectionAffordanceHost`

Действия фильтруются по типу сущности текущего скоупа; host больше не ищет единственный `[data-ast-root]`.

**Files:**
- Modify: `src/components/anchor-engine/anchor-actions.tsx` (`AnchorAction`, `useRegisterAnchorAction`, `useStableAnchorAction`, `SelectionAffordanceHost`)
- Test: `src/components/anchor-engine/anchor-actions.test.tsx` (дополнить)

**Interfaces:**
- Consumes: `useSelectionCapture({enabled})` (Task 3), `AnchorDraft.scope` (Task 2).
- Produces: `AnchorAction` теперь `{ id; label; onCreate; appliesTo: (entityType: string) => boolean }`;
  `useStableAnchorAction`/`useRegisterAnchorAction` принимают `appliesTo`.

- [ ] **Step 1: Write the failing test (action filtering by scope type)**

Добавь в `src/components/anchor-engine/anchor-actions.test.tsx`:

```tsx
import { act, render } from "@testing-library/react";
import { expect, it } from "vitest";

import {
  AnchorScopeProvider,
  SelectionAffordanceHost,
  useStableAnchorAction,
} from "./anchor-actions";

function RegisterDocOnly() {
  useStableAnchorAction({
    id: "comment-anchor",
    label: "Комментировать",
    onCreate: () => {},
    enabled: true,
    appliesTo: (t) => t === "document",
  });
  return null;
}

it("hides an action whose appliesTo rejects the selection's scope", () => {
  document.body.innerHTML =
    '<div data-anchor-scope="comment:c1"><p data-block-id="b1">hello world</p></div>';
  render(
    <AnchorScopeProvider>
      <RegisterDocOnly />
      <SelectionAffordanceHost />
    </AnchorScopeProvider>,
  );
  const p = document.querySelector("[data-block-id]")!;
  const sel = window.getSelection()!;
  const r = document.createRange();
  r.setStart(p.firstChild!, 0);
  r.setEnd(p.firstChild!, 5);
  sel.removeAllRanges();
  sel.addRange(r);
  act(() => {
    document.dispatchEvent(new Event("pointerup"));
  });
  // comment-anchor применимо только к document → в comment-скоупе кнопки нет
  expect(document.body.textContent).not.toContain("Комментировать");
});
```

Run: `pnpm vitest run src/components/anchor-engine/anchor-actions.test.tsx`
Expected: FAIL (`appliesTo` ещё не поддержан; провайдер называется `AnchorActionsProvider`).

- [ ] **Step 2: Update `anchor-actions.tsx`**

Внеси изменения (показаны изменённые участки):

```tsx
export interface AnchorAction {
  id: string;
  label: string;
  onCreate: (draft: AnchorDraft) => void;
  // Применимо ли действие к скоупу данного типа сущности. annotation → все;
  // comment-anchor (v1) → только "document".
  appliesTo: (entityType: string) => boolean;
}
```

`useRegisterAnchorAction` — добавь `appliesTo` в параметры и в объект `register(...)`:

```tsx
export function useRegisterAnchorAction({
  id,
  label,
  onCreate,
  enabled,
  appliesTo,
}: {
  id: string;
  label: string;
  onCreate: (draft: AnchorDraft) => void;
  enabled: boolean;
  appliesTo: (entityType: string) => boolean;
}) {
  const ctx = useContext(AnchorActionsContext);
  const register = ctx?.register;
  const unregister = ctx?.unregister;
  useEffect(() => {
    if (!enabled || !register || !unregister) return;
    register({ id, label, onCreate, appliesTo });
    return () => {
      unregister(id);
    };
  }, [id, label, onCreate, enabled, appliesTo, register, unregister]);
}
```

`useStableAnchorAction` — пробрось `appliesTo`:

```tsx
export function useStableAnchorAction({
  id,
  label,
  onCreate,
  enabled,
  appliesTo,
}: {
  id: string;
  label: string;
  onCreate: (draft: AnchorDraft) => void;
  enabled: boolean;
  appliesTo: (entityType: string) => boolean;
}): void {
  const ref = useRef(onCreate);
  useEffect(() => {
    ref.current = onCreate;
  });
  const stable = useCallback((draft: AnchorDraft) => {
    ref.current(draft);
  }, []);
  useRegisterAnchorAction({ id, label, onCreate: stable, enabled, appliesTo });
}
```

`SelectionAffordanceHost` — убери discovery `[data-ast-root]`, фильтруй по `draft.scope`:

```tsx
export function SelectionAffordanceHost() {
  const ctx = useContext(AnchorActionsContext);
  const actions = ctx?.actions ?? [];
  const { draft, clear } = useSelectionCapture({ enabled: actions.length > 0 });

  if (!ctx || actions.length === 0 || !draft) return null;
  const applicable = actions.filter((a) => a.appliesTo(draft.scope.entityType));
  if (applicable.length === 0) return null;

  const { rect } = draft;
  const top = rect.top + window.scrollY - AFFORDANCE_OFFSET_PX;
  const left = rect.left + window.scrollX + rect.width / 2;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      // eslint-disable-next-line no-restricted-syntax -- координатный портал, направление-нейтрально
      style={{ position: "absolute", top, left, transform: "translateX(-50%)", zIndex: 50 }}
    >
      <Inline gap="tight" align="center">
        {applicable.map((action) => (
          <Button
            key={action.id}
            type="button"
            compact
            tone="primary"
            aria-label={action.label}
            onPointerDown={(e) => {
              e.preventDefault();
            }}
            onClick={() => {
              action.onCreate(draft);
              clear();
            }}
          >
            {action.label}
          </Button>
        ))}
      </Inline>
    </div>,
    document.body,
  );
}
```

Удали неиспользуемые импорты `useRef`/`useState`/`useEffect`, если они больше не нужны в файле (оставь только реально используемые: `createContext`, `useCallback`, `useContext`, `useEffect` для actions-эффекта, `useMemo`, `useRef` для stable-ref, `useState` для actions). Прогон `pnpm lint` в Step 4 это поймает.

- [ ] **Step 3: Rename provider to `AnchorScopeProvider`**

В этом же файле переименуй `AnchorActionsProvider` → `AnchorScopeProvider` (это станет домом и scope-notes-реестра в Task 5). Оставь сам контекст `AnchorActionsContext` как есть (внутреннее имя). Импортёров (`page.tsx` ×2) поправим в Task 9/10 — пока добавь временный alias, чтобы существующий barrel-экспорт и страницы не сломались (финальный barrel соберёт Task 6):

```tsx
// временный alias до миграции страниц (снимается в Task 13)
export const AnchorActionsProvider = AnchorScopeProvider;
```

`index.ts` пока НЕ трогай: существующий `export { AnchorActionsProvider, SelectionAffordanceHost }` продолжает резолвиться через alias.

- [ ] **Step 4: Run test + lint**

Run: `pnpm vitest run src/components/anchor-engine/anchor-actions.test.tsx && pnpm lint`
Expected: тест PASS; lint без ошибок (почини unused imports, если всплывут).

- [ ] **Step 5: Commit**

```bash
git add src/components/anchor-engine/anchor-actions.tsx src/components/anchor-engine/anchor-actions.test.tsx src/components/anchor-engine/index.ts
git commit -m "$(cat <<'EOF'
feat(anchor-engine): action.appliesTo + scope-aware SelectionAffordanceHost; AnchorScopeProvider

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Scope-notes реестр в провайдере

Провайдер начинает хранить регистрации заметок по скоупам (для rail).

**Files:**
- Modify: `src/components/anchor-engine/anchor-actions.tsx` (добавить scope-notes контекст в `AnchorScopeProvider`)
- Create: `src/components/anchor-engine/use-rail-scopes.ts`
- Test: `src/components/anchor-engine/use-rail-scopes.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  interface RailScopeEntry {
    key: string;            // уникален: `${tone}:${entityType}:${entityId}`
    rootEl: HTMLElement;
    tone: "annotation" | "comment";
    notes: AnchoredNote[];
    renderNote: (note: AnchoredNote, orphan: boolean) => ReactNode;
  }
  // в контексте провайдера:
  registerRailScope(entry: RailScopeEntry): void;
  unregisterRailScope(key: string): void;
  useRailScopes(tone: "annotation" | "comment"): RailScopeEntry[];
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/anchor-engine/use-rail-scopes.test.tsx
import { render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

import { AnchorScopeProvider } from "./anchor-actions";
import type { RailScopeEntry } from "./use-rail-scopes";
import { useRailScopes, useRegisterRailScope } from "./use-rail-scopes";

function Register({ entry }: { entry: RailScopeEntry }) {
  useRegisterRailScope(entry);
  return null;
}

function Probe({ onRead }: { onRead: (n: number) => void }) {
  const scopes = useRailScopes("annotation");
  useEffect(() => onRead(scopes.length));
  return null;
}

describe("rail scope registry", () => {
  it("collects entries by tone", () => {
    const el = document.createElement("div");
    const entry: RailScopeEntry = {
      key: "annotation:comment:c1",
      rootEl: el,
      tone: "annotation",
      notes: [],
      renderNote: () => null,
    };
    let read = -1;
    render(
      <AnchorScopeProvider>
        <Register entry={entry} />
        <Probe onRead={(n) => (read = n)} />
      </AnchorScopeProvider>,
    );
    expect(read).toBe(1);
  });
});
```

Run: `pnpm vitest run src/components/anchor-engine/use-rail-scopes.test.tsx`
Expected: FAIL (модуль/контекст отсутствуют).

- [ ] **Step 2: Add scope-notes context to the provider**

В `anchor-actions.tsx` добавь второй контекст и расширь провайдер (фрагменты):

```tsx
import type { AnchoredNote } from "./types";

export interface RailScopeEntry {
  key: string;
  rootEl: HTMLElement;
  tone: "annotation" | "comment";
  notes: AnchoredNote[];
  renderNote: (note: AnchoredNote, orphan: boolean) => ReactNode;
  // Подсвечивать ли фрагменты этого скоупа (тумблер reading-mode). Default true.
  highlightEnabled?: boolean;
}

interface RailScopesContextValue {
  scopes: RailScopeEntry[];
  registerRailScope: (e: RailScopeEntry) => void;
  unregisterRailScope: (key: string) => void;
}

export const RailScopesContext = createContext<RailScopesContextValue | undefined>(undefined);
```

В `AnchorScopeProvider` добавь состояние и оберни children обоими провайдерами:

```tsx
const [scopes, setScopes] = useState<RailScopeEntry[]>([]);
const registerRailScope = useCallback((e: RailScopeEntry) => {
  setScopes((prev) => [...prev.filter((s) => s.key !== e.key), e]);
}, []);
const unregisterRailScope = useCallback((key: string) => {
  setScopes((prev) => prev.filter((s) => s.key !== key));
}, []);
const railValue = useMemo<RailScopesContextValue>(
  () => ({ scopes, registerRailScope, unregisterRailScope }),
  [scopes, registerRailScope, unregisterRailScope],
);
// ...
return (
  <AnchorActionsContext.Provider value={value}>
    <RailScopesContext.Provider value={railValue}>{children}</RailScopesContext.Provider>
  </AnchorActionsContext.Provider>
);
```

- [ ] **Step 3: Create `use-rail-scopes.ts`**

```ts
"use client";
// src/components/anchor-engine/use-rail-scopes.ts
import { useContext, useEffect, useMemo } from "react";

import { RailScopesContext, type RailScopeEntry } from "./anchor-actions";

export type { RailScopeEntry };

/** Регистрирует scope-заметки в провайдере на время монтирования. No-op без провайдера. */
export function useRegisterRailScope(entry: RailScopeEntry | null) {
  const ctx = useContext(RailScopesContext);
  const register = ctx?.registerRailScope;
  const unregister = ctx?.unregisterRailScope;
  const key = entry?.key;
  useEffect(() => {
    if (!entry || !register || !unregister) return;
    register(entry);
    return () => {
      unregister(entry.key);
    };
    // entry пересоздаётся при смене notes/rootEl — реестр идемпотентен по key.
  }, [entry, key, register, unregister]);
}

/** Все scope-заметки данного тона (для MarginRail). */
export function useRailScopes(tone: "annotation" | "comment"): RailScopeEntry[] {
  const ctx = useContext(RailScopesContext);
  const all = ctx?.scopes ?? [];
  return useMemo(() => all.filter((s) => s.tone === tone), [all, tone]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/anchor-engine/use-rail-scopes.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/anchor-engine/anchor-actions.tsx src/components/anchor-engine/use-rail-scopes.ts src/components/anchor-engine/use-rail-scopes.test.tsx
git commit -m "$(cat <<'EOF'
feat(anchor-engine): scope-notes реестр в провайдере + useRailScopes(tone)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `anchorScopeAttr` хелпер + barrel-экспорты

Маркировку скоупа делаем через крошечный type-safe хелпер атрибута (ставится в JSX тел
сущностей), а не компонент-обёртку (тела server-rendered, `renderNote` клиентский — обёртка
не подходит). Заодно публикуем engine-API, который импортят слайсы.

**Files:**
- Modify: `src/components/anchor-engine/scope-id.ts` (добавить `anchorScopeAttr`)
- Modify: `src/components/anchor-engine/index.ts` (barrel: scope-id + rail-scopes + actions surface)
- Test: `src/components/anchor-engine/scope-id.test.ts` (добавить кейс)

**Interfaces:**
- Produces: `anchorScopeAttr(entityType: string, entityId: string): { "data-anchor-scope": string }`.
- Barrel `@/components/anchor-engine` экспортит (для слайсов): `anchorScopeAttr`, `AnchorScopeProvider`,
  `SelectionAffordanceHost`, `useStableAnchorAction`, `useRegisterRailScope`, `useRailScopes`,
  типы `RailScopeEntry`, `AnchorScopeId`, `AnchorDraft`, `AnchoredNote`, `TextAnchor`.

- [ ] **Step 1: Add the failing test case to `scope-id.test.ts`**

```ts
import { anchorScopeAttr } from "./scope-id";

it("anchorScopeAttr builds the data-* prop object", () => {
  expect(anchorScopeAttr("comment", "c1")).toEqual({ "data-anchor-scope": "comment:c1" });
});
```

Run: `pnpm vitest run src/components/anchor-engine/scope-id.test.ts`
Expected: FAIL ("anchorScopeAttr is not a function").

- [ ] **Step 2: Implement `anchorScopeAttr` in `scope-id.ts`**

```ts
/** Проп-объект для JSX-разметки тела сущности как скоупа: {...anchorScopeAttr("comment", id)}. */
export function anchorScopeAttr(
  entityType: string,
  entityId: string,
): { "data-anchor-scope": string } {
  return { "data-anchor-scope": formatScopeId({ entityType, entityId }) };
}
```

- [ ] **Step 3: Update barrel `index.ts`**

Добавь публичные экспорты (объедини с уже существующими; `AnchorScope`-компонента НЕТ):

```ts
export { anchorScopeAttr, type AnchorScopeId } from "./scope-id";
export {
  AnchorScopeProvider,
  SelectionAffordanceHost,
  useStableAnchorAction,
  type RailScopeEntry,
} from "./anchor-actions";
export { useRegisterRailScope, useRailScopes } from "./use-rail-scopes";
// MarginRail добавится в Task 8. AnchoredNote/AnchorDraft/TextAnchor уже экспортированы.
```

Сними в `anchor-actions.tsx` комментарий «useStableAnchorAction ВНУТРЕННИЙ … из index НЕ выносим» — теперь его регистрируют слайсы (create-action компоненты) через barrel.

- [ ] **Step 4: Run test + lint**

Run: `pnpm vitest run src/components/anchor-engine/scope-id.test.ts && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/anchor-engine/scope-id.ts src/components/anchor-engine/scope-id.test.ts src/components/anchor-engine/index.ts src/components/anchor-engine/anchor-actions.tsx
git commit -m "$(cat <<'EOF'
feat(anchor-engine): anchorScopeAttr хелпер + публичный barrel для слайсов

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `useAggregatedAnchorRanges` — мультикорневая геометрия

Считает Range/rect для заметок из МНОГИХ скоупов: каждая резолвится в СВОЁМ корне.

**Files:**
- Create: `src/components/anchor-engine/use-aggregated-anchor-ranges.ts`
- Test: `src/components/anchor-engine/use-aggregated-anchor-ranges.test.tsx`

**Interfaces:**
- Consumes: `rangeFromAnchor(anchor, root)` (existing `anchor-to-range.ts`), `RailScopeEntry` (Task 5).
- Produces:
  ```ts
  useAggregatedAnchorRanges(scopes: RailScopeEntry[]): {
    ranges: Map<string, Range | null>;
    getAnchorRect: (id: string) => DOMRect | null;
    recomputeKey: number;
  }
  ```
  Замечание: id заметок (UUID аннотаций) глобально уникальны → плоская Map по id корректна.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/anchor-engine/use-aggregated-anchor-ranges.test.tsx
import { render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

import type { RailScopeEntry } from "./use-rail-scopes";
import { useAggregatedAnchorRanges } from "./use-aggregated-anchor-ranges";

function scopeEl(html: string): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-anchor-scope", "document:x");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

function Probe({ scopes, onRanges }: { scopes: RailScopeEntry[]; onRanges: (ids: string[]) => void }) {
  const { ranges } = useAggregatedAnchorRanges(scopes);
  useEffect(() => onRanges([...ranges.keys()].filter((k) => ranges.get(k) !== null)));
  return null;
}

describe("useAggregatedAnchorRanges", () => {
  it("resolves each scope's note within its own root", () => {
    const a = scopeEl('<p data-block-id="b1">alpha beta</p>');
    const b = scopeEl('<p data-block-id="b1">alpha beta</p>'); // тот же block-id в другом скоупе
    const scopes: RailScopeEntry[] = [
      {
        key: "annotation:document:a",
        rootEl: a,
        tone: "annotation",
        notes: [{ id: "n-a", anchor: { startBlockId: "b1", endBlockId: "b1", startChar: 0, endChar: 5, exact: "alpha" } }],
        renderNote: () => null,
      },
      {
        key: "annotation:document:b",
        rootEl: b,
        tone: "annotation",
        notes: [{ id: "n-b", anchor: { startBlockId: "b1", endBlockId: "b1", startChar: 6, endChar: 10, exact: "beta" } }],
        renderNote: () => null,
      },
    ];
    let resolved: string[] = [];
    render(<Probe scopes={scopes} onRanges={(r) => (resolved = r)} />);
    expect(resolved.sort()).toEqual(["n-a", "n-b"]);
  });
});
```

Run: `pnpm vitest run src/components/anchor-engine/use-aggregated-anchor-ranges.test.tsx`
Expected: FAIL (нет модуля).

- [ ] **Step 2: Implement (по образцу `use-anchor-ranges.ts`, но по многим корням)**

```ts
"use client";
// src/components/anchor-engine/use-aggregated-anchor-ranges.ts
// Мультикорневая геометрия rail: каждая заметка резолвится в корне СВОЕГО скоупа.
// id заметок (UUID) глобально уникальны → плоская Map<id, Range|null>. Пересчёт:
// resize / шрифты / смена scopes / ResizeObserver на каждом корне.
import { useCallback, useEffect, useMemo, useState } from "react";

import { rangeFromAnchor } from "./anchor-to-range";
import type { RailScopeEntry } from "./use-rail-scopes";

export function useAggregatedAnchorRanges(scopes: RailScopeEntry[]) {
  const [recomputeKey, setRecomputeKey] = useState(0);

  useEffect(() => {
    const bump = () => setRecomputeKey((k) => k + 1);
    bump();
    window.addEventListener("resize", bump);
    const ros: ResizeObserver[] = [];
    if (typeof ResizeObserver !== "undefined") {
      for (const s of scopes) {
        const ro = new ResizeObserver(bump);
        ro.observe(s.rootEl);
        ros.push(ro);
      }
    }
    const fonts = (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts;
    fonts?.ready.then(bump).catch(() => undefined);
    return () => {
      window.removeEventListener("resize", bump);
      for (const ro of ros) ro.disconnect();
    };
  }, [scopes]);

  const ranges = useMemo(() => {
    const m = new Map<string, Range | null>();
    for (const s of scopes) {
      for (const n of s.notes) m.set(n.id, rangeFromAnchor(n.anchor, s.rootEl));
    }
    return m;
    // recomputeKey намеренно в deps — форсит перестроение при смене геометрии.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopes, recomputeKey]);

  const getAnchorRect = useCallback(
    (id: string) => {
      const r = ranges.get(id);
      return r ? r.getBoundingClientRect() : null;
    },
    [ranges],
  );

  return { ranges, getAnchorRect, recomputeKey };
}
```

- [ ] **Step 3: Run test to verify it passes**

Run: `pnpm vitest run src/components/anchor-engine/use-aggregated-anchor-ranges.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/anchor-engine/use-aggregated-anchor-ranges.ts src/components/anchor-engine/use-aggregated-anchor-ranges.test.tsx
git commit -m "$(cat <<'EOF'
feat(anchor-engine): useAggregatedAnchorRanges — геометрия заметок по многим корням

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `MarginRail` — агрегатор-приёмник

Page-level колонка одного тона: собирает заметки всех скоупов, подсвечивает, рисует одну колонку + выноски. Аналог прежнего `MarginAnchorLayer`, но по многим корням.

**Files:**
- Create: `src/components/anchor-engine/margin-rail.tsx`
- Modify: `src/components/anchor-engine/index.ts` (экспорт `MarginRail`, `AnchorScope`, `AnchorScopeProvider`)
- Test: `src/components/anchor-engine/margin-rail.test.tsx`

**Interfaces:**
- Consumes: `useRailScopes` (Task 5), `useAggregatedAnchorRanges` (Task 7), `MarginNotesColumn`/`ColumnNote` (existing), `ConnectorLayer` (existing), `HighlightController` (existing), `toneColor` (existing).
- Produces: `MarginRail({ tone, highlightName }: { tone: "annotation" | "comment"; highlightName: string }): ReactNode`.

- [ ] **Step 1: Write the failing test (smoke: рендерит карточки из 2 скоупов в одну колонку)**

```tsx
// src/components/anchor-engine/margin-rail.test.tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnchorScopeProvider } from "./anchor-actions";
import { MarginRail } from "./margin-rail";
import { useRegisterRailScope, type RailScopeEntry } from "./use-rail-scopes";

function Reg({ entry }: { entry: RailScopeEntry }) {
  useRegisterRailScope(entry);
  return null;
}

function makeScope(key: string, noteId: string, label: string): RailScopeEntry {
  const el = document.createElement("div");
  el.setAttribute("data-anchor-scope", "document:x");
  el.innerHTML = '<p data-block-id="b1">alpha beta</p>';
  document.body.appendChild(el);
  return {
    key,
    rootEl: el,
    tone: "annotation",
    notes: [{ id: noteId, anchor: { startBlockId: "b1", endBlockId: "b1", startChar: 0, endChar: 5, exact: "alpha" } }],
    renderNote: () => <span>{label}</span>,
  };
}

describe("MarginRail", () => {
  it("renders cards aggregated from multiple scopes in one column", () => {
    render(
      <AnchorScopeProvider>
        <Reg entry={makeScope("annotation:document:a", "n-a", "card-A")} />
        <Reg entry={makeScope("annotation:document:b", "n-b", "card-B")} />
        <MarginRail tone="annotation" highlightName="annotation" />
      </AnchorScopeProvider>,
    );
    expect(document.body.textContent).toContain("card-A");
    expect(document.body.textContent).toContain("card-B");
    expect(document.querySelector('[data-note-card="n-a"]')).not.toBeNull();
    expect(document.querySelector('[data-note-card="n-b"]')).not.toBeNull();
  });
});
```

Run: `pnpm vitest run src/components/anchor-engine/margin-rail.test.tsx`
Expected: FAIL (нет модуля).

- [ ] **Step 2: Implement `margin-rail.tsx`** (перенеси логику из `margin-anchor-layer.tsx`, заменив один `astRootRef`/`notes` на агрегат скоупов)

```tsx
"use client";
// src/components/anchor-engine/margin-rail.tsx
// Page-level агрегатор-приёмник одного тона. Собирает заметки ВСЕХ скоупов
// (useRailScopes) → мультикорневая геометрия → одна колонка карточек + выноски +
// подсветка по общему каналу. Заменяет per-feature MarginAnchorLayer.
import { useCallback, useMemo, useRef, useState } from "react";

import type { Motion } from "@/styles/tokens/enums";
import { isReducedMotion } from "@/utils/is-reduced-motion";

import { ConnectorLayer } from "./connector-layer";
import { cssEscape } from "./css-escape";
import { HighlightController } from "./highlight-controller";
import { HighlightOverlay } from "./highlight-overlay";
import { MarginNotesColumn, type ColumnNote } from "./margin-notes-column";
import { toneColor } from "./tone";
import type { AnchoredNote } from "./types";
import { useAggregatedAnchorRanges } from "./use-aggregated-anchor-ranges";
import { useAnchorHighlights } from "./use-anchor-highlights";
import { useRailScopes } from "./use-rail-scopes";

function scrollBehavior(): ScrollBehavior {
  if (typeof document === "undefined") return "auto";
  const motion = (document.documentElement.dataset.motion as Motion | undefined) ?? "system";
  const osReduce =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  return isReducedMotion({ motion, osReduce }) ? "auto" : "smooth";
}

const ACTIVATE_SCROLL_OFFSET_PX = 100;

export function MarginRail({
  tone,
  highlightName,
}: {
  tone: "annotation" | "comment";
  highlightName: string;
}) {
  const scopes = useRailScopes(tone);
  const controllerRef = useRef<HighlightController | null>(null);
  controllerRef.current ??= new HighlightController(highlightName);
  const controller = controllerRef.current;

  const { ranges, getAnchorRect, recomputeKey } = useAggregatedAnchorRanges(scopes);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const emphasizedId = hoveredId ?? activeId;

  // Все заметки всех скоупов (плоско) + renderNote + флаг подсветки скоупа по id.
  const flat = useMemo(() => {
    const items: {
      note: AnchoredNote;
      render: (n: AnchoredNote, orphan: boolean) => React.ReactNode;
      highlight: boolean;
    }[] = [];
    for (const s of scopes)
      for (const n of s.notes)
        items.push({ note: n, render: s.renderNote, highlight: s.highlightEnabled !== false });
    return items;
  }, [scopes]);
  const allIds = flat.map((f) => f.note.id);
  // Подсвечиваем только заметки скоупов с highlightEnabled !== false (reading-mode).
  const persistentIds = flat.filter((f) => f.highlight).map((f) => f.note.id);

  useAnchorHighlights({
    controller,
    ranges,
    persistentIds,
    activeId: emphasizedId,
    enabled: true,
  });

  const onActivate = useCallback(
    (id: string) => {
      setActiveId(id);
      const r = ranges.get(id);
      if (r) {
        const rect = r.getBoundingClientRect();
        window.scrollTo({
          top: rect.top + window.scrollY - ACTIVATE_SCROLL_OFFSET_PX,
          behavior: scrollBehavior(),
        });
      }
    },
    [ranges],
  );

  const accent = toneColor(tone);
  const columnNotes: ColumnNote[] = flat.map(({ note, render }) => {
    const orphan = (ranges.get(note.id) ?? null) === null;
    return {
      id: note.id,
      orphan,
      node: (
        <div
          data-note-card={note.id}
          style={{ borderInlineStart: `3px solid ${accent}`, paddingInlineStart: "0.5rem" }}
        >
          {render(note, orphan)}
        </div>
      ),
    };
  });

  const overlayRanges = !controller.supported
    ? [...ranges.values()].filter((r): r is Range => r !== null)
    : [];

  // Двусторонний клик карточка→текст оставлен (onActivate). Текст→карточка
  // (useTextClick) и hover-из-текста (useHoverReveal) в rail НЕ навешиваем: они
  // требовали единого astRootRef; в мультикорневом rail это follow-up (см. план,
  // раздел «вне объёма v1»). cssEscape/scrollBehavior используются onActivate.
  void cssEscape;

  return (
    <>
      {overlayRanges.length > 0 && (
        <HighlightOverlay
          ranges={overlayRanges}
          activeRange={activeId ? (ranges.get(activeId) ?? null) : null}
        />
      )}
      <MarginNotesColumn
        notes={columnNotes}
        getAnchorRect={getAnchorRect}
        onActivate={onActivate}
        onHoverNote={setHoveredId}
        recomputeKey={recomputeKey}
      />
      <ConnectorLayer
        ids={allIds}
        getAnchorRect={getAnchorRect}
        astRootRef={{ current: null }}
        activeId={emphasizedId}
        tone={tone}
        recomputeKey={recomputeKey}
      />
    </>
  );
}
```

Примечание имплементатору: проверь сигнатуру `ConnectorLayer` (`src/components/anchor-engine/connector-layer.tsx`) — если `astRootRef` используется только для системы координат контейнера, передача `{ current: null }` допустима (выноски считаются по вьюпорт-rect'ам из `getAnchorRect`). Если `ConnectorLayer` обязательно требует непустой root — заведи невидимый page-level контейнер-ref на обёртке rail и передай его. Зафиксируй выбор в тесте на выноску в Task 13.

- [ ] **Step 3: Export from index**

В `src/components/anchor-engine/index.ts` добавь (остальной публичный API уже добавлен в Task 6):

```ts
export { MarginRail } from "./margin-rail";
```

(Старые экспорты `MarginAnchorLayer`/`AnchorActionsProvider` пока оставь — удалим в Task 13.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/components/anchor-engine/margin-rail.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/anchor-engine/margin-rail.tsx src/components/anchor-engine/index.ts src/components/anchor-engine/margin-rail.test.tsx
git commit -m "$(cat <<'EOF'
feat(anchor-engine): MarginRail — page-level агрегатор заметок одного тона

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Миграция аннотаций документа на scope + rail (регресс-паритет)

Переводим существующий путь аннотаций документа с `MarginAnchorLayer` на `AnnotationScope` (регистрация заметок) + page-level `MarginRail` + page-level действие создания, маршрутизирующееся по `draft.scope`. UX документа НЕ меняется.

**Files:**
- Create: `src/features/annotations/ui/annotation-scope.tsx` (client; заметки→rail; тумблер подсветки; кнопка «без якоря»; композер)
- Create: `src/features/annotations/ui/annotation-create-action.tsx` (client; регистрирует page-level действие)
- Modify: `src/features/annotations/ui/document-annotations.tsx` (server: оборачивает тело документа в scope-контейнер через client-обёртку — см. ниже)
- Modify: `src/app/lectures/[id]/page.tsx`, `src/app/documents/[id]/page.tsx`
- Delete: `src/features/annotations/ui/document-annotation-layer.tsx`
- Test: `src/features/annotations/ui/annotation-create-action.test.tsx`

**Interfaces:**
- Consumes: `AnchorScope`, `MarginRail`, `useStableAnchorAction` (через `@/components/anchor-engine`), `toEngineAnchor`/`fromEngineAnchor` (`../anchor`), `AnchoredNote`, `AnchorDraft`.
- Produces: `AnnotationCreateAction({ canCreate }: { canCreate: boolean })` регистрирует действие `id="annotation"`, `appliesTo: () => true`, `onCreate` открывает композер с `parentId = draft.scope.entityId` и `fromEngineAnchor(draft.anchor)`.

Ключевое решение: **тело документа уже размечено** на странице (`<div data-ast-root>`). Добавляем туда `data-anchor-scope="document:<id>"` (через `anchorScopeAttr`). Тело server-rendered (`DocumentDetail`), а `renderNote` клиентский — поэтому регистрацию заметок делает клиентский `AnnotationScope`: он знает `entityType/entityId` (пропы) и находит свой уже-размеченный корень через `document.querySelector('[data-anchor-scope="<type>:<id>"]')` ОДИН раз (id уникален → селектор однозначен даже когда скоупов на странице много). Для комментариев (Task 11) атрибут ставится в `comment-node-view`, регистрацию делает тот же `AnnotationScope`.

- [ ] **Step 1: Mark the document body as a scope (both pages)**

В `src/app/lectures/[id]/page.tsx` импортируй `anchorScopeAttr` из `@/components/anchor-engine` и на строке 116 замени:

```tsx
<div data-ast-root>
```
на
```tsx
<div data-ast-root {...anchorScopeAttr("document", activeId)}>
```

То же в `src/app/documents/[id]/page.tsx:93`, подставив реальное имя переменной id активного документа (имплементатор сверится — на странице документа это id из `params`/загруженного документа).

Замечание: `data-ast-root` оставляем как дополнительный маркер на время переходного периода (на него ещё смотрит удаляемый код), удалим в Task 13.

- [ ] **Step 2: Write the failing test for the create action routing**

```tsx
// src/features/annotations/ui/annotation-create-action.test.tsx
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AnchorScopeProvider, SelectionAffordanceHost } from "@/components/anchor-engine";

import { AnnotationCreateAction } from "./annotation-create-action";

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

describe("AnnotationCreateAction routing", () => {
  it("opens composer with parentId = selected scope entityId", () => {
    document.body.innerHTML =
      '<div data-anchor-scope="comment:cmt-42"><p data-block-id="b1">hello world</p></div>';
    const onOpen = vi.fn();
    render(
      <AnchorScopeProvider>
        <AnnotationCreateAction canCreate onOpenComposer={onOpen} />
        <SelectionAffordanceHost />
      </AnchorScopeProvider>,
    );
    const p = document.querySelector("[data-block-id]")!;
    const sel = window.getSelection()!;
    const r = document.createRange();
    r.setStart(p.firstChild!, 0);
    r.setEnd(p.firstChild!, 5);
    sel.removeAllRanges();
    sel.addRange(r);
    act(() => document.dispatchEvent(new Event("pointerup")));
    // клик по кнопке аффорданса
    const btn = document.querySelector("button")!;
    act(() => btn.click());
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ parentEntityType: "comment", parentId: "cmt-42" }),
    );
  });
});
```

Run: `pnpm vitest run src/features/annotations/ui/annotation-create-action.test.tsx`
Expected: FAIL (нет модуля).

- [ ] **Step 3: Implement `annotation-create-action.tsx`**

Тестируемое ядро действия выделяем в отдельный client-компонент с инъектируемым `onOpenComposer` (чтобы тест не тянул реальный композер/SchemaContext):

```tsx
"use client";
// src/features/annotations/ui/annotation-create-action.tsx
// Регистрирует page-level действие «аннотировать»: применимо к ЛЮБОМУ скоупу
// (annotation.ParentEntityType покрывает document/glossary/media/comment). При
// клике открывает композер с parentId = draft.scope.entityId и доменным якорем.
import { type AnchorDraft, useStableAnchorAction } from "@/components/anchor-engine";
import { useT } from "@/i18n/client";

import { fromEngineAnchor } from "../anchor";
import type { Anchor } from "../types";

export interface AnnotationComposerOpen {
  parentEntityType: string;
  parentId: string;
  anchor: Anchor;
}

export function AnnotationCreateAction({
  canCreate,
  onOpenComposer,
}: {
  canCreate: boolean;
  onOpenComposer: (open: AnnotationComposerOpen) => void;
}) {
  const t = useT("annotations");
  useStableAnchorAction({
    id: "annotation",
    label: t("marginAddButton"),
    enabled: canCreate,
    appliesTo: () => true, // аннотировать можно любой AST-скоуп
    onCreate: (d: AnchorDraft) => {
      onOpenComposer({
        parentEntityType: d.scope.entityType,
        parentId: d.scope.entityId,
        anchor: fromEngineAnchor(d.anchor),
      });
    },
  });
  return null;
}
```

Run: `pnpm vitest run src/features/annotations/ui/annotation-create-action.test.tsx`
Expected: PASS.

- [ ] **Step 4: Implement `annotation-scope.tsx` (client connector — заметки в rail + композер)**

Заменяет `document-annotation-layer.tsx`. Регистрирует заметки документа в rail (через `AnchorScope`? — нет: тело документа server-rendered и уже помечено атрибутом; здесь регистрируем ТОЛЬКО заметки в rail, корень находим по существующему `[data-anchor-scope="document:<id>"]`). Использует `useRegisterRailScope` напрямую.

```tsx
"use client";
// src/features/annotations/ui/annotation-scope.tsx
// Client-коннектор аннотаций сущности → rail. Тело сущности уже размечено
// data-anchor-scope на странице (документ) / в comment-node-view (комментарий);
// здесь: (1) находим этот корень по уникальному id, (2) регистрируем заякоренные
// заметки в rail (мемоизированный entry — иначе register-цикл в провайдере),
// (3) SSR-фолбэк-список + действие create + композер. Тулбар (add-unanchored +
// тумблер подсветки) рендерим ТОЛЬКО при showToolbar (документ), не на каждый
// комментарий. Тумблер влияет на highlightEnabled этого скоупа в rail.
// Guardrail 4: только pure-фасады + движок + kit + i18n/client + композер.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { useRegisterRailScope, type AnchoredNote } from "@/components/anchor-engine";
import { Button, Inline } from "@/components/ui";
import { useT } from "@/i18n/client";

import { toEngineAnchor } from "../anchor";
import type { Anchor } from "../types";

import { AnnotationComposerDialog } from "./annotation-composer-dialog";
import { AnnotationCreateAction, type AnnotationComposerOpen } from "./annotation-create-action";

interface NoteVM {
  id: string;
  anchor: Anchor | undefined;
  card: ReactNode;
}

interface Props {
  parentEntityType: string;
  parentId: string;
  notes: NoteVM[];
  canCreate: boolean;
  /** Документ: показать тулбар (add-unanchored + тумблер). Комментарии: false. */
  showToolbar?: boolean;
}

const KEY = "annotation-highlights";

export function AnnotationScope({
  parentEntityType,
  parentId,
  notes,
  canCreate,
  showToolbar = false,
}: Props) {
  const t = useT("annotations");
  const [composer, setComposer] = useState<{ open: boolean; anchor?: Anchor; parentId: string }>({
    open: false,
    parentId,
  });
  const [highlight, setHighlight] = useState(true);

  useEffect(() => {
    if (window.localStorage.getItem(KEY) === "off") setHighlight(false);
  }, []);

  const toggle = () => {
    setHighlight((h) => {
      const next = !h;
      window.localStorage.setItem(KEY, next ? "on" : "off");
      return next;
    });
  };

  // Мемоизация по props.notes: стабильно при локальных state (highlight/composer).
  const engineNotes = useMemo<AnchoredNote[]>(
    () =>
      notes.flatMap((n) => {
        const engine = n.anchor ? toEngineAnchor(n.anchor) : null;
        return engine ? [{ id: n.id, anchor: engine }] : [];
      }),
    [notes],
  );
  const cardById = useMemo(() => new Map(notes.map((n) => [n.id, n.card])), [notes]);
  const engineIds = new Set(engineNotes.map((n) => n.id));
  const ssrOnly = notes.filter((n) => !engineIds.has(n.id));

  // Корень сущности (server-rendered) ищем по уникальному id и держим в state,
  // чтобы entry пересобрался, когда узел найден.
  const [rootEl, setRootEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setRootEl(
      document.querySelector<HTMLElement>(`[data-anchor-scope="${parentEntityType}:${parentId}"]`),
    );
  }, [parentEntityType, parentId]);
  const ready = rootEl !== null;

  const renderNote = useCallback(
    (n: AnchoredNote, orphan: boolean): ReactNode => (
      <>
        {orphan && <p className="text-xs text-(--color-fg-muted)">{t("marginOrphanLabel")}</p>}
        {cardById.get(n.id) ?? null}
      </>
    ),
    [cardById, t],
  );

  // Стабильный entry: меняется только при смене корня/заметок/renderNote/highlight,
  // НЕ на каждый рендер → нет register-цикла в провайдере.
  const entry = useMemo(
    () =>
      rootEl
        ? {
            key: `annotation:${parentEntityType}:${parentId}`,
            rootEl,
            tone: "annotation" as const,
            notes: engineNotes,
            renderNote,
            highlightEnabled: highlight,
          }
        : null,
    [rootEl, parentEntityType, parentId, engineNotes, renderNote, highlight],
  );
  useRegisterRailScope(entry);

  return (
    <div className="flex flex-col gap-4" aria-label={t("marginColumnLabel")}>
      {showToolbar && (
        <Inline gap="tight" align="start">
          {canCreate && (
            <Button
              type="button"
              compact
              tone="primary"
              onClick={() => setComposer({ open: true, parentId })}
            >
              {t("marginAddUnanchored")}
            </Button>
          )}
          <Button type="button" compact tone="quiet" onClick={toggle}>
            {highlight ? t("marginHighlightToggleOn") : t("marginHighlightToggleOff")}
          </Button>
        </Inline>
      )}

      {/* SSR-фолбэк: карточки без движкового якоря — всегда списком. */}
      {ssrOnly.map((n) => (
        <div key={n.id}>{n.card}</div>
      ))}

      {/* До mount (ready=false): якорённые карточки списком (есть в HTML). После —
          их позиционирует MarginRail из реестра; здесь больше не рендерим. */}
      {!ready && engineNotes.map((n) => <div key={n.id}>{cardById.get(n.id)}</div>)}

      <AnnotationCreateAction
        canCreate={canCreate}
        onOpenComposer={(o: AnnotationComposerOpen) =>
          setComposer({ open: true, anchor: o.anchor, parentId: o.parentId })
        }
      />

      <AnnotationComposerDialog
        parentId={composer.parentId}
        open={composer.open}
        onOpenChange={(open) => setComposer((c) => ({ ...c, open }))}
        anchor={composer.anchor}
      />
    </div>
  );
}
```

Примечание: проверь проп `AnnotationComposerDialog` — сейчас он `parentId: string` (см. `document-annotation-layer.tsx:137`). Если он жёстко завязан на `parentEntityType="document"` внутри (роут create), это станет видно при аннотировании комментария — тогда расширить его проп `parentEntityType` и прокинуть в `createAnnotation`. Зафиксируй в Task 12. На комментариях тулбар не нужен (`showToolbar` опускается → false).

- [ ] **Step 5: Update server `document-annotations.tsx` + mount `MarginRail` on pages**

`document-annotations.tsx`: замени импорт/использование `DocumentAnnotationLayer` на `AnnotationScope` c `parentEntityType="document"`:

```tsx
import { AnnotationScope } from "./annotation-scope";
// ... (документ — единственный скоуп с тулбаром: add-unanchored + тумблер подсветки)
<AnnotationScope parentEntityType="document" parentId={parentId} notes={notes} canCreate={canCreate} showToolbar />
```

В `src/app/lectures/[id]/page.tsx`: импорт `MarginRail` из `@/components/anchor-engine`, добавь в правый `MarginNote` рельсу (ОДНУ на страницу). Поскольку правый `MarginNote` уже содержит `DocumentAnnotations`, помести `<MarginRail tone="annotation" highlightName="annotation" />` в него ПОСЛЕ `<DocumentAnnotations>` (rail позиционирует абсолютно — порядок в потоке для него непринципиален, но колонка живёт в правом поле):

```tsx
{activeDoc && activeId && (
  <MarginNote side="end" grow className="p-4 @marginalia:ps-0">
    <Suspense fallback={<Skeleton className="h-32 w-full" />}>
      <DocumentAnnotations parentId={activeId} />
    </Suspense>
    <MarginRail tone="annotation" highlightName="annotation" />
  </MarginNote>
)}
```

То же для `src/app/documents/[id]/page.tsx`.

- [ ] **Step 6: Delete the obsolete layer**

```bash
git rm src/features/annotations/ui/document-annotation-layer.tsx
```

Поправь барель `src/features/annotations/index.ts`, если он реэкспортил `DocumentAnnotationLayer` (заменить на ничего — слой внутренний).

- [ ] **Step 7: Run targeted tests + lint + build**

Run: `pnpm vitest run src/features/annotations && pnpm lint && pnpm build`
Expected: PASS; сборка зелёная. (Если `build` падает на оставшихся импортах `MarginAnchorLayer`/`AnchorActionsProvider` — они ещё экспортируются, alias жив; импортёры страниц перейдут на `AnchorScopeProvider` в Step 5 — обнови импорт в обеих страницах с `AnchorActionsProvider` на `AnchorScopeProvider`.)

- [ ] **Step 8: Commit**

```bash
git add src/features/annotations/ui/annotation-scope.tsx src/features/annotations/ui/annotation-create-action.tsx src/features/annotations/ui/annotation-create-action.test.tsx src/features/annotations/ui/document-annotations.tsx src/features/annotations/index.ts src/app/lectures/[id]/page.tsx src/app/documents/[id]/page.tsx
git rm src/features/annotations/ui/document-annotation-layer.tsx
git commit -m "$(cat <<'EOF'
refactor(annotations): документ на AnchorScope + MarginRail; create по draft.scope

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Миграция заякоренных комментариев (левая рельса) на scope + rail

Зеркалит Task 9 для левого поля (комментарии-в-документ). Действие «комментировать фрагмент» применимо только к `document`-скоупу (v1).

**Files:**
- Create: `src/features/comments/ui/comment-anchor-scope.tsx` (заменяет `document-comment-layer.tsx`)
- Modify: `src/features/comments/ui/document-comments.tsx` (server-сборщик — отдаёт в новый scope)
- Modify: `src/app/lectures/[id]/page.tsx` (левый `MarginNote` + `MarginRail tone="comment"`)
- Delete: `src/features/comments/ui/document-comment-layer.tsx`
- Test: `src/features/comments/ui/comment-anchor-create.test.tsx`

**Interfaces:**
- Consumes: `useRegisterRailScope`, `useStableAnchorAction`, `coordsToEngineAnchor` (`@/utils/text-anchor`), `buildCommentTextAnchor` (`../anchor`).
- Produces: действие `id="comment-anchor"`, `appliesTo: (t) => t === "document"`, `onCreate` строит `buildCommentTextAnchor(draft.anchor, draft.scope.entityId)` и открывает comment-композер.

- [ ] **Step 1: Write the failing test (comment-anchor action applies only to document scope)**

```tsx
// src/features/comments/ui/comment-anchor-create.test.tsx
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AnchorScopeProvider, SelectionAffordanceHost } from "@/components/anchor-engine";

import { CommentAnchorCreateAction } from "./comment-anchor-scope";

vi.mock("@/i18n/client", () => ({ useT: () => (k: string) => k }));

function selectIn(scopeAttr: string) {
  document.body.innerHTML = `<div data-anchor-scope="${scopeAttr}"><p data-block-id="b1">hello world</p></div>`;
  const p = document.querySelector("[data-block-id]")!;
  const sel = window.getSelection()!;
  const r = document.createRange();
  r.setStart(p.firstChild!, 0);
  r.setEnd(p.firstChild!, 5);
  sel.removeAllRanges();
  sel.addRange(r);
}

describe("CommentAnchorCreateAction applicability", () => {
  it("offers on a document scope, hides on a comment scope", () => {
    const onOpen = vi.fn();
    render(
      <AnchorScopeProvider>
        <CommentAnchorCreateAction canCreate onOpenComposer={onOpen} />
        <SelectionAffordanceHost />
      </AnchorScopeProvider>,
    );

    selectIn("document:doc-7");
    act(() => document.dispatchEvent(new Event("pointerup")));
    expect(document.querySelector("button")).not.toBeNull();
    act(() => document.querySelector("button")!.click());
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ targetDocumentId: "doc-7" }));

    onOpen.mockClear();
    selectIn("comment:c-9");
    act(() => document.dispatchEvent(new Event("pointerup")));
    expect(document.querySelector("button")).toBeNull(); // comment-anchor не применимо к comment-скоупу
  });
});
```

Run: `pnpm vitest run src/features/comments/ui/comment-anchor-create.test.tsx`
Expected: FAIL (нет модуля/экспорта).

- [ ] **Step 2: Implement `comment-anchor-scope.tsx`** (по образцу Task 9 `annotation-scope.tsx` + `annotation-create-action.tsx`, тон `comment`, канал `comment`)

Содержит два экспорта: `CommentAnchorCreateAction` (регистрация действия) и `CommentAnchorScope` (регистрация заметок в rail + comment-композер). Действие:

```tsx
"use client";
// src/features/comments/ui/comment-anchor-scope.tsx
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  type AnchorDraft,
  type AnchoredNote,
  useRegisterRailScope,
  useStableAnchorAction,
} from "@/components/anchor-engine";
import { useT } from "@/i18n/client";
import { coordsToEngineAnchor } from "@/utils/text-anchor";

import { buildCommentTextAnchor } from "../anchor";
import type { Anchor, CommentType } from "../types";

import { CommentComposerDialog } from "./comment-composer-dialog";

export interface CommentAnchorComposerOpen {
  targetDocumentId: string;
  anchor: Anchor;
}

export function CommentAnchorCreateAction({
  canCreate,
  onOpenComposer,
}: {
  canCreate: boolean;
  onOpenComposer: (o: CommentAnchorComposerOpen) => void;
}) {
  const t = useT("comments");
  useStableAnchorAction({
    id: "comment-anchor",
    label: t("marginCommentAdd"),
    enabled: canCreate,
    appliesTo: (type) => type === "document", // v1: якорь комментария только в документ
    onCreate: (d: AnchorDraft) => {
      onOpenComposer({
        targetDocumentId: d.scope.entityId,
        anchor: buildCommentTextAnchor(d.anchor, d.scope.entityId),
      });
    },
  });
  return null;
}

export interface CommentAnchorNote {
  id: string;
  anchor: Anchor;
  preview: ReactNode;
}

export function CommentAnchorScope({
  lectureId,
  documentId,
  rootTypes,
  notes,
  canCreate,
}: {
  lectureId: string;
  documentId: string;
  rootTypes: CommentType[];
  notes: CommentAnchorNote[];
  canCreate: boolean;
}) {
  const t = useT("comments");
  const [composer, setComposer] = useState<{ open: boolean; anchor?: Anchor }>({ open: false });

  // Корень = тело документа (скоуп document:<id>) — у него же якорятся комментарии.
  const [rootEl, setRootEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setRootEl(document.querySelector<HTMLElement>(`[data-anchor-scope="document:${documentId}"]`));
  }, [documentId]);
  const ready = rootEl !== null;

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

  const renderNote = useCallback(
    (n: AnchoredNote, orphan: boolean): ReactNode => (
      <>
        {orphan && <p className="text-xs text-(--color-fg-muted)">{t("marginOrphanLabel")}</p>}
        {previewById.get(n.id) ?? null}
      </>
    ),
    [previewById, t],
  );

  const entry = useMemo(
    () =>
      rootEl
        ? {
            key: `comment:document:${documentId}`,
            rootEl,
            tone: "comment" as const,
            notes: engineNotes,
            renderNote,
          }
        : null,
    [rootEl, documentId, engineNotes, renderNote],
  );
  useRegisterRailScope(entry);

  return (
    <div className="flex flex-col gap-4" aria-label={t("marginColumnLabel")}>
      {ssrOnly.map((n) => (
        <div key={n.id}>{n.preview}</div>
      ))}
      {!ready && engineNotes.map((n) => <div key={n.id}>{previewById.get(n.id)}</div>)}

      <CommentAnchorCreateAction
        canCreate={canCreate}
        onOpenComposer={(o) => setComposer({ open: true, anchor: o.anchor })}
      />

      <CommentComposerDialog
        lectureId={lectureId}
        rootTypes={rootTypes}
        open={composer.open}
        onOpenChange={(open) => setComposer((c) => ({ ...c, open }))}
        anchor={composer.anchor}
      />
    </div>
  );
}
```

Run: `pnpm vitest run src/features/comments/ui/comment-anchor-create.test.tsx`
Expected: PASS.

- [ ] **Step 3: Server `document-comments.tsx` → отдаёт в `CommentAnchorScope`**

Замени использование `DocumentCommentLayer` на `CommentAnchorScope` (поля `notes`/`canCreate`/`rootTypes` остаются; имплементатор сверится с текущим `document-comments.tsx`). Импорт обнови.

- [ ] **Step 4: Mount left `MarginRail` on the lecture page**

В `src/app/lectures/[id]/page.tsx` левый `MarginNote` (строки 182-188): добавь рельсу после `DocumentComments`:

```tsx
{activeDoc && activeId && (
  <MarginNote side="start" grow className="p-4 @marginalia:pe-0">
    <Suspense fallback={<Skeleton className="h-32 w-full" />}>
      <DocumentComments lectureId={id} documentId={activeId} />
    </Suspense>
    <MarginRail tone="comment" highlightName="comment" />
  </MarginNote>
)}
```

- [ ] **Step 5: Delete obsolete layer + run gate**

```bash
git rm src/features/comments/ui/document-comment-layer.tsx
```
Поправь `src/features/comments/index.ts`, если реэкспортил слой.

Run: `pnpm vitest run src/features/comments && pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/comments/ui/comment-anchor-scope.tsx src/features/comments/ui/comment-anchor-create.test.tsx src/features/comments/ui/document-comments.tsx src/features/comments/index.ts src/app/lectures/[id]/page.tsx
git rm src/features/comments/ui/document-comment-layer.tsx
git commit -m "$(cat <<'EOF'
refactor(comments): заякоренные комментарии на CommentAnchorScope + MarginRail(comment)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Фича — аннотируем тело комментария

Каждый комментарий становится annotation-скоупом: тело оборачивается `data-anchor-scope="comment:<id>"`, его аннотации фетчатся и регистрируются в правую рельсу.

**Files:**
- Modify: `src/features/comments/ui/comment-node-view.tsx` (обернуть тело в scope-атрибут)
- Modify: `src/features/comments/ui/comment-node.tsx` (server: фетч аннотаций комментария + AnnotationScope)
- Test: `src/features/comments/ui/comment-node-view.test.tsx` (или новый) — тело несёт `data-anchor-scope`

**Interfaces:**
- Consumes: `AnnotationScope` (Task 9, экспортируй из `@/features/annotations`), `getLectureAnnotations` (новый батч-фетч, ниже), `buildAnnotationCards`.
- Produces: тело комментария в DOM имеет предка `[data-anchor-scope="comment:<id>"]`; `getLectureAnnotations(lectureId, { parentEntityType, token }): Promise<Annotation[]>` (React `cache()` — один HTTP на запрос).

Решение по фетчу (N+1 РЕШЁН батч-ручкой, см. спеку «Бэкенд»): аннотации всех комментариев лекции тянем ОДНИМ вызовом `GET /api/lectures/{id}/annotations?parent_entity_type=comment`, группируем по `parent_entity_id`. Фетч обёрнут в React `cache()` → N серверных `CommentNode` дают один HTTP. Никакого пер-комментного фетча и стопгапа.

- [ ] **Step 1: Write the failing test (comment body is an annotation scope)**

```tsx
// src/features/comments/ui/comment-node-view.test.tsx  (добавь кейс)
import { render } from "@testing-library/react";
import { expect, it } from "vitest";

import { CommentNodeView } from "./comment-node-view";

it("wraps the comment body in a comment scope", () => {
  const comment = {
    id: "cmt-1",
    lecture_id: "l1",
    type: "claim",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    blocks: [{ id: "b1", type: "paragraph", content: [{ type: "text", text: "тело" }] }],
  } as never;
  const { container } = render(<CommentNodeView comment={comment} scopeEnabled />);
  const scope = container.querySelector('[data-anchor-scope="comment:cmt-1"]');
  expect(scope).not.toBeNull();
  expect(scope?.textContent).toContain("тело");
});
```

Run: `pnpm vitest run src/features/comments/ui/comment-node-view.test.tsx`
Expected: FAIL (нет `scopeEnabled` / атрибута).

- [ ] **Step 2: Wrap the body in `comment-node-view.tsx`**

Импортируй `anchorScopeAttr` из `@/components/anchor-engine` (pure-функция, без хуков — изоморфный контракт view не нарушается). Добавь опциональный проп `scopeEnabled?: boolean` (по умолчанию false — офлайн/изоморфный путь без скоупа). Когда `true`, помечай блок тела атрибутом:

```tsx
// в Props:
/** Онлайн: пометить тело как annotation-scope (data-anchor-scope=comment:<id>). */
scopeEnabled?: boolean;

// замена блока тела:
<div
  className="content"
  data-size="sm"
  {...(scopeEnabled ? anchorScopeAttr("comment", comment.id) : {})}
>
  <AstRender blocks={comment.blocks ?? []} />
</div>
```

Замечание: `data-block-id` на блоках тела уже есть (read-рендер). Атрибут scope на обёртке `.content` делает её корнем скоупа.

Run: `pnpm vitest run src/features/comments/ui/comment-node-view.test.tsx`
Expected: PASS.

- [ ] **Step 3: Батч-фетч `getLectureAnnotations` (React `cache()`)**

В `src/features/annotations/api.ts` добавь батч-фетч аннотаций лекции с дедупликацией per-request и пагинацией. Сверься с существующим `getAnnotationsFor` (как строится URL/парсится `httputil.ListResponse`).

```ts
import { cache } from "react";

// Все аннотации лекции одним вызовом (фильтр по типу родителя). Обёрнут в
// React cache() → N серверных CommentNode дают один HTTP per-request.
export const getLectureAnnotations = cache(
  async (
    lectureId: string,
    opts?: { parentEntityType?: "document" | "comment" | "media"; token?: string },
  ): Promise<Annotation[]> => {
    const all: Annotation[] = [];
    const limit = 200;
    for (let offset = 0; ; offset += limit) {
      const qs = new URLSearchParams({ offset: String(offset), limit: String(limit) });
      if (opts?.parentEntityType) qs.set("parent_entity_type", opts.parentEntityType);
      if (opts?.token) qs.set("token", opts.token);
      // fetchJson/parseEnvelope — те же, что в getAnnotationsFor; data?: Annotation[]
      const { data } = await fetchJson<{ data?: Annotation[] }>(
        `/api/lectures/${lectureId}/annotations?${qs.toString()}`,
      );
      const page = data ?? [];
      all.push(...page);
      if (page.length < limit) break;
    }
    return all;
  },
);
```

(`Annotation` = `components["schemas"]["annotation.Annotation"]`, уже в `types.ts`. `fetchJson` — текущий помощник слайса; имплементатор подставит реальное имя.)

- [ ] **Step 4: Server `comment-node.tsx` — группировка + AnnotationScope**

Каждый `CommentNode` (server) берёт батч лекции, фильтрует по своему id, собирает карточки и оборачивает в `AnnotationScope`. Экспортируй из `@/features/annotations` (Step 5): `AnnotationScope`, `buildAnnotationCards`, `getLectureAnnotations`, `canCreateAnnotation`. Псевдо-вставка (сверься с текущим `comment-node.tsx`):

```tsx
import {
  AnnotationScope,
  buildAnnotationCards,
  canCreateAnnotation,
  getLectureAnnotations,
} from "@/features/annotations";

// внутри компонента (server), для не-удалённого комментария:
let annotationNotes: { id: string; anchor: Anchor | undefined; card: ReactNode }[] = [];
let canAnnotate = false;
if (!comment.is_deleted) {
  canAnnotate = canCreateAnnotation(me);
  // cache() → один HTTP на всю лекцию, даже если CommentNode'ов сотня
  const all = await getLectureAnnotations(comment.lecture_id, { parentEntityType: "comment" });
  const items = all.filter((a) => a.parent_entity_id === comment.id);
  annotationNotes = buildAnnotationCards({ items, me, astSchema: null, hideAnchorOnWide: true });
}

// рендер: CommentNodeView со scopeEnabled + клиентский AnnotationScope (заметки → правая рельса)
return (
  <>
    <CommentNodeView comment={comment} scopeEnabled anchorSlot={...} reactionsSlot={...} actionsSlot={...} {...labels} />
    {(annotationNotes.length > 0 || canAnnotate) && (
      <AnnotationScope
        parentEntityType="comment"
        parentId={comment.id}
        notes={annotationNotes}
        canCreate={canAnnotate}
      />
    )}
  </>
);
```

Замечания:
- `AnnotationScope` ищет корень по `[data-anchor-scope="comment:<id>"]` (обёртка `.content` из Step 2). Таких корней на странице много, но селектор с конкретным `comment:<id>` уникален (id уникален) — корректно.
- `buildAnnotationCards` с `astSchema: null` рендерит read-карточки; если comment-аннотации создаются/редактируются AST-композером — схему грузи ОДИН раз на уровне `CommentSection` и прокидывай `SchemaContextProvider`-контекстом (как `document-annotations.tsx`), а не per-comment.
- Если приватная лекция требует share-token для аннотаций — прокинь `token` в `CommentSection`→`CommentNode` и в `getLectureAnnotations({ token })`. Сейчас `CommentSection` токен не получает (как и `getLectureComments`); добавь, если нужно паритетно.

- [ ] **Step 5: Export `AnnotationScope` + builders + батч-фетч from annotations barrel**

В `src/features/annotations/index.ts` добавь публичные реэкспорты `AnnotationScope`, `buildAnnotationCards`, `getLectureAnnotations`, `canCreateAnnotation` (если ещё не экспортированы). Не нарушай Guardrail: `getLectureAnnotations`/`canCreateAnnotation` — server-only, импортируются только в server-компонент `comment-node.tsx` (cross-feature импорт через barrel `index.ts`, не deep-import).

- [ ] **Step 6: Run gate**

Run: `pnpm vitest run src/features/comments src/features/annotations && pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/comments/ui/comment-node-view.tsx src/features/comments/ui/comment-node-view.test.tsx src/features/comments/ui/comment-node.tsx src/features/annotations/api.ts src/features/annotations/index.ts
git commit -m "$(cat <<'EOF'
feat(comments): тело комментария — annotation-scope; аннотации лекции батчем (cache) в rail

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Маршрутизация create аннотации по `parentEntityType`

Композер/экшен создания аннотации должны слать на `/api/{parentEntityType}/{parentId}/annotations`, а не хардкодить `document`.

**Files:**
- Modify: `src/features/annotations/ui/annotation-composer-dialog.tsx` (проп `parentEntityType`)
- Modify: `src/features/annotations/actions.ts` (или `api.ts`) — функция create принимает `parentEntityType`
- Test: `src/features/annotations/<create>.test.ts` (юнит на построение роута)

**Interfaces:**
- Consumes: `ParentEntityType` (`../types`), `AnnotationCreateBody`.
- Produces: `createAnnotation` принимает `parentEntityType: ParentEntityType` и строит путь `/api/${parentEntityType}/${parentId}/annotations`.

- [ ] **Step 1: Inspect current create route**

Открой `src/features/annotations/actions.ts` и `api.ts`. Найди функцию create (literal switch по роутам — упомянут в `types.ts` комментарии). Установи, как сейчас выбирается путь. Если уже есть `parentEntityType`-параметр (switch по 4 значениям) — задача сводится к прокидыванию его из `AnnotationScope`/композера; тест ниже это закрепляет.

- [ ] **Step 2: Write the failing test (route built from parentEntityType)**

```ts
// src/features/annotations/create-route.test.ts
import { describe, expect, it } from "vitest";

import { annotationCreatePath } from "./api"; // экспортируй чистый билдер пути

describe("annotationCreatePath", () => {
  it("routes by parentEntityType", () => {
    expect(annotationCreatePath("comment", "c1")).toBe("/api/comments/c1/annotations");
    expect(annotationCreatePath("document", "d1")).toBe("/api/documents/d1/annotations");
    expect(annotationCreatePath("glossary", "g1")).toBe("/api/glossary/g1/annotations");
    expect(annotationCreatePath("media", "m1")).toBe("/api/media/m1/annotations");
  });
});
```

Run: `pnpm vitest run src/features/annotations/create-route.test.ts`
Expected: FAIL (если билдера ещё нет — выдели его).

- [ ] **Step 3: Extract/confirm `annotationCreatePath` + thread `parentEntityType`**

Выдели чистый билдер (обрати внимание на нерегулярность: `glossary` без `s`, `media` без `s`, остальные — множественное число; сверься с роутами в `schema.ts`):

```ts
import type { ParentEntityType } from "./types";

const PARENT_SEGMENT: Record<ParentEntityType, string> = {
  document: "documents",
  glossary: "glossary",
  media: "media",
  comment: "comments",
};

export function annotationCreatePath(parentEntityType: ParentEntityType, parentId: string): string {
  return `/api/${PARENT_SEGMENT[parentEntityType]}/${parentId}/annotations`;
}
```

Прокинь `parentEntityType` через `AnnotationComposerDialog` (новый проп) → server action create. В `AnnotationScope` (Task 9) передавай `parentEntityType` в композер (сейчас прокидывается только `parentId`).

- [ ] **Step 4: Run test + gate**

Run: `pnpm vitest run src/features/annotations/create-route.test.ts && pnpm lint && pnpm build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/annotations/api.ts src/features/annotations/create-route.test.ts src/features/annotations/ui/annotation-composer-dialog.tsx src/features/annotations/ui/annotation-scope.tsx src/features/annotations/actions.ts
git commit -m "$(cat <<'EOF'
feat(annotations): create маршрутизируется по parentEntityType (comments segment)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Чистка движка + регресс-канарейка + узкий экран

Удаляем `MarginAnchorLayer` и временный alias; добавляем канарейку «document-аннотации не изменили UX» и проверку схлопывания на узком экране (inline-фолбэк остаётся при `ready=false`).

**Files:**
- Delete: `src/components/anchor-engine/margin-anchor-layer.tsx`, `src/components/anchor-engine/margin-anchor-layer.test.tsx` (если тест дублирует rail) — иначе переписать тест на `MarginRail`
- Modify: `src/components/anchor-engine/index.ts` (убрать `MarginAnchorLayer`, alias `AnchorActionsProvider`)
- Modify: `src/components/anchor-engine/anchor-actions.tsx` (удалить временный `export const AnchorActionsProvider = ...`)
- Test: `src/components/anchor-engine/margin-rail.regression.test.tsx`

- [ ] **Step 1: Write the regression canary (annotation tone accent + data-note-card parity)**

```tsx
// src/components/anchor-engine/margin-rail.regression.test.tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnchorScopeProvider } from "./anchor-actions";
import { MarginRail } from "./margin-rail";
import { useRegisterRailScope, type RailScopeEntry } from "./use-rail-scopes";

function Reg({ entry }: { entry: RailScopeEntry }) {
  useRegisterRailScope(entry);
  return null;
}

describe("MarginRail regression parity", () => {
  it("annotation card carries data-note-card and inline-start accent", () => {
    const el = document.createElement("div");
    el.setAttribute("data-anchor-scope", "document:d1");
    el.innerHTML = '<p data-block-id="b1">alpha beta</p>';
    document.body.appendChild(el);
    const entry: RailScopeEntry = {
      key: "annotation:document:d1",
      rootEl: el,
      tone: "annotation",
      notes: [{ id: "n1", anchor: { startBlockId: "b1", endBlockId: "b1", startChar: 0, endChar: 5, exact: "alpha" } }],
      renderNote: () => <span>card</span>,
    };
    render(
      <AnchorScopeProvider>
        <Reg entry={entry} />
        <MarginRail tone="annotation" highlightName="annotation" />
      </AnchorScopeProvider>,
    );
    const card = document.querySelector<HTMLElement>('[data-note-card="n1"]')!;
    expect(card).not.toBeNull();
    expect(card.style.borderInlineStart).toContain("3px");
  });
});
```

Run: `pnpm vitest run src/components/anchor-engine/margin-rail.regression.test.tsx`
Expected: PASS (rail уже реализован).

- [ ] **Step 2: Delete `MarginAnchorLayer` + alias**

```bash
git rm src/components/anchor-engine/margin-anchor-layer.tsx
```
Если есть `margin-anchor-layer.test.tsx` — удали его тем же `git rm` (поведение покрыто `margin-rail*.test.tsx`).
В `anchor-actions.tsx` удали строку `export const AnchorActionsProvider = AnchorScopeProvider;`.
В `index.ts` убери экспорт `MarginAnchorLayer` и `AnchorActionsProvider`.

- [ ] **Step 3: Grep for dangling references**

Run: `grep -rn "MarginAnchorLayer\|AnchorActionsProvider" src`
Expected: пусто. Любые попадания — поправь импорт на `MarginRail`/`AnchorScopeProvider`.

- [ ] **Step 4: Full gate**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное.

- [ ] **Step 5: Commit**

```bash
git add src/components/anchor-engine/index.ts src/components/anchor-engine/anchor-actions.tsx src/components/anchor-engine/margin-rail.regression.test.tsx
git rm src/components/anchor-engine/margin-anchor-layer.tsx
git commit -m "$(cat <<'EOF'
refactor(anchor-engine): удалить MarginAnchorLayer/alias; регресс-канарейка rail

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Ручной QA-чеклист + follow-up'ы

Геометрия Range, выноски, широкий↔узкий, RTL, touch, перф — jsdom не ловит; фиксируем чеклист и known-follow-ups.

**Files:**
- Create: `docs/superpowers/qa/2026-06-30-universal-annotation-scopes-qa.md`

- [ ] **Step 1: Write the QA checklist doc**

Содержимое (отметь как ручную приёмку):

```markdown
# Ручной QA — универсальные anchor-скоупы

Локально: бэк :8090 (make run-local), фронт :3001 (pnpm dev), dev/admin12345.

## Сценарии (широкий экран ≥80rem)
- [ ] Выделить фрагмент в ТЕЛЕ КОММЕНТАРИЯ → появляется кнопка «аннотировать» (одна).
- [ ] Создать аннотацию к комментарию → карточка встаёт в ПРАВУЮ маргиналию у фрагмента, выноска тянется к нужному комментарию.
- [ ] Аннотации документа и аннотации комментариев живут в ОДНОЙ правой рельсе, не наезжают (стекинг по Y).
- [ ] Аннотации документа выглядят/ведут себя как раньше (тон, тумблер подсветки, кнопка «без якоря»).
- [ ] Заякоренные комментарии (левая рельса) работают как раньше.
- [ ] Выделение ЧЕРЕЗ границу (из комментария в документ) → кнопки НЕТ.
- [ ] Подсветка фрагмента комментария включается/гаснет тумблером.
- [ ] Сирота (отредактировать тело так, чтобы exact не нашёлся) → карточка в orphan-зоне с «Фрагмент не найден».

## Узкий экран (<80rem)
- [ ] Карточки аннотаций комментария текут inline под телом своего комментария (без абсолютного позиционирования и выносок).

## RTL / a11y / touch
- [ ] В RTL акцент-бордюр карточки на логической стартовой стороне; выноски зеркалятся.
- [ ] Touch-выделение в комментарии вызывает аффорданс (pointerup/touchend).
- [ ] Tab-порядок карточек в рельсе соответствует визуальному (WCAG 2.4.3).

## Перф
- [ ] Тред с многими комментариями (≥30): нет заметного лага при resize/scroll (один проход пересчёта в rail).

## Follow-up (вне объёма v1, зафиксировано)
- Текст→карточка (useTextClick) и hover-из-текста (useHoverReveal) в мультикорневом rail (сейчас только карточка→текст).
- Якорь-комментарий-в-комментарий (FE: снять хардкод document в comments/anchor.ts).
- Глоссарий-карточки как annotation-скоуп на странице (тривиально: обернуть в AnchorScope).
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/qa/2026-06-30-universal-annotation-scopes-qa.md
git commit -m "$(cat <<'EOF'
docs(annotations): ручной QA-чеклист универсальных anchor-скоупов + follow-ups

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Замечания по объёму и риску

- **Регресс-риск** сосредоточен в Task 9-10 (миграция существующего UX на новый шов). Канарейка (Task 13) + ручной QA (Task 14) его закрывают. Если Task 9 ломает UX документа — откат только Task 9-10, ядро (Task 1-8) самостоятельно и протестировано.
- **`ConnectorLayer` с мультикорнем** — единственная техническая неизвестность (нужен ли ему непустой `astRootRef`). Решение зафиксировать в Task 8 Step 2 (либо `{current:null}`, либо page-level контейнер-ref).
- **N+1 решён бэком**: `GET /api/lectures/{id}/annotations?parent_entity_type=comment` (schema.ts:10819) + React `cache()` → один HTTP на всю лекцию (Task 11 Step 3-4). Стопгапа и флага к бэку нет.
