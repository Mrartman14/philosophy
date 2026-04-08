# Codebase Cleanup — План реализации

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Устранить архитектурные несогласованности, ужесточить линтинг/типизацию, исправить баги.

**Architecture:** Последовательные рефакторинг-задачи без изменения функциональности. Сначала ужесточаем инструментарий (TS/ESLint), затем исправляем то, что всплывёт, затем структурные улучшения.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind v4, ESLint 9

**Тестовый фреймворк:** Отсутствует. Верификация — `npx tsc --noEmit` и `npm run build`.

---

### Task 1: Ужесточить tsconfig.json

**Files:**
- Modify: `tsconfig.json`

**Step 1: Добавить строгие флаги**

В `compilerOptions` добавить:

```json
"noUncheckedIndexedAccess": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"exactOptionalPropertyTypes": true,
"noFallthroughCasesInSwitch": true
```

**Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit 2>&1 | head -80`
Expected: Список ошибок (неиспользуемые переменные/параметры, indexed access и т.д.)

**Step 3: Записать все ошибки и перейти к Task 2**

НЕ исправлять ошибки здесь — сначала нужно настроить ESLint, потом исправлять всё разом.

**Step 4: Commit**

```bash
git add tsconfig.json
git commit -m "chore: enable strict TS flags — noUncheckedIndexedAccess, noUnusedLocals, noUnusedParameters, exactOptionalPropertyTypes, noFallthroughCasesInSwitch"
```

---

### Task 2: Усилить ESLint

**Files:**
- Modify: `eslint.config.mjs`

**Step 1: Добавить правила**

Заменить содержимое `eslint.config.mjs`:

```js
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
];

export default eslintConfig;
```

**Step 2: Проверить**

Run: `npx next lint 2>&1 | head -40`
Expected: Возможные новые предупреждения/ошибки

**Step 3: Commit**

```bash
git add eslint.config.mjs
git commit -m "chore: enable strict ESLint rules — no-floating-promises, exhaustive-deps as error"
```

---

### Task 3: Исправить ошибки компиляции после ужесточения

**Files:**
- Зависит от вывода `tsc --noEmit` из Task 1
- Предполагаемые файлы на основе аудита:

**Step 1: Исправить неиспользуемые параметры/переменные**

Файлы, которые скорее всего затронет `noUnusedParameters`:

`src/services/push-service/push-service.ts:47` — `_sub` уже с underscore, ОК.

`src/components/shared/popup/popup.tsx:9` — `triggerProps` определён в типе, но не деструктурирован:
```tsx
// Было:
type PopupProps = {
  trigger: React.ReactNode;
  content: React.ReactNode;
  triggerProps?: React.ComponentProps<typeof Popover.Trigger>;
};
export const Popup: React.FC<PopupProps> = ({ content, trigger }) => {

// Стало — убрать triggerProps из типа (нигде не используется):
type PopupProps = {
  trigger: React.ReactNode;
  content: React.ReactNode;
};
export const Popup: React.FC<PopupProps> = ({ content, trigger }) => {
```

**Step 2: Исправить noUncheckedIndexedAccess ошибки**

Проверить, какие файлы обращаются к массивам по индексу, и добавить проверки. Вероятные места:
- `src/utils/get-random-sum-parts.ts` — обращения к элементам массива
- `src/components/app/video/use-synced-player.ts` — `findByTime` использует `.find()` (возвращает `T | undefined` — уже ОК)

**Step 3: Исправить остальные ошибки tsc**

Пройти по списку ошибок из Task 1, Step 2 и исправить каждую.

**Step 4: Убедиться, что всё чисто**

Run: `npx tsc --noEmit`
Expected: Нет ошибок

Run: `npx next lint`
Expected: Нет ошибок

**Step 5: Commit**

```bash
git add -p  # только изменённые файлы
git commit -m "fix: resolve strict TS and ESLint errors"
```

---

### Task 4: Удалить провайдеры, прокинуть лекции через пропсы

**Files:**
- Delete: `src/app/_providers/app-page-provider.tsx`
- Delete: `src/app/_providers/app-page-client-provider.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/app/app-header/app-header.tsx`
- Modify: `src/components/app/app-nav.tsx`

**Step 1: Добавить пропс `lectures` в AppNav**

`src/components/app/app-nav.tsx`:
```tsx
// Было:
import { useAppPageConfig } from "@/app/_providers/app-page-client-provider";

export const AppNav: React.FC = () => {
  const { lectures } = useAppPageConfig();

// Стало:
import type { components } from "@/api/schema";
type Lecture = components["schemas"]["lecture.Lecture"];

export const AppNav: React.FC<{ lectures: Lecture[] }> = ({ lectures }) => {
```

**Step 2: Добавить пропс `lectures` в AppHeader, прокинуть в AppNav**

`src/components/app/app-header/app-header.tsx`:
```tsx
// Было:
export const AppHeader: React.FC = async () => {
  // ...
  <AppNav />

// Стало:
import type { components } from "@/api/schema";
type Lecture = components["schemas"]["lecture.Lecture"];

export const AppHeader: React.FC<{ lectures: Lecture[] }> = async ({ lectures }) => {
  // ...
  <AppNav lectures={lectures} />
```

**Step 3: Перенести fetch в layout.tsx, удалить провайдеры**

`src/app/layout.tsx`:
```tsx
// Убрать:
import { AppPageProvider } from "./_providers/app-page-provider";

// Добавить:
import { getLectures } from "@/api/lecture-api";

// Сделать async:
export default async function RootLayout({ children }: ...) {
  const result = await getLectures(1, 100);
  const lectures = result.data ?? [];

  return (
    <html lang="ru">
      {/* ... */}
      <body ...>
        {/* Было: <AppPageProvider> */}
          <AppHeader lectures={lectures} />
          {/* ... */}
        {/* Было: </AppPageProvider> */}
        {/* ... */}
      </body>
    </html>
  );
}
```

**Step 4: Удалить файлы провайдеров**

```bash
rm src/app/_providers/app-page-provider.tsx
rm src/app/_providers/app-page-client-provider.tsx
rmdir src/app/_providers
```

**Step 5: Проверить**

Run: `npx tsc --noEmit`
Expected: Нет ошибок (нет больше импортов удалённых файлов)

Run: `npm run build`
Expected: Успешная сборка

**Step 6: Commit**

```bash
git add src/app/layout.tsx src/components/app/app-header/app-header.tsx src/components/app/app-nav.tsx
git rm src/app/_providers/app-page-provider.tsx src/app/_providers/app-page-client-provider.tsx
git commit -m "refactor: remove context providers, pass lectures as props through layout"
```

---

### Task 5: Исправить утечку памяти в Gradient

**Files:**
- Modify: `src/components/shared/gradient/gradient.tsx`

**Step 1: Сохранить animationFrameId и отменить в cleanup**

```tsx
// Было (строки 36-60, 79-81):
function draw() {
  if (!ctx) { return; }
  // ... рисование ...
  time += 0.0025;
  requestAnimationFrame(draw);
}
draw();
// ...
return () => {
  window.removeEventListener("resize", resizeCanvas);
};

// Стало:
let animationFrameId: number;
function draw() {
  if (!ctx) { return; }
  // ... рисование (без изменений) ...
  time += 0.0025;
  animationFrameId = requestAnimationFrame(draw);
}
animationFrameId = requestAnimationFrame(draw);
// ...
return () => {
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener("resize", resizeCanvas);
};
```

**Step 2: Проверить**

Run: `npx tsc --noEmit`
Expected: Нет ошибок

**Step 3: Commit**

```bash
git add src/components/shared/gradient/gradient.tsx
git commit -m "fix: cancel animation frame on Gradient unmount — memory leak"
```

---

### Task 6: Исправить NetworkIndicator — useSyncExternalStore

**Files:**
- Modify: `src/components/app/network-indicator.tsx`

**Step 1: Заменить useState+useEffect на useSyncExternalStore**

```tsx
"use client";

import { useSyncExternalStore } from "react";
import { OfflineIcon } from "@/assets/icons/offline-icon";

function subscribeToOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export const NetworkIndicator: React.FC<{ className?: string }> = ({
  className,
}) => {
  const isOnline = useSyncExternalStore(
    subscribeToOnlineStatus,
    getSnapshot,
    getServerSnapshot,
  );

  return !isOnline ? (
    <OfflineIcon className={`text-amber-600 ${className}`} />
  ) : null;
};
```

**Step 2: Проверить**

Run: `npx tsc --noEmit`
Expected: Нет ошибок

**Step 3: Commit**

```bash
git add src/components/app/network-indicator.tsx
git commit -m "refactor: migrate NetworkIndicator to useSyncExternalStore"
```

---

### Task 7: Переместить use-synced-player в hooks/

**Files:**
- Move: `src/components/app/video/use-synced-player.ts` → `src/hooks/use-synced-player.ts`
- Modify: `src/app/lectures/[id]/lecture-player.tsx` (обновить импорт)

**Step 1: Переместить файл**

```bash
mv src/components/app/video/use-synced-player.ts src/hooks/use-synced-player.ts
```

**Step 2: Обновить импорт в lecture-player.tsx**

```tsx
// Было:
import { useSyncedPlayer } from "@/components/app/video/use-synced-player";

// Стало:
import { useSyncedPlayer } from "@/hooks/use-synced-player";
```

**Step 3: Проверить**

Run: `npx tsc --noEmit`
Expected: Нет ошибок

**Step 4: Commit**

```bash
git add src/hooks/use-synced-player.ts src/app/lectures/[id]/lecture-player.tsx
git rm src/components/app/video/use-synced-player.ts
git commit -m "refactor: move use-synced-player hook to src/hooks/"
```

---

### Task 8: Очистить CSS-переменные

**Files:**
- Modify: `src/app/globals.css`

**Контекст:**
- `@theme` блок регистрирует `--color-*` переменные как Tailwind-токены
- `:root` создаёт короткие алиасы (`--background` → `var(--color-background)`)
- Компоненты используют ОБОИХ: `bg-(--background)` (короткий) и `bg-(--color-primary)/10` (полный) в `transcript-panel.tsx`

**Step 1: Унифицировать использование переменных**

Убрать блок алиасов из `:root` (строки 18-24). Заменить использование коротких имён в компонентах на полные `--color-*`:

`:root` должен содержать только:
```css
:root {
  color-scheme: light dark;
  --header-height: var(--spacing-header);
}
```

**Step 2: Обновить все компоненты, использующие короткие имена**

Поиск и замена по всему `src/`:
- `(--background)` → `(--color-background)`
- `(--border)` → `(--color-border)` (осторожно: не заменить в `border-`)
- `(--description)` → `(--color-description)`
- `(--text-pane)` → `(--color-text-pane)`
- `(--primary)` → `(--color-primary)`
- `(--link)` → `(--color-link)`

Run: `grep -rn "\--(background\|border\|description\|text-pane\|primary\|link)" src/ --include="*.tsx" --include="*.ts"` чтобы найти все места.

**Step 3: Проверить**

Run: `npm run build`
Expected: Успешная сборка. Визуально проверить: `npm run dev`, открыть localhost:3001 — цвета должны быть те же.

**Step 4: Commit**

```bash
git add src/app/globals.css src/
git commit -m "refactor: remove CSS variable aliases, use --color-* names consistently"
```

---

### Task 9: Очистить Yandex Metrika

**Files:**
- Modify: `src/components/yandex-metrika/yandex-metrika.tsx`

**Step 1: Убрать @ts-nocheck, добавить типизацию window.ym, удалить мёртвый код**

```tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    ym?: (...args: any[]) => void;
  }
}

const YM_COUNTER_ID = 104376496 as const;

export const YandexMetrika: React.FC = () => {
  const pathname = usePathname();

  useEffect(() => {
    if (!window.ym) {
      (function (m: any, e: Document, t: string, r: string, i: string) {
        (m as any)[i] =
          (m as any)[i] ||
          function (...args: any[]) {
            ((m as any)[i].a = (m as any)[i].a || []).push(args);
          };
        (m as any)[i].l = Date.now();
        const k = e.createElement(t) as HTMLScriptElement;
        const a = e.getElementsByTagName(t)[0];
        k.async = true;
        k.src = r;
        a?.parentNode?.insertBefore(k, a);
      })(
        window,
        document,
        "script",
        "https://mc.yandex.ru/metrika/tag.js",
        "ym"
      );
      window.ym?.(YM_COUNTER_ID, "init", {
        clickmap: true,
        trackLinks: true,
        accurateTrackBounce: true,
        webvisor: true,
      });
    }
  }, []);

  useEffect(() => {
    if (window.ym && pathname) {
      window.ym(YM_COUNTER_ID, "hit", pathname);
    }
  }, [pathname]);

  return null;
};
```

**Step 2: Проверить**

Run: `npx tsc --noEmit`
Expected: Нет ошибок

**Step 3: Commit**

```bash
git add src/components/yandex-metrika/yandex-metrika.tsx
git commit -m "refactor: add typings to YandexMetrika, remove dead code and @ts-nocheck"
```

---

### Task 10: Добавить error boundaries

**Files:**
- Create: `src/app/error.tsx`
- Create: `src/app/lectures/[id]/error.tsx`

**Step 1: Создать корневой error.tsx**

`src/app/error.tsx`:
```tsx
"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-3xl font-bold">Что-то пошло не так</h1>
      <p className="text-(--color-description)">
        Произошла ошибка при загрузке страницы.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded border border-(--color-border) hover:bg-(--color-text-pane)"
      >
        Попробовать снова
      </button>
    </div>
  );
}
```

**Step 2: Создать error.tsx для лекции**

`src/app/lectures/[id]/error.tsx`:
```tsx
"use client";

import Link from "next/link";

export default function LectureError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-3xl font-bold">Не удалось загрузить лекцию</h1>
      <p className="text-(--color-description)">
        Проверьте подключение к интернету или попробуйте позже.
      </p>
      <div className="flex gap-4">
        <button
          onClick={reset}
          className="px-4 py-2 rounded border border-(--color-border) hover:bg-(--color-text-pane)"
        >
          Попробовать снова
        </button>
        <Link href="/" className="px-4 py-2 rounded border border-(--color-border) hover:bg-(--color-text-pane)">
          На главную
        </Link>
      </div>
    </div>
  );
}
```

**Step 3: Проверить**

Run: `npx tsc --noEmit`
Expected: Нет ошибок

Run: `npm run build`
Expected: Успешная сборка

**Step 4: Commit**

```bash
git add src/app/error.tsx src/app/lectures/[id]/error.tsx
git commit -m "feat: add error boundaries for root and lecture pages"
```

---

### Task 11: Финальная верификация

**Step 1: Полная проверка типов**

Run: `npx tsc --noEmit`
Expected: 0 ошибок

**Step 2: Линтинг**

Run: `npx next lint`
Expected: 0 ошибок

**Step 3: Сборка**

Run: `npm run build`
Expected: Успешная сборка без предупреждений

**Step 4: Визуальная проверка**

Run: `npm run dev`
Проверить:
- Главная страница — список лекций отображается
- Навигация — выпадающее меню в хедере работает (лекции подгружены)
- Страница лекции — видео + транскрипт
- Gradient анимация — работает, при навигации не утекает память
- Offline-индикатор — корректен при загрузке
