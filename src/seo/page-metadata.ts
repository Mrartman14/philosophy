// src/seo/page-metadata.ts
// Сборка per-page метаданных: Open Graph + Twitter + canonical. Вся логика SEO-страниц
// здесь (тестируемо), а generateMetadata страниц — тонкая обвязка поверх этого.
import type { Metadata } from "next";

import { siteUrl } from "./site-url";

const DEFAULT_OG_IMAGE = "/logo.png";

const OG_LOCALE: Record<string, string> = { ru: "ru_RU", en: "en_US" };

/** Резолвит UI-локаль ("ru"/"en") в og:locale ("ru_RU"/"en_US"); иначе — как есть. */
export function ogLocale(resolved: string): string {
  return OG_LOCALE[resolved] ?? resolved;
}

export interface PageMetadataInput {
  title: string;
  /** og:site_name. Next ЗАМЕНЯЕТ (не мержит) openGraph дочерней страницы — поэтому
   *  siteName надо задавать на каждой странице, иначе он пропадёт. */
  siteName: string;
  // `| undefined` обязателен: под exactOptionalPropertyTypes значение `string|undefined`
  // (напр. lecture?.description) НЕ присваивается в `?: string`.
  description?: string | undefined;
  /** Абсолютный или root-relative URL картинки; Next абсолютизирует относительный
   *  через metadataBase. Пусто/нет → дефолт /logo.png. */
  image?: string | null;
  /** alt для og:image (у лекций — cover_image_alt). */
  imageAlt?: string | undefined;
  /** og:locale в BCP-47-стиле "ru_RU"/"en_US" (используй ogLocale()). */
  locale?: string | undefined;
  /** article:published_time (ISO datetime, напр. created_at). */
  publishedTime?: string | undefined;
  /** Путь страницы для canonical/og:url, напр. "/lectures/42". */
  path: string;
}

export function buildPageMetadata({
  title,
  siteName,
  description,
  image,
  imageAlt,
  locale,
  publishedTime,
  path,
}: PageMetadataInput): Metadata {
  const url = siteUrl(path);
  const hasImage = Boolean(image && image.length > 0);
  const ogImage = hasImage && image ? image : DEFAULT_OG_IMAGE;
  const imageEntry = imageAlt ? { url: ogImage, alt: imageAlt } : ogImage;
  return {
    title,
    ...(description ? { description } : {}),
    alternates: { canonical: url },
    openGraph: {
      title,
      siteName,
      type: "article",
      url,
      images: [imageEntry],
      ...(description ? { description } : {}),
      ...(locale ? { locale } : {}),
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      // summary_large_image только при настоящей обложке; для дефолт-логотипа —
      // summary (логотип не 1200×630, large-card его уродует).
      card: hasImage ? "summary_large_image" : "summary",
      title,
      images: [ogImage],
      ...(description ? { description } : {}),
    },
  };
}
