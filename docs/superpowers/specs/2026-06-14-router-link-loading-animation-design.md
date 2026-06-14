# RouterLink — внутренние ссылки с анимацией загрузки

**Дата:** 2026-06-14
**Статус:** дизайн утверждён, готов к плану реализации
**Тип:** foundation-PR (трогает frozen-зоны `src/components/ui/*` и `src/app/globals.css`) + широкая миграция

## Контекст и цель

В проекте много внутренних ссылок (~44 файла импортируют `next/link`, ~65 использований `<Link>`).
Цель — единый компонент `RouterLink`, который:

1. Использует `next/link` для клиентской навигации (как и сейчас).
2. Показывает **анимацию загрузки на самой ссылке** во время in-flight перехода —
   чтобы пользователь видел отклик на клик до того, как отрисуется новая страница.

Референс паттерна — компонент `RouterLink` в соседнем проекте
`portal-web` (`src/components/shared/navigation/router-link/`).

## Паттерн-референс (portal-web)

- `RouterLink` — обёртка над `next/link`, последним ребёнком рендерит `<RouterLinkBusy />`.
- `RouterLinkBusy` — `'use client'`, вызывает `useLinkStatus()` из `next/link`; при
  `pending` рендерит zero-layout маркер `<span hidden data-link-pending="" />`.
  Это **сигнал, а не художник**: маркер — обычный DOM-атрибут, любой предок может
  подписаться через `:has([data-link-pending])`.
- Шиммер рисуется CSS-правилом `.link:has([data-link-pending])` (sweep-волна через
  `background-position`, только paint-свойства → нет reflow). `@keyframes` живут в
  `global.scss`, чтобы их переиспользовали и контейнеры (FormSidebar).
- **Задержка анимации 250ms** гасит шиммер на мгновенных/кешированных переходах.
- `prefetch` по умолчанию `false` (их обоснование — viewport-prefetch списков/таблиц
  фанаутит тяжёлые server-renders динамических `[id]`-роутов).

Совместимость: оба проекта на Next 16 / React 19 → `useLinkStatus` доступен
(philosophy: Next 16.1.4, React 19.2.3).

## Ключевая адаптация под этот проект

| portal-web | philosophy |
|---|---|
| SCSS-модули (`*.module.scss`) | **Tailwind v4** (`@theme` в `globals.css`) |
| Своя типографика `@platform-fe/ui` (пропы `palette/decoration/font/size`) | Типографики нет — ссылки стилизуются Tailwind-классами через `className` |
| `@keyframes` в `global.scss` | `@keyframes` + правило в секции `/* CUSTOM COMPONENTS */` `globals.css` (там уже живёт hand-written `.fancy-link` — приём для проекта идиоматичен) |

Поэтому **все typography-пропы выкидываем**. `RouterLink` здесь =
тонкая обёртка над `NextLink` + шиммер + проброс `className`.

## Архитектура: компоненты

### 1. `src/components/ui/router-link.tsx` (server-совместимый)

Рендерит `NextLink` + `<RouterLinkBusy />` последним ребёнком. Пробрасывает
`href, replace, scroll, prefetch, target, rel, className, ref, children` + rest.
Авто-`rel="noopener noreferrer"` при `target="_blank"`. Вешает CSS-класс
`router-link` (self-paint), когда `selfBusyIndicator !== false`.

```ts
type RouterLinkProps = Omit<ComponentProps<typeof NextLink>, "href"> & {
  href: string;
  /** false — когда волну рисует предок-контейнер через :has([data-link-pending]). Default true. */
  selfBusyIndicator?: boolean;
};
```

### 2. `src/components/ui/router-link-busy.tsx` (`'use client'`)

```tsx
"use client";
import { useLinkStatus } from "next/link";

export function RouterLinkBusy() {
  const { pending } = useLinkStatus();
  return pending ? <span hidden data-link-pending="" /> : null;
}
```

Рендерит **только** маркер — контент `<a>` остаётся прямым ребёнком `<a>` (важно,
если `RouterLink` используется как `render`-таргет другого компонента: оборачивание
детей в client-компонент пере-родительствовало бы их через RSC-границу и потеряло).

### 3. `src/components/ui/index.ts`

Добавить: `export { RouterLink, type RouterLinkProps } from "./router-link";`

## Архитектура: CSS (globals.css, секция CUSTOM COMPONENTS)

```css
@keyframes router-link-wave {
  0%   { background-position: -50% 0; }
  60%, 100% { background-position: 150% 0; }
}

.router-link:has([data-link-pending]) {
  animation: router-link-wave 1250ms linear 250ms infinite;
  background-color: var(--color-text-pane);            /* лёгкий тинт, как у Skeleton */
  background-image: linear-gradient(
    90deg, transparent, color-mix(in srgb, var(--color-foreground) 12%, transparent), transparent
  );
  background-repeat: no-repeat;
  background-size: 40% 100%;
  border-radius: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .router-link:has([data-link-pending]) {
    animation: none;
    background-image: none; /* остаётся статичный тинт */
  }
}
```

- Только paint-свойства (`background-*`, `animation`) → box-модель ссылки не меняется,
  клик не вызывает reflow.
- Задержка `250ms` в `animation` гасит шиммер на мгновенных/кешированных переходах.
- Цвета — из существующих токенов проекта (`--color-text-pane`, `--color-foreground`),
  чтобы попадать в light/dark + forced-colors палитру.

## Решения по API

- **`prefetch` НЕ форсим в `false`** (в отличие от portal-web). Оставляем дефолт Next
  (hover/viewport prefetch), чтобы миграция 44 файлов не замедлила навигацию глобально.
  Шиммер всё равно покажется на любом переходе дольше 250ms. Списки при необходимости
  передадут `prefetch={false}` точечно.
- **`selfBusyIndicator`** оставляем (≈1 строка) для будущих случаев, когда волну рисует
  предок-контейнер. Маркер `data-link-pending` эмитится всегда — предок может
  подписаться независимо от значения пропа.

## Миграция (~44 файла)

Механически по каждому файлу:

- `import Link from "next/link"` → `import { RouterLink } from "@/components/ui"`
  (алиас `@/*` → `src/*` подтверждён).
- `<Link …>` → `<RouterLink …>`, сохраняя все пропы и `className`.

Краевые случаи (проверять глазами каждый файл):

- Внешние / `mailto:` / `target="_blank"` ссылки — работают, просто без pending-волны
  (`useLinkStatus` не срабатывает на full-page navigation). Безвредно.
- Block-ссылки, оборачивающие картинку/карточку, — шиммер красит фон `<a>` за
  контентом, без сдвига layout. Допустимо.
- Файлы, где `Link` передаётся как `render`/`asChild` другому компоненту — проверить,
  что маркер-ребёнок не ломает контракт (он `hidden`, zero-layout).

## Тестирование и проверка

- Юнит-тесты:
  - `RouterLinkBusy` рендерит маркер `[data-link-pending]` при `pending: true`
    (мок `useLinkStatus`) и `null` при `pending: false`.
  - `RouterLink` пробрасывает `href`, `className`, `rel` (включая авто-noopener
    при `target="_blank"`) и подставляет класс `router-link` по умолчанию.
- Перед PR зелёные: `pnpm lint && pnpm test && pnpm build`.

## Границы / запретные зоны

PR сознательно трогает frozen-зоны (одобрено пользователем как foundation-правка):

- `src/components/ui/*` — новый примитив `RouterLink` + правка `index.ts`.
- `src/app/globals.css` — `@keyframes` + правило в секции CUSTOM COMPONENTS.

Не трогаем: `schema.ts`, root/admin shell, остальной UI-kit, общую инфраструктуру.

## Отклонённые альтернативы

- **Глобальный top-progress-bar** — другой UX; пользователь указал именно на per-link
  паттерн portal-web.
- **`animate-pulse`** (Tailwind built-in, как у `Skeleton`) — это «пульс», а не бегущая
  волна; пользователь выбрал точную sweep-волну.
- **Локальный `<style>` keyframe внутри компонента** — пользователь согласился править
  `globals.css`, где приём с hand-written классами (`.fancy-link`) уже идиоматичен.
