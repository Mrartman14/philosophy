// src/features/audit/schemas.ts
import "server-only";
import { z } from "zod";

import type { NamespaceT } from "@/i18n";

import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from "./target-types";

/**
 * Валидация фильтров audit-лога из URL searchParams.
 *
 * Строгие суб-схемы экспортируются для прямого unit-тестирования
 * failure-кейсов. В композитной схеме каждое поле обёрнуто
 * в .optional().catch(undefined): битый параметр (рукописный URL, устаревшая
 * закладка) молча отбрасывается, страница не падает.
 */

type ValidationT = NamespaceT<"validation">;

export function makeAuditActorSchema(t: ValidationT) {
  return z.uuid(t("audit.invalidActorUuid"));
}

export const AuditTargetTypeSchema = z.enum(AUDIT_TARGET_TYPES);

/**
 * action — сгенерированный enum `audit.Action` (бек навесил swaggo-enum).
 * Источник значений — `AUDIT_ACTIONS` (@/api/enums, completeness-checked):
 * новый action на беке → regen `schema.ts` краснит сборку, пока его не добавят.
 * Невалидное значение из URL молча отбрасывается (.catch(undefined) ниже).
 */
export function makeAuditActionSchema(t: ValidationT) {
  return z.enum(AUDIT_ACTIONS, { message: t("audit.invalidActionFormat") });
}

/**
 * Дата из <input type="datetime-local"> ("2026-06-12T13:45") или полный ISO.
 * Преобразуется в RFC3339 UTC, как ждёт GET /api/admin/audit. Строка без
 * таймзоны интерпретируется в TZ процесса Next-сервера — осознанный
 * компромисс для админ-инструмента (см. план, «Риски/допущения»).
 */
export function makeAuditDateSchema(t: ValidationT) {
  return z.string().transform((s, ctx) => {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: t("common.invalidDate") });
      return z.NEVER;
    }
    return d.toISOString();
  });
}

export const AuditOffsetSchema = z.coerce.number().int().min(0);

export function makeAuditLogFilterSchema(t: ValidationT) {
  return z.object({
    actor: makeAuditActorSchema(t).optional().catch(undefined),
    target_type: AuditTargetTypeSchema.optional().catch(undefined),
    target_id: z.string().trim().min(1).max(200).optional().catch(undefined),
    action: makeAuditActionSchema(t).optional().catch(undefined),
    from: makeAuditDateSchema(t).optional().catch(undefined),
    to: makeAuditDateSchema(t).optional().catch(undefined),
    offset: AuditOffsetSchema.optional().catch(undefined),
  });
}

export type AuditLogFilterInput = z.infer<ReturnType<typeof makeAuditLogFilterSchema>>;
