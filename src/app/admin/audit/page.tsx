// src/app/admin/audit/page.tsx
import { forbidden } from "next/navigation";

import { Pagination } from "@/components/ui";
import {
  AuditFilterForm,
  AuditLogFilterSchema,
  AuditTable,
  canReadAudit,
  getAuditLog,
} from "@/features/audit";
import { getMe } from "@/utils/me";

const PAGE_LIMIT = 50;

interface Props {
  searchParams: Promise<{
    actor?: string;
    target_type?: string;
    target_id?: string;
    action?: string;
    from?: string;
    to?: string;
    offset?: string;
  }>;
}

export default async function AdminAuditPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canReadAudit(me)) forbidden();

  const raw = await searchParams;
  // parse не бросает: каждое поле схемы обёрнуто в .catch(undefined),
  // битые параметры молча отбрасываются.
  const filter = AuditLogFilterSchema.parse(raw);

  const result = await getAuditLog({
    ...(filter.actor ? { actor: filter.actor } : {}),
    ...(filter.target_type ? { target_type: filter.target_type } : {}),
    ...(filter.target_id ? { target_id: filter.target_id } : {}),
    ...(filter.action ? { action: filter.action } : {}),
    ...(filter.from ? { from: filter.from } : {}),
    ...(filter.to ? { to: filter.to } : {}),
    offset: filter.offset ?? 0,
    limit: PAGE_LIMIT,
  });

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">Аудит</h1>
        <p className="text-sm text-(--color-description)">
          Журнал админ-действий. Всего записей: {result.total}
        </p>
      </header>

      <AuditFilterForm />

      <AuditTable records={result.items} />

      <Pagination
        basePath="/admin/audit"
        offset={result.offset}
        limit={result.limit}
        total={result.total}
        searchParams={raw}
      />
    </section>
  );
}

export const metadata = { title: "Аудит — админ" };
