import type { Annotation } from "@/api/types";
import { getUser } from "@/utils/get-user";

interface AnnotationListProps {
  annotations: Annotation[];
  lectureId: string;
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

export async function AnnotationList({
  annotations,
  lectureId,
}: AnnotationListProps) {
  const user = await getUser();
  const canModerate =
    user?.role === "moderator" || user?.role === "admin";

  if (annotations.length === 0) {
    return (
      <p className="text-sm text-(--color-description) p-4">
        Аннотаций пока нет.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3 p-4">
      {annotations.map((a) => {
        const segments = a.segment_ids ?? [];
        const canEdit = canModerate || (user != null && !a.is_anonymous);
        const canDelete = canEdit;

        return (
          <li
            key={a.id}
            data-annotation-id={a.id}
            data-lecture-id={lectureId}
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
              {a.is_private && <span>Приватная</span>}
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
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
