// src/app/trails/page.tsx
import { Pagination } from "@/components/ui";
import { getTrails, TrailPublicList } from "@/features/trails";
import { getT } from "@/i18n";
import { parseNonNegativeInt } from "@/utils/paging";

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("trailsTitle") };
}

interface Props {
  searchParams: Promise<{ offset?: string }>;
}

export default async function TrailsPage({ searchParams }: Props) {
  const { offset } = await searchParams;
  const result = await getTrails({ offset: parseNonNegativeInt(offset, 0), limit: 20 });
  const t = await getT("pages");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-2xl font-bold">{t("trailsHeading")}</h1>
        <p className="text-sm text-(--color-fg-muted)">
          {t("trailsSubtitle", { total: result.total })}
        </p>
      </header>

      <TrailPublicList trails={result.items} />

      <Pagination
        basePath="/trails"
        offset={result.offset}
        limit={result.limit}
        total={result.total}
      />
    </div>
  );
}
