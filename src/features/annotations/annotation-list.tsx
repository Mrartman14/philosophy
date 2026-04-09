import type { Annotation } from "@/api/types";
import { getMe } from "@/utils/me";
import {
  canDeleteAnnotation,
  canEditAnnotation,
} from "./permissions";
import { AnnotationItemActions } from "./annotation-highlight";

interface AnnotationListProps {
  annotations: Annotation[];
  lectureId: string;
  /**
   * Optional single-segment filter. Currently unused at the server level —
   * `AnnotationHighlight` toggles the `hidden` attribute on list items client
   * side via the `data-segment-ids` attribute (see P0-#3 in the
   * platform-bugfix plan). Kept here so the prop can be wired through once
   * `annotation-highlight.tsx` is refactored to render the list inline.
   */
  filterSegmentId?: number;
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function getAuthorName(a: Annotation): string {
  if (a.is_anonymous) return "Аноним";
  return a.author?.username ?? "Аноним";
}

function getStatusLabel(status: Annotation["status"]): string | null {
  switch (status) {
    case "pending":
      return "На модерации";
    case "hidden":
      return "Скрыто";
    case "published":
      return null;
    default:
      return null;
  }
}

export async function AnnotationList({
  annotations,
  lectureId,
  filterSegmentId,
}: AnnotationListProps) {
  const me = await getMe();

  const visibleAnnotations =
    filterSegmentId == null
      ? annotations
      : annotations.filter((a) =>
          (a.segment_ids ?? []).includes(filterSegmentId)
        );

  if (visibleAnnotations.length === 0) {
    return (
      <p className="text-sm text-(--color-description) p-4">
        Аннотаций пока нет.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3 p-4">
      {visibleAnnotations.map((a) => {
        const segments = a.segment_ids ?? [];
        const canEdit = canEditAnnotation(me, a);
        const canDelete = canDeleteAnnotation(me, a);
        const statusLabel = getStatusLabel(a.status);

        return (
          <li
            key={a.id}
            data-annotation-id={a.id}
            data-lecture-id={lectureId}
            data-segment-ids={segments.join(",")}
            className="border border-(--color-border) rounded-lg p-3 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">{getAuthorName(a)}</span>
              <time className="text-xs text-(--color-description)">
                {formatDate(a.created_at)}
              </time>
            </div>
            <p className="text-sm whitespace-pre-wrap break-words">{a.body}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-(--color-description)">
              {statusLabel && (
                <span className="px-1.5 py-0.5 rounded border border-(--color-border)">
                  {statusLabel}
                </span>
              )}
              {a.is_private && <span>Приватная</span>}
              {a.is_edited && <span>изменено</span>}
              {segments.length > 0 && (
                <span>
                  Сегменты: {segments.map((s) => `#${s + 1}`).join(", ")}
                </span>
              )}
              {(a.comment_count ?? 0) > 0 && (
                <span>Комментариев: {a.comment_count}</span>
              )}
            </div>
            {(canEdit || canDelete) && (
              <div
                className="flex gap-2"
                data-can-edit={canEdit ? "" : undefined}
                data-can-delete={canDelete ? "" : undefined}
              >
                <AnnotationItemActions
                  annotationId={a.id}
                  lectureId={lectureId}
                  initialBody={a.body}
                  initialSegmentIds={segments}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
