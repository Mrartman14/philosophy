// eslint.config.test.mjs
//
// Фикстура-тест Guardrail 8 (className/variant/size закрыты на kit-контролах)
// + Guardrail 10 (RTL: запрет физических direction-токенов в className/cn()/const/style).
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
// ui-scope путь: реальный .tsx из src/components/ui/** — G7/8 его ИГНОРЯТ, но
// Guardrail 10 (RTL) живёт в последнем-матчнувшем блоке без ignores для ui/**,
// поэтому физический токен ТАМ обязан флагаться (доказательство ui-покрытия G10).
const UI_FILE = "src/components/ui/table.tsx";

/**
 * Прогоняет код через flat-config и возвращает только G8/G7/G10-сообщения.
 * Опциональный filename — для скоупинга под конкретный блок (по умолчанию APP_FILE).
 */
function lintSnippet(code, filename = APP_FILE) {
  const messages = linter.verify(code, eslintConfig, { filename });
  return messages.filter((m) => m.ruleId === "no-restricted-syntax");
}

const CLASSNAME_MSG =
  "className на styled kit-контроле запрещён — Inline/Stack (позиция) или unstyled (вид).";
const VARIANT_SIZE_MSG = "kit использует tone/compact, не variant/size.";

// Guardrail 10 (RTL) — сообщения физических direction-токенов.
const RTL_MARGIN_MSG =
  "RTL: физический отступ ml/mr/pl/pr запрещён — используй логические ms/me/ps/pe.";
const RTL_INSET_MSG =
  "RTL: физический inset left/right запрещён — используй логические start/end (inset-inline).";
const RTL_TEXT_MSG = "RTL: text-left/text-right запрещён — используй text-start/text-end.";
const RTL_FLOAT_MSG = "RTL: float-left/float-right запрещён — используй float-start/float-end.";
const RTL_BORDER_MSG =
  "RTL: border-l/border-r запрещён — используй логические border-s/border-e.";
const RTL_ROUNDED_MSG =
  "RTL: rounded-l/rounded-r запрещён — используй логические rounded-s/rounded-e.";
const RTL_STYLE_MSG =
  "RTL: физическое свойство (marginLeft/paddingRight/borderLeft…) запрещено — используй *Inline*/inset-inline.";
const RTL_STYLE_INSET_MSG =
  "RTL: физический inset left/right в style запрещён — используй inset-inline-start/end.";
const RTL_TEXTALIGN_MSG = "RTL: textAlign left/right запрещён — используй textAlign start/end.";

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

  // ── Guardrail 10 (RTL): физические direction-токены ──────────────────────
  // Позитив — флагается ровно 1 RTL-ошибкой (одиночный токен).
  {
    name: "RTL className='ml-2' → 1 inset/margin",
    code: `const X = () => <div className="ml-2" />;`,
    expectCount: 1,
    expectMessage: RTL_MARGIN_MSG,
  },
  {
    name: "RTL className='mr-2' → 1 margin",
    code: `const X = () => <div className="mr-2" />;`,
    expectCount: 1,
    expectMessage: RTL_MARGIN_MSG,
  },
  {
    name: "RTL className='pl-2' → 1 margin",
    code: `const X = () => <div className="pl-2" />;`,
    expectCount: 1,
    expectMessage: RTL_MARGIN_MSG,
  },
  {
    name: "RTL className='pr-2' → 1 margin",
    code: `const X = () => <div className="pr-2" />;`,
    expectCount: 1,
    expectMessage: RTL_MARGIN_MSG,
  },
  {
    name: "RTL className='-ml-2' (отрицательный) → 1 margin",
    code: `const X = () => <div className="-ml-2" />;`,
    expectCount: 1,
    expectMessage: RTL_MARGIN_MSG,
  },
  // Произвольное значение ml-[4px] — скобка [ в классе значений ловит arbitrary (Finding #8).
  {
    name: "RTL className='ml-[4px]' (произвольное значение) → 1 margin",
    code: `const X = () => <div className="ml-[4px]" />;`,
    expectCount: 1,
    expectMessage: RTL_MARGIN_MSG,
  },
  // ── Guardrail 10 ПОД src/components/ui/** (G7/8 этот scope игнорят, G10 — нет) ──
  // Доказательство: физический токен флагается ДАЖЕ в ui-kit (Finding #7).
  {
    name: "RTL (ui-scope) className='ml-2' под src/components/ui → 1 margin",
    code: `const X = () => <div className="ml-2" />;`,
    filename: UI_FILE,
    expectCount: 1,
    expectMessage: RTL_MARGIN_MSG,
  },
  {
    name: "RTL className='text-left' → 1 text",
    code: `const X = () => <div className="text-left" />;`,
    expectCount: 1,
    expectMessage: RTL_TEXT_MSG,
  },
  {
    name: "RTL className='text-right' → 1 text",
    code: `const X = () => <div className="text-right" />;`,
    expectCount: 1,
    expectMessage: RTL_TEXT_MSG,
  },
  {
    name: "RTL className='float-left' → 1 float",
    code: `const X = () => <div className="float-left" />;`,
    expectCount: 1,
    expectMessage: RTL_FLOAT_MSG,
  },
  {
    name: "RTL className='border-l' → 1 border",
    code: `const X = () => <div className="border-l" />;`,
    expectCount: 1,
    expectMessage: RTL_BORDER_MSG,
  },
  {
    name: "RTL className='border-r' → 1 border",
    code: `const X = () => <div className="border-r" />;`,
    expectCount: 1,
    expectMessage: RTL_BORDER_MSG,
  },
  {
    name: "RTL className='border-l-2' → 1 border",
    code: `const X = () => <div className="border-l-2" />;`,
    expectCount: 1,
    expectMessage: RTL_BORDER_MSG,
  },
  // Голые rounded-l/rounded-r в конце строки — флагаются (граница $).
  {
    name: "RTL className='rounded-l' (одиночный) → 1 rounded",
    code: `const X = () => <div className="rounded-l" />;`,
    expectCount: 1,
    expectMessage: RTL_ROUNDED_MSG,
  },
  {
    name: "RTL className='rounded-r-lg' → 1 rounded",
    code: `const X = () => <div className="rounded-r-lg" />;`,
    expectCount: 1,
    expectMessage: RTL_ROUNDED_MSG,
  },
  // Модификаторы (hover:/md:/data-[…]:) перед физическим токеном — граница ловит «:».
  // Здесь 2 РАЗНЫХ селектора (margin + text) бьют по одному узлу → 2 ошибки.
  {
    name: "RTL className='hover:ml-2 md:text-left' → 2 (margin + text, модификаторы)",
    code: `const X = () => <div className="hover:ml-2 md:text-left" />;`,
    expectCount: 2,
  },
  {
    name: "RTL className='-right-0.5' → 1 inset",
    code: `const X = () => <div className="-right-0.5" />;`,
    expectCount: 1,
    expectMessage: RTL_INSET_MSG,
  },
  {
    name: "RTL className='-left-4' → 1 inset",
    code: `const X = () => <div className="-left-4" />;`,
    expectCount: 1,
    expectMessage: RTL_INSET_MSG,
  },
  {
    name: "RTL className='left-0' → 1 inset",
    code: `const X = () => <div className="left-0" />;`,
    expectCount: 1,
    expectMessage: RTL_INSET_MSG,
  },
  {
    name: "RTL className='right-3' → 1 inset",
    code: `const X = () => <div className="right-3" />;`,
    expectCount: 1,
    expectMessage: RTL_INSET_MSG,
  },
  // cn()-аргумент — обычный Literal внутри CallExpression, ловится тем же селектором.
  {
    name: "RTL cn('border-l rounded', x) → 1 border",
    code: `const c = cn("border-l rounded", x);`,
    expectCount: 1,
    expectMessage: RTL_BORDER_MSG,
  },
  // вынесенная const-строка классов — тоже Literal. no-restricted-syntax репортит
  // ОДНУ ошибку на УЗЕЛ (не на каждое вхождение токена), поэтому строка с двумя
  // физическими токенами (left-0 + right-0) даёт ровно 1 ошибку.
  {
    name: "RTL const='fixed left-0 right-0' → 1 inset (1 узел)",
    code: `const c = "fixed left-0 right-0";`,
    expectCount: 1,
    expectMessage: RTL_INSET_MSG,
  },
  // data-[side=…]-компаньон с физическим right-[…] БЕЗ disable — флагается (exempt
  // закрыт построчным eslint-disable в реальном коде, см. app-header.tsx).
  {
    name: "RTL 'data-[side=left]:before:right-[-10px]' → 1 inset (без disable)",
    code: `const c = "data-[side=left]:before:right-[-10px]";`,
    expectCount: 1,
    expectMessage: RTL_INSET_MSG,
  },
  // style-объекты: физические свойства и textAlign.
  {
    name: "RTL style={{ marginLeft: 4 }} → 1 style",
    code: `const X = () => <div style={{ marginLeft: 4 }} />;`,
    expectCount: 1,
    expectMessage: RTL_STYLE_MSG,
  },
  {
    name: "RTL style={{ left: 5 }} → 1 inset-in-style",
    code: `const X = () => <div style={{ left: 5 }} />;`,
    expectCount: 1,
    expectMessage: RTL_STYLE_INSET_MSG,
  },
  {
    name: "RTL style={{ textAlign: 'left' }} → 1 textAlign",
    code: `const X = () => <div style={{ textAlign: "left" }} />;`,
    expectCount: 1,
    expectMessage: RTL_TEXTALIGN_MSG,
  },

  // ── Guardrail 10 (RTL): негатив — логические/нейтральные токены НЕ флагаются ──
  {
    name: "RTL негатив: логические ms/me/ps/pe/text-end/border-s/border-x/rounded-lg/px-4 → 0",
    code: `const X = () => <div className="ms-2 me-2 ps-2 pe-2 text-end border-s border-x rounded-lg rounded-md px-4 py-2" />;`,
    expectCount: 0,
  },
  {
    name: "RTL негатив: '-end-0.5' → 0",
    code: `const X = () => <div className="-end-0.5" />;`,
    expectCount: 0,
  },
  {
    name: "RTL негатив: 'left-aligned' (substring, не класс) → 0",
    code: `const c = "left-aligned";`,
    expectCount: 0,
  },
  {
    name: "RTL негатив: style={{ marginInlineStart: 4 }} → 0",
    code: `const X = () => <div style={{ marginInlineStart: 4 }} />;`,
    expectCount: 0,
  },
  {
    name: "RTL негатив: style={{ textAlign: 'start' }} → 0",
    code: `const X = () => <div style={{ textAlign: "start" }} />;`,
    expectCount: 0,
  },
  {
    name: "RTL негатив: inset-x-0 / rounded-full / overflow-hidden / flex-row → 0",
    code: `const X = () => <div className="inset-x-0 rounded-full overflow-hidden flex-row" />;`,
    expectCount: 0,
  },
  // Голый объектный литерал с left/right (НЕ в style) — координатный/геометрический
  // API (posAtCoords, getBoundingClientRect-мок), НЕ CSS-layout → НЕ флагать.
  {
    name: "RTL негатив: posAtCoords({ left: x, top: y }) (координаты, не style) → 0",
    code: `const p = view.posAtCoords({ left: drag.clientX, top: drag.clientY });`,
    expectCount: 0,
  },
  {
    name: "RTL негатив: getBoundingClientRect-мок { left: 0, top: 0 } → 0",
    code: `const rect = { left: 0, top: 0, width: 200, height: 100 };`,
    expectCount: 0,
  },
  // CSS-специфичные имена (marginLeft/borderLeft) флагаются в ЛЮБОМ объекте —
  // эти имена не пересекаются с координатными API.
  {
    name: "RTL: { marginLeft: 4 } в любом объекте → 1 style",
    code: `const s = { marginLeft: 4 };`,
    expectCount: 1,
    expectMessage: RTL_STYLE_MSG,
  },
];

let failures = 0;
for (const c of cases) {
  const msgs = lintSnippet(c.code, c.filename);
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
  console.error(`\nGuardrail 8+10 fixture: ${failures} провал(ов)`);
  process.exit(1);
}
console.log(`\nGuardrail 8+10 fixture: все ${cases.length} кейсов прошли`);
