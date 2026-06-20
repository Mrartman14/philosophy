// src/features/documents/types.ts
import type { components } from "@/api/schema";
import type { AstBlock } from "@/components/ast-editor";

/** Полный документ (GET /api/documents/{id}, /api/me/documents, admin). */
export type Document = components["schemas"]["document.Document"];

/** Лёгкая сводка (picker GET /api/documents). */
export type DocumentSummary = components["schemas"]["document.DocumentSummary"];

/** Видимость: "private" | "public". */
export type { AccessVisibility as Visibility } from "@/api/types";

/** Мета-ревизии (элемент списка). */
export type DocumentRevisionMeta = components["schemas"]["revision.RevisionMeta"];

/** Полная ревизия со снапшотом blocks. */
export type DocumentRevision = components["schemas"]["revision.Revision"];

/** Один attachment (reverse-lookup лекций-контейнеров). */
export type AttachmentDTO = components["schemas"]["attachment.AttachmentDTO"];

/** Результат updateDocumentBlocks. `conflict` несёт свежую серверную пару
 *  blocks+version (single-GET после 412); `gone` — документ удалён в другом месте. */
export type DocumentBlocksSaveResult =
  | { kind: "saved"; document: Document | null }
  | { kind: "conflict"; theirs: { blocks: AstBlock[]; version: number } }
  | { kind: "gone" };
