# RouterLink — внутренние ссылки с анимацией загрузки — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Единый компонент `RouterLink` поверх `next/link`, рисующий sweep-шиммер на самой ссылке во время in-flight навигации, + миграция всех 43 внутренних использований `next/link`.

**Architecture:** Server-совместимый `RouterLink` оборачивает `NextLink` и последним ребёнком рендерит `'use client'` `RouterLinkBusy`, который через `useLinkStatus()` вешает zero-layout DOM-маркер `[data-link-pending]`. Top-level CSS-правило `.router-link:has([data-link-pending])` в `globals.css` рисует волну на `currentColor` (с задержкой 250ms и `prefers-reduced-motion`). Цвета — на `currentColor`, т.к. токены `--color-*` проекта не резолвятся вне forced-colors.

**Tech Stack:** Next 16.1.4 (App Router, `useLinkStatus`), React 19.2.3, Tailwind v4 (`@theme` в CSS), Vitest + @testing-library/react (`globals: false`, jest-dom импортится per-file).

**Спека:** [docs/superpowers/specs/2026-06-14-router-link-loading-animation-design.md](../specs/2026-06-14-router-link-loading-animation-design.md)

**Правила репозитория (CLAUDE.md):** не делать деструктивных git-операций, не `git add -A`/`.` — добавлять только свои файлы по имени. Каждый субагент обязан передавать это требование своим субагентам. Перед PR зелёные: `pnpm lint && pnpm test && pnpm build` (только `pnpm`, не `npm`).

---

## File Structure

- **Create** `src/components/ui/router-link-busy.tsx` — `'use client'`, эмитит `[data-link-pending]` по `useLinkStatus`.
- **Create** `src/components/ui/router-link-busy.test.tsx` — юнит-тест маркера.
- **Create** `src/components/ui/router-link.tsx` — server-обёртка над `NextLink` + проброс пропов + `cn`-слияние класса.
- **Create** `src/components/ui/router-link.test.tsx` — юнит-тест пропов/класса/rel.
- **Modify** `src/app/globals.css` — `@keyframes router-link-wave` + правило `:has()` + `prefers-reduced-motion` в секции CUSTOM COMPONENTS.
- **Modify** `src/components/ui/index.ts` — реэкспорт `RouterLink` (не `RouterLinkBusy`).
- **Modify** `src/components/ui/pagination.tsx` — миграция через **относительный** импорт `./router-link` (in-barrel, иначе цикл).
- **Modify** `src/components/revision-history/revision-history.test.tsx` — добавить `useLinkStatus` в мок `next/link`.
- **Modify** ещё 42 файла (`<Link>` → `<RouterLink>`, импорт через `@/components/ui`) — батчами.

---

## Task 1: RouterLinkBusy (client-маркер)

**Files:**
- Create: `src/components/ui/router-link-busy.tsx`
- Test: `src/components/ui/router-link-busy.test.tsx`

- [ ] **Step 1: Написать падающий тест**

`src/components/ui/router-link-busy.test.tsx`:

```tsx
// src/components/ui/router-link-busy.test.tsx
import "@testing-library/jest-dom/vitest";
import { render, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

const { mockUseLinkStatus } = vi.hoisted(() => ({ mockUseLinkStatus: vi.fn() }));
vi.mock("next/link", () => ({ useLinkStatus: () => mockUseLinkStatus() }));

import { RouterLinkBusy } from "./router-link-busy";

afterEach(cleanup);

describe("RouterLinkBusy", () => {
  it("pending → рендерит маркер [data-link-pending]", () => {
    mockUseLinkStatus.mockReturnValue({ pending: true });
    const { container } = render(<RouterLinkBusy />);
    expect(container.querySelector("[data-link-pending]")).toBeInTheDocument();
  });

  it("не pending → ничего не рендерит", () => {
    mockUseLinkStatus.mockReturnValue({ pending: false });
    const { container } = render(<RouterLinkBusy />);
    expect(container.querySelector("[data-link-pending]")).toBeNull();
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm test -- src/components/ui/router-link-busy.test.tsx`
Expected: FAIL — `Failed to resolve import "./router-link-busy"` (файла ещё нет).

- [ ] **Step 3: Реализовать компонент**

`src/components/ui/router-link-busy.tsx`:

```tsx
// src/components/ui/router-link-busy.tsx
"use client";
import { useLinkStatus } from "next/link";

// Публикует in-flight состояние навигации как zero-layout DOM-маркер
// [data-link-pending]. Это сигнал, а не художник: предок рисует волну через
// :has([data-link-pending]). Рендерит ТОЛЬКО маркер — контент <a> остаётся
// прямым ребёнком <a> (важно при использовании RouterLink как render-таргета).
// `hidden` держит маркер вне layout и a11y-дерева, но матчится :has().
export function RouterLinkBusy() {
  const { pending } = useLinkStatus();
  return pending ? <span hidden data-link-pending="" /> : null;
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm test -- src/components/ui/router-link-busy.test.tsx`
Expected: PASS (2 теста).

- [ ] **Step 5: Коммит**

```bash
git add src/components/ui/router-link-busy.tsx src/components/ui/router-link-busy.test.tsx
git commit -m "feat(ui): RouterLinkBusy — маркер in-flight навигации через useLinkStatus"
```

---

## Task 2: RouterLink (server-обёртка)

**Files:**
- Create: `src/components/ui/router-link.tsx`
- Test: `src/components/ui/router-link.test.tsx`

- [ ] **Step 1: Написать падающий тест**

`src/components/ui/router-link.test.tsx`:

```tsx
// src/components/ui/router-link.test.tsx
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";

// Изолируем юнит: вне Next-runtime рендерим NextLink как обычный <a>,
// а useLinkStatus возвращает idle (RouterLinkBusy → null).
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
  useLinkStatus: () => ({ pending: false }),
}));

import { RouterLink } from "./router-link";

afterEach(cleanup);

describe("RouterLink", () => {
  it("пробрасывает href и ставит класс router-link по умолчанию", () => {
    render(<RouterLink href="/lectures/1">Лекция</RouterLink>);
    const a = screen.getByRole("link", { name: "Лекция" });
    expect(a).toHaveAttribute("href", "/lectures/1");
    expect(a).toHaveClass("router-link");
  });

  it("сливает пользовательский className через cn", () => {
    render(
      <RouterLink href="/x" className="text-sm font-bold">
        X
      </RouterLink>,
    );
    expect(screen.getByRole("link", { name: "X" })).toHaveClass(
      "router-link",
      "text-sm",
      "font-bold",
    );
  });

  it("selfBusyIndicator={false} → без класса router-link", () => {
    render(
      <RouterLink href="/x" selfBusyIndicator={false}>
        X
      </RouterLink>,
    );
    expect(screen.getByRole("link", { name: "X" })).not.toHaveClass("router-link");
  });

  it("target=_blank → авто rel=noopener noreferrer", () => {
    render(
      <RouterLink href="/x" target="_blank">
        X
      </RouterLink>,
    );
    expect(screen.getByRole("link", { name: "X" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
  });

  it("явный rel не перезаписывается авто-noopener", () => {
    render(
      <RouterLink href="/x" target="_blank" rel="nofollow">
        X
      </RouterLink>,
    );
    expect(screen.getByRole("link", { name: "X" })).toHaveAttribute("rel", "nofollow");
  });
});
```

- [ ] **Step 2: Запустить тест — убедиться, что падает**

Run: `pnpm test -- src/components/ui/router-link.test.tsx`
Expected: FAIL — `Failed to resolve import "./router-link"`.

- [ ] **Step 3: Реализовать компонент**

`src/components/ui/router-link.tsx`:

```tsx
// src/components/ui/router-link.tsx
import type { ComponentProps } from "react";
import NextLink from "next/link";

import { cn } from "./cn";
import { RouterLinkBusy } from "./router-link-busy";

export type RouterLinkProps = Omit<ComponentProps<typeof NextLink>, "href"> & {
  href: string;
  /** false — когда волну рисует предок-контейнер через :has([data-link-pending]). Default true. */
  selfBusyIndicator?: boolean;
};

// Тонкая обёртка над next/link с self-paint шиммером навигации.
// ref — через React 19 bare-prop (течёт в ...rest): осознанное отклонение от
// forwardRef-кита, т.к. next/link принимает ref как обычный проп и компонент
// server-совместим. См. спеку.
export function RouterLink({
  href,
  target,
  rel,
  className,
  selfBusyIndicator = true,
  children,
  ...rest
}: RouterLinkProps) {
  return (
    <NextLink
      href={href}
      target={target}
      rel={rel ?? (target === "_blank" ? "noopener noreferrer" : undefined)}
      className={cn(selfBusyIndicator && "router-link", className)}
      {...rest}
    >
      {children}
      <RouterLinkBusy />
    </NextLink>
  );
}
```

- [ ] **Step 4: Запустить тест — убедиться, что проходит**

Run: `pnpm test -- src/components/ui/router-link.test.tsx`
Expected: PASS (5 тестов).

- [ ] **Step 5: Коммит**

```bash
git add src/components/ui/router-link.tsx src/components/ui/router-link.test.tsx
git commit -m "feat(ui): RouterLink — обёртка next/link с шиммером навигации"
```

---

## Task 3: CSS-волна в globals.css

**Files:**
- Modify: `src/app/globals.css` (секция CUSTOM COMPONENTS, после блока `.fancy-link`, ~строка 73)

- [ ] **Step 1: Добавить keyframes + правило**

Вставить в `src/app/globals.css` сразу после закрывающей `}` блока `.fancy-link` (перед `@media (prefers-color-scheme: dark)`):

```css
@keyframes router-link-wave {
  0% {
    background-position: -50% 0;
  }

  60%,
  100% {
    background-position: 150% 0;
  }
}

/* Self-paint шиммер in-flight навигации. Цвета — на currentColor ссылки, чтобы
   работать в light/dark без зависимости от --color-* токенов проекта (они
   резолвятся только под forced-colors). Меняются только paint-свойства → клик
   без reflow. Задержка 250ms гасит шиммер на мгновенных/кешированных переходах. */
.router-link:has([data-link-pending]) {
  animation: router-link-wave 1250ms linear 250ms infinite;
  background-color: color-mix(in srgb, currentColor 7%, transparent);
  background-image: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, currentColor 14%, transparent),
    transparent
  );
  background-repeat: no-repeat;
  background-size: 40% 100%;
  border-radius: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .router-link:has([data-link-pending]) {
    animation: none;
    background-image: none; /* остаётся статичный currentColor-тинт как feedback */
  }
}
```

- [ ] **Step 2: Проверить, что Tailwind собирает CSS без ошибок**

Run: `pnpm build`
Expected: build проходит (Tailwind компилирует `globals.css`, новых ошибок нет).

- [ ] **Step 3: Коммит**

```bash
git add src/app/globals.css
git commit -m "feat(ui): шиммер навигации .router-link в globals.css"
```

---

## Task 4: Реэкспорт из barrel

**Files:**
- Modify: `src/components/ui/index.ts`

- [ ] **Step 1: Добавить экспорт**

В `src/components/ui/index.ts`, рядом с `export { Skeleton, ... }`, добавить строку (RouterLinkBusy НЕ экспортируем — внутренний):

```ts
export { RouterLink, type RouterLinkProps } from "./router-link";
```

- [ ] **Step 2: Проверить lint**

Run: `pnpm lint`
Expected: чисто (нет ошибок import/order, no-cycle и т.п.).

- [ ] **Step 3: Коммит**

```bash
git add src/components/ui/index.ts
git commit -m "feat(ui): экспорт RouterLink из barrel"
```

---

## Task 5: Миграция in-barrel файла (pagination.tsx)

`src/components/ui/pagination.tsx` лежит ВНУТРИ barrel'а → импортировать `./router-link` напрямую (импорт `@/components/ui` дал бы `import/no-cycle`).

**Files:**
- Modify: `src/components/ui/pagination.tsx`

- [ ] **Step 1: Заменить импорт**

В `src/components/ui/pagination.tsx` строку 2 `import Link from "next/link";` заменить на:

```ts
import { RouterLink } from "./router-link";
```

- [ ] **Step 2: Заменить использования в JSX**

В том же файле заменить все `<Link` → `<RouterLink` и `</Link>` → `</RouterLink>` (сохранить все пропы/className).

- [ ] **Step 3: Нормализовать порядок импортов и проверить lint**

Run: `pnpm exec eslint --fix src/components/ui/pagination.tsx && pnpm lint`
Expected: чисто (нет no-cycle/import-order). Если `--fix` переставил импорты — это ок.

- [ ] **Step 4: Коммит**

```bash
git add src/components/ui/pagination.tsx
git commit -m "refactor(ui): pagination на RouterLink (относительный импорт)"
```

---

## Task 6: revision-history — тест-мок + миграция

`revision-history.tsx` после перехода на `<RouterLink>` дёргает `useLinkStatus`; мок в тесте сейчас отдаёт только `default` → тесты упадут на `undefined()`. Сначала чиним мок, потом мигрируем компонент.

**Files:**
- Modify: `src/components/revision-history/revision-history.test.tsx`
- Modify: `src/components/revision-history/revision-history.tsx`

- [ ] **Step 1: Расширить мок next/link**

В `src/components/revision-history/revision-history.test.tsx` блок `vi.mock("next/link", …)` (строки 13-17) заменить на:

```tsx
vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
  useLinkStatus: () => ({ pending: false }),
}));
```

- [ ] **Step 2: Мигрировать компонент**

В `src/components/revision-history/revision-history.tsx`:
- строку 2 `import Link from "next/link";` заменить на `import { RouterLink } from "@/components/ui";`
- все `<Link` → `<RouterLink`, `</Link>` → `</RouterLink>`.

- [ ] **Step 3: Нормализовать импорты, прогнать тест и lint**

Run: `pnpm exec eslint --fix src/components/revision-history/revision-history.tsx && pnpm test -- src/components/revision-history/revision-history.test.tsx && pnpm lint`
Expected: тесты PASS, lint чисто.

- [ ] **Step 4: Коммит**

```bash
git add src/components/revision-history/revision-history.tsx src/components/revision-history/revision-history.test.tsx
git commit -m "refactor(revision-history): RouterLink + мок useLinkStatus в тесте"
```

---

## Migration recipe (для Tasks 7-9)

Для каждого файла батча:

1. **Импорт:**
   - Если в файле УЖЕ есть `import { … } from "@/components/ui";` — добавить `RouterLink` в этот список (по алфавиту).
   - Иначе заменить `import Link from "next/link";` на `import { RouterLink } from "@/components/ui";`.
   - Удалить осиротевшую строку `import Link from "next/link";`, если она осталась.
2. **JSX:** все `<Link` → `<RouterLink`, `</Link>` → `</RouterLink>`. Все пропы/`className`/`href` сохранить как есть (`href` везде — строки, проверено).
3. После правок всего батча: `pnpm exec eslint --fix <файлы батча>` (нормализует import/order и сольёт дубли `@/components/ui`), затем `pnpm lint`.
4. Один коммит на батч (`git add` только файлы батча по имени).

Опционально (визуальный шум, НЕ обязательно в этом PR): на стрелки пагинации и мелкие inline-ссылки можно позже добавить `prefetch={false}` / `selfBusyIndicator={false}` — не делать в рамках механической миграции.

---

## Task 7: Миграция — app/pages + app/permission (12 файлов)

**Files (Modify):**
- `src/app/admin/admin-sidebar.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/lectures/page.tsx`
- `src/app/canvases/[id]/page.tsx`
- `src/app/canvases/page.tsx`
- `src/app/forms/[id]/page.tsx`
- `src/app/login/page.tsx`
- `src/app/not-found.tsx`
- `src/app/register/page.tsx`
- `src/components/app/app-header/app-header.tsx`
- `src/components/app/app-nav.tsx`
- `src/components/permission/login-cta.tsx`

- [ ] **Step 1: Применить migration recipe ко всем 12 файлам.**
- [ ] **Step 2: Нормализовать и проверить**

Run: `pnpm exec eslint --fix src/app/admin/admin-sidebar.tsx src/app/admin/layout.tsx src/app/admin/lectures/page.tsx "src/app/canvases/[id]/page.tsx" src/app/canvases/page.tsx "src/app/forms/[id]/page.tsx" src/app/login/page.tsx src/app/not-found.tsx src/app/register/page.tsx src/components/app/app-header/app-header.tsx src/components/app/app-nav.tsx src/components/permission/login-cta.tsx && pnpm lint`
Expected: lint чисто.

- [ ] **Step 3: Коммит**

```bash
git add src/app/admin/admin-sidebar.tsx src/app/admin/layout.tsx src/app/admin/lectures/page.tsx "src/app/canvases/[id]/page.tsx" src/app/canvases/page.tsx "src/app/forms/[id]/page.tsx" src/app/login/page.tsx src/app/not-found.tsx src/app/register/page.tsx src/components/app/app-header/app-header.tsx src/components/app/app-nav.tsx src/components/permission/login-cta.tsx
git commit -m "refactor(app): внутренние ссылки на RouterLink (app/pages)"
```

---

## Task 8: Миграция — features часть 1 (15 файлов)

**Files (Modify):**
- `src/features/annotations/ui/annotation-pagination.tsx`
- `src/features/audit/ui/audit-pagination.tsx`
- `src/features/banners/ui/banner-admin-row.tsx`
- `src/features/canvas/ui/canvas-my-list.tsx`
- `src/features/canvas/ui/canvas-pagination.tsx`
- `src/features/documents/ui/document-admin-row.tsx`
- `src/features/documents/ui/document-my-list.tsx`
- `src/features/events/ui/calendar-view.tsx`
- `src/features/events/ui/event-admin-row.tsx`
- `src/features/forms/ui/form-admin-row.tsx`
- `src/features/forms/ui/my-forms-list.tsx`
- `src/features/forms/ui/my-submissions-list.tsx`
- `src/features/forms/ui/submission-list.tsx`
- `src/features/glossary/ui/glossary-admin-row.tsx`
- `src/features/glossary/ui/glossary-list.tsx`

- [ ] **Step 1: Применить migration recipe ко всем 15 файлам.**
- [ ] **Step 2: Нормализовать и проверить**

Run: `pnpm exec eslint --fix src/features/annotations/ui/annotation-pagination.tsx src/features/audit/ui/audit-pagination.tsx src/features/banners/ui/banner-admin-row.tsx src/features/canvas/ui/canvas-my-list.tsx src/features/canvas/ui/canvas-pagination.tsx src/features/documents/ui/document-admin-row.tsx src/features/documents/ui/document-my-list.tsx src/features/events/ui/calendar-view.tsx src/features/events/ui/event-admin-row.tsx src/features/forms/ui/form-admin-row.tsx src/features/forms/ui/my-forms-list.tsx src/features/forms/ui/my-submissions-list.tsx src/features/forms/ui/submission-list.tsx src/features/glossary/ui/glossary-admin-row.tsx src/features/glossary/ui/glossary-list.tsx && pnpm lint`
Expected: lint чисто.

- [ ] **Step 3: Коммит**

```bash
git add src/features/annotations/ui/annotation-pagination.tsx src/features/audit/ui/audit-pagination.tsx src/features/banners/ui/banner-admin-row.tsx src/features/canvas/ui/canvas-my-list.tsx src/features/canvas/ui/canvas-pagination.tsx src/features/documents/ui/document-admin-row.tsx src/features/documents/ui/document-my-list.tsx src/features/events/ui/calendar-view.tsx src/features/events/ui/event-admin-row.tsx src/features/forms/ui/form-admin-row.tsx src/features/forms/ui/my-forms-list.tsx src/features/forms/ui/my-submissions-list.tsx src/features/forms/ui/submission-list.tsx src/features/glossary/ui/glossary-admin-row.tsx src/features/glossary/ui/glossary-list.tsx
git commit -m "refactor(features): внутренние ссылки на RouterLink (часть 1)"
```

---

## Task 9: Миграция — features часть 2 (14 файлов)

**Files (Modify):**
- `src/features/lectures/ui/lecture-admin-row.tsx`
- `src/features/lectures/ui/lecture-card.tsx`
- `src/features/lectures/ui/lecture-detail.tsx`
- `src/features/lectures/ui/lecture-documents-section.tsx`
- `src/features/lectures/ui/lecture-media-section.tsx`
- `src/features/media/ui/media-card.tsx`
- `src/features/media/ui/media-containers.tsx`
- `src/features/media/ui/media-pagination.tsx`
- `src/features/search/ui/search-pagination.tsx`
- `src/features/search/ui/search-results.tsx`
- `src/features/trails/ui/trail-admin-row.tsx`
- `src/features/trails/ui/trail-detail.tsx`
- `src/features/trails/ui/trail-my-list.tsx`
- `src/features/trails/ui/trail-public-list.tsx`

- [ ] **Step 1: Применить migration recipe ко всем 14 файлам.**
- [ ] **Step 2: Нормализовать и проверить**

Run: `pnpm exec eslint --fix src/features/lectures/ui/lecture-admin-row.tsx src/features/lectures/ui/lecture-card.tsx src/features/lectures/ui/lecture-detail.tsx src/features/lectures/ui/lecture-documents-section.tsx src/features/lectures/ui/lecture-media-section.tsx src/features/media/ui/media-card.tsx src/features/media/ui/media-containers.tsx src/features/media/ui/media-pagination.tsx src/features/search/ui/search-pagination.tsx src/features/search/ui/search-results.tsx src/features/trails/ui/trail-admin-row.tsx src/features/trails/ui/trail-detail.tsx src/features/trails/ui/trail-my-list.tsx src/features/trails/ui/trail-public-list.tsx && pnpm lint`
Expected: lint чисто.

- [ ] **Step 3: Коммит**

```bash
git add src/features/lectures/ui/lecture-admin-row.tsx src/features/lectures/ui/lecture-card.tsx src/features/lectures/ui/lecture-detail.tsx src/features/lectures/ui/lecture-documents-section.tsx src/features/lectures/ui/lecture-media-section.tsx src/features/media/ui/media-card.tsx src/features/media/ui/media-containers.tsx src/features/media/ui/media-pagination.tsx src/features/search/ui/search-pagination.tsx src/features/search/ui/search-results.tsx src/features/trails/ui/trail-admin-row.tsx src/features/trails/ui/trail-detail.tsx src/features/trails/ui/trail-my-list.tsx src/features/trails/ui/trail-public-list.tsx
git commit -m "refactor(features): внутренние ссылки на RouterLink (часть 2)"
```

---

## Task 10: Финальная проверка

- [ ] **Step 1: Не осталось прямых импортов next/link в исходниках (кроме мока в тесте)**

Run: `grep -rn 'from "next/link"' src`
Expected: пусто. (Допустимо только `vi.mock("next/link"` в `revision-history.test.tsx` — он матчится паттерном `next/link`, но не `from "next/link"`, так что вывод пуст.)

- [ ] **Step 2: Полный прогон**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: всё зелёное.

- [ ] **Step 3 (визуальная проверка, опционально):** запустить `pnpm dev`, кликнуть по ссылке на медленный route ([id]-страница), убедиться, что шиммер появляется при переходе дольше ~250ms и не появляется на мгновенных. Проверить в `prefers-reduced-motion` — анимации нет, остаётся статичный тинт.

---

## Self-Review (выполнено при написании плана)

- **Покрытие спеки:** компоненты (Task 1-2), CSS-волна + reduced-motion + currentColor (Task 3), barrel без RouterLinkBusy (Task 4), in-barrel исключение pagination (Task 5), 45-й файл — мок useLinkStatus (Task 6), import-order через eslint --fix (Tasks 5-9), bare-ref/cn/rel зафиксированы в коде Task 2, колокальные тесты + per-file jest-dom (Tasks 1-2), миграция всех 43 источников (Tasks 5-9), финальный grep+прогон (Task 10). Пробелов нет.
- **Плейсхолдеры:** нет — весь код и команды приведены.
- **Согласованность типов:** `RouterLinkProps`/`RouterLink`/`RouterLinkBusy`/класс `router-link`/маркер `data-link-pending` едины во всех тасках и совпадают со спекой.
- **Счёт файлов:** 43 источника (`from "next/link"`) + 1 тест-мок = 44 ссылки на `next/link`. Tasks 5+6 покрывают 2 источника + тест; Tasks 7-9 — 12+15+14 = 41 источник. 2+41 = 43. ✓
