// src/features/lectures/schemas.ts
import "server-only";
import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const LectureCreateSchema = z.object({
  title: z.string().trim().min(1, "Введите название").max(200, "До 200 символов"),
  description: z.string().max(5000, "До 5000 символов").optional().default(""),
  date: z.string().regex(ISO_DATE, "Дата должна быть в формате ГГГГ-ММ-ДД"),
  visibility: z.enum(["private", "public"]).optional(),
});

export const LectureUpdateSchema = z.object({
  id: z.string().uuid("Некорректный id лекции"),
  title: z.string().trim().min(1, "Введите название").max(200, "До 200 символов"),
  description: z.string().max(5000, "До 5000 символов").default(""),
  date: z.string().regex(ISO_DATE, "Дата должна быть в формате ГГГГ-ММ-ДД"),
});

export const LectureVisibilitySchema = z.object({
  id: z.string().uuid("Некорректный id лекции"),
  visibility: z.enum(["private", "public"]),
});

export const LectureIdSchema = z.object({
  id: z.string().uuid("Некорректный id лекции"),
});

export const LectureCoverSchema = z.object({
  id: z.string().uuid("Некорректный id лекции"),
  upload_id: z.string().min(1, "Не выбрано изображение"),
  alt_text: z.string().max(500, "До 500 символов").optional(),
});

export const LectureCoverClearSchema = z.object({
  id: z.string().uuid("Некорректный id лекции"),
});

const ENTITY_TYPE = z.enum(["document", "media", "canvas"]);

export const LectureAttachSchema = z.object({
  lecture_id: z.string().uuid("Некорректный id лекции"),
  entity_id: z.string().min(1, "Не выбрана сущность"),
  entity_type: ENTITY_TYPE,
  sort_order: z.number().int().gte(0).optional(),
});

export const LectureDetachSchema = z.object({
  lecture_id: z.string().uuid("Некорректный id лекции"),
  entity_id: z.string().min(1),
  entity_type: ENTITY_TYPE,
});

export const LectureReorderSchema = z.object({
  lecture_id: z.string().uuid("Некорректный id лекции"),
  entity_id: z.string().min(1),
  entity_type: ENTITY_TYPE,
  sort_order: z.number().int().gte(0),
});

export const LectureSuggestSchema = z.object({
  blocks: z
    .array(
      z.object({
        block_id: z.string().min(1),
        text: z.string().max(50000),
      }),
    )
    .min(1, "Нужен хотя бы один блок")
    .max(500),
});

export type LectureCreateInput = z.infer<typeof LectureCreateSchema>;
export type LectureUpdateInput = z.infer<typeof LectureUpdateSchema>;
export type LectureVisibilityInput = z.infer<typeof LectureVisibilitySchema>;
export type LectureIdInput = z.infer<typeof LectureIdSchema>;
export type LectureCoverInput = z.infer<typeof LectureCoverSchema>;
export type LectureCoverClearInput = z.infer<typeof LectureCoverClearSchema>;
export type LectureAttachInput = z.infer<typeof LectureAttachSchema>;
export type LectureDetachInput = z.infer<typeof LectureDetachSchema>;
export type LectureReorderInput = z.infer<typeof LectureReorderSchema>;
export type LectureSuggestInput = z.infer<typeof LectureSuggestSchema>;
