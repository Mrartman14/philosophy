"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { sendPush } from "@/features/admin/actions";
import type { ActionResult } from "@/utils/create-action";

// `sendPush` (создан через `createFormAction`) по сигнатуре принимает
// `prevState: ActionResult<void>`, но по общему соглашению проекта
// `initialState` у `useActionState` — `null` (см. P1-#19). Runtime это
// безопасно: server action не читает `_prevState`. Приводим тип action'а,
// чтобы `useActionState` принял `null` как стартовое состояние.
type PushAction = (
  prevState: ActionResult<void> | null,
  formData: FormData,
) => Promise<ActionResult<void>>;

export const PushSender: React.FC = () => {
  const [state, action, pending] = useActionState<
    ActionResult<void> | null,
    FormData
  >(sendPush as PushAction, null);

  // Показываем индикатор «Отправлено» только после фактического перехода
  // `pending → !pending` и только если результат успешный. setState
  // уводим в async-колбэки таймеров, чтобы не нарушать правило
  // `react-hooks/set-state-in-effect`.
  const [justSent, setJustSent] = useState(false);
  const prevPendingRef = useRef(pending);
  useEffect(() => {
    const wasPending = prevPendingRef.current;
    prevPendingRef.current = pending;
    if (wasPending && !pending && state?.success === true) {
      const showTimer = setTimeout(() => setJustSent(true), 0);
      const hideTimer = setTimeout(() => setJustSent(false), 2000);
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
        {/*
          `type="text"`, а не `type="url"`: нужен относительный путь вида
          `/lectures/...`, который браузерная валидация `url` отклоняет.
          Валидация формата — на стороне server action.
        */}
        <input
          type="text"
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

      {justSent && (
        <p className="text-xs text-(--color-description)" role="status">
          Отправлено
        </p>
      )}
      {state?.success === false && (
        <p className="text-xs text-red-500" role="alert">
          {state.code === "forbidden"
            ? "У вас нет прав на отправку push-уведомлений."
            : state.error}
        </p>
      )}
    </form>
  );
};
