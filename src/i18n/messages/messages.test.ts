// src/i18n/messages/messages.test.ts
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";

import ar from "./ar";
import en from "./en";
import ru from "./ru";

function flatKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object"
      ? flatKeys(v as Record<string, unknown>, path)
      : [path];
  });
}

describe("каталоги ru/en/ar", () => {
  it("en совпадает с ru по набору ключей", () => {
    expect(new Set(flatKeys(en))).toEqual(new Set(flatKeys(ru)));
  });
  it("ar совпадает с ru по набору ключей", () => {
    expect(new Set(flatKeys(ar))).toEqual(new Set(flatKeys(ru)));
  });
});

describe("ru ICU-плюрализация (commentCreated)", () => {
  const t = createTranslator({ locale: "ru", messages: ru, namespace: "notifications" });
  it("1 → форма one", () => {
    expect(t("commentCreated", { count: 1 })).toBe("1 новый комментарий");
  });
  it("2 → форма few", () => {
    expect(t("commentCreated", { count: 2 })).toBe("2 новых комментария");
  });
  it("5 → форма many", () => {
    expect(t("commentCreated", { count: 5 })).toBe("5 новых комментариев");
  });
  it("21 → форма one (CLDR)", () => {
    expect(t("commentCreated", { count: 21 })).toBe("21 новый комментарий");
  });
});
