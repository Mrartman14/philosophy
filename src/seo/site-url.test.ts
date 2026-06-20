import { afterEach, describe, expect, it, vi } from "vitest";

import { metadataBaseUrl, siteUrl } from "./site-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("siteUrl", () => {
  it("абсолютный URL от NEXT_PUBLIC_BASE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.com");
    expect(siteUrl("/lectures/42")).toBe("https://example.com/lectures/42");
  });
  it("срезает хвостовой слеш базы", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.com/");
    expect(siteUrl("/x")).toBe("https://example.com/x");
  });
  it("корень — без хвостового слеша", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.com");
    expect(siteUrl("/")).toBe("https://example.com");
    expect(siteUrl()).toBe("https://example.com");
  });
  it("добавляет ведущий слеш к path", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.com");
    expect(siteUrl("sitemap.xml")).toBe("https://example.com/sitemap.xml");
  });
  it("дефолт при пустом/неустановленном env", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
    expect(siteUrl("/a")).toBe("http://localhost:3001/a");
  });
});

describe("metadataBaseUrl", () => {
  it("URL с origin базы", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.com");
    expect(metadataBaseUrl().origin).toBe("https://example.com");
  });
});
