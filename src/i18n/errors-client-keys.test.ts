// src/i18n/errors-client-keys.test.ts
// Guard для CLIENT_ERROR_KEYS — branded-подмножества namespace `errors`, которое
// toClientMessages оставляет в клиентской проекции (api-error КОДЫ режутся).
//
// Защищает в обе стороны:
//   (a) каждый ключ CLIENT_ERROR_KEYS существует в ru-каталоге `errors` (нет опечаток);
//   (b) клиент не зовёт ни одного error-ключа ВНЕ CLIENT_ERROR_KEYS — иначе урезанная
//       проекция не отдаст строку, и `tErrors("REF_NOT_FOUND")` отрендерит сырой ключ.
//
// Не-вакуумность: вставка `tErrors("REF_NOT_FOUND")` в любой client-файл должна
// уронить тест (b) — REF_NOT_FOUND не в CLIENT_ERROR_KEYS.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { CLIENT_ERROR_KEYS } from "./messages";
import ruErrors from "./messages/ru/errors";

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
    // исключаем тесты и сам каталог i18n (там легально серверный resolveErrorMessage)
    if (/\.test\.(ts|tsx)$/.test(file)) continue;
    if (rel.startsWith("i18n/")) continue;
    files.push(file);
  }
  return files;
}

// Все ключи, переданные в литерал `tErrors("KEY"...)` (клиентский ErrorsT-seam).
// Достаёт первый строковый аргумент; ICU-параметры (второй аргумент) игнорируются.
const TERRORS_CALL = /tErrors\(\s*["'`]([A-Za-z0-9_.]+)["'`]/g;

function collectClientErrorKeyUsages(): Map<string, string[]> {
  const usages = new Map<string, string[]>();
  for (const file of collectSourceFiles()) {
    const content = readFileSync(file, "utf-8");
    let match: RegExpExecArray | null;
    TERRORS_CALL.lastIndex = 0;
    while ((match = TERRORS_CALL.exec(content)) !== null) {
      const key = match[1];
      if (key === undefined) continue;
      const list = usages.get(key) ?? [];
      list.push(relative(SRC_ROOT, file));
      usages.set(key, list);
    }
  }
  return usages;
}

// --- тесты -------------------------------------------------------------------

describe("CLIENT_ERROR_KEYS: branded-подмножество клиентской проекции errors", () => {
  const catalogKeys = new Set(Object.keys(ruErrors));
  const clientKeys = new Set<string>(CLIENT_ERROR_KEYS);

  it("(a) каждый ключ CLIENT_ERROR_KEYS существует в ru-каталоге errors", () => {
    const missing = CLIENT_ERROR_KEYS.filter((k) => !catalogKeys.has(k));
    expect(missing).toEqual([]);
  });

  it("(b) клиент не зовёт tErrors(...) с ключом вне CLIENT_ERROR_KEYS", () => {
    const usages = collectClientErrorKeyUsages();
    const violations: string[] = [];
    for (const [key, files] of usages) {
      if (!clientKeys.has(key)) {
        violations.push(`  tErrors("${key}") — ${[...new Set(files)].join(", ")}`);
      }
    }
    if (violations.length > 0) {
      throw new Error(
        "Клиент зовёт error-ключ ВНЕ CLIENT_ERROR_KEYS — он не попадёт в урезанную\n" +
          "клиентскую проекцию errors (toClientMessages) и отрендерится сырым ключом.\n" +
          "Если ключ нужен клиенту — добавь его в CLIENT_ERROR_KEYS\n" +
          "(src/i18n/messages/index.ts). НЕ добавляй туда api-error КОДЫ (они server-only).\n\n" +
          violations.join("\n"),
      );
    }
    expect(violations).toEqual([]);
  });

  it("(b') ни один SCREAMING_SNAKE api-код не используется как tErrors-ключ в клиенте", () => {
    const usages = collectClientErrorKeyUsages();
    const apiCodeUsages = [...usages.keys()].filter((k) => /^[A-Z][A-Z0-9_]+$/.test(k));
    expect(apiCodeUsages).toEqual([]);
  });
});
