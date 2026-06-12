// src/features/glossary/export-urls.test.ts
import { describe, it, expect } from "vitest";
import { glossaryExportUrls } from "./export-urls";

const BASE = "http://localhost:8090";

describe("glossaryExportUrls", () => {
  it("без termId — выгрузки списка: /api/glossary.md|.txt", () => {
    const urls = glossaryExportUrls(BASE);
    expect(urls.md).toBe("http://localhost:8090/api/glossary.md");
    expect(urls.txt).toBe("http://localhost:8090/api/glossary.txt");
  });

  it("с termId — выгрузки термина: /api/glossary/{id}.md|.txt", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    const urls = glossaryExportUrls(BASE, id);
    expect(urls.md).toBe(`http://localhost:8090/api/glossary/${id}.md`);
    expect(urls.txt).toBe(`http://localhost:8090/api/glossary/${id}.txt`);
  });

  it("обрезает хвостовые слэши базового URL", () => {
    const urls = glossaryExportUrls("http://localhost:8090/");
    expect(urls.md).toBe("http://localhost:8090/api/glossary.md");
  });

  it("URL-кодирует termId", () => {
    const urls = glossaryExportUrls(BASE, "a/b c");
    expect(urls.md).toBe("http://localhost:8090/api/glossary/a%2Fb%20c.md");
    expect(urls.txt).toBe("http://localhost:8090/api/glossary/a%2Fb%20c.txt");
  });
});
