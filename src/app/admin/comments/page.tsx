import Link from "next/link";
import { getLectures } from "@/features/lectures/api";
import { getComments } from "@/features/comments/api";
import { CommentModeration } from "@/features/admin/comments/comment-moderation";
import { LectureSelector } from "@/features/admin/moderation/lecture-selector";
import type { Comment, Lecture } from "@/api/types";

export const metadata = { title: "Модерация комментариев — Админ" };

interface PageProps {
  searchParams: Promise<{ lecture_id?: string; offset?: string }>;
}

export default async function AdminCommentsPage({ searchParams }: PageProps) {
  const { lecture_id: lectureId, offset: offsetStr } = await searchParams;
  const offset = Number(offsetStr ?? 0) || 0;
  const limit = 20;

  let lectures: Lecture[] = [];
  try {
    const result = await getLectures(0, 100);
    lectures = result.data;
  } catch {
    // покажем пустой список
  }

  let comments: Comment[] = [];
  let total = 0;
  let loadError = false;
  if (lectureId) {
    try {
      const result = await getComments(lectureId, offset, limit);
      comments = result.data;
      total = result.total;
    } catch {
      loadError = true;
    }
  }

  const hasPrev = offset > 0;
  const hasNext = lectureId
    ? total > 0
      ? offset + limit < total
      : comments.length === limit
    : false;

  const buildHref = (nextOffset: number) => {
    const params = new URLSearchParams();
    if (lectureId) params.set("lecture_id", lectureId);
    if (nextOffset > 0) params.set("offset", String(nextOffset));
    const qs = params.toString();
    return qs ? `/admin/comments?${qs}` : "/admin/comments";
  };

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <h1 className="text-2xl font-bold">Модерация комментариев</h1>

      <LectureSelector
        lectures={lectures}
        selectedId={lectureId}
        baseHref="/admin/comments"
        paramName="lecture_id"
      />

      {!lectureId && (
        <p className="text-sm text-(--color-description)">
          Выберите лекцию, чтобы увидеть комментарии.
        </p>
      )}

      {loadError && (
        <p className="text-sm text-red-500" role="alert">
          Не удалось загрузить комментарии.
        </p>
      )}

      {lectureId && !loadError && (
        <>
          {total > 0 && (
            <p className="text-sm text-(--color-description)">
              Показано {comments.length} из {total}
            </p>
          )}
          <CommentModeration comments={comments} lectureId={lectureId} />
          <div className="flex items-center gap-2">
            {hasPrev && (
              <Link
                href={buildHref(Math.max(0, offset - limit))}
                className="px-3 py-1 border border-(--color-border) rounded text-sm"
              >
                ← Назад
              </Link>
            )}
            {hasNext && (
              <Link
                href={buildHref(offset + limit)}
                className="px-3 py-1 border border-(--color-border) rounded text-sm"
              >
                Вперёд →
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
