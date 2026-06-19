import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE } from "./locales";
import { detectFromAcceptLanguage, parseStoredLocale, resolveLocale } from "./resolve";

describe("parseStoredLocale", () => {
  it("принимает валидные значения", () => {
    expect(parseStoredLocale("ru")).toBe("ru");
    expect(parseStoredLocale("en")).toBe("en");
    expect(parseStoredLocale("system")).toBe("system");
  });
  it("невалидное/пустое → system", () => {
    expect(parseStoredLocale("de")).toBe("system");
    expect(parseStoredLocale(undefined)).toBe("system");
  });
});

describe("detectFromAcceptLanguage", () => {
  it("выбирает поддерживаемый primary subtag", () => {
    expect(detectFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
    expect(detectFromAcceptLanguage("ru-RU,ru;q=0.8")).toBe("ru");
  });
  it("неизвестный/пустой → DEFAULT_LOCALE", () => {
    expect(detectFromAcceptLanguage("fr-FR,de;q=0.5")).toBe(DEFAULT_LOCALE);
    expect(detectFromAcceptLanguage(null)).toBe(DEFAULT_LOCALE);
    expect(detectFromAcceptLanguage("")).toBe(DEFAULT_LOCALE);
  });
});

describe("resolveLocale", () => {
  it("явный ru/en возвращается как есть", () => {
    expect(resolveLocale("ru", "en-US")).toBe("ru");
    expect(resolveLocale("en", "ru-RU")).toBe("en");
  });
  it("system → детект из Accept-Language", () => {
    expect(resolveLocale("system", "en-GB")).toBe("en");
    expect(resolveLocale("system", null)).toBe(DEFAULT_LOCALE);
  });
});
