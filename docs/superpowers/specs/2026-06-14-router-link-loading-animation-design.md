# RouterLink — внутренние ссылки с анимацией загрузки

**Дата:** 2026-06-14
**Статус:** дизайн утверждён + прошёл ревью субагентами, готов к плану реализации
**Тип:** foundation-PR (трогает frozen-зоны `src/components/ui/*` и `src/app/globals.css`) + широкая миграция

## Контекст и цель

В проекте много внутренних ссылок (44 файла импортируют `next/link`, 65 использований `<Link>` — подтверждено grep'ом).
Цель — единый компонент `RouterLink`, который:

1. Использует `next/link` для клиентской навигации (как и сейчас).
2. Показывает **анимацию загрузки на самой ссылке** во время in-flight перехода —
   чтобы пользователь видел отклик на клик до отрисовки новой страницы.

Референс паттерна — компонент `RouterLink` в соседнем проекте `portal-web`
(`src/components/shared/navigation/router-link/`).

## Паттерн-референс (portal-web)

- `RouterLink` — обёртка над `next/link`, последним ребёнком рендерит `<RouterLinkBusy />`.
- `RouterLinkBusy` — `'use client'`, вызывает `useLinkStatus()` из `next/link`; при
  `pending` рендерит zero-layout маркер `<span hidden data-link-pending="" />`.
  Это **сигнал, а не художник**: маркер — обычный DOM-атрибут, любой предок может
  подписаться через `:has([data-link-pending])`.
- Шиммер рисуется CSS-правилом `:has([data-link-pending])` (sweep-волна через
  `background-position`, только paint-свойства → нет reflow). Задержка анимации 250ms
  гасит шиммер на мгновенных/кешированных переходах.

Совместимость подтверждена против установленного кода: Next **16.1.4**, React **19.2.3**.
`useLinkStatus` реально экспортируется из `next/link`; в App-Router-сборке провайдер
оборачивает детей `<a>`, поэтому маркер-последний-ребёнок читает live-значение `pending`.
typedRoutes **выключен** (нет в `next.config.ts`), поэтому `href: string` корректен и
строго точнее, чем `string | UrlObject`; cast `as Route` из portal-web не нужен.

## Ключевая адаптация под этот проект

| portal-web | philosophy |
|---|---|
| SCSS-модули | **Tailwind v4** (`@theme` в `globals.css`) |
| Своя типографика `@platform-fe/ui` (пропы `palette/decoration/font/size`) | Типографики нет — стилизация Tailwind-классами через `className`. **Все typography-пропы выкидываем.** |
| `@keyframes` в `global.scss` | `@keyframes` + правило в секции `/* CUSTOM COMPONENTS */` `globals.css` (там уже живёт hand-written `.fancy-link` — приём идиоматичен) |
| Цвета волны из своих токенов (`--link-pending-bg-color` и т.п.) | Токены проекта `--color-*` **не годятся** (см. ниже) → волна на `currentColor` |

## Архитектура: компоненты

### 1. `src/components/ui/router-link.tsx` (server-совместимый)

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

Заметки по конвенциям (из ревью):

- **`ref` — через React 19 bare-prop** (`ref` течёт в `...rest`, `ComponentProps<typeof NextLink>`
  его включает). Это **сознательное отклонение** от kit'а, где примитивы (`button.tsx`,
  `icon-button.tsx`, …) используют `forwardRef`. Обоснование: `next/link` в Next 16 принимает
  `ref` как обычный проп, компонент server-совместим (нельзя чисто звать `forwardRef`), и так
  делает референс portal-web. Отклонение зафиксировано здесь намеренно.
- **Слияние класса — через `cn` из `./cn`** (`cn(selfBusyIndicator && "router-link", className)`),
  как во всём UI-ките (`skeleton.tsx:15` и др.). Не конкатенировать строки вручную.
- Точное выражение `rel` (`rel ?? (target === "_blank" ? "noopener noreferrer" : undefined)`)
  зафиксировано в коде выше, чтобы реализатор не перезаписал переданный вызывающим `rel`.
- **Импорт `./router-link-busy` — прямой**, не через barrel (иначе `import/no-cycle`).

### 2. `src/components/ui/router-link-busy.tsx` (`'use client'`)

```tsx
// src/components/ui/router-link-busy.tsx
"use client";
import { useLinkStatus } from "next/link";

export function RouterLinkBusy() {
  const { pending } = useLinkStatus();
  return pending ? <span hidden data-link-pending="" /> : null;
}
```

Рендерит **только** маркер — контент `<a>` остаётся прямым ребёнком `<a>` (важно, если
`RouterLink` используется как `render`-таргет другого компонента: оборачивание детей в
client-компонент пере-родительствовало бы их через RSC-границу и потеряло). Маркер —
ребёнок `<a>`, **не** sibling, поэтому не влияет на `flex gap`/`divide-y`/`:nth-child`
родителя.

### 3. `src/components/ui/index.ts`

Добавить: `export { RouterLink, type RouterLinkProps } from "./router-link";`

**`RouterLinkBusy` остаётся внутренним** — НЕ реэкспортируется из barrel (как `toaster`/`toast`
не светят внутренности).

## Архитектура: CSS (globals.css, секция CUSTOM COMPONENTS)

```css
@keyframes router-link-wave {
  0%   { background-position: -50% 0; }
  60%, 100% { background-position: 150% 0; }
}

/* Self-paint шиммер. Цвета — на currentColor ссылки, чтобы работать в light/dark
   без зависимости от --color-* токенов проекта (они резолвятся только под
   forced-colors, см. примечание). Меняются только paint-свойства → клик без reflow. */
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

**Почему `currentColor`, а не токены проекта (BLOCKER из ревью, подтверждён на файле):**
в `globals.css` `@theme` задаёт `--color-text-pane: var(--color-text-pane)` (самоссылка),
а конкретные значения есть только внутри `@media (forced-colors: active)` — причём
`--color-text-pane` не определён даже там. В обычном light/dark режиме `var(--color-text-pane)`
и `var(--color-foreground)` не резолвятся → шиммер был бы невидим. Это пред-существующий
дефект токен-системы (тинт `Skeleton` на `--color-text-pane` тоже фактически no-op); его
починка — **вне рамок этого PR**. Поэтому волна строится на `currentColor` (адаптируется к
цвету самой ссылки в любом режиме).

Замечания по CSS (из ревью):
- Keyframe (0% `-50%`, 60%/100% `150%`) + `background-size: 40% 100%` + `1250ms linear 250ms`
  точно воспроизводят sweep-then-hold portal-web. ✓
- `color-mix(in srgb, …)` — Baseline-поддержка, валидно. ✓
- `:has()` уже используется в `globals.css` (`body:has(dialog[open])`); правило top-level
  (unlayered) перебивает Tailwind-утилиты `@layer` — как и `.fancy-link`. Это ожидаемо: на
  время pending шиммер доминирует над `hover:bg-*` и т.п. ✓
- Многострочная **inline**-ссылка шиммерит **по-фрагментно** (каждый line-box красится
  отдельно), а не одной волной. Для block/card-ссылок (там `<a>` уже `block`/`flex` через
  Tailwind) проблемы нет. Принять как допустимое; занести в чеклист миграции.

## Решения по API

- **`prefetch` НЕ форсим в `false`** (в отличие от portal-web). Оставляем дефолт Next
  (App Router PPR: статика — полный RSC, динамика — до ближайшего `loading.js`, не «всё дерево»),
  чтобы миграция не замедлила навигацию глобально. Шиммер всё равно покажется на любом переходе
  дольше 250ms. Списки/пагинация при желании передадут `prefetch={false}` точечно.
- **`selfBusyIndicator`** оставляем (≈1 строка) для будущих случаев, когда волну рисует
  предок-контейнер. Маркер `data-link-pending` эмитится всегда.

## Миграция (44 файла — список подтверждён grep'ом)

Базовое преобразование по каждому файлу:

- `import Link from "next/link"` → `import { RouterLink } from "@/components/ui"`
  (алиас `@/*` → `src/*` подтверждён).
- `<Link …>` → `<RouterLink …>`, сохраняя все пропы и `className`.

Подтверждено ревью: **все** импорты — `import Link from "next/link"` (default, без алиасов),
**нет** `legacyBehavior`/`passHref`/`asChild`/object-href; **все** `href` — строки. Значит,
наивная замена безопасна по типам и не заденет чужой `Link`. Но есть исключения:

### Исключения, без которых `pnpm lint && pnpm test` упадут

- **BLOCKER — файлы внутри `src/components/ui/*` импортируют `./router-link` напрямую, НЕ
  через barrel.** Касается `src/components/ui/pagination.tsx` (`next/link`, строки 44 и 59):
  импорт `@/components/ui` из файла, который сам реэкспортится этим barrel → `import/no-cycle`
  (error в `eslint.config.mjs`). Правило миграции: для файлов в `ui/*` → `import { RouterLink }
  from "./router-link"`.
- **SHOULD-FIX — 45-й файл: `src/components/revision-history/revision-history.test.tsx`.**
  Мокает `next/link` только default-экспортом (строка 13). После перехода `revision-history.tsx`
  на `<RouterLink>` (→ `useLinkStatus`) мок нужно расширить:
  `useLinkStatus: () => ({ pending: false })`, иначе 3 теста упадут на `undefined()`.
- **SHOULD-FIX — import-order.** `next/link` — external-группа, `@/components/ui` — internal.
  `import/order` (error, `newlines-between: always`, алфавит) требует перенести новый импорт в
  internal-блок, а не просто заменить текст на месте. Касается ~всех 44 файлов; per-file тривиально,
  но чистый find-replace lint не пройдёт.

### Краевые случаи (проверять глазами, severity ниже)

- Внешние / `mailto:` / `target="_blank"` ссылки: в текущем коде их **нет** (grep: 0). Авто-`rel`
  и обработка `target` в компоненте — задел на будущее, не нагрузочный сейчас.
- Block-ссылки вокруг картинки/карточки — шиммер красит фон `<a>` за контентом, без сдвига. ОК.
- Кандидаты на `prefetch={false}` / `selfBusyIndicator={false}` (визуальный шум): стрелки
  пагинации (`*-pagination.tsx`), мелкие inline-ссылки (login/register кросс-линки, даты в
  revision-history, теги в lecture-card). Решать точечно при миграции, не обязательно в этом PR.

## Тестирование и проверка

Тесты **колокально**, рядом с исходником (в проекте нет `__tests__/`):
`src/components/ui/router-link.test.tsx` (+ при желании `router-link-busy.test.tsx`).

Конвенции vitest проекта (`globals: false`, нет `setupFiles`):

- В каждом файле: `import "@testing-library/jest-dom/vitest";` и явные
  `import { describe, it, expect, vi } from "vitest";`.
- Мок: `vi.mock("next/link", …)` — **частичный**, сохраняя default `Link` и подменяя/добавляя
  `useLinkStatus`.

Кейсы:

- `RouterLinkBusy` рендерит маркер `[data-link-pending]` при `pending: true` и `null` при `false`.
- `RouterLink` пробрасывает `href`, `className` (слитый через `cn`), `rel` (включая авто-noopener
  при `target="_blank"`) и ставит класс `router-link` по умолчанию (нет — при `selfBusyIndicator={false}`).

Перед PR зелёные: `pnpm lint && pnpm test && pnpm build`.

## Границы / запретные зоны

PR сознательно трогает frozen-зоны (одобрено пользователем как foundation-правка):

- `src/components/ui/*` — новые `router-link.tsx`, `router-link-busy.tsx` + правка `index.ts`.
- `src/app/globals.css` — `@keyframes` + правило в секции CUSTOM COMPONENTS.

Ревью подтвердило: ничего другого из frozen-списка не задето (`schema.ts`, root/admin shell,
остальной UI-kit, `src/utils|hooks|services/*` — не трогаем). Миграция касается только
feature/page-файлов.

## Отклонённые альтернативы

- **Глобальный top-progress-bar** — другой UX; пользователь указал именно на per-link паттерн.
- **`animate-pulse`** — «пульс», а не бегущая волна; выбрана точная sweep-волна.
- **Локальный `<style>` keyframe в компоненте** — пользователь согласился править `globals.css`,
  где приём с hand-written классами (`.fancy-link`) уже идиоматичен.

## Ревью (субагенты, 2026-06-14)

Спека прогнана через 4 параллельных read-only ревью-агента (Next/React API, CSS/Tailwind,
риски миграции, конвенции). Учтённые правки: currentColor вместо битых `--color-*` токенов
(BLOCKER); in-barrel импорт `./router-link` для `pagination.tsx` (BLOCKER); 45-й файл —
мок `useLinkStatus` в `revision-history.test.tsx`; import-order при миграции; `cn` для
className; bare-`ref` зафиксирован как осознанное отклонение; колокальные тесты + per-file
jest-dom/vitest импорты; пин выражения `rel`. Подтверждено без правок: `useLinkStatus` валиден
в Next 16.1.4, `href: string` безопасен (typedRoutes off), keyframe-математика точна, `:has()`
unlayered перебивает утилиты, frozen-зоны не превышены.
