// src/features/comments/ui/document-comments.tsx
// Server-сборщик левого поля: заякоренные на текущий документ комментарии →
// превью-карточки → client-коннектор (CommentAnchorScope → rail tone "comment").
// Под SchemaContextProvider, т.к. композер монтирует AstEditor. Заякоренные комменты
// ВИДНЫ и в нижнем треде — это поле подсветка+позиционирование+выноски (доп. доступ).
import { SchemaContextProvider } from "@/components/ast-editor/schema-context";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import { getMe } from "@/utils/me";

import { selectAnchoredRoots } from "../anchored";
import { getCommentSchema, getLectureComments } from "../api";
import { canCreateComment } from "../permissions";

import { CommentAnchorScope, type CommentAnchorNote } from "./comment-anchor-scope";
import { CommentPreviewCard } from "./comment-preview-card";

export async function DocumentComments({
  lectureId,
  documentId,
}: {
  lectureId: string;
  documentId: string;
}) {
  const [me, schema, list, astSchema] = await Promise.all([
    getMe(),
    getCommentSchema(),
    getLectureComments(lectureId),
    getAstSchema(),
  ]);

  if (!schema) return null;

  const anchored = selectAnchoredRoots(list.subtrees, documentId);
  if (anchored.length === 0 && !canCreateComment(me)) return null;

  const notes: CommentAnchorNote[] = anchored.map((a) => ({
    id: a.id,
    anchor: a.anchor,
    preview: <CommentPreviewCard comment={a.root} replyCount={a.replyCount} />,
  }));

  return (
    <SchemaContextProvider initial={astSchema}>
      <CommentAnchorScope
        lectureId={lectureId}
        documentId={documentId}
        rootTypes={schema.allowed_roots ?? []}
        notes={notes}
        canCreate={canCreateComment(me)}
      />
    </SchemaContextProvider>
  );
}
