// src/i18n/messages/icu-parity.test.ts
// Рантайм-тест ICU-паритета: проверяет, что имена аргументов плейсхолдеров
// и plural-категории в ru и en совпадают (там где должны) по каждому ключу.
// Закрывает находку B4 из ревью 2026-06-20.
import { describe, expect, it } from "vitest";

import en from "./en";
import ru from "./ru";

// ---------------------------------------------------------------------------
// Утилиты
// ---------------------------------------------------------------------------

/** Рекурсивно раскрывает каталог в плоскую мапу dotted.key → string */
function flatEntries(
  obj: Record<string, unknown>,
  prefix = "",
): Map<string, string> {
  const result = new Map<string, string>();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") {
      for (const [subPath, subVal] of flatEntries(
        v as Record<string, unknown>,
        path,
      )) {
        result.set(subPath, subVal);
      }
    } else if (typeof v === "string") {
      result.set(path, v);
    }
  }
  return result;
}

/**
 * Извлекает множество имён ICU-аргументов из строки.
 *
 * Покрываемые паттерны (подмножество ICU, разрешённое в каталоге):
 *   {name}             → простой плейсхолдер
 *   {count, plural, …} → plural-блок; «count» — имя аргумента
 *
 * Алгоритм: \{(\w+)\s*(?:,|\}) ловит имя перед запятой или закрывающей скобкой.
 * Символ # внутри plural-блока не является плейсхолдером — не захватывается.
 */
function extractArgNames(value: string): Set<string> {
  const names = new Set<string>();
  // \{ — открывающая скобка
  // (\w+) — имя аргумента
  // \s*(?:,|\}) — либо запятая (plural/select), либо закрытие }
  const re = /\{(\w+)\s*(?:,|\})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    names.add(m[1]);
  }
  return names;
}

/**
 * Находит первый plural-блок в строке и возвращает весь его текст
 * от внешней { до балансирующей } включительно.
 * Например: «{count, plural, one{# x} other{# xs}}»
 * Возвращает null, если plural-блока нет.
 */
function extractPluralBody(value: string): string | null {
  // Ищем начало ВНЕШНЕГО plural-блока: {argname, plural,
  const outerStart = value.search(/\{\w+\s*,\s*plural\s*,/);
  if (outerStart === -1) return null;

  // Балансируем скобки от outerStart, чтобы захватить весь plural-блок
  let depth = 0;
  let end = -1;
  for (let i = outerStart; i < value.length; i++) {
    if (value[i] === "{") depth++;
    else if (value[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;
  return value.slice(outerStart, end + 1);
}

/**
 * Извлекает множество plural-категорий из тела plural-блока.
 * Распознаёт: zero one two few many other (CLDR-слова перед {)
 * а также =N (explicit value перед {).
 */
function extractPluralCategories(pluralBody: string): Set<string> {
  const cats = new Set<string>();
  const wordRe = /\b(zero|one|two|few|many|other)\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = wordRe.exec(pluralBody)) !== null) {
    cats.add(m[1]);
  }
  const numRe = /=([\d]+)\s*\{/g;
  while ((m = numRe.exec(pluralBody)) !== null) {
    cats.add(`=${m[1]}`);
  }
  return cats;
}

// ---------------------------------------------------------------------------
// Тестовые данные
// ---------------------------------------------------------------------------

const ruFlat = flatEntries(ru as unknown as Record<string, unknown>);
const enFlat = flatEntries(en as unknown as Record<string, unknown>);

// Ключи с хотя бы одним ICU-аргументом в ru
const keysWithArgs = [...ruFlat.keys()].filter((k) => {
  const v = ruFlat.get(k);
  return v !== undefined && extractArgNames(v).size > 0;
});

// Ключи с plural-блоком в ru
const keysWithPluralRu = [...ruFlat.keys()].filter((k) => {
  const v = ruFlat.get(k);
  return v !== undefined && extractPluralBody(v) !== null;
});

// Ключи с plural-блоком в en
const keysWithPluralEn = [...enFlat.keys()].filter((k) => {
  const v = enFlat.get(k);
  return v !== undefined && extractPluralBody(v) !== null;
});

// ---------------------------------------------------------------------------
// Тесты
// ---------------------------------------------------------------------------

describe("ICU arg-name parity ru/en", () => {
  it("должен найти ICU-ключи с аргументами (тест не вакуумный)", () => {
    // Санити-проверка: каталог содержит хотя бы N ключей с плейсхолдерами
    expect(keysWithArgs.length).toBeGreaterThan(10);
  });

  it("имена ICU-аргументов идентичны в ru и en для каждого ключа", () => {
    const mismatches: string[] = [];

    for (const key of [...ruFlat.keys()]) {
      const ruVal = ruFlat.get(key) ?? "";
      const enVal = enFlat.get(key) ?? "";

      const ruArgs = extractArgNames(ruVal);
      const enArgs = extractArgNames(enVal);

      const inRuNotEn = [...ruArgs].filter((a) => !enArgs.has(a));
      const inEnNotRu = [...enArgs].filter((a) => !ruArgs.has(a));

      if (inRuNotEn.length > 0 || inEnNotRu.length > 0) {
        mismatches.push(
          `${key}:\n` +
            (inRuNotEn.length
              ? `  в ru, но не в en: {${inRuNotEn.join("}, {")}}\n`
              : "") +
            (inEnNotRu.length
              ? `  в en, но не в ru: {${inEnNotRu.join("}, {")}}\n`
              : "") +
            `  ru: "${ruVal}"\n` +
            `  en: "${enVal}"`,
        );
      }
    }

    expect(
      mismatches,
      `Расхождение ICU-аргументов в ${mismatches.length.toString()} ключе(ах):\n\n${mismatches.join("\n\n")}`,
    ).toHaveLength(0);
  });
});

describe("ICU plural-category validity ru", () => {
  // Требуемый минимальный набор категорий для русских plural-блоков.
  // CLDR Russian: one / few / many / other (все 4 реально используются в каталоге).
  const RU_REQUIRED = ["one", "few", "many", "other"] as const;

  it("должен найти plural-блоки в ru (тест не вакуумный)", () => {
    expect(keysWithPluralRu.length).toBeGreaterThan(0);
  });

  it("ru plural-блоки содержат все обязательные CLDR-категории (one/few/many/other)", () => {
    const missing: string[] = [];

    for (const key of keysWithPluralRu) {
      const val = ruFlat.get(key) ?? "";
      const body = extractPluralBody(val);
      if (body === null) continue;
      const cats = extractPluralCategories(body);

      const absent = RU_REQUIRED.filter((c) => !cats.has(c));
      if (absent.length > 0) {
        missing.push(
          `${key}: отсутствуют категории [${absent.join(", ")}]\n  ru: "${val}"`,
        );
      }
    }

    expect(
      missing,
      `Неполные ru plural-категории в ${missing.length.toString()} ключе(ах):\n\n${missing.join("\n\n")}`,
    ).toHaveLength(0);
  });
});

describe("ICU plural-category validity en", () => {
  // Минимальный набор категорий для английских plural-блоков: one + other.
  const EN_REQUIRED = ["one", "other"] as const;

  it("должен найти plural-блоки в en (тест не вакуумный)", () => {
    expect(keysWithPluralEn.length).toBeGreaterThan(0);
  });

  it("en plural-блоки содержат минимальные CLDR-категории (one/other)", () => {
    const missing: string[] = [];

    for (const key of keysWithPluralEn) {
      const val = enFlat.get(key) ?? "";
      const body = extractPluralBody(val);
      if (body === null) continue;
      const cats = extractPluralCategories(body);

      const absent = EN_REQUIRED.filter((c) => !cats.has(c));
      if (absent.length > 0) {
        missing.push(
          `${key}: отсутствуют категории [${absent.join(", ")}]\n  en: "${val}"`,
        );
      }
    }

    expect(
      missing,
      `Неполные en plural-категории в ${missing.length.toString()} ключе(ах):\n\n${missing.join("\n\n")}`,
    ).toHaveLength(0);
  });
});

describe("ICU plural presence symmetry ru/en", () => {
  it("набор ключей с plural-блоком совпадает в ru и en", () => {
    const ruPluralKeys = new Set(keysWithPluralRu);
    const enPluralKeys = new Set(keysWithPluralEn);

    const inRuNotEn = [...ruPluralKeys].filter((k) => !enPluralKeys.has(k));
    const inEnNotRu = [...enPluralKeys].filter((k) => !ruPluralKeys.has(k));

    const problems: string[] = [];
    if (inRuNotEn.length) {
      problems.push(
        `plural в ru, но не в en:\n${inRuNotEn.map((k) => `  ${k}: "${ruFlat.get(k) ?? ""}"`).join("\n")}`,
      );
    }
    if (inEnNotRu.length) {
      problems.push(
        `plural в en, но не в ru:\n${inEnNotRu.map((k) => `  ${k}: "${enFlat.get(k) ?? ""}"`).join("\n")}`,
      );
    }

    expect(
      problems,
      `Асимметрия ключей с plural-блоком:\n\n${problems.join("\n\n")}`,
    ).toHaveLength(0);
  });
});
