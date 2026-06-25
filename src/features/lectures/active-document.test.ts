import { describe, expect, it } from "vitest";

import { resolveActiveDocId } from "./active-document";

const DOCS = [{ id: "d1" }, { id: "d2" }, {}];

describe("resolveActiveDocId", () => {
  it("валидный ?doc выбирается", () => {
    expect(resolveActiveDocId(DOCS, "d2")).toBe("d2");
  });
  it("невалидный ?doc → первый по порядку (стопгап)", () => {
    expect(resolveActiveDocId(DOCS, "nope")).toBe("d1");
  });
  it("без ?doc → первый по порядку", () => {
    expect(resolveActiveDocId(DOCS, undefined)).toBe("d1");
  });
  it("нет документов → null", () => {
    expect(resolveActiveDocId([], "d1")).toBeNull();
  });
  it("документы без id отсеиваются", () => {
    expect(resolveActiveDocId([{}, { id: "d9" }], undefined)).toBe("d9");
  });
});
