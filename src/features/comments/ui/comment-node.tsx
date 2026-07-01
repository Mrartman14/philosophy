// src/features/comments/ui/comment-node.tsx
// СТОПГАП / ФЛАГ ПОЛЬЗОВАТЕЛЮ: импорт из @/features/annotations через публичный
// barrel — это САНКЦИОНИРОВАННЫЙ дизайном foundation-уровневый seam («universal
// annotation scopes»: каждый CommentNode оборачивает тело в AnnotationScope, см.
// docs/superpowers/specs/2026-06-30-universal-annotation-scopes-design.md §«Правки
// слайсов»/«Поток данных»). Но ESLint Guardrail 2 (eslint.config.mjs:619) запрещает
// ЛЮБОЙ cross-feature @/features/* импорт внутри src/features/*/** БЕЗ исключений —
// план ошибочно считал «через barrel допустимо». Это первый и единственный такой
// импорт в слайсах. КОРЕНЬ нужно решить на foundation-уровне (отдельный
// foundation-update PR к eslint.config.mjs: добавить курируемое allow-исключение
// для annotation-scope seam — как canvas-engine-seam), либо изменить архитектуру
// (mount scope не из CommentNode). Пока — точечный disable как временный стопгап.
// eslint-disable-next-line no-restricted-imports -- sanctioned foundation seam (universal annotation scopes); root: amend Guardrail 2 in a foundation PR
import {
  AnnotationScope,
  buildAnnotationCards,
  canCreateAnnotation,
  getAllLectureAnnotations,
} from "@/features/annotations";
import { getLocale, getT } from "@/i18n";
import { getMe } from "@/utils/me";
import { getServerTz } from "@/utils/timezone-server";

import {
  canDeleteComment,
  canEditComment,
  canReactToComment,
} from "../permissions";
import { axisAllowedForType } from "../reactions";
import type { Comment, CommentSchema, ReactionAxis } from "../types";

import { CommentAnchorContext } from "./comment-anchor-context";
import { CommentDeleteButton } from "./comment-delete-button";
import { CommentEditForm } from "./comment-edit-form";
import { CommentNodeView } from "./comment-node-view";
import { CommentReactions } from "./comment-reactions";
import { CommentReplyForm } from "./comment-reply-form";

interface Props {
  comment: Comment;
  lectureId: string;
  schema: CommentSchema;
  /** ?token= (share-link) — доступ к аннотациям комментов приватной лекции. */
  token?: string | undefined;
}

export async function CommentNode({ comment, lectureId, schema, token }: Props) {
  const [me, t, locale, tz] = await Promise.all([
    getMe(),
    getT("comments"),
    getLocale(),
    getServerTz(),
  ]);

  if (comment.is_deleted) {
    return <CommentNodeView comment={comment} deletedLabel={t("deleted")} />;
  }

  const type = comment.type;
  const allowedAxes = (schema.allowed_reactions?.[type] ?? []).filter(
    (a): a is ReactionAxis => axisAllowedForType(schema, type, a),
  );
  const childTypes = schema.allowed_children?.[type] ?? [];

  // Каждый комментарий — annotation-скоуп: тело размечено data-anchor-scope=
  // comment:<id> (scopeEnabled ниже), его аннотации фетчатся ОДНИМ лекционным
  // батчем (cache() → один HTTP на запрос даже при N CommentNode в дереве) и
  // группируются по parent_entity_id. lectureId — ПРОП (не comment.lecture_id).
  const canAnnotate = canCreateAnnotation(me);
  // token — share-link доступ к аннотациям комментов приватной лекции (паритет с
  // DocumentAnnotations, которому token проброшен на странице). Без него аноним/
  // зритель по ?token= терял бы аннотации комментов (аудит 2026-07-01).
  const all = await getAllLectureAnnotations(lectureId, "comment", token);
  const items = all.filter((a) => a.parent_entity_id === comment.id);
  // astSchema: null — read-карточки; диалог create/edit подтянет схему из
  // SchemaContextProvider, который CommentSection уже держит выше по дереву.
  const annotationNotes = buildAnnotationCards({
    items,
    me,
    astSchema: null,
    hideAnchorOnWide: true,
  });

  return (
    <>
      <CommentNodeView
        comment={comment}
        scopeEnabled
        deletedLabel={t("deleted")}
        editedLabel={t("edited")}
        typeLabel={t(`type.${type}`)}
        locale={locale}
        tz={tz}
        anchorSlot={
          comment.anchor ? <CommentAnchorContext anchor={comment.anchor} /> : undefined
        }
        reactionsSlot={
          <CommentReactions
            commentId={comment.id}
            type={type}
            reactions={comment.reactions}
            myReactions={comment.my_reactions}
            allowedAxes={allowedAxes}
            canReact={canReactToComment(me, comment)}
          />
        }
        actionsSlot={
          <div className="flex flex-wrap items-center gap-2">
            {canEditComment(me, comment) && (
              <CommentEditForm
                commentId={comment.id}
                lectureId={lectureId}
                initialBlocks={comment.blocks ?? []}
                version={comment.version}
              />
            )}
            {canDeleteComment(me, comment) && (
              <CommentDeleteButton
                commentId={comment.id}
                admin={comment.author?.id !== me?.id}
              />
            )}
            {me && (
              <CommentReplyForm
                lectureId={lectureId}
                parentId={comment.id}
                childTypes={childTypes}
              />
            )}
          </div>
        }
      />
      {/* AnnotationScope без showToolbar (#14/#17/#18): у аннотаций КОММЕНТАРИЯ нет
          per-scope тумблера подсветки — они подсвечены всегда. Тумблер живёт лишь на
          документе (DocumentAnnotations → showToolbar), где он один на весь
          document-scope; плодить N тумблеров по одному на комментарий — шум.
          Сознательная асимметрия, не забытый проп. */}
      {(annotationNotes.length > 0 || canAnnotate) && (
        <AnnotationScope
          parentEntityType="comment"
          parentId={comment.id}
          notes={annotationNotes}
          canCreate={canAnnotate}
        />
      )}
    </>
  );
}
