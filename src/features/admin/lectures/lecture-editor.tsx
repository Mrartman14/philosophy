"use client";

import { useActionState } from "react";
import type { Lecture } from "@/api/types";
import { updateLecture } from "@/features/admin/actions";
import type { ActionResult } from "@/utils/create-action";

interface LectureEditorProps {
  lecture: Lecture;
}

const initialState: ActionResult<void> = { success: true, data: undefined };

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
  const [state, action, pending] = useActionState(updateLecture, initialState);

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
          defaultValue={lecture.description}
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
        {state.success === true && !pending && (
          <span className="text-xs text-(--color-description)">
            Готово к сохранению
          </span>
        )}
        {state.success === false && (
          <span className="text-xs text-red-500" role="alert">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
};
