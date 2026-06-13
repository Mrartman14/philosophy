// src/features/lectures/types.ts
import type { Lecture as LectureSchema } from "@/api/types";
import type { components } from "@/api/schema";

export type Lecture = LectureSchema;
export type LectureVisibility = components["schemas"]["lecture.Visibility"];
export type LectureListItem = Pick<
  Lecture,
  "id" | "owner_id" | "visibility" | "title" | "description" | "date" | "created_at" | "updated_at"
>;

/**
 * Минимальная форма тега для отображения. Объявлена локально, потому что
 * cross-feature импорт из @/features/tags запрещён ESLint'ом; реальные
 * данные (tag.Tag) структурно совместимы и прокидываются страницами.
 * name уникален на беке (UNIQUE) — годится как key.
 */
export type LectureTag = { name: string };

/** Документ, прикреплённый к лекции (GET /api/lectures/{id}/documents). */
export type LectureDocument = components["schemas"]["document.Document"];

/** Медиа, прикреплённое к лекции (GET /api/lectures/{id}/media). */
export type LectureMediaItem = components["schemas"]["media.Media"];

/** Элемент attachment-списка лекции (reverse — какие сущности прикреплены). */
export type LectureAttachment = components["schemas"]["attachment.AttachmentDTO"];

/** Тип прикрепляемой сущности. canvas валиден на беке, просмотра нет (§4 спеки). */
export type AttachmentEntityType = "document" | "media" | "canvas";

/** Один найденный термин глоссария (POST /api/glossary/suggest). */
export type GlossarySuggestion = components["schemas"]["suggest.Suggestion"];

/** Вхождение термина в блок текста (offset/length — БАЙТЫ UTF-8, см. §0.7). */
export type GlossaryOccurrence = components["schemas"]["suggest.Occurrence"];
