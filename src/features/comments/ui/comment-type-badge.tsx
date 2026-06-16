// src/features/comments/ui/comment-type-badge.tsx
import { chipClass } from "@/components/ui";

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
  return TYPE_LABELS[type];
}

export function CommentTypeBadge({ type }: { type: CommentType }) {
  return (
    <span className={chipClass()}>
      {commentTypeLabel(type)}
    </span>
  );
}
