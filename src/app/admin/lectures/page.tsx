// src/app/admin/lectures/page.tsx
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
import {
  canCreateLecture,
  canDeleteLecture,
  canUpdateLecture,
  getLectures,
  LectureAdminRow,
} from "@/features/lectures";
import { getMe } from "@/utils/me";
import { parsePaging } from "@/utils/paging";

export const metadata = { title: "Админ — лекции" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminLecturesPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canCreateLecture(me) && !canDeleteLecture(me)) forbidden();

  const sp = await searchParams;
  const { offset, limit } = parsePaging({ offset: sp.offset, limit: sp.limit }, { limit: 20 });

  const { items, total } = await getLectures({ offset, limit });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Лекции</h1>
        {canCreateLecture(me) && (
          <RouterLink href="/admin/lectures/new">
            <Button>Создать</Button>
          </RouterLink>
        )}
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="Лекций пока нет"
          description="Создайте первую."
          action={
            canCreateLecture(me) ? (
              <RouterLink href="/admin/lectures/new">
                <Button>Создать</Button>
              </RouterLink>
            ) : undefined
          }
        />
      ) : (
        <>
          <Table>
            <Thead>
              <Tr>
                <Th>Название</Th>
                <Th>Дата</Th>
                <Th>Видимость</Th>
                <Th>Действия</Th>
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
            <Pagination basePath="/admin/lectures" offset={offset} limit={limit} total={total} />
          )}
        </>
      )}
    </div>
  );
}
