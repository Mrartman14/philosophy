// src/app/me/forms/page.tsx
import { Pagination, RouterLink } from "@/components/ui";
import { getPaginationLabels } from "@/components/ui/pagination.server";
import { getMyForms, canCreateForm, MyFormsList } from "@/features/forms";
import { getT } from "@/i18n";
import { requireActiveUserOrRedirect } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("myFormsTitle") };
}

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function MyFormsPage({ searchParams }: Props) {
  const me = await requireActiveUserOrRedirect("/me/forms");

  // Бек заменил непагинированный /api/me/forms единым /api/forms?scope=mine —
  // листинг теперь пагинирован, поэтому страница обрабатывает offset/limit
  // (как /admin/forms).
  const { offset } = await searchParams;
  const result = await getMyForms({ offset: parseNonNegativeInt(offset, 0), limit: 20 });
  const canCreate = canCreateForm(me);
  const t = await getT("pages");
  const paginationLabels = await getPaginationLabels();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("myFormsHeading")}</h1>
        {canCreate && (
          <RouterLink
            href="/forms/new"
            className="inline-flex shrink-0 items-center rounded bg-(--color-fg) px-4 py-2 text-sm font-medium text-(--color-surface) hover:opacity-90"
          >
            {t("myFormsCreate")}
          </RouterLink>
        )}
      </header>

      <MyFormsList forms={result.items} />

      <Pagination
        basePath="/me/forms"
        offset={result.offset}
        limit={result.limit}
        total={result.total}
        labels={paginationLabels}
      />
    </div>
  );
}
