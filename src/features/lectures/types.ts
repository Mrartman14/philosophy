// src/features/lectures/types.ts
import type { Lecture as LectureSchema } from "@/api/types";
import type { components } from "@/api/schema";

export type Lecture = LectureSchema;
export type LectureVisibility = components["schemas"]["lecture.Visibility"];
export type LectureListItem = Pick<
  Lecture,
  "id" | "owner_id" | "visibility" | "title" | "description" | "date" | "created_at" | "updated_at"
>;
