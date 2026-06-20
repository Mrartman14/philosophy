// src/features/comments/ui/comment-type-badge.tsx
// ИЗОМОРФНЫЙ КОНТРАКТ: badge рендерится и внутри CommentNodeView (офлайн-снимок
// без хуков), и в server/client онлайн-контейнерах. Поэтому НЕ держит getT/useT.
// Переводимая метка типа приходит опциональным пропом `label`; дефолт — русский
// литерал из TYPE_LABELS (совпадает с каталогом comments.type.*). Паттерн зеркалит
// comment-node-view deletedLabel: онлайн-родитель передаёт t("type.<type>").
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

/** Русский дефолт метки типа (offline-fallback). Онлайн — t("type.<type>"). */
export function commentTypeLabel(type: CommentType): string {
  return TYPE_LABELS[type];
}

export function CommentTypeBadge({
  type,
  label,
}: {
  type: CommentType;
  /** Переведённая метка типа. Дефолт: русский литерал commentTypeLabel(type). */
  label?: string | undefined;
}) {
  return (
    <span className={chipClass()}>
      {label ?? commentTypeLabel(type)}
    </span>
  );
}
