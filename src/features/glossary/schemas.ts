// src/features/glossary/schemas.ts
import "server-only";
import { z } from "zod";

import type { NamespaceT } from "@/i18n";
import { blocksJsonField } from "@/utils/blocks-json";

type ValidationT = NamespaceT<"validation">;

export function makeTermCreateSchema(t: ValidationT) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(1, t("glossary.titleRequired"))
      .max(300, t("glossary.titleMax")),
    // Создание термина — единый шаг: title + тело сразу (один POST). Тело
    // обязательно (allowEmpty: false) — пустой массив бэк отклонит BLOCKS_EMPTY.
    blocks: blocksJsonField({
      allowEmpty: false,
      messages: {
        minLength: t("glossary.blocksMinLength"),
        invalidJson: t("glossary.blocksInvalidJson"),
        notArray: t("common.blocksNotArray"),
        empty: t("glossary.blocksEmpty"),
      },
    }),
  });
}

export function makeTermBlocksUpdateSchema(t: ValidationT) {
  return z.object({
    id: z.uuid(t("glossary.invalidTermId")),
    blocks: blocksJsonField({
      allowEmpty: true,
      messages: {
        invalidJson: t("glossary.blocksInvalidJson"),
        notArray: t("common.blocksNotArray"),
      },
    }),
  });
}

export function makeTermIdSchema(t: ValidationT) {
  return z.object({
    id: z.uuid(t("glossary.invalidTermId")),
  });
}

export type TermCreateInput = z.infer<ReturnType<typeof makeTermCreateSchema>>;
/** Вход формы (pre-transform): имена полей и их required-ность для createTypedForm. */
export type TermCreateFormInput = z.input<ReturnType<typeof makeTermCreateSchema>>;
export type TermBlocksUpdateInput = z.infer<ReturnType<typeof makeTermBlocksUpdateSchema>>;
/** Вход формы (pre-transform): имена полей и их required-ность для createTypedForm. */
export type TermBlocksUpdateFormInput = z.input<ReturnType<typeof makeTermBlocksUpdateSchema>>;
export type TermIdInput = z.infer<ReturnType<typeof makeTermIdSchema>>;
