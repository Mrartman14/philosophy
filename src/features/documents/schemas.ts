// src/features/documents/schemas.ts
import "server-only";
import { z } from "zod";

import { VISIBILITY } from "@/api/enums";
import { blocksJsonField } from "@/utils/blocks-json";

/** Парсит JSON-строку blocks из скрытого поля формы в непустой массив. */
const BlocksJsonSchema = blocksJsonField({
  allowEmpty: false,
  messages: {
    minLength: "Тело документа не может быть пустым",
    invalidJson: "Битый JSON в теле документа",
    notArray: "Тело должно быть массивом блоков",
    empty: "Добавьте хотя бы один блок",
  },
});

const TitleSchema = z
  .string()
  .trim()
  .min(1, "Введите название")
  .max(500, "До 500 символов");

const VisibilityEnum = z.enum(VISIBILITY);

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
