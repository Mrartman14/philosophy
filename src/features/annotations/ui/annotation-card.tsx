// src/features/annotations/ui/annotation-card.tsx
import { AstRender } from "@/components/ast-render";
import { getT, getServerFmt } from "@/i18n";

import type { Annotation } from "../types";

interface Props {
  annotation: Annotation;
  /** Кнопки действий (edit/delete) — слот, заполняется server-компонентом-родителем. */
  actions?: React.ReactNode;
  /** Контекст якоря (цитата) — опциональный слот. */
  anchorContext?: React.ReactNode;
}

/**
 * Server-компонент: рендерит одну аннотацию (AST-тело + мета). Доменно-чистый,
 * без client-JS. Действия и контекст якоря приходят слотами.
 */
export async function AnnotationCard({ annotation, actions, anchorContext }: Props) {
  const t = await getT("annotations");
  const fmt = await getServerFmt();
  const updated = annotation.updated_at
    ? new Date(annotation.updated_at)
    : null;
  const vis = annotation.visibility ?? "private";
  const visLabel = vis === "public" ? t("visibility.public") : t("visibility.private");
  return (
    <article className="flex flex-col gap-2 rounded border border-(--color-border) p-3">
      <header className="flex items-center justify-between gap-2 text-xs text-(--color-fg-muted)">
        <span>
          {visLabel}
          {annotation.is_edited ? t("edited") : ""}
        </span>
        {updated && <time>{fmt.dateTime(updated, { dateStyle: "short" })}</time>}
      </header>
      {anchorContext}
      <div className="content" data-size="sm">
        <AstRender blocks={annotation.blocks ?? []} />
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </article>
  );
}
