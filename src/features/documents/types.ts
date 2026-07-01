// src/features/documents/types.ts
import type { components } from "@/api/schema";
import type { AstBlock } from "@/components/ast-editor";

/** Полный документ (GET /api/documents/{id}). Несёт blocks/created_at/is_entry. */
export type Document = components["schemas"]["document.Document"];

/**
 * Облегчённый элемент листинга (GET /api/documents?scope=...). Без blocks —
 * только filename/id/owner/updated_at/version/visibility. После реген-контракта
 * это форма ответа всех scope-фасетов (mine|all|visible|public).
 */
export type DocumentListItem = components["schemas"]["document.DocumentListItem"];

/**
 * Лёгкая сводка для пиккера (GET /api/documents?scope=visible). После
 * реген-контракта схема `document.DocumentSummary` УДАЛЕНА — все scope-фасеты
 * листинга, включая пиккерный visible, теперь отдают `DocumentListItem`.
 * Алиас сохранён для совместимости имени и указывает на актуальную форму.
 * ВНИМАНИЕ (флаг оркестратору): другие слои (`@/api/types`,
 * `src/components/ast-editor/pickers`, `src/features/lectures/actions.ts`) всё
 * ещё ссылаются на удалённую `document.DocumentSummary` — это вне слайса
 * documents, нужен реалайн там.
 */
export type DocumentSummary = DocumentListItem;

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
