// src/features/glossary/schemas.ts
import "server-only";
import { z } from "zod";

import { blocksJsonField } from "@/utils/blocks-json";

export const TermCreateSchema = z.object({
  title: z.string().trim().min(1, "Введите название").max(300, "До 300 символов"),
});

export const TermBlocksUpdateSchema = z.object({
  id: z.uuid("Некорректный id термина"),
  blocks: blocksJsonField({
    allowEmpty: true,
    messages: {
      invalidJson: "Битый JSON в теле формы",
      notArray: "Тело должно быть массивом блоков",
    },
  }),
});

export const TermIdSchema = z.object({
  id: z.uuid("Некорректный id термина"),
});

export type TermCreateInput = z.infer<typeof TermCreateSchema>;
export type TermBlocksUpdateInput = z.infer<typeof TermBlocksUpdateSchema>;
export type TermIdInput = z.infer<typeof TermIdSchema>;
