"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Lecture } from "@/api/types";
import { updateLecture } from "@/features/admin/actions";
import type { ActionResult } from "@/utils/create-action";

interface LectureEditorProps {
  lecture: Lecture;
}

// `updateLecture` по сигнатуре принимает `prevState: ActionResult<void>`,
// но по общему соглашению проекта `initialState` у `useActionState` — `null`
// (см. P1-#19). Runtime это безопасно: server action не читает `_prevState`.
type UpdateLectureAction = (
  prevState: ActionResult<void> | null,
  formData: FormData,
) => Promise<ActionResult<void>>;

function toDateInput(iso: string): string {
  // поддерживаем и "YYYY-MM-DD", и полные ISO
  try {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  } catch {
    // fallthrough
  }
  return iso.slice(0, 10);
}

export const LectureEditor: React.FC<LectureEditorProps> = ({ lecture }) => {
  const [state, action, pending] = useActionState<
    ActionResult<void> | null,
    FormData
  >(updateLecture as UpdateLectureAction, null);

  // Показываем «Сохранено» только после фактического перехода
  // `pending → !pending` с успешным результатом, и только на 2 секунды.
  // setState уведён в async-колбэки таймеров, чтобы не нарушать правило
  // `react-hooks/set-state-in-effect`.
  const [justSaved, setJustSaved] = useState(false);
  const prevPendingRef = useRef(pending);
  useEffect(() => {
    const wasPending = prevPendingRef.current;
    prevPendingRef.current = pending;
    if (wasPending && !pending && state?.success === true) {
      const showTimer = setTimeout(() => setJustSaved(true), 0);
      const hideTimer = setTimeout(() => setJustSaved(false), 2000);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [pending, state]);

  return (
    <form
      action={action}
      className="flex flex-col gap-3 border border-(--color-border) rounded-lg p-4"
    >
      <input type="hidden" name="id" value={lecture.id} />

      <label className="flex flex-col gap-1 text-sm">
        <span>Название</span>
        <input
          type="text"
          name="title"
          defaultValue={lecture.title}
          className="px-3 py-2 border border-(--color-border) rounded bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Дата</span>
        <input
          type="date"
          name="date"
          defaultValue={toDateInput(lecture.date)}
          className="px-3 py-2 border border-(--color-border) rounded bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Описание</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={lecture.description ?? ""}
          className="px-3 py-2 border border-(--color-border) rounded bg-transparent resize-none"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-3 py-2 bg-(--color-primary) text-(--color-background) rounded text-sm disabled:opacity-50"
        >
          {pending ? "Сохранение…" : "Сохранить"}
        </button>
        {justSaved && (
          <span className="text-xs text-(--color-description)" role="status">
            Сохранено
          </span>
        )}
        {state?.success === false && (
          <span className="text-xs text-red-500" role="alert">
            {state.code === "forbidden"
              ? "У вас нет прав на редактирование лекции."
              : state.error}
          </span>
        )}
      </div>
    </form>
  );
};
