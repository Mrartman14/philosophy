"use client";

import { useActionState } from "react";
import { sendPush } from "@/features/admin/actions";
import type { ActionResult } from "@/utils/create-action";

const initialState: ActionResult<void> = { success: true, data: undefined };

export const PushSender: React.FC = () => {
  const [state, action, pending] = useActionState(sendPush, initialState);

  return (
    <form
      action={action}
      className="flex flex-col gap-3 border border-(--color-border) rounded-lg p-4"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span>Заголовок</span>
        <input
          type="text"
          name="title"
          required
          className="px-3 py-2 border border-(--color-border) rounded bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>Текст</span>
        <textarea
          name="body"
          rows={3}
          className="px-3 py-2 border border-(--color-border) rounded bg-transparent resize-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>URL (необязательно)</span>
        <input
          type="url"
          name="url"
          placeholder="/lectures/..."
          className="px-3 py-2 border border-(--color-border) rounded bg-transparent"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="self-start px-3 py-2 bg-(--color-primary) text-(--color-background) rounded text-sm disabled:opacity-50"
      >
        {pending ? "Отправка…" : "Отправить"}
      </button>

      {state.success === true && !pending && (
        <p className="text-xs text-(--color-description)">
          Готово к отправке
        </p>
      )}
      {state.success === false && (
        <p className="text-xs text-red-500" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
};
