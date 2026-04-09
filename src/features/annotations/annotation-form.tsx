"use client";

import { useActionState, useEffect } from "react";
import { createAnnotation } from "./actions";
import type { ActionResult } from "@/utils/create-action";
import type { Annotation } from "@/api/types";

interface AnnotationFormProps {
  lectureId: string;
  selectedSegmentIds: number[];
  onSuccess?: () => void;
  onCancel?: () => void;
}

const initialState: ActionResult<Annotation> = {
  success: false,
  error: "",
};

export const AnnotationForm: React.FC<AnnotationFormProps> = ({
  lectureId,
  selectedSegmentIds,
  onSuccess,
  onCancel,
}) => {
  const [state, formAction, isPending] = useActionState(
    createAnnotation,
    initialState
  );

  useEffect(() => {
    if (state.success) {
      onSuccess?.();
    }
  }, [state, onSuccess]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 p-3 border border-(--color-border) rounded-lg bg-(--color-text-pane)"
    >
      <input type="hidden" name="lecture_id" value={lectureId} />
      <input
        type="hidden"
        name="segment_ids"
        value={selectedSegmentIds.join(",")}
      />

      <div className="text-xs text-(--color-description)">
        Сегменты:{" "}
        {selectedSegmentIds.length > 0
          ? selectedSegmentIds.map((s) => `#${s + 1}`).join(", ")
          : "не выбраны"}
      </div>

      <textarea
        name="body"
        required
        minLength={1}
        maxLength={10000}
        rows={4}
        placeholder="Текст аннотации..."
        className="w-full p-2 rounded border border-(--color-border) bg-transparent text-sm resize-y"
        disabled={isPending}
      />

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" name="is_private" disabled={isPending} />
          Приватная
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" name="is_anonymous" disabled={isPending} />
          Анонимно
        </label>
      </div>

      {!state.success && state.error && (
        <p className="text-xs text-red-500">{state.error}</p>
      )}

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-3 py-1.5 text-sm rounded border border-(--color-border) hover:bg-(--color-border)/30 disabled:opacity-50"
          >
            Отмена
          </button>
        )}
        <button
          type="submit"
          disabled={isPending || selectedSegmentIds.length === 0}
          className="px-3 py-1.5 text-sm rounded bg-(--color-primary) text-white hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Сохранение..." : "Сохранить"}
        </button>
      </div>
    </form>
  );
};
