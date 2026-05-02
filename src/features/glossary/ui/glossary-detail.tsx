// src/features/glossary/ui/glossary-detail.tsx
import { AstRender } from "@/components/ast-render";
import type { Term } from "../types";

interface Props {
  term: Term;
}

export function GlossaryDetail({ term }: Props) {
  const updated = term.updated_at ? new Date(term.updated_at) : null;
  return (
    <article className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{term.title}</h1>
        {updated && (
          <p className="text-xs text-(--color-description)">
            Обновлено: {updated.toLocaleDateString("ru-RU")}
          </p>
        )}
      </header>
      <div className="prose">
        <AstRender blocks={term.blocks ?? []} />
      </div>
    </article>
  );
}
