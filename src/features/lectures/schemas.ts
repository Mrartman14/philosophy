// src/features/lectures/schemas.ts
import "server-only";
import { z } from "zod";

import { VISIBILITY } from "@/api/enums";
import type { NamespaceT } from "@/i18n";
import { DATE_ONLY as ISO_DATE } from "@/utils/datetime-form";

import type { AttachmentEntityType } from "./types";

type ValidationT = NamespaceT<"validation">;

export function makeLectureCreateSchema(t: ValidationT) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(1, t("common.titleRequired"))
      .max(200, t("lectures.titleMax")),
    description: z
      .string()
      .max(5000, t("lectures.descriptionMax"))
      .optional()
      .default(""),
    date: z.string().regex(ISO_DATE, t("lectures.dateFormat")),
    visibility: z.enum(VISIBILITY).optional(),
  });
}

export function makeLectureUpdateSchema(t: ValidationT) {
  return z.object({
    id: z.uuid(t("lectures.invalidId")),
    title: z
      .string()
      .trim()
      .min(1, t("common.titleRequired"))
      .max(200, t("lectures.titleMax")),
    description: z
      .string()
      .max(5000, t("lectures.descriptionMax"))
      .default(""),
    date: z.string().regex(ISO_DATE, t("lectures.dateFormat")),
  });
}

export function makeLectureVisibilitySchema(t: ValidationT) {
  return z.object({
    id: z.uuid(t("lectures.invalidId")),
    visibility: z.enum(VISIBILITY),
  });
}

export function makeLectureIdSchema(t: ValidationT) {
  return z.object({
    id: z.uuid(t("lectures.invalidId")),
  });
}

export function makeLectureCoverSchema(t: ValidationT) {
  return z.object({
    id: z.uuid(t("lectures.invalidId")),
    upload_id: z.string().min(1, t("lectures.imageRequired")),
    alt_text: z.string().max(500, t("lectures.altMax")).optional(),
  });
}

export function makeLectureCoverClearSchema(t: ValidationT) {
  return z.object({
    id: z.uuid(t("lectures.invalidId")),
  });
}

// drift-гард: ключи обязаны ТОЧНО совпадать с AttachmentEntityType (обе стороны).
// `satisfies Record<AttachmentEntityType, true>` валит tsc, если бэк добавит/уберёт
// значение, а этот набор отстанет. См. spec §«Рантайм-нюанс».
const ENTITY_TYPE_SET = {
  document: true,
  media: true,
  canvas: true,
} as const satisfies Record<AttachmentEntityType, true>;

const ENTITY_TYPE = z.enum(
  Object.keys(ENTITY_TYPE_SET) as [AttachmentEntityType, ...AttachmentEntityType[]],
);

export function makeLectureAttachSchema(t: ValidationT) {
  return z.object({
    lecture_id: z.uuid(t("lectures.invalidId")),
    entity_id: z.string().min(1, t("lectures.entityRequired")),
    entity_type: ENTITY_TYPE,
    sort_order: z.number().int().gte(0).optional(),
  });
}

export function makeLectureDetachSchema(t: ValidationT) {
  return z.object({
    lecture_id: z.uuid(t("lectures.invalidId")),
    entity_id: z.string().min(1),
    entity_type: ENTITY_TYPE,
  });
}

export function makeLectureReorderSchema(t: ValidationT) {
  return z.object({
    lecture_id: z.uuid(t("lectures.invalidId")),
    entity_id: z.string().min(1),
    entity_type: ENTITY_TYPE,
    sort_order: z.number().int().gte(0),
  });
}

export function makeLectureSuggestSchema(t: ValidationT) {
  return z
    .object({
      blocks: z
        .array(
          z.object({
            block_id: z.string().min(1),
            text: z.string().max(50000),
          }),
        )
        .min(1, t("lectures.blocksMin"))
        .max(500),
    });
}

export type LectureCreateInput = z.infer<ReturnType<typeof makeLectureCreateSchema>>;
export type LectureUpdateInput = z.infer<ReturnType<typeof makeLectureUpdateSchema>>;
export type LectureVisibilityInput = z.infer<ReturnType<typeof makeLectureVisibilitySchema>>;
export type LectureIdInput = z.infer<ReturnType<typeof makeLectureIdSchema>>;
export type LectureCoverInput = z.infer<ReturnType<typeof makeLectureCoverSchema>>;
export type LectureCoverClearInput = z.infer<ReturnType<typeof makeLectureCoverClearSchema>>;
export type LectureAttachInput = z.infer<ReturnType<typeof makeLectureAttachSchema>>;
export type LectureDetachInput = z.infer<ReturnType<typeof makeLectureDetachSchema>>;
export type LectureReorderInput = z.infer<ReturnType<typeof makeLectureReorderSchema>>;
export type LectureSuggestInput = z.infer<ReturnType<typeof makeLectureSuggestSchema>>;
