// src/app/search/page.tsx
import { Suspense } from "react";

import { RouterLink } from "@/components/ui";
import {
  getSearchResults,
  makeSearchParamsSchema,
  SearchInput,
  SearchResults,
  SearchResultsSkeleton,
} from "@/features/search";
import { getT } from "@/i18n";

const PAGE_LIMIT = 20;

interface Props {
  searchParams: Promise<{
    q?: string;
  }>;
}

export async function generateMetadata() {
  const t = await getT("pages");
  return { title: t("searchTitle") };
}

export default async function SearchPage({ searchParams }: Props) {
  const raw = await searchParams;
  const tValidation = await getT("validation");
  const t = await getT("pages");
  // parse не бросает: поле обёрнуто в .catch(undefined),
  // битые параметры молча отбрасываются.
  const params = makeSearchParamsSchema(tValidation).parse(raw);

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">{t("searchHeading")}</h1>
        <p className="text-sm text-(--color-fg-muted)">
          {t("searchSubtitle")}
        </p>
      </header>

      <SearchInput variant="page" />

      {params.q ? (
        <Suspense key={params.q} fallback={<SearchResultsSkeleton />}>
          <SearchBody q={params.q} />
        </Suspense>
      ) : (
        <p className="text-sm text-(--color-fg-muted)">
          {t("searchPlaceholder")}
        </p>
      )}
    </section>
  );
}

async function SearchBody({ q }: { q: string }) {
  const t = await getT("pages");
  let result;
  try {
    result = await getSearchResults({ q, limit: PAGE_LIMIT });
  } catch {
    return (
      <p className="text-sm text-(--color-fg-muted)">
        {t("searchUnavailable")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchResults hits={result.items} />
      {result.items.length > 0 && (
        <RouterLink href={`/map?q=${encodeURIComponent(q)}`} className="text-sm text-(--color-accent) hover:underline">
          {t("mapLink")}
        </RouterLink>
      )}
    </div>
  );
}
