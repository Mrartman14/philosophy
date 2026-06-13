// src/features/share-links/schemas.ts
import "server-only";
import { z } from "zod";
import { SHARE_RESOURCE_TYPES, ALL_RESOURCE_TYPES } from "./types";

/**
 * Дата из <input type="datetime-local"> ("2026-06-13T13:45") или полный ISO.
 * Нормализуется в RFC3339 UTC (как ждёт POST /api/share-links). Проверку
 * «в будущем» делает бек (422); здесь — только формат, иначе UX-двойная
 * валидация рассинхронится с серверной TZ.
 */
const ExpiresAtSchema = z.string().transform((s, ctx) => {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Некорректная дата" });
    return z.NEVER;
  }
  return d.toISOString();
});

/**
 * Создание ссылки из FormData. resource_type ограничен SHARE_RESOURCE_TYPES
 * (без canvas — фронт его не предлагает). expires_at опционален; пустая
 * строка из формы трактуется как «без срока».
 */
export const ShareLinkCreateSchema = z.object({
  resource_type: z.enum(SHARE_RESOURCE_TYPES),
  resource_id: z.string().trim().min(1, "Укажите ID ресурса").max(200),
  expires_at: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v : undefined))
    .pipe(ExpiresAtSchema.optional()),
});

export type ShareLinkCreateInput = z.infer<typeof ShareLinkCreateSchema>;

/**
 * Поиск ссылок по ресурсу (страницы /share-links и /admin/share-links).
 * Допускает все backend-типы, включая canvas (admin может встретить
 * canvas-ссылку). Используется и для парсинга searchParams: битый тип → fail,
 * страница покажет пустую форму.
 */
export const ShareLinkLookupSchema = z.object({
  resource_type: z.enum(ALL_RESOURCE_TYPES),
  resource_id: z.string().trim().min(1).max(200),
});

export type ShareLinkLookupInput = z.infer<typeof ShareLinkLookupSchema>;

/** Revoke по токену. */
export const RevokeTokenSchema = z.object({
  token: z.string().trim().min(1, "Токен обязателен"),
});

export type RevokeTokenInput = z.infer<typeof RevokeTokenSchema>;
