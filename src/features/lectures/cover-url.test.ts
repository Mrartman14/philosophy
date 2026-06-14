import { afterEach, describe, expect, it, vi } from "vitest";

import { lectureCoverUrl } from "./cover-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("lectureCoverUrl", () => {
  it("undefined ключ → null", () => {
    expect(lectureCoverUrl(undefined)).toBeNull();
  });

  it("пустой ключ → null", () => {
    expect(lectureCoverUrl("")).toBeNull();
  });

  it("строит URL из NEXT_PUBLIC_STORAGE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_STORAGE_URL", "https://cdn.example");
    expect(lectureCoverUrl("abc123")).toBe("https://cdn.example/static/files/abc123");
  });

  it("фолбэк на NEXT_PUBLIC_API_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_STORAGE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example");
    expect(lectureCoverUrl("k")).toBe("https://api.example/static/files/k");
  });
});
