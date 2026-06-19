// src/features/glossary/ui/glossary-detail.tsx
import { AstRender } from "@/components/ast-render";
import { getT, getServerFmt } from "@/i18n";

import type { Term } from "../types";

interface Props {
  term: Term;
}

export async function GlossaryDetail({ term }: Props) {
  const [t, fmt] = await Promise.all([getT("glossary"), getServerFmt()]);
  const updated = term.updated_at ? new Date(term.updated_at) : null;
  return (
    <article className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{term.title}</h1>
        {updated && (
          <p className="text-xs text-(--color-fg-muted)">
            {t("updatedAt", { date: fmt.dateTime(updated) })}
          </p>
        )}
      </header>
      <div className="content">
        <AstRender blocks={term.blocks ?? []} />
      </div>
    </article>
  );
}
