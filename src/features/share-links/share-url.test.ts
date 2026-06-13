// src/features/share-links/share-url.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildShareUrl } from "./share-url";

const ORIG = process.env.NEXT_PUBLIC_BASE_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_BASE_URL = ORIG;
});

describe("buildShareUrl", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://example.test/app";
  });

  it("строит URL документа с токеном", () => {
    expect(buildShareUrl("document", "doc-1", "tok-abc")).toBe(
      "https://example.test/app/documents/doc-1?token=tok-abc",
    );
  });

  it("строит URL лекции", () => {
    expect(buildShareUrl("lecture", "lec-9", "t")).toBe(
      "https://example.test/app/lectures/lec-9?token=t",
    );
  });

  it("строит URL медиа / трейла / формы по своим сегментам", () => {
    expect(buildShareUrl("media", "m1", "t")).toContain("/media/m1?token=t");
    expect(buildShareUrl("trail", "tr1", "t")).toContain("/trails/tr1?token=t");
    expect(buildShareUrl("form", "f1", "t")).toContain("/forms/f1?token=t");
  });

  it("экранирует токен и id", () => {
    expect(buildShareUrl("document", "a b", "x/y")).toBe(
      "https://example.test/app/documents/a%20b?token=x%2Fy",
    );
  });

  it("не дублирует base, если NEXT_PUBLIC_BASE_URL с завершающим слешем", () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://example.test/app/";
    expect(buildShareUrl("document", "d", "t")).toBe(
      "https://example.test/app/documents/d?token=t",
    );
  });

  it("строит URL канваса (страница /canvases/{id} есть с фазы 1)", () => {
    expect(buildShareUrl("canvas", "c1", "t")).toBe(
      "https://example.test/app/canvases/c1?token=t",
    );
  });
});
