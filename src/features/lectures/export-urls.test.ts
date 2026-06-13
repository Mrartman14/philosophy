import { describe, expect, it } from "vitest";
import { lectureExportUrls } from "./export-urls";

describe("lectureExportUrls", () => {
  it("строит прокси-пути с экранированием id", () => {
    const u = lectureExportUrls("a b/c");
    expect(u.md).toBe("/lectures/a%20b%2Fc/export?format=md");
    expect(u.txt).toBe("/lectures/a%20b%2Fc/export?format=txt");
  });

  it("обычный uuid", () => {
    const u = lectureExportUrls("11111111-1111-1111-1111-111111111111");
    expect(u.md).toBe("/lectures/11111111-1111-1111-1111-111111111111/export?format=md");
    expect(u.txt).toBe("/lectures/11111111-1111-1111-1111-111111111111/export?format=txt");
  });
});
