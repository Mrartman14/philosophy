# ESLint: переход на строжайший type-aware пресет

- **Дата:** 2026-06-14
- **Тип:** foundation-update (затрагивает `eslint.config.mjs` — запретная зона по CLAUDE.md, поэтому отдельный PR)
- **Ветка:** `foundation/eslint-strict`
- **Статус:** spec утверждён, ждёт плана реализации

## Проблема

«Перейти на строжайший и новейший ESLint-пресет — индустриальный стандарт, если он есть».

Уточнение по факту: единого общепринятого «самого строгого» пресета нет. Но есть де-факто
официальный эталон от команды `typescript-eslint` — лесенка
`recommended` → `recommendedTypeChecked` → **`strictTypeChecked`** (+ слой
**`stylisticTypeChecked`**). `strictTypeChecked` — самый строгий type-aware набор, который
они выпускают (намеренно включает правила с возможными false-positive). Это и есть
«строжайший стандарт» для TS-проекта.

Тулчейн в проекте **уже новейший**: ESLint 9 (flat config), `typescript-eslint` 8.53,
`eslint-config-next` 16.1.4, type-aware линтинг включён (`projectService: true`). Чего нет —
строгие наборы правил не подключены: из `typescript-eslint` руками включены только
`no-floating-promises` и `react-hooks/exhaustive-deps`. То есть задача — не обновить
инструменты, а **включить уже установленную строгость**.

Biome / oxlint рассматривались и отвергнуты: они быстрее, но **не type-aware**, то есть для
строгости TS это шаг назад (не заменят `no-floating-promises`, `no-misused-promises`,
`no-unnecessary-condition` и т.п.). Airbnb / xo / canonical — либо не живут под flat-config,
либо тащат стилевые опинионы, конфликтующие с Prettier/Next.

## Замер стоимости (факт, прогон по `src/`)

`strictTypeChecked` + `stylisticTypeChecked` поверх текущего конфига дают:

- **1986 ошибок** в **275 из 612** файлов.
- **1375 авто-фиксятся** (`eslint --fix`), **611 — руками**.

Ручные срабатывания по правилам:

| Правило | Кол-во | Решение |
|---|---:|---|
| `no-unnecessary-condition` | 234 | **off** (послабление, см. ниже) |
| `restrict-template-expressions` | 102 | relax `{ allowNumber, allowBoolean }` — снимает большинство |
| `no-deprecated` | 102 | чинить (ценный сигнал — где зовём deprecated API) |
| `no-non-null-assertion` | 56 | чинить |
| `require-await` | 37 | чинить |
| `prefer-nullish-coalescing` | 21 | чинить |
| `no-base-to-string` | 12 | чинить |
| `no-misused-promises` | 10 | чинить |
| `no-unsafe-*` (assignment/call/member/argument) | ~10 | чинить |
| прочий хвост | ~25 | чинить |

После послаблений к ручной починке остаётся ориентировочно **250–300** правок.

## Выбранный подход: C — прагматичный строгач

Конечный набор правил — `strictTypeChecked` + `stylisticTypeChecked` как **error**.
Отличие от «максимума» (вариант A) — две осознанных, задокументированных в самом конфиге
послабления вместо засорения кода `eslint-disable`-комментами. Отличие от «ратчета» (вариант B) —
никаких `warn`-долгов: lint-гейт остаётся бинарным (зелёный/красный).

### Изменения в `eslint.config.mjs`

Поверх существующего конфига, ничего из текущего не ломаем:

1. Добавить `...tseslint.configs.strictTypeChecked` и `...tseslint.configs.stylisticTypeChecked`,
   scoped на `src/**/*.{ts,tsx}` (через `.map()` с переопределением `files`, как в текущем блоке).
2. Все 4 guardrail-блока (`no-restricted-imports` ×3 + cross-feature) и
   `react-hooks/exhaustive-deps: "error"` — **остаются без изменений**.
3. Убрать ручной `@typescript-eslint/no-floating-promises: "error"` — он уже входит в
   `strictTypeChecked`, дублирование.
4. Добавить `...tseslint.configs.disableTypeChecked` для `**/*.{js,mjs,cjs}` — чтобы type-aware
   правила не падали на конфигах/скриптах вне tsconfig (`eslint.config.mjs`,
   `scripts/generate-sw-assets.mjs` и т.п.).

### Осознанные послабления (с комментом-обоснованием в конфиге)

- **`@typescript-eslint/no-unnecessary-condition: "off"`.** 234 срабатывания, значительная
  часть — легитимные defensive-проверки на границе с бекенд-API: TS-тип обещает поле, но
  рантайм-ответ может его не содержать. Чище отключить правило целиком, чем рассыпать
  `eslint-disable` по коду. В комменте зафиксировать альтернативу на будущее: включить
  `noUncheckedIndexedAccess` в tsconfig и вернуть правило — отдельным решением (см. follow-up).
- **`@typescript-eslint/restrict-template-expressions: ["error", { allowNumber: true, allowBoolean: true }]`.**
  Числа и булевы в шаблонных строках — нормально; защита от `${object}` / `${null}` остаётся.

Все прочие правила strict — `error`, чинятся.

## Исполнение (разбивка на коммиты)

Делать на **чистой ветке `foundation/eslint-strict`**, **после того как текущий in-flight в
рабочем дереве закоммитят** (сейчас десятки незакоммиченных M/D-файлов от параллельных агентов;
свип на 275 файлов поверх этого = нечитаемый diff и коллизии).

- **c1** — конфиг: strict/stylistic пресеты, послабления, `disableTypeChecked`, снятие
  дублирующего `no-floating-promises`. Diff маленький, легко ревьюится.
- **c2** — `eslint --fix`: механический свип (~1375 правок — `Record<>`-стиль,
  `void`-выражения, nullish-coalescing, optional-chain, dot-notation). Один коммит, ревью по
  диагонали; никакой ручной логики.
- **c3…** — ручные фиксы (~250–300), сгруппированы по правилу или по слайсу для читаемости
  ревью: `no-deprecated`, `no-non-null-assertion`, `require-await`, `no-base-to-string`,
  `no-misused-promises`, `no-unsafe-*`, хвост.

**Гейт перед PR (CLAUDE.md):** `pnpm lint && pnpm test && pnpm build` — все зелёные.
Тулчейн — pnpm; npm не использовать.

## Риски

- **c2 (`--fix`) меняет много файлов разом.** Митигировать: отдельный коммит, ничего кроме
  авто-фикса; ревьюер смотрит на классы правок, не построчно. После `--fix` обязательно прогнать
  `pnpm test` и `pnpm build` — авто-фикс `no-confusing-void-expression` и `prefer-nullish-coalescing`
  изредка меняет семантику; тесты ловят регрессии.
- **Коллизия с параллельными агентами.** Митигировать: исполнять только после коммита текущего
  in-flight; не делать `git add -A` (только свои файлы по имени); никаких деструктивных git-операций.
- **`no-deprecated` может вскрыть массовое использование deprecated API.** Если объём окажется
  больше ожидаемого или потребует нетривиального рефактора — вынести в отдельный follow-up,
  временно оставив правило `error` с точечными разрешёнными исключениями (решать по факту в плане).

## За скоупом этого PR (возможные follow-up)

По умолчанию **не делаем**, фиксируем как кандидаты:

- React Compiler ESLint-правило (`eslint-plugin-react-hooks` recommended-latest для Next 16 /
  React 19).
- Полный `eslint-plugin-react` recommended поверх того, что даёт `eslint-config-next`.
- `noUncheckedIndexedAccess` в tsconfig + возврат `no-unnecessary-condition` в `error`.

## Критерии готовности

- `eslint.config.mjs` содержит strict + stylistic type-aware пресеты на `src/**` с двумя
  задокументированными послаблениями.
- `pnpm lint` — 0 ошибок; `pnpm test`, `pnpm build` — зелёные.
- Guardrail-блоки и RBAC-поведение не затронуты.
- PR — отдельный foundation-update, не смешан с фичами.
