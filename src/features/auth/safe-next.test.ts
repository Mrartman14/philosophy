import { describe, it, expect } from "vitest";

import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("undefined → /", () => { expect(safeNextPath(undefined)).toBe("/"); });
  it("null → /", () => { expect(safeNextPath(null)).toBe("/"); });
  it("пустая строка → /", () => { expect(safeNextPath("")).toBe("/"); });
  it("обычный путь → как есть", () =>
    { expect(safeNextPath("/admin/lectures")).toBe("/admin/lectures"); });
  it("путь с query → как есть", () =>
    { expect(safeNextPath("/admin?foo=bar")).toBe("/admin?foo=bar"); });
  it("protocol-relative //evil.com → /", () =>
    { expect(safeNextPath("//evil.com/x")).toBe("/"); });
  it("backslash-вариант /\\\\evil.com → /", () =>
    { expect(safeNextPath("/\\evil.com")).toBe("/"); });
  it("абсолютный https://… → /", () =>
    { expect(safeNextPath("https://evil.com")).toBe("/"); });
  it("javascript:… → /", () =>
    { expect(safeNextPath("javascript:alert(1)")).toBe("/"); });
  it("relative без слеша → /", () =>
    { expect(safeNextPath("admin")).toBe("/"); });
});
