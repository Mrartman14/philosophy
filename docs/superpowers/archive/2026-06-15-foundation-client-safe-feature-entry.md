# Foundation — client-safe entry фичи (`@/features/*/client`) (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать каждой фиче второй публичный вход — `client.ts` (client-safe реэкспорт изоморфных view/утилит/типов), чтобы `"use client"`-код (офлайн-view в `app/saved/**` и далее) импортировал части фич БЕЗ протаскивания server-only в client-бандл, с линт-инвариантом client-safety. Фундамент для ВСЕХ офлайн-фич.

**Architecture:** Публичный `index.ts` фичи реэкспортит `./api`(`import "server-only"`)/`./actions`(`"use server"`) → client-импорт `index` ломает `next build` («server-only cannot be imported from a Client Component»). Вводим второй именованный entry `client.ts` (НЕ реэкспортит server-only). Новый Guardrail 4 запрещает в `client.ts` реэкспорт `./api`/`./actions`/`./permissions`/`./schemas` (client-safety проверяется линтером) И повторяет cross-feature-запрет G2 (см. ниже про flat-config override). Server-вывод инжектится пропами/слотами (`CommentNodeView`). **G1 НЕ трогаем** — ревью показало, что `@/features/*/client` уже разрешён текущим G1 (см. «Известный issue»).

**Tech Stack:** ESLint 9 flat config (`no-restricted-imports`), TypeScript 6, Next 16 App Router (Turbopack build), vitest 4.

---

## Контекст и текущее состояние (прочитать перед стартом)

**Почему foundation-PR:** трогает `eslint.config.mjs` — по CLAUDE.md/`frontend-conventions.md` запретная зона, координированный foundation-update PR. Этот план и есть он. Также правит `src/features/_template/*` и `docs/frontend-conventions.md`.

**Эмпирически установлено многоагентным ревью (прямые билды/линты на тулчейне проекта):**
- Client-импорт barrel `@/features/comments` тащит `api.ts` (`import "server-only"`) в client-граф → `next build` FAIL. Отдельный `client.ts` (реэкспорт только чистых view) собирается чисто (Turbopack — дефолтный бандлер `next build`).
- `no-restricted-imports` **ловит `export … from`** (реэкспорт) — фолбэк на `import/no-restricted-paths` не нужен; G4 рабочий.
- **flat-config НЕ мержит опции одного правила** — последний матчнувший блок ПЕРЕЗАПИСЫВАЕТ весь объект опций. `client.ts` матчат и G2 (`src/features/*/**`), и новый G4 (`src/features/*/client.ts`); G4 идёт позже → без повтора G2-паттерна client.ts потерял бы cross-feature-запрет. **Поэтому G4 включает ОБА паттерна** (cross-feature + server-only). Подтверждено: версия с двумя паттернами ловит оба нарушения.
- Граф `comments/client.ts` (CommentTreeView→CommentNodeView→ast-render/comment-format/reaction-summary/type-badge/types) — **полностью client-safe** (ни одного `server-only`/`"use server"`/`getMe`/`next/headers`).
- `import/order` НЕ сортирует `export … from` (порядок реэкспортов не важен).

**Известный pre-existing issue (НЕ чиним здесь — отдельный follow-up):** негатив-extglob `@/features/*/!(index)` в матчере `no-restricted-imports` **не работает** (матчит 0 путей). Deep-import-контроль G1 фактически держится только на `@/features/*/*/**` (глубина ≥2: `ui/x`). Следствия: (1) `@/features/x/client` (одноуровневый) УЖЕ разрешён текущим G1 — менять G1 для нашей цели НЕ нужно; (2) одноуровневые `@/features/x/api`/`/types`/`/actions` тоже не блокируются линтом (server-only ловится на build). Это предсуществующая дыра, не вносится этим планом. **Рекомендация отдельным PR:** починить матчер G1 (закрыть одноуровневый deep-import; например через gitignore-`!`-негацию вместо extglob, с эмпирической проверкой truth-table) — и при починке ОБЯЗАТЕЛЬНО оставить `index` И `client` в allowlist (иначе сломается этот foundation). До тех пор client.ts импортируется штатно.

**Изоморфные view comments чисты** (F2 + ревью, транзитивно). `CommentTreeView` сам тянет `CommentNodeView`/`CommentReactionSummary` для рендера, поэтому client-API достаточно `CommentTreeView` + типы (YAGNI; остальное добавим при появлении прямого потребителя — конвенция `_template/index.ts`: «экспортируй только нужное»).

**Текущие guardrails (`eslint.config.mjs` — сверить перед правкой, параллельные агенты):** G1 (стр. 136-153, deep-import), G2 (154-171, cross-feature `@/features/*` для `src/features/*/**`), G3 (172-193, server-only slice-файлы не тянут `react-dom/client`). Точка вставки G4 — после закрытия G3 (`},` стр. 193), перед `// Type-aware правила...` (стр. 194).

**Out of scope:** `annotations/client.ts` и прочие — по мере надобности (slice A заведёт свой по шаблону). Починка G1-матчера — отдельный PR. `sideEffects:false` — отвергнут (неявная/бандлеро-зависимая граница). End-to-end build-верификация «server-only не утёк» — в L2 (первый client-потребитель `@/features/comments/client`); здесь устанавливаем структуру + линт-гард (механизм уже доказан эмпирически).

**Конвенции:** kebab-case; `git add` по именам; НЕ трогать `src/api/schema.ts`/`public/sw.js`/`.env.development.local`. Гейт: `pnpm lint && pnpm test && pnpm build`.

---

## Файловая структура

- **Modify:** `eslint.config.mjs` — добавить Guardrail 4 (G1 НЕ трогаем).
- **Create:** `src/features/comments/client.ts` — client-safe entry comments.
- **Create:** `src/features/_template/client.ts` — скелет для будущих фич.
- **Modify:** `src/features/_template/README.md` — строка чеклиста.
- **Modify:** `docs/frontend-conventions.md` — подсекция про client-entry + слот-паттерн.

---

## Task 1: Guardrail 4 (client.ts: запрет server-only + повтор cross-feature)

**Files:**
- Modify: `eslint.config.mjs`

- [ ] **Step 1: Добавить Guardrail 4**

В `eslint.config.mjs` ПОСЛЕ закрывающего `},` блока Guardrail 3 (сейчас стр. 193) и ПЕРЕД блоком `// Type-aware правила нельзя гонять...` (стр. 194) вставить:

```js
  // Guardrail 4: client.ts — публичный CLIENT-safe entry слайса (для импорта из "use client"-кода).
  // (a) ПОВТОР cross-feature-запрета G2: ESLint flat-config НЕ мержит опции одного правила —
  //     последний матчнувший блок перезаписывает; client.ts матчат и G2, и G4 → без повтора
  //     G4 снял бы G2 с client.ts.
  // (b) запрет реэкспорта server-only-модулей слайса — иначе утекут в client-бандл
  //     (next build: «server-only cannot be imported from a Client Component»).
  {
    files: ["src/features/*/client.ts"],
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
            {
              group: ["./api", "./actions", "./permissions", "./schemas"],
              message:
                "client.ts — публичный client-safe entry: НЕ реэкспортируй api/actions/permissions/schemas (server-only). Только изоморфные view, чистые утилиты, типы; server-данные — пропами/слотами.",
            },
          ],
        },
      ],
    },
  },
```

- [ ] **Step 2: Прогон — нет регрессий**

Run: `pnpm lint`
Expected: 0 ошибок. (G4 пока no-op — `client.ts` ещё нет.)

- [ ] **Step 3: Коммит**

```bash
git add eslint.config.mjs
git commit -m "chore(eslint): guardrail 4 — client.ts must stay client-safe (no server-only/cross-feature) (foundation)"
```

---

## Task 2: `comments/client.ts` (с доказательством, что G4 кусается по обоим паттернам)

**Files:**
- Create: `src/features/comments/client.ts`

- [ ] **Step 1: Доказать, что G4 ловит ОБА нарушения (временный нарушитель)**

Создать `src/features/comments/client.ts` ВРЕМЕННО с двумя нарушениями:

```ts
// src/features/comments/client.ts (ВРЕМЕННО — проверка G4)
export { createComment } from "./actions";
import { getLectureById } from "@/features/lectures";
console.log(getLectureById);
```

- [ ] **Step 2: Прогон — G4 ДОЛЖЕН упасть на ОБОИХ**

Run: `pnpm lint`
Expected: **FAIL** — `no-restricted-imports` дважды: (1) реэкспорт `./actions` (server-only-паттерн G4); (2) импорт `@/features/lectures` (cross-feature-паттерн — доказывает, что повтор G2 в G4 работает и flat-override не съел запрет).

> Если падает только ОДНО (или ни одного) — стоп, сообщить: либо `no-restricted-imports` не ловит `export … from` (тогда фолбэк `import/no-restricted-paths`), либо flat-override всё же съел cross-feature-паттерн (перепроверить порядок патернов в G4). НЕ продолжать, пока не падают ОБА.

- [ ] **Step 3: Заменить на корректный client-safe entry**

Заменить содержимое `src/features/comments/client.ts` на:

```ts
// src/features/comments/client.ts
// Публичный CLIENT-safe entry слайса comments: изоморфный read-only рендер дерева + типы.
// Импортируется "use client"-кодом (офлайн SavedLectureView в app/saved/**).
// ЗАПРЕЩЕНО реэкспортировать ./api / ./actions / ./permissions / ./schemas (server-only) и
// делать cross-feature импорты — форсит Guardrail 4. server-вывод/интерактив контейнер
// инжектит пропами/слотами (CommentNodeView: anchorSlot/reactionsSlot/actionsSlot).
// CommentNodeView/CommentReactionSummary не реэкспортятся, пока нет прямого потребителя
// (CommentTreeView тянет их транзитивно для рендера) — добавить при необходимости.
export type { Comment, RootSubtree } from "./types";
export { CommentTreeView } from "./ui/comment-tree-view";
```

- [ ] **Step 4: Прогон — зелёный**

Run: `pnpm lint && pnpm typecheck`
Expected: 0/0.

- [ ] **Step 5: Коммит**

```bash
git add src/features/comments/client.ts
git commit -m "feat(comments): client-safe entry (CommentTreeView + types) (foundation)"
```

---

## Task 3: Шаблон + конвенция (фундамент на все фичи)

**Files:**
- Create: `src/features/_template/client.ts`
- Modify: `src/features/_template/README.md`
- Modify: `docs/frontend-conventions.md`

- [ ] **Step 1: Скелет `_template/client.ts`**

Создать `src/features/_template/client.ts`:

```ts
// src/features/_template/client.ts
// Публичный CLIENT-safe entry слайса — для импорта из "use client"-кода (напр. офлайн-view).
// Только изоморфные/client view, чистые утилиты, типы. ЗАПРЕЩЕНО реэкспортировать
// ./api / ./actions / ./permissions / ./schemas (server-only) и cross-feature — форсит Guardrail 4.
// server-данные/интерактив client-view получают пропами/слотами (паттерн CommentNodeView).

// Раскомментируй при появлении первого client-видимого экспорта:
// export { EntityCardView } from "./ui/entity-card-view";
// export type { Entity } from "./types";

// Пустой re-export держит файл валидным TS-модулем до первого реального экспорта.
export {};
```

- [ ] **Step 2: Строка в чеклисте `_template/README.md`**

В `src/features/_template/README.md` ПОСЛЕ строки `- [ ] \`index.ts\` экспортирует только то, что нужно снаружи` добавить:

```md
- [ ] client-видимые экспорты (для `"use client"`/офлайн) — в `client.ts`, НЕ в `index.ts` (server-only/cross-feature не реэкспортить — форсит Guardrail 4)
```

- [ ] **Step 3: Подсекция в `docs/frontend-conventions.md`**

Прочитать `docs/frontend-conventions.md`. В секции, описывающей слайс-структуру и публичный API (`index.ts`), добавить подсекцию (`###`-уровень, чтобы НЕ ломать нумерацию верхнеуровневых `##`-секций):

```md
### Client-safe entry фичи (RSC-граница)

Публичный `index.ts` фичи реэкспортит `./api`/`./actions` (server-only) — поэтому его НЕЛЬЗЯ импортировать из `"use client"`-кода: server-only утечёт в client-бандл и `next build` упадёт («server-only cannot be imported from a Client Component»). Для client-потребителей (офлайн-view в `app/saved/**` и т. п.) у фичи есть второй публичный вход:

- **`src/features/<entity>/client.ts`** — реэкспортит ТОЛЬКО изоморфные/client-safe view, чистые утилиты и типы. НЕ реэкспортит `./api`/`./actions`/`./permissions`/`./schemas` и НЕ делает cross-feature импортов (форсит Guardrail 4 в `eslint.config.mjs`).
- Импорт из client-кода: `import { XView } from "@/features/<entity>/client"`.
- **Слот-паттерн:** client-safe view не тянут server-данные/RBAC напрямую — server-контейнер инжектит их пропами/слотами (образец — `CommentNodeView` с `anchorSlot`/`reactionsSlot`/`actionsSlot`).
- server-страницы и server-композиция продолжают брать `getX`/actions из обычного `index.ts`.
```

> Если в `frontend-conventions.md` нет явной секции про слайс-структуру/публичный API — вставить подсекцию после секции «Шаблон слайса» (или эквивалентной), не меняя нумерацию `##`-секций.

- [ ] **Step 4: Прогон — зелёный**

Run: `pnpm lint && pnpm typecheck`
Expected: 0/0. (`_template/client.ts` — `export {}` под G4: ничего не реэкспортит → проходит.)

- [ ] **Step 5: Коммит**

```bash
git add src/features/_template/client.ts src/features/_template/README.md docs/frontend-conventions.md
git commit -m "docs(features): client-safe entry convention in template + frontend-conventions (foundation)"
```

---

## Финальная проверка (полный гейт)

- [ ] **Step 1: Прогон всего гейта**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected:
- `lint` 0 (G4 активен и доказанно кусается по обоим паттернам; `comments/client.ts` чист).
- `typecheck` 0.
- `test` — без изменений (тестов foundation не добавляет; существующие зелёные).
- `build` — успешно. **Важно:** build здесь проверяет лишь компиляцию `client.ts`; что server-only НЕ утекает в client при РЕАЛЬНОМ client-импорте — проверится в L2 (первый client-потребитель). Механизм доказан эмпирически (Turbopack VARIANT C).

---

## Self-Review (автор плана, после адверсариального ревью)

**Покрытие цели:** второй entry (`client.ts`) + G4 (линт-инвариант client-safety, оба паттерна) + шаблон + конвенция = фундамент для всех офлайн-фич. После него L2 импортит `@/features/comments/client` (текущий G1 это уже разрешает); annotations/etc. заводят свои `client.ts` по шаблону.

**Тип-консистентность:** `comments/client.ts` реэкспортит существующий `CommentTreeView` (F2) + типы `Comment`/`RootSubtree`. Имена сверены с `comments/index.ts`/`types.ts`.

**Плейсхолдеры:** нет — код/правки дословные, команды с ожидаемым выводом.

**Риски/допущения (свёрено 3-агентным ревью, эмпирически):**
1. **G4↔G2 flat-override (был Critical, исправлено):** G4 ПОВТОРЯЕТ cross-feature-паттерн G2, иначе перезаписал бы G2 на client.ts. Доказывается Task 2 Step 2 (cross-feature нарушение обязано падать).
2. **G4 ловит `export … from`** — подтверждено эмпирически (фолбэк `import/no-restricted-paths` не нужен; но Task 2 Step 2 это всё равно проверяет как stop-условие).
3. **G1 НЕ трогаем:** `@/features/*/client` уже разрешён текущим (частично-сломанным) G1; тюнинг `!(index|client)` был бы плацебо (extglob-негатив в матчере не работает). Предсуществующая дыра (одноуровневый `@/features/x/api` не блокируется линтом) — отдельный follow-up; при его починке СОХРАНИТЬ `client` в allowlist.
4. **Граф `comments/client.ts` client-safe** — подтверждено транзитивно; при client-импорте в L2 build не упадёт.
5. **import/order на реэкспортах** — правило их не сортирует; порядок безразличен.
6. **Урезанный client-API** (CommentTreeView + типы, без CommentNodeView/ReactionSummary) — по YAGNI + конвенции «экспортируй только нужное»; CommentTreeView тянет их транзитивно для рендера.
7. **End-to-end build-верификация** — в L2 (первый client-потребитель). Здесь устанавливаем структуру + гард; механизм доказан эмпирически.
8. **Параллельные агенты:** перед правкой `eslint.config.mjs`/`_template`/`frontend-conventions.md` сверить актуальное содержимое; `git add` по именам.
