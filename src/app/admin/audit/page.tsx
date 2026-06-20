// src/app/admin/audit/page.tsx
import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { Pagination } from "@/components/ui";
import { getPaginationLabels } from "@/components/ui/pagination.server";
import {
  AuditFilterForm,
  makeAuditLogFilterSchema,
  AuditTable,
  canReadAudit,
  getAuditLog,
} from "@/features/audit";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("auditMetaTitle") };
}

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

  const [t, raw] = await Promise.all([getT("audit"), searchParams]);
  // parse не бросает: каждое поле схемы обёрнуто в .catch(undefined),
  // битые параметры молча отбрасываются.
  const filter = makeAuditLogFilterSchema(await getT("validation")).parse(raw);

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

  const paginationLabels = await getPaginationLabels();
  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
        <p className="text-sm text-(--color-fg-muted)">
          {t("pageDescription", { total: result.total })}
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
        labels={paginationLabels}
      />
    </section>
  );
}

