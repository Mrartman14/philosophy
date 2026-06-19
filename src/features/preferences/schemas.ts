// src/features/preferences/schemas.ts
import "server-only";
import { z } from "zod";

import { READING_MODES } from "./types";

/** PATCH /api/me/preferences — единственное поле reading_mode. */
export const PreferencesUpdateSchema = z.object({
  reading_mode: z.enum(READING_MODES),
});

/**
 * POST /api/push/subscribe — форма push.SubscribeRequest бекенда.
 * На вход подаётся PushSubscription.toJSON() из браузера; лишние поля
 * (expirationTime) Zod отбрасывает.
 */
export const PushSubscribeSchema = z.object({
  endpoint: z.url("Некорректный endpoint подписки"),
  keys: z.object({
    p256dh: z.string().min(1, "Пустой ключ p256dh"),
    auth: z.string().min(1, "Пустой ключ auth"),
  }),
});

/** DELETE /api/push/subscribe — форма push.UnsubscribeRequest. */
export const PushUnsubscribeSchema = z.object({
  endpoint: z.url("Некорректный endpoint подписки"),
});

/**
 * POST /api/admin/push/send — форма push.SendRequest (title обязателен).
 * Пустые строки из FormData превращаются в undefined, чтобы не слать
 * в бекенд пустые body/url.
 */
export const PushSendSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Введите заголовок")
    .max(200, "До 200 символов"),
  body: z
    .string()
    .trim()
    .max(1000, "До 1000 символов")
    .transform((s) => (s === "" ? undefined : s))
    .optional(),
  url: z
    .string()
    .trim()
    .refine(
      (s) => s === "" || s.startsWith("/") || /^https?:\/\//.test(s),
      "URL должен начинаться с «/» или «http(s)://»",
    )
    .transform((s) => (s === "" ? undefined : s))
    .optional(),
});

// NB: appearance payload validation lives in the typed contract now — persist-appearance.ts
// builds a `preference.Appearance` (from @/api/schema) directly, so a separate Zod schema
// would be redundant (and its contrast enum would drift from the backend's normal|high).

export type PreferencesUpdateInput = z.infer<typeof PreferencesUpdateSchema>;
export type PushSubscribeInput = z.infer<typeof PushSubscribeSchema>;
export type PushUnsubscribeInput = z.infer<typeof PushUnsubscribeSchema>;
export type PushSendInput = z.infer<typeof PushSendSchema>;
