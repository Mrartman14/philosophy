// eslint.config.test.mjs
//
// Фикстура-тест Guardrail 8 (className/variant/size закрыты на kit-контролах).
// Запуск: `node eslint.config.test.mjs` (standalone, НЕ через vitest — vitest
// include = src/**/*.test.{ts,tsx}, этот файл там не матчится).
//
// Гоняем Linter.verifyAndFix-эквивалент (Linter.verify) на сниппетах через
// реальный flat-config из eslint.config.mjs, скоупленный на условный
// прикладной .tsx-путь (вне src/components/ui/** и вне *.test.*), чтобы
// сработал именно блок Guardrail 7+8. Проверяем КОЛИЧЕСТВО и СООБЩЕНИЕ
// no-restricted-syntax-ошибок.

import assert from "node:assert/strict";

import { Linter } from "eslint";

import eslintConfig from "./eslint.config.mjs";

const linter = new Linter({ configType: "flat" });

// Прикладной путь: реальный .tsx из tsconfig (НЕ в ui/, НЕ тест) → попадает
// под scope Guardrail 7+8. Реальный путь обязателен: type-aware projectService
// отклоняет синтетический путь («was not found by the project service»).
// Содержимое файла подменяется сниппетом, важен лишь путь для скоупинга.
const APP_FILE = "src/app/page.tsx";

/** Прогоняет код через flat-config и возвращает только G8/G7-сообщения. */
function lintSnippet(code) {
  const messages = linter.verify(code, eslintConfig, { filename: APP_FILE });
  return messages.filter((m) => m.ruleId === "no-restricted-syntax");
}

const CLASSNAME_MSG =
  "className на styled kit-контроле запрещён — Inline/Stack (позиция) или unstyled (вид).";
const VARIANT_SIZE_MSG = "kit использует tone/compact, не variant/size.";

const cases = [
  // G8.1 — styled <Button className> → 1 ошибка className-сообщения.
  {
    name: "<Button className/> → 1 G8 className",
    code: `const X = () => <Button className="x" />;`,
    expectCount: 1,
    expectMessage: CLASSNAME_MSG,
  },
  // unstyled-ветка легитимно несёт className → 0 ошибок.
  {
    name: "<Button unstyled className/> → 0",
    code: `const X = () => <Button unstyled className="x" />;`,
    expectCount: 0,
  },
  // tone — разрешённый проп → 0.
  {
    name: "<Button tone='primary'/> → 0",
    code: `const X = () => <Button tone="primary" />;`,
    expectCount: 0,
  },
  // G8.2 — closed leaf <IconButton className> → 1.
  {
    name: "<IconButton className/> → 1 G8 className",
    code: `const X = () => <IconButton aria-label="a" className="x" />;`,
    expectCount: 1,
    expectMessage: CLASSNAME_MSG,
  },
  // structural Stack — className РАЗРЕШЁН → 0.
  {
    name: "<Stack className/> → 0 (structural)",
    code: `const X = () => <Stack className="x" />;`,
    expectCount: 0,
  },
  // G8.3 — устаревший variant= на Button → 1 variant/size-сообщения.
  {
    name: "<Button variant='x'/> → 1 G8 variant/size",
    code: `const X = () => <Button variant="x" />;`,
    expectCount: 1,
    expectMessage: VARIANT_SIZE_MSG,
  },
  // G8.3 — устаревший size= на IconButton → 1.
  {
    name: "<IconButton size='lg'/> → 1 G8 variant/size",
    code: `const X = () => <IconButton aria-label="a" size="lg" />;`,
    expectCount: 1,
    expectMessage: VARIANT_SIZE_MSG,
  },
  // SubmitButton — обёртка над Button, голый union пропускал className мимо TS.
  {
    name: "<SubmitButton className/> → 1 G8 className",
    code: `const X = () => <SubmitButton className="x" />;`,
    expectCount: 1,
    expectMessage: CLASSNAME_MSG,
  },
  {
    name: "<SubmitButton variant='x'/> → 1 G8 variant/size",
    code: `const X = () => <SubmitButton variant="x" />;`,
    expectCount: 1,
    expectMessage: VARIANT_SIZE_MSG,
  },
];

let failures = 0;
for (const c of cases) {
  const msgs = lintSnippet(c.code);
  try {
    assert.equal(
      msgs.length,
      c.expectCount,
      `${c.name}: ожидалось ${c.expectCount} ошибок, получено ${msgs.length} (${msgs
        .map((m) => m.message)
        .join(" | ")})`,
    );
    if (c.expectMessage) {
      assert.ok(
        msgs.some((m) => m.message === c.expectMessage),
        `${c.name}: нет ожидаемого сообщения «${c.expectMessage}» (получено: ${msgs
          .map((m) => m.message)
          .join(" | ")})`,
      );
    }
    console.log(`  ok  ${c.name}`);
  } catch (err) {
    failures += 1;
    console.error(`  FAIL ${c.name}\n       ${err.message}`);
  }
}

if (failures > 0) {
  console.error(`\nGuardrail 8 fixture: ${failures} провал(ов)`);
  process.exit(1);
}
console.log(`\nGuardrail 8 fixture: все ${cases.length} кейсов прошли`);
