// src/app/admin/users/page.tsx
import { forbidden } from "next/navigation";

import { Pagination } from "@/components/ui";
import {
  canListUsers,
  canModerateUsers,
  getUsers,
  UsersTable,
} from "@/features/users";
import { getMe } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

const PAGE_SIZE = 50;

export default async function AdminUsersPage({ searchParams }: Props) {
  const me = await getMe();
  if (!me || !canListUsers(me)) forbidden();

  const canModerate = canModerateUsers(me);

  const { offset } = await searchParams;
  const safeOffset = parseNonNegativeInt(offset, 0);

  const result = await getUsers({ offset: safeOffset, limit: PAGE_SIZE });

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Пользователи</h1>
        <p className="text-sm text-(--color-fg-muted)">
          Всего: {result.total}
        </p>
      </header>

      <UsersTable
        users={result.items}
        canModerate={canModerate}
        meId={me.id}
      />

      {result.total > result.limit && (
        <Pagination
          basePath="/admin/users"
          offset={result.offset}
          limit={result.limit}
          total={result.total}
        />
      )}
    </section>
  );
}

export const metadata = { title: "Пользователи — админ" };
