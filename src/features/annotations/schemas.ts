// src/features/annotations/schemas.ts
import "server-only";
import { z } from "zod";

import { VISIBILITY } from "@/api/enums";
import type { NamespaceT } from "@/i18n";
import { blocksJsonField } from "@/utils/blocks-json";

import { PARENT_ENTITY_TYPES } from "./types";

type ValidationT = NamespaceT<"validation">;

/**
 * JSON-строка AST-блоков из hidden-input формы (паттерн comments/events:
 * BlocksJsonSchema). Парсит и проверяет, что результат — непустой массив.
 */
function makeBlocksJsonSchema(t: ValidationT) {
  return blocksJsonField({
    allowEmpty: false,
    messages: {
      minLength: t("annotations.blocksMinLength"),
      invalidJson: t("annotations.blocksInvalidJson"),
      // Оригинал объединял !Array.isArray и length===0 в одно условие с одним
      // сообщением. Передаём то же сообщение в оба поля — поведение идентично.
      notArray: t("annotations.blocksNotArray"),
      empty: t("annotations.blocksEmpty"),
    },
  });
}

/** Подмножество parent-типов с UI (banner/event/canvas не покрываем — §4). */
const ParentEntityTypeSchema = z.enum(PARENT_ENTITY_TYPES);

const VisibilitySchema = z.enum(VISIBILITY);

/**
 * Опциональный JSON-якорь (hidden-input). Парсится в объект; структурную
 * валидность под parent-тип проверяет бек (422 ANCHOR_INVALID) + наши
 * anchor.ts-предикаты на клиенте до сабмита.
 */
function makeAnchorJsonSchema(t: ValidationT) {
  return z
    .string()
    .optional()
    .transform((s, ctx) => {
      if (!s || s.trim() === "") return undefined;
      try {
        const parsed: unknown = JSON.parse(s);
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          ctx.addIssue({
            code: "custom",
            message: t("annotations.anchorNotObject"),
          });
          return z.NEVER;
        }
        return parsed as Record<string, unknown>;
      } catch {
        ctx.addIssue({
          code: "custom",
          message: t("annotations.anchorInvalidJson"),
        });
        return z.NEVER;
      }
    });
}

export function makeAnnotationCreateSchema(t: ValidationT) {
  return z.object({
    parent_entity_type: ParentEntityTypeSchema,
    parent_entity_id: z.uuid(t("annotations.invalidParentId")),
    visibility: VisibilitySchema.optional().default("private"),
    blocks: makeBlocksJsonSchema(t),
    anchor: makeAnchorJsonSchema(t),
  });
}

export function makeAnnotationUpdateSchema(t: ValidationT) {
  return z
    .object({
      id: z.uuid(t("annotations.invalidAnnotationId")),
      blocks: makeBlocksJsonSchema(t),
      anchor: makeAnchorJsonSchema(t),
    })
    // visibility намеренно не входит в схему: иммутабельна (§6.8). Лишний ключ
    // в форме игнорируется (z.object strip по умолчанию).
    .transform((v) => ({
      id: v.id,
      blocks: v.blocks,
      ...(v.anchor !== undefined ? { anchor: v.anchor } : {}),
    }));
}

export function makeAnnotationIdSchema(t: ValidationT) {
  return z.object({
    id: z.uuid(t("annotations.invalidAnnotationId")),
  });
}

/** offset для локальной/серверной пагинации. */
export const AnnotationOffsetSchema = z.coerce
  .number()
  .int()
  .min(0, "offset >= 0");

/** Фильтр admin-списка. Битые значения → undefined (не бросаем). */
export const AdminAnnotationFilterSchema = z.object({
  parent_entity_type: z
    .enum(PARENT_ENTITY_TYPES)
    .optional()
    .catch(undefined),
  parent_entity_id: z.uuid().optional().catch(undefined),
  author_id: z.uuid().optional().catch(undefined),
  offset: AnnotationOffsetSchema.optional().catch(undefined),
});

export type AnnotationCreateInput = z.infer<ReturnType<typeof makeAnnotationCreateSchema>>;
export type AnnotationUpdateInput = z.infer<ReturnType<typeof makeAnnotationUpdateSchema>>;
export type AnnotationIdInput = z.infer<ReturnType<typeof makeAnnotationIdSchema>>;
export type AdminAnnotationFilterInput = z.infer<
  typeof AdminAnnotationFilterSchema
>;
