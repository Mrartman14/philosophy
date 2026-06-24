// src/components/ast-render/safe-href.ts
/**
 * Разрешённые href: абсолютные http(s):, относительные (начинаются с "/"),
 * якоря (начинаются с "#") и mailto:. Остальные — рендерятся как plain text.
 * Read-only санитайз пользовательского href в `link`-марке (см. SANITIZE_HREF_MARKS).
 */
export function isSafeHref(href: unknown): href is string {
  if (typeof href !== "string" || href.length === 0) return false;
  // Reject protocol-relative URLs ("//evil.com" resolves to https://evil.com).
  if (href.startsWith("//")) return false;
  if (href.startsWith("/") || href.startsWith("#")) return true;
  if (href.startsWith("mailto:")) return true;
  if (href.startsWith("http://") || href.startsWith("https://")) return true;
  return false;
}

/** http(s)-абсолютная ссылка → нужен rel/target для внешнего перехода. */
export function isExternalHref(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}
