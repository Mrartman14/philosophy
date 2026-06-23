import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import { pseudoizeString, pseudoizeCatalog } from "./pseudo";

describe("pseudoizeString", () => {
  it("акцентирует латинские буквы вне плейсхолдеров", () => {
    const out = pseudoizeString("Save");
    // Буквы преобразованы → исходного ASCII-слова в выводе нет.
    expect(out).not.toContain("Save");
    // Длиннее исходника (симуляция экспансии ~+40%).
    expect(out.length).toBeGreaterThan("Save".length);
  });

  it("оборачивает строку в маркеры ⟦…⟧ (для отлова усечения)", () => {
    const out = pseudoizeString("Hi");
    expect(out.startsWith("⟦")).toBe(true);
    expect(out.includes("⟧")).toBe(true);
  });

  it("сохраняет простой плейсхолдер {name} дословно", () => {
    const out = pseudoizeString("Hello {name}");
    expect(out).toContain("{name}");
  });

  it("сохраняет plural-блок целиком дословно (имена категорий, #, {count})", () => {
    const src = "{count, plural, one{# new comment} other{# new comments}}";
    const out = pseudoizeString(src);
    expect(out).toContain(src);
  });

  it("не вводит ICU-спецсимволы { } # ' в простой текст", () => {
    const out = pseudoizeString("Settings");
    expect(out).not.toMatch(/[{}#']/u);
  });

  it("результат с plural-блоком остаётся валидным ICU и интерполируется", () => {
    const src = "{count, plural, one{# new comment} other{# new comments}}";
    const messages = { ns: { greet: pseudoizeString(src) } };
    const t = createTranslator({ locale: "en", messages, namespace: "ns" });
    const rendered = t("greet", { count: 1 });
    // Если бы ICU сломался — next-intl вернул бы сам ключ "greet".
    expect(rendered).not.toBe("greet");
    expect(rendered).toContain("new comment");
    expect(rendered).toContain("1");
  });
});

describe("pseudoizeCatalog", () => {
  it("глубоко маппит строки, сохраняя ключи и вложенность", () => {
    const src = { a: "Hi", b: { c: "Yo {x}" } };
    const out = pseudoizeCatalog(src);
    expect(Object.keys(out)).toEqual(["a", "b"]);
    expect(Object.keys(out.b)).toEqual(["c"]);
    // Значения преобразованы, плейсхолдер цел.
    expect(out.a).not.toBe("Hi");
    expect(out.b.c).toContain("{x}");
  });

  it("не мутирует исходный каталог", () => {
    const src = { a: "Hi" };
    pseudoizeCatalog(src);
    expect(src.a).toBe("Hi");
  });
});
