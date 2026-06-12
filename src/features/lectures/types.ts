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
