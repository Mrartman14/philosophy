"use client";

import { useActionState } from "react";
import { createLecture } from "@/features/admin/actions";
import type { ActionResult } from "@/utils/create-action";

// `createLecture` при успехе делает redirect — состояние успеха в клиенте
// не наблюдается. `null` как initialState явно обозначает «ничего ещё не
// происходило» и соответствует соглашению проекта (см. P1-#19, P2-#25).
// Runtime safe: server action не читает `_prevState`.
type CreateLectureAction = (
  prevState: ActionResult<{ id: string }> | null,
  formData: FormData,
) => Promise<ActionResult<{ id: string }>>;

export const LectureCreateForm: React.FC = () => {
  const [state, action, pending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(createLecture as CreateLectureAction, null);

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
      {state?.success === false && (
        <p className="text-xs text-red-500" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
};
