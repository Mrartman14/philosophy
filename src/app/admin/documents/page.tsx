// src/app/admin/documents/page.tsx
import type { Metadata } from "next";
import { forbidden } from "next/navigation";

import { Pagination } from "@/components/ui";
import { getPaginationLabels } from "@/components/ui/pagination.server";
import {
  canListAdminDocuments,
  canAdminDeleteDocument,
  getAdminDocuments,
  DocumentAdminRow,
} from "@/features/documents";
import { getT } from "@/i18n";
import { getMe } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("admin");
  return { title: t("documentsMetaTitle") };
}

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function AdminDocumentsPage({ searchParams }: Props) {
  const me = await getMe();
  if (!canListAdminDocuments(me)) forbidden();

  const { offset } = await searchParams;
  const result = await getAdminDocuments({ offset: parseNonNegativeInt(offset, 0), limit: 20 });

  const t = await getT("admin");

  const paginationLabels = await getPaginationLabels();
  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">{t("documentsTitle")}</h1>
        <p className="text-sm text-(--color-fg-muted)">
          {t("documentsTotal", { total: result.total })}
        </p>
      </header>

      <ul className="flex flex-col divide-y divide-(--color-border)">
        {result.items.map((doc) => (
          <DocumentAdminRow
            key={doc.id}
            document={doc}
            canDelete={canAdminDeleteDocument(me, doc)}
          />
        ))}
      </ul>

      <Pagination
        basePath="/admin/documents"
        offset={result.offset}
        limit={result.limit}
        total={result.total}
        labels={paginationLabels}
      />
    </section>
  );
}
