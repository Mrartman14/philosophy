// src/features/search/ui/search-results.tsx
import { EmptyState, RouterLink } from "@/components/ui";
import { getT } from "@/i18n";

import { hitHref } from "../hit-href";
import type { SearchHit, SearchType } from "../types";

interface HitCardProps {
  hit: SearchHit;
  typeLabel: Record<SearchType, string>;
  untitled: string;
}

function HitCard({ hit, typeLabel, untitled }: HitCardProps) {
  const href = hitHref(hit);
  // Нет ссылки (нет entity_id или неизвестный тип) — нечего открыть, пропускаем.
  if (!href) return null;

  const rawTitle = hit.title?.trim();
  // trim() может дать "" — намеренно падаем на untitled, а не на nullish.
  const title = rawTitle !== undefined && rawTitle !== "" ? rawTitle : untitled;
  const label = hit.type ? typeLabel[hit.type] : "—";
  const snippet = hit.snippet?.trim();

  return (
    <article className="rounded-lg border border-(--color-border) bg-(--color-surface) p-4">
      <header className="flex flex-wrap items-baseline gap-2">
        <span className="rounded bg-(--color-surface-subtle) px-2 py-0.5 text-xs text-(--color-fg-muted)">
          {label}
        </span>
        <RouterLink href={href} className="text-lg font-semibold hover:underline">
          {title}
        </RouterLink>
      </header>
      {snippet && (
        <p className="mt-2 rounded px-2 py-1 text-sm text-(--color-fg-muted)">
          {snippet}
        </p>
      )}
    </article>
  );
}

interface Props {
  hits: SearchHit[];
}

export async function SearchResults({ hits }: Props) {
  const t = await getT("search");

  const typeLabel: Record<SearchType, string> = {
    document: t("typeDocument"),
    glossary: t("typeGlossary"),
  };

  if (hits.length === 0) {
    return (
      <EmptyState
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-(--color-fg-muted)">
        {t("foundCount", { count: hits.length })}
      </p>
      <ul className="flex flex-col gap-3">
        {hits.map((hit, i) => (
          <li key={hitHref(hit) ?? i}>
            <HitCard hit={hit} typeLabel={typeLabel} untitled={t("untitled")} />
          </li>
        ))}
      </ul>
    </div>
  );
}
