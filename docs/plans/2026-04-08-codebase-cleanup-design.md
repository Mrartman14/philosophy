# Codebase Cleanup — Архитектурный аудит и исправления

**Дата:** 2026-04-08  
**Цель:** Устранить архитектурные несогласованности, ужесточить линтинг и типизацию, исправить баги.

---

## 1. TypeScript — ужесточение конфига

Текущий `tsconfig.json` включает `strict: true`, но не покрывает дополнительные флаги:

**Добавить в `compilerOptions`:**
- `noUncheckedIndexedAccess: true` — `arr[0]` возвращает `T | undefined`
- `noUnusedLocals: true` — ошибка на неиспользуемые переменные
- `noUnusedParameters: true` — ошибка на неиспользуемые параметры
- `exactOptionalPropertyTypes: true` — различает `prop?: string` и `prop: string | undefined`
- `noFallthroughCasesInSwitch: true` — защита от забытого `break`

После включения — исправить все ошибки компиляции, которые всплывут.

---

## 2. ESLint — усиление правил

Текущий конфиг — минимальный (`next/core-web-vitals` + `next/typescript`).

**Добавить:**
- `@typescript-eslint/no-floating-promises: "error"` — ловит забытые `await`
- `react-hooks/exhaustive-deps: "error"` — вместо `warn`

---

## 3. Удаление провайдеров / контекста

**Проблема:** `AppPageProvider` + `AppPageClientProvider` + `useAppPageConfig` существуют только для того, чтобы передать список лекций в `AppNav`. Это избыточная абстракция.

**Решение:**
- Удалить `src/app/_providers/app-page-provider.tsx`
- Удалить `src/app/_providers/app-page-client-provider.tsx`
- В `layout.tsx` — сделать `async`, вызвать `getLectures()`, передать данные пропсом в `AppHeader`
- `AppHeader` прокидывает лекции в `AppNav` через пропс
- Убрать дублирующий `getLectures(1, 100)` из `page.tsx` — главная страница получает данные отдельно (она рендерит другой UI), но fetch дедуплицируется Next.js автоматически при одинаковых параметрах + `revalidate`

---

## 4. Баг: утечка памяти в Gradient

**Файл:** `src/components/shared/gradient/gradient.tsx:58`

**Проблема:** `requestAnimationFrame(draw)` вызывается рекурсивно, но в cleanup `useLayoutEffect` отменяется только `resize`-листенер. Анимация продолжает работать после размонтирования.

**Решение:** Сохранять `animationFrameId` и вызывать `cancelAnimationFrame()` в cleanup.

---

## 5. Баг: NetworkIndicator — неверное начальное состояние

**Файл:** `src/components/app/network-indicator.tsx:12`

**Проблема:** `useState(false)` не отражает реальное состояние `navigator.onLine` на момент маунта. Если страница загружена оффлайн, индикатор не покажется до первого события `online`/`offline`.

**Решение:** Мигрировать на `useSyncExternalStore` (как указано в TODO в коде), либо инициализировать `useState(() => !navigator.onLine)`.

---

## 6. Хук не на месте: use-synced-player

**Файл:** `src/components/app/video/use-synced-player.ts`

**Проблема:** Все хуки проекта лежат в `src/hooks/`, кроме этого.

**Решение:** Переместить в `src/hooks/use-synced-player.ts`, обновить импорт в `lecture-player.tsx`.

---

## 7. CSS-переменные — дублирование

**Файл:** `src/app/globals.css:4-25`

**Проблема:** Блок `@theme` (строки 4-13) и `:root` (строки 15-25) определяют одни и те же переменные. `:root` дополнительно создаёт алиасы (`--primary` → `--color-primary`), которые не используются в коде.

**Решение:** Убрать алиасы из `:root`, оставить только `color-scheme: light dark` и `--header-height`.

---

## 8. Popup — неиспользуемый triggerProps

**Файл:** `src/components/shared/popup/popup.tsx:7`

**Проблема:** `triggerProps` объявлен в типе `PopupProps`, но не деструктурируется и не пробрасывается в `Popover.Trigger`.

**Решение:** Либо убрать из типа, либо реализовать проброс. Проверить, есть ли потребители — если нет, убрать.

---

## 9. Yandex Metrika — очистка

**Файл:** `src/components/yandex-metrika/yandex-metrika.tsx`

**Проблема:**
- `eslint-disable` + `@ts-nocheck` на весь файл
- 20 строк закомментированного кода (старая реализация через `react-yandex-metrika`)

**Решение:**
- Удалить закомментированный код (строки 51-69)
- Убрать `@ts-nocheck`, добавить минимальную типизацию для `window.ym` (declare global)
- Оставить точечный `eslint-disable` только на строках с Яндекс-скриптом

---

## 10. Error boundaries

**Проблема:** Ни одного `error.tsx` в `src/app/`. При ошибке fetch пользователь видит дефолтную страницу Next.js.

**Решение:** Добавить `src/app/error.tsx` (корневой) и `src/app/lectures/[id]/error.tsx` с осмысленным UI на русском.

---

## 11. next.config.ts — output: 'export'

**Проблема:** Проект деплоится через `gh-pages -d out`, но `output: 'export'` не указан в `next.config.ts`. Без него `next build` не генерирует статический `out/`.

**Решение:** Проверить текущий процесс деплоя. Если нужен статический экспорт — добавить `output: 'export'` и `basePath` из env.
