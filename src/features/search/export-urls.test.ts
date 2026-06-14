// src/features/search/export-urls.test.ts
import { describe, it, expect } from "vitest";

import { searchExportMdUrl } from "./export-urls";

const BASE = "http://localhost:8080";

describe("searchExportMdUrl", () => {
  it("строит ссылку с q", () => {
    expect(searchExportMdUrl(BASE, { q: "кант" })).toBe(
      "http://localhost:8080/api/search.md?q=%D0%BA%D0%B0%D0%BD%D1%82",
    );
  });
  it("percent-кодирует пробелы и спецсимволы в q", () => {
    expect(searchExportMdUrl(BASE, { q: "a b&c" })).toBe(
      "http://localhost:8080/api/search.md?q=a+b%26c",
    );
  });
  it("добавляет type, когда задан", () => {
    expect(searchExportMdUrl(BASE, { q: "x", type: "glossary" })).toBe(
      "http://localhost:8080/api/search.md?q=x&type=glossary",
    );
  });
  it("не добавляет type, когда не задан", () => {
    expect(searchExportMdUrl(BASE, { q: "x" })).toBe(
      "http://localhost:8080/api/search.md?q=x",
    );
  });
  it("срезает хвостовые слэши базового URL", () => {
    expect(searchExportMdUrl("http://localhost:8080/", { q: "x" })).toBe(
      "http://localhost:8080/api/search.md?q=x",
    );
  });
});
