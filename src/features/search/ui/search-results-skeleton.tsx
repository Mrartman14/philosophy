// src/features/search/ui/search-results-skeleton.tsx
import { Skeleton } from "@/components/ui";
import { getT } from "@/i18n";

/**
 * Placeholder shown inside the Suspense boundary while search results load.
 * Mimics the visual structure of SearchResults: a count line + a few HitCards.
 */
export async function SearchResultsSkeleton() {
  const t = await getT("search");
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label={t("loadingAriaLabel")}>
      {/* Mimics "Найдено: N" label */}
      <Skeleton className="h-4 w-24" />

      <ul className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i}>
            <article className="rounded-lg border border-(--color-border) bg-(--color-surface) p-4">
              {/* Badge + title row */}
              <div className="flex flex-wrap items-baseline gap-2">
                <Skeleton className="h-5 w-14 rounded" />
                <Skeleton className="h-5 w-48 rounded" />
              </div>
              {/* Snippet lines */}
              <div className="mt-2 flex flex-col gap-1">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-5/6 rounded" />
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
