// src/app/me/documents/page.tsx
import { RouterLink } from "@/components/ui";
import {
  canCreateDocument,
  getMyDocuments,
  DocumentMyList,
} from "@/features/documents";
import { getT } from "@/i18n";
import { requireActiveUserOrRedirect } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("myDocumentsTitle") };
}

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function MyDocumentsPage({ searchParams }: Props) {
  // Документы — приватная зона: гостя отправляем на логин.
  const me = await requireActiveUserOrRedirect("/me/documents");

  const { offset } = await searchParams;
  const result = await getMyDocuments({ offset: parseNonNegativeInt(offset, 0), limit: 20 });
  const canCreate = canCreateDocument(me);
  const t = await getT("pages");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("myDocumentsHeading")}</h1>
          <p className="text-sm text-(--color-fg-muted)">{t("myDocumentsTotal", { total: result.total })}</p>
        </div>
        {canCreate && (
          <RouterLink
            href="/documents/new"
            className="inline-flex shrink-0 items-center rounded bg-(--color-fg) px-4 py-2 text-sm font-medium text-(--color-surface) hover:opacity-90"
          >
            {t("myDocumentsCreate")}
          </RouterLink>
        )}
      </header>

      <DocumentMyList documents={result.items} />
    </div>
  );
}
