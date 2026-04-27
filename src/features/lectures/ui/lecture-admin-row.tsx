// src/features/lectures/ui/lecture-admin-row.tsx
import Link from "next/link";
import { Td, Tr } from "@/components/ui";
import type { Lecture } from "../types";
import { LectureDeleteButton } from "./lecture-delete-button";

interface Props {
  lecture: Lecture;
  canEdit: boolean;
  canDelete: boolean;
}

export function LectureAdminRow({ lecture, canEdit, canDelete }: Props) {
  return (
    <Tr>
      <Td className="font-medium">{lecture.title}</Td>
      <Td className="text-(--color-description)">{lecture.date}</Td>
      <Td>{lecture.visibility === "public" ? "Публичная" : "Приватная"}</Td>
      <Td>
        <div className="flex gap-2">
          {canEdit && (
            <Link
              href={`/admin/lectures/${lecture.id}/edit`}
              className="text-sm underline hover:no-underline"
            >
              Редактировать
            </Link>
          )}
          {canDelete && <LectureDeleteButton lectureId={lecture.id} />}
        </div>
      </Td>
    </Tr>
  );
}
