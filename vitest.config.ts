// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
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
