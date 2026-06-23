// src/features/audit/target-types.ts
import type { components } from "@/api/schema";

/**
 * Значения target_type audit-лога. Источник истины — сгенерированный
 * `audit.TargetType` (бек навесил swaggo-enum). Рантайм-значения (нужны и
 * Zod-схеме schemas.ts, и client-форме фильтров) — в `@/api/enums`, который
 * клиент-safe (без `server-only`). Новый домен на беке → regen `schema.ts`
 * → сборка краснеет, пока значение не добавят в `AUDIT_TARGET_TYPES`.
 */
export { AUDIT_TARGET_TYPES, AUDIT_ACTIONS } from "@/api/enums";

export type AuditTargetType = components["schemas"]["audit.TargetType"];
export type AuditAction = components["schemas"]["audit.Action"];
