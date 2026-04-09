"use client";

import { useState, useTransition } from "react";
import type { Annotation } from "@/api/types";
import {
  deleteAnnotationAdmin,
  updateAnnotationStatus,
} from "@/features/admin/actions";

interface AnnotationModerationProps {
  annotations: Annotation[];
  lectureId: string;
}

type ModerationStatus = "published" | "hidden" | "pending";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU");
  } catch {
    return iso;
  }
}

export const AnnotationModeration: React.FC<AnnotationModerationProps> = ({
  annotations,
  lectureId,
}) => {
  if (annotations.length === 0) {
    return (
      <p className="text-sm text-(--color-description)">Аннотаций нет.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {annotations.map((annotation) => (
        <li key={annotation.id}>
          <AnnotationModerationItem
            annotation={annotation}
            lectureId={lectureId}
          />
        </li>
      ))}
    </ul>
  );
};

interface ItemProps {
  annotation: Annotation;
  lectureId: string;
}

const AnnotationModerationItem: React.FC<ItemProps> = ({
  annotation,
  lectureId,
}) => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);

  const handleStatus = (status: ModerationStatus) => {
    setError(null);
    startTransition(async () => {
      const result = await updateAnnotationStatus({
        annotationId: annotation.id,
        status,
        lectureId,
      });
      if (!result.success) setError(result.error);
    });
  };

  const handleDelete = () => {
    if (!confirm("Удалить аннотацию?")) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAnnotationAdmin({
        annotationId: annotation.id,
        lectureId,
      });
      if (result.success) setDeleted(true);
      else setError(result.error);
    });
  };

  if (deleted) {
    return (
      <article className="p-3 border border-(--color-border) rounded opacity-50">
        <p className="text-xs text-(--color-description)">Удалено</p>
      </article>
    );
  }

  const authorLabel = annotation.is_anonymous
    ? "Аноним"
    : annotation.author?.username ?? "Аноним";

  return (
    <article className="p-3 border border-(--color-border) rounded flex flex-col gap-2">
      <header className="flex items-baseline gap-2 text-xs">
        <span className="font-semibold text-sm">{authorLabel}</span>
        <time className="text-(--color-description)">
          {formatDate(annotation.created_at)}
        </time>
        {annotation.is_private && (
          <span className="text-(--color-description)">(приватная)</span>
        )}
      </header>
      <p className="text-sm whitespace-pre-wrap break-words">
        {annotation.body}
      </p>
      {annotation.segment_ids && annotation.segment_ids.length > 0 && (
        <p className="text-xs text-(--color-description)">
          Сегменты: {annotation.segment_ids.join(", ")}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleStatus("published")}
          disabled={pending}
          className="px-2 py-1 text-xs border border-(--color-border) rounded disabled:opacity-50"
        >
          Опубликовать
        </button>
        <button
          type="button"
          onClick={() => handleStatus("hidden")}
          disabled={pending}
          className="px-2 py-1 text-xs border border-(--color-border) rounded disabled:opacity-50"
        >
          Скрыть
        </button>
        <button
          type="button"
          onClick={() => handleStatus("pending")}
          disabled={pending}
          className="px-2 py-1 text-xs border border-(--color-border) rounded disabled:opacity-50"
        >
          Pending
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="px-2 py-1 text-xs border border-red-500 text-red-500 rounded disabled:opacity-50"
        >
          Удалить
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </article>
  );
};
