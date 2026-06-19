// src/features/annotations/ui/annotation-card.tsx
import { AstRender } from "@/components/ast-render";

import type { Annotation } from "../types";

interface Props {
  annotation: Annotation;
  /** Кнопки действий (edit/delete) — слот, заполняется server-компонентом-родителем. */
  actions?: React.ReactNode;
  /** Контекст якоря (цитата) — опциональный слот. */
  anchorContext?: React.ReactNode;
}

const visibilityLabel: Record<string, string> = {
  private: "приватная",
  public: "публичная",
};

/**
 * Server-компонент: рендерит одну аннотацию (AST-тело + мета). Доменно-чистый,
 * без client-JS. Действия и контекст якоря приходят слотами.
 */
export function AnnotationCard({ annotation, actions, anchorContext }: Props) {
  const updated = annotation.updated_at
    ? new Date(annotation.updated_at)
    : null;
  return (
    <article className="flex flex-col gap-2 rounded border border-(--color-border) p-3">
      <header className="flex items-center justify-between gap-2 text-xs text-(--color-fg-muted)">
        <span>
          {visibilityLabel[annotation.visibility ?? "private"] ?? "приватная"}
          {annotation.is_edited ? " · изменена" : ""}
        </span>
        {updated && <time>{updated.toLocaleDateString("ru-RU")}</time>}
      </header>
      {anchorContext}
      <div className="content" data-size="sm">
        <AstRender blocks={annotation.blocks ?? []} />
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </article>
  );
}
