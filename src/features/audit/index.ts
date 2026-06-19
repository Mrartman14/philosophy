// src/features/audit/index.ts
// Public API слайса audit. Снаружи слайс импортируется только отсюда
// (deep-imports запрещены ESLint'ом).

export { getAuditLog, type AuditLogFilter, type AuditLogResult } from "./api";
export { canReadAudit } from "./permissions";
export { makeAuditLogFilterSchema, type AuditLogFilterInput } from "./schemas";
export type { AuditRecord } from "./types";
export { AuditFilterForm } from "./ui/audit-filter-form";
export { AuditTable } from "./ui/audit-table";
