import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import jsxA11y from "eslint-plugin-jsx-a11y";
import testingLibrary from "eslint-plugin-testing-library";
import vitest from "eslint-plugin-vitest";

// Общие паттерны no-restricted-imports (flat-config перезаписывает, не мержит опции
// правила → каждый матчнувший блок должен нести нужные паттерны целиком).
const DEEP_IMPORT_PATTERN = {
  group: ["@/features/*/!(index)", "@/features/*/*/**"],
  message: "Импортируй фичу через её index.ts (@/features/<entity>).",
};
const NO_NEXT_INTL_PATTERN = {
  group: ["next-intl", "next-intl/*"],
  message:
    "next-intl — только через фасад @/i18n (server) / @/i18n/client (Guardrail 5). Прямой импорт запрещён.",
};

const eslintConfig = [
  // Сгенерированные файлы не линтим: `pnpm generate:api` (openapi-typescript)
  // перезатрёт любые авто-фиксы, поэтому strict-правила тут только создают шум при регене.
  {
    ignores: ["src/api/schema.ts"],
  },
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
  // no-console: единственный санкционированный канал логов — observability-фасад
  // (@/services/observability). console.* в src запрещён, чтобы логи проходили
  // через redaction + sink-роутинг, а не текли в stdout мимо наблюдаемости.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-console": "error",
    },
  },
  // Исключения: console-adapter — ЕДИНСТВЕННАЯ санкционированная точка вывода
  // (dev pretty-print / prod stdout JSON), и скрипты сборки/обслуживания.
  {
    files: [
      "src/services/observability/adapters/console-adapter.ts",
      "scripts/**/*.{ts,tsx,js,mjs,cjs}",
    ],
    rules: {
      "no-console": "off",
    },
  },
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
      // XSS-гард: запрет dangerouslySetInnerHTML. Пользовательский контент
      // рендерится структурно (ast-render/canvas-render: AST → DOM), сырой HTML
      // в проект не попадает — правило фиксирует этот инвариант, а не отлавливает
      // существующие нарушения (их 0). Точечный сырой HTML (если правда понадобится)
      // — через локальный eslint-disable c обоснованием и санитайзером.
      "react/no-danger": "error",
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
      // Запрет циклических зависимостей — критично для слайс-архитектуры
      // (циклы = скрытые баги + поломанный tree-shaking). На текущем коде 0 нарушений.
      "import/no-cycle": ["error", { maxDepth: Infinity }],
    },
  },
  // Тест-линт: плагины testing-library и vitest НЕ регистрируются eslint-config-next,
  // поэтому спред целого flat-пресета безопасен (нет "Cannot redefine plugin").
  {
    ...testingLibrary.configs["flat/react"],
    files: ["src/**/*.test.{ts,tsx}"],
  },
  {
    ...vitest.configs.recommended,
    files: ["src/**/*.test.{ts,tsx}"],
  },
  // Осознанное послабление: no-container/no-node-access — про user-centric стиль
  // (RTL-queries вместо прямого DOM). В тестах рендереров/редактора (ast-render,
  // canvas-render, ast-editor) проверка DOM-структуры — это и есть предмет теста
  // (AST-узел → конкретный DOM), RTL-queries там неприменимы. Остальные тест-правила
  // остаются error везде.
  {
    files: [
      "src/components/ast-render/**/*.test.{ts,tsx}",
      "src/components/canvas-render/**/*.test.{ts,tsx}",
      "src/components/ast-editor/**/*.test.{ts,tsx}",
    ],
    rules: {
      "testing-library/no-node-access": "off",
      "testing-library/no-container": "off",
    },
  },
  // Тюнинг под фактический сетап проекта (документированные, не «глушилки»):
  {
    files: ["src/**/*.test.{ts,tsx}"],
    rules: {
      // vitest globals:false (см. vitest.config.ts) → RTL auto-cleanup НЕ активен,
      // поэтому ручной afterEach(cleanup) обязателен, а не редундантен.
      "testing-library/no-manual-cleanup": "off",
      // vitest поддерживает второй аргумент-сообщение: expect(value, "message").
      "vitest/valid-expect": ["error", { maxArgs: 2 }],
    },
  },
  {
    // canvasDataToRenderData — доменная map-функция, не RTL render(); правило
    // render-result-naming-convention ложно матчит её по «render» в имени.
    files: ["src/features/canvas/editor/render-map.test.ts"],
    rules: { "testing-library/render-result-naming-convention": "off" },
  },
  // Guardrail 6: запрет вызовов переводчика .rich()/.markup() в прикладном коде.
  // Каталог сообщений намеренно держит ПРОСТОЕ подмножество ICU ({var} + {count, plural, …}),
  // без rich/markup/select — ради дешёвого свопа i18n-библиотеки за фасадом @/i18n.
  // useT/getT сейчас — прямой ре-экспорт next-intl-переводчика, у которого ЕСТЬ .rich()/.markup();
  // Guardrail 5 ловит только импорт next-intl, не вызовы методов переводчика. Это правило
  // форсит дисциплину машинно. no-restricted-syntax — отдельное правило (НЕ no-restricted-imports),
  // его rules не перезатираются Guardrail 1–5; отдельный блок на src/** гарантирует применение
  // ко всему прикладному коду (features/app/components) — ни один более поздний блок его не трогает.
  // Селектор по callee.property.name ловит ЛЮБОЙ .rich(...)/.markup(...) — на текущем коде
  // 0 вхождений (grep пуст), приемлемо для guard-heavy стиля проекта.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='rich']",
          message:
            "t.rich(...) запрещён: каталог сообщений держит простое подмножество ICU ради дешёвого свопа i18n-библиотеки за фасадом @/i18n (см. docs/frontend-i18n.md). Используй plain t(key, params).",
        },
        {
          selector: "CallExpression[callee.property.name='markup']",
          message:
            "t.markup(...) запрещён: каталог сообщений держит простое подмножество ICU ради дешёвого свопа i18n-библиотеки за фасадом @/i18n (см. docs/frontend-i18n.md). Используй plain t(key, params).",
        },
      ],
    },
  },
  // Guardrail 7: ноль прямых @base-ui/react вне UI-kit + ноль нативных
  // интерактивных тегов вне kit. + Guardrail 8 (см. ниже): закрытие className/
  // variant/size на kit-контролах. Flat-config НЕ мержит no-restricted-syntax →
  // последний матчнувший блок перезатирает; этот блок матчит src/** КРОМЕ
  // src/components/ui/** и КРОМЕ *.test.{ts,tsx} последним, поэтому ПОВТОРЯЕТ
  // rich/markup-селекторы G6 (иначе они слетели бы для прикладного кода) И несёт
  // G8-селекторы в ТОМ ЖЕ блоке — отдельный блок с тем же scope затёр бы G7.
  // Файлы в ui/ и тесты этот блок игнорит — для ui/ последним остаётся G6
  // (rich/markup), а base-ui/нативные теги/className-эскейпы там разрешены.
  // ВАЖНО (тесты исключены намеренно): mock-стабы kit-компонентов и тест-харнессы
  // легитимно рендерят нативные <button>/<form> и импортируют @base-ui/react
  // (напр. image-button.test.tsx) — гард на них не распространяется. Подтверждённый
  // ревью список таких файлов: save-offline-button.test, appearance-provider.test,
  // ast-merge-view.test, document-edit-form-conflict.test (и smoke-тесты обёрток в ui/).
  // <input> в гард НЕ включён — отдельный фоллоу-ап (нужны новые примитивы).
  // Исключения в ПРОДАКШН-коде (построчный eslint-disable + комментарий):
  // global-error.tsx (критический root error-boundary на inline-style),
  // canvas editor-text-overlay (абсолютно-позиционированный inline-style textarea).
  // КРИТИЧНО про base-ui-селектор: литеральный «/» внутри тела regex обрывает
  // regex-литерал в грамматике esquery (и /^@base-ui\/react/, и /^@base-ui/react/
  // РУШАТ eslint с «Invalid regular expression»). Слеш кодируем через / —
  // проверено сквозным Linter.verify (esquery 1.6.0 / eslint 9.29.0): матчит
  // @base-ui/react и подпути, пропускает @/components/ui и @base-ui-*.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**", "src/**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='rich']",
          message:
            "t.rich(...) запрещён: каталог сообщений держит простое подмножество ICU ради дешёвого свопа i18n-библиотеки за фасадом @/i18n (см. docs/frontend-i18n.md). Используй plain t(key, params).",
        },
        {
          selector: "CallExpression[callee.property.name='markup']",
          message:
            "t.markup(...) запрещён: каталог сообщений держит простое подмножество ICU ради дешёвого свопа i18n-библиотеки за фасадом @/i18n (см. docs/frontend-i18n.md). Используй plain t(key, params).",
        },
        {
          // / === "/"; литеральный слеш в теле esquery-regex рушит парсер (см. коммент выше)
          selector: "ImportDeclaration[source.value=/^@base-ui\\u002freact/]",
          message:
            "Прямой импорт @base-ui/react вне src/components/ui запрещён. Используй обёртку из @/components/ui (новый примитив — добавь обёртку в UI-kit).",
        },
        {
          selector: "JSXOpeningElement[name.name='button']",
          message: "Нативный <button> запрещён вне UI-kit. Используй Button/IconButton из @/components/ui.",
        },
        {
          selector: "JSXOpeningElement[name.name='select']",
          message: "Нативный <select> запрещён вне UI-kit. Используй Select из @/components/ui.",
        },
        {
          selector: "JSXOpeningElement[name.name='form']",
          message: "Нативный <form> запрещён вне UI-kit. Используй Form из @/components/ui.",
        },
        {
          selector: "JSXOpeningElement[name.name='fieldset']",
          message: "Нативный <fieldset> запрещён вне UI-kit. Используй Fieldset из @/components/ui.",
        },
        {
          selector: "JSXOpeningElement[name.name='legend']",
          message: "Нативный <legend> запрещён вне UI-kit. Используй Fieldset (legend-проп) из @/components/ui.",
        },
        {
          selector: "JSXOpeningElement[name.name='textarea']",
          message: "Нативный <textarea> запрещён вне UI-kit. Используй Textarea из @/components/ui.",
        },
        // Guardrail 8: «вид» kit-контролов закрыт — позиция через Inline/Stack,
        // вид через tone/compact (или unstyled-escape только у Button). Эти
        // селекторы — backstop поверх TS (discriminated union / Omit<…,"className">):
        // TS не ловит className на styled-<Button> надёжно в JSX, а здесь даёт
        // явное сообщение и работает даже в нестрогих местах. no-restricted-syntax
        // не мержится между блоками — поэтому G8 живёт в блоке G7 (тот же scope).
        //
        // G8.1 — className на styled-<Button> (НЕ unstyled): unstyled-ветка
        // легитимно несёт className (escape для кликабельных строк), её
        // :not(:has(unstyled)) исключает.
        {
          selector:
            "JSXOpeningElement[name.name='Button']:has(JSXAttribute[name.name='className']):not(:has(JSXAttribute[name.name='unstyled']))",
          message:
            "className на styled kit-контроле запрещён — Inline/Stack (позиция) или unstyled (вид).",
        },
        // G8.2 — className на полностью закрытых leaf-контролах (нет unstyled-escape).
        {
          selector: "JSXOpeningElement[name.name='IconButton']:has(JSXAttribute[name.name='className'])",
          message:
            "className на styled kit-контроле запрещён — Inline/Stack (позиция) или unstyled (вид).",
        },
        {
          selector: "JSXOpeningElement[name.name='Select']:has(JSXAttribute[name.name='className'])",
          message:
            "className на styled kit-контроле запрещён — Inline/Stack (позиция) или unstyled (вид).",
        },
        {
          selector: "JSXOpeningElement[name.name='TextInput']:has(JSXAttribute[name.name='className'])",
          message:
            "className на styled kit-контроле запрещён — Inline/Stack (позиция) или unstyled (вид).",
        },
        {
          selector: "JSXOpeningElement[name.name='Textarea']:has(JSXAttribute[name.name='className'])",
          message:
            "className на styled kit-контроле запрещён — Inline/Stack (позиция) или unstyled (вид).",
        },
        {
          selector: "JSXOpeningElement[name.name='Checkbox']:has(JSXAttribute[name.name='className'])",
          message:
            "className на styled kit-контроле запрещён — Inline/Stack (позиция) или unstyled (вид).",
        },
        {
          selector: "JSXOpeningElement[name.name='Label']:has(JSXAttribute[name.name='className'])",
          message:
            "className на styled kit-контроле запрещён — Inline/Stack (позиция) или unstyled (вид).",
        },
        {
          selector: "JSXOpeningElement[name.name='ColorInput']:has(JSXAttribute[name.name='className'])",
          message:
            "className на styled kit-контроле запрещён — Inline/Stack (позиция) или unstyled (вид).",
        },
        // G8.3 — устаревшие variant=/size= на kit-кнопках. Привязка к имени
        // компонента (НЕ голый JSXAttribute[name.name='size']), чтобы не задеть
        // чужие size (нативный <input size>, сторонние компоненты).
        {
          selector: "JSXOpeningElement[name.name='Button']:has(JSXAttribute[name.name='variant'])",
          message: "kit использует tone/compact, не variant/size.",
        },
        {
          selector: "JSXOpeningElement[name.name='Button']:has(JSXAttribute[name.name='size'])",
          message: "kit использует tone/compact, не variant/size.",
        },
        {
          selector: "JSXOpeningElement[name.name='IconButton']:has(JSXAttribute[name.name='variant'])",
          message: "kit использует tone/compact, не variant/size.",
        },
        {
          selector: "JSXOpeningElement[name.name='IconButton']:has(JSXAttribute[name.name='size'])",
          message: "kit использует tone/compact, не variant/size.",
        },
      ],
    },
  },
  // Guardrail 1: deep-imports into other features must go through their index.ts
  // + Guardrail 5: прямой импорт next-intl запрещён (кроме src/i18n/** — см. ниже)
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/features/*/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [DEEP_IMPORT_PATTERN, NO_NEXT_INTL_PATTERN] },
      ],
    },
  },
  // Guardrail 5 exemption: src/i18n — ЕДИНСТВЕННАЯ точка прямого импорта next-intl.
  // Должен идти ПОСЛЕ Guardrail 1 (перезаписывает его no-restricted-imports для src/i18n),
  // сохраняя при этом запрет deep-import.
  {
    files: ["src/i18n/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [DEEP_IMPORT_PATTERN] }],
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
            NO_NEXT_INTL_PATTERN,
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
          patterns: [NO_NEXT_INTL_PATTERN],
        },
      ],
    },
  },
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
            NO_NEXT_INTL_PATTERN,
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
