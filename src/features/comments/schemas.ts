// src/features/comments/schemas.ts
import "server-only";
import { z } from "zod";

import { COMMENT_TYPES, REACTION_AXES as AXES } from "@/api/enums";
import type { NamespaceT } from "@/i18n";
import { blocksJsonField } from "@/utils/blocks-json";

/**
 * Фабрика blocksJsonField с переведёнными сообщениями.
 * Вызывается внутри makeCommentCreateSchema / makeCommentBlocksUpdateSchema.
 */
function makeBlocksJsonSchema(t: NamespaceT<"validation">) {
  return blocksJsonField({
    allowEmpty: false,
    messages: {
      invalidJson: t("comments.blocksInvalidJson"),
      // Оригинал объединял !Array.isArray и length===0 в одно условие — сохраняем то же.
      notArray: t("comments.blocksNotArray"),
      empty: t("comments.blocksEmpty"),
    },
  });
}

/**
 * Фабрика схемы создания комментария. t = await getT("validation") в action.
 * blocks приходит из скрытого input формы как JSON-строка.
 */
export function makeCommentCreateSchema(t: NamespaceT<"validation">) {
  return z
    .object({
      type: z.enum(COMMENT_TYPES, { message: t("comments.invalidType") }),
      blocks: makeBlocksJsonSchema(t),
      // parent_id есть только в форме ответа; в корневой форме отсутствует.
      parent_id: z.uuid(t("comments.invalidParentId")).optional(),
    })
    .transform((raw) => ({
      type: raw.type,
      blocks: raw.blocks,
      ...(raw.parent_id ? { parent_id: raw.parent_id } : {}),
    }));
}

/**
 * Фабрика схемы обновления blocks комментария. t = await getT("validation") в action.
 */
export function makeCommentBlocksUpdateSchema(t: NamespaceT<"validation">) {
  return z.object({
    id: z.uuid(t("comments.invalidCommentId")),
    blocks: makeBlocksJsonSchema(t),
  });
}

// Внутренние схемы (не показываются в UI как field-ошибки):
// ReactionSchema, RemoveReactionSchema, CommentIdSchema — аргументы action,
// не parseFormData. Русские литералы в сообщениях — internal/dev-only.

export const ReactionSchema = z
  .object({
    id: z.uuid("Некорректный id комментария"),
    axis: z.enum(AXES, { message: "Неизвестная ось реакции" }),
    // value приходит строкой из action-аргумента/формы.
    value: z.coerce.number().int(),
  })
  .superRefine((v, ctx) => {
    if (v.value !== 1 && v.value !== -1) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Значение должно быть +1 или -1" });
    }
    if (v.axis === "insight" && v.value !== 1) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "insight допускает только +1" });
    }
  });

export const RemoveReactionSchema = z.object({
  id: z.uuid("Некорректный id комментария"),
  axis: z.enum(AXES, { message: "Неизвестная ось реакции" }),
});

export const CommentIdSchema = z.object({
  id: z.uuid("Некорректный id комментария"),
});

export type CommentCreateInput = z.infer<ReturnType<typeof makeCommentCreateSchema>>;
/** Вход формы (pre-transform): имена полей и их required-ность для createTypedForm. */
export type CommentCreateFormInput = z.input<ReturnType<typeof makeCommentCreateSchema>>;
export type CommentBlocksUpdateInput = z.infer<ReturnType<typeof makeCommentBlocksUpdateSchema>>;
export type ReactionInput = z.infer<typeof ReactionSchema>;
export type RemoveReactionInput = z.infer<typeof RemoveReactionSchema>;
export type CommentIdInput = z.infer<typeof CommentIdSchema>;
