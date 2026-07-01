// src/features/comments/ui/comment-anchor-create-affordance.tsx
// Server-ассемблер page-level действия «заякоренный комментарий»: право (comment.create),
// rootTypes из схемы комментов + AST-схема (композер монтирует AstEditor), монтирует
// client-композер ОДИН раз на странице лекции под SchemaContextProvider. Зеркалит стиль
// DocumentComments. На standalone-документе комментов нет → там не монтируется.
import { SchemaContextProvider } from "@/components/ast-editor/schema-context";
import { getAstSchema } from "@/components/ast-editor/schema-server";
import { getMe } from "@/utils/me";

import { getCommentSchema } from "../api";
import { canCreateComment } from "../permissions";

import { CommentAnchorSelectionComposer } from "./comment-anchor-selection-composer";

export async function CommentAnchorCreateAffordance({ lectureId }: { lectureId: string }) {
  const me = await getMe();
  if (!canCreateComment(me)) return null;
  const [schema, astSchema] = await Promise.all([getCommentSchema(), getAstSchema()]);
  if (!schema) return null;
  return (
    <SchemaContextProvider initial={astSchema}>
      <CommentAnchorSelectionComposer lectureId={lectureId} rootTypes={schema.allowed_roots ?? []} />
    </SchemaContextProvider>
  );
}
