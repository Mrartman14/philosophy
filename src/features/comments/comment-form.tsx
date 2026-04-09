"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import type { ActionResult } from "@/utils/create-action";
import type { Comment } from "@/api/types";
import { createComment, editComment } from "./actions";

interface CommentFormProps {
  lectureId: string;
  /** Показывать чекбокс "Анонимно" — только для залогиненных юзеров */
  allowAnonymous: boolean;
  /** Если задан — форма работает в режиме редактирования */
  editing?: {
    commentId: string;
    initialBody: string;
    onCancel?: () => void;
  };
}

// `createComment` / `editComment` по сигнатуре принимают
// `prevState: ActionResult<Comment>`, но по общему соглашению проекта
// `initialState` у `useActionState` — `null` (см. P1-#19, P2-#11).
// Runtime safe: обе server action внутри не читают `_prevState`.
type CommentAction = (
  prevState: ActionResult<Comment> | null,
  formData: FormData,
) => Promise<ActionResult<Comment>>;

export const CommentForm: React.FC<CommentFormProps> = ({
  lectureId,
  allowAnonymous,
  editing,
}) => {
  const isEditing = Boolean(editing);
  const action: CommentAction = isEditing
    ? (editComment as CommentAction)
    : (createComment as CommentAction);
  const [state, formAction, isPending] = useActionState<
    ActionResult<Comment> | null,
    FormData
  >(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const bodyId = useId();
  const anonId = useId();

  // Всегда свежая ссылка на `editing.onCancel` — чтобы не добавлять
  // `editing` в deps effect'а ниже (пропс-объект пересоздаётся родителем
  // на каждый рендер, эффект нужно запускать только по смене `state`).
  const onCancelRef = useRef(editing?.onCancel);
  useEffect(() => {
    onCancelRef.current = editing?.onCancel;
  }, [editing?.onCancel]);

  // После успешного создания — очищаем форму
  useEffect(() => {
    if (!isEditing && state?.success && formRef.current) {
      formRef.current.reset();
    }
  }, [state, isEditing]);

  // После успешного редактирования — закрываем форму.
  // Зависимости намеренно ограничены `[state, isEditing]`: `editing` —
  // пропс-объект, который родитель может пересоздавать на каждый рендер,
  // и добавление его в deps приведёт к повторным вызовам `onCancel`.
  // Актуальный колбэк читаем через `onCancelRef`.
  useEffect(() => {
    if (isEditing && state?.success) {
      onCancelRef.current?.();
    }
  }, [state, isEditing]);

  const errorMessage =
    state && !state.success && state.error
      ? state.code === "forbidden"
        ? isEditing
          ? "У вас нет прав на редактирование комментария."
          : "У вас нет прав на отправку комментария."
        : state.error
      : null;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-2 p-3 border border-(--color-border) rounded-lg"
    >
      <input type="hidden" name="lectureId" value={lectureId} />
      {isEditing && editing && (
        <input type="hidden" name="commentId" value={editing.commentId} />
      )}

      <label htmlFor={bodyId} className="sr-only">
        Текст комментария
      </label>
      <textarea
        id={bodyId}
        name="body"
        required
        rows={3}
        defaultValue={editing?.initialBody ?? ""}
        placeholder={isEditing ? "Изменить комментарий..." : "Ваш комментарий..."}
        className="w-full p-2 rounded-md border border-(--color-border) bg-(--color-background) text-sm resize-y"
      />

      <div className="flex items-center justify-between gap-2">
        {!isEditing && allowAnonymous ? (
          <label
            htmlFor={anonId}
            className="flex items-center gap-2 text-xs text-(--color-description) cursor-pointer"
          >
            <input
              id={anonId}
              type="checkbox"
              name="is_anonymous"
              className="accent-(--color-primary)"
            />
            Анонимно
          </label>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-2">
          {isEditing && editing?.onCancel && (
            <button
              type="button"
              onClick={editing.onCancel}
              disabled={isPending}
              className="text-xs px-3 py-1 rounded-md border border-(--color-border) hover:bg-(--color-text-pane) disabled:opacity-50"
            >
              Отмена
            </button>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="text-xs px-3 py-1 rounded-md bg-(--color-primary) text-white hover:opacity-90 disabled:opacity-50"
          >
            {isPending
              ? "Отправка..."
              : isEditing
              ? "Сохранить"
              : "Отправить"}
          </button>
        </div>
      </div>

      {errorMessage && (
        <p role="alert" className="text-xs text-red-500">
          {errorMessage}
        </p>
      )}
    </form>
  );
};
