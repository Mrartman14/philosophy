// src/app/admin/users/page.tsx
import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { Pagination } from "@/components/ui";
import { getPaginationLabels } from "@/components/ui/pagination.server";
import {
  canListUsers,
  canModerateUsers,
  getUsers,
  UsersTable,
} from "@/features/users";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("usersMetaTitle") };
}

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

  const t = await getT("admin");

  const paginationLabels = await getPaginationLabels();
  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{t("usersTitle")}</h1>
        <p className="text-sm text-(--color-fg-muted)">
          {t("usersTotal", { total: result.total })}
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
          labels={paginationLabels}
        />
      )}
    </section>
  );
}

