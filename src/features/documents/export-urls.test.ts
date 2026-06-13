// src/features/documents/export-urls.test.ts
import { describe, expect, it } from "vitest";
import { documentExportUrls } from "./export-urls";

describe("documentExportUrls", () => {
  it("строит прокси-пути с экранированием id", () => {
    const u = documentExportUrls("a b/c");
    expect(u.md).toBe("/documents/a%20b%2Fc/export?format=md");
    expect(u.txt).toBe("/documents/a%20b%2Fc/export?format=txt");
  });
  it("обычный uuid", () => {
    const u = documentExportUrls("11111111-1111-1111-1111-111111111111");
    expect(u.md).toBe("/documents/11111111-1111-1111-1111-111111111111/export?format=md");
    expect(u.txt).toBe("/documents/11111111-1111-1111-1111-111111111111/export?format=txt");
  });
});
