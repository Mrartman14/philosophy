# Публичная витрина дизайн-системы на `/dev/ui`: APCA + appearance-оси + motion

Дата: 2026-06-21
Статус: design (одобрен пользователем, ждёт ревью спеки)
Тип: публичная страница (на `/dev/ui`) + перенос dev-only smoke-тестов на отдельный роут

## 1. Задача

Живая страница-styleguide, где видно **APCA-контраст** и **оси appearance** (тема/контраст/плотность/шрифт/размер/**motion**) «в действии»: переключаешь ось — мгновенно меняются цвета, пересчитываются числа контраста, глохнут/идут анимации. Страница **доступна в проде** (публичная), на `/dev/ui`.

Текущий `/dev/ui` — это dev-only smoke-витрина компонентов (Buttons/Form/Table/…). Её содержимое **переезжает** на новый dev-only роут, а URL `/dev/ui` отдаётся под публичную дизайн-витрину (решение пользователя: «этот URL оставим, тесты вынесем»).

## 2. Принятые решения

- **Роут витрины:** публичный `/dev/ui` (в проде доступен — `notFound()` снимаем). У `/dev/*` нет layout/middleware-гейта — единственный гард был в самой `page.tsx`.
- **Перенос smoke:** существующее содержимое `/dev/ui` (Buttons/Form/Table/EmptyState/Skeleton/Pagination) переезжает на новый **dev-only** роут `src/app/dev/kit/page.tsx` (с `notFound()` в проде, заголовок «UI Kit smoke»).
- **i18n:** страница публичная → локализуем **ru/en** через новый namespace `design` (фасад `@/i18n` / `@/i18n/client`). Технические литералы (имена токенов, `Lc`, `pass/FAIL`, `Aa`, note-строки пар из данных) НЕ локализуем — это код/данные. SEO-заголовок через `generateMetadata` + `getT("design")`.
- **Контролы осей:** reuse `<AppearanceSettings/>` как есть. Запись реальна; для анонима persist на бэк — no-op (`getMe()` null), пишется только cookie+DOM. Сверху — строка-предупреждение (переформулирована под публичную/анонимную аудиторию: «меняет настройки на этом устройстве, а если вошли — и в аккаунте»).
- **APCA:** живая матрица контраста (27 пар), Lc **вычисляется в браузере БЕЗ внешних зависимостей** (см. §4). `apca-w3`/`culori`/`apcach` — devDependencies; в код страницы их нельзя. `package.json` не трогаем.
- **Motion:** демки «до/после» + бейдж `useReducedMotion()`.

## 3. Архитектура

`src/app/dev/ui/page.tsx` — **публичный server-component** (без `notFound`): `generateMetadata` (i18n title) + секции, рендерящие client-компоненты (страница под root-layout → `AppearanceProvider`/`I18nProvider` доступны). Серверный текст секций — `getT("design")`; клиентские компоненты — `useT("design")`.

Юниты (kebab-case, colocated в `src/app/dev/ui/`):
- `apca-lc.ts` — чистый хелпер CSS-`rgb()` → знаковый APCA Lc. Без зависимостей.
- `apca-matrix.tsx` (`"use client"`) — 27 карточек пар + live-пересчёт Lc. Без i18n (технический контент).
- `motion-showcase.tsx` (`"use client"`) — демки движения + бейдж; текст через `useT("design")`.
- `page.tsx` — оркестрация секций (server) + `generateMetadata`.

Новый namespace `design` (ru+en) регистрируется в `messages/ru/index.ts` и `messages/en/index.ts` (1 импорт + 1 ключ в каждом — стандартная процедура, документирована в шапке `ru/index.ts`). Не server-only → автоматически уходит на клиент через `toClientMessages`.

## 4. Секция APCA — живая матрица контраста

### Источник
`CONTRAST_PAIRS` из [src/styles/tokens/apca-targets.ts](src/styles/tokens/apca-targets.ts): `{ fg: ColorTokenName; bg: ColorTokenName; minLc: number; note: string }` (27 пар). Имя токена `X` → CSS-переменная `--color-X`. **Импорт ТОЛЬКО из `apca-targets`** (чистый модуль), НЕ из `@/styles/tokens` (индекс тянет `apcach`/`culori` в бандл).

### Вычисление Lc без внешних депов
1. На пару — карточка-образец: контейнер `background: var(--color-<bg>)`, текст `color: var(--color-<fg>)`.
2. `getComputedStyle(el)` отдаёт `color`/`backgroundColor` резолвнутыми в `rgb()` (даже из oklch-токенов) → culori не нужен; парсим `rgb()` регуляркой.
3. `apca-lc.ts` считает Lc: `srgbToY([r,g,b])` (линеаризация ^2.4 + веса) → `apcaContrast(txtY, bgY)` (порт APCA-W3 SA98G). Знаковый Lc.
4. Карточка: образец, `|Lc|`, целевой `minLc`, бейдж **pass/FAIL** (`Math.abs(Lc) >= minLc` — как CI-гард), `note`.

### Реактивность
`useEffect` по `appearance.theme`/`appearance.contrast` (из `useAppearance`) + подписка на `matchMedia('(prefers-color-scheme: dark)')`/`'(prefers-contrast: more)'` (для `system`/`auto`). Чтение через refs на отрендеренных карточках. До гидрации — «—».

### Паритет с гардом
`apca-lc.test.ts` сверяет `apca-lc.ts` с `apca-w3` (devDep, **только в тесте**) + знаковые значения (бел-на-чёрн ≈ −108, чёрн-на-бел ≈ 106). Гарантирует совпадение с CI-гардом ([apca.test.ts](src/styles/tokens/apca.test.ts)).

## 5. Секция Motion — «в действии»

Бейдж `useReducedMotion()` («Reduced motion: ДА/НЕТ» + подсказка). Демки (текст — `useT("design")`):
- **Skeleton** (`<Skeleton/>`) — пульс глохнет (глобальный `animation: none`).
- **Keyframe-бокс** (`animate-spin`) — подавление любой keyframe-анимации.
- **fancy-link** — стрелка едет на hover vs замирает.
- **Base UI `<Dialog>`** — opacity-fade при открытии **остаётся** (нюансная политика: `transition` не глушим).
- **Ссылка на `/map`** — инерция камеры three.js (инлайн не встраиваем).

## 6. Файлы

- Create: `src/app/dev/kit/page.tsx` — перенос текущего содержимого `/dev/ui` (dev-only, `notFound`).
- Modify: `src/app/dev/ui/page.tsx` — публичная витрина: убрать `notFound`, `generateMetadata`, секции (warning + `<AppearanceSettings/>`, `<ApcaMatrix/>`, `<MotionShowcase/>`), `getT("design")`.
- Create: `src/app/dev/ui/apca-lc.ts`, `apca-lc.test.ts`, `apca-matrix.tsx`, `motion-showcase.tsx`.
- Create: `src/i18n/messages/ru/design.ts`, `src/i18n/messages/en/design.ts`.
- Modify: `src/i18n/messages/ru/index.ts`, `src/i18n/messages/en/index.ts` — регистрация `design`.
- Reuse: `<AppearanceSettings/>`, `Skeleton`/`Dialog`/`Button`, `CONTRAST_PAIRS`/`ColorTokenName`, `useReducedMotion`/`useAppearance`.
- **НЕ трогаем:** `package.json`, `src/components/appearance/*`, `src/styles/*`, токены, провайдер.

## 7. Тестирование

- `apca-lc.test.ts` — паритет с `apca-w3` + знаковые значения (главный тест).
- i18n parity: `messages.test.ts` + `icu-parity.test.ts` должны проходить с новым `design` (ru/en структурно идентичны).
- Матрица/motion — без юнит-тестов (jsdom не вычисляет getComputedStyle-цвета); Lc-логика покрыта `apca-lc.test.ts`, остальное — ручная dev-проверка.
- Ручная проверка: `/dev/ui` доступен (в т.ч. как аноним), переключение осей пересчитывает матрицу/гасит анимации; `/dev/kit` отдаёт smoke-витрину в dev и `notFound` в проде; en-локаль показывает английский текст.
- Зелёные: `pnpm lint && pnpm test` (на затронутых; полный build может быть красным из-за пред-существующего ре-алайнмента карты — вне объёма).

## 8. Вне объёма (YAGNI)

- Инъекция/локальный persist в `AppearanceSettings` (отвергнуто ранее: persist ортогонален эффекту).
- Свотч-каталог всех токенов отдельно (матрица уже показывает цвета в паре).
- Инлайн three.js карты в motion-секцию (ссылка на `/map`).
- Изменения `package.json`.
- Добавление `/dev/ui` в навигацию/бэкендный sitemap (достижима по URL; не индексируем специально).

## 9. Риски / заметки

- **APCA-порт может разойтись с apca-w3** → паритет-тест (§4).
- **getComputedStyle отдаёт `rgb()`** для color/background — базовое допущение; нестандартный формат → парсер вернёт null → карточка «—» (без падения). Парсер терпимый.
- **Публичный URL «/dev/ui»** семантически странный для прод-страницы, но оставлен по явному решению пользователя.
- **AppearanceSettings пишет реальные prefs** (аноним — только cookie) — переформулированное предупреждение в шапке.
- **Перенос smoke** не должен сломать ссылки: проверить, что на `/dev/ui` нет внешних ссылок в коде, кроме самого smoke (Pagination `basePath="/dev/ui"` в переносимом коде → поправить на `/dev/kit`).
