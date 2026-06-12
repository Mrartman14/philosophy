// src/features/audit/types.ts
import type { components } from "@/api/schema";

/**
 * Запись audit-лога: GET /api/admin/audit → data[].
 * Все поля в сгенерированном типе optional — UI обязан рендерить
 * отсутствующие значения как «—».
 */
export type AuditRecord = components["schemas"]["audit.Record"];
