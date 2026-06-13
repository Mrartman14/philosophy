// src/features/documents/types.ts
import type { components } from "@/api/schema";

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
