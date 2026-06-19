"use client";
import { useActionState, type ChangeEvent } from "react";

import { useT } from "@/i18n/client";
import type { ActionResult } from "@/utils/create-action";

import { setLectureVisibility } from "../actions";
import type { Lecture } from "../types";

const initial: ActionResult<Lecture | null> = { success: true, data: null };

export function LectureVisibilityToggle({
  lecture,
}: {
  lecture: Pick<Lecture, "id" | "visibility">;
}) {
  const tL = useT("lectures");
  const tErrors = useT("errors");

  // Браузер сохраняет выбранный пользователем option в DOM до перезагрузки.
  // Сервер revalidate'ит lectures-кеш в action — на следующей навигации
  // server-component получит свежие данные.
  const [state, action] = useActionState(setLectureVisibility, initial);

  function autoSubmit(e: ChangeEvent<HTMLSelectElement>) {
    e.currentTarget.form?.requestSubmit();
  }

  return (
    <form action={action} className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor="lecture-visibility">
        {tL("visibilityLabel")}
      </label>
      <input type="hidden" name="id" value={lecture.id} />
      <select
        id="lecture-visibility"
        name="visibility"
        defaultValue={lecture.visibility}
        onChange={autoSubmit}
        className="h-10 rounded border border-(--color-border) bg-(--color-surface) px-3 text-sm"
      >
        <option value="private">{tL("visibilityPrivate")}</option>
        <option value="public">{tL("visibilityPublic")}</option>
      </select>
      {!state.success && state.code === "forbidden" && (
        <p className="text-xs text-red-600">
          {tErrors("forbiddenAction", { action: tL("visibilityForbiddenAction") })}
        </p>
      )}
      {!state.success && !state.code && (
        <p className="text-xs text-red-600">{state.error}</p>
      )}
    </form>
  );
}
