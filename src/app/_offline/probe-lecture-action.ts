// src/app/_offline/probe-lecture-action.ts
"use server";

import "server-only";

import { getLectureById } from "@/features/lectures";
import { createAction } from "@/utils/create-action";

/** Лёгкая сверка статуса лекции для офлайн-ревалидации. */
export type LectureProbe =
  | { status: "present"; updatedAt: string }
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
 *
 * ИНВАРИАНТ: `getLectureById` НЕ бросает `BannedError` (на не-404 кидает обычный
 * Error). Благодаря этому фоновая сверка забаненного читателя даёт
 * `{ success: false }` → skip, а НЕ `redirect("/auth/forced-logout")` из уже
 * показанной офлайн-копии. При переводе read-фетчеров лекций на централизованный
 * error-handling (`rethrowApiError`) — сохранить это поведение или явно глушить
 * `BannedError` здесь.
 */
export const probeLectureForOffline = createAction(
  async (input: { id: string }): Promise<LectureProbe> => {
    const lecture = await getLectureById(input.id);
    if (!lecture) return { status: "gone" };
    // updated_at — required string в схеме; строгий eslint (no-unnecessary-
    // condition) запрещает мёртвую защиту `?? null`. Если бэк когда-то сделает
    // поле опциональным — реген + typecheck/lint заставят обновить здесь.
    return { status: "present", updatedAt: lecture.updated_at };
  },
);
