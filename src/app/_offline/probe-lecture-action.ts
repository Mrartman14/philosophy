// src/app/_offline/probe-lecture-action.ts
"use server";

import "server-only";

import { getLectureById } from "@/features/lectures";
import { createAction } from "@/utils/create-action";

/** Лёгкая сверка статуса лекции для офлайн-ревалидации. */
export type LectureProbe =
  | { status: "present"; updatedAt: string | null }
  | { status: "gone" };

/**
 * server-only: тянет ТОЛЬКО лекцию (не полный снимок). RBAC/доступ — внутри
 * `getLectureById` (тот же путь, что и `assembleOfflineBundle` при сохранении,
 * значит токен/доступ обрабатываются одинаково).
 *
 * - лекция → `{ status: "present", updatedAt }`
 * - 404 → `getLectureById` вернёт `null` → `{ status: "gone" }`
 * - сетевой/5xx сбой → бросок → `createAction` вернёт `{ success: false }`,
 *   вызыватель трактует как «пропустить» (best-effort).
 */
export const probeLectureForOffline = createAction(
  async (input: { id: string }): Promise<LectureProbe> => {
    const lecture = await getLectureById(input.id);
    if (!lecture) return { status: "gone" };
    // Явно приводим к `string | undefined` — защита от будущего регена схемы,
    // когда updated_at может стать опциональным (сейчас required).
    const updatedAt = (lecture.updated_at as string | undefined) ?? null;
    return { status: "present", updatedAt };
  },
);
