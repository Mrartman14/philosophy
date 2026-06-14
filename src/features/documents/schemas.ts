// src/features/documents/schemas.ts
import "server-only";
import { z } from "zod";

/** Парсит JSON-строку blocks из скрытого поля формы в непустой массив. */
const BlocksJsonSchema = z
  .string()
  .min(1, "Тело документа не может быть пустым")
  .transform((s, ctx) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(s);
    } catch {
      ctx.addIssue({ code: "custom", message: "Битый JSON в теле документа" });
      return z.NEVER;
    }
    if (!Array.isArray(parsed)) {
      ctx.addIssue({ code: "custom", message: "Тело должно быть массивом блоков" });
      return z.NEVER;
    }
    if (parsed.length === 0) {
      ctx.addIssue({ code: "custom", message: "Добавьте хотя бы один блок" });
      return z.NEVER;
    }
    return parsed as unknown[];
  });

const TitleSchema = z
  .string()
  .trim()
  .min(1, "Введите название")
  .max(500, "До 500 символов");

const VisibilityEnum = z.enum(["private", "public"]);

/** POST /api/documents (JSON create). visibility опционально. */
export const DocumentCreateSchema = z.object({
  title: TitleSchema,
  blocks: BlocksJsonSchema,
  // Радио/select: ключ отсутствует, если не выбрано → бек дефолтит private.
  visibility: VisibilityEnum.optional(),
});

/** PUT /api/documents/{id}/blocks. */
export const DocumentBlocksSchema = z.object({
  id: z.uuid("Некорректный id документа"),
  blocks: BlocksJsonSchema,
});

/** PATCH /api/documents/{id} (метаданные — только title). */
export const DocumentMetaSchema = z.object({
  id: z.uuid("Некорректный id документа"),
  title: TitleSchema,
});

/** PATCH /api/documents/{id}/visibility. UI предлагает только private→public. */
export const DocumentVisibilitySchema = z.object({
  id: z.uuid("Некорректный id документа"),
  visibility: VisibilityEnum,
});

/** Для delete: только id. */
export const DocumentIdSchema = z.object({
  id: z.uuid("Некорректный id документа"),
});

export type DocumentCreateInput = z.infer<typeof DocumentCreateSchema>;
export type DocumentBlocksInput = z.infer<typeof DocumentBlocksSchema>;
export type DocumentMetaInput = z.infer<typeof DocumentMetaSchema>;
export type DocumentVisibilityInput = z.infer<typeof DocumentVisibilitySchema>;
export type DocumentIdInput = z.infer<typeof DocumentIdSchema>;
