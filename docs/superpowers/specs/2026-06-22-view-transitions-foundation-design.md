# View Transitions: фундамент + кроссфейд переключения темы

**Дата:** 2026-06-22
**Статус:** дизайн на ревью
**Скоуп:** переиспользуемое ядро View Transitions API + первое применение — анимированная смена темы. Навигационные / shared-element переходы — будущая фаза (вне этого спека), но фундамент закладывается под них.

## 1. Контекст и мотивация

Проект сильно инвестировал в appearance (4–5 осей темизации, no-FOUC cookie-SSR) и в нюансную политику `motion` (`system|reduced|full`). Сейчас смена темы — мгновенный hard-cut: `setAxis("theme", …)` императивно мутирует `data-theme` на `<html>`, CSS-переменные каскадят от атрибута. Цель — заменить резкий скачок на плавный круговой reveal новой палитры из точки клика (browser View Transitions API), при этом:

- встроиться в существующую политику `motion` (приглушение движения уважается);
- заложить **переиспользуемое** ядро, чтобы новые переходы добавлялись инкрементально одной-двумя строками;
- не нарушить строгий ui-kit и заморожённые зоны (изменения в них — осознанные, через этот спек).

**Ключевой технический факт:** визуальная смена темы — уже императивная синхронная DOM-мутация (`applyToHtml` в [appearance-provider.tsx](../../../src/components/appearance/appearance-provider.tsx)), а не React-ре-рендер. Поэтому `flushSync` (обычный спутник VT в React) здесь **не нужен** — оборачиваем уже существующую синхронную мутацию.

## 2. Идиоматичность

Направление идиоматично: и React (примитив `<ViewTransition>`, пока experimental), и Next (`experimental.viewTransition`) официально движутся сюда. На текущем **стабильном** стеке (React 19.2.3 + Next 16, без experimental-сборок) `<ViewTransition>` недоступен, поэтому используем браузерный API напрямую. Для смены темы это общепринятый community-паттерн, причём в нашем случае даже без `flushSync` (см. §1). Единственная не-React часть (сырой `startViewTransition`) карантинится в одном хелпере.

## 3. Решения (зафиксированы с пользователем)

| Вопрос | Решение |
|---|---|
| Триггер/origin | Контрол темы — **segmented RadioGroup**; круговой reveal из точки клика по выбранному сегменту (через last-pointer трекер). |
| Новый kit-примитив | **`RadioGroup` (segmented)**, API зеркалит `Select`. |
| Скоуп контрола | Все короткие оси (theme/contrast/density/font/motion) → RadioGroup; **textSize** (4 опции) остаётся `Select`. |
| Скоуп кроссфейда | **Только theme.** Остальные оси меняются мгновенно. |
| Длительность/кривая | Через CSS-токены **`--vt-duration` / `--vt-easing`** (темизуемо), с override через opts хелпера. |

## 4. Состав работы — три PR

Порядок строгий: **PR-1 → PR-2 → PR-3** (PR-3 зависит от обоих). Каждый самодостаточен и зелёный по `pnpm lint && pnpm test && pnpm build`.

| PR | Зона | Заморож.? | Содержание |
|---|---|---|---|
| **PR-1** | `src/components/ui/` | да (UI-kit) | Новый примитив `RadioGroup` (segmented) |
| **PR-2** | `src/utils/`, `src/app/globals.css`, `src/components/appearance/` | да (инфра/shell) | `withViewTransition` + last-pointer трекер + общий reduced-motion-предикат + CSS-гейт + VT-токены |
| **PR-3** | `src/app/me/settings/appearance/` | нет | Перевод 5 коротких осей на `RadioGroup`; кроссфейд на theme |

## 5. PR-1 — `RadioGroup` (segmented)

**Файлы:** `src/components/ui/radio-group.tsx` (+ тест `radio-group.test.tsx`), экспорт из `src/components/ui/index.ts`.

- Реализация на Base UI `RadioGroup` + `Radio` (консистентно с остальным kit).
- Визуал — сегментированный переключатель: сегменты встык, активный сегмент залит (тон `primary`-семейства из токенов), фокус-кольцо `FOCUS_RING_CONTROL`.
- **API drop-in под `Select`:**
  ```ts
  interface RadioGroupProps {
    options: { value: string; label: string }[];
    value: string;
    onValueChange: (value: string) => void;
    "aria-label": string;
  }
  ```
  Это даёт замену `<Select>` → `<RadioGroup>` в одну строку в appearance-settings.
- Guardrail-комплаенс (G7/G8): leaf-примитив, `className` закрыт (escape только через unstyled-вариант, если вообще нужен), нет нативных интерактивных тегов / прямого base-ui у потребителя. Логические свойства → RTL-порядок сегментов корректен без доп. кода.
- A11y: `role="radiogroup"`, стрелочная навигация между сегментами, корректная связь с подписью через существующий `FormField`/`Label`.

**Тесты:** рендер опций; выбор мышью; выбор клавиатурой (стрелки); вызов `onValueChange` с правильным value; `aria-label` проброшен; RTL-порядок сегментов.

## 6. PR-2 — VT-foundation (переиспользуемое ядро)

### 6.1 Хелпер `src/utils/view-transition.ts` (client-safe)

```ts
interface ViewTransitionOpts {
  origin?: { x: number; y: number };  // дефолт — последняя точка указателя; фолбэк — центр вьюпорта
  duration?: number;                  // дефолт — из --vt-duration
  easing?: string;                    // дефолт — из --vt-easing
  name?: string;                      // зарезервировано под будущий CSS-таргетинг переходов
}
export function withViewTransition(mutate: () => void, opts?: ViewTransitionOpts): void;
```

Логика:
1. **Feature-detect + reduced-motion guard.** Если `typeof document.startViewTransition !== "function"` ИЛИ движение приглушено → синхронно вызвать `mutate()` и выйти (мгновенно, без анимации). Всегда безопасный фолбэк, без исключений.
2. Иначе `const t = document.startViewTransition(mutate)`; на `t.ready` запустить круговой clip-reveal `::view-transition-new(root)` из `origin` через Web Animations API: `circle(0 at x y)` → `circle(R at x y)`, где `R` — расстояние до дальнего угла; `duration`/`easing` берутся из opts или из computed `--vt-duration`/`--vt-easing`.
3. `flushSync` не используется (см. §1).

Ошибки `startViewTransition` (теоретические) не должны ломать UI — мутация в любом случае применится через колбэк VT.

### 6.2 Last-pointer трекер

Модульный пассивный листенер `pointerdown` (capture, client-only) пишет последнюю `{x, y}` в модульную переменную. `withViewTransition` использует её как `origin` по умолчанию → «reveal из точки клика» работает для **любого** будущего триггера без проброса координат. Фолбэк (нет записанной точки, напр. чистая клавиатура) — центр вьюпорта (обычный центрированный reveal).

### 6.3 Единый reduced-motion предикат (устранение «трёх зеркал»)

Сейчас формула приглушения движения дублируется в CSS-гейте ([globals.css](../../../src/app/globals.css)) и в JS-хуке [use-reduced-motion.ts](../../../src/components/appearance/use-reduced-motion.ts). Добавление третьего потребителя (`withViewTransition`) требует общей чистой функции:

```ts
// в src/components/appearance/ (рядом с use-reduced-motion)
export function isReducedMotion(input: { motion: MotionPref; osReduce: boolean }): boolean {
  if (input.motion === "reduced") return true;
  if (input.motion === "full") return false;
  return input.osReduce;
}
```

- `useReducedMotion` (хук) кормит её React-стейтом (`appearance.motion`) + `matchMedia` (реактивно, как сейчас).
- `withViewTransition` (не-хук, вызывается в обработчике) кормит её `document.documentElement.dataset.motion` + `window.matchMedia("(prefers-reduced-motion: reduce)").matches`.

Формула живёт **в одном месте**; CSS-гейт остаётся отдельным зеркалом (его не свести к JS), но JS-сторона перестаёт двоиться. Комментарии-инварианты «правишь одно — правь второе» обновляются на актуальный список потребителей.

### 6.4 CSS-гейт + токены в `src/app/globals.css`

- `:root` получает дефолты: `--vt-duration: 400ms; --vt-easing: ease-in-out;` (значения уточняются при визуальной приёмке).
- Отключение UA-дефолтного кроссфейда на корне, чтобы играл наш clip-reveal:
  ```css
  ::view-transition-old(root), ::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
  ```
- Встраивание в существующий motion-гейт: под `[data-motion="reduced"]` и под `@media (prefers-reduced-motion: reduce) :root:not([data-motion="full"])` — обнулить `--vt-duration` и заглушить `::view-transition-group/old/new(*)` (`animation: none !important`). Для theme это belt-and-suspenders (JS-guard и так не вызовет VT), но это **forward-protection** для навигационных переходов, которые в будущем триггерит фреймворк, а не наш хелпер (в духе текущего комментария «защита на будущее»).

### 6.5 Типы

Если в текущем TS `lib.dom` отсутствует `Document.startViewTransition` — добавить минимальную декларацию (ambient `.d.ts` в проекте). Проверяется на этапе реализации PR-2.

## 7. PR-3 — Appearance: контролы + кроссфейд

**Файл:** [appearance-settings.tsx](../../../src/app/me/settings/appearance/appearance-settings.tsx).

- `<Select>` → `<RadioGroup>` для **theme, contrast, density, font, motion**. **textSize** остаётся `<Select>`.
- Кроссфейд **только на theme**:
  ```ts
  onValueChange={(v) => withViewTransition(() => setAxis("theme", v as ThemeValue))}
  ```
  Остальные оси зовут `setAxis(...)` напрямую (мгновенно). Расширение на contrast в будущем — одна строка.
- `theme: "system"`: если резолв не меняет краску — VT визуально no-op, ошибок нет.
- Тест: theme-обработчик идёт через `withViewTransition`; прочие оси — напрямую; рендерится `RadioGroup` для 5 осей, `Select` для textSize.

## 8. Поток данных (смена темы, happy path)

1. Пользователь кликает сегмент «dark» в RadioGroup темы → `pointerdown` записал `{x,y}`.
2. `onValueChange("dark")` → `withViewTransition(() => setAxis("theme","dark"))`.
3. Хелпер: VT поддерживается, движение не приглушено → `startViewTransition(mutate)`.
4. `mutate` = `setAxis` → синхронно `applyToHtml` мутирует `data-theme="dark"` (+ cookie, + debounced backend PATCH, + React setState для контекста).
5. На `.ready` хелпер анимирует `::view-transition-new(root)` круговым clip-reveal из `{x,y}` длительностью `--vt-duration`.
6. Результат: новая палитра «расходится кругом» из точки клика.

**Reduced / нет VT:** шаг 3 уходит в фолбэк → `mutate()` синхронно, мгновенная смена (текущее поведение).

## 9. Вне скоупа (YAGNI)

- Навигационные и shared-element переходы; `experimental.viewTransition`; React `<ViewTransition>` (фундамент к ним готов: `withViewTransition` + `name` + CSS-гейт).
- Кроссфейд на contrast и прочих осях (отложено; одна строка при необходимости).
- Кнопка-тоглу темы в шапке (frozen shell).
- `textSize` → segmented (4 опции, остаётся Select).

## 10. Риски и их снятие

| Риск | Снятие |
|---|---|
| Новый kit-примитив (governed зона) | Осознанно через этот спек; отдельный PR-1 |
| Отсутствие типов `startViewTransition` | Ambient-декларация в PR-2 |
| Браузеры без VT / reduced-motion | Корректный мгновенный фолбэк by design |
| Расхождение reduced-motion-формул | Единый предикат `isReducedMotion` (§6.3) |
| RTL | Логические свойства в RadioGroup; reveal геометрический, RTL-агностичен |
| Параллельные агенты трогают globals.css / ui/index.ts | Коммит только своих файлов по имени; `git status` по hot-файлам перед коммитом |

## 11. Критерии готовности

- `pnpm lint && pnpm test && pnpm build` зелёные после каждого PR.
- Ручная приёмка в Chromium/Safari: смена темы — круговой reveal из точки клика; при `motion: reduced` и в браузере без VT — мгновенно; контролы 5 осей — segmented, textSize — Select; RTL-порядок сегментов корректен.
- Длительность/кривая ощущаются естественно (финальные значения `--vt-duration`/`--vt-easing` подобрать на приёмке).
