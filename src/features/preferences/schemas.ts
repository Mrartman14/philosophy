// src/features/preferences/schemas.ts
import "server-only";
import { z } from "zod";

import type { NamespaceT } from "@/i18n";

import { READING_MODES } from "./types";

/**
 * Zod-схемы как ФАБРИКИ `makeXSchema(t)` — паттерн локализации форм-ошибок.
 *
 * `t = await getT("validation")` (request-scope) подаётся при разборе формы:
 *   const input = parseFormData(makePushSendSchema(await getT("validation")), formData);
 *
 * Сообщения — ключи namespace `validation` (ru/validation.ts + en/validation.ts),
 * НЕ литералы. Текст резолвится здесь, на сервере, при определении схемы, и летит
 * по тому же каналу `fieldErrors`, что и бекенд-422 (никаких client-изменений).
 * `t` типизирован `NamespaceT<"validation">` — без прямого импорта next-intl
 * (Guardrail 5); опечатка в ключе краснеет в `tsc`.
 *
 * Схемы без пользовательских сообщений (только enum/типы) остаются простыми
 * const'ами — фабрика нужна ТОЛЬКО когда есть переводимая строка.
 */
type ValidationT = NamespaceT<"validation">;

/** PATCH /api/me/preferences — единственное поле reading_mode (без сообщений → const). */
export const PreferencesUpdateSchema = z.object({
  reading_mode: z.enum(READING_MODES),
});

/**
 * POST /api/push/subscribe — форма push.SubscribeRequest бекенда.
 * На вход подаётся PushSubscription.toJSON() из браузера; лишние поля
 * (expirationTime) Zod отбрасывает.
 */
export function makePushSubscribeSchema(t: ValidationT) {
  return z.object({
    endpoint: z.url(t("pushSubscribe.endpoint")),
    keys: z.object({
      p256dh: z.string().min(1, t("pushSubscribe.p256dh")),
      auth: z.string().min(1, t("pushSubscribe.auth")),
    }),
  });
}

/** DELETE /api/push/subscribe — форма push.UnsubscribeRequest. */
export function makePushUnsubscribeSchema(t: ValidationT) {
  return z.object({
    endpoint: z.url(t("pushSubscribe.endpoint")),
  });
}

/**
 * POST /api/admin/push/send — форма push.SendRequest (title обязателен).
 * Пустые строки из FormData превращаются в undefined, чтобы не слать
 * в бекенд пустые body/url.
 */
export function makePushSendSchema(t: ValidationT) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(1, t("pushSend.titleRequired"))
      .max(200, t("pushSend.titleMax")),
    body: z
      .string()
      .trim()
      .max(1000, t("pushSend.bodyMax"))
      .transform((s) => (s === "" ? undefined : s))
      .optional(),
    url: z
      .string()
      .trim()
      .refine(
        (s) => s === "" || s.startsWith("/") || /^https?:\/\//.test(s),
        t("pushSend.urlFormat"),
      )
      .transform((s) => (s === "" ? undefined : s))
      .optional(),
  });
}

// NB: appearance payload validation lives in the typed contract now — persist-appearance.ts
// builds a `preference.Appearance` (from @/api/schema) directly, so a separate Zod schema
// would be redundant (and its contrast enum would drift from the backend's normal|high).

export type PreferencesUpdateInput = z.infer<typeof PreferencesUpdateSchema>;
/** Вход формы (pre-transform): имена полей и их required-ность для createTypedForm. */
export type PreferencesFormInput = z.input<typeof PreferencesUpdateSchema>;
export type PushSubscribeInput = z.infer<ReturnType<typeof makePushSubscribeSchema>>;
export type PushUnsubscribeInput = z.infer<ReturnType<typeof makePushUnsubscribeSchema>>;
export type PushSendInput = z.infer<ReturnType<typeof makePushSendSchema>>;
/** Вход формы (pre-transform): имена полей и их required-ность для createTypedForm. */
export type PushSendFormInput = z.input<ReturnType<typeof makePushSendSchema>>;
