import { getLectures } from "@/features/lectures/api";
import { getComments } from "@/features/comments/api";
import { CommentModeration } from "@/features/admin/comments/comment-moderation";
import { LectureSelector } from "@/features/admin/moderation/lecture-selector";
import type { Comment, Lecture } from "@/api/types";

export const metadata = { title: "Модерация комментариев — Админ" };

interface PageProps {
  searchParams: Promise<{ lecture_id?: string }>;
}

export default async function AdminCommentsPage({ searchParams }: PageProps) {
  const { lecture_id: lectureId } = await searchParams;

  let lectures: Lecture[] = [];
  try {
    const result = await getLectures(0, 100);
    lectures = result.data;
  } catch {
    // покажем пустой список
  }

  let comments: Comment[] = [];
  let loadError = false;
  if (lectureId) {
    try {
      const result = await getComments(lectureId, 0, 100);
      comments = result.data;
    } catch {
      loadError = true;
    }
  }

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
        <CommentModeration comments={comments} lectureId={lectureId} />
      )}
    </div>
  );
}
