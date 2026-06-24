import { linkAttrs, navRefAttrs } from "./attrs";
import type { AstMarkType, MarkRenderer } from "./types";

/** nav-ref → <a href из id, data-mark, class>. null если id пуст/тип неизвестен. */
const navRef: MarkRenderer = (mark) => {
  const a = navRefAttrs(mark);
  return a ? ["a", a] : null;
};

export const MARK_MAP: Partial<Record<AstMarkType, MarkRenderer>> = {
  bold: () => ["strong", {}],
  italic: () => ["em", {}],
  code: () => ["code", { dir: "ltr" }],
  link: (mark) => ["a", linkAttrs(mark)],
  glossary_ref: navRef,
  document_ref: navRef,
  media_ref: navRef,
  comment_ref: navRef,
  canvas_ref: navRef,
};

/**
 * Марки, чей `href` — пользовательский ввод и требует санитайза (read-only
 * enhancement). nav-ref href вычисляется из доверенного id → НЕ санитайзится.
 */
export const SANITIZE_HREF_MARKS: ReadonlySet<AstMarkType> = new Set<AstMarkType>(["link"]);
