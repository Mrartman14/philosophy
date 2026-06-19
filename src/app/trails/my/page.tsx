// src/app/trails/my/page.tsx
import {
  canCreateTrail,
  getMyTrails,
  TrailCreateForm,
  TrailMyList,
} from "@/features/trails";
import { getT } from "@/i18n";
import { requireActiveUserOrRedirect } from "@/utils/me";
import { parseNonNegativeInt } from "@/utils/paging";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("myTrailsTitle") };
}

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function MyTrailsPage({ searchParams }: Props) {
  // Маршруты «мои» — приватная зона: гостя на логин.
  const me = await requireActiveUserOrRedirect("/trails/my");

  const { offset } = await searchParams;
  const result = await getMyTrails({ offset: parseNonNegativeInt(offset, 0), limit: 20 });
  const canCreate = canCreateTrail(me);
  const t = await getT("pages");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-2xl font-bold">{t("myTrailsHeading")}</h1>
        <p className="text-sm text-(--color-fg-muted)">{t("myTrailsTotal", { total: result.total })}</p>
      </header>

      {canCreate && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">{t("myTrailsCreate")}</summary>
          <div className="mt-3">
            <TrailCreateForm />
          </div>
        </details>
      )}

      <TrailMyList trails={result.items} />
    </div>
  );
}
