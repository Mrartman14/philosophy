// src/features/documents/index.ts
export {
  getMyDocuments,
  getDocumentById,
  getDocumentContainers,
  getDocumentRevisions,
  getDocumentRevision,
  getAdminDocuments,
} from "./api";
export type {
  DocumentListFilter,
  DocumentListResult,
  AdminDocumentListFilter,
} from "./api";
export {
  canCreateDocument,
  canEditDocument,
  canDeleteDocument,
  canAdminDeleteDocument,
  canListAdminDocuments,
  canSeeRevisions,
} from "./permissions";
export { documentExportUrls } from "./export-urls";
export type { DocumentExportUrls } from "./export-urls";
export type {
  Document,
  DocumentSummary,
  Visibility,
  DocumentRevision,
  DocumentRevisionMeta,
  AttachmentDTO,
} from "./types";
// UI-экспорты добавляются в Этапах B и C (см. задачи 8–22).
