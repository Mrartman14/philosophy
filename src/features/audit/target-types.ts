// src/features/audit/target-types.ts

/**
 * Известные значения target_type audit-лога. Источник — call-sites
 * audit.Logger в philosophy-api/internal (grep `TargetType:`, июнь 2026).
 * Динамический случай share_link.create пишет TargetType = ResourceType
 * ссылки (lecture|document|trail|media|form|canvas) — все уже в перечне.
 *
 * Файл намеренно БЕЗ `import "server-only"`: перечень нужен и Zod-схеме
 * (schemas.ts, server-only), и client-форме фильтров.
 *
 * Append-only: новые типы добавлять при появлении новых доменов на беке.
 */
export const AUDIT_TARGET_TYPES = [
  "annotation",
  "banner",
  "canvas",
  "comment",
  "document",
  "event",
  "form",
  "glossary_term",
  "lecture",
  "media",
  "push",
  "tag",
  "trail",
  "user",
] as const;

export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];
