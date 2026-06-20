// src/app/admin/lectures/page.tsx
import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import {
  Button,
  EmptyState,
  Pagination,
  RouterLink,
  Table,
  Tbody,
  Th,
  Thead,
  Tr,
} from "@/components/ui";
import { getPaginationLabels } from "@/components/ui/pagination.server";
import {
  canCreateLecture,
  canDeleteLecture,
  canUpdateLecture,
  getLectures,
  LectureAdminRow,
} from "@/features/lectures";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";
import { parsePaging } from "@/utils/paging";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("lecturesMetaTitle") };
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminLecturesPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canCreateLecture(me) && !canDeleteLecture(me)) forbidden();

  const sp = await searchParams;
  const { offset, limit } = parsePaging({ offset: sp.offset, limit: sp.limit }, { limit: 20 });

  const { items, total } = await getLectures({ offset, limit });

  const t = await getT("admin");

  const paginationLabels = await getPaginationLabels();
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("lecturesTitle")}</h1>
        {canCreateLecture(me) && (
          <RouterLink href="/admin/lectures/new">
            <Button>{t("lecturesCreate")}</Button>
          </RouterLink>
        )}
      </header>

      {items.length === 0 ? (
        <EmptyState
          title={t("lecturesEmptyTitle")}
          description={t("lecturesEmptyDescription")}
          action={
            canCreateLecture(me) ? (
              <RouterLink href="/admin/lectures/new">
                <Button>{t("lecturesCreate")}</Button>
              </RouterLink>
            ) : undefined
          }
        />
      ) : (
        <>
          <Table>
            <Thead>
              <Tr>
                <Th>{t("lecturesColTitle")}</Th>
                <Th>{t("lecturesColDate")}</Th>
                <Th>{t("lecturesColVisibility")}</Th>
                <Th>{t("lecturesColActions")}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {items.map((lecture) => (
                <LectureAdminRow
                  key={lecture.id}
                  lecture={lecture}
                  canEdit={canUpdateLecture(me, lecture)}
                  canDelete={canDeleteLecture(me)}
                />
              ))}
            </Tbody>
          </Table>
          {total > limit && (
            <Pagination basePath="/admin/lectures" offset={offset} limit={limit} total={total} labels={paginationLabels} />
          )}
        </>
      )}
    </div>
  );
}
