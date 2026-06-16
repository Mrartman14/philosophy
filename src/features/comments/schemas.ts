// src/features/comments/schemas.ts
import "server-only";
import { z } from "zod";

import { COMMENT_TYPES, REACTION_AXES as AXES } from "@/api/enums";
import { blocksJsonField } from "@/utils/blocks-json";

/**
 * blocks приходит из скрытого input формы как JSON-строка (AstEditor
 * сериализует blocks в hidden input). Парсим в непустой массив.
 * Пустой массив → 422 BLOCKS_EMPTY на беке; ловим раньше.
 */
const BlocksJsonSchema = blocksJsonField({
  allowEmpty: false,
  messages: {
    invalidJson: "Битый JSON в теле",
    // Оригинал объединял !Array.isArray и length===0 в одно условие с одним
    // сообщением. Передаём то же сообщение в оба поля — поведение идентично.
    notArray: "Комментарий не может быть пустым",
    empty: "Комментарий не может быть пустым",
  },
});

export const CommentCreateSchema = z
  .object({
    type: z.enum(COMMENT_TYPES, { message: "Неизвестный тип комментария" }),
    blocks: BlocksJsonSchema,
    // parent_id есть только в форме ответа; в корневой форме отсутствует.
    parent_id: z.uuid("Некорректный parent_id").optional(),
  })
  .transform((raw) => ({
    type: raw.type,
    blocks: raw.blocks,
    ...(raw.parent_id ? { parent_id: raw.parent_id } : {}),
  }));

export const CommentBlocksUpdateSchema = z.object({
  id: z.uuid("Некорректный id комментария"),
  blocks: BlocksJsonSchema,
});

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

export type CommentCreateInput = z.infer<typeof CommentCreateSchema>;
export type CommentBlocksUpdateInput = z.infer<typeof CommentBlocksUpdateSchema>;
export type ReactionInput = z.infer<typeof ReactionSchema>;
export type RemoveReactionInput = z.infer<typeof RemoveReactionSchema>;
export type CommentIdInput = z.infer<typeof CommentIdSchema>;
