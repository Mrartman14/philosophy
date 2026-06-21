# Dev UI showcase: APCA + appearance-оси + motion «в действии»

Дата: 2026-06-21
Статус: design (одобрен пользователем, ждёт ревью спеки)
Тип: dev-only витрина (расширение существующей `/dev/ui`)

## 1. Задача

Дать живую страницу-styleguide, где видно **APCA-контраст** и **оси appearance** (тема/контраст/плотность/шрифт/размер/**motion**) «в действии»: переключаешь ось — мгновенно меняются цвета, пересчитываются числа контраста, глохнут/идут анимации. Расширяем уже существующую dev-only витрину [src/app/dev/ui/page.tsx](src/app/dev/ui/page.tsx) (в проде `notFound()`).

## 2. Принятые решения

- **Роут:** расширяем `/dev/ui` (dev-only). Без i18n/SEO/RBAC — тексты хардкодим (как уже принято на этой странице).
- **Контролы осей:** переиспользуем готовый `<AppearanceSettings/>` как панель наверху. Он на `useAppearance` → реальная система: переключение мутирует `<html data-*>` (+cookie, +debounced PATCH на бэк).
  - **Реальная запись в бэкенд оставлена намеренно.** Persist (#3) ортогонален визуальному эффекту — эффект целиком от `applyToHtml` (data-атрибуты на `<html>`). Делать persist локальным/эфемерным архитектурно неудобно: он зашит в единственный app-wide провайдер, общий для всех потребителей; `applyToHtml`/cookie документ-глобальны; разное поведение для одного потребителя = смена контракта замороженного провайдера, и всё равно app-wide. YAGNI.
  - Митигация единственного минуса («playing меняет реальную тему»): **строка-предупреждение в шапке секшна** («Меняет ваши реальные настройки внешнего вида — это настоящая система appearance»).
- **APCA-секция:** живая матрица контраста (27 пар), числа Lc **вычисляются в браузере БЕЗ внешних зависимостей** (см. §4). `apca-w3`/`culori`/`apcach` — только devDependencies; импортировать их в код страницы нельзя (компилируется в прод-сборку; риск сборки/рантайма + `import/no-extraneous-dependencies`). `package.json` не трогаем.
- **Motion-секция:** набор демок «до/после» + живой бейдж `useReducedMotion()`.

## 3. Архитектура

`page.tsx` остаётся **server-component** с dev-гардом; добавляет секции, рендерящие **client-компоненты** (страница под root-layout → `AppearanceProvider` доступен, значит `useAppearance`/`useReducedMotion` работают). Группировка под заголовками: **Appearance · Tokens (APCA) · Motion · Components** (существующие примеры компонентов сохраняются как есть).

Юниты (каждый — отдельная ответственность, kebab-case, colocated в `src/app/dev/ui/`):

- `apca-lc.ts` — чистый хелпер: из двух CSS-`rgb()`-строк → знаковый APCA Lc. Зависимостей нет.
- `apca-matrix.tsx` (`"use client"`) — рендер 27 карточек пар + live-пересчёт Lc.
- `motion-showcase.tsx` (`"use client"`) — демки движения + бейдж `useReducedMotion()`.
- `page.tsx` — оркестрация секций (server).

## 4. Секция APCA — живая матрица контраста

### Источник
`CONTRAST_PAIRS` из [src/styles/tokens/apca-targets.ts](src/styles/tokens/apca-targets.ts): массив `{ fg: ColorTokenName; bg: ColorTokenName; minLc: number; note: string }` (27 пар). Имя токена `X` → CSS-переменная `--color-X`.

### Вычисление Lc без внешних депов
1. Для пары рендерится карточка-образец: контейнер `background: var(--color-<bg>)`, текст `color: var(--color-<fg>)` («Aa» + note).
2. Через `getComputedStyle(el)` читаются **резолвнутые** `color` и `backgroundColor` — браузер отдаёт их как `rgb(r, g, b)` (даже когда токен задан в `oklch`), поэтому **culori не нужен**; парсим `rgb()` регуляркой.
3. `apca-lc.ts` считает Lc: `sRGBtoY([r,g,b])` (линеаризация ^2.4 + веса 0.2126/0.7152/0.0722) → `APCAcontrast(textY, bgY)` (порт формулы APCA-W3 0.1.x: SA98G-константы, soft-clamp чёрного, scale 1.14, отсечка ±0.1 Lc). Возвращает знаковый Lc.
4. Карточка показывает: образец, `|Lc|` (округл.), целевой `minLc`, бейдж **pass/fail** (`Math.abs(Lc) >= minLc` — как CI-гард, который меряет `Math.abs(lc(fg,bg))`), и `note`. Опционально — знак (полярность fg/bg).

### Реактивность
Пересчёт при смене визуальной темы: `useEffect`, зависящий от `appearance.theme` и `appearance.contrast` (из `useAppearance`); плюс подписка на `matchMedia('(prefers-color-scheme: dark)')` и `'(prefers-contrast: more)'` — чтобы значения `system`/`auto` пересчитывались при смене OS. Чтение через refs на отрендеренных карточках (а не отдельный пробник) — отражает ровно то, что на экране. Первый расчёт — в `useEffect`/`useLayoutEffect` после маунта (SSR-значения нет — числа появляются после гидрации; до этого «—»).

### Паритет с гардом
`apca-lc.test.ts` сверяет `apca-lc.ts` с `apca-w3` (devDep, **только в тесте**) на наборе RGB-пар + знаковые значения (белый-на-чёрном ≈ −108, чёрный-на-белом ≈ 106) с допуском ±0.5 Lc. Гарантирует, что числа на странице совпадают с CI-гардом ([apca.test.ts](src/styles/tokens/apca.test.ts)).

## 5. Секция Motion — «в действии»

Живой бейдж: `useReducedMotion()` → «Reduced motion: ДА/НЕТ» + подсказка «переключи ось Motion в панели выше». Демки:

- **Skeleton pulse** — `<Skeleton/>` из ui-kit (пульс глохнет под reduced — глобальный `animation: none`).
- **Keyframe-бокс** — div с `animate-[spin_1s_linear_infinite]` (наглядно показывает подавление любой keyframe-анимации).
- **fancy-link** — `<a className="fancy-link">…</a>`: стрелка `::after` едет на hover vs замирает под reduced.
- **Base UI Popover** (или Dialog) из ui-kit — opacity-fade при открытии **остаётся** под reduced (демонстрирует нюансную политику: `transition` не глушим, движение/`animation`/`scale` — глушим).
- **Заметка-ссылка** на `/map` — инерция камеры three.js (инлайн не встраиваем).

Цель секции — показать стержневое правило: *движение/transform/looping-анимации off; одноразовый opacity-fade и hover-цвет остаются*.

## 6. Файлы

- Modify: `src/app/dev/ui/page.tsx` — заголовки-группы + 3 новые секции (рендер client-компонентов + `<AppearanceSettings/>` + предупреждающая строка).
- Create: `src/app/dev/ui/apca-lc.ts`, `src/app/dev/ui/apca-lc.test.ts`, `src/app/dev/ui/apca-matrix.tsx`, `src/app/dev/ui/motion-showcase.tsx`.
- Reuse (без изменений): `<AppearanceSettings/>` ([src/app/me/settings/appearance/appearance-settings.tsx](src/app/me/settings/appearance/appearance-settings.tsx)), `Skeleton`/`Popover`/`Dialog` из `@/components/ui`, `CONTRAST_PAIRS`, `ColorTokenName`.
- **НЕ трогаем:** `package.json`, `src/components/appearance/*`, `src/styles/*`, токены, провайдер.

## 7. Тестирование

- `apca-lc.test.ts` — паритет с `apca-w3` + знаковые значения (главный тест; гарантирует корректность чисел).
- Компонентные smoke-тесты матрицы/motion **не делаем**: jsdom не вычисляет реальные `getComputedStyle`-цвета (вернёт пусто/чёрный) → Lc-логику проверяем юнит-хелпером, а не рендером; DOM-чтение и реактивность — ручная dev-проверка.
- Ручная проверка (dev): открыть `/dev/ui`, переключать оси в панели — матрица пересчитывает Lc и pass/fail, motion-демки глохнут/идут, `useReducedMotion`-бейдж меняется; проверить light/dark × normal/high.
- Зелёные: `pnpm lint && pnpm test` (на затронутых файлах; полный build может быть красным из-за пред-существующего ре-алайнмента карты — вне объёма).

## 8. Вне объёма (YAGNI)

- Инъекция/локальный persist в `AppearanceSettings` (см. §2 — намеренно отвергнуто).
- Публичный роут, i18n, SEO, RBAC-гейтинг.
- Свотч-каталог всех токенов отдельно (матрица контраста уже показывает цвета в паре).
- Инлайн-встраивание three.js карты в motion-секцию (ссылка на `/map`).
- Изменения `package.json` (добавление apca-w3 в deps).

## 9. Риски / заметки

- **APCA-порт может разойтись с apca-w3** → закрыто паритет-тестом (§4).
- **getComputedStyle отдаёт `rgb()`** для color/background-color (резолвит из oklch) — базовое допущение матрицы; если браузер вернёт иной формат (`color(srgb …)`/`oklch(...)`), парсер `rgb()` вернёт null → карточка покажет «—» (без падения). Парсер делаем терпимым.
- **AppearanceSettings пишет реальные prefs** — задокументировано строкой-предупреждением (§2).
- Dev-only: `notFound()` в проде уже стоит в page.tsx; новые секции под тем же гардом.
