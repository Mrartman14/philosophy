// src/features/comments/comment-format.ts
// Чистое форматирование даты комментария (изоморфно, без серверных зависимостей).
// Единый источник — дублировалось в comment-node.tsx и admin-comment-row.tsx.

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "UTC",
});

/** ISO → "дд.мм.гггг, чч:мм" (UTC). Пустая → ""; неразбираемая → возвращается как есть. */
export function formatCommentDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}
