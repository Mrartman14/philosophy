// src/features/comments/ui/document-comments.tsx
// Server-сборщик левого поля: заякоренные на текущий документ комментарии →
// превью-карточки → client-коннектор (DocumentCommentLayer → eager MarginAnchorLayer).
// Под SchemaContextProvider, т.к. композер монтирует AstEditor. Заякоренные комменты
// ВИДНЫ и в нижнем треде — это поле подсветка+позиционирование+выноски (доп. доступ).
import { SchemaContextProvider } from "@/components/ast-editor/schema-context";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import { getMe } from "@/utils/me";

import { selectAnchoredRoots } from "../anchored";
import { getCommentSchema, getLectureComments } from "../api";
import { canCreateComment } from "../permissions";

import { CommentPreviewCard } from "./comment-preview-card";
import { DocumentCommentLayer, type DocumentCommentNote } from "./document-comment-layer";

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
  const [me, schema, list, astSchema] = await Promise.all([
    getMe(),
    getCommentSchema(),
    getLectureComments(lectureId, token ? { token } : {}),
    getAstSchema(),
  ]);

  if (!schema) return null;

  const anchored = selectAnchoredRoots(list.subtrees, documentId);
  if (anchored.length === 0 && !canCreateComment(me)) return null;

  const notes: DocumentCommentNote[] = anchored.map((a) => ({
    id: a.id,
    anchor: a.anchor,
    preview: <CommentPreviewCard comment={a.root} replyCount={a.replyCount} />,
  }));

  return (
    <SchemaContextProvider initial={astSchema}>
      <DocumentCommentLayer
        lectureId={lectureId}
        documentId={documentId}
        rootTypes={schema.allowed_roots ?? []}
        notes={notes}
        canCreate={canCreateComment(me)}
      />
    </SchemaContextProvider>
  );
}
