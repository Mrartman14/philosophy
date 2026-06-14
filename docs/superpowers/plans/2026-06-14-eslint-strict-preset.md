# ESLint Strict Type-Aware Preset — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Включить строжайший официальный type-aware набор `typescript-eslint`
(`strictTypeChecked` + `stylisticTypeChecked`) поверх `eslint-config-next`, с двумя
задокументированными послаблениями, и привести `src/` к зелёному `pnpm lint`.

**Architecture:** Расширяем существующий flat-config `eslint.config.mjs` (запретная зона →
отдельный foundation-PR). Сначала включаем конфиг (c1), затем механический `eslint --fix` (c2),
затем ручные фиксы по правилам (c3…). Никаких изменений тулчейна — `typescript-eslint` 8.53 и
ESLint 9 уже установлены.

**Tech Stack:** ESLint 9 (flat config), typescript-eslint 8.53, eslint-config-next 16.1.4,
pnpm 8.14 (НЕ npm), Next 16 / React 19.

**Спека:** [docs/superpowers/specs/2026-06-14-eslint-strict-preset-design.md](../specs/2026-06-14-eslint-strict-preset-design.md)

---

## Адаптация TDD под lint-работу

Здесь нет фич с юнит-тестами — «тест» это сам линтер. Каждая задача идёт по циклу:
**RED** (eslint показывает N ошибок правила) → фикс → **GREEN** (eslint показывает 0) →
**регрессия** (`pnpm test` + `pnpm build` зелёные) → **commit**.

Цифры срабатываний ниже — замер на момент спеки (дерево в работе). К моменту исполнения они
сдвинутся. Критерий GREEN всегда «0 для этого правила», а не «починить ровно N».

**Хелпер для подсчёта одного правила** (понадобится в каждой ручной задаче):

```bash
pnpm exec eslint src/ 2>&1 | grep -c '@typescript-eslint/no-deprecated'
# подставляй нужный rule-id; stylish-вывод eslint печатает rule-id в конце каждой строки
```

**Хелпер — список файлов с этим правилом:**

```bash
pnpm exec eslint src/ 2>&1 | grep -B999 '@typescript-eslint/no-deprecated' >/dev/null; \
pnpm exec eslint src/ -f json 2>/dev/null \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const r=JSON.parse(d);const s=new Set();for(const f of r)for(const m of f.messages)if(m.ruleId==='@typescript-eslint/no-deprecated')s.add(f.filePath);[...s].forEach(p=>console.log(p))})"
```

---

## Предусловия (проверить ПЕРЕД Task 1)

- [ ] **Рабочее дерево чистое.** `git status --porcelain` пусто (весь in-flight параллельных
      агентов закоммичен). Если НЕ пусто — **СТОП**, исполнять нельзя: свип на сотни файлов
      поверх чужой незакоммиченной работы даст нечитаемый diff и коллизии. Дождаться чистого
      дерева.
- [ ] Мы на актуальном `main`: `git pull --ff-only` (или эквивалент). Push/force — запрещены.

---

## Task 1: Ветка + строгий конфиг (c1)

**Files:**
- Modify: `eslint.config.mjs` (целиком — см. ниже)

- [ ] **Step 1: Создать ветку**

```bash
git switch -c foundation/eslint-strict
```

- [ ] **Step 2: Зафиксировать RED-базу (сколько ошибок сейчас — ноль, конфиг ещё старый)**

Run: `pnpm exec eslint src/ 2>&1 | tail -3`
Expected: текущий конфиг проходит без ошибок (или с уже известными). Запомнить — это «до».

- [ ] **Step 3: Переписать `eslint.config.mjs`**

Полное содержимое файла:

```js
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // Строжайший официальный type-aware набор typescript-eslint, scoped на исходники.
  // no-floating-promises входит сюда — отдельное правило больше не нужно.
  ...tseslint.configs.strictTypeChecked.map((c) => ({
    ...c,
    files: ["src/**/*.{ts,tsx}"],
  })),
  ...tseslint.configs.stylisticTypeChecked.map((c) => ({
    ...c,
    files: ["src/**/*.{ts,tsx}"],
  })),
  // Осознанные послабления к strict — см.
  // docs/superpowers/specs/2026-06-14-eslint-strict-preset-design.md
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // off: значительная часть срабатываний — легитимные defensive-проверки на границе
      // с бекенд-API (тип обещает поле, рантайм-ответ может его не содержать). Чище
      // отключить целиком, чем рассыпать eslint-disable по коду.
      // Альтернатива на будущее: включить noUncheckedIndexedAccess в tsconfig и вернуть правило.
      "@typescript-eslint/no-unnecessary-condition": "off",
      // числа и булевы в шаблонных строках — норм; защита от ${object}/${null} остаётся.
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true, allowBoolean: true },
      ],
    },
  },
  {
    rules: {
      "react-hooks/exhaustive-deps": "error",
    },
  },
  // Guardrail 1: deep-imports into other features must go through their index.ts
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/features/*/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/!(index)", "@/features/*/*/**"],
              message: "Импортируй фичу через её index.ts (@/features/<entity>).",
            },
          ],
        },
      ],
    },
  },
  // Guardrail 2: cross-feature imports forbidden
  {
    files: ["src/features/*/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*"],
              message:
                "Cross-feature импорты запрещены. Данные ходят через бекенд, общий код — через @/components, @/utils, @/hooks.",
            },
          ],
        },
      ],
    },
  },
  // Guardrail 3: server-only files in slices shouldn't import client-only packages
  {
    files: [
      "src/features/*/api.ts",
      "src/features/*/actions.ts",
      "src/features/*/permissions.ts",
      "src/features/*/schemas.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-dom/client",
              message: "Этот файл server-only. Используй import \"server-only\" в начале файла.",
            },
          ],
        },
      ],
    },
  },
  // Type-aware правила нельзя гонять на файлах вне tsconfig (конфиги, скрипты).
  {
    ...tseslint.configs.disableTypeChecked,
    files: ["**/*.{js,mjs,cjs}"],
  },
];

export default eslintConfig;
```

- [ ] **Step 4: Проверить, что конфиг загружается и strict активен (RED ожидаем)**

Run: `pnpm exec eslint src/ 2>&1 | tail -3`
Expected: теперь МНОГО ошибок (`✖ NNNN problems`). Это ожидаемо — лечим в c2/c3.
Если вместо ошибок линтинга падает сам ESLint (parse/config error) — чинить конфиг, не код.

- [ ] **Step 5: Коммит конфига**

> Между c1 и финалом `pnpm lint` намеренно красный. Это нормально на feature-ветке —
> бинарный гейт проверяется только перед PR (Task 8).

```bash
git add eslint.config.mjs
git commit -m "build(eslint): enable strictTypeChecked + stylisticTypeChecked (c1 config only)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Авто-фикс сейф (c2)

**Files:**
- Modify: множество `src/**/*.{ts,tsx}` (механически, через `eslint --fix`)

- [ ] **Step 1: RED — сколько авто-фиксимых ошибок сейчас**

Run: `pnpm exec eslint src/ 2>&1 | tail -3`
Expected: `✖ NNNN problems (NNNN errors, 0 warnings) — MMMM errors potentially fixable with --fix`.
Запомнить MMMM (≈1375 на момент спеки).

- [ ] **Step 2: Прогнать авто-фикс**

Run: `pnpm exec eslint src/ --fix`
Это поправит механику: `Record<K,V>`-стиль (consistent-indexed-object-style),
`no-confusing-void-expression`, `prefer-nullish-coalescing` (безопасные),
`prefer-optional-chain`, `dot-notation`, `array-type`, `consistent-type-definitions`.

- [ ] **Step 3: GREEN-частично — подтвердить, что осталось только ручное**

Run: `pnpm exec eslint src/ 2>&1 | tail -3`
Expected: число упало до ручного хвоста (≈250–300), `0 errors potentially fixable with --fix`.

- [ ] **Step 4: РЕГРЕССИЯ — авто-фикс мог сдвинуть семантику, ловим тестами и сборкой**

Run: `pnpm test`
Expected: все тесты зелёные.

Run: `pnpm build`
Expected: успешная сборка.

> Если что-то упало: авто-фиксы `no-confusing-void-expression` (стрелочные с неявным return) и
> `prefer-nullish-coalescing` (`||`→`??`) изредка меняют поведение. Найти регрессию через
> `git diff`, откатить точечно проблемный участок руками (не весь `--fix`), вернуть тесты в зелёное.

- [ ] **Step 5: Коммит механического свипа отдельно**

```bash
git add -u src/
git commit -m "style(eslint): apply autofixable strict/stylistic fixes (c2, mechanical)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `no-deprecated` (≈102)

Самая содержательная группа: каждое срабатывание — вызов API, помеченного `@deprecated`.

**Files:** разные `src/**` — определить хелпером со списком файлов (см. шапку).

- [ ] **Step 1: RED + триаж по символам**

Run: `pnpm exec eslint src/ 2>&1 | grep '@typescript-eslint/no-deprecated' | wc -l`
Затем сгруппировать по тому, ЧТО задеприкейчено:

```bash
pnpm exec eslint src/ -f json 2>/dev/null \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const r=JSON.parse(d);const m={};for(const f of r)for(const x of f.messages)if(x.ruleId==='@typescript-eslint/no-deprecated'){const k=(x.message.match(/\`([^\`]+)\`/)||[])[1]||x.message;m[k]=(m[k]||0)+1}Object.entries(m).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(String(v).padStart(4),k))})"
```

- [ ] **Step 2: Фиксить по символу**

Для каждого депрекейта: открыть определение символа, прочитать его JSDoc `@deprecated` —
там указана замена. Заменить вызов на актуальный API.

Паттерн (пример формы — конкретная замена берётся из `@deprecated`-ноты символа):

```ts
// RED: используется устаревший API
element.substr(0, 3);
// GREEN: замена из JSDoc
element.substring(0, 3);
```

> Если какой-то символ задеприкейчен массово и замена нетривиальна (требует рефактора) —
> НЕ растягивать этот PR: вынести в follow-up, временно отключив правило ТОЧЕЧНО для затронутого
> символа через `eslint-disable-next-line @typescript-eslint/no-deprecated` с TODO-ссылкой на
> follow-up. Решение принимать по факту объёма.

- [ ] **Step 3: GREEN**

Run: `pnpm exec eslint src/ 2>&1 | grep -c '@typescript-eslint/no-deprecated'`
Expected: `0`.

- [ ] **Step 4: Регрессия + коммит**

```bash
pnpm test && pnpm build
git add -u src/
git commit -m "refactor(eslint): replace deprecated API usages (no-deprecated)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `no-non-null-assertion` (≈56)

Каждый `foo!` — потенциальный рантайм-краш, спрятанный от типов.

- [ ] **Step 1: RED**

Run: `pnpm exec eslint src/ 2>&1 | grep -c '@typescript-eslint/no-non-null-assertion'`

- [ ] **Step 2: Фиксить по паттернам**

```ts
// RED: уверенное «точно не null»
const id = params.get("id")!;
doStuff(id);

// GREEN, вариант A — явный guard (когда null действительно невозможен по инварианту):
const id = params.get("id");
if (id === null) throw new Error("id обязателен");
doStuff(id);

// GREEN, вариант B — optional chaining / fallback (когда null допустим):
const id = params.get("id") ?? "";
```

```tsx
// RED: ref/DOM
inputRef.current!.focus();
// GREEN:
inputRef.current?.focus();
```

- [ ] **Step 3: GREEN**

Run: `pnpm exec eslint src/ 2>&1 | grep -c '@typescript-eslint/no-non-null-assertion'`
Expected: `0`.

- [ ] **Step 4: Регрессия + коммит**

```bash
pnpm test && pnpm build
git add -u src/
git commit -m "refactor(eslint): remove non-null assertions (no-non-null-assertion)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `require-await` (≈37)

`async`-функция без единого `await`.

- [ ] **Step 1: RED**

Run: `pnpm exec eslint src/ 2>&1 | grep -c '@typescript-eslint/require-await'`

- [ ] **Step 2: Фиксить по паттернам**

```ts
// RED: async без await
async function loadLabel() {
  return "static";
}
// GREEN, вариант A — снять async (вызывающий код может await-ить и не-Promise, это легально):
function loadLabel() {
  return "static";
}

// GREEN, вариант B — если внутри есть забытый await (частый настоящий баг!):
async function loadLabel() {
  return await fetchLabel(); // был fetchLabel() без await
}
```

> Если функция обязана возвращать Promise по контракту интерфейса/сигнатуры (например, хендлер,
> чей тип `() => Promise<void>`) — оставить `async` нельзя без await, поэтому менять сигнатуру/тип
> либо обернуть тело так, чтобы await был осмысленным. Не добавлять `await Promise.resolve()`
> ради обхода правила.

- [ ] **Step 3: GREEN**

Run: `pnpm exec eslint src/ 2>&1 | grep -c '@typescript-eslint/require-await'`
Expected: `0`.

- [ ] **Step 4: Регрессия + коммит**

```bash
pnpm test && pnpm build
git add -u src/
git commit -m "refactor(eslint): drop redundant async / fix missing await (require-await)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `prefer-nullish-coalescing` (ручной хвост, ≈21)

Авто-фикс снял безопасные; остались места, где `||`→`??` меняет смысл и нужно решение.

- [ ] **Step 1: RED**

Run: `pnpm exec eslint src/ 2>&1 | grep -c '@typescript-eslint/prefer-nullish-coalescing'`

- [ ] **Step 2: Фиксить осознанно**

```ts
// RED: || c falsy-валидными значениями
const limit = input.limit || 20;
// GREEN, если 0 — валидный limit (нужен только для null/undefined):
const limit = input.limit ?? 20;
// НО если 0 должен схлопываться в дефолт (например, 0 == «не задано») — оставить ||
// и подавить точечно с комментом-почему:
// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- 0 трактуем как «не задано»
const limit = input.limit || 20;
```

- [ ] **Step 3: GREEN**

Run: `pnpm exec eslint src/ 2>&1 | grep -c '@typescript-eslint/prefer-nullish-coalescing'`
Expected: `0`.

- [ ] **Step 4: Регрессия + коммит**

```bash
pnpm test && pnpm build
git add -u src/
git commit -m "refactor(eslint): nullish coalescing where semantics-safe (prefer-nullish-coalescing)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Type-safety хвост (`no-base-to-string`, `no-misused-promises`, `no-unsafe-*`, прочее)

Сюда же: `use-unknown-in-catch-callback-variable`, `no-invalid-void-type`,
`no-confusing-void-expression` (6 не-автофиксимых), `no-empty-function`,
`no-dynamic-delete`, `no-redundant-type-constituents`, `no-unused-vars` и любой остаток.

- [ ] **Step 1: RED — полный остаток после Task 3–6**

Run:
```bash
pnpm exec eslint src/ -f json 2>/dev/null \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const r=JSON.parse(d);const m={};for(const f of r)for(const x of f.messages){const k=x.ruleId||'?';m[k]=(m[k]||0)+1}Object.entries(m).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(String(v).padStart(4),k))})"
```
Expected: список оставшихся правил с количествами.

- [ ] **Step 2: Фиксить по паттернам**

```tsx
// no-misused-promises: async-хендлер там, где ждут void
<button onClick={handleSave}>            // RED, handleSave: () => Promise<void>
<button onClick={() => void handleSave()}>  // GREEN
```

```ts
// no-base-to-string: объект без осмысленного toString попадает в строку
throw new Error(`Не удалось: ${err}`);            // RED, err: object
throw new Error(`Не удалось: ${JSON.stringify(err)}`);  // GREEN
// или взять конкретное поле: `${err.message}`
```

```ts
// no-unsafe-assignment / -call / -member-access: источник any (часто JSON.parse / нетипизир. ответ)
const data = JSON.parse(raw);          // RED, data: any
const data = JSON.parse(raw) as Foo;   // GREEN: явный тип/валидация (лучше — zod-парс, если в слайсе уже есть схемы)
```

```ts
// use-unknown-in-catch-callback-variable
promise.catch((e) => log(e));               // RED, e: any
promise.catch((e: unknown) => log(e));      // GREEN
```

> Подход: гнать Step 1 повторно, брать верхнее правило из остатка, чинить его до нуля, повторять,
> пока список не опустеет. Каждое правило коммитить отдельно (читаемость ревью) ИЛИ одним коммитом
> «type-safety tail» — на усмотрение исполнителя, если объём маленький.

- [ ] **Step 3: GREEN — остаток пуст**

Run: `pnpm exec eslint src/ 2>&1 | tail -2`
Expected: `0 problems` для `src/`.

- [ ] **Step 4: Регрессия + коммит**

```bash
pnpm test && pnpm build
git add -u src/
git commit -m "refactor(eslint): fix remaining type-safety strict findings

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Финальный гейт + PR

- [ ] **Step 1: Полный зелёный гейт (CLAUDE.md требование)**

Run: `pnpm lint && pnpm test && pnpm build`
Expected: все три зелёные, exit 0. `pnpm lint` (= `eslint src/`) — 0 ошибок.

- [ ] **Step 2: Sanity — guardrail-правила живы**

Run: `pnpm exec eslint src/ --print-config src/features/events/api.ts 2>/dev/null | grep -c 'no-restricted-imports'`
Expected: `>= 1` (guardrail-блоки не потерялись при правке конфига).

- [ ] **Step 3: Открыть PR (push разрешён только если пользователь его не блокирует — иначе отдать на ручной push)**

```bash
git push -u origin foundation/eslint-strict   # если push заблокирован настройками — пропустить, сообщить пользователю
gh pr create --base main --title "build(eslint): strictest type-aware preset (strict + stylistic)" \
  --body "$(cat <<'EOF'
## Что

Включён строжайший официальный type-aware набор typescript-eslint
(`strictTypeChecked` + `stylisticTypeChecked`) поверх eslint-config-next.

Два задокументированных послабления (в конфиге, с обоснованием):
- `no-unnecessary-condition: off` — defensive-проверки на границе с API.
- `restrict-template-expressions: { allowNumber, allowBoolean }`.

## Как смотреть

- c1 — только конфиг.
- c2 — механический `eslint --fix` (ревью по классам правок).
- c3+ — ручные фиксы, сгруппированы по правилу.

Спека: docs/superpowers/specs/2026-06-14-eslint-strict-preset-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Самопроверка плана (выполнено при написании)

- **Покрытие спеки:** конфиг+послабления → Task 1; авто-фикс → Task 2; ручные группы
  (no-deprecated, no-non-null-assertion, require-await, prefer-nullish, type-safety хвост) →
  Task 3–7; гейт `pnpm lint && pnpm test && pnpm build` + PR → Task 8;
  `disableTypeChecked` → Task 1 Step 3; снятие дублирующего `no-floating-promises` → Task 1
  Step 3 (входит в strictTypeChecked). Follow-up (React Compiler, eslint-plugin-react,
  noUncheckedIndexedAccess) — за скоупом, зафиксированы в спеке, в план не входят. ✔
- **Плейсхолдеры:** нет TBD/«handle edge cases» без кода — все шаги с командами и примерами
  before→after. Конкретные сайты ручных фиксов не перечислены намеренно: они дрейфуют до момента
  исполнения; критерий — «правило в ноль», паттерн фикса показан. ✔
- **Консистентность:** имя ветки `foundation/eslint-strict`, rule-id и хелперы одинаковы во всех
  задачах; счётчик через `grep -c '<rule-id>'`. ✔
- **Параллельные агенты:** предусловие «чистое дерево», `git add -u src/` (только наши tracked-правки,
  не `-A`/`.`), без деструктивных git-операций. ✔
