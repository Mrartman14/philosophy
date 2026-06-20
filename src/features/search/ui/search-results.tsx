// src/features/search/ui/search-results.tsx
import { EmptyState, RouterLink } from "@/components/ui";
import { getT, getServerFmt } from "@/i18n";

import type { SearchHit, SearchMatch } from "../types";

/** Первые до 3 непустых сниппетов хита (бек уже усекает текст). */
function topSnippets(matches: SearchMatch[] | undefined): string[] {
  if (!matches) return [];
  const out: string[] = [];
  for (const m of matches) {
    const s = m.snippet?.trim();
    if (s) out.push(s);
    if (out.length >= 3) break;
  }
  return out;
}

function hitHref(hit: SearchHit): string | null {
  if (hit.type === "lecture" && hit.lecture?.lecture_id) {
    return `/lectures/${hit.lecture.lecture_id}`;
  }
  if (hit.type === "glossary" && hit.glossary_term?.id) {
    return `/glossary/${hit.glossary_term.id}`;
  }
  return null;
}

interface HitCardProps {
  hit: SearchHit;
  typeLabel: Record<string, string>;
  untitled: string;
  hitFallbackTitle: string;
  formatDate: (iso?: string) => string | null;
}

function HitCard({ hit, typeLabel, untitled, hitFallbackTitle, formatDate }: HitCardProps) {
  const href = hitHref(hit);
  // Неизвестный тип или хит без id — нечего открыть, пропускаем (defensive,
  // как .md-handler бека: unknown hit types skipped).
  if (!href) return null;

  const rawTitle =
    hit.type === "lecture"
      ? hit.lecture?.title?.trim()
      : hit.type === "glossary"
        ? hit.glossary_term?.title?.trim()
        : undefined;
  // trim() может дать "" — намеренно падаем на untitled, а не на nullish
  const title = rawTitle !== undefined && rawTitle !== "" ? rawTitle
    : hit.type === "lecture" || hit.type === "glossary" ? untitled
    : hitFallbackTitle;

  const label = hit.type ? (typeLabel[hit.type] ?? hit.type) : "—";
  const date = hit.type === "lecture" ? formatDate(hit.lecture?.date) : null;
  const snippets = topSnippets(hit.matches);

  return (
    <article className="rounded-lg border border-(--color-border) bg-(--color-surface) p-4">
      <header className="flex flex-wrap items-baseline gap-2">
        <span className="rounded bg-(--color-surface-subtle) px-2 py-0.5 text-xs text-(--color-fg-muted)">
          {label}
        </span>
        <RouterLink href={href} className="text-lg font-semibold hover:underline">
          {title}
        </RouterLink>
        {date && (
          <time className="text-xs text-(--color-fg-muted)">{date}</time>
        )}
      </header>
      {snippets.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {snippets.map((s, i) => (
            <li
              key={i}
              className="rounded px-2 py-1 text-sm hover:bg-(--color-surface-subtle)"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

interface Props {
  hits: SearchHit[];
  total: number;
}

export async function SearchResults({ hits, total }: Props) {
  const t = await getT("search");
  const fmt = await getServerFmt();

  const typeLabel: Record<string, string> = {
    lecture: t("typeLecture"),
    glossary: t("typeGlossary"),
  };

  function formatDate(iso?: string): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return fmt.dateTime(d, { dateStyle: "long" });
  }

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
      <p className="text-xs text-(--color-fg-muted)">{t("foundCount", { count: total })}</p>
      <ul className="flex flex-col gap-3">
        {hits.map((hit, i) => (
          <li key={hitHref(hit) ?? i}>
            <HitCard
              hit={hit}
              typeLabel={typeLabel}
              untitled={t("untitled")}
              hitFallbackTitle={t("hitFallbackTitle")}
              formatDate={formatDate}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
