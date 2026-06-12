// src/components/ast-render/marks/comment-ref.tsx
import type { ReactNode } from "react";

// Отдельной страницы комментария пока нет (волна 2, слайс comments определит
// резолв якоря на странице лекции). Дефолт — канонический путь по id;
// страницы-консьюмеры переопределяют через ctx.renderCommentRef.
export function defaultCommentRef({ id, label }: { id: string; label: string }): ReactNode {
  return <a href={`/comments/${id}`}>{label}</a>;
}
