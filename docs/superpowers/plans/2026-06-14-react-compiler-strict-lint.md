# React Compiler + строгий ESLint-стек — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Включить runtime React Compiler (Next 16, режим `infer`) и поднять ESLint до строгого индустриального стандарта — `eslint-plugin-react-hooks` recommended-latest (с compiler-правилами), полный `eslint-plugin-react` recommended, jsx-a11y strict, `import/order`, и возврат `no-unnecessary-condition`.

**Architecture:** Foundation-update PR. `babel-plugin-react-compiler` + `reactCompiler: true` в `next.config.ts` (SWC/Turbopack сохраняются — `.babelrc` не добавляем). В `eslint.config.mjs` подключаем выбранные пресеты **через `.rules`** (не спред целых пресет-объектов — иначе `Cannot redefine plugin`, т.к. `eslint-config-next` уже регистрирует плагины `react`/`react-hooks`/`jsx-a11y`/`import`). Сброс накопившихся нарушений: один `--fix`-свип (916 авто-фиксов) + ручные фиксы (~265), сгруппированные по правилу.

**Tech Stack:** Next 16.1.4, React 19.2.3, ESLint 9 flat config, typescript-eslint 8.53, eslint-plugin-react-hooks 7.0.1, pnpm (node-linker=hoisted), Vitest.

**Измерено (read-only прогон пробного конфига по `src/`):** 1208 ошибок в 413/610 файлов; авто-фиксимых 916. Распределение:

| Правило | Кол-во | Авто-фикс | Решение |
|---|---:|---:|---|
| `import/order` | 915 | 901 | `--fix` (c2) |
| `@typescript-eslint/no-unnecessary-condition` | 233 | 0 | ручные (c4) |
| `jsx-a11y/label-has-associated-control` | 24 | 0 | ручные (c3) |
| `react/jsx-no-target-blank` | 15 | 15 | `--fix` (c2) |
| `react/prop-types` | 13 | 0 | **off в конфиге** (TS-проект) |
| прочий `jsx-a11y` хвост | 8 | 0 | ручные (c3) |
| compiler-правила recommended-latest | **0** | — | страховка, текущей цены нет |

---

## Файлы, которые трогаем

- **Create:** worktree-воркспейс (Task 1).
- **Modify:** `next.config.ts` — добавить `reactCompiler: true`.
- **Modify:** `package.json` + `pnpm-lock.yaml` — добавить `babel-plugin-react-compiler` (devDep).
- **Modify:** `eslint.config.mjs` — импорты плагинов + блок новых правил, снять послабление `no-unnecessary-condition`, удалить дублирующий `exhaustive-deps`-блок.
- **Modify (свип):** файлы в `src/**` под `--fix` и ручные фиксы.

**Не трогаем:** `src/api/schema.ts` (в ignore), guardrail-блоки `no-restricted-imports` (×3 + cross-feature), RBAC-хелперы, прочие foundation-зоны кроме перечисленных.

**Правила для параллельных агентов (CLAUDE.md):** никаких `git stash/reset/checkout ./clean`; `git add` — только свои файлы по имени, без `git add -A`/`git add .`; не перезаписывать чужие изменения. Работа в изолированном worktree снимает риск коллизий со свипом на 413 файлов.

---

## Task 1: Изолированный воркспейс + базовый прогон

**Files:**
- Create: git worktree (через `superpowers:using-git-worktrees`)

- [ ] **Step 1: Создать изолированный worktree**

Использовать skill `superpowers:using-git-worktrees`, ветка `foundation/react-compiler-strict-lint`. Свип затрагивает 413 файлов — изоляция от main с параллельными агентами обязательна.

- [ ] **Step 2: Установить зависимости в worktree**

pnpm под `node-linker=hoisted` требует свой `node_modules` в worktree.

Run: `pnpm install`
Expected: установка из глобального стора (hardlinks), без ошибок (про `unrs-resolver` skip — это норма, см. `package.json`).

- [ ] **Step 3: Базовый прогон — убедиться, что старт зелёный**

Run: `pnpm lint`
Expected: 0 ошибок (предыдущий strict-preset PR уже зелёный).

Run: `pnpm test`
Expected: PASS.

Если базовый `pnpm lint`/`pnpm test` НЕ зелёный — остановиться: значит дерево не в том состоянии, сначала разобраться с этим.

---

## Task 2: React Compiler (runtime)

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Modify: `next.config.ts`

- [ ] **Step 1: Установить babel-plugin-react-compiler**

Run: `pnpm add -D babel-plugin-react-compiler`
Expected: добавляется в `devDependencies`, обновляется lockfile. (React 19.2 — рантайм встроен, `react-compiler-runtime` НЕ нужен.)

- [ ] **Step 2: Включить reactCompiler в next.config.ts**

Открыть `next.config.ts`, добавить `reactCompiler: true` на верхний уровень (НЕ в `experimental`). Итог:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    // Включает forbidden() / unauthorized() из next/navigation.
    // Используется в src/app/admin/layout.tsx для гейта по canAccessAdmin.
    // По состоянию на Next 16.1.4 — всё ещё experimental.
    authInterrupts: true,
  },
};

export default nextConfig;
```

- [ ] **Step 3: Сборка — компилятор включается без ошибок**

Run: `pnpm build`
Expected: успешная сборка. Если `babel-plugin-react-compiler` не установлен — сборка падает с "Cannot find module"; здесь должна пройти. (Билд может быть чуть медленнее — Next прогоняет Babel-плагин по релевантным файлам через SWC-оптимизацию; Turbopack/SWC сохраняются.)

- [ ] **Step 4: Подтвердить, что компилятор реально активен**

Run: `grep -rl "useMemoCache\|react/compiler-runtime" .next/server .next/static 2>/dev/null | head -3`
Expected: ≥1 файл. React Compiler эмитит memo-cache (`useMemoCache` / импорт `react/compiler-runtime`) в скомпилированных компонентах. Пусто → компилятор не активировался, разобраться (проверить, что опция `reactCompiler` на верхнем уровне и плагин установлен).

- [ ] **Step 5: Smoke dev-сервера**

Run: `pnpm dev` (порт 3001), дождаться "Ready", открыть `http://localhost:3001`, проверить отсутствие ошибок компиляции/гидрации в консоли, остановить.
Expected: страница рендерится, в консоли нет ошибок от компилятора.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml next.config.ts
git commit -m "feat(build): enable React Compiler (Next 16, infer mode)

- add babel-plugin-react-compiler (devDep)
- reactCompiler: true in next.config.ts (SWC/Turbopack preserved)"
```

---

## Task 3: ESLint-конфиг — строгие пресеты

**Files:**
- Modify: `eslint.config.mjs`

Это «c1» из spec для lint-части. Коммит намеренно делает `pnpm lint` красным (~1208 ошибок) — свип чинит их в Task 4–5. Финальный зелёный гейт — Task 6.

- [ ] **Step 1: Добавить импорты плагинов**

В начало `eslint.config.mjs`, под существующие импорты:

```js
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import jsxA11y from "eslint-plugin-jsx-a11y";
```

(Эти плагины уже стоят транзитивно через `eslint-config-next` и резолвятся под `node-linker=hoisted`. Явными devDeps их НЕ объявляем — пины рискуют развести версии → два инстанса → `Cannot redefine plugin`.)

- [ ] **Step 2: Снять послабление `no-unnecessary-condition`**

В блоке «Осознанные послабления к strict» удалить строку `"@typescript-eslint/no-unnecessary-condition": "off",` вместе с её 4-строчным комментарием (`// off: ...` … `// Альтернатива на будущее: ...`). Правило вернётся к `error` из `strictTypeChecked` (флаг `noUncheckedIndexedAccess`, на который ссылался комментарий, уже включён в tsconfig). Блок после правки:

```js
  // Осознанные послабления к strict — см.
  // docs/superpowers/specs/2026-06-14-eslint-strict-preset-design.md
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // числа и булевы в шаблонных строках — норм; защита от ${object}/${null} остаётся.
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true, allowBoolean: true },
      ],
      // intentional-discard convention: `_`-prefixed vars/args are deliberately unused.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
```

- [ ] **Step 3: Удалить дублирующий exhaustive-deps-блок**

Удалить целиком:

```js
  {
    rules: {
      "react-hooks/exhaustive-deps": "error",
    },
  },
```

`recommended-latest` (Step 4) уже даёт `react-hooks/exhaustive-deps: "error"` — это дубль (по аналогии с тем, как прошлый PR убрал дублирующий `no-floating-promises`).

- [ ] **Step 4: Добавить блок строгих React/a11y/import правил**

Вставить сразу после блока послаблений (перед guardrail-блоками). **Только `.rules`** — плагины уже зарегистрированы next-ом:

```js
  // Строгий React-стек. Плагины (react, react-hooks, jsx-a11y, import) уже
  // зарегистрированы eslint-config-next, поэтому подключаем ТОЛЬКО .rules выбранных
  // пресетов — спред целого пресет-объекта даёт "Cannot redefine plugin".
  {
    files: ["src/**/*.{ts,tsx}"],
    settings: { react: { version: "detect" } },
    rules: {
      // eslint-plugin-react-hooks recommended-latest: rules-of-hooks + exhaustive-deps (error)
      // + compiler-powered правила (set-state-in-effect, immutability, purity, refs, …).
      ...reactHooks.configs.flat["recommended-latest"].rules,
      // eslint-plugin-react recommended + jsx-runtime (off react-in-jsx-scope для Next).
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      // prop-types не нужен в TS-проекте — валидацию пропсов даёт typescript.
      "react/prop-types": "off",
      // jsx-a11y strict.
      ...jsxA11y.flatConfigs.strict.rules,
      // import-гигиена.
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
      "import/no-duplicates": "error",
    },
  },
```

- [ ] **Step 5: Проверить, что конфиг ЗАГРУЖАЕТСЯ (нет redefine-plugin краха)**

Run: `pnpm exec eslint src/app/layout.tsx`
Expected: команда отрабатывает (выводит ошибки правил или ничего), НЕ падает с `ConfigError: Cannot redefine plugin`. Если всплыл redefine — значит где-то остался спред целого пресета вместо `.rules`; исправить.

- [ ] **Step 6: Зафиксировать объём (sanity-чек измерения)**

Run: `pnpm lint 2>&1 | tail -5`
Expected: ~1208 problems (порядок совпадает с замером). Это ожидаемый красный — чиним в Task 4–5.

- [ ] **Step 7: Commit**

```bash
git add eslint.config.mjs
git commit -m "feat(lint): strict React/a11y/import preset + restore no-unnecessary-condition

- eslint-plugin-react-hooks recommended-latest (compiler rules)
- eslint-plugin-react recommended + jsx-runtime (prop-types off for TS)
- jsx-a11y strict; import/order + no-duplicates
- drop no-unnecessary-condition relaxation; drop duplicate exhaustive-deps
- rules-only wiring (plugins already registered by eslint-config-next)"
```

---

## Task 4: Авто-фикс свип (`--fix`)

**Files:**
- Modify (механически): файлы в `src/**` с `import/order` и `react/jsx-no-target-blank`.

- [ ] **Step 1: Прогнать авто-фикс**

Run: `pnpm exec eslint src/ --fix`
Expected: ~916 ошибок авто-фиксятся (import/order переупорядочивает импорты, jsx-no-target-blank добавляет `rel="noreferrer"`). Останется ~292 ручных.

- [ ] **Step 2: Проверить, что side-effect импорты не уехали**

`import/order` по умолчанию не переставляет side-effect (unassigned) импорты, но проверяем критичные:

Run: `grep -rn 'import "server-only"' src/features/*/api.ts src/features/*/actions.ts src/features/*/permissions.ts src/features/*/schemas.ts | head`
Expected: `import "server-only"` остаётся **первой** строкой импортов в server-only файлах. Если где-то уехал ниже — вернуть наверх вручную.

- [ ] **Step 3: Тесты + сборка (ловим семантические сдвиги авто-фикса)**

Run: `pnpm test`
Expected: PASS.

Run: `pnpm build`
Expected: успешно.

Если тест/сборка упали из-за переупорядочивания импортов (например, нарушился порядок side-effect/полифилл-импорта) — починить точечно, перепрогнать.

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "style(lint): apply eslint --fix sweep (import/order, jsx-no-target-blank)

mechanical auto-fix only, no logic changes; test+build green"
```

(В изолированном worktree `git add src/` безопасен — чужих файлов нет.)

---

## Task 5: Ручные фиксы — jsx-a11y (~32)

**Files:**
- Modify: файлы с jsx-a11y-нарушениями (список — из `pnpm lint`).

- [ ] **Step 1: Получить список jsx-a11y нарушений**

Run: `pnpm lint 2>&1 | grep -E 'jsx-a11y' | sort | uniq -c | sort -rn`
Также: `pnpm exec eslint src/ -f compact 2>&1 | grep 'jsx-a11y'` — даст файлы:строки.

- [ ] **Step 2: Починить `label-has-associated-control` (24)**

Каждый `<label>` должен быть связан с контролом — либо обёрткой, либо `htmlFor`/`id`. Пример:

```tsx
// было
<label>Имя</label>
<input name="name" />

// стало (вариант с htmlFor/id)
<label htmlFor="name">Имя</label>
<input id="name" name="name" />

// или обёрткой
<label>
  Имя
  <input name="name" />
</label>
```

Если в проекте есть UI-обёртка над полями формы (Base UI Form) — связывание может уже идти через неё; тогда правка точечная по конкретным сайтам из lint.

- [ ] **Step 3: Починить хвост jsx-a11y (~8)**

- `media-has-caption` (2): к `<video>/<audio>` добавить `<track kind="captions">`; если контента-капшенов нет и это осознанно — `<track kind="captions" />` пустой трек либо точечный disable с обоснованием (НЕ массово).
- `no-noninteractive-element-to-interactive-role` (2): не вешать интерактивный `role` на неинтерактивный элемент — заменить элемент на `<button>`/корректный.
- `no-static-element-interactions` (1) / `no-noninteractive-tabindex` (1): интерактив на `<div>` → заменить на `<button>` или добавить корректную семантику/роль+обработчики клавиатуры.
- `no-autofocus` (1): убрать `autoFocus`; если фокус нужен — управлять через `ref` в эффекте.
- `anchor-has-content` (1): у `<a>` должен быть текст/`aria-label`.

- [ ] **Step 4: Проверить jsx-a11y чисто**

Run: `pnpm lint 2>&1 | grep -c 'jsx-a11y'`
Expected: 0.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "fix(a11y): resolve jsx-a11y strict violations"
```

---

## Task 6: Ручные фиксы — `no-unnecessary-condition` (233)

**Files:**
- Modify: файлы с `no-unnecessary-condition` (список — из `pnpm lint`).

> Самый объёмный ручной класс. Правило флагует условия, которые TS считает всегда истинными/ложными. Часть — реальные мёртвые проверки (чинить удалением), часть — defensive-проверки на границе с API, где TS-тип обещает поле, а рантайм может его не дать.

- [ ] **Step 1: Получить список по файлам**

Run: `pnpm exec eslint src/ -f compact 2>&1 | grep 'no-unnecessary-condition'`

- [ ] **Step 2: Чинить по слайсу/файлу, корректным способом (не disable-мусором)**

Для каждого сайта выбрать корректный фикс:

```ts
// (a) Условие реально мёртвое (тип уже исключает ветку) → удалить проверку.
// было: if (user && user.name) {...}  // user уже non-nullable
// стало: if (user.name) {...}

// (b) Лишний ?. / ?? на non-nullable → упростить.
// было: items?.length ?? 0   // items: T[] (не optional)
// стало: items.length

// (c) Defensive-проверка на границе с API, где тип врёт (поле фактически optional):
//     ПРАВИЛЬНО — сделать тип честным (optional) у источника, проверка станет нужной.
//     schema.ts не трогаем (regen-зона) — править там, где описывается доменный тип/маппинг.
//     Только если честный тип невозможен здесь — точечный
//     // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- <причина: рантайм-ответ API может не содержать поле>
```

Группировать коммиты по слайсу/директории для читаемости ревью (несколько коммитов c4a, c4b, …).

- [ ] **Step 3: Escape hatch при неподъёмном объёме**

Если значимая доля 233 — легитимные API-boundary проверки, требующие нетривиального исправления типов (выходит за foundation-PR): НЕ рассыпать disable. Вместо этого — оставить правило `"error"`, а конкретный класс вынести в follow-up, временно понизив ТОЛЬКО его до `"warn"` с явным комментарием-долгом в `eslint.config.mjs`. Решение принимается по факту и согласуется (см. handoff).

- [ ] **Step 4: Проверить чисто**

Run: `pnpm lint 2>&1 | grep -c 'no-unnecessary-condition'`
Expected: 0 (или: только осознанно вынесенный в follow-up `warn`-класс, если так решили в Step 3).

- [ ] **Step 5: Commit (по слайсам)**

```bash
git add src/<слайс>
git commit -m "fix(types): remove unnecessary conditions in <слайс>"
```

---

## Task 7: Финальный гейт + готовность к PR

- [ ] **Step 1: Полный зелёный гейт (CLAUDE.md)**

Run: `pnpm lint`
Expected: 0 ошибок.

Run: `pnpm test`
Expected: PASS.

Run: `pnpm build`
Expected: успешно.

- [ ] **Step 2: Подтвердить, что React Compiler активен в финальной сборке**

Run: `grep -rl "useMemoCache\|react/compiler-runtime" .next/server .next/static 2>/dev/null | head -3`
Expected: ≥1 файл.

- [ ] **Step 3: Сверить с критериями готовности spec**

Открыть [docs/superpowers/specs/2026-06-14-react-compiler-strict-lint-design.md](docs/superpowers/specs/2026-06-14-react-compiler-strict-lint-design.md) → пройти «Критерии готовности». Подтвердить: новых явных devDeps кроме `babel-plugin-react-compiler` нет; guardrail-блоки не тронуты.

- [ ] **Step 4: Свести коммиты в обзор**

Run: `git log --oneline main..HEAD`
Expected: ряд коммитов (React Compiler → lint config → --fix → a11y → no-unnecessary-condition).

- [ ] **Step 5: Хендофф пользователю**

PR/push НЕ делаем без явного запроса (push жёстко заблокирован). Сообщить пользователю: ветка готова, гейт зелёный, объём правок, и спросить про создание PR / мердж. При желании — `superpowers:finishing-a-development-branch`.

---

## Self-review заметки

- **Spec coverage:** React Compiler runtime (Task 2) ✓; recommended-latest (Task 3 Step 4) ✓; eslint-plugin-react recommended+jsx-runtime (Task 3 Step 4) ✓; jsx-a11y strict (Task 3 + Task 5) ✓; import/order + no-duplicates (Task 3 + Task 4) ✓; no-unnecessary-condition восстановление (Task 3 Step 2 + Task 6) ✓; только babel-plugin-react-compiler как новый dep (Task 2) ✓; guardrails не тронуты (явно отмечено) ✓.
- **Redefine-plugin риск:** закрыт `.rules`-подходом, проверено пробным прогоном; Task 3 Step 5 — явная проверка загрузки.
- **prop-types (13):** решён конфигом (off), не попадает в ручной хвост.
- **Side-effect импорты при `--fix`:** Task 4 Step 2 — явная проверка `server-only`; Task 4 Step 3 — test+build гейт.
