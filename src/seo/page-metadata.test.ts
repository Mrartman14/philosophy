import { afterEach, describe, expect, it, vi } from "vitest";

import { buildPageMetadata, ogLocale } from "./page-metadata";

afterEach(() => {
  vi.unstubAllEnvs();
});

function withBase() {
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.com");
}

const base = { title: "T", siteName: "Сайт", path: "/x" };

describe("buildPageMetadata", () => {
  it("canonical/og:url = self-URL, type=article, siteName задан", () => {
    withBase();
    expect(buildPageMetadata({ ...base, path: "/lectures/42" })).toMatchObject({
      alternates: { canonical: "https://example.com/lectures/42" },
      openGraph: {
        url: "https://example.com/lectures/42",
        type: "article",
        siteName: "Сайт",
      },
    });
  });
  it("реальная картинка → summary_large_image + og:image с alt", () => {
    withBase();
    expect(
      buildPageMetadata({ ...base, image: "/static/files/abc", imageAlt: "Обложка" }),
    ).toMatchObject({
      openGraph: { images: [{ url: "/static/files/abc", alt: "Обложка" }] },
      twitter: { card: "summary_large_image", images: ["/static/files/abc"] },
    });
  });
  it("без alt — og:image строкой (без объекта)", () => {
    withBase();
    expect(buildPageMetadata({ ...base, image: "/static/files/x" })).toMatchObject({
      openGraph: { images: ["/static/files/x"] },
    });
  });
  it("без картинки (null/пусто) → дефолт /logo.png + twitter summary", () => {
    withBase();
    expect(buildPageMetadata({ ...base, image: null })).toMatchObject({
      openGraph: { images: ["/logo.png"] },
      twitter: { card: "summary" },
    });
    expect(buildPageMetadata({ ...base, image: "" })).toMatchObject({
      openGraph: { images: ["/logo.png"] },
    });
  });
  it("description прокидывается в meta/og", () => {
    withBase();
    expect(buildPageMetadata({ ...base, description: "D" })).toMatchObject({
      description: "D",
      openGraph: { description: "D" },
    });
  });
  it("без description — поле отсутствует", () => {
    withBase();
    expect(buildPageMetadata({ ...base }).description).toBeUndefined();
  });
  it("og:locale и article:published_time когда заданы", () => {
    withBase();
    expect(
      buildPageMetadata({
        ...base,
        locale: "ru_RU",
        publishedTime: "2026-01-02T03:04:05Z",
      }),
    ).toMatchObject({
      openGraph: { locale: "ru_RU", publishedTime: "2026-01-02T03:04:05Z" },
    });
  });
});

describe("ogLocale", () => {
  it("маппит ru→ru_RU, en→en_US, иначе как есть", () => {
    expect(ogLocale("ru")).toBe("ru_RU");
    expect(ogLocale("en")).toBe("en_US");
    expect(ogLocale("xx")).toBe("xx");
  });
});
