// src/features/lectures/ui/lecture-admin-row.tsx
import { RouterLink, Td, Tr } from "@/components/ui";
import { getT } from "@/i18n";

import type { Lecture } from "../types";

import { LectureDeleteButton } from "./lecture-delete-button";

interface Props {
  lecture: Lecture;
  canEdit: boolean;
  canDelete: boolean;
}

export async function LectureAdminRow({ lecture, canEdit, canDelete }: Props) {
  const tL = await getT("lectures");

  return (
    <Tr>
      <Td className="font-medium">
        {canEdit ? (
          <RouterLink
            href={`/lectures/${lecture.id}`}
            className="hover:underline"
          >
            {lecture.title}
          </RouterLink>
        ) : (
          lecture.title
        )}
      </Td>
      <Td className="text-(--color-fg-muted)">{lecture.date}</Td>
      <Td>{lecture.visibility === "public" ? tL("visibilityPublic") : tL("visibilityPrivate")}</Td>
      <Td>
        <div className="flex gap-2">
          {canEdit && (
            <RouterLink
              href={`/admin/lectures/${lecture.id}/edit`}
              className="text-sm underline hover:no-underline"
            >
              {tL("editLink")}
            </RouterLink>
          )}
          {canDelete && <LectureDeleteButton lectureId={lecture.id} />}
        </div>
      </Td>
    </Tr>
  );
}
