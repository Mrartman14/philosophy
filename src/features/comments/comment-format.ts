// src/features/comments/comment-format.ts
// Локале-параметризуемое форматирование даты комментария через единый seam @/i18n.
// Изоморфно (без хуков) → пригодно для офлайн SavedLectureView из снимка.
import { getFmt } from "@/i18n/format";
import { DEFAULT_LOCALE, type ResolvedLocale } from "@/i18n/locales";

/** ISO → "дд.мм.гггг, чч:мм" (UTC). Пустая → ""; неразбираемая → как есть. */
export function formatCommentDate(
  iso?: string,
  locale: ResolvedLocale = DEFAULT_LOCALE,
): string {
  if (!iso) return "";
  return getFmt(locale).dateTime(iso, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC",
  });
}
