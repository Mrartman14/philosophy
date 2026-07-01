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
  DocumentListItem,
  DocumentSummary,
  Visibility,
  DocumentRevision,
  DocumentRevisionMeta,
  AttachmentDTO,
} from "./types";

// === Этап B: actions + формы создания/редактирования/удаления ===
export {
  createDocument,
  uploadDocument,
  updateDocumentMeta,
  updateDocumentBlocks,
  setDocumentVisibility,
  deleteDocument,
  adminDeleteDocument,
} from "./actions";
export { DocumentCreateForm } from "./ui/document-create-form";
export { DocumentUploadForm } from "./ui/document-upload-form";
export { DocumentEditForm } from "./ui/document-edit-form";
export { DocumentMetaForm } from "./ui/document-meta-form";
export { DocumentVisibilityButton } from "./ui/document-visibility-button";
export { DocumentDeleteButton } from "./ui/document-delete-button";

// === Этап C: detail, ревизии, контейнеры, export, admin-строка ===
export { DocumentDetail } from "./ui/document-detail";
export { DocumentExportLinks } from "./ui/document-export-links";
export { DocumentMyList } from "./ui/document-my-list";
export { DocumentRevisions } from "./ui/document-revisions";
export { DocumentContainers } from "./ui/document-containers";
export { DocumentAdminRow } from "./ui/document-admin-row";
