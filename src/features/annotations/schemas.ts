// src/features/annotations/schemas.ts
import "server-only";
import { z } from "zod";

import { VISIBILITY } from "@/api/enums";
import { blocksJsonField } from "@/utils/blocks-json";

import { PARENT_ENTITY_TYPES } from "./types";

/**
 * JSON-строка AST-блоков из hidden-input формы (паттерн comments/events:
 * BlocksJsonSchema). Парсит и проверяет, что результат — непустой массив.
 */
const BlocksJsonSchema = blocksJsonField({
  allowEmpty: false,
  messages: {
    minLength: "Тело аннотации не может быть пустым",
    invalidJson: "Битый JSON в теле аннотации",
    // Оригинал объединял !Array.isArray и length===0 в одно условие с одним
    // сообщением. Передаём то же сообщение в оба поля — поведение идентично.
    notArray: "Тело должно быть непустым массивом блоков",
    empty: "Тело должно быть непустым массивом блоков",
  },
});

/** Подмножество parent-типов с UI (banner/event/canvas не покрываем — §4). */
const ParentEntityTypeSchema = z.enum(PARENT_ENTITY_TYPES);

const VisibilitySchema = z.enum(VISIBILITY);

/**
 * Опциональный JSON-якорь (hidden-input). Парсится в объект; структурную
 * валидность под parent-тип проверяет бек (422 ANCHOR_INVALID) + наши
 * anchor.ts-предикаты на клиенте до сабмита.
 */
const AnchorJsonSchema = z
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
          message: "Якорь должен быть объектом",
        });
        return z.NEVER;
      }
      return parsed as Record<string, unknown>;
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Битый JSON в якоре",
      });
      return z.NEVER;
    }
  });

export const AnnotationCreateSchema = z.object({
  parent_entity_type: ParentEntityTypeSchema,
  parent_entity_id: z.uuid("Некорректный id родительской сущности"),
  visibility: VisibilitySchema.optional().default("private"),
  blocks: BlocksJsonSchema,
  anchor: AnchorJsonSchema,
});

export const AnnotationUpdateSchema = z
  .object({
    id: z.uuid("Некорректный id аннотации"),
    blocks: BlocksJsonSchema,
    anchor: AnchorJsonSchema,
  })
  // visibility намеренно не входит в схему: иммутабельна (§6.8). Лишний ключ
  // в форме игнорируется (z.object strip по умолчанию).
  .transform((v) => ({
    id: v.id,
    blocks: v.blocks,
    ...(v.anchor !== undefined ? { anchor: v.anchor } : {}),
  }));

export const AnnotationIdSchema = z.object({
  id: z.uuid("Некорректный id аннотации"),
});

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

export type AnnotationCreateInput = z.infer<typeof AnnotationCreateSchema>;
export type AnnotationUpdateInput = z.infer<typeof AnnotationUpdateSchema>;
export type AnnotationIdInput = z.infer<typeof AnnotationIdSchema>;
export type AdminAnnotationFilterInput = z.infer<
  typeof AdminAnnotationFilterSchema
>;
