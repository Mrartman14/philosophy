# Сворачивание крупных карточек маргиналий — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ограничить высоту карточек-заметок на полях (аннотации/комментарии): крупный контент клампится до превью с фейдом и доступным тогглом «показать полностью», разворот на месте переукладывает колонку.

**Architecture:** Новый доменно-чистый kit-примитив `ClampableContent` меряет естественную высоту детей (`scrollHeight`) и при превышении порога клампит область (`max-block-size` + masked-фейд) + рендерит тоггл `button[aria-expanded/aria-controls]`. Движок маргиналий (`MarginNotesColumn`) получает `ResizeObserver` на обёртки карточек: любое изменение высоты карточки (разворот клампа, догрузка картинки, шрифт) пере-запускает `resolveStack` через локальный ключ. Контент рендерится на сервере целиком (no-JS/SEO/a11y); кламп — клиентское улучшение.

**Tech Stack:** Next.js (RSC: server-карточки рендерят client-примитив с `children`), React 19, TypeScript, Tailwind v4 (логические свойства), Vitest + @testing-library/react (jsdom), next-intl (i18n за фасадом `@/i18n`).

## Global Constraints

- Пакетный менеджер — **pnpm** (НЕ npm; npm ломает тулчейн). Тесты одного файла: `pnpm vitest run <path>`.
- Параллельные агенты: **НЕ** делать `git add -A`/`.`, `git stash/reset/checkout .`/`clean`. Коммитить только свои файлы по имени: `git add <files> && git commit --only <files>`.
- Гейт перед завершением: зелёные `pnpm lint && pnpm test && pnpm build`.
- Kit-конвенции (`src/components/ui/*`): `className` закрыт на leaf-контролах; нативные интерактивные теги (`<button>` и т.п.) — только внутри `src/components/ui/` (Guardrail 7); используем kit `Button` (`tone`/`compact`, без `variant`/`size` — Guardrail 8). Логические свойства, без физических `left/right/ml/mr` (Guardrail 10).
- i18n: ключи добавляются во ВСЕ 4 локали (`en/ru/ar/zh`) в одноимённые namespace-файлы; паритет ключей форсит `satisfies Messages`. ICU-подмножество: только `{var}` и `{count, plural, …}`.
- Карточки рендерятся на сервере целиком (SSR-инвариант): контент есть в HTML до и без JS.
- Субагенты-исполнители — модель **opus**.
- Сообщения коммитов — на русском, conventional style; завершать строкой `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

- **Create** `src/components/ui/clampable-content.tsx` — kit-примитив клампа (client). Доменно-чистый.
- **Create** `src/components/ui/clampable-content.test.tsx` — юнит-тесты примитива.
- **Modify** `src/components/ui/index.ts` — экспорт `ClampableContent`.
- **Modify** `src/components/anchor-engine/margin-notes-column.tsx` — `ResizeObserver` на карточки → restack через локальный `sizeKey`.
- **Modify** `src/components/anchor-engine/margin-notes-column.test.tsx` — тест restack по RO.
- **Modify** `src/features/annotations/ui/annotation-card.tsx` — обернуть тело и цитату в `ClampableContent`.
- **Modify** `src/i18n/messages/{en,ru,ar,zh}/annotations.ts` — ключи `marginExpand`/`marginCollapse`.
- **Modify** `src/features/comments/ui/comment-preview-card.tsx` — обернуть тело в `ClampableContent`.
- **Modify** `src/i18n/messages/{en,ru,ar,zh}/comments.ts` — ключи `marginExpand`/`marginCollapse`.

---

## Task 1: `ClampableContent` kit-примитив

**Files:**
- Create: `src/components/ui/clampable-content.tsx`
- Test: `src/components/ui/clampable-content.test.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces:
  ```ts
  interface ClampableContentProps {
    maxHeight: number;      // порог в rem; контент выше — клампится
    expandLabel: string;    // лейбл тоггла в свёрнутом состоянии
    collapseLabel: string;  // лейбл тоггла в развёрнутом состоянии
    children: React.ReactNode;
  }
  function ClampableContent(props: ClampableContentProps): JSX.Element
  ```
- Consumes: kit `Button` из `./button` (tone="quiet", compact).

- [ ] **Step 1: Написать падающий тест**

Create `src/components/ui/clampable-content.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import { ClampableContent } from "./clampable-content";

// jsdom: scrollHeight=0 и нет ResizeObserver. Мокаем оба: scrollHeight через
// геттер на прототипе (значение варьируем переменной), RO — no-op класс
// (измерение делает прямой вызов в useLayoutEffect, RO нужен лишь для подписки).
let scrollH = 0;

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      return scrollH;
    },
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // @ts-expect-error снять override прототипа (вернётся реализация jsdom)
  delete HTMLElement.prototype.scrollHeight;
});

describe("ClampableContent", () => {
  it("контент в пределах порога → без тоггла", () => {
    scrollH = 100; // < 16rem*16px = 256px
    render(
      <ClampableContent maxHeight={16} expandLabel="ещё" collapseLabel="свернуть">
        <p>short</p>
      </ClampableContent>,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("контент сверх порога → тоггл, по умолчанию свёрнут (aria-expanded=false)", () => {
    scrollH = 400; // > 256px
    render(
      <ClampableContent maxHeight={16} expandLabel="ещё" collapseLabel="свернуть">
        <p>long</p>
      </ClampableContent>,
    );
    const btn = screen.getByRole("button", { name: "ещё" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("клик по тогглу разворачивает (aria-expanded=true, лейбл collapse)", () => {
    scrollH = 400;
    render(
      <ClampableContent maxHeight={16} expandLabel="ещё" collapseLabel="свернуть">
        <p>long</p>
      </ClampableContent>,
    );
    fireEvent.click(screen.getByRole("button", { name: "ещё" }));
    const btn = screen.getByRole("button", { name: "свернуть" });
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm vitest run src/components/ui/clampable-content.test.tsx`
Expected: FAIL — `Failed to resolve import "./clampable-content"` (файла ещё нет).

- [ ] **Step 3: Реализовать примитив**

Create `src/components/ui/clampable-content.tsx`:

```tsx
"use client";
// src/components/ui/clampable-content.tsx
// Клампит крупный контент до превью (max-block-size + нижний masked-фейд) и
// рендерит доступный тоггл «показать полностью / свернуть». Доменно-чистый: не
// знает про маргиналию/аннотации/комменты — лейблы и порог приходят пропами.
// Контент рендерится целиком (есть в DOM до измерения / на no-JS); кламп —
// клиентское улучшение по измеренной естественной высоте детей.
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "./button";

interface Props {
  /** Порог высоты в rem; естественный контент выше — клампится с тогглом. */
  maxHeight: number;
  expandLabel: string;
  collapseLabel: string;
  children: ReactNode;
}

export function ClampableContent({ maxHeight, expandLabel, collapseLabel, children }: Props) {
  // Внутренний враппер НЕ клампится — его scrollHeight = естественная высота,
  // независимо от max-block-size на region (overflow:hidden родителя не меняет
  // layout-высоту ребёнка) → нет петли «кламп уменьшил высоту → пере-замер».
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const regionId = useId();

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => {
      // rem→px через корневой font-size (учитывает ось шрифта appearance);
      // фолбэк 16 для jsdom/пустого computed.
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setOverflowing(el.scrollHeight > maxHeight * rootPx + 1);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [maxHeight]);

  const clamp = overflowing && !expanded;
  return (
    <div className="flex flex-col gap-1">
      <div
        id={regionId}
        style={
          clamp
            ? {
                maxBlockSize: `${maxHeight}rem`,
                overflow: "hidden",
                maskImage: "linear-gradient(to bottom, black calc(100% - 1.5rem), transparent)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, black calc(100% - 1.5rem), transparent)",
              }
            : undefined
        }
      >
        <div ref={contentRef}>{children}</div>
      </div>
      {overflowing && (
        <Button
          compact
          tone="quiet"
          aria-expanded={expanded}
          aria-controls={regionId}
          onClick={() => {
            setExpanded((v) => !v);
          }}
        >
          {expanded ? collapseLabel : expandLabel}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm vitest run src/components/ui/clampable-content.test.tsx`
Expected: PASS (3 теста). Вывод чистый, без warnings.

- [ ] **Step 5: Экспортировать из kit-барреля**

Modify `src/components/ui/index.ts` — добавить строку рядом с прочими экспортами (алфавитный/смысловой порядок не критичен, поставь после строки экспорта `checkbox`/`color-input` или в любом подходящем месте):

```ts
export { ClampableContent } from "./clampable-content";
```

- [ ] **Step 6: Проверить lint и тест файла**

Run: `pnpm vitest run src/components/ui/clampable-content.test.tsx && pnpm lint`
Expected: тесты PASS; lint без ошибок (особенно Guardrail 7/8 — `<button>` внутри `ui/` разрешён; `className` на нашем Button не задаётся).

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/clampable-content.tsx src/components/ui/clampable-content.test.tsx src/components/ui/index.ts
git commit --only src/components/ui/clampable-content.tsx src/components/ui/clampable-content.test.tsx src/components/ui/index.ts -m "feat(ui): ClampableContent — кламп крупного контента + тоггл (a11y disclosure)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Движок — restack при изменении высоты карточки

**Files:**
- Modify: `src/components/anchor-engine/margin-notes-column.tsx`
- Test: `src/components/anchor-engine/margin-notes-column.test.tsx`

**Interfaces:**
- Consumes: существующий `getAnchorRect: (id) => DOMRect | null` проп, `resolveStack`/`applyOrder` из `./stacking`.
- Produces: внутреннее поведение (нет нового экспорта) — колонка пере-укладывается, когда `ResizeObserver` фиксирует изменение высоты любой карточки.

- [ ] **Step 1: Написать падающий тест**

Add this test inside the existing `describe("MarginNotesColumn (smoke)", …)` block in `src/components/anchor-engine/margin-notes-column.test.tsx` (рядом с тестом про wide-порядок). Если в файле ещё нет импорта `act`, добавь его в существующую строку импорта из `@testing-library/react`:

```tsx
// импорт (дополнить существующую строку):
// import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

  it("ResizeObserver карточки → пересчёт раскладки (restack при смене высоты)", () => {
    let roCb: () => void = () => undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          roCb = cb;
        }
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
    const mql = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(mql));
    const tops: Record<string, number> = { a: 0, b: 100 };
    const getRect = vi.fn((id: string) => ({ top: tops[id] }) as DOMRect);
    const notes: ColumnNote[] = [
      { id: "a", node: <span>note-a</span>, orphan: false },
      { id: "b", node: <span>note-b</span>, orphan: false },
    ];
    render(
      <MarginNotesColumn
        notes={notes}
        getAnchorRect={getRect}
        onActivate={() => undefined}
        recomputeKey={0}
      />,
    );
    getRect.mockClear();
    // Имитируем изменение высоты карточки (разворот клампа) — RO дёргает колбэк.
    act(() => {
      roCb();
    });
    expect(getRect).toHaveBeenCalled(); // раскладка пере-измерилась
    vi.unstubAllGlobals();
  });
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm vitest run src/components/anchor-engine/margin-notes-column.test.tsx -t "ResizeObserver карточки"`
Expected: FAIL — `expected "spy" to be called at least once`. Колонка ещё не создаёт `ResizeObserver`, поэтому `roCb` остаётся no-op, `getRect` после `mockClear` не вызывается повторно.

- [ ] **Step 3: Реализовать наблюдение за высотой карточек**

In `src/components/anchor-engine/margin-notes-column.tsx`:

(a) Добавить локальный ключ рядом с прочими `useState` (после `const [order, setOrder] = useState<string[]>([]);`):

```tsx
  // Бампится при изменении высоты любой карточки (разворот ClampableContent,
  // догрузка картинки, шрифт) — форсит restack ниже. Чинит латентный баг: ранее
  // изменение высоты карточки не пересчитывало стек и карточки наезжали.
  const [sizeKey, setSizeKey] = useState(0);
```

(b) Добавить `sizeKey` в зависимости layout-эффекта расчёта стопки. Найди строку:

```tsx
  }, [notes, getAnchorRect, wide, recomputeKey]);
```

и замени на:

```tsx
  }, [notes, getAnchorRect, wide, recomputeKey, sizeKey]);
```

(c) Добавить эффект подписки `ResizeObserver` на карточки. Вставь его сразу ПОСЛЕ этого layout-эффекта (перед строкой `const orphans = notes.filter(...)`):

```tsx
  // Наблюдаем высоту карточек: при её изменении (разворот клампа/картинка/шрифт)
  // бампим sizeKey → restack. Только на wide (там абсолют, поток сам не реагирует)
  // и при наличии ResizeObserver (SSR/jsdom — no-op). Петли нет: restack меняет
  // только top соседей, не их высоту, поэтому RO повторно не стреляет.
  useEffect(() => {
    if (!wide || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setSizeKey((k) => k + 1);
    });
    for (const el of cardRefs.current.values()) ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [notes, wide]);
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm vitest run src/components/anchor-engine/margin-notes-column.test.tsx`
Expected: PASS (все тесты файла, включая новый и прежний wide-порядок).

- [ ] **Step 5: Прогнать весь движок**

Run: `pnpm vitest run src/components/anchor-engine`
Expected: PASS — ни один существующий тест не сломан.

- [ ] **Step 6: Commit**

```bash
git add src/components/anchor-engine/margin-notes-column.tsx src/components/anchor-engine/margin-notes-column.test.tsx
git commit --only src/components/anchor-engine/margin-notes-column.tsx src/components/anchor-engine/margin-notes-column.test.tsx -m "feat(anchor-engine): restack колонки при изменении высоты карточки (ResizeObserver)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Интеграция в аннотации (тело + цитата) + i18n

**Files:**
- Modify: `src/features/annotations/ui/annotation-card.tsx`
- Modify: `src/i18n/messages/en/annotations.ts`
- Modify: `src/i18n/messages/ru/annotations.ts`
- Modify: `src/i18n/messages/ar/annotations.ts`
- Modify: `src/i18n/messages/zh/annotations.ts`

**Interfaces:**
- Consumes: `ClampableContent` из `@/components/ui` (Task 1); ключи `marginExpand`/`marginCollapse` namespace `annotations`.

Эта задача — проводка уже протестированного примитива в server-компонент. Поведение клампа покрыто тестами Task 1; здесь верификация — типчек + lint + сборка + зелёный существующий suite (юнит-тест на async server-компонент в этом стеке не добавляем).

- [ ] **Step 1: Добавить i18n-ключи во все 4 локали**

В каждом файле найди блок `// --- marginalia engine …` (после `marginColumnLabel`) и добавь две строки:

`src/i18n/messages/en/annotations.ts`:
```ts
  marginExpand: "Show full text",
  marginCollapse: "Show less",
```

`src/i18n/messages/ru/annotations.ts`:
```ts
  marginExpand: "Показать полностью",
  marginCollapse: "Свернуть",
```

`src/i18n/messages/ar/annotations.ts` (RTL; вычитка носителем — отдельно, как прочие ar-строки):
```ts
  marginExpand: "إظهار النص كاملاً",
  marginCollapse: "عرض أقل",
```

`src/i18n/messages/zh/annotations.ts`:
```ts
  marginExpand: "显示全文",
  marginCollapse: "收起",
```

- [ ] **Step 2: Проверить паритет ключей (типчек)**

Run: `pnpm exec tsc --noEmit`
Expected: PASS — `satisfies Messages` доволен (ключи есть во всех локалях, EN-namespace задаёт форму). Если падает «missing key» — добавлен не во все 4 файла.

- [ ] **Step 3: Обернуть тело и цитату в `ClampableContent`**

In `src/features/annotations/ui/annotation-card.tsx`:

(a) Добавить импорт примитива (рядом с прочими импортами сверху):

```tsx
import { ClampableContent } from "@/components/ui";
```

(b) Заменить рендер цитаты и тела. Найди:

```tsx
      {hideAnchorOnWide ? <div className="xl:hidden">{anchorContext}</div> : anchorContext}
      <div className="content" data-size="sm">
        <AstRender blocks={annotation.blocks ?? []} />
      </div>
```

на:

```tsx
      {(() => {
        // Цитата может быть большой — клампим её отдельным меньшим порогом
        // (≈3 строки). На wide цитата и так скрыта (hideAnchorOnWide).
        const quote = anchorContext ? (
          <ClampableContent maxHeight={6} expandLabel={t("marginExpand")} collapseLabel={t("marginCollapse")}>
            {anchorContext}
          </ClampableContent>
        ) : null;
        return hideAnchorOnWide ? <div className="xl:hidden">{quote}</div> : quote;
      })()}
      <ClampableContent maxHeight={16} expandLabel={t("marginExpand")} collapseLabel={t("marginCollapse")}>
        <div className="content" data-size="sm">
          <AstRender blocks={annotation.blocks ?? []} />
        </div>
      </ClampableContent>
```

- [ ] **Step 4: Lint + сборка + suite**

Run: `pnpm lint && pnpm vitest run src/features/annotations && pnpm exec tsc --noEmit`
Expected: PASS. Lint — без нарушений (Guardrail 8: `className` на `ClampableContent` НЕ задаём; это не leaf-контрол, но мы и так не передаём className). Существующие тесты аннотаций зелёные.

- [ ] **Step 5: Commit**

```bash
git add src/features/annotations/ui/annotation-card.tsx src/i18n/messages/en/annotations.ts src/i18n/messages/ru/annotations.ts src/i18n/messages/ar/annotations.ts src/i18n/messages/zh/annotations.ts
git commit --only src/features/annotations/ui/annotation-card.tsx src/i18n/messages/en/annotations.ts src/i18n/messages/ru/annotations.ts src/i18n/messages/ar/annotations.ts src/i18n/messages/zh/annotations.ts -m "feat(annotations): кламп крупного тела/цитаты карточки (ClampableContent)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Интеграция в комментарии (тело превью) + i18n

**Files:**
- Modify: `src/features/comments/ui/comment-preview-card.tsx`
- Modify: `src/i18n/messages/en/comments.ts`
- Modify: `src/i18n/messages/ru/comments.ts`
- Modify: `src/i18n/messages/ar/comments.ts`
- Modify: `src/i18n/messages/zh/comments.ts`

**Interfaces:**
- Consumes: `ClampableContent` из `@/components/ui`; ключи `marginExpand`/`marginCollapse` namespace `comments`.

- [ ] **Step 1: Добавить i18n-ключи во все 4 локали**

В каждом файле найди блок `// --- margin comments …` (после `marginColumnLabel`/`marginOrphanLabel`) и добавь:

`src/i18n/messages/en/comments.ts`:
```ts
  marginExpand: "Show full text",
  marginCollapse: "Show less",
```

`src/i18n/messages/ru/comments.ts`:
```ts
  marginExpand: "Показать полностью",
  marginCollapse: "Свернуть",
```

`src/i18n/messages/ar/comments.ts`:
```ts
  marginExpand: "إظهار النص كاملاً",
  marginCollapse: "عرض أقل",
```

`src/i18n/messages/zh/comments.ts`:
```ts
  marginExpand: "显示全文",
  marginCollapse: "收起",
```

- [ ] **Step 2: Проверить паритет ключей (типчек)**

Run: `pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Обернуть тело превью в `ClampableContent`**

In `src/features/comments/ui/comment-preview-card.tsx`:

(a) Добавить импорт:

```tsx
import { ClampableContent } from "@/components/ui";
```

(b) Заменить:

```tsx
      <div className="content" data-size="sm">
        <AstRender blocks={comment.blocks ?? []} />
      </div>
```

на:

```tsx
      <ClampableContent maxHeight={16} expandLabel={t("marginExpand")} collapseLabel={t("marginCollapse")}>
        <div className="content" data-size="sm">
          <AstRender blocks={comment.blocks ?? []} />
        </div>
      </ClampableContent>
```

- [ ] **Step 4: Lint + сборка + suite**

Run: `pnpm lint && pnpm vitest run src/features/comments && pnpm exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/comments/ui/comment-preview-card.tsx src/i18n/messages/en/comments.ts src/i18n/messages/ru/comments.ts src/i18n/messages/ar/comments.ts src/i18n/messages/zh/comments.ts
git commit --only src/features/comments/ui/comment-preview-card.tsx src/i18n/messages/en/comments.ts src/i18n/messages/ru/comments.ts src/i18n/messages/ar/comments.ts src/i18n/messages/zh/comments.ts -m "feat(comments): кламп крупного тела превью-карточки (ClampableContent)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Полный гейт + ручной QA

**Files:** нет правок (верификационная задача).

- [ ] **Step 1: Полный гейт**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное. Если `pnpm build` падает на типах i18n — проверь, что ключи добавлены во все 8 файлов (4 локали × 2 namespace).

- [ ] **Step 2: Ручной браузер-QA (чек-лист, задокументировать результат)**

Запусти стек (бэк `:8090`, фронт `pnpm dev` `:3001`, dev-админ `dev/admin12345`) и проверь на странице лекции с документом:

- Короткая аннотация/коммент — БЕЗ тоггла, рендерится целиком.
- Длинная аннотация/коммент — клампится с фейдом, есть тоггл «Показать полностью».
- Клик «Показать полностью» на wide (≥80rem) — карточка растёт НА МЕСТЕ, карточки ниже разъезжаются (restack), наезда нет; «Свернуть» возвращает.
- Длинная цитата аннотации на narrow — клампится; на wide цитата скрыта (выноска).
- Клавиатура: Tab доходит до тоггла, Enter/Space разворачивает; `aria-expanded` меняется (проверь в DevTools/скринридере).
- no-JS (DevTools → Disable JavaScript, перезагрузка): контент карточек виден ПОЛНОСТЬЮ, без обрезки и без тоггла.
- RTL (locale `ar`): фейд снизу, тоггл-лейбл на арабском, раскладка не ломается.

- [ ] **Step 3: Финальный коммит документации QA (если есть заметки)**

Если по QA нужны правки порогов (`maxHeight`) — внеси и закоммить отдельно: `git add <files> && git commit --only <files> -m "fix(...): подстройка порога клампа по QA"`.

---

## Self-Review

**Spec coverage:**
- «Контент на сервере целиком» → Task 1 (children рендерятся, измерение/кламп — клиентские; SSR-инвариант проверяется в Task 5 no-JS чек).
- «Кламп только сверх порога, без обвязки на коротких» → Task 1 (`overflowing` гейтит и кламп, и тоггл).
- «Разворот на месте + ResizeObserver→пересчёт» → Task 2.
- «Почему не голый `<details>` / доступный тоггл» → Task 1 (`button[aria-expanded/aria-controls]`).
- «Интеграция в аннотации (тело+цитата) и комментарии (тело)» → Task 3, Task 4.
- «Пороги тело ~16rem, цитата ~3 строки» → Task 3/4 (`maxHeight={16}` тело, `maxHeight={6}` цитата) + подстройка в Task 5.
- «Тесты: ≤порога→без тоггла; >порога→тоггл+кламп; клик→aria-expanded; RO→recompute; SSR-контент в DOM» → Task 1 (первые три), Task 2 (RO), Task 5 (no-JS).
- «Зоны: shared/foundation, RO с guard, rAF» → `ClampableContent` в `ui/`; RO с `typeof … === "undefined"` guard. Примечание: rAF-троттл из спеки сознательно опущен — RO на карточках стреляет редко (явный разворот/догрузка), пачки нет; добавление троттла — преждевременная оптимизация (YAGNI). Если QA покажет дёрганье — добавить точечно.

**Placeholder scan:** плейсхолдеров нет; каждый шаг с кодом несёт полный код и команду с ожидаемым выводом.

**Type consistency:** `ClampableContent({ maxHeight: number, expandLabel: string, collapseLabel: string, children })` — единые имена во всех консьюмерах (Task 3/4). `sizeKey`/`setSizeKey` согласованы в Task 2. RO-стаб с конструктором, принимающим колбэк, согласован между Task 1 (без захвата) и Task 2 (с захватом `roCb`).
