// src/i18n/server-only-namespaces.test.ts
// Guard против дрейфа: убеждаемся, что SERVER_ONLY_NAMESPACES не используются
// на клиенте (useT / useTranslations). Если в будущем появится клиентский вызов
// useT("validation") — тест упадёт, сигнализируя убрать ns из SERVER_ONLY_NAMESPACES.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { SERVER_ONLY_NAMESPACES } from "./messages";

// --- утилиты -----------------------------------------------------------------

function* walkSrc(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkSrc(full);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      yield full;
    }
  }
}

const SRC_ROOT = join(__dirname, "..");

function collectSourceFiles(): string[] {
  const files: string[] = [];
  for (const file of walkSrc(SRC_ROOT)) {
    const rel = relative(SRC_ROOT, file);
    // исключаем тесты и сам каталог i18n (там легально getT)
    if (/\.test\.(ts|tsx)$/.test(file)) continue;
    if (rel.startsWith("i18n/")) continue;
    files.push(file);
  }
  return files;
}

// Паттерн: useT("ns") или useTranslations("ns") — клиентские вызовы
function makePattern(ns: string): RegExp {
  const escaped = ns.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`useT\\(["'\`]${escaped}["'\`]\\)|useTranslations\\(["'\`]${escaped}["'\`]\\)`);
}

// --- тесты -------------------------------------------------------------------

describe("SERVER_ONLY_NAMESPACES: нет клиентских useT/useTranslations", () => {
  const sourceFiles = collectSourceFiles();

  for (const ns of SERVER_ONLY_NAMESPACES) {
    it(`namespace "${ns}" не используется на клиенте (useT/useTranslations)`, () => {
      const pattern = makePattern(ns);
      const violations: string[] = [];

      for (const file of sourceFiles) {
        const content = readFileSync(file, "utf-8");
        if (pattern.test(content)) {
          violations.push(relative(SRC_ROOT, file));
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `Namespace "${ns}" помечен SERVER_ONLY, но найден в client-коде:\n` +
            violations.map((f) => `  ${f}`).join("\n") +
            `\n\nЕсли это намеренно — удалите "${ns}" из SERVER_ONLY_NAMESPACES в src/i18n/messages/index.ts.`,
        );
      }

      expect(violations).toHaveLength(0);
    });
  }
});
