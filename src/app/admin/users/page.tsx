import Link from "next/link";
import { getUsers } from "@/features/admin/users/api";
import { UserTable } from "@/features/admin/users/user-table";
import type { User } from "@/api/types";

export const metadata = { title: "Пользователи — Админ" };

interface PageProps {
  searchParams: Promise<{ offset?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const { offset: offsetStr } = await searchParams;
  const offset = Number(offsetStr ?? 0) || 0;
  const limit = 20;

  let users: User[] = [];
  let total = 0;
  let loadError = false;
  try {
    const result = await getUsers(offset, limit);
    users = result.data;
    total = result.total;
  } catch {
    loadError = true;
  }

  const hasPrev = offset > 0;
  const hasNext = total > 0 ? offset + limit < total : users.length === limit;
  const buildHref = (next: number) =>
    next > 0 ? `/admin/users?offset=${next}` : "/admin/users";

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <h1 className="text-2xl font-bold">Пользователи</h1>

      {loadError && (
        <p className="text-sm text-red-500" role="alert">
          Не удалось загрузить пользователей.
        </p>
      )}

      {!loadError && (
        <>
          {total > 0 && (
            <p className="text-sm text-(--color-description)">
              Показано {users.length} из {total}
            </p>
          )}
          <UserTable users={users} />
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
