import Link from "next/link";
import type { Lecture } from "@/api/types";
import { LectureDeleteButton } from "./lecture-delete-button";

interface LectureTableProps {
  lectures: Lecture[];
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ru-RU");
  } catch {
    return iso;
  }
}

export const LectureTable: React.FC<LectureTableProps> = ({ lectures }) => {
  if (lectures.length === 0) {
    return (
      <p className="text-sm text-(--color-description)">Лекций пока нет.</p>
    );
  }

  return (
    <div className="border border-(--color-border) rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-(--color-text-pane) text-left">
          <tr>
            <th className="px-3 py-2 font-semibold">Название</th>
            <th className="px-3 py-2 font-semibold w-32">Дата</th>
            <th className="px-3 py-2 font-semibold w-40 text-right">
              Действия
            </th>
          </tr>
        </thead>
        <tbody>
          {lectures.map((lecture) => (
            <tr
              key={lecture.id}
              className="border-t border-(--color-border) align-middle"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/admin/lectures/${lecture.id}`}
                  className="text-(--color-link) hover:underline"
                >
                  {lecture.title}
                </Link>
              </td>
              <td className="px-3 py-2 text-(--color-description)">
                {formatDate(lecture.date)}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/admin/lectures/${lecture.id}`}
                    className="px-2 py-1 text-xs border border-(--color-border) rounded"
                  >
                    Редактировать
                  </Link>
                  <LectureDeleteButton
                    lectureId={lecture.id}
                    lectureTitle={lecture.title}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
