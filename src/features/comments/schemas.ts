// src/features/comments/schemas.ts
import "server-only";
import { z } from "zod";
import type { CommentType, ReactionAxis } from "./types";

const COMMENT_TYPES = [
  "claim",
  "grounds",
  "rebuttal",
  "qualifier",
  "question",
  "answer",
  "offtop",
  "summary",
] as const satisfies readonly CommentType[];

const AXES = ["agreement", "quality", "insight"] as const satisfies readonly ReactionAxis[];

/**
 * blocks приходит из скрытого input формы как JSON-строка (AstEditor
 * сериализует blocks в hidden input). Парсим в непустой массив.
 * Пустой массив → 422 BLOCKS_EMPTY на беке; ловим раньше.
 */
const BlocksJsonSchema = z
  .string()
  .min(1, "Тело не может быть пустым")
  .transform((s, ctx) => {
    try {
      const parsed: unknown = JSON.parse(s);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Комментарий не может быть пустым",
        });
        return z.NEVER;
      }
      return parsed as unknown[];
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Битый JSON в теле" });
      return z.NEVER;
    }
  });

export const CommentCreateSchema = z
  .object({
    type: z.enum(COMMENT_TYPES, { message: "Неизвестный тип комментария" }),
    blocks: BlocksJsonSchema,
    // parent_id есть только в форме ответа; в корневой форме отсутствует.
    parent_id: z.string().uuid("Некорректный parent_id").optional(),
  })
  .transform((raw) => ({
    type: raw.type,
    blocks: raw.blocks,
    ...(raw.parent_id ? { parent_id: raw.parent_id } : {}),
  }));

export const CommentBlocksUpdateSchema = z.object({
  id: z.string().uuid("Некорректный id комментария"),
  blocks: BlocksJsonSchema,
});

export const ReactionSchema = z
  .object({
    id: z.string().uuid("Некорректный id комментария"),
    axis: z.enum(AXES, { message: "Неизвестная ось реакции" }),
    // value приходит строкой из action-аргумента/формы.
    value: z.coerce.number().int(),
  })
  .superRefine((v, ctx) => {
    if (v.value !== 1 && v.value !== -1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Значение должно быть +1 или -1" });
    }
    if (v.axis === "insight" && v.value !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "insight допускает только +1" });
    }
  });

export const RemoveReactionSchema = z.object({
  id: z.string().uuid("Некорректный id комментария"),
  axis: z.enum(AXES, { message: "Неизвестная ось реакции" }),
});

export const CommentIdSchema = z.object({
  id: z.string().uuid("Некорректный id комментария"),
});

export type CommentCreateInput = z.infer<typeof CommentCreateSchema>;
export type CommentBlocksUpdateInput = z.infer<typeof CommentBlocksUpdateSchema>;
export type ReactionInput = z.infer<typeof ReactionSchema>;
export type RemoveReactionInput = z.infer<typeof RemoveReactionSchema>;
export type CommentIdInput = z.infer<typeof CommentIdSchema>;
