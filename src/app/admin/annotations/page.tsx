import { getLectures } from "@/features/lectures/api";
import { getAnnotations } from "@/features/annotations/api";
import { AnnotationModeration } from "@/features/admin/annotations/annotation-moderation";
import { LectureSelector } from "@/features/admin/moderation/lecture-selector";
import type { Annotation, Lecture } from "@/api/types";

export const metadata = { title: "Модерация аннотаций — Админ" };

interface PageProps {
  searchParams: Promise<{ lecture_id?: string }>;
}

export default async function AdminAnnotationsPage({ searchParams }: PageProps) {
  const { lecture_id: lectureId } = await searchParams;

  let lectures: Lecture[] = [];
  try {
    const result = await getLectures(0, 100);
    lectures = result.data;
  } catch {
    // empty list
  }

  let annotations: Annotation[] = [];
  let loadError = false;
  if (lectureId) {
    try {
      const result = await getAnnotations(lectureId, 0, 100);
      annotations = result.data;
    } catch {
      loadError = true;
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <h1 className="text-2xl font-bold">Модерация аннотаций</h1>

      <LectureSelector
        lectures={lectures}
        selectedId={lectureId}
        baseHref="/admin/annotations"
        paramName="lecture_id"
      />

      {!lectureId && (
        <p className="text-sm text-(--color-description)">
          Выберите лекцию, чтобы увидеть аннотации.
        </p>
      )}

      {loadError && (
        <p className="text-sm text-red-500" role="alert">
          Не удалось загрузить аннотации.
        </p>
      )}

      {lectureId && !loadError && (
        <AnnotationModeration
          annotations={annotations}
          lectureId={lectureId}
        />
      )}
    </div>
  );
}
