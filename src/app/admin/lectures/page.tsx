// src/app/admin/lectures/page.tsx
import Link from "next/link";
import { forbidden } from "next/navigation";
import { getMe } from "@/utils/me";
import {
  Button,
  EmptyState,
  Pagination,
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

export const metadata = { title: "Админ — лекции" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function pickInt(v: string | string[] | undefined): number | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s) return undefined;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export default async function AdminLecturesPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canCreateLecture(me) && !canDeleteLecture(me)) forbidden();

  const sp = await searchParams;
  const offset = pickInt(sp.offset) ?? 0;
  const limit = pickInt(sp.limit) ?? 20;

  const { items, total } = await getLectures({ offset, limit });

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Лекции</h1>
        {canCreateLecture(me) && (
          <Link href="/admin/lectures/new">
            <Button>Создать</Button>
          </Link>
        )}
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="Лекций пока нет"
          description="Создайте первую."
          action={
            canCreateLecture(me) ? (
              <Link href="/admin/lectures/new">
                <Button>Создать</Button>
              </Link>
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
