// src/features/tokens/schemas.ts
import "server-only";
import { z } from "zod";

import type { NamespaceT } from "@/i18n";

type ValidationT = NamespaceT<"validation">;

/**
 * Создание PAT из FormData (POST /api/me/tokens):
 *  - label ОБЯЗАТЕЛЕН (бек 422-ит пустой; в OpenAPI-типе помечен optional, но
 *    правило живёт в хендлере — поэтому требуем здесь явно), 1..100;
 *  - expires_in_days опционален; пусто → undefined (бессрочный токен), иначе
 *    целое 1..90 (границы из swagger бека: pat.createTokenRequest).
 */
export function makeCreateTokenSchema(t: ValidationT) {
  return z.object({
    label: z
      .string()
      .trim()
      .min(1, t("tokens.labelRequired"))
      .max(100, t("tokens.labelMax")),
    // Явный transform (а не coerce+pipe): чище выводит тип `number | undefined`
    // и не теряет его в `any`. Пусто → undefined (бессрочно).
    expires_in_days: z
      .string()
      .optional()
      .transform((v, ctx): number | undefined => {
        const s = v?.trim();
        if (!s) return undefined;
        const n = Number(s);
        if (!Number.isInteger(n)) {
          ctx.addIssue({ code: "custom", message: t("tokens.expiresInt") });
          return z.NEVER;
        }
        if (n < 1) {
          ctx.addIssue({ code: "custom", message: t("tokens.expiresMin") });
          return z.NEVER;
        }
        if (n > 90) {
          ctx.addIssue({ code: "custom", message: t("tokens.expiresMax") });
          return z.NEVER;
        }
        return n;
      }),
  });
}

export type CreateTokenInput = z.infer<ReturnType<typeof makeCreateTokenSchema>>;
/** Вход формы (pre-transform): имена полей и их required-ность для createTypedForm. */
export type CreateTokenFormInput = z.input<ReturnType<typeof makeCreateTokenSchema>>;

/** PUT /api/me/tokens/usage-tracking — булево enabled (без сообщений → const). */
export const UsageTrackingSchema = z.boolean();
