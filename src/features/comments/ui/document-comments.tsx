// src/features/comments/ui/document-comments.tsx
// Server-сборщик левого поля: заякоренные на текущий документ комментарии → превью-карточки
// → client-коннектор (CommentAnchorScope → rail tone "comment"). Композер создания ушёл на
// page-level (CommentAnchorCreateAffordance) → здесь больше НЕ нужен SchemaContextProvider/
// AST-схема: rail рендерит только read-превью. Заякоренные комменты видны и в нижнем треде —
// это поле лишь подсветка+позиционирование+выноски (доп. доступ).
import { getMe } from "@/utils/me";

import { selectAnchoredRoots } from "../anchored";
import { getLectureComments } from "../api";
import { canCreateComment } from "../permissions";

import { CommentAnchorScope, type CommentAnchorNote } from "./comment-anchor-scope";
import { CommentPreviewCard } from "./comment-preview-card";

export async function DocumentComments({
  lectureId,
  documentId,
  token,
}: {
  lectureId: string;
  documentId: string;
  /** ?token= (share-link) — доступ к комментариям приватной лекции. */
  token?: string | undefined;
}) {
  const [me, list] = await Promise.all([
    getMe(),
    getLectureComments(lectureId, token ? { token } : {}),
  ]);

  const anchored = selectAnchoredRoots(list.subtrees, documentId);
  // Пустое поле без права создавать нечего показывать. При наличии права колонку
  // держим (page-level композер положит новые заякоренные комменты сюда после ревалидации).
  if (anchored.length === 0 && !canCreateComment(me)) return null;

  const notes: CommentAnchorNote[] = anchored.map((a) => ({
    id: a.id,
    anchor: a.anchor,
    preview: <CommentPreviewCard comment={a.root} replyCount={a.replyCount} />,
  }));

  return <CommentAnchorScope documentId={documentId} notes={notes} />;
}
