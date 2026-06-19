// src/features/documents/schemas.ts
import "server-only";
import { z } from "zod";

import { VISIBILITY } from "@/api/enums";
import type { NamespaceT } from "@/i18n";
import { blocksJsonField } from "@/utils/blocks-json";

type ValidationT = NamespaceT<"validation">;

/** Парсит JSON-строку blocks из скрытого поля формы в непустой массив. */
function makeBlocksJsonSchema(t: ValidationT) {
  return blocksJsonField({
    allowEmpty: false,
    messages: {
      minLength: t("documents.blocksMinLength"),
      invalidJson: t("documents.blocksInvalidJson"),
      notArray: t("documents.blocksNotArray"),
      empty: t("documents.blocksEmpty"),
    },
  });
}

function makeTitleSchema(t: ValidationT) {
  return z
    .string()
    .trim()
    .min(1, t("documents.titleRequired"))
    .max(500, t("documents.titleMax"));
}

const VisibilityEnum = z.enum(VISIBILITY);

/** POST /api/documents (JSON create). visibility опционально. */
export function makeDocumentCreateSchema(t: ValidationT) {
  return z.object({
    title: makeTitleSchema(t),
    blocks: makeBlocksJsonSchema(t),
    // Радио/select: ключ отсутствует, если не выбрано → бек дефолтит private.
    visibility: VisibilityEnum.optional(),
  });
}

/** PUT /api/documents/{id}/blocks. */
export function makeDocumentBlocksSchema(t: ValidationT) {
  return z.object({
    id: z.uuid(t("documents.invalidId")),
    blocks: makeBlocksJsonSchema(t),
  });
}

/** PATCH /api/documents/{id} (метаданные — только title). */
export function makeDocumentMetaSchema(t: ValidationT) {
  return z.object({
    id: z.uuid(t("documents.invalidId")),
    title: makeTitleSchema(t),
  });
}

/** PATCH /api/documents/{id}/visibility. UI предлагает только private→public. */
export function makeDocumentVisibilitySchema(t: ValidationT) {
  return z.object({
    id: z.uuid(t("documents.invalidId")),
    visibility: VisibilityEnum,
  });
}

/** Для delete: только id. */
export function makeDocumentIdSchema(t: ValidationT) {
  return z.object({
    id: z.uuid(t("documents.invalidId")),
  });
}

// Типы инферируются из фабрик через ReturnType (паттерн playbook Case 1).
export type DocumentCreateInput = z.infer<ReturnType<typeof makeDocumentCreateSchema>>;
export type DocumentBlocksInput = z.infer<ReturnType<typeof makeDocumentBlocksSchema>>;
export type DocumentMetaInput = z.infer<ReturnType<typeof makeDocumentMetaSchema>>;
export type DocumentVisibilityInput = z.infer<ReturnType<typeof makeDocumentVisibilitySchema>>;
export type DocumentIdInput = z.infer<ReturnType<typeof makeDocumentIdSchema>>;
