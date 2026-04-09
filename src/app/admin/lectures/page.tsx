import Link from "next/link";
import { getLectures } from "@/features/lectures/api";
import { LectureTable } from "@/features/admin/lectures/lecture-table";
import { LectureCreateForm } from "@/features/admin/lectures/lecture-create-form";

export const metadata = { title: "Лекции — Админ" };

interface PageProps {
  searchParams: Promise<{ offset?: string }>;
}

export default async function AdminLecturesPage({ searchParams }: PageProps) {
  const { offset: offsetStr } = await searchParams;
  const offset = Number(offsetStr ?? 0) || 0;
  const limit = 20;

  let lectures: Awaited<ReturnType<typeof getLectures>> = {
    data: [],
    offset,
    limit,
    total: 0,
  };
  let loadError = false;
  try {
    lectures = await getLectures(offset, limit);
  } catch {
    loadError = true;
  }

  const hasPrev = offset > 0;
  const hasNext = offset + limit < lectures.total;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Лекции</h1>
        <span className="text-sm text-(--color-description)">
          Всего: {lectures.total}
        </span>
      </div>

      <LectureCreateForm />

      {loadError && (
        <p className="text-sm text-red-500" role="alert">
          Не удалось загрузить список лекций.
        </p>
      )}

      <LectureTable lectures={lectures.data} />

      <div className="flex items-center gap-2">
        {hasPrev && (
          <Link
            href={`/admin/lectures?offset=${Math.max(0, offset - limit)}`}
            className="px-3 py-1 border border-(--color-border) rounded text-sm"
          >
            ← Назад
          </Link>
        )}
        {hasNext && (
          <Link
            href={`/admin/lectures?offset=${offset + limit}`}
            className="px-3 py-1 border border-(--color-border) rounded text-sm"
          >
            Вперёд →
          </Link>
        )}
      </div>
    </div>
  );
}
