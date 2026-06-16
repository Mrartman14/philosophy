// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/api/schema.ts",
        "src/**/*.test.{ts,tsx}",
        "src/features/_template/**",
        "src/test/**",
        "**/*.d.ts",
      ],
      thresholds: {
        statements: 41,
        branches: 30,
        functions: 40,
        lines: 42,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` не установлен как top-level пакет (Next предоставляет его
      // через свой bundled chunk), поэтому в Vitest его нужно стабить, чтобы
      // import-analysis не падал. Mock'ается затем через `vi.mock("server-only", ...)`.
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
    },
  },
});
