# CI-гейт + import/no-cycle + тест-линт

- **Дата:** 2026-06-14
- **Тип:** foundation-update (CI, `eslint.config.mjs`, `package.json` — отдельный PR)
- **Ветка:** `foundation/strict-tooling`
- **Статус:** реализовано, гейт зелёный

## Контекст и проблема

Продолжение foundation-hardening после React Compiler + strict-lint. Три запрошенных пункта:

1. **CI-гейт.** До этого единственный workflow — `deploy.yml` (`workflow_dispatch`, только build). Зелёный
   гейт из CLAUDE.md (`lint && test && build`) держался на честном слове, что при мультиагентной
   разработке (несколько агентов параллельно коммитят в `main`) — главный пробел.
2. **`import/no-cycle`** — запрет циклических зависимостей (критично для слайс-архитектуры).
3. **`eslint-plugin-testing-library` + `eslint-plugin-vitest`** — корректность тестов (87 файлов / 1003 теста).

## Замеры (read-only проба)

- **`import/no-cycle`: 0 нарушений** — слайс-гардрейлы держат архитектуру чистой. Включение бесплатно.
- **testing-library + vitest: 135 нарушений**, из них **115** — `no-node-access` (63) + `no-container` (52),
  **на 100% в `ast-render`/`canvas-render`/`ast-editor`** (тесты рендереров/редактора, где проверка
  DOM-структуры — предмет теста, RTL-queries неприменимы). Остальные **20** — в обычных тестах.
- **`tsc --noEmit`**: нашёл **1 латентную ошибку типов** (`image.test.ts` — `attrs on never`),
  невидимую для `next build`/`vitest` (они не тайпчекают тест-файлы). Ровно ради этого typecheck в CI.

## Решения

### CI (`.github/workflows/ci.yml`)

Триггеры: `pull_request` + push в `main` + `workflow_dispatch`. `concurrency` с `cancel-in-progress`.
Один job `verify` (Node 20, pnpm, кеш) → `install --frozen-lockfile` → **typecheck → lint → test → build**
(fail-fast: дешёвое раньше дорогого). Добавлен скрипт `pnpm typecheck` = `tsc --noEmit`.

### `import/no-cycle`

`["error", { maxDepth: Infinity }]`, в src-блоке. 0 нарушений на текущем коде.

### testing-library/vitest — пресеты + тюнинг под фактический сетап

Подключены `testingLibrary.configs["flat/react"]` и `vitest.configs.recommended` на `*.test.{ts,tsx}`
(спред целых пресетов безопасен — эти плагины не регистрируются `eslint-config-next`). Тюнинг
(каждый — документированное соответствие проекту, НЕ «глушилка»):

- **`no-node-access` + `no-container` → off** для `ast-render`/`canvas-render`/`ast-editor` тестов.
  Это рендерер/редактор-внутренности; проверка DOM-структуры — предмет теста.
- **`no-manual-cleanup` → off** (глобально для тестов). `vitest.config.ts` имеет `globals: false` →
  RTL auto-cleanup НЕ активен → ручной `afterEach(cleanup)` обязателен, а не редундантен.
- **`vitest/valid-expect` → `{ maxArgs: 2 }`**. vitest поддерживает `expect(value, "message")`.
- **`render-result-naming-convention` → off** только для `render-map.test.ts`. `canvasDataToRenderData`
  — доменная map-функция, не RTL `render()`; правило ложно матчит её по «render» в имени.

Все прочие правила (no-focused-tests, no-disabled-tests, valid-title, no-commented-out-tests,
prefer-screen-queries, await-async-queries и т.д.) остаются `error` — основная масса корректностной
ценности активна (в т.ч. превентивно: забытый `.only` теперь упадёт в CI).

### Исправления (20 реальных)

- **`_template` (7)** — закомментированные тест-заготовки → `it.todo(...)` (идиоматичный pending-маркер,
  полезно как стартовая точка шаблона).
- **`canvas-render.test.tsx` (1)** — `const { getByText } = render(...)` → `render(...)` + `screen.getByText`.
- **`image.test.ts` (typecheck)** — сбор узлов в `PMNode[]` + `imageNodes[0]` (`noUncheckedIndexedAccess`
  даёт `PMNode | undefined`), что ломает flow-narrowing к `never` без eslint-disable.

## Критерии готовности

- `.github/workflows/ci.yml` гоняет typecheck/lint/test/build на PR и push в main.
- `import/no-cycle` включён (0 нарушений). testing-library/vitest подключены с задокументированным тюнингом.
- `pnpm typecheck` 0 · `pnpm lint` 0 · `pnpm test` зелёный (1003 passed, 8 todo) · `pnpm build` ✓.
