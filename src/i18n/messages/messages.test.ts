// src/i18n/messages/messages.test.ts
import { describe, expect, it } from "vitest";

import ar from "./ar";
import en from "./en";
import ru from "./ru";
import zh from "./zh";

function flatKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object"
      ? flatKeys(v as Record<string, unknown>, path)
      : [path];
  });
}

describe("каталоги ru/en/ar/zh", () => {
  it("en совпадает с ru по набору ключей", () => {
    expect(new Set(flatKeys(en))).toEqual(new Set(flatKeys(ru)));
  });
  it("ar совпадает с ru по набору ключей", () => {
    expect(new Set(flatKeys(ar))).toEqual(new Set(flatKeys(ru)));
  });
  it("zh совпадает с ru по набору ключей", () => {
    expect(new Set(flatKeys(zh))).toEqual(new Set(flatKeys(ru)));
  });
});
