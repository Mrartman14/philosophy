// src/features/audit/schemas.ts
import "server-only";
import { z } from "zod";
import { AUDIT_TARGET_TYPES } from "./target-types";

/**
 * Валидация фильтров audit-лога из URL searchParams.
 *
 * Строгие суб-схемы экспортируются для прямого unit-тестирования
 * failure-кейсов. В композитной AuditLogFilterSchema каждое поле обёрнуто
 * в .optional().catch(undefined): битый параметр (рукописный URL, устаревшая
 * закладка) молча отбрасывается, страница не падает.
 */

export const AuditActorSchema = z.string().uuid("Некорректный UUID актора");

export const AuditTargetTypeSchema = z.enum(AUDIT_TARGET_TYPES);

/** Формат action на беке: domain.verb (изредка domain.noun.verb), snake_case. */
export const AuditActionSchema = z
  .string()
  .trim()
  .regex(/^[a-z_]+(\.[a-z_]+){1,2}$/, "Формат: domain.verb");

/**
 * Дата из <input type="datetime-local"> ("2026-06-12T13:45") или полный ISO.
 * Преобразуется в RFC3339 UTC, как ждёт GET /api/admin/audit. Строка без
 * таймзоны интерпретируется в TZ процесса Next-сервера — осознанный
 * компромисс для админ-инструмента (см. план, «Риски/допущения»).
 */
export const AuditDateSchema = z.string().transform((s, ctx) => {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Некорректная дата" });
    return z.NEVER;
  }
  return d.toISOString();
});

export const AuditOffsetSchema = z.coerce.number().int().min(0);

export const AuditLogFilterSchema = z.object({
  actor: AuditActorSchema.optional().catch(undefined),
  target_type: AuditTargetTypeSchema.optional().catch(undefined),
  target_id: z.string().trim().min(1).max(200).optional().catch(undefined),
  action: AuditActionSchema.optional().catch(undefined),
  from: AuditDateSchema.optional().catch(undefined),
  to: AuditDateSchema.optional().catch(undefined),
  offset: AuditOffsetSchema.optional().catch(undefined),
});

export type AuditLogFilterInput = z.infer<typeof AuditLogFilterSchema>;
