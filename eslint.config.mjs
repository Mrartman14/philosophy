import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

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
