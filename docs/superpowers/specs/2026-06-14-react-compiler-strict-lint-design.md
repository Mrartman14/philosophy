# React Compiler + строгий ESLint-стек

- **Дата:** 2026-06-14
- **Тип:** foundation-update (затрагивает `eslint.config.mjs`, `next.config.ts`, `package.json` — запретные зоны по CLAUDE.md, поэтому отдельный PR)
- **Ветка:** `foundation/react-compiler-strict-lint`
- **Статус:** spec утверждён, ждёт плана реализации

## Контекст

Прямое продолжение [2026-06-14-eslint-strict-preset-design.md](2026-06-14-eslint-strict-preset-design.md).
Тот PR включил `strictTypeChecked` + `stylisticTypeChecked` и в разделе «За скоупом» зафиксировал
три follow-up-кандидата. Этот spec их реализует и добавляет runtime React Compiler.

Состояние тулчейна на старте:

- Next **16.1.4**, React/React-DOM **19.2.3**, `reactStrictMode: true`, dev на Turbopack.
- `tsconfig`: `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` — **уже включены**.
- ESLint 9 flat config; `eslint-config-next` 16.1.4 транзитивно тащит и резолвит (под
  `node-linker=hoisted`) `typescript-eslint` 8.53, `eslint-plugin-react` 7.37.5,
  `eslint-plugin-react-hooks` **7.0.1**, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`.
- В `eslint.config.mjs` из react-стека включён только ручной `react-hooks/exhaustive-deps: "error"`;
  recommended-пресеты этих плагинов не применены.

Задача — не обновить инструменты (они новейшие), а **включить уже установленную строгость** и
поднять runtime-компилятор.

## Решения (зафиксированы с пользователем)

- **React Compiler — полностью, режим `infer`** (не annotation-opt-in, не lint-only).
- **Максимальная строгость**: помимо трёх follow-up — вернуть `no-unnecessary-condition`, добавить
  `import/order` + `import/no-duplicates` и поднять jsx-a11y до `strict`.
- **Зависимости не раздуваем**: единственный новый пакет — `babel-plugin-react-compiler`.
  Плагины, уже приходящие транзитивно через `eslint-config-next`, **не** объявляем явными devDeps —
  явные `^`-пины рискуют развести версии → два инстанса плагина → конфликты `Cannot redefine plugin`
  (тот же класс падений, что задокументирован в `.npmrc` про дубль-инстансы ProseMirror). Опираемся
  на транзитивный резолвинг под `node-linker=hoisted`.

## Изменения

### 1. React Compiler (runtime)

- `pnpm add -D babel-plugin-react-compiler`. React 19.2 — рантайм компилятора встроен, отдельный
  `react-compiler-runtime` не нужен.
- `next.config.ts`: добавить top-level `reactCompiler: true` (в Next 16 опция выехала из
  `experimental`; режим по умолчанию — `infer`). Остальной конфиг без изменений.
- **Turbopack/SWC не отключаем.** Next прогоняет Babel-плагин компилятора через собственную
  SWC-оптимизацию только по релевантным файлам (JSX/хуки). Мы НЕ добавляем `.babelrc` (это опт-аутнуло
  бы SWC целиком) — используем нативную опцию `reactCompiler`. Билд может быть чуть медленнее, эффект
  локальный.
- Риск низкий: `infer` безопасно «бейлится» (пропускает компиляцию) на компонентах с нарушениями
  Rules of React, не меняя рантайм-семантику.

### 2. ESLint: `eslint.config.mjs`

Поверх текущего конфига, scoped на `src/**/*.{ts,tsx}` через `.map()`-переопределение `files`
(как у существующих strict/stylistic-блоков). Guardrail-блоки (3× `no-restricted-imports` +
cross-feature) и `disableTypeChecked` для `*.{js,mjs,cjs}` — **без изменений**.

1. **React Hooks recommended-latest.** Подключить `reactHooks.configs.flat['recommended-latest']`.
   Включает compiler-powered правила: `set-state-in-effect`, `set-state-in-render`, `immutability`,
   `preserve-manual-memoization`, `purity`, `refs`, `static-components`, `error-boundaries`,
   `use-memo`, `globals`, `config`, `gating` (+ `unsupported-syntax`/`incompatible-library` на warning).
2. **Снять ручной `react-hooks/exhaustive-deps: "error"`** — recommended-latest уже даёт его как
   `error`; блок становится дублем (по аналогии с тем, как прошлый PR убрал дублирующий
   `no-floating-promises`).
3. **Полный eslint-plugin-react.** Добавить `react.configs.flat.recommended` +
   `react.configs.flat['jsx-runtime']` (последний отключает `react/react-in-jsx-scope` для Next),
   с `settings.react.version: "detect"`. Дедуп с подмножеством react-правил из `eslint-config-next`.
4. **`@typescript-eslint/no-unnecessary-condition: "error"`** — снять текущий `off`. Исходная причина
   отключения (отсутствие `noUncheckedIndexedAccess`) больше не актуальна — флаг уже в tsconfig.
   Обновить/удалить устаревший комментарий про «альтернативу на будущее».
5. **`import/order`** (`groups` + `alphabetize` + `newlines-between`) + **`import/no-duplicates`**.
   Резолвер `@/` берём из настроек `eslint-config-next`; если import/order его не подхватит — добавить
   явный `settings['import/resolver']` с typescript-резолвером.
6. **jsx-a11y → strict.** Применить `jsxA11y.flatConfigs.strict` поверх recommended из next.

**Подтверждено пробным прогоном (read-only):** `eslint-config-next` уже регистрирует плагины
`react`, `react-hooks`, `import`, `jsx-a11y`, и спред целого пресет-объекта (с его `plugins`) даёт
`ConfigError: Cannot redefine plugin "jsx-a11y"`. Поэтому подключаем **только `.rules`** выбранных
пресетов в src-блоках, опираясь на уже зарегистрированные next-ом плагины. Это не фолбэк, а
обязательный способ.

Дополнительно: `react/prop-types` в TS-проекте — шум (валидацию пропсов даёт typescript), поэтому
в конфиге ставим его `off`. Это стандартная для TS+React настройка, не послабление.

## Замер стоимости (факт, read-only прогон по `src/`)

**1208 ошибок в 413/610 файлов; авто-фиксимых 916.** Распределение:

| Правило | Кол-во | Авто-фикс | Решение |
|---|---:|---:|---|
| `import/order` | 915 | 901 | `--fix` |
| `@typescript-eslint/no-unnecessary-condition` | 233 | 0 | ручные (defensive-проверки на границе API) |
| `jsx-a11y/label-has-associated-control` | 24 | 0 | ручные |
| `react/jsx-no-target-blank` | 15 | 15 | `--fix` |
| `react/prop-types` | 13 | 0 | `off` в конфиге (TS-проект) |
| прочий `jsx-a11y` хвост | 8 | 0 | ручные |
| compiler-правила `recommended-latest` | **0** | — | код уже compiler-clean, текущей цены нет |

После `--fix` (916) и снятия `prop-types` (13) к ручной починке остаётся **~265** (233 +
`no-unnecessary-condition` + ~32 jsx-a11y). Заметно: recommended-latest compiler-правила дают **0**
ошибок — страховка без текущей стоимости.

## Исполнение (разбивка на коммиты)

Делать на **чистой ветке `foundation/react-compiler-strict-lint`**, **после коммита текущего in-flight**
в рабочем дереве (`public/sw.js`, `src/features/events/api.ts`), чтобы свип не смешался с чужими
правками и diff остался читаемым.

- **c1** — конфиг: `package.json` (`babel-plugin-react-compiler`), `next.config.ts` (`reactCompiler:
  true`), `eslint.config.mjs` (recommended-latest, react recommended+jsx-runtime, jsx-a11y strict,
  import/order + no-duplicates, возврат `no-unnecessary-condition`, снятие ручного exhaustive-deps).
  Diff маленький, легко ревьюится.
- **c2** — `pnpm lint --fix`: механический свип (import/order, авто-фиксимые react-правила). Один
  коммит, ревью по классам правок. После — **обязательно** `pnpm test` + `pnpm build` (авто-фикс
  изредка меняет семантику).
- **c3…** — ручные фиксы, сгруппированы по правилу или по слайсу для читаемости ревью:
  `no-unnecessary-condition`, compiler-правила recommended-latest, jsx-a11y-strict хвост, остальное.

**Гейт перед PR (CLAUDE.md):** `pnpm lint && pnpm test && pnpm build` — все зелёные. Тулчейн — pnpm.

## Риски

- **`reactCompiler: true` на не-проверенном ранее коде.** Митигировать: режим `infer` сам пропускает
  небезопасные компоненты; перед мерджем — `pnpm build` (компилятор реально включается) и старт
  dev-сервера. Recommended-latest-правила подсвечивают нарушения → чиним → больше компонентов
  попадает под оптимизацию.
- **`c2 (--fix)` меняет много файлов разом** (import/order). Митигировать: отдельный коммит, после —
  `pnpm test` + `pnpm build`.
- **Объём ручных правок может оказаться неподъёмным разом** (особенно compiler-правила +
  `no-unnecessary-condition`). Митигировать: если класс правил слишком тяжёлый — вынести в follow-up,
  временно оставив правило `"warn"` с явной отметкой долга в комментарии конфига (НЕ рассыпать
  `eslint-disable` по коду).
- **Коллизия с параллельными агентами.** Митигировать: только после коммита in-flight; добавлять
  только свои файлы по имени (без `git add -A`); никаких деструктивных git-операций.

## Критерии готовности

- `next.config.ts` содержит `reactCompiler: true`; `babel-plugin-react-compiler` в devDeps;
  React Compiler реально включается (проверено по выводу `pnpm build`); dev-сервер стартует.
- `eslint.config.mjs`: `recommended-latest` (hooks) + `recommended` + `jsx-runtime` (react) +
  jsx-a11y strict + `import/order` + `import/no-duplicates` + `no-unnecessary-condition: "error"`;
  ручной `exhaustive-deps`-блок удалён.
- Новых явных devDeps, кроме `babel-plugin-react-compiler`, не добавлено.
- `pnpm lint` — 0 ошибок; `pnpm test`, `pnpm build` — зелёные.
- Guardrail-блоки и RBAC-поведение не затронуты.
- PR — отдельный foundation-update, не смешан с фичами.
