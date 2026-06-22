import "server-only";
import { z } from "zod";

import type { NamespaceT } from "@/i18n";

type ValidationT = NamespaceT<"validation">;

/**
 * POST /api/auth/login — форма входа.
 * Фабрика: принимает t = await getT("validation") для локализации сообщений.
 */
export function makeLoginSchema(t: ValidationT) {
  return z.object({
    username: z
      .string()
      .trim()
      .min(1, t("login.usernameRequired"))
      .max(200, t("login.usernameMax")),
    password: z
      .string()
      .min(1, t("login.passwordRequired"))
      .max(200, t("login.passwordMax")),
    next: z.string().optional(),
  });
}

export type LoginInput = z.infer<ReturnType<typeof makeLoginSchema>>;
/** Вход формы (pre-transform): имена полей и их required-ность для createTypedForm. */
export type LoginFormInput = z.input<ReturnType<typeof makeLoginSchema>>;

/**
 * POST /api/auth/register — форма регистрации.
 * Фабрика: принимает t = await getT("validation") для локализации сообщений.
 */
export function makeRegisterSchema(t: ValidationT) {
  return z
    .object({
      username: z
        .string()
        .trim()
        .min(3, t("register.usernameMin"))
        .max(30, t("register.usernameMax")),
      password: z
        .string()
        .min(6, t("register.passwordMin"))
        .max(72, t("register.passwordMax")),
      password_confirm: z.string(),
      next: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.password !== data.password_confirm) {
        ctx.addIssue({
          code: "custom",
          path: ["password_confirm"],
          message: t("register.passwordConfirmMismatch"),
        });
      }
    });
}

export type RegisterInput = z.infer<ReturnType<typeof makeRegisterSchema>>;
/** Вход формы (pre-transform): имена полей и их required-ность для createTypedForm. */
export type RegisterFormInput = z.input<ReturnType<typeof makeRegisterSchema>>;
