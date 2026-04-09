"use client";

import { useActionState } from "react";
import { createLecture } from "@/features/admin/actions";
import type { ActionResult } from "@/utils/create-action";

const initialState: ActionResult<{ id: string }> = {
  success: true,
  data: { id: "" },
};

export const LectureCreateForm: React.FC = () => {
  const [state, action, pending] = useActionState(createLecture, initialState);

  return (
    <form
      action={action}
      className="flex flex-col gap-2 border border-(--color-border) rounded-lg p-4"
    >
      <h2 className="text-sm font-semibold">Новая лекция</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          type="text"
          name="title"
          placeholder="Название"
          required
          className="px-3 py-2 border border-(--color-border) rounded bg-transparent text-sm"
        />
        <input
          type="date"
          name="date"
          required
          className="px-3 py-2 border border-(--color-border) rounded bg-transparent text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="px-3 py-2 bg-(--color-primary) text-(--color-background) rounded text-sm disabled:opacity-50"
        >
          {pending ? "Создание…" : "Создать"}
        </button>
      </div>
      <textarea
        name="description"
        placeholder="Описание (необязательно)"
        rows={2}
        className="px-3 py-2 border border-(--color-border) rounded bg-transparent text-sm resize-none"
      />
      {!state.success && (
        <p className="text-xs text-red-500" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
};
