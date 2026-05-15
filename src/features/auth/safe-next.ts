/**
 * Защита от open-redirect. Возвращает только относительные пути от корня;
 * всё подозрительное сворачиваем в "/".
 */
export function safeNextPath(raw: string | undefined | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//")) return "/";
  if (raw.startsWith("/\\")) return "/";
  return raw;
}
