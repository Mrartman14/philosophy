// src/features/annotations/ui/annotation-card.tsx
import { AstRender } from "@/components/ast-render";
import { getT, getServerFmt } from "@/i18n";

import type { Annotation } from "../types";

interface Props {
  annotation: Annotation;
  /** Действия в подвале карточки (например, ссылки экспорта) — слот. */
  actions?: React.ReactNode;
  /** Действия в шапке справа у даты (edit/delete-иконки) — слот. */
  headerActions?: React.ReactNode;
  /** Контекст якоря (цитата) — опциональный слот. */
  anchorContext?: React.ReactNode;
  /**
   * Прятать цитату якоря на широких экранах (≥xl). В маргиналии связь с текстом
   * показывает выноска-линия, цитата избыточна; на мобильном (поле схлопнуто, линии
   * нет) — цитату оставляем. В list-режиме (отдельная страница) — не прячем.
   */
  hideAnchorOnWide?: boolean;
}

/**
 * Server-компонент: рендерит одну аннотацию (AST-тело + мета). Доменно-чистый,
 * без client-JS. Действия и контекст якоря приходят слотами.
 */
export async function AnnotationCard({
  annotation,
  actions,
  headerActions,
  anchorContext,
  hideAnchorOnWide = false,
}: Props) {
  const t = await getT("annotations");
  const fmt = await getServerFmt();
  const updated = annotation.updated_at
    ? new Date(annotation.updated_at)
    : null;
  const vis = annotation.visibility ?? "private";
  const visLabel = vis === "public" ? t("visibility.public") : t("visibility.private");
  return (
    <article className="flex flex-col gap-2 rounded border border-(--color-border) p-3">
      <header className="flex items-center gap-2 text-xs text-(--color-fg-muted)">
        <span>
          {visLabel}
          {annotation.is_edited ? t("edited") : ""}
        </span>
        <div className="ms-auto flex items-center gap-1">
          {updated && <time>{fmt.dateTime(updated, { dateStyle: "short" })}</time>}
          {headerActions}
        </div>
      </header>
      {hideAnchorOnWide ? <div className="xl:hidden">{anchorContext}</div> : anchorContext}
      <div className="content" data-size="sm">
        <AstRender blocks={annotation.blocks ?? []} />
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </article>
  );
}
