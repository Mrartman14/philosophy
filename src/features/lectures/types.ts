// src/features/lectures/types.ts
import type { components } from "@/api/schema";
import type { Lecture as LectureSchema } from "@/api/types";

export type Lecture = LectureSchema;
export type LectureVisibility = components["schemas"]["access.Visibility"];
export type LectureListItem = Pick<
  Lecture,
  "id" | "owner" | "visibility" | "title" | "description" | "date" | "created_at" | "updated_at"
>;

/**
 * Минимальная форма тега для отображения. Cross-feature импорт из
 * @/features/tags запрещён ESLint'ом, но сам сгенерированный тип `tag.Tag`
 * импортировать можно — якорим `name` на схему (UNIQUE на беке → годится
 * как key; рендер сломается, если бек переименует поле).
 */
export type LectureTag = Pick<components["schemas"]["tag.Tag"], "name">;

/** Документ, прикреплённый к лекции (GET /api/lectures/{id}/documents). */
export type LectureDocument = components["schemas"]["document.Document"];

/** Медиа, прикреплённое к лекции (GET /api/lectures/{id}/media). */
export type LectureMediaItem = components["schemas"]["media.Media"];

/**
 * Канвас, прикреплённый к лекции (GET /api/lectures/{id}/canvases). Лёгкий
 * листинг — `data` графа НЕ приходит (рендер на /canvases/{id}); `is_entry`
 * помечает основной канвас лекции и выставляется только этим листингом.
 */
export type LectureCanvasItem = components["schemas"]["canvas.Canvas"];

/** Элемент attachment-списка лекции (reverse — какие сущности прикреплены). */
export type LectureAttachment = components["schemas"]["attachment.AttachmentDTO"];

/**
 * Тип прикрепляемой сущности. Ре-экспорт сгенерированного enum из request-схемы
 * attachment (`validate:"oneof=document media canvas"` на бэке). canvas валиден
 * на беке, отдельного просмотра нет (§4 спеки). НЕ редактировать руками.
 */
export type AttachmentEntityType =
  components["schemas"]["attachment.CreateAttachmentRequest"]["entity_type"];

/** Один найденный термин глоссария (POST /api/glossary/suggest). */
export type GlossarySuggestion = components["schemas"]["suggest.Suggestion"];

/** Вхождение термина в блок текста (offset/length — БАЙТЫ UTF-8, см. §0.7). */
export type GlossaryOccurrence = components["schemas"]["suggest.Occurrence"];
