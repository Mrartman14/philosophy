// src/features/comments/ui/comment-type-badge.tsx
import type { CommentType } from "../types";

const TYPE_LABELS: Record<CommentType, string> = {
  claim: "Тезис",
  grounds: "Основание",
  rebuttal: "Возражение",
  qualifier: "Уточнение",
  question: "Вопрос",
  answer: "Ответ",
  offtop: "Оффтоп",
  summary: "Итог",
};

export function commentTypeLabel(type: CommentType): string {
  return TYPE_LABELS[type] ?? type;
}

export function CommentTypeBadge({ type }: { type: CommentType }) {
  return (
    <span className="rounded-full border border-(--color-border) px-2 py-0.5 text-xs text-(--color-description)">
      {commentTypeLabel(type)}
    </span>
  );
}
