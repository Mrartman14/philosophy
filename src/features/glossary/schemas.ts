// src/features/glossary/schemas.ts
import "server-only";
import { z } from "zod";

export const TermCreateSchema = z.object({
  title: z.string().trim().min(1, "Введите название").max(300, "До 300 символов"),
});

export const TermBlocksUpdateSchema = z.object({
  id: z.uuid("Некорректный id термина"),
  blocks: z
    .string()
    .min(1, "Тело не может быть пустым")
    .transform((s, ctx) => {
      try {
        const parsed: unknown = JSON.parse(s);
        if (!Array.isArray(parsed)) {
          ctx.addIssue({
            code: "custom",
            message: "Тело должно быть массивом блоков",
          });
          return z.NEVER;
        }
        return parsed as unknown[];
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "Битый JSON в теле формы",
        });
        return z.NEVER;
      }
    }),
});

export const TermIdSchema = z.object({
  id: z.uuid("Некорректный id термина"),
});

export type TermCreateInput = z.infer<typeof TermCreateSchema>;
export type TermBlocksUpdateInput = z.infer<typeof TermBlocksUpdateSchema>;
export type TermIdInput = z.infer<typeof TermIdSchema>;
