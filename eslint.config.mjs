import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import react from "eslint-plugin-react";
import jsxA11y from "eslint-plugin-jsx-a11y";
import testingLibrary from "eslint-plugin-testing-library";
import vitest from "eslint-plugin-vitest";

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
